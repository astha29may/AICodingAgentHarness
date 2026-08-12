import importlib.util
import json
from pathlib import Path

_REQUIRED = {
    "id", "type", "scope", "descriptor", "content",
    "evidence", "confidence", "version", "supersedes", "lifecycle", "privacy",
}


def _load_migrator(repo_root: Path):
    path = repo_root / "copilotscripts" / "migrate_ledger.py"
    spec = importlib.util.spec_from_file_location("migrate_ledger", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _lines(path: Path) -> list:
    return [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def test_creates_valid_empty_ledger_when_none(repo_root: Path, tmp_path: Path):
    mig = _load_migrator(repo_root)
    ledger = tmp_path / "ledger.jsonl"

    mig.migrate(ledger)

    assert ledger.is_file()
    assert _lines(ledger) == []


def test_migrated_entries_validate_and_run_is_idempotent(repo_root: Path, tmp_path: Path):
    mig = _load_migrator(repo_root)
    ledger = tmp_path / "ledger.jsonl"
    ledger.write_text(
        json.dumps({"id": "mem-x", "descriptor": "a"}) + "\n"
        + json.dumps({"id": "mem-x", "descriptor": "b"}) + "\n"  # duplicate id
        + json.dumps({"descriptor": "c"}) + "\n",                # no id
        encoding="utf-8",
    )

    mig.migrate(ledger)
    first = _lines(ledger)

    for line in first:
        record = json.loads(line)
        assert _REQUIRED <= set(record), f"record missing required keys: {record}"

    ids = [json.loads(line)["id"] for line in first]
    assert len(ids) == len(set(ids)), "migration left duplicate ids"

    backup = ledger.with_name("ledger.jsonl.bak")
    assert backup.is_file(), ".bak was not written before migration"
    backup_before = backup.read_text(encoding="utf-8")

    mig.migrate(ledger)
    second = _lines(ledger)

    assert second == first, "re-running the migration was not idempotent"
    assert backup.read_text(encoding="utf-8") == backup_before, ".bak was not preserved"
