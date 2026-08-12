from pathlib import Path

import yaml


def test_global_lock_names_shared_store_ref(repo_root: Path):
    lock = repo_root / ".github" / "memory" / "global.lock"
    doc = yaml.safe_load(lock.read_text(encoding="utf-8"))

    assert doc["repo"], "global.lock must name the shared global memory repo"
    assert doc["path"], "global.lock must name the store path within the shared repo"
    assert doc["ref"], "global.lock must name a git ref"
    assert "sha" in doc  # may be an empty-string placeholder pending the first pin
