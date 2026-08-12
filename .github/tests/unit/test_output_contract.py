from pathlib import Path

CANONICAL = ".github/instructions/output-contract.instructions.md"
REFERENCE = "output-contract.instructions.md"
CONTRACT_PROSE = "output ONLY the code or unified diff/patch"


def test_canonical_contract_exists(repo_root: Path):
    assert (repo_root / CANONICAL).is_file(), "the one canonical output contract must exist"


def test_each_build_agent_references_contract(build_agents, read_agent_spec):
    for name in build_agents:
        assert REFERENCE in read_agent_spec(name), f"{name} must reference the shared output contract"


def test_contract_prose_is_not_duplicated(repo_root: Path):
    hits = []
    for p in (repo_root / ".github").rglob("*.md"):
        try:
            text = p.read_text(encoding="utf-8")
        except OSError:
            continue
        if CONTRACT_PROSE in text:
            hits.append(p)
    assert len(hits) == 1, f"contract prose must live in exactly one file, found: {hits}"
    assert hits[0] == repo_root / CANONICAL, "the single copy must be the canonical contract file"
