#!/usr/bin/env python3
"""Collect test results into gan-harness/test-results.json for the dashboard Tests tab.

Reads one or more JUnit XML reports (pytest ``--junitxml``, vitest ``--reporter=junit``) and writes a
flat ``{file, name, result, message}`` list keyed the way the dashboard joins them (repo-relative
file path + test function/title). With no ``--junit`` given, it runs pytest to produce a report.
Grounded: results come from a real run, not guesses; parametrized cases aggregate (any failure wins).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "gan-harness" / "test-results.json"


def _classname_to_file(classname: str, suite_file: str | None) -> str:
    if suite_file:
        return suite_file.replace("\\", "/")
    if "/" in classname or classname.endswith((".py", ".ts", ".tsx", ".js", ".jsx")):
        return classname.replace("\\", "/")
    parts = classname.split(".")
    idx = None
    for i, p in enumerate(parts):
        if p.startswith("test_") or p.endswith("_test"):
            idx = i
    if idx is None:
        idx = len(parts) - 1
    return "/".join(parts[: idx + 1]) + ".py"


def _base_name(name: str) -> str:
    return re.sub(r"\[.*\]$", "", name).strip()  # strip pytest parametrization suffix


def parse_junit(path: Path) -> dict:
    """Return {(file, name): {result, message}} aggregated so any failure wins."""
    out: dict = {}
    root = ET.parse(path).getroot()
    for suite in root.iter("testsuite"):
        suite_file = suite.get("file")
        for tc in suite.iter("testcase"):
            file = _classname_to_file(tc.get("classname", ""), tc.get("file") or suite_file)
            name = _base_name(tc.get("name", ""))
            failure = tc.find("failure")
            error = tc.find("error")
            skipped = tc.find("skipped")
            if failure is not None or error is not None:
                node = failure if failure is not None else error
                msg = (node.get("message") or (node.text or "")).strip()
                result = "failed"
                message = msg.splitlines()[0][:300] if msg else "test failed"
            elif skipped is not None:
                result, message = "not-run", ""
            else:
                result, message = "passed", ""
            key = (file, name)
            prev = out.get(key)
            if prev is None or result == "failed" or (result == "passed" and prev["result"] == "not-run"):
                out[key] = {"result": result, "message": message}
    return out


def run_pytest(junit_path: Path) -> None:
    subprocess.run(
        [sys.executable, "-m", "pytest", f"--junitxml={junit_path}", "-q"],
        cwd=ROOT,
        check=False,
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Collect JUnit results into gan-harness/test-results.json")
    parser.add_argument("--junit", action="append", default=[], help="path to a JUnit XML file (repeatable)")
    parser.add_argument("--out", default=str(OUT))
    args = parser.parse_args(argv)

    reports = [Path(p) for p in args.junit]
    if not reports:
        tmp = Path(tempfile.gettempdir()) / "harness-junit.xml"
        run_pytest(tmp)
        reports = [tmp]

    merged: dict = {}
    for report in reports:
        if report.exists():
            merged.update(parse_junit(report))

    cases = [
        {"file": f, "name": n, "result": v["result"], "message": v["message"]}
        for (f, n), v in sorted(merged.items())
    ]
    Path(args.out).write_text(json.dumps({"generated": date.today().isoformat(), "cases": cases}, indent=2) + "\n", encoding="utf-8")
    passed = sum(1 for c in cases if c["result"] == "passed")
    failed = sum(1 for c in cases if c["result"] == "failed")
    print(f"wrote {args.out}: {len(cases)} cases ({passed} passed, {failed} failed)")


if __name__ == "__main__":
    main()
