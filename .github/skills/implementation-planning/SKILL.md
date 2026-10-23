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
- You need a test strategy, per-task file ownership, or acceptance rubric.
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
1. **Build slice** — which part of `DESIGN.md` this plan implements (whole design, or a named slice). Reference DESIGN scope; do not re-scope. Scope, product/architecture risks, and design rationale stay in `DESIGN.md`.
2. **Assumptions & open questions** — traceable to `TechnicalGaps.md`; never invent answers.
3. **Milestones** — ordered `M0, M1, …`, each independently shippable and verifiable.
4. **User stories** — `US-N` (as a … / I want … / so that … / acceptance): the user-visible value each milestone delivers.
5. **Task breakdown** — per task: `id`, story (US-N), milestone, title, lane, effort estimate (S|M|L), dependencies, target files, the test that proves it, definition of done. Each file path appears under exactly one task/lane (no cross-lane overlap) — this is the file-ownership guarantee; no separate change-map table.
6. **Test strategy** — unit/integration/e2e split, local vs cloud, coverage target.
7. **Workstream parallelization** — lanes that touch disjoint files + cross-lane interface contracts; drives the parallel-build-orchestrator. Omit only when single-lane.
8. **Acceptance rubric** — weighted criteria (correctness, security, tests, observability, docs); weights sum to 1.0.

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
