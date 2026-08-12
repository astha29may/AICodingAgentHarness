def test_each_build_agent_captures_corrections(build_agents, read_agent_spec):
    for name in build_agents:
        text = read_agent_spec(name)
        lowered = text.lower()
        assert "gan-harness/feedback/ledger.jsonl" in text, (
            f"{name} must capture corrections into the agent-feedback ledger"
        )
        assert ".github/memory/schema.yaml" in text, (
            f"{name} must capture corrections using the committed record shape"
        )
        assert "correction" in lowered, f"{name} must instruct capturing developer corrections"
        assert "scope" in lowered and "repo" in lowered and "user" in lowered, (
            f"{name} must capture at the narrowest repo/user scope"
        )
