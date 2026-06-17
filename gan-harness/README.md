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

See [templates/feedback-000.template.md](../templates/feedback-000.template.md) for the feedback format
and [templates/build-report.template.md](../templates/build-report.template.md) for the final report format.

Iteration numbers are zero-padded (001, 002, ...).
