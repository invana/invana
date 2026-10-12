"""Dramatiq — messages on Redis, acked after the actor returns.

A dead worker's unacked messages go back on the queue once its heartbeat is
``heartbeat_timeout`` old *and* a live worker runs maintenance, which it does on
``maintenance_chance`` per million commands. The defaults are 60 s and 1 000;
here they are tuned to 10 s and 100 000 so recovery is compared on equal terms
with procrastinate's reaper.
"""

from __future__ import annotations

import os

import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware.asyncio import AsyncIO
from workload import REDIS, execute, stamp

TUNED = os.environ.get("BENCH_DRAMATIQ_DEFAULTS") != "1"

broker = RedisBroker(
    url=REDIS,
    namespace="invana-bench",
    **({"heartbeat_timeout": 10_000, "maintenance_chance": 100_000} if TUNED else {}),
)
broker.add_middleware(AsyncIO())
dramatiq.set_broker(broker)


@dramatiq.actor(queue_name="bench", max_retries=0, time_limit=120_000)
async def run_envelope_job(wire: str) -> None:
    await execute(wire)


def enqueue(wires: list[str]) -> None:
    for wire in wires:
        run_envelope_job.send(stamp(wire))


def flush() -> None:
    broker.flush_all()
