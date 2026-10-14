"""procrastinate — jobs in the Postgres the engine already runs.

A worker heartbeats every 2 s. procrastinate does not requeue a dead worker's
jobs by itself: :func:`reap` is the loop the engine would have to run, retrying
any job whose worker has not heartbeated for 10 s.
"""

from __future__ import annotations

import asyncio
import sys

from procrastinate import App, PsycopgConnector
from workload import PG, execute, stamp

app = App(connector=PsycopgConnector(conninfo=PG))

STALLED_AFTER_S = 10


@app.task(name="run_envelope", queue="bench")
async def run_envelope_job(wire: str) -> None:
    await execute(wire)


async def setup() -> None:
    async with app.open_async():
        try:
            await app.schema_manager.apply_schema_async()
        except Exception as exc:  # already applied
            print("schema:", type(exc).__name__)
        await app.connector.execute_query_async("truncate procrastinate_jobs cascade")


async def enqueue(wires: list[str]) -> None:
    async with app.open_async():
        await run_envelope_job.batch_defer_async(*({"wire": stamp(wire)} for wire in wires))


async def reap(stop: asyncio.Event) -> int:
    """Requeue the jobs of workers that stopped heartbeating; returns how many."""
    requeued = 0
    reaper = App(connector=PsycopgConnector(conninfo=PG))
    async with reaper.open_async():
        while not stop.is_set():
            for job in await reaper.job_manager.get_stalled_jobs(seconds_since_heartbeat=STALLED_AFTER_S):
                await reaper.job_manager.retry_job(job)
                requeued += 1
            await asyncio.sleep(1)
    return requeued


async def _worker() -> None:
    async with app.open_async():
        await app.run_worker_async(
            queues=["bench"],
            concurrency=1,
            update_heartbeat_interval=2,
            stalled_worker_timeout=STALLED_AFTER_S,
            fetch_job_polling_interval=1,
            delete_jobs="always",
        )


if __name__ == "__main__" and sys.argv[1:] == ["worker"]:
    asyncio.run(_worker())
