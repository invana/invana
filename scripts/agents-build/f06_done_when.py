"""F06's done-when, end to end: a worker with no database joins with a join token and runs a tool step.

1. Signs in to the engine (``INVANA_ENGINE_URL``, default ``http://localhost:8210``,
   which must run ``INVANA_EXECUTOR=procrastinate``) as an install admin.
2. Makes the pool ``done-when`` (labels ``cpu``) unless it exists and mints a join token for it.
3. Starts ``invana worker --engine … --token … --pool done-when`` as a separate process whose
   ``INVANA_DATABASE_URL`` points nowhere — the worker can only reach the engine over HTTP.
4. Defers a ``web.read_url`` envelope on ``tools.cpu`` — what the engine's executor does for a
   tool step — and waits for the outcome the worker returns through the gateway.
5. Drains the worker and prints what it read.

Run from the repo root, with the engine on 8210:

    uv run --directory engine python ../scripts/agents-build/f06_done_when.py
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
import uuid

import httpx

import invana.apps.annotations.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.graphs.models  # noqa: F401
import invana.apps.iam.models  # noqa: F401
from invana.core.db import create_db_engine, create_session_factory
from invana.plugins import queue
from invana.plugins.envelope import TaskEnvelope

ENGINE = os.environ.get("INVANA_ENGINE_URL", "http://localhost:8210")
USER = os.environ.get("INVANA_MIGRATION_USER", "admin")
PASSWORD = os.environ.get("INVANA_MIGRATION_PASSWORD", "change_me_please")
POOL = "done-when"
URL = "https://example.com/"


async def main() -> None:
    async with httpx.AsyncClient(base_url=ENGINE, timeout=30) as http:
        signed = await http.post("/api/v1/auth/login", json={"identifier": USER, "password": PASSWORD})
        signed.raise_for_status()
        http.headers["Authorization"] = f"Bearer {signed.json()['access_token']}"
        made = await http.post("/api/v1/workers/pools", json={"name": POOL, "labels": ["cpu"], "slots_per_worker": 2})
        pool = made.json() if made.status_code == 201 else (await http.get(f"/api/v1/workers/pools/{POOL}")).json()
        minted = await http.post("/api/v1/workers/join-tokens", json={"pool_id": pool["id"], "cap": 1})
        minted.raise_for_status()
        token = minted.json()

    env = {**os.environ, "INVANA_DATABASE_URL": "postgresql+asyncpg://nobody:nothing@127.0.0.1:1/none"}
    worker = subprocess.Popen(
        ["uv", "run", "invana", "worker", "--engine", ENGINE, "--token", token["token"], "--pool", POOL],
        env=env,
    )
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    envelope = TaskEnvelope(
        run_id=str(uuid.uuid4()),
        node_id=str(uuid.uuid4()),
        attempt=1,
        plugin="invana.tools.web",
        task="web.read_url",
        args={"url": URL},
    )
    try:
        await queue.defer(envelope, queue_name="tools.cpu")
        out = await queue.await_outcome(envelope, queue_name="tools.cpu", session_factory=factory, timeout_s=90)
        print("the worker read", URL, "→", (out.output or {}).get("title"), "·", out.detail)
        async with httpx.AsyncClient(base_url=ENGINE, timeout=30) as http:
            http.headers["Authorization"] = f"Bearer {signed.json()['access_token']}"
            status = (await http.get(f"/api/v1/workers/join-tokens/{token['id']}/status")).json()
            print("joined as", status.get("worker"), "·", [(c["key"], c["state"]) for c in status["checks"]])
            if status.get("worker"):
                await http.post(f"/api/v1/workers/workers/{status['worker']}/drain")
    finally:
        await queue.close()
        await engine.dispose()
        try:
            worker.wait(timeout=20)
        except subprocess.TimeoutExpired:
            worker.terminate()
    sys.exit(0)


if __name__ == "__main__":
    asyncio.run(main())
