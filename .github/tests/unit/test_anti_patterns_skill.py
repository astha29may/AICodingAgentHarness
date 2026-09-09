from pathlib import Path

import pytest

_AP_IDS = [
    "AP-DRY-01",
    "AP-DRY-02",
    "AP-EXC-01",
    "AP-EXC-02",
    "AP-EXC-03",
    "AP-CC-01",
    "AP-LEN-01",
    "AP-TOK-01",
    "AP-NAME-01",
    "AP-LOC-01",
]


def _skill_text(repo_root: Path) -> str:
    path = repo_root / ".github" / "skills" / "anti-patterns" / "SKILL.md"
    return path.read_text(encoding="utf-8")


def test_skill_exists(repo_root: Path):
    path = repo_root / ".github" / "skills" / "anti-patterns" / "SKILL.md"
    assert path.is_file()


def test_has_name_and_description_frontmatter(repo_root: Path):
    text = _skill_text(repo_root)
    assert text.startswith("---")

    _, frontmatter, _ = text.split("---", 2)
    assert "name: anti-patterns" in frontmatter
    assert "description:" in frontmatter


def test_description_mentions_code_quality_trigger(repo_root: Path):
    _, frontmatter, _ = _skill_text(repo_root).split("---", 2)
    lower = frontmatter.lower()
    assert "anti-pattern" in lower
    assert "code-quality" in lower or "code quality" in lower


@pytest.mark.parametrize("ap_id", _AP_IDS)
def test_contains_every_anti_pattern_id(repo_root: Path, ap_id: str):
    assert ap_id in _skill_text(repo_root)
