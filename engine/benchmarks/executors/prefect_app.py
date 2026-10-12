"""Prefect — background tasks served by task workers, brokered by a Prefect server.

``task.delay()`` records a scheduled task run on the server, which pushes it to
a task worker over a websocket. One worker serves one task run at a time
(``limit=1``). There is no setting for a dead worker's task runs: the benchmark
records what the server does with them.
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault("PREFECT_API_URL", "http://127.0.0.1:4210/api")

from prefect import task
from prefect.task_worker import serve
from workload import execute, stamp


# A fresh task key per bench run, so task runs a stopped run left scheduled are never served.
@task(name=f"run_envelope-{os.environ.get('BENCH_RUN', '0')}", retries=0, persist_result=False)
async def run_envelope_job(wire: str) -> None:
    await execute(wire)


def enqueue(wires: list[str]) -> None:
    for wire in wires:
        run_envelope_job.delay(stamp(wire))


if __name__ == "__main__" and sys.argv[1:] == ["worker"]:
    serve(run_envelope_job, limit=1)
