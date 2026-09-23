"""How library entries actually ran, and promoting a plan that served.

Band 3 rather than `apps/task_plans`, because both read `runs` and
`run_nodes` — an app may not import the runtime, but the runtime may import
an app (migration-plan §18.1.1 S1).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.models import Graph
from invana.apps.skills.querysets import SkillVersionQuerySet
from invana.apps.task_plans.dag import dag_for, pinned_by
from invana.apps.task_plans.managers import TaskPlanManager
from invana.apps.task_plans.managers.task_plan import explode
from invana.apps.task_plans.models import PlanKind, PlanOrigin, TaskPlan
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.apps.task_plans.schemas import (
    AgentChip,
    DagEdge,
    DagNode,
    PlanCallerRead,
    PlanLayerRead,
    RunRow,
    TaskPlanDetail,
    TaskPlanRead,
)
from invana.core.auth.models import User
from invana.core.errors import NotFoundError, ValidationError
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.layers import declared_bands, layer_for, ordered_layers
from invana.runtime.models import TaskRun
from invana.runtime.querysets import TaskRunQuerySet


def _requires() -> dict[str, tuple[str, ...]]:
    """What the catalogue declares must precede each entry — one source (§6).

    It lives here rather than in ``apps/task_plans`` because the catalogue is
    band 3: the runtime hands the declaration down, and the app takes it as an
    argument (migration-plan §4.1).
    """
    return {key: entry.requires for key, entry in CATALOGUE.items()}


def _callers_of(key: str | None, plans: list[TaskPlan]) -> list[tuple[TaskPlan, dict]]:
    """The plans that inlined ``key``, each with the ``uses`` row that did it.

    Read off the **calling** plan, because that is where tuning is recorded
    ([LB19](docs/for-developers/modules/workflows/features/the-library.md)) —
    this plan is untouched by every one of them, which is the whole point of
    declaring arguments instead of forking.
    """
    if not key:
        return []
    out: list[tuple[TaskPlan, dict]] = []
    for plan in plans:
        for use in plan.uses or []:
            if isinstance(use, dict) and use.get("key") == key:
                out.append((plan, use))
    return out


class TaskPlanRunsManager:
    workflows_qs = TaskPlanQuerySet()
    library = TaskPlanManager()
    skill_versions_qs = SkillVersionQuerySet()

    async def get(self, session: AsyncSession, *, graph_id: str, key: str, version: int | None) -> TaskPlan:
        """Seeding first: a graph that has never listed its library still
        resolves a seeded key."""
        await self.library.ensure_seeded(session, graph_id=graph_id, requires=_requires())
        workflow = await self.workflows_qs.find_by_key(session, graph_id=graph_id, key=key, version=version)
        if workflow is None:
            raise NotFoundError(f"No workflow keyed '{key}'.")
        return workflow

    async def list_reads(self, session: AsyncSession, *, graph_id: str) -> list[TaskPlanRead]:
        await self.library.ensure_seeded(session, graph_id=graph_id, requires=_requires())
        rows = await self.workflows_qs.list_for_graph(session, graph_id=graph_id)
        # Every plan, because a caller is a skill's plan and those are not in
        # the library — the rows above are what is *listed*, these are what
        # counts as a use (LB16 · LB19).
        every = await self.workflows_qs.list_for_graph(session, graph_id=graph_id, reusable_only=False)
        stats = await self.run_stats(session, graph_id=graph_id, refs=[row.ref for row in rows])
        # One query for every plan's nodes: the list row carries a count, and a
        # count per row is a query per row unless it is asked for all at once.
        tasks_by_plan = await self.workflows_qs.tasks_for_plans(session, plan_ids=[row.id for row in rows])
        items: list[TaskPlanRead] = []
        for row in rows:
            read = TaskPlanRead.model_validate(row)
            read.step_count = len(tasks_by_plan.get(row.id, []))
            read.used_by = [
                AgentChip(id=a.id, name=a.name, status=a.status) for a in await self.library.used_by(session, row)
            ]
            read.layers = ordered_layers(
                layer_for(form=t.form, step_key=t.step_key) for t in tasks_by_plan.get(row.id, [])
            )
            read.caller_count = len(_callers_of(row.key, every))
            _apply_stats(read, stats.get(row.ref))
            items.append(read)
        return items

    async def detail(self, session: AsyncSession, *, workflow: TaskPlan) -> TaskPlanDetail:
        agents = await self.library.used_by(session, workflow)
        tasks = await self.workflows_qs.tasks_for(session, plan_id=workflow.id)
        detail = TaskPlanDetail.model_validate(workflow)
        detail.step_count = len(tasks)
        detail.used_by = [AgentChip(id=a.id, name=a.name, status=a.status) for a in agents]
        stats = await self.run_stats(session, graph_id=workflow.graph_id, refs=[workflow.ref])
        _apply_stats(detail, stats.get(workflow.ref))

        # The edges are **read**, not re-derived: `depends_on` was materialised
        # when the plan was written, so the picture cannot drift from the order
        # the interpreter actually walks (task-model-migration M2).
        nodes, edges = dag_for(tasks)
        pins = pinned_by(workflow, agents)
        detail.layers = ordered_layers(layer_for(form=t.form, step_key=t.step_key) for t in tasks)
        # Every governed band, touched or not — the panel's *Layers it declares*
        # ([LB22](docs/for-developers/modules/workflows/features/the-library.md)).
        detail.declared_layers = [PlanLayerRead(**band) for band in declared_bands(tasks)]
        detail.callers = await self._callers_read(session, workflow=workflow)
        detail.caller_count = len(detail.callers)
        detail.nodes = [
            DagNode(
                id=n["id"],
                task=n["task"],
                label=n["label"],
                args=n["args"],
                form=n["form"],
                layer=layer_for(form=n["form"], step_key=n["task"] or None),
                depth=n["depth"],
                pinned=sorted(pins.get(n["task"], {}).get("args", [])),
                pinned_by_count=len(pins.get(n["task"], {}).get("agents", [])),
                pinned_by=[
                    AgentChip(id=a.id, name=a.name, status=a.status) for a in pins.get(n["task"], {}).get("agents", [])
                ],
            )
            for n in nodes
        ]
        detail.edges = [DagEdge(**e) for e in edges]
        return detail

    async def _callers_read(self, session: AsyncSession, *, workflow: TaskPlan) -> list[PlanCallerRead]:
        """Who inlines this plan, and what each tuned.

        A caller is named by the **skill** that owns the calling plan, because
        that is the thing a reader knows — a skill version's plan has no name
        of its own ([LB16](docs/for-developers/modules/workflows/features/the-library.md)).
        A calling plan nothing owns is named by its own key, which is the
        honest answer rather than a blank.
        """
        # **Not the library.** A skill version's plan is `reusable = False`
        # ([LB16](docs/for-developers/modules/workflows/features/the-library.md)),
        # so the callers are exactly the rows this list's default hides.
        plans = await self.workflows_qs.list_for_graph(session, graph_id=workflow.graph_id, reusable_only=False)
        calls = _callers_of(workflow.key, plans)
        owners = await self.skill_versions_qs.owners_for_plans(session, [plan.id for plan, _ in calls])
        out: list[PlanCallerRead] = []
        for plan, use in calls:
            owner = owners.get(plan.id)
            out.append(
                PlanCallerRead(
                    kind="skill" if owner else "plan",
                    name=owner[1] if owner else (plan.key or plan.name or "a plan"),
                    skill_id=owner[0] if owner else None,
                    version=int(use.get("version") or workflow.version),
                    args=dict(use.get("args") or {}),
                )
            )
        return sorted(out, key=lambda c: c.name.lower())

    async def recent_runs(self, session: AsyncSession, *, workflow: TaskPlan, limit: int) -> list[RunRow]:
        ref = f"template:{workflow.ref}"
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == workflow.graph_id, TaskRun.plan_origin == ref)
            .order_by(TaskRun.queued_at.desc())
            .limit(limit)
        )
        rows = list((await session.execute(stmt)).scalars().all())
        return [
            RunRow(
                run_id=t.id,
                status=t.status,
                served=((t.plan or {}).get("served")),
                started_at=t.started_at.isoformat() if t.started_at else None,
            )
            for t in rows
        ]

    async def run_stats(self, session: AsyncSession, *, graph_id: str, refs: list[str]) -> dict[str, dict]:
        """How often each library entry ran, and how often it **served**.

        The verdict is not on the run — it is the *Verify* step's output
        (``{"served": "yes" | "partial" | "no"}``, docs/for-developers/modules/agents/spec.md), which is the
        only place a deterministic check wrote it. Reading it from there keeps one
        definition of *served*: the same one the card's badge shows.
        """
        if not refs:
            return {}
        plan_refs = [f"template:{ref}" for ref in refs]
        runs = list(
            (
                await session.execute(
                    select(TaskRun.id, TaskRun.plan_origin, TaskRun.queued_at).where(
                        TaskRun.graph_id == graph_id, TaskRun.plan_origin.in_(plan_refs)
                    )
                )
            ).all()
        )
        verdicts: dict[str, str] = {}
        if runs:
            rows = list(
                (
                    await session.execute(
                        select(TaskRun.parent_run_id, TaskRun.output).where(
                            TaskRun.parent_run_id.in_([t.id for t in runs]),
                            TaskRun.task_key == "verify_result",
                        )
                    )
                ).all()
            )
            for run_id, output in rows:
                served = (output or {}).get("served")
                if isinstance(served, str):
                    verdicts[run_id] = served

        stats: dict[str, dict] = {ref: {"runs": 0, "served": 0, "verified": 0, "last_run_at": None} for ref in refs}
        for run in runs:
            ref = str(run.plan_origin).removeprefix("template:")
            entry = stats.get(ref)
            if entry is None:
                continue
            entry["runs"] += 1
            verdict = verdicts.get(run.id)
            if verdict is not None:
                entry["verified"] += 1
                if verdict == "yes":
                    entry["served"] += 1
            at = run.queued_at
            if at is not None and (entry["last_run_at"] is None or at > entry["last_run_at"]):
                entry["last_run_at"] = at
        for entry in stats.values():
            # A rate over *verified* runs, not over every run: a run that
            # failed before Verify has no verdict, and counting it as "not served"
            # would report a translation error as a bad workflow.
            entry["served_rate"] = (entry["served"] / entry["verified"]) if entry["verified"] else None
            entry["last_run_at"] = entry["last_run_at"].isoformat() if entry["last_run_at"] else None
        return stats

    async def promote_plan(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        run_id: str,
        key: str,
        description: str,
        intents: list[str],
        actor: User,
    ) -> TaskPlan:
        """A plan that served becomes a library entry, at the next free version."""
        run = await TaskRunQuerySet().get(session, run_id)
        if run is None or run.graph_id != graph.id:
            raise NotFoundError("TaskRun not found.")
        plan = run.plan or {}
        steps = plan.get("steps") or []
        if not steps:
            raise ValidationError("That run has no plan to promote.")

        latest = await self.workflows_qs.latest_version(session, graph_id=graph.id, key=key)

        workflow = TaskPlan(
            graph_id=graph.id,
            key=key,
            version=(latest or 0) + 1,
            name=key,
            description=description or f"Promoted from a plan that served on {run.queued_at:%Y-%m-%d}.",
            kind=PlanKind.ask.value,
            origin=PlanOrigin.promoted.value,
            intent=intents,
            reusable=True,
            promoted_from_run_id=run.id,
            created_by_kind="user",
            created_by_id=actor.id,
        )
        await self.workflows_qs.add(session, workflow)
        # The promoted plan is rows like any other — the snapshot it came from
        # is a step list, and it is exploded once, here.
        await self.workflows_qs.add_tasks(session, explode(workflow.id, steps, requires=_requires()))
        return workflow


def _apply_stats(read: TaskPlanRead, stats: dict | None) -> None:
    if not stats:
        return
    read.runs = int(stats["runs"])
    read.served_rate = stats["served_rate"]
    read.last_run_at = stats["last_run_at"]
