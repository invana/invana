#!/usr/bin/env python3
"""Bring the dev stack to the state a phase's gates and reviews need — called from a project's *Setup* table.

| Command | Does |
|---|---|
| ``setup.py stack`` | Starts ``engine`` and ``studio`` with ``docker compose`` when Studio or the engine's ``/health`` does not answer, and waits for both |
| ``setup.py demo-data`` | Reloads ``demos/airways`` into ``admin/airways`` when that Graph is empty, then re-introspects its model — nothing may leave the developer's graph empty |

Each exits 0 when the stack is ready and 1 with the reason otherwise, so a failing step blocks the phase. Settings:
``INVANA_STUDIO_URL`` (``http://localhost:8300``), ``INVANA_ENGINE_URL`` (``http://localhost:8200``) and
``INVANA_DEV_GRAPH_PASSWORD`` (``testpassword``). Re-seeding boards whose data is relative to now is
``demos/agents/reseed.py``, its own Setup row. Standard library only.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[3])
STUDIO_URL = os.environ.get("INVANA_STUDIO_URL", "http://localhost:8300")
ENGINE_URL = os.environ.get("INVANA_ENGINE_URL", "http://localhost:8200")
GRAPH = "admin/airways"
AIRWAYS = [("news-articles", "NewsArticles"), ("twitter", "Twitter"), ("deals", "Deals"), ("air-routes", "AirRoutes")]


def run(cmd: list[str], cwd: Path = ROOT, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, text=True, capture_output=True, check=False)


def answers(url: str) -> bool:
    return run(["curl", "-sf", "-o", "/dev/null", url]).returncode == 0


def stack(wait: int = 180) -> str:
    """Start the dev stack if it is down; '' when Studio and the engine answer."""
    def up() -> bool:
        return answers(STUDIO_URL) and answers(f"{ENGINE_URL}/health")
    if up():
        return ""
    run(["docker", "compose", "up", "-d", "engine", "studio"])
    for _ in range(wait // 5):
        time.sleep(5)
        if up():
            return ""
    return f"the dev stack did not come up ({STUDIO_URL}, {ENGINE_URL}/health)"


def graph_nodes() -> int:
    """Nodes in the developer's graph, or -1 when it cannot be read."""
    res = run(["docker", "exec", "invana-neo4j", "cypher-shell", "-u", "neo4j", "-p",
               os.environ.get("INVANA_DEV_GRAPH_PASSWORD", "testpassword"), "--format", "plain",
               "MATCH (n) RETURN count(n)"])
    last = res.stdout.split()[-1:] if res.returncode == 0 else []
    return int(last[0]) if last and last[0].isdigit() else -1


def demo_data() -> str:
    """Reload demos/airways when the Graph is empty; '' when it holds data."""
    nodes = graph_nodes()
    if nodes > 0:
        return ""
    if nodes < 0:
        return "cannot read the developer's graph (is invana-neo4j running?)"
    print(f"{GRAPH} is empty — reloading demos/airways", flush=True)
    cli = str(ROOT / "engine" / ".venv" / "bin" / "invana")
    # The import writes through the Graph's own connection, never a test database's NEO4J_* settings.
    env = {k: v for k, v in os.environ.items() if not k.startswith("NEO4J_")}
    env["INVANA_TELEMETRY_ENABLED"] = "false"
    for name, model in AIRWAYS:
        res = subprocess.run([cli, "records", "import", "--graph", GRAPH, "--name", name, "--model", model,
                              "--path", f"demos/airways/{name}"], cwd=ROOT, env=env, text=True, capture_output=True, check=False)
        if res.returncode != 0:
            return f"importing {name} failed: {(res.stdout + res.stderr)[-500:]}"
    studio = ROOT / "studio" / "apps" / "studio"
    run(["pnpm", "exec", "playwright", "test", "--project=setup", "--reporter=line"], studio)
    state = json.loads((studio / "e2e" / ".auth" / "user.json").read_text())
    auth = next(i["value"] for o in state["origins"] for i in o["localStorage"] if i["name"] == "invana.auth")
    token = json.loads(auth)["state"]["accessToken"]
    run(["curl", "-sf", "-X", "POST", "-H", f"Authorization: Bearer {token}",
         f"{ENGINE_URL}/api/v1/u/{GRAPH}/connection/introspect"])
    return "" if graph_nodes() > 0 else f"{GRAPH} is still empty after the reload"


def main() -> int:
    steps = {"stack": stack, "demo-data": demo_data}
    if len(sys.argv) != 2 or sys.argv[1] not in steps:
        print(f"usage: setup.py {' | '.join(steps)}", file=sys.stderr)
        return 2
    why = steps[sys.argv[1]]()
    if why:
        print(f"setup {sys.argv[1]}: {why}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
