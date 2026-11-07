"""Download a small, license-aware instruction dataset for Orbit.

The script uses the public Hugging Face Dataset Viewer API, records provenance,
keeps only English examples, and writes JSONL suitable for train_orbit.py.
It intentionally downloads a bounded sample rather than mirroring a dataset.
"""

import argparse
import json
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
SOURCES = ROOT / "data" / "training_sources.json"


def fetch_rows(source, offset, length):
    query = urlencode({
        "dataset": source["dataset"],
        "config": source["config"],
        "split": source["split"],
        "offset": offset,
        "length": length,
    })
    request = Request(
        f"https://datasets-server.huggingface.co/rows?{query}",
        headers={"User-Agent": "Orbit-local-training-prep/0.1"},
    )
    with urlopen(request, timeout=60) as response:
        return json.load(response)["rows"]


def oasst_examples(rows, source):
    pending = {}
    for item in rows:
        row = item["row"]
        if row.get("deleted") or row.get("lang") != "en" or row.get("tree_state") != "ready_for_export":
            continue
        tree = row.get("message_tree_id")
        if not tree:
            continue
        if row.get("role") == "prompter":
            pending[tree] = row.get("text", "").strip()
        elif row.get("role") == "assistant" and tree in pending:
            answer = row.get("text", "").strip()
            prompt = pending.pop(tree)
            if prompt and answer and row.get("review_result", True):
                yield {
                    "prompt": prompt,
                    "answer": answer,
                    "feedback": "approved",
                    "source": source["dataset"],
                    "license": source["license"],
                    "source_id": row.get("message_id"),
                }


def dolly_examples(rows, source):
    for item in rows:
        row = item["row"]
        prompt = row.get("instruction", "").strip()
        answer = row.get("response", "").strip()
        if prompt and answer:
            context = row.get("context", "").strip()
            if context:
                prompt = f"{prompt}\n\nContext:\n{context}"
            yield {
                "prompt": prompt,
                "answer": answer,
                "feedback": "approved",
                "source": source["dataset"],
                "license": source["license"],
                "source_id": item.get("row_idx"),
            }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100, help="Examples per source.")
    parser.add_argument("--output", default="data/web_training.jsonl")
    args = parser.parse_args()
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    records = []
    for source in sources:
        offset = 0
        while len([item for item in records if item["source"] == source["dataset"]]) < args.limit:
            rows = fetch_rows(source, offset, 100)
            if not rows:
                break
            parser_fn = oasst_examples if source["dataset"] == "OpenAssistant/oasst1" else dolly_examples
            records.extend(parser_fn(rows, source))
            offset += len(rows)
            if len(rows) < 100:
                break
            time.sleep(0.2)
    per_source = {}
    with output.open("w", encoding="utf-8") as handle:
        for item in records:
            count = per_source.get(item["source"], 0)
            if count >= args.limit:
                continue
            per_source[item["source"]] = count + 1
            handle.write(json.dumps(item, ensure_ascii=False) + "\n")
    print(json.dumps({"ok": True, "output": str(output), "examples": sum(per_source.values()), "bySource": per_source}))


if __name__ == "__main__":
    main()
