from pathlib import Path

import yaml


def test_schema_loads_and_exposes_required_shape(repo_root: Path):
    schema_path = repo_root / ".github" / "memory" / "schema.yaml"
    doc = yaml.safe_load(schema_path.read_text(encoding="utf-8"))

    assert isinstance(doc, dict)

    required_top = {
        "id", "type", "scope", "descriptor", "content",
        "evidence", "confidence", "version", "supersedes",
        "lifecycle", "privacy",
    }
    assert required_top <= set(doc)

    assert {"level", "repo_fingerprint", "path_glob", "user_id"} <= set(doc["scope"])
    assert {"state", "occurrences", "sources", "ab_replay"} <= set(doc["evidence"])
    assert {"created", "ttl_days", "status"} <= set(doc["lifecycle"])
    assert {"redacted", "classification"} <= set(doc["privacy"])
