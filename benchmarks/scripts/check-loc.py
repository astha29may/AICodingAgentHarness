"""
benchmarks/scripts/check-loc.py
Called by the benchmark runner for BM-07 (DRY/redundancy) LOC criterion.

Counts non-blank, non-comment lines in all .py files listed in sys.argv[1:].
Exits 0 (PASS) if total LOC ≤ ceiling from environment variable LOC_CEILING.
Exits 1 (FAIL) with details if over budget.

Usage (called by run-benchmarks.ps1):
    python benchmarks/scripts/check-loc.py src/config/loader.py --ceiling 80
"""
import ast
import sys
import argparse
from pathlib import Path


def count_loc(path: Path) -> int:
    """Non-blank, non-comment source lines."""
    lines = path.read_text(encoding="utf-8").splitlines()
    return sum(
        1 for line in lines
        if line.strip() and not line.strip().startswith("#")
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", help="Python source files to measure")
    parser.add_argument("--ceiling", type=int, required=True, help="Max LOC allowed")
    args = parser.parse_args()

    total = 0
    per_file = {}
    for f in args.files:
        p = Path(f)
        if not p.exists():
            print(f"SKIP (not found): {f}", file=sys.stderr)
            continue
        loc = count_loc(p)
        per_file[f] = loc
        total += loc

    ratio = total / args.ceiling if args.ceiling else 0
    print(f"LOC check: {total} / {args.ceiling} (ratio: {ratio:.2f})")
    for f, loc in per_file.items():
        print(f"  {f}: {loc} lines")

    # Emit structured result for the benchmark runner
    import json
    print(json.dumps({
        "metric": "loc_vs_ceiling_ratio",
        "value": round(ratio, 3),
        "lines_of_code": total,
        "ceiling": args.ceiling,
        "passed": total <= args.ceiling,
    }))

    return 0 if total <= args.ceiling else 1


if __name__ == "__main__":
    sys.exit(main())
