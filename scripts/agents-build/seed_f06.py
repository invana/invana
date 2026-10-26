"""Seed the F06 boards' data — four worker pools, their workers, events and stored numbers.

The ``agents.pools`` · ``agents.pool.*`` · ``agents.workers.*`` boards draw pools
no demo writes: ``k8s-prod`` (a Kubernetes Deployment of 24 replicas),
``egress`` (four Docker hosts, short), ``gpu-lab`` (no workers) and
``laptop-ravi`` (one Python worker). The script writes them as the gateway
would have — pool rows, worker rows heartbeating now, worker events and 30 s
``worker_stats`` buckets for the last 30 minutes, the older ones a little
quieter so *vs 7-day* reads a rise — and mints one join token for ``egress``
through the join-token manager.

Seeded workers are rows, not processes: under ``INVANA_EXECUTOR=procrastinate``
the engine's sweep marks them lost 30 s after the seed's heartbeat, so seed
right before a shoot. A re-run deletes the four pools (their workers, events and
numbers go with them) and writes them again. Run from the repo root:

    uv run --directory engine python ../scripts/agents-build/seed_f06.py
"""

from __future__ import annotations

import asyncio
import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

import invana.apps.annotations.models  # noqa: F401
import invana.apps.boards.models  # noqa: F401
import invana.apps.flows.models  # noqa: F401
import invana.apps.graphs.models  # noqa: F401
import invana.apps.iam.models  # noqa: F401
import invana.apps.llm_providers.models  # noqa: F401
import invana.apps.sessions.models  # noqa: F401
import invana.apps.skills.models  # noqa: F401
import invana.apps.standards.models  # noqa: F401
import invana.apps.work.models  # noqa: F401
from invana.apps.workers.managers.join_tokens import JoinTokenManager
from invana.apps.workers.models import Worker, WorkerEvent, WorkerPool, WorkerStat
from invana.apps.workers.schemas import JoinTokenIn
from invana.core.auth.models import User
from invana.core.auth.tokens import hash_token
from invana.core.db import create_db_engine, create_session_factory

POOLS = [
    # name, runs_on, labels, slots a worker, set_by, replicas, plugins, egress
    ("k8s-prod", "kubernetes", ["cpu", "llm"], 6, "replicas", 24, ["invana.core"], []),
    ("egress", "docker", ["cpu", "egress"], 8, "hand", None, ["invana.tools.web"], ["*.wikipedia.org", "api.crossref.org"]),
    ("gpu-lab", "python", ["gpu"], 2, "hand", None, ["invana.tools.science"], []),
    ("laptop-ravi", "python", ["cpu", "llm"], 4, "hand", None, ["invana.core"], []),
]
#: k8s-prod's workers by state: 20 busy, 1 idle, 2 starting, 1 lost.
K8S_STATES = ["busy"] * 3 + ["lost"] + ["busy", "idle"] + ["busy"] * 17 + ["starting"] * 2
QUEUED = {"k8s-prod": 1204, "egress": 312, "gpu-lab": 1, "laptop-ravi": 0}
OLDEST = {"k8s-prod": 6, "egress": 41, "gpu-lab": 180, "laptop-ravi": None}


