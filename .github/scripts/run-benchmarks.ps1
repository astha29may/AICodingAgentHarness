#Requires -Version 5.1
<#
.SYNOPSIS
    Runs the harness benchmark suite (Copilot/Python-native — no external agent engine).

.DESCRIPTION
    Reads benchmarks/benchmark-config.yaml, iterates each enabled task, and emits a report
    to gan-harness/build-report.md. Per-task model invocation is a placeholder seam (see the
    runner-rework TODO in the task loop); deterministic rubric checks are provided by the
    Python scripts under benchmarks/scripts/. Config loading, task iteration, baseline
    comparison, and report writing are wired and functional.

.PARAMETER TaskId
    Run a single task by ID (e.g. BM-01). Omit for all enabled tasks.

.PARAMETER Model
    Override the model for this run (e.g. copilot).

.PARAMETER OutputDir
    Directory for run artefacts. Default: gan-harness/runs/<timestamp>

.EXAMPLE
    .\scripts\run-benchmarks.ps1
    .\scripts\run-benchmarks.ps1 -TaskId BM-04
    .\scripts\run-benchmarks.ps1 -Model "copilot"
#>
[CmdletBinding()]
param(
    [string]$TaskId = '',

    [string]$Model = '',

    [string]$OutputDir = '',

    [switch]$Baseline,

    [switch]$Pipeline,

    [string]$Stages = '',

    [switch]$Continuous,

    [switch]$WithBaseline,

    [switch]$InRepo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$RunTs     = (Get-Date -Format 'yyyyMMdd-HHmmss')
$RunDir    = if ($OutputDir) { $OutputDir } else { Join-Path $RepoRoot "gan-harness\runs\$RunTs" }
$ConfigFile = Join-Path $RepoRoot "benchmarks\benchmark-config.yaml"
$BaselineFile = Join-Path $RepoRoot "benchmarks\baseline\metrics.json"
$ReportFile = Join-Path $RepoRoot "gan-harness\build-report.md"
$AbReportFile = Join-Path $RepoRoot "gan-harness\baseline-ab-report.md"
$Scorer      = Join-Path $RepoRoot "benchmarks\scripts\score-task.py"
$UsageParser = Join-Path $RepoRoot "benchmarks\scripts\parse-usage.py"

New-Item -ItemType Directory -Path $RunDir -Force | Out-Null

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    [OK]   $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "    [FAIL] $msg" -ForegroundColor Red }
function Write-Warn([string]$msg) { Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function Get-OrDefault($value, $default) { if ($null -ne $value) { $value } else { $default } }

# Copy the harness context Copilot reads. Agents are curated (Gap4): only the named set is seeded
# so the always-registered agent list stays small; empty $Agents falls back to all agents.
function Copy-HarnessContext([string]$Dest, [string[]]$Agents = @()) {
    $items = @('AGENTS.md', 'templates', '.github\copilot-instructions.md', '.github\instructions',
               '.github\skills', '.github\memory')
    foreach ($it in $items) {
        $src = Join-Path $RepoRoot $it
        if (Test-Path $src) {
            $target = Join-Path $Dest $it
            $parent = Split-Path $target -Parent
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Copy-Item -Path $src -Destination $target -Recurse -Force
        }
    }
    $srcAgents = Join-Path $RepoRoot ".github\agents"
    $agentDst = Join-Path $Dest ".github\agents"
    New-Item -ItemType Directory -Path $agentDst -Force | Out-Null
    $names = if ($Agents.Count) { $Agents } else { (Get-ChildItem $srcAgents -Filter *.md).BaseName -replace '\.agent$', '' | Sort-Object -Unique }
    foreach ($n in $names) {
        foreach ($ext in @('.agent.md', '.md')) {
            $af = Join-Path $srcAgents "$n$ext"
            if (Test-Path $af) { Copy-Item -Path $af -Destination $agentDst -Force; break }
        }
    }
}

# Run one A/B arm (control or treatment): generate, score, measure AIU. Returns a metrics object.
function Invoke-Arm([string]$WorkDir, [string]$CliModel, [string]$ExtraArgs, [string]$TaskFile, [string]$GenLog, [double]$Threshold, [bool]$Seed) {
    New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
    if ($Seed) { Copy-HarnessContext $WorkDir }
    $env:BM_WORKDIR = $WorkDir
    $genExit = 1
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell -NoProfile -Command "& copilot -p `$env:BM_PROMPT -C `$env:BM_WORKDIR --add-dir `$env:BM_WORKDIR --allow-all-tools --no-ask-user --model $CliModel --output-format json $ExtraArgs" *>&1 | Set-Content -Path $GenLog -Encoding UTF8
        $genExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    $offline = ($genExit -ne 0)
    $metrics = $null
    try {
        if ($offline) { $scoreJson = python $Scorer --task $TaskFile --workdir $WorkDir --offline }
        else { $scoreJson = python $Scorer --task $TaskFile --workdir $WorkDir }
        $metrics = $scoreJson | ConvertFrom-Json
    } catch { }
    $quality = if ($null -ne $metrics) { $metrics.quality_score } else { $null }
    $usage = $null
    if (-not $offline -and (Test-Path $GenLog)) {
        try { $usage = (python $UsageParser --log $GenLog --workdir $WorkDir) | ConvertFrom-Json } catch { }
    }
    return [PSCustomObject]@{
        quality_score    = $quality
        aiu              = if ($usage) { $usage.aiu } else { $null }
        premium_requests = if ($usage) { $usage.premium_requests } else { $null }
        output_tokens    = if ($usage) { $usage.output_tokens } else { $null }
        lines_added      = if ($usage) { $usage.lines_added } else { $null }
        aiu_per_loc      = if ($usage -and $usage.lines_added -gt 0) { [math]::Round($usage.aiu / $usage.lines_added, 4) } else { $null }
        passed           = ($null -ne $quality) -and ($quality -ge $Threshold)
    }
}

# Copy only the project artifacts (not the seeded harness) into a clean dir for scoring.
function Copy-ProjectArtifacts([string]$Src, [string]$Dest) {
    New-Item -ItemType Directory -Path $Dest -Force | Out-Null
    foreach ($d in @('output', 'src', 'tests', 'docs')) {
        $s = Join-Path $Src $d
        if (Test-Path $s) { Copy-Item -Path $s -Destination (Join-Path $Dest $d) -Recurse -Force }
    }
    $readme = Join-Path $Src 'README.md'
    if (Test-Path $readme) { Copy-Item -Path $readme -Destination (Join-Path $Dest 'README.md') -Force }
}

# Run one pipeline stage inside the shared (accumulating) chain workspace; score a project-only snapshot.
function Invoke-Stage([string]$WorkDir, [string]$CliModel, [string]$ExtraArgs, [string]$TaskFile, [string]$GenLog, [string]$ScoreRoot, [string]$SessionId = '') {
    $env:BM_WORKDIR = $WorkDir
    $sessFlag = if ($SessionId) { "--session-id=$SessionId" } else { "" }
    $genExit = 1
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell -NoProfile -Command "& copilot -p `$env:BM_PROMPT -C `$env:BM_WORKDIR --add-dir `$env:BM_WORKDIR --allow-all-tools --no-ask-user --model $CliModel --output-format json $sessFlag $ExtraArgs" *>&1 | Set-Content -Path $GenLog -Encoding UTF8
        $genExit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    $offline = ($genExit -ne 0)
    $scoreDir = Join-Path $ScoreRoot ([System.IO.Path]::GetRandomFileName())
    Copy-ProjectArtifacts $WorkDir $scoreDir
    $quality = $null
    try {
        if ($offline) { $sj = python $Scorer --task $TaskFile --workdir $scoreDir --offline }
        else { $sj = python $Scorer --task $TaskFile --workdir $scoreDir }
        $m = $sj | ConvertFrom-Json
        $quality = if ($null -ne $m) { $m.quality_score } else { $null }
    } catch { }
    $usage = $null
    if (-not $offline -and (Test-Path $GenLog)) { try { $usage = (python $UsageParser --log $GenLog --workdir $WorkDir) | ConvertFrom-Json } catch { } }
    return [PSCustomObject]@{
        quality_score = $quality
        aiu           = if ($usage) { $usage.aiu } else { $null }
        lines_added   = if ($usage) { $usage.lines_added } else { $null }
    }
}

# Self-learning closeout: run agent-feedback to emit candidate memory records (propose-only). Returns AIU.
function Invoke-Closeout([string]$WorkDir, [string]$CliModel, [string]$GenLog, [string]$SessionId = '') {
    $env:BM_WORKDIR = $WorkDir
    $env:BM_PROMPT = "You are agent-feedback in solution-closeout mode. Review the completed build in src/ and tests/ in this workspace. Per .github/agents/agent-feedback.agent.md, emit candidate memory records to gan-harness/feedback/ledger.jsonl (evidence.state: candidate) using the .github/memory/schema.yaml shape, apply the .github/memory/policy.yaml gates, and label each PROMOTE-READY or PROPOSAL. If nothing rose above threshold, write nothing and state 'No new memory candidates this run'. Propose only; do not approve, materialize, or edit specs."
    $sessFlag = if ($SessionId) { "--session-id=$SessionId" } else { "" }
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell -NoProfile -Command "& copilot -p `$env:BM_PROMPT -C `$env:BM_WORKDIR --add-dir `$env:BM_WORKDIR --allow-all-tools --no-ask-user --model $CliModel --output-format json $sessFlag --agent agent-feedback" *>&1 | Set-Content -Path $GenLog -Encoding UTF8
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    if (Test-Path $GenLog) { try { return (python $UsageParser --log $GenLog --workdir $WorkDir | ConvertFrom-Json).aiu } catch { } }
    return $null
}

# ─── Validate prerequisites ────────────────────────────────────────────────────
Write-Step "Checking prerequisites"

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Fail "python not found. Required for YAML parsing and deterministic rubric checks."
    exit 1
}
Write-Ok "python found"

