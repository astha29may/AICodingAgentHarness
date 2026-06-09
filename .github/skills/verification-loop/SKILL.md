---
name: verification-loop
description: >
  Run the standard verification gate — build, test, lint, typecheck — and score an implementation
  against the acceptance rubric in IMPLEMENTATIONPLAN.md. Use to verify changes before handoff,
  gate quality, or run the generator-evaluator scoring iteration.
---

# Verification Loop Skill

## Purpose
Provide a deterministic, repeatable quality gate and the scoring step of the generator-evaluator harness.

## When to use
- After a coding pass, before handing off.
- To score an iteration against the acceptance rubric.
- As a CI-equivalent gate locally.

## The verification gate (run in order)
1. **Build** — the project compiles/builds with no errors.
2. **Test** — the full suite passes (use commands from `docs/testing.md`).
3. **Lint** — no lint errors introduced.
4. **Typecheck** — no type errors introduced.

Any failure stops the gate and is reported with the exact error.

## Rubric scoring (generator-evaluator step)
1. Read the weighted acceptance rubric from `output/IMPLEMENTATIONPLAN.md`.
2. Score each criterion 0–10 based on verifiable behavior, not claims.
3. Weighted total = Σ (criterion score × weight).
4. Compare to the pass threshold (default 7.0/10).

## Feedback output
Write `gan-harness/feedback/feedback-<NNN>.md` with:
- Score table (criterion, raw, weight, weighted, total).
- Verdict: `PASS` (total ≥ threshold and no blocker) or `ITERATE`.
- Blockers (cap the score): build/test failures, security holes, missing required tests.
- Prioritized, file-referenced fixes for the next iteration.
- What's working (avoid regressions).

On `PASS`, write `gan-harness/build-report.md` with score progression and stop.

## Rules
- A failing build/test or a security blocker forces `ITERATE` regardless of total.
- Do not inflate scores to exit the loop; report plateaus as a ceiling.
- Read-mostly: create feedback/report files and run checks only; do not implement features or deploy.
