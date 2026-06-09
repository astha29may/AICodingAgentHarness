# copilotscripts/

Scratch space for **throwaway / intermediate scripts** that agents create to perform a one-off
task (parsing a file, a quick data probe, a migration dry-run, etc.).

Rules:
- This folder is **git-ignored** — nothing here is committed except this README and `.gitkeep`.
- It is recreated on every new repo setup so agents always have a place to write scratch scripts.
- Never put production code, tests, infra, or deliverables here — those belong in `src/`, `tests/`,
  `infra/`, or `output/`.
- Treat anything here as disposable; it may be deleted at any time.