# ─── Parse benchmark config (Python does the YAML heavy lifting) ───────────────
Write-Step "Loading benchmark configuration"

$parseScript = Join-Path $RepoRoot "copilotscripts\parse-benchmark-config.py"
@"
import json, os, sys
try:
    import yaml
except ImportError:
    import subprocess, sys as _sys
    subprocess.check_call([_sys.executable, '-m', 'pip', 'install', 'pyyaml', '-q'])
    import yaml

cfg_path = r'$($ConfigFile.Replace('\','\\'))'
with open(cfg_path, encoding='utf-8') as f:
    cfg = yaml.safe_load(f)

defaults = cfg.get('defaults', {})
base_dir = os.path.dirname(cfg_path)
raw = cfg.get('tasks', [])
task_id = '$TaskId'
if task_id:
    raw = [t for t in raw if t.get('id') == task_id]
else:
    raw = [t for t in raw if t.get('enabled', True)]

tasks = []
for t in raw:
    rel = t.get('file', '')
    spec = {}
    tf = os.path.join(base_dir, rel)
    if rel and os.path.isfile(tf):
        with open(tf, encoding='utf-8') as g:
            spec = yaml.safe_load(g) or {}
    overrides = t.get('overrides') or {}
    evaluation = spec.get('evaluation') or {}
    threshold = (overrides.get('pass_threshold')
                 or evaluation.get('pass_threshold_override')
                 or defaults.get('pass_threshold') or 7.0)
    prompt = spec.get('prompt', '')
    fixtures = (spec.get('fixtures') or {}).get('inline') or {}
    for fk, fv in fixtures.items():
        prompt = prompt.replace('{{' + fk + '}}', str(fv))
    prompt = prompt.replace('"', "'")
    tasks.append({'id': t.get('id'), 'weight': t.get('weight', 1.0),
                  'description': t.get('description', ''), 'file': rel,
                  'prompt': prompt, 'pass_threshold': threshold})

