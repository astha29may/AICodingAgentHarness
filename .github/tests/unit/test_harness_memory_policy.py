from pathlib import Path

import yaml


def test_harness_memory_policy_knobs_present(repo_root: Path):
    path = repo_root / ".github" / "memory" / "policy.yaml"
    policy = yaml.safe_load(path.read_text(encoding="utf-8"))

    assert policy["confidence_threshold"] == 0.65
    assert policy["staleness_ttl_days"] == 30
    assert policy["max_recalled_entries"] == 5
    assert policy["max_retrieved_memory_tokens"] == 8000