async def main() -> None:
    now = datetime.now(UTC)
    rng = random.Random(6)
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    async with factory() as db:
        ravi = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
        # The done-when check leaves its own pool behind; the boards draw the four below.
        await db.execute(delete(WorkerPool).where(WorkerPool.name.in_([*(p[0] for p in POOLS), "done-when"])))
        pools: dict[str, WorkerPool] = {}
        for name, runs_on, labels, slots, set_by, replicas, plugins, egress in POOLS:
            pool = WorkerPool(
                name=name,
                runs_on=runs_on,
                labels=labels,
                slots_per_worker=slots,
                set_by=set_by,
                replicas=replicas,
                plugins=plugins,
                secrets=["web_search"] if name == "egress" else [],
                egress=egress,
                created_by_id=ravi.id,
                created_at=now - timedelta(days=12),
            )
            db.add(pool)
            pools[name] = pool
        await db.flush()

        def worker(pool: WorkerPool, n: int, state: str, node: str, up_min: int) -> Worker:
            name = f"w-{pool.name}-{n:02d}"
            busy = {"busy": pool.slots_per_worker - rng.choice([0, 0, 1, 2]), "idle": 0}.get(state, 0)
            beat = {"lost": now - timedelta(seconds=42), "starting": None}.get(state, now - timedelta(seconds=rng.choice([0, 1, 2])))
            return Worker(
                pool_id=pool.id,
                name=name,
                node=node,
                version="0.44.0",
                labels=list(pool.labels),
                plugins=list(pool.plugins),
                slots=pool.slots_per_worker,
                state=state,
                slots_busy=busy,
                cpu=None if state in ("lost", "starting") else (rng.randint(38, 72) if state == "busy" else 4),
                credential_hash=hash_token(f"seed-{name}"),
                joined_at=now - timedelta(minutes=up_min),
                last_heartbeat_at=beat,
                from_ip=node.replace("ip-", "").replace("-", ".") if node.startswith("ip-") else "192.168.1.20",
                redelivered=3 if state == "lost" else 0,
            )

        k8s = pools["k8s-prod"]
        for i, state in enumerate(K8S_STATES, start=1):
            node = f"ip-10-2-{14 + i // 4}-{(i * 3) % 9 + 1}"
            db.add(worker(k8s, i, state, node, 41 if i < 7 else (3 if state == "starting" else 22)))
        for i in range(1, 9):
            db.add(worker(pools["egress"], i, "busy", f"egress-host-{(i - 1) // 2 + 1}", 180))
        db.add(worker(pools["laptop-ravi"], 1, "idle", "ravi-mbp.local", 95))
        await db.flush()

        lost = (await db.execute(select(Worker).where(Worker.state == "lost"))).scalars().first()
        joined = (await db.execute(select(Worker).where(Worker.name == "w-egress-08"))).scalar_one()
        for minutes, pool, worker_row, change, detail, why, actor in [
            (0, k8s, None, "replicas", {"delta": 2}, "ravi set replicas 22 → 24", ravi.id),
            (7, k8s, lost, "lost", {"worker": lost.name}, "no heartbeat 30 s · 3 steps redelivered", None),
            (41, pools["egress"], joined, "joined", {"worker": joined.name}, "join token invana_join_…7Hq2", None),
            (79, k8s, None, "drained", {"worker": "w-k8s-prod-12"}, "node upgrade", ravi.id),
        ]:
            db.add(
                WorkerEvent(
                    pool_id=pool.id,
                    worker_id=worker_row.id if worker_row else None,
                    change=change,
                    detail=detail,
                    why=why,
                    actor_id=actor,
                    at=now - timedelta(minutes=minutes),
                )
            )

        bucket = now.replace(second=(now.second // 30) * 30, microsecond=0)
        live = {"k8s-prod": (24, 2, 1), "egress": (8, 0, 0), "gpu-lab": (0, 0, 0), "laptop-ravi": (1, 0, 0)}
        busy = {"k8s-prod": 108, "egress": 64, "gpu-lab": 0, "laptop-ravi": 0}
        envelopes = {"k8s-prod": 420, "egress": 450, "gpu-lab": 0, "laptop-ravi": 50}
        suggested = {"k8s-prod": 24, "egress": 16, "gpu-lab": 1, "laptop-ravi": 1}
        moments = [bucket - timedelta(seconds=30 * k) for k in range(60)]
        for at in moments:
            ago = (bucket - at).total_seconds() / 60
            for name, pool in pools.items():
                workers, starting, lost_n = live[name]
                if name == "k8s-prod" and 0 < ago <= 30:
                    workers = 22  # before ravi set the replicas
                db.add(
                    WorkerStat(
                        pool_id=pool.id,
                        at=at,
                        workers=workers,
                        starting=starting if at == bucket else 0,
                        lost=lost_n if ago <= 7 else 0,
                        slots=workers * pool.slots_per_worker,
                        slots_busy=min(busy[name], workers * pool.slots_per_worker),
                        ready=QUEUED[name],
                        oldest_s=OLDEST[name],
                        envelopes=envelopes[name] if ago < 1 else int(envelopes[name] * 0.89),
                        suggested=suggested[name],
                    )
                )
        await db.commit()
        for pool, days, cap in (("egress", 7, 8), ("k8s-prod", None, None)):
            await JoinTokenManager().mint(
                db,
                payload=JoinTokenIn(pool_id=pools[pool].id, expires_in_days=days, cap=cap),
                actor=ravi,
                engine_url="http://localhost:8200",
            )
        await db.commit()
    await engine.dispose()
    print("seeded", ", ".join(p[0] for p in POOLS))


if __name__ == "__main__":
    asyncio.run(main())
