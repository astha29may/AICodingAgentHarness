# Agent feedback ledgers

Per-agent retrospective ledgers written by the [`agent-feedback`](../../../.github/agents/agent-feedback.agent.md) agent.

- One file per harness agent: `<agent-name>.md` (e.g. `coding-agent.md`, `technical-architect.md`).
- Each run appends a dated entry comparing the agent's **expected behavior** (its `.agent.md` spec +
  repo-wide rules) against its **actual behavior** in a session, with severity-ranked deviations and
  evidence (turn / file / session id).
- Recurring deviations that trace to a spec gap become a proposed, human-approved edit to the agent's
  spec under its `## Operating learnings` section.

These ledgers are the audit trail of how each agent is drifting and improving over time. They are
append-only history; do not rewrite past entries.
