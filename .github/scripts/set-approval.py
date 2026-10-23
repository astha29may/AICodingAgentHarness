#!/usr/bin/env python3
"""Set or check a harness approval checkpoint in gan-harness/approvals.json.

This is the single shared gate for the `design` and `plan` checkpoints. The dashboard's
POST /api/approve writes the same file, so an approval from either surface — the dashboard
Approve button or the agent chat (via this script) — unblocks the next harness stage.

Usage:
  python .github/scripts/set-approval.py --stage design --approve [--by chat]
  python .github/scripts/set-approval.py --stage plan --revoke
  python .github/scripts/set-approval.py --stage design --check   # exit 0 if approved, else 1
"""
import argparse
import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
APPROVALS = REPO_ROOT / "gan-harness" / "approvals.json"


def _load() -> dict:
    try:
        return json.loads(APPROVALS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Harness approval gate (design|plan).")
    parser.add_argument("--stage", required=True, choices=["design", "plan"])
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--approve", action="store_true", help="record approval")
    action.add_argument("--revoke", action="store_true", help="withdraw approval")
    action.add_argument("--check", action="store_true", help="exit 0 if approved, else 1")
    parser.add_argument("--by", default="chat", help="who approved (default: chat)")
    args = parser.parse_args()

    data = _load()

    if args.check:
        approved = bool(data.get(args.stage, {}).get("approved"))
        print(f"{args.stage}: {'approved' if approved else 'not approved'}")
        return 0 if approved else 1

    data[args.stage] = {
        "approved": bool(args.approve),
        "at": int(time.time() * 1000),
        "by": args.by,
    }
    APPROVALS.parent.mkdir(parents=True, exist_ok=True)
    APPROVALS.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"{args.stage}: {'approved' if args.approve else 'revoked'} by {args.by}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
