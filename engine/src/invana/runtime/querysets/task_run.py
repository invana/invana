"""Queries against ``task_runs`` — a whole run, and the nodes inside it.

One queryset, because there is one table. A *root* is a run with no
``parent_run_id``: what a Todo, a schedule or a session ask opened. A *node* is
a run with one. Two words for two shapes of the same row, so that a method name
says which it returns without a second class to look up.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Text, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from invana.runtime.models import RunRole, RunStatus, TaskRun


class TaskRunQuerySet:
    async def get(self, session: AsyncSession, run_id: str) -> TaskRun | None:
        return await session.get(TaskRun, run_id)

    # ── what an agent has spent ──────────────────────────────────────────────

    async def spend_by_agent(self, session: AsyncSession, *, graph_id: str, since: datetime) -> dict[str, float]:
        """``{agent_id: usd}`` over a window — what the list draws against the
        month ceiling ([C10](docs/for-developers/modules/agents/features/author-an-agent.md)).

        A grouped read, never a counter column: a counter can disagree with the
        runs it counts. It rides ``ix_task_runs_agent_started``, which is why
        the window is on ``started_at`` and not on ``queued_at`` — a run that
        queued in March and ran in April spent April's dollars.

        An agent with no priced run is **absent**, not zero: a subscription
        endpoint publishes no per-token rate, so ``cost_usd`` is ``NULL`` and
        *nothing was spent* and *nothing is known* are different facts
        ([OB4](docs/for-developers/modules/operate/features/observability.md)).
        """
        rows = await session.execute(
            select(TaskRun.agent_id, func.sum(TaskRun.cost_usd))
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.agent_id.is_not(None),
                TaskRun.started_at >= since,
                TaskRun.cost_usd.is_not(None),
            )
            .group_by(TaskRun.agent_id)
        )
        return {agent_id: float(total) for agent_id, total in rows.all() if agent_id and total is not None}

    # ── what a world was used for ────────────────────────────────────────────
    async def lens_usage(self, session: AsyncSession, lens_id: str) -> tuple[int, datetime | None, list[str]]:
        """``(runs, last used, who)`` for one lens.

        *Used in 34 runs · last 2h ago · by ravi, sam and 2 others* is a grouped
        read and not a counter column: a counter can disagree with the runs it
        counts, and this cannot (govern/spec.md GV20).
        """
        runs, last = (
            await session.execute(
                select(func.count(TaskRun.id), func.max(TaskRun.queued_at)).where(TaskRun.lens_id == lens_id)
            )
        ).one()
        if not runs:
            return 0, None, []

        actors = (
            (
                await session.execute(
                    select(TaskRun.author_id)
                    .where(TaskRun.lens_id == lens_id, TaskRun.author_id.is_not(None))
                    .group_by(TaskRun.author_id)
                    .order_by(func.count(TaskRun.id).desc())
                    .limit(8)
                )
            )
            .scalars()
            .all()
        )
        return runs, last, list(actors)

    async def usage_for_lenses(
        self, session: AsyncSession, lens_ids: list[str]
    ) -> dict[str, tuple[int, datetime | None]]:
        """The same reading for a whole drawer, in one query rather than N."""
        if not lens_ids:
            return {}
        stmt = (
            select(TaskRun.lens_id, func.count(TaskRun.id), func.max(TaskRun.queued_at))
            .where(TaskRun.lens_id.in_(lens_ids))
            .group_by(TaskRun.lens_id)
        )
        return {lens_id: (runs, last) for lens_id, runs, last in (await session.execute(stmt)).all()}

    # ── roots ────────────────────────────────────────────────────────────────
    async def for_todo(self, session: AsyncSession, *, todo_id: str) -> list[TaskRun]:
        stmt = (
            select(TaskRun)
            .where(TaskRun.todo_id == todo_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def ids_for_todo(self, session: AsyncSession, *, todo_id: str) -> list[str]:
        stmt = (
            select(TaskRun.id)
            .where(TaskRun.todo_id == todo_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def first_succeeded_load_at(self, session: AsyncSession, *, graph_id: str) -> datetime | None:
        """When records first landed in this Graph — `setup.LoadsReader`.

        **Both kinds count.** A bulk load validated nothing, but the records are
        in the database either way, and the question this answers is whether the
        Graph has data (inspect-what-landed.md · § 6.7).
        """
        stmt = select(func.min(TaskRun.finished_at)).where(
            TaskRun.graph_id == graph_id,
            TaskRun.ask_kind.in_(("import", "bulk")),
            TaskRun.status == RunStatus.succeeded.value,
        )
        return (await session.execute(stmt)).scalar_one_or_none()

    async def latest_load_root(self, session: AsyncSession, *, model_id: str) -> str | None:
        """Where the records of *model_id* were last loaded from.

        The folder is a fact about a load, not about the model, so it is read
        back off the run that did the loading rather than stored a second time
        (task-model-migration § 6.7). Newest first and no status filter: a load
        that failed at validation still names the folder its files are in, which
        is the only thing being asked for here.
        """
        stmt = (
            select(TaskRun.params)
            .where(
                TaskRun.ask_kind == "import",
                TaskRun.parent_run_id.is_(None),
                TaskRun.params["model_id"].as_string() == model_id,
            )
            .order_by(TaskRun.queued_at.desc())
            .limit(1)
        )
        params = (await session.execute(stmt)).scalars().first()
        return str((params or {}).get("root") or "") or None

    async def for_graph(self, session: AsyncSession, *, graph_id: str, limit: int) -> list[TaskRun]:
        """The journal: roots only, newest first.

        A node is reached through the run that owns it — listing both would make
        one run seven rows (see-what-ran.md SR23).
        """
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_(None))
            .order_by(TaskRun.queued_at.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def running_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[TaskRun]:
        """Queued or running roots — what the concurrency policy counts against."""
        stmt = select(TaskRun).where(
            TaskRun.graph_id == graph_id,
            TaskRun.parent_run_id.is_(None),
            TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]),
        )
        return list((await session.execute(stmt)).scalars().all())

    async def in_flight_for_agent(self, session: AsyncSession, *, agent_id: str) -> list[TaskRun]:
        """This agent's runs that have not finished — queued or running roots.

        What a lifecycle preview names as *finishes*: neither pausing nor
        retiring kills a run, and a queued one still starts, because pausing
        takes nothing **new** and a run already queued is not new
        ([LC9](docs/for-developers/modules/agents/features/lifecycle.md)).
        """
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.agent_id == agent_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]),
            )
            .order_by(TaskRun.queued_at.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    async def last_draw_of_skill_version(
        self, session: AsyncSession, *, graph_id: str, version_id: str
    ) -> TaskRun | None:
        """The newest draw of this draft, whatever became of it.

        What it *refused* is read off it, so a refusal needs no column of its
        own: it belongs to the draw that produced it, which is the same row
        Runs opens ([SK31](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        """
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.role == RunRole.plan.value,
                TaskRun.workflow_key == "skill-draft",
            )
            .order_by(TaskRun.queued_at.desc())
            .limit(25)
        )
        for run in (await session.execute(stmt)).scalars().all():
            if (run.params or {}).get("skill_version_id") == version_id:
                return run
        return None

    async def drawing_skill_version(self, session: AsyncSession, *, graph_id: str, version_id: str) -> str | None:
        """The draw in flight for this draft, if there is one.

        The authoring surface asks it on every read, so *a draw is running* is
        a fact about rows rather than a flag the browser holds: a reload lands
        back in **Drawing…**, and pressing *Draw this* twice is visible.

        ``params`` is JSON, and the dialects do not agree on how to reach into
        it — so the filter is the three indexed columns, and the match on the
        version id happens in Python over what is left: the draws queued or
        running in one Graph, which concurrency already keeps small.
        """
        stmt = select(TaskRun).where(
            TaskRun.graph_id == graph_id,
            TaskRun.parent_run_id.is_(None),
            TaskRun.role == RunRole.plan.value,
            TaskRun.workflow_key == "skill-draft",
            TaskRun.status.in_([RunStatus.queued.value, RunStatus.running.value]),
        )
        for run in (await session.execute(stmt)).scalars().all():
            if (run.params or {}).get("skill_version_id") == version_id:
                return run.id
        return None

    # ── nodes ────────────────────────────────────────────────────────────────
    async def nodes_of(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        """The nodes of one run, in the order the plan lays them out."""
        stmt = (
            select(TaskRun)
            .where(TaskRun.parent_run_id == run_id)
            .order_by(TaskRun.seq, TaskRun.iteration, TaskRun.attempt)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def nodes_of_many(self, session: AsyncSession, *, run_ids: list[str]) -> list[TaskRun]:
        """Every named run's nodes in one query — a list row carries a count."""
        if not run_ids:
            return []
        stmt = (
            select(TaskRun)
            .where(TaskRun.parent_run_id.in_(run_ids))
            .order_by(TaskRun.parent_run_id, TaskRun.seq, TaskRun.attempt)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def children_of_nodes(self, session: AsyncSession, *, run_id: str) -> list[TaskRun]:
        """The runs delegated by any node of *run_id* — the fan-in's question.

        Two hops rather than a column: a delegated child names the node that
        delegated it, and that node names this run, so the edge is already
        written twice over. `child_run_id` would be a third copy of it.
        """
        nodes = select(TaskRun.id).where(TaskRun.parent_run_id == run_id)
        stmt = select(TaskRun).where(TaskRun.parent_run_id.in_(nodes)).order_by(TaskRun.queued_at)
        return list((await session.execute(stmt)).scalars().all())

    async def recent_nodes_for_graph(self, session: AsyncSession, *, graph_id: str, limit: int) -> list[TaskRun]:
        """Newest finished nodes in one Graph; unfinished ones sort last."""
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
            .order_by(TaskRun.finished_at.desc().nullslast())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def skill_version_counts(self, session: AsyncSession, *, graph_id: str, version_id: str) -> tuple[int, int]:
        """How many nodes in this Graph were offered one skill version, and how
        many reported applying it.

        Counted over the whole Graph rather than a recent window: *offered 40,
        applied 31* is presented as a total, and a total taken from a page is a
        different number wearing the same label
        ([US2](docs/for-developers/modules/skills/features/usage.md)).

        ``skills_offered`` is a JSON array and containment operators differ
        between Postgres and SQLite, so the match is the same quoted-substring
        test ``core/events/querysets/event.py`` uses on ``skill_ids``. The ids
        are UUIDs, so a substring hit is an element hit.
        """
        like = f'%"{version_id}"%'
        stmt = select(
            func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
            func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
        ).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
        offered, applied = (await session.execute(stmt)).one()
        return int(offered or 0), int(applied or 0)

    async def skill_version_by_agent(
        self, session: AsyncSession, *, graph_id: str, version_id: str
    ) -> list[tuple[str | None, int, int]]:
        """``(agent_id, offered, applied)`` for one skill version.

        A step carries no ``agent_id`` of its own — the agent belongs to the run
        that opened it — so this joins each node to its parent. An agent that was
        offered the version and never applied it is exactly the row worth seeing,
        which is why the join is an outer one on the parent rather than a filter.
        """
        like = f'%"{version_id}"%'
        parent = aliased(TaskRun)
        stmt = (
            select(
                parent.agent_id,
                func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
                func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
            )
            .join(parent, parent.id == TaskRun.parent_run_id)
            .where(TaskRun.graph_id == graph_id, TaskRun.skills_offered.cast(Text).like(like))
            .group_by(parent.agent_id)
        )
        return [(row[0], int(row[1] or 0), int(row[2] or 0)) for row in (await session.execute(stmt)).all()]

    async def skill_version_by_outcome(
        self, session: AsyncSession, *, graph_id: str, version_id: str
    ) -> list[tuple[str | None, int, int]]:
        """``(outcome, offered, applied)`` — *applied in runs that served, versus
        runs that did not* (US1 C5). The outcome is the **run's**, not the step's:
        a step can succeed inside a run that never answered.
        """
        like = f'%"{version_id}"%'
        parent = aliased(TaskRun)
        stmt = (
            select(
                parent.outcome,
                func.count().filter(TaskRun.skills_offered.cast(Text).like(like)),
                func.count().filter(TaskRun.skills_applied.cast(Text).like(like)),
            )
            .join(parent, parent.id == TaskRun.parent_run_id)
            .where(TaskRun.graph_id == graph_id, TaskRun.skills_offered.cast(Text).like(like))
            .group_by(parent.outcome)
        )
        return [(row[0], int(row[1] or 0), int(row[2] or 0)) for row in (await session.execute(stmt)).all()]

    async def _version_counts(
        self, session: AsyncSession, *, graph_id: str, versions_by_key: dict[str, list[str]], column
    ) -> dict[str, int]:
        """Steps whose ``column`` names any of each key's versions — one query.

        The aggregate list is as long as there are keys, which is tens; the
        alternative is a round trip per row of a list surface. ``column`` is a
        ``task_runs`` JSON array of ``rule_version_id``s — ``rules_offered``,
        written by assembly, or ``rules_cited``, the model's own claim
        ([RU7](docs/for-developers/modules/skills/features/rules.md)). One body,
        because two copies of this query would be two chances to count *offered*
        and *cited* over different rows.
        """
        if not versions_by_key:
            return {}
        columns = []
        keys = []
        for key, version_ids in versions_by_key.items():
            if not version_ids:
                continue
            match = or_(*[column.cast(Text).like(f'%"{v}"%') for v in version_ids])
            columns.append(func.count().filter(match))
            keys.append(key)
        if not columns:
            return {}
        stmt = select(*columns).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None))
        row = (await session.execute(stmt)).one()
        return {key: int(value or 0) for key, value in zip(keys, row, strict=True)}

    async def rule_citation_counts(
        self, session: AsyncSession, *, graph_id: str, versions_by_rule: dict[str, list[str]]
    ) -> dict[str, int]:
        """How many steps cited any version of each rule — the model's claim."""
        return await self._version_counts(
            session, graph_id=graph_id, versions_by_key=versions_by_rule, column=TaskRun.rules_cited
        )

    async def rule_offer_counts(
        self, session: AsyncSession, *, graph_id: str, versions_by_rule: dict[str, list[str]]
    ) -> dict[str, int]:
        """How many steps were **offered** any version of each rule — a fact.

        Without it, *never cited* cannot be told from *never offered*
        ([RU9](docs/for-developers/modules/skills/features/rules.md)), which is
        the one distinction the evidence loop needs.
        """
        return await self._version_counts(
            session, graph_id=graph_id, versions_by_key=versions_by_rule, column=TaskRun.rules_offered
        )

    async def steps_citing(self, session: AsyncSession, *, graph_id: str, version_ids: list[str], limit: int):
        """Newest finished steps that cited any of these rule versions."""
        if not version_ids:
            return []
        match = or_(*[TaskRun.rules_cited.cast(Text).like(f'%"{v}"%') for v in version_ids])
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_not(None), match)
            .order_by(TaskRun.finished_at.desc().nullslast())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def add(self, session: AsyncSession, run: TaskRun) -> TaskRun:
        session.add(run)
        await session.flush()
        return run
