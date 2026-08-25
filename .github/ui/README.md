# Harness Control Room (`ui/`)

A real-time React dashboard for the AI Coding Agent Harness. It shows which agents are
working, how much they've utilized (tokens/iterations), which tasks are done, and the
current problem statement, design, tasks, and open technical gaps — updating live as the
harness writes files.

## What it shows

- **Agent activity board** — each harness agent in `.github/agents/`, its live status
  (`working` / `done` / `idle`) and token/iteration utilization.
- **Deliverables viewer** — rendered `output/PROBLEMSTATEMENT.md`, `output/DESIGN.md`,
  `output/TechnicalGaps.md`, `output/IMPLEMENTATIONPLAN.md`, and the build report, with a
  completeness indicator (`missing` / `stub` / `complete`) and open-gap count.
- **Task & benchmark board** — the `benchmarks/tasks/*.yaml` catalog grouped by status,
  scored from `benchmarks/baseline/metrics.json` when present.
- **Efficiency & utilization charts** — token usage over time, tokens by agent, quality
  vs. tokens-per-quality, and evaluator score per iteration.
- **Feedback & activity timeline** — live file-change feed, the `feedback/ledger.jsonl`
  entries, and evaluator iteration scores.

## How "real time" works

A small Node/Express backend (`server/`) reads the harness's file-based state and watches
the relevant paths with `chokidar`. When a file changes, it rebuilds the snapshot and pushes
it to the browser over **Server-Sent Events** (`/api/stream`). The React app re-renders on
each push. The backend only ever **reads** the repository — it never writes to it.

An agent is marked **working** when a file it owns changes within a 45s window, **done**
when its primary deliverable exists with real (non-template) content, otherwise **idle**.

## Run it

```powershell
cd .github/ui
npm install
npm run dev
```

- Web app: http://localhost:5174
- API/SSE: http://localhost:3001 (proxied under `/api` by Vite in dev)

By default the backend watches the repository root three levels up from `.github/ui/server`. Override
with an env var if needed:

```powershell
$env:HARNESS_ROOT = "C:\path\to\AICodingAgentHarness"; npm run dev
```

## Production build

```powershell
npm run build   # type-checks and bundles to ui/dist
npm start       # serves the API + the built app on http://localhost:3001
```

## Endpoints

| Endpoint      | Purpose                                   |
| ------------- | ----------------------------------------- |
| `GET /api/state`  | One-shot JSON snapshot of harness state |
| `GET /api/stream` | SSE stream of live state updates        |
| `GET /api/health` | Liveness + resolved repo root           |

## Data sources (all read-only)

| Panel         | Source                                                        |
| ------------- | ------------------------------------------------------------ |
| Agents        | `.github/agents/*.agent.md` (frontmatter) + activity window   |
| Deliverables  | `output/*.md`, `gan-harness/build-report.md`                  |
| Tasks         | `benchmarks/tasks/*.yaml`, `benchmarks/baseline/metrics.json` |
| Efficiency    | `gan-harness/efficiency-log.csv`                              |
| Feedback      | `gan-harness/feedback/ledger.jsonl`, `feedback/feedback-*.md` |

If a source is empty (fresh harness), the corresponding panel shows an empty state and fills
in as the harness produces artifacts.
