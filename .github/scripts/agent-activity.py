#!/usr/bin/env python3
"""Record and query harness agent run activity — a project- and code-agnostic run signal.

The orchestrator brackets each dispatched agent with a start/end marker so the dashboard can
show which agents are running regardless of where the produced code lives. This is the reliable
way to know an agent (e.g. observability-engineer, whose output can land anywhere) is running,
since file-path heuristics cannot be layout-agnostic.

Usage:
  python .github/scripts/agent-activity.py --agent observability-engineer --event start
  python .github/scripts/agent-activity.py --agent observability-engineer --event end
  python .github/scripts/agent-activity.py --list          # print agents currently running
"""
import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
LOG = REPO_ROOT / "gan-harness" / "agent-activity.jsonl"


def _read() -> list:
    records = []
    try:
        for line in LOG.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    except OSError:
        pass
    return records


def _running() -> list:
    last = {}
    for rec in _read():
        agent = rec.get("agent")
        if agent:
            last[agent] = rec.get("event")
    return sorted(a for a, event in last.items() if event == "start")


def main() -> int:
    parser = argparse.ArgumentParser(description="Harness agent run-activity signal.")
    parser.add_argument("--agent", help="agent name, e.g. ai-engineer")
    parser.add_argument("--event", choices=["start", "end"], help="run boundary to record")
    parser.add_argument("--task", default="", help="optional task id/context")
    parser.add_argument("--note", default="", help="optional short note")
    parser.add_argument("--list", action="store_true", help="print agents currently running")
    args = parser.parse_args()

    if args.list:
        print("\n".join(_running()) or "(no agents running)")
        return 0
    if not args.agent or not args.event:
        parser.error("--agent and --event are required unless --list")

    record = {"agent": args.agent, "event": args.event, "at": int(time.time() * 1000)}
    if args.task:
        record["task"] = args.task
    if args.note:
        record["note"] = args.note

    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
    print(f"{args.agent}: {args.event}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
