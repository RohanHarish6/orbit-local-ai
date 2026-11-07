"""Offline LoRA fine-tuning for Orbit from reviewed local feedback.

This is deliberately opt-in. It never downloads data or model weights and
never mutates the base model directory. Use a sufficiently capable local base
model and a reviewed JSONL dataset before treating the adapter as useful.
"""

import argparse
import json
import os
import time
from pathlib import Path


def load_examples(path: Path):
    examples = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        item = json.loads(line)
        if item.get("feedback", "accepted") not in {"accepted", "approved", "positive"}:
            continue
        prompt = str(item.get("prompt", "")).strip()
        answer = str(item.get("answer", "")).strip()
        if prompt and answer:
            examples.append({"prompt": prompt, "answer": answer})
    return examples


def main():
    parser = argparse.ArgumentParser(description="Train a local Orbit LoRA adapter offline.")
    parser.add_argument("--base-model", default=os.environ.get("ORBIT_MODEL_PATH", ""))
    parser.add_argument("--data", action="append", default=None, help="Reviewed JSONL file; repeat for multiple files.")
    parser.add_argument("--output", default="data/orbit-adapter")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--status", default="data/training_status.json")
    args = parser.parse_args()
    status_path = Path(args.status).resolve()

    def write_status(state, **extra):
        status_path.parent.mkdir(parents=True, exist_ok=True)
        status_path.write_text(json.dumps({
            "state": state,
            "updatedAt": time.time(),
            **extra,
        }), encoding="utf-8")

    write_status("starting", phase="validate")

    if not args.base_model:
        raise SystemExit("Set --base-model to a local Transformers model directory.")
    base = Path(args.base_model).expanduser().resolve()
    output = Path(args.output).resolve()
    if not base.exists():
        raise SystemExit(f"Base model directory does not exist: {base}")
    data_paths = [Path(item).resolve() for item in (args.data or ["data/memory.jsonl"])]
    missing = [str(path) for path in data_paths if not path.exists()]
    if missing:
        raise SystemExit(f"Training data does not exist: {', '.join(missing)}")
    examples = []
    seen = set()
    for data_path in data_paths:
        for item in load_examples(data_path):
            key = (item["prompt"], item["answer"])
            if key not in seen:
                seen.add(key)
                examples.append(item)
    write_status("starting", phase="load-data", examples=len(examples))
    if len(examples) < 8:
        raise SystemExit(
            f"Only {len(examples)} accepted examples found. "
            "Collect at least 8 reviewed examples before fine-tuning."
        )

    try:
        import torch
        from peft import LoraConfig, TaskType, get_peft_model
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            DataCollatorForLanguageModeling,
            TrainerCallback,
            Trainer,
            TrainingArguments,
        )
        from datasets import Dataset
    except ImportError as error:
        raise SystemExit(f"Missing local training dependency: {error.name}") from error

    tokenizer = AutoTokenizer.from_pretrained(base, local_files_only=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        base,
        local_files_only=True,
        torch_dtype=torch.float32,
    )
    model.config.use_cache = False
    model = get_peft_model(
        model,
        LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=8,
            lora_alpha=16,
            lora_dropout=0.05,
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        ),
    )

    def tokenize(item):
        text = (
            "You are Orbit, a concise local-first assistant.\n"
            f"User: {item['prompt']}\nAssistant: {item['answer']}"
        )
        return tokenizer(text, truncation=True, max_length=args.max_length)

    dataset = Dataset.from_list(examples).map(tokenize, remove_columns=["prompt", "answer"])
    write_status("starting", phase="tokenize", examples=len(dataset))
    training_args = TrainingArguments(
        output_dir=str(output),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        logging_steps=1,
        save_strategy="no",
        report_to=[],
        fp16=False,
        bf16=False,
    )
    class ProgressCallback(TrainerCallback):
        def on_train_begin(self, args, state, control, **kwargs):
            write_status("running", phase="train", totalSteps=state.max_steps, step=0, progress=0)

        def on_log(self, args, state, control, logs=None, **kwargs):
            logs = logs or {}
            progress = round((state.global_step / state.max_steps) * 100, 1) if state.max_steps else 0
            write_status("running", phase="train", totalSteps=state.max_steps, step=state.global_step, progress=progress, metrics=logs)

        def on_train_end(self, args, state, control, **kwargs):
            write_status("saving", phase="save", totalSteps=state.max_steps, step=state.global_step, progress=100)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
        callbacks=[ProgressCallback()],
    )
    trainer.train()
    output.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(output)
    tokenizer.save_pretrained(output)
    write_status("complete", phase="complete", totalSteps=trainer.state.max_steps, step=trainer.state.global_step, progress=100, output=str(output), examples=len(examples), metrics=trainer.state.log_history[-1] if trainer.state.log_history else {})
    print(json.dumps({
        "ok": True,
        "examples": len(examples),
        "baseModel": str(base),
        "adapter": str(output),
        "message": "Offline LoRA adapter trained from reviewed local feedback.",
    }))


if __name__ == "__main__":
    main()
