# gan-harness

Working directory for the generator-evaluator loop.

- `feedback/feedback-<NNN>.md` — written each iteration by the `verification-evaluator` agent.
  The `coding-agent` reads the latest feedback file **first** before its next iteration.
- `build-report.md` — written once the implementation reaches the pass threshold (default 7.0/10),
  summarizing score progression across iterations.
- `contracts/<name>.md` — interface contracts (API/schema/event/type) written by the
  `parallel-build-orchestrator` so specialist lanes (frontend/backend/ai/data) can build
  in parallel against fixed boundaries instead of each other.
- `feedback/agents/<agent>.md` — per-agent retrospective ledgers written by the `agent-feedback`
  agent: severity-ranked deviations of expected vs actual behavior per session, with evidence.
  See [feedback/agents/README.md](feedback/agents/README.md).
- After `build-report.md` is written for a passing solution, run `agent-feedback` in solution-closeout
  mode so the just-completed session updates these ledgers for every participating harness agent.

See [templates/feedback-000.template.md](../templates/feedback-000.template.md) for the feedback format
and [templates/build-report.template.md](../templates/build-report.template.md) for the final report format.

Iteration numbers are zero-padded (001, 002, ...).

## Approval gate — `approvals.json`

`approvals.json` is the single source of truth for the two blocking human checkpoints, **design**
and **plan**. The harness must not advance design→plan until `design.approved` is true, nor
plan→build until `plan.approved` is true.

```json
{
  "design": { "approved": true, "at": 1787199557016, "by": "dashboard" },
  "plan":   { "approved": false, "at": null, "by": null }
}
```

Approval is **dual-surface** — it can be granted from either place, and whichever grants it unblocks
the next stage:

- **Dashboard** (`ui/`): the Deliverables tab shows the checkpoint and an **Approve** button
  (`POST /api/approve` writes this file with `by: "dashboard"`).
- **Agent chat**: `python .github/scripts/set-approval.py --stage <design|plan> --approve`
  (writes `by: "chat"`). Check the gate with `--check` (exit 0 = approved), revoke with `--revoke`.

The dashboard watches this file, so a chat approval appears in the UI immediately, and a UI approval
is visible to the orchestrator via `--check`. This file is harness runtime state (git-ignored is fine).

## Agent run signal — `agent-activity.jsonl`

`agent-activity.jsonl` is the layout-agnostic record of which agents are running. The orchestrator
brackets each dispatch with a start/end marker, so the dashboard shows run state no matter where an
agent's produced code lives (important for cross-cutting agents like `observability-engineer`, whose
output can land in any path). Each line:

```json
{ "agent": "observability-engineer", "event": "start", "at": 1787214117193 }
{ "agent": "observability-engineer", "event": "end",   "at": 1787214210042 }
```

Write and query it with the helper:

```
python .github/scripts/agent-activity.py --agent <name> --event start
python .github/scripts/agent-activity.py --agent <name> --event end
python .github/scripts/agent-activity.py --list          # agents currently running
```

An agent is shown **working** while its last event is `start`, **done** after `end`. The dashboard
still falls back to file activity when no signal is present. This file is harness runtime state.


