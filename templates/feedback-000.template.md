# Evaluator Feedback — Iteration <NNN>

> **Kickstart template** written by the `verification-evaluator` agent each iteration.
> Copy to `feedback/feedback-001.md`, `feedback-002.md`, etc. The `coding-agent` reads the
> latest file first and must address every blocker and prioritized fix.

## Verification Gate
| Check | Result | Notes |
| --- | --- | --- |
| Build | PASS \| FAIL | TODO |
| Test | PASS \| FAIL | TODO |
| Lint | PASS \| FAIL | TODO |
| Typecheck | PASS \| FAIL | TODO |
| Test-integrity | PASS \| FAIL | TODO: no tests weakened/removed vs previous iteration |

## Score Table
| Criterion | Raw (0–10) | Weight | Weighted |
| --- | --- | --- | --- |
| Correctness | 0 | 0.40 | 0.00 |
| Security | 0 | 0.20 | 0.00 |
| Tests | 0 | 0.20 | 0.00 |
| Observability | 0 | 0.10 | 0.00 |
| Documentation | 0 | 0.10 | 0.00 |
| **Total** | | **1.00** | **0.00** |

## Verdict
`ITERATE` | `PASS` (PASS requires total ≥ 7.0 and no blocker)

## Score Progression
| Iteration | Weighted total | Verdict |
| --- | --- | --- |
| <NNN> | 0.00 | ITERATE \| PASS |

> Regression note: if this total is below the previous iteration's, name the regressed criterion here and prioritize restoring it. Budget: stop at `MAX_ITERATIONS` (default 5) and surface to the human.

## Blockers (cap the score)
- TODO: build/test failures, security holes, missing required tests.

## Prioritized Fixes (next iteration)
1. TODO — file reference; which criterion this raises.

## What's Working (do not regress)
- TODO.
