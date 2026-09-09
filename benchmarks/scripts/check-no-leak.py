"""
benchmarks/scripts/check-no-leak.py
Deterministic cross-repo contamination check for BM-06 (memory-recall).

Scans every file in the given workdir corpus and exits non-zero if any
forbidden other-repo fact leaked into this repo's recall answers. This proves
repo-scoped fingerprinting blocks memory leakage between two distinct solution
fingerprints (AICodingAgentHarness vs PaymentGatewayService).

Usage:
    python benchmarks/scripts/check-no-leak.py <workdir>
"""
import json
import sys
from pathlib import Path

# Facts owned by the OTHER repo fingerprint (PaymentGatewayService). If any of
# these appear in AICodingAgentHarness recall output, scoping has failed.
FORBIDDEN = ["PaymentGatewayService", "mistral-large-2411"]


def _corpus(workdir: Path) -> str:
    parts = []
    for path in sorted(workdir.rglob("*")):
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(parts)


def _find_leaks(corpus: str) -> list:
    return [marker for marker in FORBIDDEN if marker in corpus]


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: check-no-leak.py <workdir>", file=sys.stderr)
        return 2
    leaks = _find_leaks(_corpus(Path(sys.argv[1])))
    print(json.dumps({"metric": "cross_repo_leaks", "leaks": leaks, "passed": not leaks}))
    return 1 if leaks else 0


if __name__ == "__main__":
    sys.exit(main())
