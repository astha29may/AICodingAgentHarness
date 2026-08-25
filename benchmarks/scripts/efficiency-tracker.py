"""Per-build efficiency tracker — turn "is it improving?" into a trend table.

Run once after each harness build (autonomously at closeout, or by hand). Consumption tokens are read
AUTOMATICALLY from the VS Code Copilot debug log (debug-logs/<session>/main.jsonl `llm_request` events:
output + fresh/uncached input); pass --session-log to point at a specific one, or --tokens to override.
Judge by TREND, not absolutes: tokens-per-quality and iterations-to-PASS should fall as memory grows.

Examples:
  python efficiency-tracker.py --surface vscode --iterations 3 --build .        # tokens auto-read
  python efficiency-tracker.py --surface vscode --iterations 1 --quality 8.15 --tokens 351656

Rows append to gan-harness/efficiency-log.csv; the whole trend prints each run.
"""
import argparse
import csv
import glob
import importlib.util
import os
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOG = ROOT / "gan-harness" / "efficiency-log.csv"
FIELDS = ["date", "surface", "quality", "tokens", "input_tokens", "output_tokens",
          "iterations", "memories", "tok_per_q", "note"]


def _find_session_log():
    pattern = os.path.join(os.environ.get("APPDATA", ""), "Code", "User", "workspaceStorage",
                           "*", "GitHub.copilot-chat", "debug-logs", "*", "main.jsonl")
    logs = sorted(glob.glob(pattern), key=os.path.getmtime)
    return logs[-1] if logs else None


def _num(line: str, field: str) -> int:
    match = re.search(r'"' + field + r'"\s*:\s*(\d+)', line)
    return int(match.group(1)) if match else 0


def session_token_breakdown(session_log=None):
    """Measured tokens from the VS Code chat debug log: fresh/uncached input, output, and total."""
    log = session_log or _find_session_log()
    if not log or not Path(log).exists():
        return None
    out, fresh = 0, 0
    for line in Path(log).read_text(encoding="utf-8", errors="ignore").splitlines():
        if '"type":"llm_request"' not in line:
            continue
        out += _num(line, "outputTokens")
        fresh += _num(line, "inputTokens") - _num(line, "cachedTokens")
    fresh = max(0, fresh)
    return {"input": fresh, "output": out, "total": out + fresh}


def session_tokens(session_log=None):
    """Billable tokens (output + fresh/uncached input) summed from the VS Code chat debug log."""
    breakdown = session_token_breakdown(session_log)
    return breakdown["total"] if breakdown else None


def _quality(build_dir: str) -> float:
    spec = importlib.util.spec_from_file_location("cb", Path(__file__).resolve().parent / "check-build.py")
    cb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cb)
    return cb.build_score(Path(build_dir))["score"]


def _memory_count() -> int:
    import yaml
    total = 0
    for name in ("conventions.yaml", "style.yaml"):
        path = ROOT / ".github" / "memory" / "repo" / name
        doc = (yaml.safe_load(path.read_text(encoding="utf-8")) or {}) if path.exists() else {}
        for value in (doc.values() if isinstance(doc, dict) else []):
            if isinstance(value, list):
                total += len([r for r in value if isinstance(r, dict) and r.get("id")])
    return total


def _delta(prev: dict, cur: dict, key: str, lower_is_better: bool) -> str:
    try:
        x, y = float(prev[key]), float(cur[key])
    except (ValueError, TypeError):
        return f"{key} n/a"
    verdict = "flat" if y == x else ("IMPROVING" if (y < x) == lower_is_better else "worse")
    return f"{key} {x}->{y} [{verdict}]"


def _trend(rows: list) -> str:
    if len(rows) < 2:
        return "(need >= 2 builds to show a trend)"
    prev, cur = rows[-2], rows[-1]
    return "  |  ".join([_delta(prev, cur, "tokens", True), _delta(prev, cur, "iterations", True),
                         _delta(prev, cur, "quality", False)])


def _ensure_header() -> None:
    """Create the log with the current header, or migrate an older header in place (back-filling blanks)."""
    if not LOG.exists():
        with LOG.open("w", newline="", encoding="utf-8") as fh:
            csv.DictWriter(fh, fieldnames=FIELDS).writeheader()
        return
    existing = list(csv.DictReader(LOG.open(encoding="utf-8")))
    with LOG.open(encoding="utf-8") as fh:
        header = fh.readline().strip().split(",")
    if header == FIELDS:
        return
    with LOG.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDS)
        writer.writeheader()
        for record in existing:
            writer.writerow({k: record.get(k, "") for k in FIELDS})


def _append(row: dict) -> None:
    _ensure_header()
    with LOG.open("a", newline="", encoding="utf-8") as fh:
        csv.DictWriter(fh, fieldnames=FIELDS).writerow(row)


def _parse(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--surface", required=True, choices=["vscode", "cli"])
    ap.add_argument("--iterations", type=int, required=True)
    ap.add_argument("--tokens", type=int, default=None, help="override; default auto-reads the VS Code chat debug log")
    ap.add_argument("--session-log", default=None, help="path to a specific debug-logs/<id>/main.jsonl")
    ap.add_argument("--build", default=None, help="dir with src/tests to score live; or pass --quality")
    ap.add_argument("--quality", type=float, default=None)
    ap.add_argument("--memories", type=int, default=None, help="override; default auto-counts the store")
    ap.add_argument("--note", default="")
    return ap.parse_args(argv)


def main(argv=None):
    a = _parse(argv)
    quality = a.quality if a.quality is not None else _quality(a.build or ".")
    memories = a.memories if a.memories is not None else _memory_count()
    breakdown = None if a.tokens is not None else session_token_breakdown(a.session_log)
    tokens = a.tokens if a.tokens is not None else (breakdown["total"] if breakdown else None)
    tpq = round(tokens / quality) if (tokens and quality) else "n/a"
    _append({"date": date.today().isoformat(), "surface": a.surface, "quality": round(quality, 2),
             "tokens": tokens if tokens is not None else "n/a",
             "input_tokens": breakdown["input"] if breakdown else "",
             "output_tokens": breakdown["output"] if breakdown else "",
             "iterations": a.iterations, "memories": memories, "tok_per_q": tpq, "note": a.note})
    rows = list(csv.DictReader(LOG.open(encoding="utf-8")))
    print(" | ".join(h.ljust(10) for h in FIELDS))
    print("-" * (13 * len(FIELDS)))
    for r in rows:
        print(" | ".join(str(r[h]).ljust(10) for h in FIELDS))
    print("\nlatest vs previous:  " + _trend(rows))


if __name__ == "__main__":
    main()
