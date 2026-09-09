"""
benchmarks/scripts/check-func-length.py
Called by the benchmark runner for BM-09 (code quality) function-length criterion.

Uses the `ast` module to measure the body line span of every function in the
target files. Exits 0 (PASS) if every function is within the limit, else 1.

Usage:
    python benchmarks/scripts/check-func-length.py src/analytics/aggregator.py --limit 30
"""
import ast
import sys
import json
import argparse
from pathlib import Path


def _function_lengths(path: Path) -> list[dict]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    results: list[dict] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            span = (node.end_lineno or node.lineno) - node.lineno + 1
            results.append({"name": node.name, "line": node.lineno, "lines": span})
    return results


def _collect(files: list[str]) -> list[dict]:
    results: list[dict] = []
    for f in files:
        p = Path(f)
        if not p.exists():
            print(f"SKIP (not found): {f}", file=sys.stderr)
            continue
        for r in _function_lengths(p):
            r["file"] = f
            results.append(r)
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()

    results = _collect(args.files)
    over = [r for r in results if r["lines"] > args.limit]
    max_lines = max((r["lines"] for r in results), default=0)
    passed = not over

    print(json.dumps({
        "metric": "max_function_lines",
        "max_function_lines": max_lines,
        "functions_over_limit": len(over),
        "limit": args.limit,
        "passed": passed,
    }, indent=2))

    for v in over:
        print(f"  {v['file']}:{v['line']} {v['name']}  lines={v['lines']}", file=sys.stderr)

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
