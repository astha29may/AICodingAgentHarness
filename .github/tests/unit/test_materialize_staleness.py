import importlib.util
import subprocess
import sys
from pathlib import Path

import yaml


def _load_sync(repo_root: Path):
    path = repo_root / ".github" / "scripts" / "sync-memory.py"
    spec = importlib.util.spec_from_file_location("sync_memory", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _write_yaml(path: Path, doc: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(doc), encoding="utf-8")


def _seed_repo(tmp_path: Path):
    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "conventions.yaml",
                {"conventions": [{"id": "mem-2026-0001", "descriptor": "Rule A",
                                  "privacy": {"redacted": True}}]})
    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "style.yaml", {"style": []})
    _write_yaml(tmp_path / ".github" / "memory" / "global.lock",
                {"repo": "x", "path": "memory-global/patterns", "ref": "main", "sha": ""})


def test_check_reports_fresh_after_materialize(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    _seed_repo(tmp_path)

    sync.materialize(tmp_path)

    assert sync.is_stale(tmp_path) is False


def test_check_reports_stale_after_source_mutation(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    _seed_repo(tmp_path)
    sync.materialize(tmp_path)

    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "conventions.yaml",
                {"conventions": [{"id": "mem-2026-0001", "descriptor": "Rule A CHANGED",
                                  "privacy": {"redacted": True}}]})

    assert sync.is_stale(tmp_path) is True


def test_check_flag_exit_codes(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    _seed_repo(tmp_path)
    sync.materialize(tmp_path)
    checker = repo_root / ".github" / "scripts" / "sync-memory.py"

    fresh = subprocess.run([sys.executable, str(checker), "--repo-root", str(tmp_path), "--check"],
                           capture_output=True, text=True)
    assert fresh.returncode == 0 and "FRESH" in fresh.stdout

    _write_yaml(tmp_path / ".github" / "memory" / "repo" / "style.yaml",
                {"style": [{"id": "mem-2026-0002", "descriptor": "New rule",
                            "privacy": {"redacted": True}}]})
    stale = subprocess.run([sys.executable, str(checker), "--repo-root", str(tmp_path), "--check"],
                           capture_output=True, text=True)
    assert stale.returncode == 1 and "STALE" in stale.stdout
