# Harness — Local Setup

> How to run the **harness itself** on a workstation. Setup for a project the harness *builds* is
> generated into that project's top-level `docs/local-setup.md`.

## Prerequisites
- **Windows + PowerShell 5.1** (the scripts target it; `run-benchmarks.ps1` starts with `#Requires -Version 5.1`).
- **Python** (Anaconda). This repo uses `& "$env:LOCALAPPDATA\anaconda3\python.exe"`.
- **VS Code + GitHub Copilot** (chat / agent mode) — the primary surface the harness runs on.
- **GitHub Copilot CLI** (optional) — only for the scriptable benchmark (`run-benchmarks.ps1`).
- **Node.js** (optional) — only needed to score/execute JavaScript builds.

## First run
```powershell
# from the repo root
& "$env:LOCALAPPDATA\anaconda3\python.exe" -m pip install -r requirements.txt   # PyYAML + pytest
& "$env:LOCALAPPDATA\anaconda3\python.exe" -m pytest .github/tests -q            # harness self-tests
```

## Run the harness (VS Code chat — the normal path)
Open a fresh Agent-mode chat and give it the project, e.g.:
> Build me `<project description>` with the harness.

The orchestration (delegation, DESIGN/PLAN approval checkpoints, PASS closeout) is driven by
[AGENTS.md](../../AGENTS.md) — you don't restate it. Deliverables land in `output/`, code in `src/`,
tests in `tests/`, project docs in top-level `docs/`.

## Run the scriptable benchmark (CLI — optional)
```powershell
.\.github\scripts\run-benchmarks.ps1 -Pipeline -Continuous            # harness in an isolated temp workspace
.\.github\scripts\run-benchmarks.ps1 -Pipeline -Continuous -InRepo    # build into this repo (real memory)
```
Report → `gan-harness/pipeline-report.md`; logs → `gan-harness/runs/<ts>/` (git-ignored).

## Memory maintenance
```powershell
& "$env:LOCALAPPDATA\anaconda3\python.exe" .github\scripts\sync-memory.py           # materialize the store
& "$env:LOCALAPPDATA\anaconda3\python.exe" .github\scripts\sync-memory.py --check   # FRESH / STALE guard
```
