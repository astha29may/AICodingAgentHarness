# Harness Engineering: OCTO Month-End Demo Script

## Objective

Show that harness engineering turns AI-assisted coding from an open-ended generation activity into
an observable, bounded, and self-improving engineering process. The audience should leave with three
ideas:

1. The harness governs delivery; it is not another foundation model or coding assistant.
2. Loop engineering converts failures into scoped, measurable corrections and has an explicit stop.
3. Curated learning reduces rediscovery, iterations, and consumption without hiding quality tradeoffs.

## Format

- **Total time:** 8 minutes, plus questions.
- **Slides:** 3.
- **Live surface:** Harness Control Room at `http://localhost:5174`.
- **Live action:** One bounded code-review run, not a full build.
- **Fallback:** Use the existing artifacts and slide evidence if the model or network is slow.

## Before the Meeting

Run these steps 15 minutes before presenting:

```powershell
# Terminal 1: start the control room
npm --prefix ui run dev

# Terminal 2: verify the dashboard backend
Invoke-RestMethod http://localhost:3001/api/health

# Confirm the human gates and available artifacts
Get-Content gan-harness/approvals.json
Get-ChildItem output

# Confirm the current project verifies without Docker
& .\scripts\verify-convbot.ps1 -SkipDocker
```

Open these tabs in advance:

1. PowerPoint presenter view with `harness-engineering.pptx`.
2. `http://localhost:5174` with the agent board visible.
3. The dashboard Deliverables view with `PROBLEMSTATEMENT.md`, `DESIGN.md`, and
   `IMPLEMENTATIONPLAN.md` available.
4. VS Code Copilot Chat, ready to select `code-reviewer`.
5. [output/TechnicalGaps.md](../../output/TechnicalGaps.md) as a fallback evidence view.

Do not run the complete pipeline live. Architecture, parallel build, and evaluation are intentionally
long-running because they perform real work. The live portion demonstrates the control mechanism;
the pre-staged artifacts demonstrate the complete flow.

## Eight-Minute Script

### 0:00-0:40 - Open With the Problem (Slide 1)

**Say:**

> Most AI coding demos optimize for the moment code appears on screen. In production engineering,
> that is the start of the risk, not the end of the work. The questions that matter are: what governed
> the design, who owns each change, how do we know the tests were not weakened, when does iteration
> stop, and does the next run learn anything from this one?

Pause, then add:

> Harness engineering is how we engineer those controls around the model.

Point to the three opening signals: govern, iterate, and learn.

### 0:40-2:10 - Present Slide 2

**Say:**

> Harness engineering is the discipline of engineering the system around AI coding agents: roles,
> contracts, tools, gates, feedback loops, and stop conditions. The model remains probabilistic, but
> the delivery process becomes observable and repeatable.

Walk from left to right across the top flow:

- **Specify:** Facts become a problem statement; decisions become a design; the design becomes an
  executable plan and proving tests.
- **Generate:** Specialist lanes own disjoint files and integrate through explicit contracts.
- **Evaluate:** One rubric scores tests, correctness, security, maintainability, and plan coverage.
- **PASS?:** `ITERATE` sends scoped findings back to the owning lane; `PASS` is the explicit stop.

Point to the four feature callouts:

> These are the controls that make the loop engineering rather than repetition: deterministic
> scoring, actionable feedback, a bounded iteration budget, and an explicit stop condition.

Point to the lower flow:

> A successful run also produces evidence. We capture it, remove duplication and conflicts, require
> approval before promotion, and recall only ranked, path-relevant lessons under a token cap. That is
> self-learning with governance, not uncontrolled prompt accumulation.

### 2:10-3:20 - Show the Control Room

Switch to `http://localhost:5174`.

**Say:**

> This is the live state of the engineering system. It is not a synthetic status page: it reads the
> artifacts, activity markers, approval file, evaluator feedback, and efficiency log in the repo.

Show these panels in order:

1. **Agent board:** Role-specialized stages and current activity.
2. **Deliverables:** Problem statement, design, technical gaps, implementation plan, and build report.
3. **Approval state:** Design and plan are blocking human checkpoints.
4. **Feedback/efficiency:** Iteration evidence and quality-versus-consumption trend.

Use one artifact to make the point concrete:

> Notice that unresolved decisions are not silently guessed. They remain visible in
> `TechnicalGaps.md` and block or constrain downstream work.

### 3:20-5:00 - Run One Bounded Live Action

In Copilot Chat, select `code-reviewer` and submit:

```text
Review the current ConvBot implementation under src/, tests/, and ui/app against
output/IMPLEMENTATIONPLAN.md. Run only focused, non-destructive verification. Write the result to
output/REVIEW.md with severity-ranked findings and a PASS or CHANGES REQUIRED verdict. Do not edit
production code.
```

While it runs, return to the dashboard.

**Say:**

> The important part is not whether the reviewer says PASS. The important part is that its role,
> allowed behavior, output contract, and evidence are defined before it starts. If it finds a defect,
> the result returns to the owning build lane; it does not invite every agent to rewrite everything.

When the run completes, open `output/REVIEW.md` in the Deliverables view or VS Code.

**Say:**

> This verdict is now an artifact. The evaluator can score it against the same acceptance rubric,
> detect regression or test weakening, and either return a focused iteration or stop at PASS.

If the review takes longer than 45 seconds, use the fallback line:

> This is real agent work rather than a scripted animation, so I will let it finish in the background.
> The control path is already visible; let me show the measured outcome from repeated runs.

