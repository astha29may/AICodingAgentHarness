# Harness — Testing

> How the **harness's own** code is tested. Test guidance for a built project is generated into that
> project's top-level `docs/testing.md`.

## Test suite
Harness unit/integration tests live in [.github/tests/](../tests/) (pytest). They cover the memory
materializer/curation, the fingerprint module, agent-spec invariants, and benchmark parsing.

```powershell
& "$env:LOCALAPPDATA\anaconda3\python.exe" -m pytest .github/tests -q
```

`.github/tests/conftest.py` puts `src/` and `.github/lib/` on `sys.path`, so harness library imports
(e.g. `memory.fingerprint`) resolve without installing a package.

## Quality gates (run on every changed `.py`)
Deterministic gates under [benchmarks/scripts/](../../benchmarks/scripts/):

| Gate | Command | Limit |
| --- | --- | --- |
| Complexity + length | `check-complexity.py <file>` | CC ≤ 8/func, ≤ 30 lines/func |
| Duplication | `check-duplication.py <file>` | ratio ≤ 0.05 |
| LOC ceiling | `check-loc.py --ceiling 200 <file>` | ≤ 200 LOC |

```powershell
$py = "$env:LOCALAPPDATA\anaconda3\python.exe"
& $py benchmarks\scripts\check-complexity.py <file>
& $py benchmarks\scripts\check-duplication.py <file>
& $py benchmarks\scripts\check-loc.py --ceiling 200 <file>
```

## Conventions
- Tests are fast, offline, and deterministic — no network, no deploys.
- When editing a harness `.py`, run the three gates + the full pytest suite before handoff.
- The duplication checker over-flags tiny look-alike functions; consolidate/inline them to stay under 0.05.
