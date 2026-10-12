"""Run one executor through every scenario at 1, 3 and 9 workers; print and save the numbers.

Usage (from ``engine/``; the executors are never engine dependencies)::

    uv run --with procrastinate --with "psycopg[binary,pool]" --with "dramatiq[redis]" --with prefect \\
        python benchmarks/executors/bench.py procrastinate|dramatiq|prefect

| Scenario | Measures |
|---|---|
| ``throughput`` | 1 000 ``bench.noop`` envelopes sent at once → tasks per second |
| ``fanout`` | 200 ``bench.graph_query`` lanes + 20 ``bench.llm_step`` → makespan against the ideal |
| ``latency`` | 30 envelopes one at a time to idle workers → p50 / p95 send-to-start |
| ``kill`` | ``fanout`` on 3 workers, one SIGKILLed at 80 done → completed, lost, duplicates, recovery |

Each worker is its own process group, so a kill takes the whole worker down as
a crashed machine would. Results go to ``results/<executor>.json``.
"""

from __future__ import annotations

import asyncio
import json
import os
import signal
import statistics
import subprocess
import sys
import time
from pathlib import Path

import asyncpg

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

from workload import PG, SCHEMA, envelopes  # noqa: E402

WORKERS = (1, 3, 9)
FANOUT = ["bench.graph_query"] * 200 + ["bench.llm_step"] * 20
IDEAL_WORK_S = 200 * 0.05 + 20 * 1.0
SETTLE_TIMEOUT_S = int(os.environ.get("BENCH_SETTLE_TIMEOUT_S", "900"))


def _worker_cmd(executor: str) -> list[str]:
    if executor == "dramatiq":
        return [sys.executable, "-m", "dramatiq", "dramatiq_app", "--processes", "1", "--threads", "1"]
    return [sys.executable, f"{executor}_app.py", "worker"]


def _start(executor: str, n: int) -> list[subprocess.Popen]:
    env = {**os.environ, "PYTHONPATH": str(HERE)}
    return [
        subprocess.Popen(
            _worker_cmd(executor),
            cwd=HERE,
            env=env,
            start_new_session=True,
            stdout=subprocess.DEVNULL,
            stderr=(HERE / "results" / f"{executor}-worker{i}.log").open("w"),
        )
        for i in range(n)
    ]


def _stop(procs: list[subprocess.Popen]) -> None:
    for p in procs:
        if p.poll() is None:
            os.killpg(p.pid, signal.SIGTERM)
    for p in procs:
        try:
            p.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL)


def _rss_mb(procs: list[subprocess.Popen]) -> float:
    """Resident memory of one idle worker's whole process group, in MB."""
    out = subprocess.run(["ps", "-A", "-o", "pgid=,rss="], capture_output=True, text=True, check=False).stdout
    group = procs[0].pid
    return round(sum(int(r) for g, r in (line.split() for line in out.splitlines()) if int(g) == group) / 1024, 1)


async def _enqueue(adapter, wires: list[str]) -> float:
    started = time.time()
    if asyncio.iscoroutinefunction(adapter.enqueue):
        await adapter.enqueue(wires)
    else:
        await asyncio.to_thread(adapter.enqueue, wires)
    return time.time() - started


async def _wait(db, scenario: str, total: int, *, poll: float = 0.05) -> bool:
    deadline = time.time() + SETTLE_TIMEOUT_S
    while time.time() < deadline:
        if await db.fetchval("select count(*) from ledger where scenario=$1", scenario) >= total:
            return True
        await asyncio.sleep(poll)
    return False


async def _span(db, scenario: str) -> dict:
    row = await db.fetchrow(
        "select count(*) n, min(enqueued) a, max(finished) b, count(distinct pid) pids from ledger where scenario=$1",
        scenario,
    )
    dups = await db.fetchval("select count(*) from dups where scenario=$1", scenario)
    return {"done": row["n"], "seconds": round((row["b"] or 0) - (row["a"] or 0), 3), "pids": row["pids"], "dups": dups}


async def _warm(db, adapter, executor: str, n: int) -> None:
    """Wait until every worker has taken a task, so start-up is not timed."""
    scenario = f"{executor}-warm-{n}-{time.time_ns()}"
    deadline = time.time() + 120
    while time.time() < deadline:
        await _enqueue(adapter, envelopes(scenario + f"-{time.time_ns()}", ["bench.noop"] * (n * 4)))
        await asyncio.sleep(2)
        pids = await db.fetchval("select count(distinct pid) from ledger where scenario like $1", scenario + "%")
        if pids >= n:
            return
    raise RuntimeError(f"{executor}: only some of {n} workers came up")


