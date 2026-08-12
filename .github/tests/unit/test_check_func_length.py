import json
import subprocess
import sys
from pathlib import Path


def _run_checker(repo_root: Path, target: Path, limit: int = 30):
    checker = repo_root / "benchmarks" / "scripts" / "check-func-length.py"
    proc = subprocess.run(
        [sys.executable, str(checker), str(target), "--limit", str(limit)],
        capture_output=True,
        text=True,
    )
    return proc


def test_flags_function_over_limit(repo_root: Path, tmp_path: Path):
    body = "\n".join(f"    x{i} = {i}" for i in range(40))
    target = tmp_path / "too_long.py"
    target.write_text(f"def big():\n{body}\n", encoding="utf-8")

    proc = _run_checker(repo_root, target)

    assert proc.returncode == 1
    result = json.loads(proc.stdout)
    assert result["metric"] == "max_function_lines"
    assert result["passed"] is False
    assert result["functions_over_limit"] >= 1
    assert result["max_function_lines"] > 30


def test_passes_function_within_limit(repo_root: Path, tmp_path: Path):
    target = tmp_path / "short.py"
    target.write_text("def small():\n    return 1\n", encoding="utf-8")

    proc = _run_checker(repo_root, target)

    assert proc.returncode == 0
    result = json.loads(proc.stdout)
    assert result["passed"] is True
    assert result["functions_over_limit"] == 0
    assert result["max_function_lines"] <= 30
