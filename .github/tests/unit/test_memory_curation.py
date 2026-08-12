"""Promotion-time curation: conflict override (supersede + conflict_key) and last_confirmed TTL clock."""
import importlib.util
from datetime import date, timedelta
from pathlib import Path


def _load_sync(repo_root: Path):
    path = repo_root / ".github" / "scripts" / "sync-memory.py"
    spec = importlib.util.spec_from_file_location("sync_memory_cur", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _rec(rid, conf=0.9, **extra):
    r = {"id": rid, "descriptor": f"rule {rid}", "privacy": {"redacted": True}, "confidence": conf}
    r.update(extra)
    return r


def test_superseded_record_dropped_at_promotion(repo_root):
    sync = _load_sync(repo_root)
    recs = [_rec("old"), _rec("new", supersedes="old")]
    bullets = sync.dense_bullets(recs, sync.DEFAULT_POLICY)
    assert bullets == ["- rule new"]


def test_conflict_key_keeps_strongest_only(repo_root):
    sync = _load_sync(repo_root)
    recs = [_rec("weak", conf=0.7, conflict_key="tabs-vs-spaces"),
            _rec("strong", conf=0.95, conflict_key="tabs-vs-spaces")]
    bullets = sync.dense_bullets(recs, sync.DEFAULT_POLICY)
    assert bullets == ["- rule strong"]


def test_last_confirmed_keeps_old_rule_fresh(repo_root):
    sync = _load_sync(repo_root)
    old = (date.today() - timedelta(days=90)).isoformat()
    recent = (date.today() - timedelta(days=1)).isoformat()
    rec = _rec("r", lifecycle={"created": old, "status": "active"},
               evidence={"last_confirmed": recent})
    assert sync.dense_bullets([rec], sync.DEFAULT_POLICY) == ["- rule r"]


def test_stale_unconfirmed_rule_is_dropped(repo_root):
    sync = _load_sync(repo_root)
    old = (date.today() - timedelta(days=90)).isoformat()
    rec = _rec("r", lifecycle={"created": old, "status": "active"})
    assert sync.dense_bullets([rec], sync.DEFAULT_POLICY) == []


def test_cold_used_rule_is_evicted(repo_root):
    sync = _load_sync(repo_root)
    cold = (date.today() - timedelta(days=120)).isoformat()
    rec = _rec("r", evidence={"last_used": cold})
    assert sync.dense_bullets([rec], sync.DEFAULT_POLICY) == []


def test_recently_used_rule_is_kept(repo_root):
    sync = _load_sync(repo_root)
    warm = (date.today() - timedelta(days=5)).isoformat()
    rec = _rec("r", evidence={"last_used": warm})
    assert sync.dense_bullets([rec], sync.DEFAULT_POLICY) == ["- rule r"]


def test_stamp_recall_writes_last_used(repo_root, tmp_path):
    sync = _load_sync(repo_root)
    store = tmp_path / ".github" / "memory" / "repo"
    store.mkdir(parents=True)
    (store / "conventions.yaml").write_text(
        "conventions:\n- id: c1\n  descriptor: rule c1\n  privacy: {redacted: true}\n", encoding="utf-8")
    (store / "style.yaml").write_text("style: []\n", encoding="utf-8")
    stamped = sync.stamp_recall(tmp_path, ["c1"], date.today().isoformat())
    assert stamped == 1
    reloaded = sync.load_records(store / "conventions.yaml")
    assert reloaded[0]["evidence"]["last_used"] == date.today().isoformat()
