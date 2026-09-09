import json
from pathlib import Path

REGENERABLE = ["node_modules", "__pycache__", ".venv", "dist", "target", "gan-harness/runs", "*.log"]
PROTECTED_DIRS = {"output", "src", "tests", "infra", ".github/docs", "gan-harness/feedback", ".github"}


def _dir_of(pattern: str) -> str:
    p = pattern.strip().strip("/")
    for suffix in ("/**", "/*"):
        if p.endswith(suffix):
            p = p[: -len(suffix)]
    return p.strip("/")


def _gitignore_entries(repo_root: Path) -> list:
    text = (repo_root / ".gitignore").read_text(encoding="utf-8")
    return [ln.strip().lstrip("!") for ln in text.splitlines() if ln.strip() and not ln.strip().startswith("#")]


def _settings_exclusion_keys(repo_root: Path) -> list:
    settings = json.loads((repo_root / ".vscode" / "settings.json").read_text(encoding="utf-8"))
    keys = list(settings.get("search.exclude", {}).keys())
    keys += list(settings.get("files.watcherExclude", {}).keys())
    return keys


def _assert_all_present(patterns: list, haystack: str, where: str):
    for pattern in REGENERABLE:
        assert pattern in haystack, f"{pattern} must be excluded from {where}"


def test_gitignore_excludes_regenerable_bulk(repo_root: Path):
    _assert_all_present(REGENERABLE, " ".join(_gitignore_entries(repo_root)), "git")


def test_settings_excludes_regenerable_bulk(repo_root: Path):
    _assert_all_present(REGENERABLE, " ".join(_settings_exclusion_keys(repo_root)), "search/watch index")


def test_protected_dirs_never_excluded(repo_root: Path):
    entries = _gitignore_entries(repo_root) + _settings_exclusion_keys(repo_root)
    for entry in entries:
        assert _dir_of(entry) not in PROTECTED_DIRS, f"protected dir excluded via '{entry}'"
