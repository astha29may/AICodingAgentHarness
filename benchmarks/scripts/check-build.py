"""
benchmarks/scripts/check-build.py
Deterministic build-quality scorer for the CODE pipeline stage.

Scores a produced build 0-10 from dep-free signals plus best-effort test execution:
  - src present + tests present (structure a production MVE needs)
  - syntax/compile clean (ast.parse for .py, `node --check` for .js/.jsx)
  - tests execute and pass (pytest / node --test, short timeout). Only VERIFIED
    (executed + passing) tests earn full credit; tests that are merely present but
    never run earn minimal credit - an unverified build is not production-grade.
  - modularity + duplication: measured on src/ only (production code) so that repetitive test
    boilerplate and longer test files do not skew them; small, well-separated modules score high.

Runnable, modular builds with passing tests earn full credit; flat or unverified
builds score lower - aligning the score with "minimal but production-grade".

Emits one JSON line: {"score": <0-10>, "signals": {...}}.
Usage: python check-build.py <workdir>
"""
import ast
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SRC_EXT = {".py", ".js", ".ts", ".jsx", ".tsx"}
SKIP = {"__pycache__", "node_modules", ".venv"}


def _files(root: Path):
    if not root.is_dir():
        return []
    return [p for p in root.rglob("*") if p.is_file()
            and p.suffix in SRC_EXT and not (SKIP & set(p.parts))]


def _syntax_ok(path: Path) -> bool:
    if path.suffix == ".py":
        try:
            ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
            return True
        except (SyntaxError, ValueError):
            return False
    if path.suffix in {".js", ".jsx"} and shutil.which("node"):
        return subprocess.run(["node", "--check", str(path)], capture_output=True).returncode == 0
    return True  # language we cannot check here: do not penalise


def _fraction(items, pred) -> float:
    return 1.0 if not items else sum(1 for x in items if pred(x)) / len(items)


def _run_counts(cmd, workdir: Path, pass_pat: str, fail_pats):
    try:
        r = subprocess.run(cmd, cwd=str(workdir), capture_output=True,
                           text=True, errors="replace", timeout=180)
    except (OSError, subprocess.TimeoutExpired):
        return None
    out = r.stdout or ""
    pm = re.search(pass_pat, out)
    fms = [re.search(fp, out) for fp in fail_pats]
    if not pm and not any(fms):
        return None  # could not collect/run (missing deps/runner) -> unverified
    p = int(pm.group(1)) if pm else 0
    bad = sum(int(m.group(1)) for m in fms if m)
    return p / (p + bad) if (p + bad) else 0.0


def _run_pytest(workdir: Path):
    return _run_counts([sys.executable, "-m", "pytest", "-q", "tests"], workdir,
                       r"(\d+) passed", [r"(\d+) failed", r"(\d+) error"])


def _test_credit(workdir: Path, ntest: int, has_py: bool) -> float:
    if has_py:
        frac = _run_pytest(workdir)
    else:
        frac = _run_counts(["node", "--test", "tests"], workdir,
                           r"# pass (\d+)", [r"# fail (\d+)"])
    if frac is not None:
        return round(2.0 * frac, 3)
    return round(0.4 * min(1.0, ntest / 2.0), 3)  # tests present but UNVERIFIED: minimal credit only


def _loc(path: Path) -> int:
    n = 0
    for ln in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        s = ln.strip()
        if s and not s.startswith(("#", "//", "*", "/*")):
            n += 1
    return n


def _median_loc(files) -> int:
    return sorted(_loc(f) for f in files)[len(files) // 2] if files else 0


def _modularity_pts(median: int) -> float:
    # Reward well-separated modules (src-only median); full credit <=40 LOC/file, 0 by 150 (monolithic).
    return round(1.5 * max(0.0, min(1.0, (150 - median) / 110.0)), 3)


def _dup_pts(files) -> float:
    lines = []
    for f in files:
        for ln in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            s = ln.strip()
            if len(s) >= 8 and not s.startswith(("import", "from", "//", "#", "*")):
                lines.append(s)
    if not lines:
        return 1.5
    ratio = (len(lines) - len(set(lines))) / len(lines)
    return round(1.5 * max(0.0, min(1.0, (0.15 - ratio) / 0.15)), 3)


def build_score(workdir: Path) -> dict:
    src = _files(workdir / "src")
    tests = _files(workdir / "tests")
    allf = src + tests
    syntax = _fraction(allf, _syntax_ok)
    has_py = any(p.suffix == ".py" for p in allf)
    median = _median_loc(src)  # production modularity; tests are naturally longer/repetitive
    b_src = 1.5 * min(1.0, len(src) / 3.0)
    b_tests = 1.5 * min(1.0, len(tests) / 2.0)
    b_syntax = 2.0 * syntax
    b_pass = _test_credit(workdir, len(tests), has_py)
    b_mod = _modularity_pts(median) if src else 0.0
    b_dup = _dup_pts(src) if src else 0.0  # src-only: test boilerplate is not production duplication
    score = round(b_src + b_tests + b_syntax + b_pass + b_mod + b_dup, 2)
    return {"score": max(0.0, min(10.0, score)),
            "signals": {"src_files": len(src), "test_files": len(tests),
                        "median_file_loc": median, "syntax_clean": round(syntax, 3),
                        "src_pts": round(b_src, 2), "tests_pts": round(b_tests, 2),
                        "syntax_pts": round(b_syntax, 2), "tests_pass_pts": b_pass,
                        "modularity_pts": b_mod, "dup_pts": b_dup}}


def main():
    workdir = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
    print(json.dumps(build_score(workdir)))


if __name__ == "__main__":
    main()
