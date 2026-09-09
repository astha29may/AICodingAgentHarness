import json
import subprocess
import sys
import textwrap
from pathlib import Path

import yaml


def _score(repo_root: Path, task_file: Path, workdir: Path, offline: bool = True) -> dict:
    scorer = repo_root / "benchmarks" / "scripts" / "score-task.py"
    args = [sys.executable, str(scorer), "--task", str(task_file), "--workdir", str(workdir)]
    if offline:
        args.append("--offline")
    proc = subprocess.run(args, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def _write_task(path: Path, rubric: list) -> None:
    task = {
        "id": "BM-TEST",
        "expected_outputs": [{"path": "output/RESULT.md"}],
        "evaluation": {"rubric": rubric},
    }
    path.write_text(yaml.safe_dump(task), encoding="utf-8")


def test_both_deterministic_criteria_pass(repo_root: Path, tmp_path: Path):
    workdir = tmp_path / "wd"
    out = workdir / "output"
    out.mkdir(parents=True)
    (out / "RESULT.md").write_text("Business context and success criteria here.", encoding="utf-8")

    task_file = tmp_path / "task.yaml"
    _write_task(task_file, [
        {"criterion": "file exists", "weight": 1.0,
         "check": "file-exists", "check_value": "output/RESULT.md"},
        {"criterion": "mentions success", "weight": 3.0,
         "check": "regex", "check_value": "(?si)success criteria"},
    ])

    result = _score(repo_root, task_file, workdir)
    assert result["task_id"] == "BM-TEST"
    assert result["quality_score"] == 10.0
    assert result["deterministic_only"] is True


def test_one_deterministic_criterion_fails_weighted(repo_root: Path, tmp_path: Path):
    workdir = tmp_path / "wd"
    out = workdir / "output"
    out.mkdir(parents=True)
    (out / "RESULT.md").write_text("No keyword present.", encoding="utf-8")

    task_file = tmp_path / "task.yaml"
    # file-exists (10, weight 1) + regex miss (0, weight 3) => 10/4 = 2.5
    _write_task(task_file, [
        {"criterion": "file exists", "weight": 1.0,
         "check": "file-exists", "check_value": "output/RESULT.md"},
        {"criterion": "mentions success", "weight": 3.0,
         "check": "regex", "check_value": "(?si)success criteria"},
    ])

    result = _score(repo_root, task_file, workdir)
    assert result["quality_score"] == 2.5


def test_llm_judge_excluded_in_offline_mode(repo_root: Path, tmp_path: Path):
    workdir = tmp_path / "wd"
    out = workdir / "output"
    out.mkdir(parents=True)
    (out / "RESULT.md").write_text("content", encoding="utf-8")

    task_file = tmp_path / "task.yaml"
    # file-exists (10, weight 1) + llm-judge (pending). Denominator excludes llm-judge => 10.0
    _write_task(task_file, [
        {"criterion": "file exists", "weight": 1.0,
         "check": "file-exists", "check_value": "output/RESULT.md"},
        {"criterion": "no design language", "weight": 4.0, "check": "llm-judge"},
    ])

    result = _score(repo_root, task_file, workdir)
    assert result["quality_score"] == 10.0
    assert result["deterministic_only"] is True

    judge = [c for c in result["criteria"] if c["check"] == "llm-judge"][0]
    assert judge["included"] is False
    assert judge["score"] is None


def test_no_included_criteria_yields_null_score(repo_root: Path, tmp_path: Path):
    workdir = tmp_path / "wd"
    workdir.mkdir()

    task_file = tmp_path / "task.yaml"
    _write_task(task_file, [
        {"criterion": "judge only", "weight": 2.0, "check": "llm-judge"},
    ])

    result = _score(repo_root, task_file, workdir)
    assert result["quality_score"] is None


def test_runner_has_generation_seam_and_scorer_call(repo_root: Path):
    runner = (repo_root / ".github" / "scripts" / "run-benchmarks.ps1").read_text(encoding="utf-8")
    assert "score-task.py" in runner
    assert "Get-Command copilot" in runner
    # C7 (relaxed for explicit benchmark runs): tools may run, but confined to the
    # per-run workdir — no broad path/URL/yolo bypass.
    lowered = runner.lower()
    for banned in ("--yolo", "--allow-all-paths", "--allow-all-urls", "--auto-approve"):
        assert banned not in lowered, f"broad bypass token present: {banned}"
    assert "--allow-all-tools" in lowered
    assert "--add-dir" in lowered
    assert "bm_workdir" in lowered


def test_custom_script_check_runs(repo_root: Path, tmp_path: Path):
    workdir = tmp_path / "wd"
    out = workdir / "output"
    out.mkdir(parents=True)
    (out / "RESULT.md").write_text("content", encoding="utf-8")

    checker = tmp_path / "checker.py"
    checker.write_text(textwrap.dedent(
        """
        import sys
        from pathlib import Path
        wd = Path(sys.argv[1])
        sys.exit(0 if (wd / 'output' / 'RESULT.md').is_file() else 1)
        """
    ).strip(), encoding="utf-8")

    task_file = tmp_path / "task.yaml"
    _write_task(task_file, [
        {"criterion": "custom passes", "weight": 1.0,
         "check": "custom-script", "check_value": str(checker)},
    ])

    result = _score(repo_root, task_file, workdir)
    assert result["quality_score"] == 10.0
