import json
from pathlib import Path


def test_metrics_json_is_valid_single_object(repo_root: Path):
    metrics_path = repo_root / "benchmarks" / "baseline" / "metrics.json"
    data = json.loads(metrics_path.read_text(encoding="utf-8"))

    assert isinstance(data, dict)
    assert "tasks" in data

    tasks = data["tasks"]
    expected = {f"BM-0{n}" for n in range(1, 10)}
    assert set(tasks.keys()) == expected

    for task in tasks.values():
        assert all(value is None for value in task.values())
