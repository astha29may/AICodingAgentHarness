import sys
from pathlib import Path

import pytest

_REPO = Path(__file__).resolve().parents[2]
for _p in (_REPO / "src", _REPO / ".github" / "lib"):  # project src, then harness lib (lib wins)
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


BUILD_AGENTS = ["coding-agent", "frontend-engineer", "backend-engineer", "ai-engineer", "data-engineer"]


@pytest.fixture(scope="session")
def build_agents() -> list:
    return BUILD_AGENTS


@pytest.fixture(scope="session")
def read_agent_spec(repo_root: Path):
    def _read(name: str) -> str:
        return (repo_root / ".github" / "agents" / f"{name}.agent.md").read_text(encoding="utf-8")

    return _read
