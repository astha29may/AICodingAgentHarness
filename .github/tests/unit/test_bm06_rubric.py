from pathlib import Path

import yaml

ALLOWED_DIMENSIONS = {"recall", "usefulness", "contamination", "staleness", "token-cost"}
ALLOWED_CHECKS = {"file-exists", "regex", "custom-script", "llm-judge", "json-schema"}


def _load_bm06(repo_root: Path) -> dict:
    path = repo_root / "benchmarks" / "tasks" / "BM-06-memory-recall.yaml"
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def test_every_criterion_has_allowed_dimension(repo_root: Path):
    rubric = _load_bm06(repo_root)["evaluation"]["rubric"]
    for crit in rubric:
        assert crit.get("dimension") in ALLOWED_DIMENSIONS, crit


def test_all_five_dimensions_present(repo_root: Path):
    rubric = _load_bm06(repo_root)["evaluation"]["rubric"]
    dimensions = {crit.get("dimension") for crit in rubric}
    assert ALLOWED_DIMENSIONS <= dimensions


def test_each_criterion_has_valid_check_and_numeric_weight(repo_root: Path):
    rubric = _load_bm06(repo_root)["evaluation"]["rubric"]
    for crit in rubric:
        assert crit.get("check") in ALLOWED_CHECKS, crit
        assert isinstance(crit.get("weight"), (int, float)), crit
        assert crit["weight"] > 0, crit


def test_contamination_case_references_two_distinct_fingerprints(repo_root: Path):
    inline = _load_bm06(repo_root)["fixtures"]["inline"]
    assert "other_repo" in inline
    corpus = "\n".join(str(v) for v in inline.values())
    assert "AICodingAgentHarness" in corpus
    assert "PaymentGatewayService" in corpus


def test_contamination_criterion_present(repo_root: Path):
    rubric = _load_bm06(repo_root)["evaluation"]["rubric"]
    contamination = [c for c in rubric if c.get("dimension") == "contamination"]
    assert contamination


def test_pass_threshold_override_retained(repo_root: Path):
    evaluation = _load_bm06(repo_root)["evaluation"]
    assert evaluation["pass_threshold_override"] == 8.0
