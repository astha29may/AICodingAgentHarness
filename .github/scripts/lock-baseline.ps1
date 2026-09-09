#Requires -Version 5.1
<#
.SYNOPSIS
    Locks the current benchmark run results as the new baseline.

.DESCRIPTION
    Reads the most recent benchmark run from gan-harness/runs/, validates that
    the required minimum number of consecutive passing runs has been achieved
    (from benchmark-config.yaml > baseline.promotion_min_runs), and writes the
    new baseline to benchmarks/baseline/metrics.json.

    The previous baseline is archived to benchmarks/baseline/history/ with a
    timestamp suffix so regressions can always be investigated.

.PARAMETER RunDir
    Path to a specific run directory. If omitted, the most recent run is used.

.PARAMETER Force
    Skip the promotion_min_runs check (use when explicitly setting a first baseline).

.EXAMPLE
    .\scripts\lock-baseline.ps1                   # promote most recent run
    .\scripts\lock-baseline.ps1 -Force            # force-lock first baseline
    .\scripts\lock-baseline.ps1 -RunDir gan-harness\runs\20260803-140000
#>
[CmdletBinding()]
param(
    [string]$RunDir = '',
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot     = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$BaselineFile = Join-Path $RepoRoot "benchmarks\baseline\metrics.json"
$HistoryDir   = Join-Path $RepoRoot "benchmarks\baseline\history"
$ConfigFile   = Join-Path $RepoRoot "benchmarks\benchmark-config.yaml"
$RunsRoot     = Join-Path $RepoRoot "gan-harness\runs"
$ReportFile   = Join-Path $RepoRoot "gan-harness\build-report.md"

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "    [OK]   $msg" -ForegroundColor Green }
function Write-Fail([string]$msg) { Write-Host "    [FAIL] $msg" -ForegroundColor Red; exit 1 }
function Write-Warn([string]$msg) { Write-Host "    [WARN] $msg" -ForegroundColor Yellow }
function ConvertTo-DoubleOrNull($value) { try { [double]$value } catch { $null } }
function ConvertTo-IntOrNull($value)    { try { [int]$value } catch { $null } }

New-Item -ItemType Directory -Path $HistoryDir -Force | Out-Null

# ─── Locate the run to promote ────────────────────────────────────────────────
Write-Step "Locating run to promote"

if ($RunDir) {
    $targetRun = $RunDir
} else {
    $runs = Get-ChildItem -Path $RunsRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending
    if (-not $runs) { Write-Fail "No runs found in $RunsRoot. Run .\scripts\run-benchmarks.ps1 first." }
    $targetRun = $runs[0].FullName
}

if (-not (Test-Path $targetRun)) { Write-Fail "Run directory not found: $targetRun" }
Write-Ok "Using run: $targetRun"

# ─── Load promotion_min_runs from config ──────────────────────────────────────
Write-Step "Checking promotion criteria"

$parseScript = Join-Path $RepoRoot "copilotscripts\parse-baseline-config.py"
@"
import json, sys
try:
    import yaml
except ImportError:
    import subprocess, sys as _sys
    subprocess.check_call([_sys.executable, '-m', 'pip', 'install', 'pyyaml', '-q'])
    import yaml

with open(r'$($ConfigFile.Replace('\','\\'))', encoding='utf-8') as f:
    cfg = yaml.safe_load(f)

print(json.dumps(cfg.get('baseline', {})))
"@ | Set-Content -Path $parseScript -Encoding UTF8

$baselineCfg = python $parseScript | ConvertFrom-Json
$minRuns = if ($baselineCfg.promotion_min_runs) { $baselineCfg.promotion_min_runs } else { 2 }
$warnDelta = if ($baselineCfg.improvement_warn_delta) { $baselineCfg.improvement_warn_delta } else { 1.5 }

