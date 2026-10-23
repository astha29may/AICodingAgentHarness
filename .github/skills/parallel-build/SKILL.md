---
name: parallel-build
description: >
  Parallelize implementation across specialist agents (frontend, backend, AI, data) with non-overlapping
  file ownership and explicit interface contracts. Use when a plan has independent workstreams that can
  be built concurrently to finish faster, or when coordinating a multi-agent / multi-worktree build.
---

# Parallel Build Skill

## Purpose
Run multiple specialist generators at once on disjoint slices of `IMPLEMENTATIONPLAN.md`, then converge on one verification pass — faster than sequential coding without stepping on each other.

## When to use
- The plan has tasks in different domains (UI, API, AI, data) with few cross-dependencies.
- You want to cut wall-clock time by building lanes concurrently.

## When not to use
- A single small change, or work where every task touches the same files.
- The plan is not yet approved.

## Lanes
| Lane | Specialist | Typical files |
| --- | --- | --- |
| frontend | `frontend-engineer` | components, client state, styles |
| backend | `backend-engineer` | endpoints, services, auth |
| ai | `ai-engineer` | model calls, prompts, RAG, eval hooks |
| data | `data-engineer` | schemas, pipelines, migrations, indexes |

## Procedure
1. **Decompose** — group plan tasks into lanes that touch disjoint files. Split or sequence any task that spans lanes.
2. **Define contracts** — for every cross-lane dependency, write an interface contract to `gan-harness/contracts/<name>.md` (API shape, schema, event, type, inference signature) before lanes start. Typical dependency order: data → backend/ai → frontend.
3. **Assign ownership** — record one owning lane per file in the plan's task breakdown (each task's target files). Shared files are owned by `parallel-build-orchestrator` for merge.
4. **Isolate** — create a git branch/worktree per lane (`lane/frontend`, `lane/backend`, `lane/ai`, `lane/data`). For true parallelism, run each specialist in its own session/instance.
5. **Build** — each specialist works test-first within its lane against the contracts (mock other lanes) and runs its own local verification.
6. **Fan-in** — `parallel-build-orchestrator` integrates lanes against the contracts, resolves boundary conflicts, and runs the full verification loop once.
7. **Gate** — hand the integrated result to `code-reviewer`, then `verification-evaluator` for rubric scoring.

## Rules
- One owner per file; never edit another lane's files. Coordinate only through contracts.
- Contracts are authoritative — changing one means notifying the orchestrator before others consume it.
- A lane blocked on a missing contract continues its other tasks and reports the blocker.
- Integrate and verify as a whole before review; do not score lanes in isolation.

## Outputs
- `gan-harness/contracts/*.md` — interface contracts.
- Per-lane branches/worktrees, merged by the orchestrator.
- One integrated change ready for `code-reviewer` + `verification-evaluator`.
