"""Workers: a worker joins a pool, leases a deferred tool envelope, returns its outcome, is lost and drained.

Real Postgres and real procrastinate; the worker is the real :class:`RemoteWorker`
dialling the app over an ASGI transport, so nothing in the loop is stood in for.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from invana.core.auth.models import PersonalAccessToken
from invana.plugins import queue
from invana.plugins.envelope import TaskEnvelope
from invana.plugins.gateway import GatewaySweep
from invana.plugins.remote import RemoteWorker
from invana.plugins.sdk.errors import TaskFailure

pytestmark = pytest.mark.asyncio


def _envelope() -> TaskEnvelope:
    # web.read_url refuses an empty url, so the step fails with `blocked` and touches no network.
    return TaskEnvelope(
        run_id=str(uuid.uuid4()), node_id=str(uuid.uuid4()), attempt=1, plugin="invana.tools.web", task="web.read_url"
    )


async def _pool_and_token(client, label: str, **token) -> tuple[dict, dict]:
    made = await client.post(
        "/api/v1/workers/pools", json={"name": f"p-{label}", "labels": [label], "runs_on": "python"}
    )
    assert made.status_code == 201, made.text
    pool = made.json()
    minted = await client.post("/api/v1/workers/join-tokens", json={"pool_id": pool["id"], **token})
    assert minted.status_code == 201, minted.text
    return pool, minted.json()


async def _join(client, pool: dict, token: dict, **body):
    return await client.post(
        "/api/v1/workers/join",
        json={"pool": pool["name"], **body},
        headers={"Authorization": f"Bearer {token['token']}"},
    )


async def _until(check, *, seconds: float = 15):
    deadline = asyncio.get_running_loop().time() + seconds
    while asyncio.get_running_loop().time() < deadline:
        found = await check()
        if found:
            return found
        await asyncio.sleep(0.1)
    raise AssertionError("timed out waiting")


async def test_a_worker_joins_leases_a_deferred_step_and_returns_its_outcome(client, app, session_factory, label):
    pool, token = await _pool_and_token(client, label)
    assert token["token"].startswith("invana_join_") and token["display"].endswith(token["token"][-4:])

    envelope = _envelope()
    await queue.defer(envelope, queue_name=f"tools.{label}")

    transport = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    worker = RemoteWorker(engine="http://test", token=token["token"], pool=pool["name"], slots=2, http=transport)
    running = asyncio.create_task(worker.run())
    try:
        # The outcome crosses the queue and is raised again, as the inline executor would have.
        with pytest.raises(TaskFailure) as raised:
            await queue.await_outcome(
                envelope, queue_name=f"tools.{label}", session_factory=session_factory, timeout_s=20
            )
        assert raised.value.cls == "blocked"

        listed = (await client.get("/api/v1/workers/workers")).json()
        [row] = listed["items"]
        assert row["name"] == f"w-p-{label}-01" and row["slots"] == 2 and row["state"] in ("idle", "busy")
        assert row["heartbeat_s"] is not None and listed["counts"]["all"] == 1

        detail = (await client.get(f"/api/v1/workers/workers/{row['name']}")).json()
        assert detail["steps_1h"] == 1 and detail["failed_1h"] == 1 and detail["p95_ms"] is not None

        # The engine stores the numbers; the Pools tab reads them back.
        assert await GatewaySweep(session_factory).write_stats() == 1
        pools = (await client.get("/api/v1/workers/pools")).json()["items"]
        assert (pools[0]["workers"], pools[0]["slots"], pools[0]["state"]) == (1, 2, "healthy")
        status = (await client.get(f"/api/v1/workers/join-tokens/{token['id']}/status")).json()
        assert {c["key"]: c["state"] for c in status["checks"]}["token"] == "ok"

        # Drain: it finishes what it holds, reports stopped, and the process ends.
        assert (await client.post(f"/api/v1/workers/workers/{row['id']}/drain")).status_code == 204
        await asyncio.wait_for(running, 30)
        stopped = (await client.get(f"/api/v1/workers/workers/{row['id']}")).json()
        assert stopped["state"] == "stopped"
    finally:
        running.cancel()
        await asyncio.gather(running, return_exceptions=True)
        await transport.aclose()


async def test_a_join_is_refused_for_an_expired_token_a_spent_token_and_labels_outside_the_pool(
    client, session_factory, label
):
    pool, token = await _pool_and_token(client, label, cap=1)

    outside = await _join(client, pool, token, labels=["gpu-" + label])
    assert outside.status_code == 422 and "gpu-" + label in outside.json()["detail"]

    assert (await _join(client, pool, token, labels=[label])).status_code == 201
    spent = await _join(client, pool, token)
    assert spent.status_code == 422 and "admitted the 1 workers" in spent.json()["detail"]

    _, old = await _pool_and_token_for(client, pool)
    async with session_factory() as s:
        await s.execute(
            update(PersonalAccessToken)
            .where(PersonalAccessToken.id == old["id"])
            .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        await s.commit()
    expired = await _join(client, pool, old)
    assert expired.status_code == 401 and "expired" in expired.json()["detail"]


async def _pool_and_token_for(client, pool: dict) -> tuple[dict, dict]:
    minted = await client.post("/api/v1/workers/join-tokens", json={"pool_id": pool["id"], "name": "second"})
    assert minted.status_code == 201, minted.text
    return pool, minted.json()


async def test_only_an_install_admin_adds_pools_and_a_join_token_opens_no_other_route(app, client, anonymous, people):
    client.as_(people["member"])
    refused = await client.post("/api/v1/workers/pools", json={"name": "nope"})
    assert refused.status_code == 403 and "Install admins add and scale workers" in refused.json()["detail"]
    assert (await client.get("/api/v1/workers/pools")).status_code == 200

    app.dependency_overrides.clear()  # real auth from here
    stray = await anonymous.get("/api/v1/workers/pools", headers={"Authorization": "Bearer invana_join_abc"})
    assert stray.status_code == 401 and stray.json()["detail"] == "A join token only joins a worker to its pool."


async def test_a_lost_worker_has_its_step_redelivered_with_the_same_key(client, session_factory, label):
    pool, token = await _pool_and_token(client, label)
    joined = (await _join(client, pool, token)).json()
    auth = {"Authorization": f"Bearer {joined['credential']}"}

    envelope = _envelope()
    await queue.defer(envelope, queue_name=f"tools.{label}")
    leased = await client.post("/api/v1/workers/lease", json={"free": 1}, headers=auth)
    assert leased.status_code == 200
    [lease] = leased.json()["leases"]
    assert TaskEnvelope.from_json(lease["envelope"]).idempotency_key == envelope.idempotency_key

    # Thirty-one silent seconds later the sweep loses the worker and puts its step back on the queue.
    sweep = GatewaySweep(session_factory)
    assert await sweep.sweep_lost(now=datetime.now(UTC) + timedelta(seconds=31)) == 1

    events = (await client.get("/api/v1/workers/events")).json()["items"]
    [lost] = [e for e in events if e["change"] == "lost"]
    assert "1 steps redelivered" in lost["why"] and lost["change_text"].endswith("lost")

    jobs = await (await queue.job_manager()).list_jobs_async(queue=f"tools.{label}", status="todo")
    [again] = list(jobs)
    assert TaskEnvelope.from_json(again.task_kwargs["envelope"]).idempotency_key == envelope.idempotency_key
    row = (await client.get(f"/api/v1/workers/workers/{joined['worker_id']}")).json()
    assert row["state"] == "lost" and row["note"] == "1 steps redelivered"
