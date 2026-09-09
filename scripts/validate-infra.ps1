#requires -Version 5.1
<#
.SYNOPSIS
    Static validation for the ConverseHub pilot IaC (task T13). NEVER deploys.

.DESCRIPTION
    1. If a Bicep CLI is available (az bicep or standalone bicep), runs `build` + `lint` on
       infra/main.bicep for a syntax/lint gate. If absent, prints a clear notice and continues
       with the static policy checks only.
    2. Runs the pytest governance-policy suite (tests/infra) which reads the Bicep as text and
       asserts the pilot gate decisions without any Azure call.

    Exits non-zero ONLY on a real policy (or bicep lint/build) failure. No resource is provisioned,
    no secret is created, and no Azure control-plane deployment is performed.
#>

[CmdletBinding()]
param(
    [string]$InfraRoot,
    [string]$TestPath
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $InfraRoot) { $InfraRoot = (Resolve-Path (Join-Path $scriptDir '..\infra')).Path }
if (-not $TestPath) { $TestPath = (Resolve-Path (Join-Path $scriptDir '..\tests\infra')).Path }
$mainBicep = Join-Path $InfraRoot 'main.bicep'

function Resolve-Python {
    if ($env:LOCALAPPDATA) {
        $anaconda = Join-Path $env:LOCALAPPDATA 'anaconda3/python.exe'
        if (Test-Path $anaconda) { return $anaconda }
    }
    foreach ($candidate in @('python', 'python3', 'py')) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

Write-Host '=== ConverseHub pilot IaC validation (static, non-deployed) ==='

# Native CLIs (az/bicep) emit upgrade notices on stderr; under 'Stop' that would be treated as a
# terminating error. Gate on exit codes explicitly from here on.
$ErrorActionPreference = 'Continue'

# --- Step 1: optional Bicep build/lint -------------------------------------------------
$bicepExit = 0
$bicepCmd = Get-Command 'bicep' -ErrorAction SilentlyContinue
$azCmd = Get-Command 'az' -ErrorAction SilentlyContinue

if ($bicepCmd) {
    Write-Host "[bicep] standalone CLI found: running build + lint on main.bicep"
    $bicepOut = & bicep build $mainBicep --stdout 2>&1
    $bicepExit = $LASTEXITCODE
    $bicepOut | Where-Object { $_ -match '(?i)error' } | ForEach-Object { Write-Host $_ }
}
elseif ($azCmd) {
    Write-Host "[bicep] using 'az bicep build' on main.bicep"
    $bicepOut = & az bicep build --file $mainBicep --stdout 2>&1
    $bicepExit = $LASTEXITCODE
    $bicepOut | Where-Object { $_ -match '(?i)error' } | ForEach-Object { Write-Host $_ }
}
else {
    Write-Host "[bicep] bicep CLI not found - running static policy checks only"
}

if ($bicepExit -ne 0) {
    Write-Error "[bicep] build/lint reported a failure (exit $bicepExit)"
    exit $bicepExit
}

# --- Step 2: static governance-policy tests --------------------------------------------
$python = Resolve-Python
if (-not $python) {
    Write-Error 'Python interpreter not found; cannot run policy tests.'
    exit 1
}

Write-Host "[policy] running governance-policy suite: $TestPath"
& $python -m pytest $TestPath -q 2>&1 | ForEach-Object { Write-Host $_ }
$policyExit = $LASTEXITCODE

if ($policyExit -ne 0) {
    Write-Error "[policy] governance-policy checks FAILED (exit $policyExit)"
    exit $policyExit
}

Write-Host '=== Validation PASSED (no deployment, no Azure call, no secret created) ==='
exit 0
