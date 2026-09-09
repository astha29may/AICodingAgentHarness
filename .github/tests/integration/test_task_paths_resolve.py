from pathlib import Path

import yaml


def test_enabled_task_files_resolve_under_benchmarks(repo_root: Path):
    config_path = repo_root / "benchmarks" / "benchmark-config.yaml"
    config = yaml.safe_load(config_path.read_text(encoding="utf-8"))

    enabled = [t for t in config["tasks"] if t.get("enabled", True)]
    assert enabled, "expected at least one enabled task"

    for task in enabled:
        resolved = repo_root / "benchmarks" / task["file"]
        assert resolved.is_file(), f"{task['id']} -> {resolved} does not exist"