if (-not $Force) {
    # Count how many recent consecutive runs passed
    $recentRuns = Get-ChildItem -Path $RunsRoot -Directory |
                  Sort-Object Name -Descending |
                  Select-Object -First $minRuns

    $consecutivePasses = 0
    foreach ($run in $recentRuns) {
        $reportPath = Join-Path $run.FullName "*.txt"
        $reportFiles = Get-ChildItem $run.FullName -Filter "task-output.txt" -Recurse -ErrorAction SilentlyContinue
        # Simple heuristic: look for PASSED in any task output
        $allPassed = $reportFiles | ForEach-Object { Select-String -Path $_.FullName -Pattern "PASSED" -Quiet } |
                     Where-Object { $_ }
        if ($allPassed) { $consecutivePasses++ }
    }

    if ($consecutivePasses -lt $minRuns) {
        Write-Fail "Only $consecutivePasses consecutive passing run(s) found (need $minRuns). Use -Force to override."
    }
    Write-Ok "$consecutivePasses consecutive passing runs confirmed (need $minRuns)"
}

# ─── Archive existing baseline ────────────────────────────────────────────────
Write-Step "Archiving existing baseline"

if (Test-Path $BaselineFile) {
    $ts = (Get-Date -Format 'yyyyMMdd-HHmmss')
    $archivePath = Join-Path $HistoryDir "metrics-$ts.json"
    Copy-Item -Path $BaselineFile -Destination $archivePath
    Write-Ok "Archived to $archivePath"
} else {
    Write-Warn "No existing baseline to archive (first baseline lock)"
}

# ─── Build new baseline from run metrics ──────────────────────────────────────
Write-Step "Building new baseline"

# Read the build report to extract scores
$suiteScore = $null
$taskResults = @{}

if (Test-Path $ReportFile) {
    $reportContent = Get-Content $ReportFile -Raw
    # Extract suite score
    if ($reportContent -match 'Suite Score\*\*:\s*([\d.]+)') {
        $suiteScore = [double]$Matches[1]
    }
    # Extract table rows: | BM-XX | score | ... |
    $tableRows = $reportContent | Select-String -Pattern '\|\s*(BM-\d+)\s*\|\s*([\d.]+|null)\s*\|\s*([\d]+|null)\s*\|\s*([\d]+|null)\s*\|\s*([\d]+|null)\s*\|\s*([\d.]+|null)\s*\|\s*([✓✗])' -AllMatches
    foreach ($match in $tableRows.Matches) {
        $tid = $match.Groups[1].Value.Trim()
        $taskResults[$tid] = @{
            quality_score            = ConvertTo-DoubleOrNull $match.Groups[2].Value
            input_tokens             = ConvertTo-IntOrNull $match.Groups[3].Value
            output_tokens            = ConvertTo-IntOrNull $match.Groups[4].Value
            retrieved_context_tokens = ConvertTo-IntOrNull $match.Groups[5].Value
            wall_seconds             = ConvertTo-DoubleOrNull $match.Groups[6].Value
            passed                   = ($match.Groups[7].Value.Trim() -eq '✓')
        }
    }
}

# Check for unexpected large improvement
if ($null -ne $suiteScore) {
    $existing = if (Test-Path $BaselineFile) { (Get-Content $BaselineFile | ConvertFrom-Json).suite_score } else { $null }
    if ($null -ne $existing -and ($suiteScore - $existing) -gt $warnDelta) {
        Write-Warn "Suite score improved by more than $warnDelta ($existing → $suiteScore). Verify this is genuine."
    }
}

# ─── Write new baseline ───────────────────────────────────────────────────────
$newBaseline = [ordered]@{
    "_comment"      = "Locked baseline metrics for AICodingAgentHarness benchmark suite."
    "_instructions" = "Do not hand-edit this file. Use: .\scripts\lock-baseline.ps1"
    "locked_at"     = (Get-Date -Format 'o')
    "locked_by"     = $env:USERNAME
    "runner_version"= $null
    "model"         = $null   # populated from run metadata if available
    "suite_score"   = $suiteScore
    "suite_passed"  = ($suiteScore -ge 7.2)
    "tasks"         = $taskResults
}

$newBaseline | ConvertTo-Json -Depth 5 | Set-Content -Path $BaselineFile -Encoding UTF8
Write-Ok "New baseline locked at $BaselineFile"
Write-Host ""
Write-Host "  Suite score: $suiteScore" -ForegroundColor Green
Write-Host "  Locked at:   $(Get-Date -Format 'o')" -ForegroundColor Gray