print(json.dumps({'tasks': tasks, 'defaults': defaults,
                  'aggregation': cfg.get('aggregation', {}),
                  'baseline_file': cfg.get('baseline', {}).get('file', 'benchmarks/baseline/metrics.json')}))
"@ | Set-Content -Path $parseScript -Encoding UTF8

$configJson = python $parseScript | ConvertFrom-Json
$tasks = $configJson.tasks

Write-Ok "Loaded $($tasks.Count) task(s)"

# ─── Baseline A/B mode: control (bare) vs treatment (full harness) ─────────────
if ($Baseline) {
    Write-Step "Baseline A/B: control (bare) vs treatment (full harness) - each task runs twice"
    $cliModel = if ($Model) { $Model } elseif ($configJson.defaults.model -and $configJson.defaults.model -ne 'copilot') { $configJson.defaults.model } else { 'auto' }
    $ab = @{}
    foreach ($task in $tasks) {
        $taskId  = $task.id
        $taskOut = Join-Path $RunDir $taskId
        New-Item -ItemType Directory -Path $taskOut -Force | Out-Null
        Write-Step "A/B $taskId - $($task.description)"
        $taskFile  = Join-Path $RepoRoot (Join-Path "benchmarks" $task.file)
        $threshold = Get-OrDefault $task.pass_threshold 7.0
        $env:BM_PROMPT = Get-OrDefault $task.prompt ''
        $ctrlWd  = Join-Path $env:TEMP "bm-ab-$RunTs\$taskId\control"
        $treatWd = Join-Path $env:TEMP "bm-ab-$RunTs\$taskId\treatment"
        $ctrl  = Invoke-Arm $ctrlWd  $cliModel "--no-custom-instructions" $taskFile (Join-Path $taskOut "control.log")   $threshold $false
        $treat = Invoke-Arm $treatWd $cliModel ""                         $taskFile (Join-Path $taskOut "treatment.log") $threshold $true
        $ab[$taskId] = [PSCustomObject]@{ task_id = $taskId; control = $ctrl; treatment = $treat }
        Write-Ok "$taskId  control: AIU=$($ctrl.aiu) q=$($ctrl.quality_score)  |  treatment: AIU=$($treat.aiu) q=$($treat.quality_score)"
    }
    $abLines = @(
        "# Baseline A/B Report - control (bare) vs treatment (full harness)",
        "",
        "- **Run ID**: $RunTs",
        "- **Model**: $(if ($Model) { $Model } else { $configJson.defaults.model })",
        "",
        "| Task | Ctrl AIU | Treat AIU | dAIU | Ctrl Q | Treat Q | dQ | Ctrl | Treat |",
        "|------|----------|-----------|------|--------|---------|----|------|-------|"
    )
    foreach ($task in $tasks) {
        $r = $ab[$task.id]; $c = $r.control; $t = $r.treatment
        $dAiu = if ($null -ne $c.aiu -and $null -ne $t.aiu) { [math]::Round($t.aiu - $c.aiu, 3) } else { '' }
        $dQ   = if ($null -ne $c.quality_score -and $null -ne $t.quality_score) { [math]::Round($t.quality_score - $c.quality_score, 2) } else { '' }
        $abLines += "| $($task.id) | $($c.aiu) | $($t.aiu) | $dAiu | $($c.quality_score) | $($t.quality_score) | $dQ | $(if ($c.passed){'PASS'}else{'FAIL'}) | $(if ($t.passed){'PASS'}else{'FAIL'}) |"
    }
    $abLines += @("", "_dAIU>0 = harness cost more AIU; dQ>0 = harness improved quality. The harness earns its cost when quality holds/rises for equal-or-lower AIU._", "", "_Generated by run-benchmarks.ps1 -Baseline at $($RunTs)_")
    $abLines | Set-Content -Path $AbReportFile -Encoding UTF8
    Write-Step "A/B report written to $AbReportFile"
    Get-Content $AbReportFile | Where-Object { $_ -like '|*' -or $_ -like '- *' }
    exit 0
}

