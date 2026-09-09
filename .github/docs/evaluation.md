# Harness — Evaluation

> How the harness **scores builds** and tracks its own improvement. Evaluation docs for a built project
> are generated into that project's top-level `docs/evaluation.md`.

## Deterministic build score
[benchmarks/scripts/check-build.py](../../benchmarks/scripts/check-build.py) scores a produced build
**0–10** from dependency-free signals plus best-effort test execution:

| Signal | Weight | Notes |
| --- | --- | --- |
| src present + tests present | 1.5 + 1.5 | structure a production MVE needs |
| syntax/compile clean | 2.0 | `ast.parse` (py) / `node --check` (js) |
| tests execute **and pass** | 2.0 | pytest / `node --test`; only *verified* tests earn credit (present-but-unrun ≈ 0.4) |
| modularity | 1.5 | **src-only** median LOC/file (full ≤ 40, 0 by 150) |
| duplication | 1.5 | **src-only** normalized-line ratio (test boilerplate excluded) |

Emits one JSON line: `{"score": <0-10>, "signals": {...}}`.

## Rubric-based verification
`verification-evaluator` scores each iteration against the weighted rubric in the project's
`output/IMPLEMENTATIONPLAN.md`, returning `ITERATE` (with feedback) or `PASS`. On `PASS` it writes
`gan-harness/build-report.md` and triggers the `agent-feedback` closeout.

## Efficiency trend (is the harness improving?)
[benchmarks/scripts/efficiency-tracker.py](../../benchmarks/scripts/efficiency-tracker.py) appends a
row per build to `gan-harness/efficiency-log.csv`: quality, iterations-to-PASS, memory count, and
**tokens** (auto-read from the VS Code debug log). Judge by trend — `tok_per_q` and iterations should
fall as promoted memory grows. It runs automatically at the PASS closeout.

```powershell
& "$env:LOCALAPPDATA\anaconda3\python.exe" benchmarks\scripts\efficiency-tracker.py --surface vscode --iterations <n> --build .
```

## Benchmark tasks
[benchmarks/tasks/](../../benchmarks/tasks/) holds fixed scenarios (BM-01…BM-09) used to measure the
harness across stages; `run-benchmarks.ps1` drives them and `parse-usage.py` reads AIU from CLI logs.
