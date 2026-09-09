"""Gap1: sync-memory enforces the policy caps (top-k, confidence, TTL/status) at materialization."""
import importlib.util
from pathlib import Path


def _load_sync(repo_root: Path):
    path = repo_root / ".github" / "scripts" / "sync-memory.py"
    spec = importlib.util.spec_from_file_location("sync_memory_enf", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _rec(rid, conf=None, status=None):
    r = {"id": rid, "descriptor": f"rule {rid}", "privacy": {"redacted": True}}
    if conf is not None:
        r["confidence"] = conf
    if status is not None:
        r["lifecycle"] = {"status": status}
    return r


def test_caps_to_max_recalled_entries(repo_root):
    sync = _load_sync(repo_root)
    policy = dict(sync.DEFAULT_POLICY, max_recalled_entries=5)
    bullets = sync.dense_bullets([_rec(i, conf=0.9) for i in range(8)], policy)
    assert len(bullets) == 5


def test_drops_deprecated_and_low_confidence(repo_root):
    sync = _load_sync(repo_root)
    recs = [_rec("keep", conf=0.9), _rec("dep", conf=0.99, status="deprecated"), _rec("low", conf=0.3)]
    bullets = sync.dense_bullets(recs, sync.DEFAULT_POLICY)
    assert bullets == ["- rule keep"]


def test_trusted_record_without_confidence_is_kept(repo_root):
    sync = _load_sync(repo_root)
    bullets = sync.dense_bullets([_rec("trusted")], sync.DEFAULT_POLICY)
    assert bullets == ["- rule trusted"]