# ─── Pipeline mode: ConverseHub harness run (5-stage pipeline + custom memory) ──
if ($Pipeline) {
    Write-Step "Pipeline mode: ConverseHub harness run (5-stage + custom memory)"
    $pipeFile = Join-Path $RepoRoot "benchmarks\pipeline\converhub.yaml"
    $stageDir = Join-Path $RunDir "stages"
    $pj = python (Join-Path $RepoRoot "benchmarks\scripts\parse-pipeline.py") --pipeline $pipeFile --stagedir $stageDir | ConvertFrom-Json
    $cliModel = if ($Model) { $Model } elseif ($configJson.defaults.model -and $configJson.defaults.model -ne 'copilot') { $configJson.defaults.model } else { 'auto' }
    $wanted = if ($Stages) { @($Stages -split ',' | ForEach-Object { $_.Trim() }) } else { $null }
    $memSeed = Join-Path $RepoRoot "benchmarks\pipeline\harness-memory.instructions.md"
    $chains = [System.Collections.ArrayList]@(
        [PSCustomObject]@{ name = 'harness'; seed = $true; useAgent = $true; mem = $memSeed; buildOnly = $false }
    )
    # Optional bare baseline (no specs, no memory) to measure harness value.
    if ($WithBaseline) {
        $chains.Insert(0, [PSCustomObject]@{ name = 'control'; seed = $false; useAgent = $false; mem = ''; buildOnly = $true })
    }
    # Curated agent set actually invoked by the pipeline (Gap4: do not seed all 13).
    $pipeAgents = @('problem-statement-creation', 'technical-architect', 'implementation-planner',
                    'parallel-build-orchestrator', 'code-reviewer', 'frontend-engineer',
                    'backend-engineer', 'ai-engineer', 'data-engineer', 'agent-feedback')
    $armResult = @{}
    foreach ($chain in $chains) {
        Write-Step "Chain: $($chain.name)"
        # -InRepo: build into the real repo (src/tests/output) using the repo's own harness context +
        # materialized memory. Otherwise an isolated temp workspace seeded with the memory-seed fixture.
        $chainWs   = if ($InRepo) { $RepoRoot } else { Join-Path $env:TEMP "bm-pipe-$RunTs\$($chain.name)" }
        $scoreRoot = Join-Path $env:TEMP "bm-pipe-$RunTs\score-$($chain.name)"
        New-Item -ItemType Directory -Path $chainWs -Force | Out-Null
        if ($chain.seed -and -not $InRepo) { Copy-HarnessContext $chainWs $pipeAgents }
        # Isolated mode only: overwrite the seeded (empty) memory with the custom-memory seed fixture.
        if ($chain.mem -and (Test-Path $chain.mem) -and -not $InRepo) {
            $dst = Join-Path $chainWs ".github\instructions\memory-repo.instructions.md"
            New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
            Copy-Item -Path $chain.mem -Destination $dst -Force
        }
        $sid = if ($Continuous) { [guid]::NewGuid().ToString() } else { '' }
        if ($sid) { Write-Ok "    session-id: $sid"; "$($chain.name)=$sid" | Add-Content -Path (Join-Path $RunDir 'session-ids.txt') }
        $sr = @{}; $lastAiu = $null; $codeScore = $null
        if ($chain.buildOnly) {
            # No-harness baseline: ONE bare prompt, no stages, no harness specs reach this arm.
            Write-Step "  [$($chain.name)] BUILD - one bare prompt (make assumptions, no specs)"
            $env:BM_PROMPT = $pj.bare.prompt
            $genLog = Join-Path $RunDir "$($chain.name)-BUILD.log"
            $res = Invoke-Stage $chainWs $cliModel "--no-custom-instructions" $pj.bare.task_file $genLog $scoreRoot $sid
            $sr['BUILD'] = $res; $lastAiu = $res.aiu; $codeScore = $res.quality_score
            Write-Ok "    BUILD: AIU=$($res.aiu) code=$($res.quality_score)"
        } else {
            New-Item -ItemType Directory -Path (Join-Path $chainWs 'output') -Force | Out-Null
            foreach ($stage in $pj.stages) {
                if ($wanted -and ($wanted -notcontains $stage.id)) { continue }
                Write-Step "  [$($chain.name)] $($stage.id) - agent: $($stage.agent)"
                $env:BM_PROMPT = "Write each named deliverable to the existing output/ folder at the workspace root using its exact path (for example output/DESIGN.md); never write deliverables to the workspace root.`n`n" + $stage.prompt
                $extra = if ($chain.useAgent -and $stage.agent) { "--agent $($stage.agent)" } else { "--no-custom-instructions" }
                $genLog = Join-Path $RunDir "$($chain.name)-$($stage.id).log"
                $res = Invoke-Stage $chainWs $cliModel $extra $stage.task_file $genLog $scoreRoot $sid
                $sr[$stage.id] = $res
                if ($null -ne $res.aiu) { $lastAiu = $res.aiu }
                Write-Ok "    $($stage.id): AIU=$($res.aiu) q=$($res.quality_score)"
            }
            # Self-learning closeout: emit candidate memory records (propose-only) from the build.
            Write-Step "  [$($chain.name)] CLOSEOUT - agent-feedback (memory candidates)"
            $coLog = Join-Path $RunDir "$($chain.name)-CLOSEOUT.log"
            $coAiu = Invoke-Closeout $chainWs $cliModel $coLog $sid
            $sr['CLOSEOUT'] = [PSCustomObject]@{ aiu = $coAiu; quality_score = $null }
            Write-Ok "    CLOSEOUT: AIU=$coAiu (candidates -> ledger.jsonl)"
            $ledgerSrc = Join-Path $chainWs "gan-harness\feedback\ledger.jsonl"
            if (Test-Path $ledgerSrc) { Copy-Item $ledgerSrc (Join-Path $RunDir "$($chain.name)-ledger.jsonl") -Force }
            if ($Continuous -and $null -ne $coAiu) { $lastAiu = $coAiu }
            $codeScore = if ($sr.ContainsKey('CODE')) { $sr['CODE'].quality_score } else { $null }
            if (-not $Continuous) {
                $sum = 0.0; foreach ($k in $sr.Keys) { if ($null -ne $sr[$k].aiu) { $sum += $sr[$k].aiu } }
                $lastAiu = $sum
            }
        }
        $armResult[$chain.name] = [PSCustomObject]@{ total_aiu = $lastAiu; code = $codeScore; stages = $sr; buildOnly = $chain.buildOnly }
    }
    # ── Report: per-arm summary (structures differ) + pipeline-stage detail for harness arms ──
    $names = @($chains | ForEach-Object { $_.name })
    $modeLine = if ($Continuous) { 'continuous session (cached prefix - reflects real cost)' } else { 'isolated per-stage processes (cache-cold upper bound)' }
    $pl = @(
        "# ConverseHub harness run - AIU + code-build score",
        "",
        "- **Run ID**: $RunTs",
        "- **Model**: $cliModel",
        "- **Mode**: $modeLine",
        "",
        "## Summary (per arm)",
        "| Arm | Structure | Total AIU | Code-build score |",
        "|---|---|---|---|"
    )
    foreach ($n in $names) {
        $a = $armResult[$n]
        $struct = if ($a.buildOnly) { '1-shot bare build (no specs/stages)' } else { '5-stage harness + memory' }
        $tot = if ($null -ne $a.total_aiu) { [math]::Round($a.total_aiu, 3) } else { '' }
        $pl += "| $n | $struct | $tot | $($a.code) |"
    }
    $pipeNames = @($chains | Where-Object { -not $_.buildOnly } | ForEach-Object { $_.name })
    if ($pipeNames.Count -gt 0) {
        $prev = @{}; foreach ($n in $pipeNames) { $prev[$n] = 0.0 }
        $pl += ""
        $pl += "## Pipeline stage detail (harness arms)"
        $pl += "| Stage | Agent | " + (($pipeNames | ForEach-Object { "$_ AIU" }) -join " | ") + " | " + (($pipeNames | ForEach-Object { "$_ Q" }) -join " | ") + " |"
        $pl += "|---|---|" + ((1..($pipeNames.Count * 2) | ForEach-Object { "---" }) -join "|") + "|"
        foreach ($stage in $pj.stages) {
            if ($wanted -and ($wanted -notcontains $stage.id)) { continue }
            $aiuCells = @(); $qCells = @()
            foreach ($n in $pipeNames) {
                $r = $armResult[$n].stages[$stage.id]
                $aiu = if ($r) { $r.aiu } else { $null }
                if ($Continuous) {
                    $show = if ($null -ne $aiu) { [math]::Round($aiu - $prev[$n], 3) } else { '' }
                    if ($null -ne $aiu) { $prev[$n] = $aiu }
                } else {
                    $show = if ($null -ne $aiu) { $aiu } else { '' }
                }
                $aiuCells += "$show"
                $qCells += "$(if ($r) { $r.quality_score } else { '' })"
            }
            $pl += "| $($stage.id) | $($stage.agent) | " + ($aiuCells -join " | ") + " | " + ($qCells -join " | ") + " |"
        }
    }
    $pl += ""
    $pl += "_harness = full 5-stage pipeline (PS->DESIGN->PLAN->CODE->REVIEW) with custom memory. control (with -WithBaseline) = one bare prompt, no specs/stages, --no-custom-instructions, for value comparison. Continuous per-stage AIU is the session-cumulative delta; a pipeline arm's Total AIU = its last-stage cumulative, the bare arm's = its single build. Code-build score is the deterministic build judge on each arm's src/tests._"
    $PipeReportFile = Join-Path $RepoRoot "gan-harness\pipeline-report.md"
    $pl | Set-Content -Path $PipeReportFile -Encoding UTF8
    Write-Step "Report written to $PipeReportFile"
    Get-Content $PipeReportFile | Where-Object { $_ -like '|*' -or $_ -like '- *' -or $_ -like '#*' }
    exit 0
}

