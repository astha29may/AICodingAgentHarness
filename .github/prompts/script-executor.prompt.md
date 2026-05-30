---
name: script-executor
description: "Use when you need to extract workbook data, preprocess sample data, or run repository helper scripts in Python or PowerShell from the user's active environment."
---

# Script Executor

Use this companion workflow when the task is data extraction or script-based preprocessing rather than architecture design. This is the only script-executor concept you need; the PowerShell file in tools/ is just a helper wrapper.

## Purpose
- Extract workbook facts needed for design decisions.
- Summarize sample data into a compact, reviewable artifact.
- Run helper steps in Python or PowerShell from the user's active environment.
- Prepare derived outputs that the technical-architect agent can consume.

## Constraints
- Keep the workflow focused on extraction, preprocessing, and scripted transforms.
- Preserve source text and column names verbatim where possible.
- Surface missing data and ambiguous workbook fields instead of inferring them.

## Expected Inputs
- Path to the workbook or source file.
- The extraction target, such as rule columns, sample rows, or summary tables.
- Preferred script type: Python or PowerShell.
- Optional output paths for JSON or Markdown summaries.

## Expected Outputs
- Structured summary of the requested data.
- Notes about missing columns, empty sheets, or ambiguous rules.
- Script-ready commands or wrapper steps for the requested runtime.

## Suggested Workflow
1. Identify the source file.
2. Decide whether Python or PowerShell is the better fit.
3. Extract the relevant columns and rows.
4. Normalize obvious formatting noise only.
5. Write a compact summary for review.
6. Pass the summary back to the technical-architect agent if a design update is needed.

## Example Uses
- Extract rule columns from the vendor-selection workbook with Python.
- Summarize workbook sheets that contain weight profiles or SQL examples with PowerShell.
- Prepare a small design input package from docs and sample data.