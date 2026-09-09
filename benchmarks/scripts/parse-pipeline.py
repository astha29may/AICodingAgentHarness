"""
benchmarks/scripts/parse-pipeline.py
Parse the ConverseHub pipeline definition for run-benchmarks.ps1 -Pipeline: substitute {{problem}}
into each stage prompt, write a per-stage task file (consumed by score-task.py), and emit a JSON
manifest of stages (id, agent, prompt, task_file).

Usage:
    python benchmarks/scripts/parse-pipeline.py --pipeline <converhub.yaml> --stagedir <dir>
"""
import argparse
import json
import os
from pathlib import Path

import yaml


def _write_task(task_id, expected_outputs, evaluation, stagedir: str) -> str:
    task = {"id": task_id, "expected_outputs": expected_outputs or [], "evaluation": evaluation or {}}
    path = os.path.join(stagedir, str(task_id) + ".yaml")
    Path(path).write_text(yaml.safe_dump(task), encoding="utf-8")
    return path


def build(pipeline: str, stagedir: str) -> dict:
    doc = yaml.safe_load(Path(pipeline).read_text(encoding="utf-8")) or {}
    problem = doc.get("problem", "")
    Path(stagedir).mkdir(parents=True, exist_ok=True)
    stages = []
    for st in doc.get("stages", []):
        stages.append({"id": st.get("id"), "agent": st.get("agent"),
                       "prompt": (st.get("prompt") or "").replace("{{problem}}", problem),
                       "task_file": _write_task(st.get("id"), st.get("expected_outputs"),
                                                st.get("evaluation"), stagedir)})
    bb = doc.get("bare_build") or {}
    bare = {"prompt": (bb.get("prompt") or "").replace("{{problem}}", problem),
            "task_file": _write_task("BUILD", [], bb.get("evaluation"), stagedir)}
    return {"project": doc.get("project"), "stages": stages, "bare": bare}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Parse the ConverseHub pipeline definition.")
    parser.add_argument("--pipeline", required=True)
    parser.add_argument("--stagedir", required=True)
    args = parser.parse_args(argv)
    print(json.dumps(build(args.pipeline, args.stagedir)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
