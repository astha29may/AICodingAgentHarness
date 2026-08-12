"""Repo fingerprint — a stable solution identity (remote URL or seeded id), NOT a folder path.

Used as ``scope.repo_fingerprint`` in the memory record shape (``.github/memory/schema.yaml``) so memory
travels with the solution across clones/machines. Resolution order: a committed
``.github/memory/repo-id`` wins; else the git ``origin`` (or lexicographically smallest) remote URL,
normalized and seeded into ``repo-id``; else a generated, persisted uuid. The fingerprint is the
sha256 of that identity, stable across repo-root path spellings.
"""
import hashlib
import re
import uuid
from pathlib import Path


def _repo_id_path(root: Path) -> Path:
    return root / ".github" / "memory" / "repo-id"


def _read_committed_id(root: Path):
    path = _repo_id_path(root)
    if path.exists():
        text = path.read_text(encoding="utf-8").strip()
        if text:
            return text
    return None


def _normalize(url: str) -> str:
    url = re.sub(r"^\w+://", "", url.strip())   # strip scheme
    url = re.sub(r"^[^@]+@", "", url)            # strip user@ (scp-style)
    url = url.replace(":", "/", 1)              # scp host:path -> host/path
    return re.sub(r"\.git$", "", url).rstrip("/")


def _remote_urls(root: Path) -> dict:
    config = root / ".git" / "config"
    if not config.exists():
        return {}
    remotes, name = {}, None
    for line in config.read_text(encoding="utf-8").splitlines():
        header = re.match(r'\s*\[remote "([^"]+)"\]', line)
        url = re.match(r"\s*url\s*=\s*(.+)", line)
        if header:
            name = header.group(1)
        elif name and url:
            remotes[name] = _normalize(url.group(1))
            name = None
    return remotes


def _resolve_identity(root: Path) -> str:
    committed = _read_committed_id(root)
    if committed:
        return committed
    remotes = _remote_urls(root)
    identity = (remotes.get("origin") or sorted(remotes.values())[0]) if remotes else uuid.uuid4().hex
    path = _repo_id_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(identity + "\n", encoding="utf-8")
    return identity


def repo_fingerprint(root: str) -> str:
    return hashlib.sha256(_resolve_identity(Path(root)).encode("utf-8")).hexdigest()
