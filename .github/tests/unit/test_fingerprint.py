import hashlib
import os
from pathlib import Path

from memory.fingerprint import repo_fingerprint


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _write_git_config(root: Path, remotes: dict[str, str]) -> None:
    lines: list[str] = []
    for name, url in remotes.items():
        lines.append(f'[remote "{name}"]')
        lines.append(f"\turl = {url}")
    (root / ".git").mkdir(parents=True, exist_ok=True)
    (root / ".git" / "config").write_text("\n".join(lines) + "\n", encoding="utf-8")


def test_committed_repo_id_wins(tmp_path: Path):
    mem = tmp_path / ".github" / "memory"
    mem.mkdir(parents=True)
    (mem / "repo-id").write_text("  solution-xyz\n", encoding="utf-8")
    _write_git_config(tmp_path, {"origin": "https://github.com/o/r.git"})

    assert repo_fingerprint(str(tmp_path)) == _sha("solution-xyz")


def test_multi_remote_prefers_origin_and_seeds_repo_id(tmp_path: Path):
    _write_git_config(tmp_path, {
        "alpha": "https://github.com/o/alpha.git",
        "origin": "https://github.com/o/origin.git",
    })

    assert repo_fingerprint(str(tmp_path)) == _sha("github.com/o/origin")
    seeded = (tmp_path / ".github" / "memory" / "repo-id").read_text(encoding="utf-8").strip()
    assert seeded == "github.com/o/origin"


def test_no_origin_falls_back_to_lexicographically_smallest(tmp_path: Path):
    _write_git_config(tmp_path, {
        "zulu": "https://github.com/o/zzz.git",
        "alpha": "https://github.com/o/aaa.git",
    })

    assert repo_fingerprint(str(tmp_path)) == _sha("github.com/o/aaa")


def test_no_remote_generates_and_persists_stable_uuid(tmp_path: Path):
    first = repo_fingerprint(str(tmp_path))
    assert (tmp_path / ".github" / "memory" / "repo-id").exists()
    second = repo_fingerprint(str(tmp_path))
    assert first == second


def test_stable_across_repo_root_spellings(tmp_path: Path):
    _write_git_config(tmp_path, {"origin": "https://github.com/o/r.git"})

    a = repo_fingerprint(str(tmp_path))
    b = repo_fingerprint(str(tmp_path) + os.sep)
    assert a == b == _sha("github.com/o/r")
