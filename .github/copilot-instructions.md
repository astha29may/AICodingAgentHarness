# GitHub Copilot Repo Instructions
Use AGENTS.md as the primary operating manual for this repository.

@../AGENTS.md

Global constraints, the harness execution policy, and the file-placement rules all live in
[`AGENTS.md`](../AGENTS.md) — follow them there; they are not repeated here. The full documentation
standard is owned by the **Documentation Governance Agent** in [`AGENTS.md`](../AGENTS.md) and the
on-demand `.github/skills/documentation-governance/SKILL.md` skill; load the skill when doing
documentation work instead of carrying the standard in every turn.

Pre-final-response enforcement:
- Before sending a final response, run a documentation-governance checklist pass against the requested scope.
- Verify docs are complete, grounded in repository evidence, and aligned with code/config/test/infra changes.
- If required documentation sections or facts are missing, add `TODO: Add details` rather than guessing.


