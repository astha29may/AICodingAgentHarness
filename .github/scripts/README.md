# Scripts

Operational and helper scripts live here. Reference them from the relevant `.github/docs/` files.

## render-diagrams.ps1
Renders every Mermaid `*.mmd` source under `.github/docs/diagrams/` to a PNG next to it, so docs embed
images (Mermaid previews are unreliable). Run after editing any diagram source:

```powershell
powershell -ExecutionPolicy Bypass -File .github/scripts/render-diagrams.ps1
```

Requires Node.js (uses `npx @mermaid-js/mermaid-cli`). Commit the updated `.png` next to its `.mmd`.
