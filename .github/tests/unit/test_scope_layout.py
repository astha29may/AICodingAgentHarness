from pathlib import Path

import yaml


def test_committed_scope_layout_exists_and_parses(repo_root: Path):
    mem = repo_root / ".github" / "memory"
    for rel in ("repo/conventions.yaml", "repo/style.yaml", "global.lock"):
        path = mem / rel
        assert path.exists(), f"missing scope-layout file: {rel}"
        yaml.safe_load(path.read_text(encoding="utf-8"))

    assert (repo_root / "gan-harness" / "runs" / ".gitkeep").exists()