# ─── Load baseline ────────────────────────────────────────────────────────────────────
$baseline = $null
if (Test-Path $BaselineFile) {
    $baseline = Get-Content $BaselineFile | ConvertFrom-Json
    if ($null -eq $baseline.suite_score) {
        Write-Warn "Baseline not yet locked (all nulls). Run .\scripts\lock-baseline.ps1 after this run."
        $baseline = $null
    }
}

# ─── Run tasks ────────────────────────────────────────────────────────────────
$results = @{}

foreach ($task in $tasks) {
    $taskId   = $task.id
    $taskOut  = Join-Path $RunDir "$taskId"
    New-Item -ItemType Directory -Path $taskOut -Force | Out-Null

    Write-Step "Running $taskId - $($task.description)"

    $modelArg  = if ($Model) { $Model } else { $configJson.defaults.model }
    $startTime = Get-Date

    # Per-task workdir the scorer inspects. The copilot seam writes outputs here
    # (under an output/-relative path per the task's expected_outputs), and the
    # Python rubric reads from the same directory.
    $taskFile  = Join-Path $RepoRoot (Join-Path "benchmarks" $task.file)
    $workDir   = Join-Path $taskOut "workspace"
    New-Item -ItemType Directory -Path $workDir -Force | Out-Null

    # ── Generation seam: headless GitHub Copilot CLI (optional) ────────────────
    # Isolated behind Get-Command; on absence/failure we WARN and continue so
    # deterministic scoring still runs offline. Tools run confined to the per-run
    # $workDir — an explicit, human-invoked benchmark run, not an unattended
    # shadow-mode bypass; broad path/URL/full-permission bypasses are never used.
    # Prompt + workdir cross to a child powershell via env vars so multi-line
    # prompts with embedded quotes are not mangled by native arg quoting (5.1).
    $copilotCmd = Get-Command copilot -ErrorAction SilentlyContinue
    $offline    = $true
    if ($copilotCmd) {
        try {
            $promptFile = Join-Path $taskOut "prompt.txt"
            $genLog     = Join-Path $taskOut "generation.log"
            Get-OrDefault $task.prompt '' | Set-Content -Path $promptFile -Encoding UTF8
            $cliModel   = if ($modelArg -and $modelArg -ne 'copilot') { $modelArg } else { 'auto' }
            $env:BM_PROMPT  = Get-Content -Raw $promptFile
            $env:BM_WORKDIR = $workDir
            $genExit = 1
            $prevEAP = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                & powershell -NoProfile -Command "& copilot -p `$env:BM_PROMPT -C `$env:BM_WORKDIR --add-dir `$env:BM_WORKDIR --allow-all-tools --no-ask-user --model $cliModel --output-format json" *>&1 | Set-Content -Path $genLog -Encoding UTF8
                $genExit = $LASTEXITCODE
            } finally {
                $ErrorActionPreference = $prevEAP
            }
            if ($genExit -eq 0) {
                $offline = $false
                Write-Ok "$taskId generated via copilot CLI"
            } else {
                Write-Warn "$taskId copilot generation exited $genExit. Scoring offline."
            }
        } catch {
            Write-Warn "$taskId copilot generation failed: $($_.Exception.Message). Scoring offline."
        }
    } else {
        Write-Warn "copilot CLI not found. Generation skipped; scoring deterministic criteria only."
    }

    # ── Scoring seam: pure-Python rubric ───────────────────────────────────────
    $scorer  = Join-Path $RepoRoot "benchmarks\scripts\score-task.py"
    $metrics = $null
    try {
        if ($offline) {
            $scoreJson = python $scorer --task $taskFile --workdir $workDir --offline
        } else {
            $scoreJson = python $scorer --task $taskFile --workdir $workDir
        }
        $metrics = $scoreJson | ConvertFrom-Json
    } catch {
        Write-Warn "$taskId scoring failed: $($_.Exception.Message)"
    }

    $wallSeconds = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

    # ── Consumption seam: AIU + output tokens + code-change size from the JSON generation log ──
    $usage = $null
    if (-not $offline -and (Test-Path $genLog)) {
        try {
            $usageJson = python (Join-Path $RepoRoot "benchmarks\scripts\parse-usage.py") --log $genLog
            $usage = $usageJson | ConvertFrom-Json
        } catch {
            Write-Warn "$taskId usage parse failed: $($_.Exception.Message)"
        }
    }
    $aiu       = if ($usage) { $usage.aiu } else { $null }
    $credits   = if ($usage) { $usage.premium_requests } else { $null }
    $outTokens = if ($usage) { $usage.output_tokens } else { $null }
    $filesMod  = if ($usage) { $usage.files_modified } else { $null }
    $locAdded  = if ($usage) { $usage.lines_added } else { $null }
    $aiuPerLoc = if ($usage -and $usage.lines_added -gt 0) { [math]::Round($usage.aiu / $usage.lines_added, 4) } else { $null }

    $qualityScore = if ($null -ne $metrics) { $metrics.quality_score } else { $null }
    $taskThreshold = Get-OrDefault $task.pass_threshold 7.0
    $taskPassed = ($null -ne $qualityScore) -and ($qualityScore -ge $taskThreshold)

    $results[$taskId] = [PSCustomObject]@{
        task_id          = $taskId
        quality_score    = $qualityScore
        aiu              = $aiu
        premium_requests = $credits
        output_tokens    = $outTokens
        files_modified   = $filesMod
        lines_added      = $locAdded
        aiu_per_loc      = $aiuPerLoc
        wall_seconds     = $wallSeconds
        passed           = $taskPassed
    }

    if ($null -eq $qualityScore) {
        Write-Warn "$taskId not scored (no rubric result)"
    } else {
        $verdict = if ($taskPassed) { 'PASS' } else { 'FAIL' }
        Write-Ok "$taskId scored $qualityScore / 10 [$verdict]"
    }
}

