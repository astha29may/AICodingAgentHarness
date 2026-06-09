---
name: implementation-planning
description: >
  Convert an approved DESIGN.md into a sequenced, test-ready IMPLEMENTATIONPLAN.md before coding.
  Use when asked to plan a build, break a design into tasks, sequence work, define a test strategy,
  or create an acceptance rubric for the coding and verification agents.
---

# Implementation Planning Skill

## Purpose
Turn an approved architecture into a concrete, dependency-ordered build plan that the coding-agent and verification-evaluator can execute and score. Plan before code.

## When to use
- A `DESIGN.md` is approved and work needs to be broken into tasks.
- You need a test strategy, file-level change map, or acceptance rubric.
- A feature slice needs sequencing before implementation.

## When not to use
- Architecture is not yet decided — use the technical-architect agent first.
- The change is a one-line trivial fix.

## Inputs (read in order)
1. `output/PROBLEMSTATEMENT.md`
2. `output/DESIGN.md`
3. `output/TechnicalGaps.md`
4. `docs/` (testing, deployment, local-setup)
5. Existing `src/`, `tests/`, `infra/`

## Output: `output/IMPLEMENTATIONPLAN.md`
Use these exact sections:
1. **Scope** — what's covered and explicitly excluded.
2. **Assumptions & open questions** — traceable to `TechnicalGaps.md`; never invent answers.
3. **Milestones** — ordered, each independently shippable and verifiable.
4. **Task breakdown** — per task: `id`, title, dependencies, target files, the test that proves it, definition of done.
5. **Test strategy** — unit/integration/e2e split, local vs cloud, coverage target.
6. **File-level change map** — table: `path` → `create|modify` → purpose.
7. **Acceptance rubric** — weighted criteria (correctness, security, tests, observability, docs); weights sum to 1.0.
8. **Risks & rollbacks** — failure modes and back-out steps.

## Rules
- Smallest plan that satisfies the design. No features the design does not require.
- Every task names the test that proves it (TDD-ready).
- Tasks small enough to complete and verify in one coding pass.
- Map to the repo's real structure.
- **Observability is non-negotiable.** Always include an observability task even when the design omits it
  (structured logging + correlation IDs, RED/pipeline metrics, health checks, alert per failure mode);
  keep its rubric weight non-zero.
- If a gap blocks planning, write `TODO: Add details` and flag one clarifying question — do not guess.

## Handoff
- `coding-agent` implements tasks; `verification-evaluator` scores against the acceptance rubric.
- Pause for human approval of the plan before coding starts.
