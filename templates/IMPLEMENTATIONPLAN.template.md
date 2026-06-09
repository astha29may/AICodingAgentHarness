# Implementation Plan — <System Name>

> **Kickstart template** produced by the `implementation-planner` agent from `DESIGN.md`
> (input to `coding-agent` and `verification-evaluator`). Replace each `TODO: Add details`.
> Plan before code. Every task must name the test that proves it.

## 1. Scope
TODO: Add details — what this plan covers and explicitly excludes.

## 2. Assumptions & Open Questions
- TODO: Add details (traceable to `TechnicalGaps.md`; do not invent answers).

## 3. Milestones
1. TODO: Add details — ordered, each independently shippable and verifiable.

## 4. Task Breakdown
| Task ID | Title | Lane | Depends on | Target files | Proving test(s) | Definition of done |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | TODO | frontend\|backend\|ai\|data\|shared | — | TODO | TODO | TODO |

## 5. Test Strategy
- Unit: TODO: Add details
- Integration: TODO: Add details
- E2E: TODO: Add details
- Local vs cloud: TODO: Add details
- Coverage target: TODO: Add details

## 6. File-Level Change Map
| Path | Action | Owning lane | Purpose |
| --- | --- | --- | --- |
| TODO | create\|modify | frontend\|backend\|ai\|data\|shared | TODO |

> Each file has exactly one owning lane. `shared` files are merged by the parallel-build-orchestrator.

## 7. Workstream Parallelization
> Drives the `parallel-build-orchestrator`. Group tasks into lanes that touch disjoint files,
> and define the cross-lane interface contracts. Typical dependency order: data → backend/ai → frontend.

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

## 9. Risks & Rollbacks
- TODO: Add details — failure modes and back-out steps.
