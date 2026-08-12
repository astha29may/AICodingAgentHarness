# Renders every Mermaid (*.mmd) file under .github/docs/diagrams to a PNG next to it.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/render-diagrams.ps1
#   (or, if PowerShell 7+ is installed: pwsh -File scripts/render-diagrams.ps1)
$ErrorActionPreference = "Stop"
$diagramDir = Join-Path $PSScriptRoot "..\.github\docs\diagrams"

Get-ChildItem -Path $diagramDir -Filter *.mmd | ForEach-Object {
    $out = [System.IO.Path]::ChangeExtension($_.FullName, ".png")
    Write-Host "Rendering $($_.Name) -> $([System.IO.Path]::GetFileName($out))"
    npx -y @mermaid-js/mermaid-cli -i $_.FullName -o $out -b white -s 2
}

Write-Host "Done. Commit the updated .png files alongside their .mmd sources."
