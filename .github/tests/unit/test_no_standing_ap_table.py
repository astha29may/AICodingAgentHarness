from pathlib import Path

_AP_ID_ROWS = [
    "AP-DRY-01", "AP-DRY-02", "AP-EXC-01", "AP-EXC-02", "AP-EXC-03",
    "AP-CC-01", "AP-LEN-01", "AP-TOK-01", "AP-NAME-01", "AP-LOC-01",
]


def test_skill_still_carries_ap_ids(repo_root: Path):
    skill = (repo_root / ".github" / "skills" / "anti-patterns" / "SKILL.md").read_text(encoding="utf-8")
    for ap_id in _AP_ID_ROWS:
        assert ap_id in skill, f"anti-patterns skill missing id: {ap_id}"