# ─── Compute suite score ───────────────────────────────────────────────────────
Write-Step "Computing suite score"

$totalWeight   = ($tasks | Measure-Object -Property weight -Sum).Sum
$weightedScore = 0.0
foreach ($task in $tasks) {
    $r = $results[$task.id]
    if ($null -ne $r.quality_score) {
        $weightedScore += ($r.quality_score * $task.weight)
    }
}
$suiteScore = if ($totalWeight -gt 0) { [math]::Round($weightedScore / $totalWeight, 2) } else { $null }
$suitePassThreshold = Get-OrDefault $configJson.aggregation.suite_pass_threshold 7.2
$suitePass  = ($null -ne $suiteScore) -and ($suiteScore -ge $suitePassThreshold)

Write-Host "`n  Suite score: $suiteScore / 10  [$( if ($suitePass) {'PASS'} else {'FAIL'} )]" -ForegroundColor $(if ($suitePass) {'Green'} else {'Red'})

# ─── Compare to baseline ───────────────────────────────────────────────────────
$delta = $null
if ($null -ne $baseline -and $null -ne $suiteScore) {
    Write-Step "Comparing to baseline (suite score: $($baseline.suite_score))"
    $delta = [math]::Round($suiteScore - $baseline.suite_score, 2)
    $regDelta = Get-OrDefault $configJson.aggregation.max_regression_delta 0.3

    if ($delta -lt -$regDelta) {
        Write-Fail "REGRESSION: suite score dropped by $([math]::Abs($delta)) (threshold: $regDelta). Blocking instruction update."
    } elseif ($delta -lt 0) {
        Write-Warn "Minor regression: $delta. Within tolerance."
    } else {
        Write-Ok "No regression. Delta: +$delta"
    }
}

