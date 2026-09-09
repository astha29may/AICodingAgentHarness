def test_each_build_agent_reads_committed_memory(build_agents, read_agent_spec):
    for name in build_agents:
        text = read_agent_spec(name)
        assert ".github/memory/repo/style.yaml" in text, f"{name} must read the committed style memory"
        assert ".github/instructions/memory-repo.instructions.md" in text, (
            f"{name} must read the materialized repo memory"
        )
        assert ".github/instructions/memory-global.instructions.md" in text, (
            f"{name} must read the materialized global memory"
        )
