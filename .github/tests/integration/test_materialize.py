import importlib.util
from pathlib import Path

import yaml

CONVENTIONS = {
    "conventions": [
        {"id": "mem-2026-0001", "type": "convention",
         "descriptor": "Use named exports, not default exports",
         "privacy": {"redacted": True, "classification": "none"}},
    ]
}
STYLE = {
    "style": [
        {"id": "mem-2026-0002", "type": "preference",
         "descriptor": "Two-space indentation in YAML",
         "privacy": {"redacted": True, "classification": "none"}},
    ]
}
PATTERNS = {
    "patterns": [
        {"id": "mem-2026-0100", "type": "pattern",
         "descriptor": "Parameterize domain behavior via config, not code",
         "privacy": {"redacted": True, "classification": "none"}},
        {"id": "mem-2026-0101", "type": "pattern",
         "descriptor": "leaked-token-should-never-appear",
         "privacy": {"redacted": False, "classification": "sensitive"}},
    ]
}


def _load_sync(repo_root: Path):
    path = repo_root / ".github" / "scripts" / "sync-memory.py"
    spec = importlib.util.spec_from_file_location("sync_memory", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_yaml(path: Path, doc: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(doc), encoding="utf-8")


def _seed_repo(tmp_path: Path) -> Path:
    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "conventions.yaml", CONVENTIONS)
    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "style.yaml", STYLE)
    _write_yaml(tmp_path / ".github" / "memory" / "global.lock",
                {"repo": "x", "path": "memory-global/patterns", "ref": "main", "sha": ""})
    return tmp_path


def _seed_global(tmp_path: Path) -> Path:
    store = tmp_path / "global-store"
    _write_yaml(store / "patterns.yaml", PATTERNS)
    return store


def _read(repo_root: Path, name: str) -> str:
    return (repo_root / ".github" / "instructions" / name).read_text(encoding="utf-8")


def test_materializes_both_files_with_applyto_and_dense_bullets(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    work = _seed_repo(tmp_path)
    store = _seed_global(work)

    notices = sync.materialize(work, str(store))

    assert notices == []
    repo_doc = _read(work, "memory-repo.instructions.md")
    global_doc = _read(work, "memory-global.instructions.md")
    assert 'applyTo: "src/**,tests/**,scripts/**,infra/**"' in repo_doc
    assert 'applyTo: "src/**,tests/**,scripts/**,infra/**"' in global_doc
    assert "**\n" not in global_doc.split("---")[1]  # scope is not the always-on wildcard
    assert "- Use named exports, not default exports" in repo_doc
    assert "- Two-space indentation in YAML" in repo_doc
    assert "- Parameterize domain behavior via config, not code" in global_doc


def test_dense_bullet_uses_descriptor_not_content(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    doc = {"id": "mem-2026-0009", "descriptor": "one-line rule",
           "content": "a very long essay body that must never be materialized",
           "privacy": {"redacted": True}}
    rendered = sync.render_instruction_file(sync.REPO_SCOPE, [doc], sync.DEFAULT_POLICY)
    assert "- one-line rule" in rendered
    assert "essay" not in rendered


def test_idempotent_no_diff_on_rerun(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    work = _seed_repo(tmp_path)
    store = _seed_global(work)

    sync.materialize(work, str(store))
    first = _read(work, "memory-repo.instructions.md"), _read(work, "memory-global.instructions.md")
    sync.materialize(work, str(store))
    second = _read(work, "memory-repo.instructions.md"), _read(work, "memory-global.instructions.md")

    assert first == second


def test_secret_record_is_not_materialized(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    work = _seed_repo(tmp_path)
    store = _seed_global(work)

    sync.materialize(work, str(store))

    global_doc = _read(work, "memory-global.instructions.md")
    assert "leaked-token-should-never-appear" not in global_doc


def test_missing_global_store_degrades_to_repo_only(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    work = _seed_repo(tmp_path)

    notices = sync.materialize(work)  # no global override; lock sha is empty

    assert sync.GLOBAL_UNAVAILABLE_NOTICE in notices
    repo_doc = _read(work, "memory-repo.instructions.md")
    global_doc = _read(work, "memory-global.instructions.md")
    assert "- Use named exports, not default exports" in repo_doc
    assert sync.EMPTY_NOTE in global_doc
