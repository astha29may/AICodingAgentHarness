import re


def test_references_output_design(read_agent_spec):
    assert "output/DESIGN.md" in read_agent_spec("coding-agent")


def test_no_bare_design_reference(read_agent_spec):
    text = read_agent_spec("coding-agent")
    for match in re.finditer(r"DESIGN\.md", text):
        prefix = text[max(0, match.start() - len("output/")):match.start()]
        assert prefix == "output/", "every DESIGN.md reference must be prefixed with output/"