### 5:00-6:35 - Present Slide 3

Return to the presentation.

**Say:**

> We tested the same ConverseHub build through several configurations. The honest first result was
> that process alone costs more: the full harness explored more and consumed more than a bare prompt.
> That is why we measure the system rather than assume that more orchestration is automatically better.

Highlight the Custom memory row and top-left statistic:

> Targeted, repository-versioned memory changed the result. Tool calls dropped from 83 to 52.
> Approximate output tokens dropped 21 percent versus the full harness, from 62.3K to 49.0K.
> Deterministic code quality reached 9.02, a 2.38-point gain over the bare arm's 6.64. The gain came
> from less rediscovery, not from suppressing verification.

Point to the LOC/file column:

> Code structure improved too. The bare arm produced a median 51 source lines per file; the governed
> memory variants landed between 15 and 29. Native parallel fan-out reached 89, which is why the
> harness needs a consolidation pass after independent lanes merge. LOC is a modularity signal here,
> and we always read it alongside completeness and passing tests.

Highlight GHCP and Hybrid memory:

> On-demand GHCP memory reached the highest quality and the leanest measured output at 41.5K tokens.
> Repository memory remained portable and auditable. The hybrid run did not improve quality over GHCP,
> but its output-token log was not retained, so I will not invent a conversion. A learning system needs
> curation and suppression, not an ever-growing prompt.

Highlight the isolated-stage statistic:

> Isolating every stage increased generated output from 62.3K to 170.9K tokens, about 2.7 times.
> Each stage started a fresh session, so it could not reuse the warmed prompt prefix or prior-stage
> working context and repeated discovery. Stable context and a continuous loop are part of the design.

State the caveat explicitly:

> These are approximate assistant output tokens from Copilot CLI logs, not total billing tokens. They
> exclude input, cache processing, tool payloads, and server-side memory recall. The hybrid and VS Code
> subagent runs lack comparable output-token telemetry, so those cells remain unavailable.

### 6:35-7:30 - Land the OCTO Relevance

**Say:**

> For OCTO, the opportunity is larger than one application. The harness makes engineering practices
> reusable across teams: approval gates, Azure-first architecture defaults, security review,
> observability, deterministic evaluation, and evidence-backed learning travel with the repository.

> This creates a practical adoption path: start with one bounded workflow, measure quality and
> iterations, promote only lessons that survive evidence, and expand without losing human control.

### 7:30-8:00 - Close With a Question

**Say:**

> The question is no longer, "Can an agent write this code?" We know it can. The more valuable
> question is, "What engineering system lets us trust, improve, and economically scale that work?"

> My proposal is to pilot this on two comparable OCTO workloads and track three measures: quality,
> iterations to PASS, and consumption per quality point.

Stop there. Let the audience respond before adding implementation detail.

## Audience Hooks

Use one of these if the room is quiet:

- **Architects:** "Which decision in your current design process is most dangerous for an agent to
  infer silently?"
- **Engineering leaders:** "Would you rather compare agents by code generated, or by verified quality
  reached per iteration?"
- **Developers:** "Which recurring review comment should become repository memory instead of being
  rediscovered in every PR?"
- **Governance/security:** "What evidence would you require before promoting an agent-discovered rule
  across repositories?"

## Likely Questions

| Question | Concise response |
| --- | --- |
| Is this a new agent framework? | No. It is a repository-native control system around GitHub Copilot agents, skills, instructions, deterministic scripts, and artifacts. |
| Does self-learning change production behavior automatically? | No. Candidates are captured automatically, but durable promotion remains evidence-gated and human-approved. |
| Why not use one powerful model with one prompt? | That is the bare baseline. It is cheap, but it lacks governed decisions, traceable artifacts, bounded correction, and reusable evidence. |
| Does the harness always save tokens? | No. The full unoptimized harness cost more. Targeted recall, continuous context, and reduced exploration produced the measured efficiency gain. |
| Are the quality scores subjective? | The code score uses deterministic checks for structure, syntax, executable passing tests, modularity, and duplication; rubric review adds task-specific evaluation. |
| Can teams use different stacks? | Yes. Microsoft/Azure-native choices are defaults, not hard-coded requirements; the approved design and project instructions control the stack. |
| What prevents endless iteration? | A fixed acceptance rubric, regression detection, plateau detection, and a default five-iteration budget that escalates to a human. |

## Demo Fallback

If Copilot, the network, or the dashboard is unavailable:

1. Stay on slide 2 and narrate the red `ITERATE` path and lower learning path.
2. Open the existing files directly in VS Code:
   - [output/PROBLEMSTATEMENT.md](../../output/PROBLEMSTATEMENT.md)
   - [output/DESIGN.md](../../output/DESIGN.md)
   - [output/TechnicalGaps.md](../../output/TechnicalGaps.md)
   - [output/IMPLEMENTATIONPLAN.md](../../output/IMPLEMENTATIONPLAN.md)
3. Run the deterministic local verification:

```powershell
& .\scripts\verify-convbot.ps1 -SkipDocker
```

4. Return to slide 3 and present the measured comparison. Do not apologize for avoiding a full live
   generation; bounded, reproducible evidence is the point of the demo.

## Final Delivery Check

- Dashboard starts and `/api/health` responds.
- PowerPoint opens in presenter mode and notes are visible.
- Existing output artifacts are complete.
- The live prompt is preloaded but not submitted.
- Notifications, unrelated terminals, and secrets are hidden.
- A timer is visible; move to fallback after 45 seconds.