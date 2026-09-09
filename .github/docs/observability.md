# Harness — Observability

> Signals for observing the **harness itself** while it runs. Observability for a built project is
> generated into that project's top-level `docs/observability.md`.

## What the harness emits

| Signal | Source | Use |
| --- | --- | --- |
| **Per-call tokens** | VS Code Copilot debug log `debug-logs/<session>/main.jsonl` — `llm_request` events (`inputTokens` / `outputTokens` / `cachedTokens`) | consumption on the VS Code surface (no AIU there) |
| **AIU + tokens** | CLI run logs `gan-harness/runs/<ts>/*.log` (`session.usage_checkpoint.totalNanoAiu`, `outputTokens`, tool calls) | absolute cost of a CLI benchmark run, via `parse-usage.py` |
| **Build quality** | `check-build.py` on the produced `src/`+`tests/` | deterministic 0–10 score + signal breakdown |
| **Efficiency trend** | `gan-harness/efficiency-log.csv` | per-build quality / iterations / memory / tokens over time |
| **Verification + closeout** | `gan-harness/build-report.md`, `feedback/feedback-NNN.md`, `feedback/agents/*.md` | score progression, per-agent retrospectives |

## Reading consumption
- **VS Code (production surface):** tokens auto-read from the debug log by `efficiency-tracker.py`
  (`output + fresh/uncached input`). AIU is **not** exposed on this surface — use tokens + iterations as proxies.
- **CLI:** real AIU via `python benchmarks/scripts/parse-usage.py --log <run.log> --workdir <dir>`.
- Keep one build per fresh chat window so the debug-log tokens map to a single build.

## Guardrails
- Never log secrets or PII into ledgers, reports, or memory records (redaction happens before persistence).
- `gan-harness/runs/` and `*.log` are git-ignored; committed telemetry is limited to reports + the efficiency CSV.
