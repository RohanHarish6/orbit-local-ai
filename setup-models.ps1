$ErrorActionPreference = "Stop"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3.12+ is required for the native runtime."
}

$version = python --version
Write-Host "[ready] $version"

$probe = @'
import importlib.util
required = ["torch", "transformers", "peft", "datasets", "accelerate", "llama_cpp"]
missing = [name for name in required if importlib.util.find_spec(name) is None]
print(",".join(missing))
'@
$missing = @($probe | python -)
if ($missing.Count -gt 0 -and $missing[0]) {
  Write-Host "[info ] Missing optional packages: $($missing -join ', ')"
  Write-Host "[info ] Install llama-cpp-python for GGUF inference, or torch/transformers for Transformers inference."
}

python -m py_compile native_runtime.py
Write-Host "[ready] Native runtime syntax"

if ($env:ORBIT_MODEL_PATH) {
  if (-not (Test-Path $env:ORBIT_MODEL_PATH)) {
    throw "ORBIT_MODEL_PATH does not exist: $env:ORBIT_MODEL_PATH"
  }
  Write-Host "[ready] Optional local model: $env:ORBIT_MODEL_PATH"
} elseif (Test-Path "data\model_config.json") {
  Write-Host "[ready] Model configuration: data\model_config.json"
  Write-Host "[info ] The configured GGUF model must exist before starting the gateway."
} else {
  Write-Host "[info ] Set ORBIT_MODEL_PATH or add ggufModel to data\model_config.json to enable neural inference."
}

Write-Host ""
Write-Host "Native Orbit runtime is ready. Ollama is not required."
