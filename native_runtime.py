import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MEMORY_PATH = Path(os.environ.get("ORBIT_MEMORY_PATH", ROOT / "data" / "memory.jsonl"))
MODEL_CONFIG_PATH = ROOT / "data" / "model_config.json"
MODEL_CONFIG = {}
if MODEL_CONFIG_PATH.exists():
    try:
        MODEL_CONFIG = json.loads(MODEL_CONFIG_PATH.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError:
        MODEL_CONFIG = {}
MODEL_PATH = os.environ.get("ORBIT_MODEL_PATH", "").strip() or str(MODEL_CONFIG.get("baseModel", "")).strip()
ADAPTER_PATH = os.environ.get("ORBIT_ADAPTER_PATH", "").strip() or str(MODEL_CONFIG.get("adapter", "")).strip()
GGUF_PATH = os.environ.get("ORBIT_GGUF_PATH", "").strip() or str(MODEL_CONFIG.get("ggufModel", "")).strip()

torch = None
AutoModelForCausalLM = None
AutoTokenizer = None
Llama = None


def load_transformers():
    global torch, AutoModelForCausalLM, AutoTokenizer
    if torch is not None and AutoModelForCausalLM is not None:
        return True
    try:
        import torch as torch_module  # type: ignore
        from transformers import AutoModelForCausalLM as model_type  # type: ignore
        from transformers import AutoTokenizer as tokenizer_type  # type: ignore
        torch = torch_module
        AutoModelForCausalLM = model_type
        AutoTokenizer = tokenizer_type
        return True
    except Exception:
        return False


def load_gguf():
    global GGUF_MODEL, Llama
    if GGUF_MODEL is not None or not GGUF_PATH:
        return bool(GGUF_MODEL)
    try:
        from llama_cpp import Llama as llama_type
        Llama = llama_type
        GGUF_MODEL = Llama(
            model_path=GGUF_PATH,
            n_ctx=8192,
            n_threads=max(1, (os.cpu_count() or 4) - 1),
            n_gpu_layers=0,
            verbose=False,
        )
        return True
    except Exception:
        return False

MODEL = None
TOKENIZER = None
GGUF_MODEL = None


def load_memory():
    if not MEMORY_PATH.exists():
        return []
    records = []
    for line in MEMORY_PATH.read_text(encoding="utf-8").splitlines():
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return records[-500:]


def save_memory(record):
    MEMORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with MEMORY_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def tokenize(text):
    return set(re.findall(r"[a-z0-9]{3,}", text.lower()))


def recall(prompt, limit=3):
    prompt_tokens = tokenize(prompt)
    scored = []
    for item in load_memory():
        text = f"{item.get('prompt', '')} {item.get('answer', '')}"
        overlap = len(prompt_tokens.intersection(tokenize(text)))
        if overlap:
            scored.append((overlap, item))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [item for _, item in scored[:limit]]


def route(prompt):
    text = prompt.lower()
    if re.search(r"\b(code|bug|build|implement|refactor|typescript|javascript|python|sql|csv|script|function|class|frontend|backend|api|debug|test)\b", text):
        return "coder"
    if re.search(r"\b(research|compare|sources|latest|find out|investigate)\b", text):
        return "researcher"
    if re.search(r"\b(image|illustration|visual|video|storyboard|shot)\b", text):
        return "creative"
    if re.search(r"\b(write|rewrite|document|brief|email|pdf|report)\b", text):
        return "writer"
    return "planner"


def micro_response(prompt, agent="planner", output="markdown"):
    memories = recall(prompt)
    memory_note = ""
    if memories:
        memory_note = "\n\nRelevant local memory:\n" + "\n".join(
            f"- {item.get('answer', '')[:240]}" for item in memories
        )
    if agent == "coder":
        answer = (
            f"# Local implementation plan\n\n"
            f"## Outcome\n{prompt}\n\n"
            "## Steps\n"
            "1. Define the smallest testable behavior and its inputs.\n"
            "2. Implement the change using the existing project patterns.\n"
            "3. Run focused validation and record any remaining edge cases.\n\n"
            "## Safety boundary\nThis native worker proposes code work but does not execute arbitrary commands."
        )
    elif agent == "researcher":
        answer = (
            f"# Research brief\n\n## Question\n{prompt}\n\n"
            "## Research protocol\n"
            "1. Gather primary sources and record URLs locally.\n"
            "2. Separate observed facts from interpretation.\n"
            "3. Compare sources, date the findings, and state uncertainty.\n\n"
            "Web access is not silently invoked by the native runtime."
        )
    elif agent == "writer":
        answer = (
            f"# {prompt.title()}\n\n"
            "## Purpose\n"
            f"This local draft is focused on: {prompt}\n\n"
            "## Summary\n"
            "A concise, reviewable draft generated on-device. Replace assumptions with confirmed project facts before publishing.\n\n"
            "## Next steps\n"
            "- Review the factual claims.\n"
            "- Add source material or local files.\n"
            "- Export the approved version."
        )
    elif agent == "creative":
        answer = (
            f"# Creative brief\n\n## Request\n{prompt}\n\n"
            "## Direction\n"
            "Define subject, audience, aspect ratio, visual language, motion, and negative constraints before sending this brief to a local media workflow.\n\n"
            "## Shot plan\n"
            "1. Establish the subject and setting.\n"
            "2. Make the key transformation legible.\n"
            "3. End on a clean frame suitable for export.\n\n"
            "No image or video provider is invoked until a local endpoint is configured."
        )
    else:
        answer = (
            f"# Focused plan\n\n## Outcome\n{prompt}\n\n"
            "1. Clarify the desired end state and constraints.\n"
            "2. Complete the smallest useful first pass.\n"
            "3. Verify the result and save the artifact locally.\n\n"
            "The native planner is running without Ollama."
        )
    return answer + memory_note


def load_optional_model():
    global MODEL, TOKENIZER
    if load_gguf():
        return True
    if MODEL is not None or not MODEL_PATH or not load_transformers():
        return bool(MODEL)
    TOKENIZER = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
    MODEL = AutoModelForCausalLM.from_pretrained(MODEL_PATH, local_files_only=True)
    if ADAPTER_PATH:
        try:
            from peft import PeftModel
            MODEL = PeftModel.from_pretrained(MODEL, ADAPTER_PATH, local_files_only=True)
        except Exception:
            pass
    MODEL.eval()
    return True


def model_response(prompt, agent):
    if load_gguf():
        system = (
            f"You are Orbit's {agent} agent. Work locally, be precise, and do not claim "
            "tools or actions that were not executed. Use concise headings and steps."
        )
        result = GGUF_MODEL.create_chat_completion(
            messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.2,
            top_p=0.9,
        )
        return result["choices"][0]["message"]["content"].strip()
    if not load_optional_model():
        raise RuntimeError(
            "The configured local neural model is unavailable. "
            "Set ORBIT_MODEL_PATH to a local Transformers model."
        )
    memories = recall(prompt)
    memory_text = "\n".join(f"- {item.get('answer', '')[:240]}" for item in memories)
    system = (
        f"You are Orbit's {agent} agent. You are local-first, precise, and honest. "
        "Do not claim web access, file changes, tool calls, or completed actions unless the runtime reports them. "
        "Return a useful answer with clear headings or numbered steps when appropriate."
    )
    if memory_text:
        system += f"\nRelevant approved local memory:\n{memory_text}"
    if hasattr(TOKENIZER, "apply_chat_template") and TOKENIZER.chat_template:
        messages = [{"role": "system", "content": system}, {"role": "user", "content": prompt}]
        inputs = TOKENIZER.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt")
        attention = torch.ones_like(inputs)
        model_inputs = {"input_ids": inputs, "attention_mask": attention}
    else:
        prefix = f"{system}\nUser: {prompt}\nAssistant:"
        model_inputs = TOKENIZER(prefix, return_tensors="pt")
    with torch.no_grad():
        output = MODEL.generate(**model_inputs, max_new_tokens=320, do_sample=False, repetition_penalty=1.05, pad_token_id=TOKENIZER.eos_token_id)
    generated = output[0][model_inputs["input_ids"].shape[1]:]
    return TOKENIZER.decode(generated, skip_special_tokens=True).strip()


def render_output(content, output):
    if output != "html":
        return content
    escaped = (
        content.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return (
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\">"
        "<title>Orbit local artifact</title>"
        "<body><main style=\"max-width:760px;margin:40px auto;font:16px/1.6 system-ui\">"
        f"<pre style=\"white-space:pre-wrap\">{escaped}</pre>"
        "</main></body></html>"
    )


def handle(message):
    action = message.get("action")
    if action == "health":
        model_loaded = load_gguf() or load_optional_model()
        model_name = Path(GGUF_PATH).name if GGUF_PATH and GGUF_MODEL else (Path(MODEL_PATH).name if MODEL_PATH else None)
        if not GGUF_MODEL:
            for marker in ("models--",):
                if marker in MODEL_PATH:
                    model_name = MODEL_PATH.split(marker, 1)[1].split("\\", 1)[0].replace("--", "/")
                    break
            if ADAPTER_PATH:
                model_name = f"{model_name} + {Path(ADAPTER_PATH).name}"
        return {
            "ok": True,
            "provider": "native-python",
            "model": model_name if model_loaded else None,
            "adapter": Path(ADAPTER_PATH).name if ADAPTER_PATH and not GGUF_MODEL else None,
            "gguf": Path(GGUF_PATH).name if GGUF_PATH else None,
            "torch": torch is not None,
            "transformers": AutoModelForCausalLM is not None,
            "modelLoaded": model_loaded,
            "memoryCount": len(load_memory()),
            "message": "Native local model ready." if model_loaded else "Native local model unavailable.",
        }
    if action == "route":
        chosen = route(message.get("prompt", ""))
        return {"ok": True, "agent": chosen, "reason": "Native deterministic router with local memory support.", "needsWeb": False}
    if action in ("chat", "plan", "execute"):
        prompt = str(message.get("prompt", "")).strip()
        if not prompt:
            return {"ok": False, "error": "A prompt is required."}
        agent = message.get("agent") or route(prompt)
        answer = render_output(model_response(prompt, agent), message.get("output", "markdown"))
        return {"ok": True, "agent": agent, "model": Path(GGUF_PATH).name if GGUF_MODEL else (Path(MODEL_PATH).name if MODEL_PATH else None), "content": answer, "localOnly": True}
    if action == "learn":
        prompt = str(message.get("prompt", "")).strip()
        answer = str(message.get("answer", "")).strip()
        if not prompt or not answer:
            return {"ok": False, "error": "Learning requires prompt and answer."}
        save_memory({"timestamp": time.time(), "prompt": prompt, "answer": answer, "feedback": message.get("feedback", "accepted")})
        return {"ok": True, "memoryCount": len(load_memory()), "message": "Feedback stored in the local memory bank."}
    return {"ok": False, "error": f"Unknown native action: {action}"}


for line in sys.stdin:
    try:
        message = json.loads(line.lstrip("\ufeff"))
        print(json.dumps(handle(message), ensure_ascii=False), flush=True)
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), flush=True)