# ─── Emit report ──────────────────────────────────────────────────────────────
Write-Step "Writing report to $ReportFile"

$reportLines = @(
    "# Benchmark Run Report",
    "",
    "- **Run ID**: $RunTs",
    "- **Model**: $(if ($Model) { $Model } else { $configJson.defaults.model })",
    "- **Suite Score**: $suiteScore / 10 - $(if ($suitePass) {'PASS'} else {'FAIL'})",
    "- **Baseline Delta**: $(if ($null -ne $delta) { $delta } else { 'no baseline' })",
    "",
    "## Task Results",
    "",
    "| Task | Score | AIU | Credits | Out Tok | Files | LOC | AIU/LOC | Wall(s) | Passed |",
    "|------|-------|-----|---------|---------|-------|-----|---------|---------|--------|"
)

foreach ($task in $tasks) {
    $r = $results[$task.id]
    $reportLines += "| $($task.id) | $($r.quality_score) | $($r.aiu) | $($r.premium_requests) | $($r.output_tokens) | $($r.files_modified) | $($r.lines_added) | $($r.aiu_per_loc) | $($r.wall_seconds) | $(if ($r.passed) {'PASS'} else {'FAIL'}) |"
}

# ── Consumption summary: AIU per outcome + ranked top consumers ──
$aiuResults   = @($results.Values | Where-Object { $null -ne $_.aiu })
$totalAiu     = if ($aiuResults.Count -gt 0) { ($aiuResults | Measure-Object -Property aiu -Sum).Sum } else { $null }
$totalCredits = if ($aiuResults.Count -gt 0) { ($aiuResults | Measure-Object -Property premium_requests -Sum).Sum } else { $null }
$passedCount  = @($results.Values | Where-Object { $_.passed }).Count
$taskCount    = @($tasks).Count
$aiuPerDone   = if ($passedCount -gt 0 -and $null -ne $totalAiu) { [math]::Round($totalAiu / $passedCount, 3) } else { $null }
$reportLines += @(
    "",
    "## Consumption (AIU)",
    "",
    "- **Total AIU**: $totalAiu",
    "- **Total credits (premium requests)**: $totalCredits",
    "- **Tasks completed (passed)**: $passedCount / $taskCount",
    "- **AIU per completed task**: $aiuPerDone",
    "",
    "### Top consumers (ranked by AIU)",
    "",
    "| Rank | Task | AIU | AIU/LOC | Score | Passed |",
    "|------|------|-----|---------|-------|--------|"
)
$rank = 0
foreach ($r in @($aiuResults | Sort-Object -Property aiu -Descending)) {
    $rank++
    $reportLines += "| $rank | $($r.task_id) | $($r.aiu) | $($r.aiu_per_loc) | $($r.quality_score) | $(if ($r.passed) {'PASS'} else {'FAIL'}) |"
}

$reportLines += @("", "_Generated by run-benchmarks.ps1 at $($RunTs)_")
$reportLines | Set-Content -Path $ReportFile -Encoding UTF8
Write-Ok "Report written"

# ─── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Run artefacts: $RunDir" -ForegroundColor Gray
Write-Host "Report:        $ReportFile" -ForegroundColor Gray
Write-Host ""
if (-not $suitePass) { exit 1 }
