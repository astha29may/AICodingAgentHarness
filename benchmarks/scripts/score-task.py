"""
benchmarks/scripts/score-task.py
Pure-Python rubric scorer for the harness benchmark runner (C6).

Loads a task YAML, iterates evaluation.rubric, and scores each criterion 0-10:
  - file-exists    : 10 if <workdir>/<check_value> exists and is non-empty.
  - regex          : 10 if check_value matches the task's expected-output corpus.
  - custom-script  : 10 if `python <check_value>` exits 0 (workdir as CWD + argv).
  - llm-judge      : the only non-deterministic check. Excluded from the weighted
                     denominator when --offline or when the copilot CLI is absent.

The weighted quality_score is the weight-weighted mean over included criteria.
The single copilot-facing seam is judge_via_copilot(); tests run fully offline.

Usage:
    python benchmarks/scripts/score-task.py --task <task.yaml> --workdir <dir> [--offline]
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml


def _safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _corpus(task: dict, workdir: Path) -> str:
    outs = task.get("expected_outputs") or []
    named = [workdir / o["path"] for o in outs if isinstance(o, dict) and o.get("path")]
    files = [p for p in named if p.is_file()]
    if not files:
        files = [p for p in sorted(workdir.rglob("*")) if p.is_file()]
    return "\n".join(_safe_read(p) for p in files)


def _check_file_exists(check_value, workdir: Path) -> int:
    target = workdir / (check_value or "")
    return 10 if target.is_file() and target.stat().st_size > 0 else 0


def _check_regex(check_value, corpus: str) -> int:
    if not check_value:
        return 0
    return 10 if re.search(check_value, corpus) else 0


def _check_custom_script(check_value, workdir: Path, repo_root: Path) -> int:
    script = (repo_root / check_value).resolve()
    proc = subprocess.run(
        [sys.executable, str(script), str(workdir)],
        cwd=str(workdir), capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    return 10 if proc.returncode == 0 else 0


def _check_code_build(workdir: Path, repo_root: Path):
    """Deterministic build score (0-10) via check-build.py; included even offline."""
    script = repo_root / "benchmarks" / "scripts" / "check-build.py"
    proc = subprocess.run(
        [sys.executable, str(script), str(workdir)],
        cwd=str(workdir), capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    try:
        data = json.loads((proc.stdout or "").strip().splitlines()[-1])
        return max(0, min(10, round(float(data["score"]))))
    except (ValueError, KeyError, IndexError):
        return None


GATE_FLOOR = 5.0  # skip llm-judge unless deterministic checks reach this weighted score


def _parse_batch(text, n):
    """Parse one `N: score` line per criterion from a single batched judge reply."""
    scores = [None] * n
    for line in (text or "").splitlines():
        m = re.match(r"\s*(\d+)\s*[:.\)\-]\s*(10|[0-9])\b", line)
        if m:
            idx = int(m.group(1)) - 1
            if 0 <= idx < n:
                scores[idx] = int(m.group(2))
    return scores


def judge_batch_via_copilot(criteria: list, corpus: str, workdir: Path):
    """Isolated seam: grade ALL criteria in ONE call so the corpus is sent once, not per criterion."""
    if not shutil.which("powershell"):
        return [None] * len(criteria)
    numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(criteria))
    prompt = ("Grade the OUTPUT against each numbered CRITERION. Reply with ONLY one line per "
              "criterion as `N: score`, score an integer 0-10, nothing else.\nCRITERIA:\n"
              + numbered + "\n\nOUTPUT:\n" + (corpus or "")[:6000]).replace('"', "'")
    env = dict(os.environ, JUDGE_PROMPT=prompt)
    proc = subprocess.run(
        ["powershell", "-NoProfile", "-Command", "& copilot -p $env:JUDGE_PROMPT -s --model auto"],
        cwd=str(workdir), capture_output=True, text=True, encoding="utf-8", errors="replace", env=env,
    )
    return _parse_batch(proc.stdout, len(criteria))


def _judge_result(criterion: dict, score) -> dict:
    return _result(criterion, "llm-judge", score)


def _score_llm(criteria: list, ctx: dict, gate_ok: bool) -> list:
    if not criteria or ctx["offline"] or not gate_ok:
        return [_judge_result(c, None) for c in criteria]
    scores = judge_batch_via_copilot([c.get("criterion", "") for c in criteria], ctx["corpus"], ctx["workdir"])
    return [_judge_result(c, s) for c, s in zip(criteria, scores)]


def _dispatch_check(check, value, criterion: dict, ctx: dict):
    if check == "file-exists":
        return _check_file_exists(value, ctx["workdir"])
    if check == "regex":
        return _check_regex(value, ctx["corpus"])
    if check == "custom-script":
        return _check_custom_script(value, ctx["workdir"], ctx["repo_root"])
    if check == "code-build":
        return _check_code_build(ctx["workdir"], ctx["repo_root"])
    return None


def _result(criterion: dict, check, score) -> dict:
    return {"criterion": criterion.get("criterion"), "check": check, "score": score,
            "included": score is not None, "weight": float(criterion.get("weight", 1.0))}


def score_criterion(criterion: dict, ctx: dict) -> dict:
    check = criterion.get("check")
    try:
        score = _dispatch_check(check, criterion.get("check_value"), criterion, ctx)
    except Exception:
        score = None
    return _result(criterion, check, score)


def score_rubric(rubric: list, ctx: dict) -> list:
    return [score_criterion(c, ctx) for c in rubric]


def compute_quality(results: list):
    included = [r for r in results if r["included"]]
    denom = sum(r["weight"] for r in included)
    if not denom:
        return None
    num = sum(r["score"] * r["weight"] for r in included)
    return round(num / denom, 2)


def _deterministic_only(results: list) -> bool:
    return not any(r["check"] == "llm-judge" and r["included"] for r in results)


def _copilot_available() -> bool:
    return shutil.which("copilot") is not None


def _parse_args():
    parser = argparse.ArgumentParser(description="Score a task workdir against its rubric.")
    parser.add_argument("--task", required=True, help="Path to the task YAML.")
    parser.add_argument("--workdir", required=True, help="Directory holding task outputs.")
    parser.add_argument("--offline", action="store_true", help="Skip llm-judge criteria.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    task = yaml.safe_load(Path(args.task).read_text(encoding="utf-8")) or {}
    workdir = Path(args.workdir).resolve()
    ctx = {
        "workdir": workdir,
        "repo_root": Path(__file__).resolve().parents[2],
        "offline": bool(args.offline) or not _copilot_available(),
        "corpus": _corpus(task, workdir),
    }
    rubric = task.get("evaluation", {}).get("rubric") or []
    det = [score_criterion(c, ctx) for c in rubric if c.get("check") != "llm-judge"]
    det_quality = compute_quality(det)
    gate_ok = det_quality is None or det_quality >= GATE_FLOOR
    llm = _score_llm([c for c in rubric if c.get("check") == "llm-judge"], ctx, gate_ok)
    results = det + llm
    print(json.dumps({
        "task_id": task.get("id"),
        "quality_score": compute_quality(results),
        "criteria": results,
        "llm_gated": bool([c for c in rubric if c.get("check") == "llm-judge"]) and not gate_ok,
        "deterministic_only": _deterministic_only(results),
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
