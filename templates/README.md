# Templates

Starter templates for the agent harness pipeline. Copy each to its canonical name
(drop `.template`) and place it where the agent reads it, then fill in `TODO: Add details`.

| Template | Copy to | Used by |
| --- | --- | --- |
| `PROBLEMSTATEMENT.template.md` | `output/PROBLEMSTATEMENT.md` | problem-statement-creation → technical-architect |
| `DESIGN.template.md` | `output/DESIGN.md` | technical-architect → implementation-planner |
| `TechnicalGaps.template.md` | `output/TechnicalGaps.md` | technical-architect |
| `IMPLEMENTATIONPLAN.template.md` | `output/IMPLEMENTATIONPLAN.md` | implementation-planner → coding-agent |
| `feedback-000.template.md` | `gan-harness/feedback/feedback-<NNN>.md` | verification-evaluator → coding-agent |
| `build-report.template.md` | `gan-harness/build-report.md` | verification-evaluator |

See the [pipeline overview](../README.md#ai-agent-harness) for how these fit together.
