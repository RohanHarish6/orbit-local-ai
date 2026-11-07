"""Small, deterministic regression benchmark for the local Orbit runtime."""

import json
import subprocess
import sys
import time
from pathlib import Path


CASES = [
    ("routing-code", {"action": "route", "prompt": "Debug a Python CSV parser"}, lambda r: r.get("agent") == "coder"),
    ("routing-research", {"action": "route", "prompt": "Compare the latest local models with sources"}, lambda r: r.get("agent") == "researcher"),
    ("routing-creative", {"action": "route", "prompt": "Create a storyboard for a product video"}, lambda r: r.get("agent") == "creative"),
    ("routing-writing", {"action": "route", "prompt": "Rewrite these notes as a project brief"}, lambda r: r.get("agent") == "writer"),
    ("generation-local", {"action": "execute", "prompt": "Create a concise project plan", "agent": "planner"}, lambda r: r.get("ok") and r.get("localOnly") and len(r.get("content", "")) > 40),
    ("generation-html", {"action": "execute", "prompt": "Create a short HTML brief", "output": "html"}, lambda r: r.get("content", "").startswith("<!doctype html>")),
    ("health", {"action": "health"}, lambda r: r.get("ok") and r.get("provider") == "native-python"),
]


def main():
    results = []
    started = time.time()
    process = subprocess.Popen(
        [sys.executable, "native_runtime.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        for name, message, check in CASES:
            try:
                process.stdin.write(json.dumps(message) + "\n")
                process.stdin.flush()
                line = process.stdout.readline().strip()
                response = json.loads(line or "{}")
                passed = bool(check(response))
                error = None
            except Exception as exc:
                response = {}
                passed = False
                error = str(exc)
            results.append({"name": name, "passed": passed, "error": error})
    finally:
        if process.stdin:
            process.stdin.close()
        process.wait(timeout=30)
    summary = {
        "ok": all(item["passed"] for item in results),
        "passed": sum(item["passed"] for item in results),
        "total": len(results),
        "durationSeconds": round(time.time() - started, 2),
        "results": results,
    }
    Path("data").mkdir(exist_ok=True)
    Path("data/eval_latest.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    raise SystemExit(0 if summary["ok"] else 1)


if __name__ == "__main__":
    main()
