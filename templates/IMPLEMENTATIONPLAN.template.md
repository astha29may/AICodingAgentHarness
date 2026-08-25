# Implementation Plan — <System Name>

> **Kickstart template** produced by the `implementation-planner` agent from `DESIGN.md`
> (input to `coding-agent` and `verification-evaluator`). Replace each `TODO: Add details`.
> Plan before code. Every task names the test that proves it and the user story it serves.
> **Scope, product/architecture risks, and design rationale live in `DESIGN.md` — this plan
> references them, it does not restate them.**

## 1. Build Slice
TODO: Add details — one or two lines naming which part of `DESIGN.md` this plan implements
(the whole design, or a named slice). Reference `DESIGN.md` scope; do not re-scope here.

## 2. Assumptions & Open Questions
- TODO: Add details (traceable to `TechnicalGaps.md`; do not invent answers).

## 3. Milestones
1. TODO: Add details — ordered `M0, M1, …`, each independently shippable and verifiable.

## 4. User Stories
> The user-visible value each milestone delivers. Every task in §5 traces to a story.

| Story ID | As a … | I want … | So that … | Acceptance |
| --- | --- | --- | --- | --- |
| US-1 | TODO | TODO | TODO | TODO — observable acceptance signal |

## 5. Task Breakdown
> Dependency-ordered. **Each file path appears under exactly one task/lane — no cross-lane
> overlap.** This per-task ownership is the file-ownership guarantee the
> `parallel-build-orchestrator` relies on (no separate change-map table needed).

| Task ID | Story | Milestone | Title | Lane | Est. | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | US-1 | M0 | TODO | frontend\|backend\|ai\|data\|shared | S\|M\|L | — | TODO | TODO | TODO |

## 6. Test Strategy
- Unit: TODO: Add details
- Integration: TODO: Add details
- E2E: TODO: Add details
- Local vs cloud: TODO: Add details
- Coverage target: TODO: Add details

## 7. Workstream Parallelization
> Drives the `parallel-build-orchestrator`. Group tasks into lanes that touch disjoint files,
> and define the cross-lane interface contracts. Typical dependency order: data → backend/ai → frontend.
> Omit this section only when the build is single-lane.

| Lane | Specialist agent | Tasks | Depends on contracts |
| --- | --- | --- | --- |
| data | data-engineer | TODO | — |
| backend | backend-engineer | TODO | data schema |
| ai | ai-engineer | TODO | data index |
| frontend | frontend-engineer | TODO | backend API |

**Interface contracts** (written to `gan-harness/contracts/`):
| Contract | Producer lane | Consumer lane(s) | Shape |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |

## 8. Acceptance Rubric
> Weights must sum to 1.0. The `verification-evaluator` scores each criterion 0–10.

| Criterion | Weight | What "good" looks like |
| --- | --- | --- |
| Correctness | 0.40 | TODO |
| Security | 0.20 | TODO |
| Tests | 0.20 | TODO |
| Observability | 0.10 | TODO |
| Documentation | 0.10 | TODO |

**Pass threshold:** 7.0 / 10 (weighted total).
