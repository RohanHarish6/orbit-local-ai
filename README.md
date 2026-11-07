# Orbit

[![Build](https://github.com/RohanHarish6/orbit-local-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/RohanHarish6/orbit-local-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Contributors](https://img.shields.io/github/contributors/RohanHarish6/orbit-local-ai)](https://github.com/RohanHarish6/orbit-local-ai/graphs/contributors)

> **Orbit is open source.** Build a more private, calm, and capable local AI workspace with us.

Orbit is a local-first AI workspace for everyday tasks. The dashboard keeps the active task, permissions, local runtime, system trace, and generated artifacts visible in one calm surface.

The project is intentionally transparent about its limits: local inference, optional online escalation, explicit provider permissions, auditable memory, and deterministic verification instead of “magic” capability claims.

## Contribute

Orbit welcomes contributors of every experience level. You can help by improving the scenic interface, adding local model adapters, strengthening autonomous verification, documenting setup on different hardware, testing provider failover, or proposing safer generation workflows.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
2. Browse [good first issues](https://github.com/RohanHarish6/orbit-local-ai/issues?q=is%3Aissue+label%3A%22good+first+issue%22) or open a discussion about an idea.
3. Fork the repository, create a focused branch, and make the smallest complete change.
4. Run `npm run build` and the relevant local checks before opening a pull request.

If Orbit is useful to you, starring the repository helps other builders discover it. Sharing the project with local-AI, privacy, accessibility, and creative-tool communities is also appreciated.

The native runtime does **not** require Ollama. It is a Python worker launched directly by the Node gateway and requires a local Transformers model configured through `ORBIT_MODEL_PATH` or `data/model_config.json`. It will not silently downgrade to a weaker fallback model.

## Run locally

```powershell
npm install
npm run dev
```

In a second terminal:

```powershell
npm run server
```

Open `http://127.0.0.1:5173`.

## Windows desktop executable

Orbit can be packaged as a native Windows desktop application. The build
includes the compiled scenic interface, local gateway, runtime files, model
configuration, and the active GGUF model:

```powershell
npm run build:desktop
```

The generated installer is written to `dist\Orbit Setup 0.1.0.exe`. A portable
Windows executable is also produced when the packaging run completes. The
desktop shell starts the gateway automatically and opens Orbit in its own
window. Because the local inference worker is Python-based, the target
machine still needs Python 3.12 and the runtime dependencies installed; the
desktop package does not silently replace the local model with a cloud service.

## Native local model

The native path is the default:

```powershell
npm run server
```

To use a downloaded Transformers-compatible model without a model server:

```powershell
$env:ORBIT_MODEL_PATH = "C:\models\your-local-causal-lm"
npm run server
```

The model must already be present locally; the runtime uses `local_files_only=True` and never downloads weights at request time.

The current prototype supports:

- local runtime health and model discovery;
- task creation and resumable task switching in the dashboard;
- native local planning without Ollama;
- autonomous routing across planner, researcher, writer, coder, and creative agents;
- bounded agent tool profiles and explicit output adapters;
- explicit web-access permission state;
- local Markdown export for generated plans.

Markdown and HTML artifacts are available now. PDF, image, and video generation are represented as adapters but remain unavailable until a local renderer or ComfyUI/Stable Diffusion workflow is connected. A provider should only appear as available after its local endpoint is detected.

## Local learning

`POST /api/learn` stores accepted answers and feedback in `data/memory.jsonl`. Future native responses retrieve relevant local memories by token overlap and include them as context. This is intentionally auditable retrieval learning, not silent weight mutation: it improves continuity immediately and keeps bad feedback removable.

## Offline model training

Orbit includes an opt-in LoRA trainer for a local Transformers-compatible causal
language model. It is not a shortcut to frontier-scale capability: quality
depends on the base model, dataset size, hardware, evaluation, and safety review.
The trainer never downloads weights, never modifies the base model, and only uses
accepted/approved examples from the local memory bank.

Collect at least eight reviewed examples, then run:

```powershell
python train_orbit.py `
  --base-model "$env:USERPROFILE\.cache\huggingface\hub\models--Qwen--Qwen2.5-1.5B\snapshots\<snapshot>" `
  --output data\orbit-adapter
```

Run the local regression benchmark with:

```powershell
npm run eval:local
```

This checks routing, local-only claims, HTML output, and runtime health. It is
not a substitute for SWE-bench, multimodal evaluation, or a head-to-head
frontier-model benchmark; those require matched hardware, prompts, tools, and
independent evaluators.

The active configuration currently uses a CPU-served Qwen2.5-Coder 3B Q2_K
GGUF model:

```json
{
  "ggufModel": "models\\qwen2.5-coder-3b-gguf\\qwen2.5-coder-3b-instruct-q2_k.gguf"
}
```

GGUF inference requires `llama-cpp-python`. A Transformers model can still be
used by setting `ORBIT_MODEL_PATH`, with `ORBIT_ADAPTER_PATH` optionally
pointing to a PEFT LoRA adapter. GGUF is preferred whenever `ggufModel` is
configured.
Always evaluate held-out prompts before enabling a trained model in the dashboard.

After a local training run, Orbit can also use `data/model_config.json` to point
the gateway at the base model and LoRA adapter. This file is machine-specific;
regenerate or edit it when moving the project to another computer.

### Public training resources

`prepare_training_data.py` downloads a bounded sample from public dataset APIs
and records the source and license on every example:

```powershell
npm run prepare:training -- --limit 100
```

The curated sources are OpenAssistant OASST1 (Apache-2.0) and Databricks Dolly
15k (CC BY-SA 3.0). This project intentionally does not ingest gated,
non-commercial, or unreviewed web-scale conversation dumps. Review
`data/web_training.jsonl` before training, then include it explicitly:

```powershell
python train_orbit.py `
  --data data\memory.jsonl `
  --data data\web_training.jsonl `
  --base-model "$env:USERPROFILE\.cache\huggingface\hub\models--Qwen--Qwen2.5-1.5B\snapshots\<snapshot>" `
  --output data\orbit-adapter
```

### Autonomous capability tiers

Orbit's `/api/autonomous` endpoint uses bounded tier hopping. It begins with
local generation, adds local context for harder prompts, then escalates to
verification and repair when deterministic checks fail. A configured external
provider is represented as a separate tier and is invoked for high-complexity
prompts only when an API key and model are explicitly configured.

Orbit supports any OpenAI-compatible open-model endpoint. OpenRouter is the
default endpoint and can expose multiple open-source models without changing
the application:

```powershell
$env:ORBIT_PROVIDER_API_KEY = "your-key"
$env:ORBIT_PROVIDER_MODEL = "your-open-model-id"
# Optional for another OpenAI-compatible service:
# $env:ORBIT_PROVIDER_ENDPOINT = "https://your-service.example/v1/chat/completions"
npm run server
```

For failover, configure an ordered JSON pool instead of the single-provider
variables. Each provider can have its own model, endpoint, key, priority, and
per-process token budget:

```powershell
$env:ORBIT_PROVIDER_POOL = '[{"name":"primary","endpoint":"https://openrouter.ai/api/v1/chat/completions","model":"open-model-a","apiKey":"key-a","priority":1,"tokenBudget":50000},{"name":"backup","endpoint":"https://api.example/v1/chat/completions","model":"open-model-b","apiKey":"key-b","priority":2,"tokenBudget":50000}]'
npm run server
```

Orbit marks a provider exhausted only for quota, rate-limit, authorization,
credit, or output-length signals. It then switches to the next available
provider and carries the original request plus the prior draft into the next
attempt. Transient errors are retried through the pool; if every online
provider is unavailable, Orbit falls back to the verified local model.
Responses include `providerAttempts`, `providerPool`, and token usage metadata.

You can copy `.env.example` as a reminder of the required variables. Orbit
does not load `.env` automatically; set the variables in the process
environment before starting the gateway.

The key is read only by the local gateway and is never sent to the model. The
prompt is sent to the configured provider only for the `provider-escalation`
tier. If the provider is not configured, Orbit remains local-only.

Each autonomous response reports `capabilityTier`, `capabilitiesUsed`,
`steps`, `complexityScore`, and `verification`. Tier hopping improves
reliability and task completion around the local model; it does not turn a
3B quantized model into a frontier foundation model. Arbitrary shell,
browser, network, and credential access remain disabled unless added as
explicit, auditable adapters.

## Project status

Orbit is an active experimental open-source project. The local-first runtime
and scenic workspace are usable today; PDF/image/video generation, robust
browser retrieval, and frontier-level benchmarking remain contributor-friendly
areas for improvement. See the issue tracker for current priorities.
