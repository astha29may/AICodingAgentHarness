---
name: agent-feedback
description: "Run a post-session retrospective: compare an agent's spec vs how it behaved this session, log deviations to its ledger, and propose spec improvements."
---

# /agent-feedback

Use at the end of a session (or to batch-review recent sessions) to drive agent self-improvement.

## What it does
1. Loads the target agent's expected behavior — `.github/agents/<name>.agent.md` plus repo-wide rules
   (`AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/`).
2. Reconstructs actual behavior — the in-context transcript, or the `chronicle` session store
   (`session_store_sql`) for sessions that already ended.
3. Appends a severity-ranked deviation entry to `gan-harness/feedback/agents/<agent>.md`.
4. Proposes a minimal, human-approved edit to the agent's `## Operating learnings` section when a
   deviation traces to a spec gap.
5. In solution-closeout mode, repeats that process for every harness agent that participated in the
   completed build and groups shared learnings once.

## How to invoke
- Inline (same chat as the agent that ran): `/agent-feedback review this session for <agent-name>`
- Standalone: `/agent-feedback <agent-name>` — pulls the session from the store.
- Batch: `/agent-feedback recent` — reviews the last 5 sessions.
- Solution closeout: `/agent-feedback close out this solution` — reviews every participating harness agent from the just-finished build.
- Solution closeout with approved updates: `/agent-feedback close out this solution and apply approved learnings`.

## Notes
- There is no automatic session-end hook in VS Code; invoke this manually or on a schedule.
- Spec edits require explicit approval. The ledger is written every run.
- The recommended place to run the closeout mode is immediately after `verification-evaluator` returns `PASS`.
