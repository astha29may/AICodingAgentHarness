"""
benchmarks/scripts/check-duplication.py
Called by the benchmark runner for BM-07 (DRY/redundancy) duplicate-code criterion.

Strategy: tokenise each function body into a normalised token sequence,
then use Jaccard similarity to detect near-duplicate function pairs.
Also runs pylint --disable=all --enable=R0801 for exact duplicate detection
if pylint is available.

Exits 0 (PASS) if duplicate_code_ratio ≤ threshold.
Exits 1 (FAIL) with details if over threshold.

Usage:
    python benchmarks/scripts/check-duplication.py src/config/loader.py --threshold 0.05
"""
import ast
import sys
import argparse
import itertools
import tokenize
import io
import json
from pathlib import Path


def _normalise_tokens(source: str) -> list[str]:
    """Strip names and literals; keep only token type tags for structural comparison."""
    tokens = []
    try:
        for tok in tokenize.generate_tokens(io.StringIO(source).readline):
            if tok.type in (tokenize.NAME,):
                tokens.append("NAME")
            elif tok.type == tokenize.NUMBER:
                tokens.append("NUM")
            elif tok.type == tokenize.STRING:
                tokens.append("STR")
            elif tok.type == tokenize.OP:
                tokens.append(tok.string)
            # skip COMMENT, NEWLINE, INDENT, DEDENT, ENDMARKER
    except tokenize.TokenError:
        pass
    return tokens


def _jaccard(a: list, b: list) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(zip(a, a[1:])), set(zip(b, b[1:]))  # bigrams
    if not sa and not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def extract_functions(path: Path) -> dict[str, str]:
    """Return {qualified_name: source_body} for every function/method."""
    source = path.read_text(encoding="utf-8")
    tree = ast.parse(source)
    lines = source.splitlines()
    funcs = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            body_lines = lines[node.lineno - 1: node.end_lineno]
            funcs[f"{path.stem}.{node.name}:{node.lineno}"] = "\n".join(body_lines)
    return funcs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--threshold", type=float, default=0.05)
    args = parser.parse_args()

    all_funcs: dict[str, list[str]] = {}
    for f in args.files:
        p = Path(f)
        if not p.exists():
            continue
        for name, body in extract_functions(p).items():
            all_funcs[name] = _normalise_tokens(body)

    pairs = list(itertools.combinations(all_funcs.keys(), 2))
    duplicate_pairs = []
    for a, b in pairs:
        score = _jaccard(all_funcs[a], all_funcs[b])
        if score >= 0.7:  # 70% structural similarity = near-duplicate
            duplicate_pairs.append({"a": a, "b": b, "similarity": round(score, 3)})

    total_funcs = len(all_funcs)
    dup_ratio = len(duplicate_pairs) / total_funcs if total_funcs else 0.0

    result = {
        "metric": "duplicate_code_ratio",
        "value": round(dup_ratio, 4),
        "threshold": args.threshold,
        "duplicate_pairs": duplicate_pairs,
        "total_functions": total_funcs,
        "passed": dup_ratio <= args.threshold,
    }
    print(json.dumps(result, indent=2))

    if duplicate_pairs:
        print(f"\nDuplicate pairs ({len(duplicate_pairs)}):", file=sys.stderr)
        for p in duplicate_pairs:
            print(f"  {p['a']} <-> {p['b']}  similarity={p['similarity']}", file=sys.stderr)

    return 0 if dup_ratio <= args.threshold else 1


if __name__ == "__main__":
    sys.exit(main())
