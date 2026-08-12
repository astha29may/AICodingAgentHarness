"""
benchmarks/scripts/parse-usage.py
Extract consumption metrics from a copilot `--output-format json` (JSONL) generation log.

The CLI does not expose a raw input-token count; the unified consumption signal is AIU
(session.usage_checkpoint.totalNanoAiu). We also sum assistant.message.outputTokens and read
result.usage.premiumRequests + codeChanges (files/lines) for AIU-per-outcome ratios.

Usage:
    python benchmarks/scripts/parse-usage.py --log <generation.log>   # prints one JSON object
"""
import argparse
import json
from pathlib import Path


def _events(path: str):
    text = Path(path).read_text(encoding="utf-8-sig", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("{"):
            try:
                yield json.loads(line)
            except ValueError:
                continue


def _num(d: dict, key: str):
    return d.get(key) or 0


def _bump(acc: dict, key: str, value: float) -> None:
    acc[key] = max(acc[key], value)


def _est_tokens(chars: int) -> int:
    return chars // 4  # rough chars-per-token estimate (CLI does not expose real input tokens)


def _memory_chars(workdir) -> int:
    if not workdir:
        return 0
    total = 0
    for name in ("memory-repo.instructions.md", "memory-global.instructions.md"):
        p = Path(workdir) / ".github" / "instructions" / name
        if p.is_file():
            total += len(p.read_text(encoding="utf-8", errors="replace"))
    return total


def _apply_usage(etype: str, data: dict, ev: dict, acc: dict) -> None:
    if etype == "session.usage_checkpoint":
        _bump(acc, "aiu", _num(data, "totalNanoAiu") / 1e9)
        _bump(acc, "premium_requests", _num(data, "totalPremiumRequests"))
    elif etype == "assistant.message":
        acc["output_tokens"] += _num(data, "outputTokens")
    elif etype == "result":
        usage = ev.get("usage") or {}
        changes = usage.get("codeChanges") or {}
        _bump(acc, "premium_requests", _num(usage, "premiumRequests"))
        acc["files_modified"] = len(changes.get("filesModified") or [])
        acc["lines_added"] = _num(changes, "linesAdded")


def _apply_context(etype: str, data: dict, ev: dict, acc: dict) -> None:
    if etype == "tool.execution_start":
        acc["tool_call_count"] += 1
    elif etype in ("session.custom_agents_updated", "session.skills_loaded"):
        acc["instruction_chars"] += len(json.dumps(ev))
    elif etype == "user.message":
        acc["prompt_chars"] = max(acc["prompt_chars"], len(str(data.get("transformedContent") or "")))


def extract(path: str, workdir=None) -> dict:
    acc = {"aiu": 0.0, "premium_requests": 0.0, "output_tokens": 0, "files_modified": 0,
           "lines_added": 0, "tool_call_count": 0, "instruction_chars": 0, "prompt_chars": 0}
    for ev in _events(path):
        etype = ev.get("type")
        data = ev.get("data") or {}
        _apply_usage(etype, data, ev, acc)
        _apply_context(etype, data, ev, acc)
    prompt_est = _est_tokens(acc.pop("prompt_chars"))
    instr_est = _est_tokens(acc.pop("instruction_chars"))
    mem_est = _est_tokens(_memory_chars(workdir))
    acc["aiu"] = round(acc["aiu"], 3)
    acc["premium_requests"] = round(acc["premium_requests"], 2)
    acc["prompt_tokens_estimated"] = prompt_est
    acc["instruction_tokens_estimated"] = instr_est
    acc["memory_tokens_estimated"] = mem_est
    acc["known_input_tokens_estimated"] = prompt_est + instr_est + mem_est
    return acc


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Parse consumption metrics from a copilot JSON log.")
    parser.add_argument("--log", required=True)
    parser.add_argument("--workdir", default=None, help="Seeded workspace, to estimate memory tokens.")
    args = parser.parse_args(argv)
    print(json.dumps(extract(args.log, args.workdir)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
