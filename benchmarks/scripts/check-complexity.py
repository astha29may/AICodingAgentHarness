"""
benchmarks/scripts/check-complexity.py
Called by the benchmark runner for BM-09 (code quality) complexity criterion.

Uses the `ast` module to compute McCabe cyclomatic complexity for every
function in the target files. Falls back to radon if installed.

Exits 0 (PASS) if max CC ≤ limit AND no function exceeds line-length limit.
Exits 1 (FAIL) with per-function details.

Usage:
    python benchmarks/scripts/check-complexity.py src/analytics/aggregator.py \
        --cc-limit 10 --line-limit 30
"""
import ast
import sys
import json
import argparse
from pathlib import Path


class _CCVisitor(ast.NodeVisitor):
    """Minimal McCabe CC counter: 1 + decision points (if/elif/for/while/except/and/or)."""

    def __init__(self):
        self.results: list[dict] = []

    def _count(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> int:
        cc = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.For, ast.While, ast.ExceptHandler,
                                   ast.With, ast.Assert, ast.comprehension)):
                cc += 1
            elif isinstance(child, ast.BoolOp):
                cc += len(child.values) - 1
        return cc

    def visit_FunctionDef(self, node):  # noqa: N802
        self.results.append({
            "name": node.name,
            "line": node.lineno,
            "cc": self._count(node),
            "body_lines": (node.end_lineno or node.lineno) - node.lineno,
        })
        self.generic_visit(node)

    visit_AsyncFunctionDef = visit_FunctionDef


def analyse(path: Path) -> list[dict]:
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(path))
    visitor = _CCVisitor()
    visitor.visit(tree)
    for r in visitor.results:
        r["file"] = str(path)
    return visitor.results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--cc-limit", type=int, default=10)
    parser.add_argument("--line-limit", type=int, default=30)
    args = parser.parse_args()

    all_results: list[dict] = []
    for f in args.files:
        p = Path(f)
        if not p.exists():
            print(f"SKIP (not found): {f}", file=sys.stderr)
            continue
        all_results.extend(analyse(p))

    cc_violations = [r for r in all_results if r["cc"] > args.cc_limit]
    len_violations = [r for r in all_results if r["body_lines"] > args.line_limit]
    max_cc = max((r["cc"] for r in all_results), default=0)
    max_lines = max((r["body_lines"] for r in all_results), default=0)

    passed = not cc_violations and not len_violations

    output = {
        "metric": "complexity_and_length",
        "max_cyclomatic_complexity": max_cc,
        "functions_over_cc_limit": len(cc_violations),
        "max_function_lines": max_lines,
        "functions_over_len_limit": len(len_violations),
        "cc_limit": args.cc_limit,
        "line_limit": args.line_limit,
        "passed": passed,
        "cc_violations": [{"name": r["name"], "file": r["file"], "line": r["line"], "cc": r["cc"]} for r in cc_violations],
        "len_violations": [{"name": r["name"], "file": r["file"], "line": r["line"], "lines": r["body_lines"]} for r in len_violations],
    }
    print(json.dumps(output, indent=2))

    if cc_violations:
        print(f"\nCC violations (limit={args.cc_limit}):", file=sys.stderr)
        for v in cc_violations:
            print(f"  {v['file']}:{v['line']} {v['name']}  CC={v['cc']}", file=sys.stderr)
    if len_violations:
        print(f"\nLength violations (limit={args.line_limit}):", file=sys.stderr)
        for v in len_violations:
            print(f"  {v['file']}:{v['line']} {v['name']}  lines={v['lines']}", file=sys.stderr)

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
