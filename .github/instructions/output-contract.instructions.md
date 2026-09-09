---
description: >
  The single output contract every build agent honors when producing code edits: emit only the
  change, no surrounding prose. Referenced (not copied) by the build-agent specs to keep it DRY.
applyTo: "src/**,tests/**,scripts/**,infra/**"
---

# Output Contract (MANDATORY)

In edit/implementation mode, output ONLY the code or unified diff/patch. No preamble, no restating
the task, no closing pleasantries or summaries. Prose is allowed only when the task is
analysis/review/planning, not code edits.
