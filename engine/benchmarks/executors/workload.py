"""The workload every executor runs — the same envelopes through the same ``run_envelope``.

Three task types stand in for the engine's, chosen for the shape of their wait
rather than their logic, so the executors are compared on dispatch and recovery
and not on the work:

| Task type | Stands in for | Body |
|---|---|---|
| ``bench.graph_query`` | a ``execute_graph_query`` lane | 50 ms of I/O wait, then a 2 000-row JSON encode |
| ``bench.llm_step`` | an LLM call | 1 s of I/O wait |
| ``bench.noop`` | nothing — dispatch overhead alone | returns |

No graph database and no model provider is touched. Every finished envelope
writes one ledger row keyed by its **idempotency key**; a second write of the
same key is a duplicate execution and lands in ``dups`` instead.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from types import SimpleNamespace

import asyncpg

# The executors' own dependencies may pin an OpenTelemetry the engine's extra does not match.
os.environ.setdefault("INVANA_TELEMETRY_ENABLED", "false")
os.environ.setdefault("INVANA_LOG_LEVEL", "WARNING")

from invana.plugins.envelope import TaskEnvelope
from invana.plugins.sdk.context import Out
from invana.plugins.worker import run_envelope

PG = os.environ.get("BENCH_PG", "postgresql://invana_user:change_this_password@localhost:5432/invana_bench")
REDIS = os.environ.get("BENCH_REDIS", "redis://:myredissecret@127.0.0.1:6379/15")

SCHEMA = """
create table if not exists ledger (
    idem text primary key, scenario text, kind text,
    enqueued double precision, started double precision, finished double precision, pid int
);
create table if not exists dups (idem text, scenario text, pid int, at double precision);
"""


async def _graph_query(ctx, v) -> Out:
    await asyncio.sleep(0.05)
    rows = [{"code": f"A{i}", "runway": i * 3} for i in range(2000)]
    return Out(detail=f"{len(json.dumps(rows))} bytes", output={"rows": len(rows)})


async def _llm_step(ctx, v) -> Out:
    await asyncio.sleep(1.0)
    return Out(detail="answered", output={"tokens_out": 120})


async def _noop(ctx, v) -> Out:
    return Out(detail="ok")


TASKS = {"bench.graph_query": _graph_query, "bench.llm_step": _llm_step, "bench.noop": _noop}


class BenchContexts:
    """No run world to rebuild: the bench task types read only the envelope."""

    @asynccontextmanager
    async def open(self, envelope: TaskEnvelope):
        yield SimpleNamespace(idempotency_key=None, step=SimpleNamespace(args=envelope.args)), None


_pools: dict[int, asyncpg.Pool] = {}


async def _pool() -> asyncpg.Pool:
    loop = id(asyncio.get_running_loop())
    if loop not in _pools:
        _pools[loop] = await asyncpg.create_pool(PG, min_size=1, max_size=2)
    return _pools[loop]


async def execute(wire: str) -> None:
    """What every executor's task calls: one envelope, then one ledger row."""
    env = TaskEnvelope.from_json(wire)
    started = time.time()
    await run_envelope(env, contexts=BenchContexts(), resolve=lambda e: TASKS.get(e.key))
    finished = time.time()
    pool = await _pool()
    wrote = await pool.fetchval(
        "insert into ledger values ($1,$2,$3,$4,$5,$6,$7) on conflict (idem) do nothing returning idem",
        env.idempotency_key,
        env.args["scenario"],
        env.key,
        env.args["enqueued"],
        started,
        finished,
        os.getpid(),
    )
    if wrote is None:
        await pool.execute(
            "insert into dups values ($1,$2,$3,$4)", env.idempotency_key, env.args["scenario"], os.getpid(), finished
        )


def envelopes(scenario: str, kinds: list[str]) -> list[str]:
    """One envelope per task, stamped with its scenario; ``enqueued`` is filled at send time."""
    return [
        TaskEnvelope(
            run_id=scenario,
            node_id=f"n{i}",
            attempt=1,
            plugin="bench@1.0.0",
            task=f"{kind}@1.0.0",
            args={"scenario": scenario},
        ).to_json()
        for i, kind in enumerate(kinds)
    ]


def stamp(wire: str) -> str:
    """Set ``enqueued`` to now, just before the envelope is handed to the executor."""
    data = json.loads(wire)
    data["args"]["enqueued"] = time.time()
    return json.dumps(data)