async def throughput(db, adapter, executor: str, n: int) -> dict:
    scenario = f"{executor}-throughput-{n}"
    send_s = await _enqueue(adapter, envelopes(scenario, ["bench.noop"] * 1000))
    backlog = 1000 - await db.fetchval("select count(*) from ledger where scenario=$1", scenario)
    settled = await _wait(db, scenario, 1000)
    span = await _span(db, scenario)
    return {
        **span,
        "settled": settled,
        "send_s": round(send_s, 3),
        "backlog_at_send_end": backlog,
        "tasks_per_s": round(span["done"] / span["seconds"], 1),
    }


async def fanout(db, adapter, executor: str, n: int, scenario: str | None = None) -> dict:
    scenario = scenario or f"{executor}-fanout-{n}"
    await _enqueue(adapter, envelopes(scenario, FANOUT))
    settled = await _wait(db, scenario, len(FANOUT))
    span = await _span(db, scenario)
    ideal = IDEAL_WORK_S / n
    return {**span, "settled": settled, "ideal_s": round(ideal, 2), "efficiency": round(ideal / span["seconds"], 3)}


async def latency(db, adapter, executor: str, n: int) -> dict:
    scenario = f"{executor}-latency-{n}"
    wires = envelopes(scenario, ["bench.noop"] * 30)
    for i, wire in enumerate(wires):
        await _enqueue(adapter, [wire])
        await _wait(db, scenario, i + 1, poll=0.005)
    rows = await db.fetch("select (started - enqueued) * 1000 ms from ledger where scenario=$1", scenario)
    ms = sorted(r["ms"] for r in rows)
    return {"p50_ms": round(statistics.median(ms), 1), "p95_ms": round(ms[int(len(ms) * 0.95) - 1], 1)}


async def kill(db, adapter, executor: str, procs: list[subprocess.Popen]) -> dict:
    scenario = f"{executor}-kill-3"
    reaper_stop = asyncio.Event()
    reaper = asyncio.create_task(adapter.reap(reaper_stop)) if hasattr(adapter, "reap") else None
    await _enqueue(adapter, envelopes(scenario, FANOUT))
    while await db.fetchval("select count(*) from ledger where scenario=$1", scenario) < 80:
        await asyncio.sleep(0.02)
    killed_at = time.time()
    victim = procs[0]
    victim_pids = await db.fetch("select distinct pid from ledger where scenario=$1", scenario)
    os.killpg(victim.pid, signal.SIGKILL)
    settled = await _wait(db, scenario, len(FANOUT))
    reaper_stop.set()
    requeued = await reaper if reaper else None
    span = await _span(db, scenario)
    last = await db.fetchval("select max(finished) from ledger where scenario=$1", scenario)
    return {
        **span,
        "settled": settled,
        "lost": len(FANOUT) - span["done"],
        "recovered_after_kill_s": round((last or killed_at) - killed_at, 2) if settled else None,
        "requeued_by_reaper": requeued,
        "pids_before_kill": len(victim_pids),
    }


async def main(executor: str) -> None:
    os.environ.setdefault("BENCH_RUN", str(time.time_ns()))
    adapter = __import__(f"{executor}_app")
    (HERE / "results").mkdir(exist_ok=True)
    db = await asyncpg.connect(PG)
    await db.execute(SCHEMA)
    await db.execute("delete from ledger where scenario like $1", f"{executor}-%")
    await db.execute("delete from dups where scenario like $1", f"{executor}-%")
    if hasattr(adapter, "setup"):
        await adapter.setup()
    if hasattr(adapter, "flush"):
        adapter.flush()
    results: dict = {"executor": executor, "runs": {}}
    for n in WORKERS:
        procs = _start(executor, n)
        try:
            await _warm(db, adapter, executor, n)
            results["runs"][n] = {
                "idle_worker_rss_mb": _rss_mb(procs),
                "throughput": await throughput(db, adapter, executor, n),
                "fanout": await fanout(db, adapter, executor, n),
                "latency": await latency(db, adapter, executor, n),
            }
            print(json.dumps({n: results["runs"][n]}), flush=True)
        finally:
            _stop(procs)
    procs = _start(executor, 3)
    try:
        await _warm(db, adapter, executor, 3)
        results["kill"] = await kill(db, adapter, executor, procs)
        print(json.dumps({"kill": results["kill"]}), flush=True)
    finally:
        _stop(procs)
    (HERE / "results" / f"{executor}.json").write_text(json.dumps(results, indent=2))
    await db.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1]))
