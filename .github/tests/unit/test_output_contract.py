from pathlib import Path

CANONICAL = ".github/instructions/output-contract.instructions.md"
REFERENCE = "output-contract.instructions.md"
CONTRACT_PROSE = "output ONLY the code or unified diff/patch"


def test_canonical_contract_exists(repo_root: Path):
    assert (repo_root / CANONICAL).is_file(), "the one canonical output contract must exist"


def test_shared_build_lane_references_contract(repo_root: Path):
    shared = repo_root / ".github" / "instructions" / "build-lane.instructions.md"
    assert shared.is_file(), "shared build-lane instruction must exist"
    text = shared.read_text(encoding="utf-8")
    assert REFERENCE in text, "the shared build-lane instruction must reference the output contract for every build agent"


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
