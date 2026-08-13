from pathlib import Path

import pytest

BUILD_SCOPES = ("src/**", "tests/**", "scripts/**", "infra/**")


@pytest.fixture(scope="session")
def build_lane_instruction(repo_root: Path) -> str:
    path = repo_root / ".github" / "instructions" / "build-lane.instructions.md"
    assert path.exists(), "shared build-lane.instructions.md must exist"
    return path.read_text(encoding="utf-8")


def test_shared_instruction_captures_corrections(build_lane_instruction):
    text = build_lane_instruction
    lowered = text.lower()
    assert "gan-harness/feedback/ledger.jsonl" in text, (
        "shared build-lane rules must capture corrections into the agent-feedback ledger"
    )
    assert ".github/memory/schema.yaml" in text, (
        "shared build-lane rules must capture corrections using the committed record shape"
    )
    assert "correction" in lowered, "shared build-lane rules must instruct capturing developer corrections"
    assert "scope" in lowered and "repo" in lowered and "user" in lowered, (
        "shared build-lane rules must capture at the narrowest repo/user scope"
    )


def test_shared_instruction_applies_to_build_scope(build_lane_instruction):
    for scope in BUILD_SCOPES:
        assert scope in build_lane_instruction, (
            f"build-lane.instructions.md must auto-apply to {scope} so every build agent honors it"
        )


def test_build_agents_do_not_duplicate_capture_step(build_agents, read_agent_spec):
    for name in build_agents:
        text = read_agent_spec(name)
        assert "gan-harness/feedback/ledger.jsonl" not in text, (
            f"{name} must not duplicate the capture rule; it lives once in build-lane.instructions.md"
        )
