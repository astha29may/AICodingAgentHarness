---
applyTo: "src/**,tests/**,scripts/**,infra/**"
---

# Build-lane shared rules

Common rules for every build agent — `coding-agent`, `frontend-engineer`, `backend-engineer`,
`ai-engineer`, `data-engineer` (and any agent that writes code under these paths). Lane-specific
read order, scope, TDD loop, rules, and handoff stay in each agent's own spec.

## Coding standards (mandatory)
Strictly follow [`coding-style.instructions.md`](coding-style.instructions.md) for every file you write or modify. If a request conflicts with those standards, follow the standards and flag the conflict.

**Bug fixes:** first analyze the existing code and find the root cause, then fix it *within* the current logic — do not add a new code path, wrapper, or patch that masks the symptom and opens another issue (see the coding standards' Bug-Fixing Discipline).

## Output contract
Follow [`output-contract.instructions.md`](output-contract.instructions.md).

## Capturing corrections & self-improvements
When the user corrects your output or style — OR you identify an improvement for yourself while building (a missing coding principle, a better pattern, a harness gap) even if the user raised nothing — capture it as a `preference`/`correction`/`pattern` record at the narrowest scope (repo, else user), noting the **suspected root-cause stage** (design / plan / code / self) so the closeout can route it to the right agent, through the harness self-learning loop — append it to the agent-feedback ledger `gan-harness/feedback/ledger.jsonl` using the record shape in `.github/memory/schema.yaml` — never bespoke code. If nothing new emerged, capture nothing.
