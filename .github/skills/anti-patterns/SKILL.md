---
name: anti-patterns
description: >
  On-demand coding anti-pattern rules for code-quality and anti-pattern checks. Use when a coding
  benchmark completes (BM-04, BM-07, BM-08, BM-09) or when reviewing a diff for DRY, exception-handling,
  complexity, function-length, token-density, naming, or LOC-budget anti-patterns. Carries the
  AP-DRY / AP-EXC / AP-CC / AP-LEN / AP-TOK / AP-NAME / AP-LOC rules so they load only when needed
  instead of standing always-on in the context file.
---

# Anti-Patterns Skill

## Purpose
Detect and act on coding anti-patterns in benchmark output and diffs. Loaded on demand so the
anti-pattern table does not consume standing token budget every turn.

## When to use
- A coding benchmark (BM-04, BM-07, BM-08, BM-09, or a future coding task) completes.
- Reviewing a diff or file for code-quality anti-patterns.
- Recording an anti-pattern occurrence or proposing an instruction patch.

## Anti-patterns to track

| Pattern ID | Trigger condition | Threshold → action |
|---|---|---|
| AP-DRY-01 | `duplicate_code_ratio > 0.05` | 2 runs → propose patch to coding-agent: "Extract shared logic before implementing callers" |
| AP-DRY-02 | File I/O or validation logic inlined at >1 call site | 2 runs → propose patch: "Create a single private helper for repeated I/O or validation" |
| AP-EXC-01 | Bare `except:` or `except Exception:` detected | 2 runs → propose patch: "Always catch the most specific exception type available" |
| AP-EXC-02 | Exception caught but neither logged nor re-raised | 2 runs → propose patch: "Never swallow exceptions silently; log at WARNING or re-raise" |
| AP-EXC-03 | Full response body or raw payload logged (PII risk) | 1 run → immediate Tier-A escalation + propose patch: "Log only safe fields; never log raw request/response bodies" |
| AP-CC-01 | Any function with cyclomatic complexity > 10 | 3 runs → propose patch: "Split functions at decision boundaries; target CC ≤ 8" |
| AP-LEN-01 | Any function body > 30 lines | 3 runs → propose patch: "Extract sub-functions when a function body exceeds 25 lines" |
| AP-TOK-01 | `tokens_per_loc > 50` (verbose boilerplate) | 3 runs → propose patch: "Prefer idiomatic one-liners over multi-line equivalents for stdlib operations" |
| AP-NAME-01 | Generic names: `process_data`, `handle_stuff`, `do_thing`, `temp`, `result2` | 2 runs → propose patch: "Name functions and variables for their intent, not their type" |
| AP-LOC-01 | `loc_vs_ceiling_ratio > 1.0` (exceeds LOC budget) | 2 runs → propose patch: "Implement minimal code first; do not add unrequested helpers or abstractions" |

## Memory entry format

```
ANTI-PATTERN: <AP-ID>
Task: <BM-XX>
Run: <run_id>
Date: <ISO date>
Observation: <one sentence describing what was found>
Metric: <metric name>: <value> (threshold: <threshold>)
Occurrences: <N> / <threshold>
Status: accumulating | threshold-reached | patch-proposed | patch-accepted | patch-rejected
```

Each occurrence is captured through the harness self-learning loop into
`gan-harness/feedback/ledger.jsonl` using the record shape in `.github/memory/schema.yaml`.

## Instruction patch workflow

1. When `occurrences == threshold`, generate a unified diff of the affected agent `.md` file.
2. The diff must be **minimal**: add one concrete rule or tighten one existing rule.
3. Surface the diff to the user with: "AP-XX has triggered (N occurrences). Proposed patch:"
4. On user approval: apply the diff and reset the occurrence counter.
5. On user rejection: increment a `rejected_count`; stop proposing if `rejected_count ≥ 3`.
6. Log every proposal and outcome in `gan-harness/feedback/agents/coding-agent.md`.

## Related
- Capture and record shape: `gan-harness/feedback/ledger.jsonl`, `.github/memory/schema.yaml`
- Scope and promotion policy: `.github/memory/policy.yaml`
- Quality scripts: `benchmarks/scripts/check-loc.py`, `check-duplication.py`, `check-complexity.py`
