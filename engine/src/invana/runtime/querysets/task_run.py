"""Queries against ``task_runs`` — a whole run, and the nodes inside it.

One queryset, because there is one table. A *root* is a run with no
``parent_run_id``: what a Todo, a schedule or a session ask opened. A *node* is
a run with one. Two words for two shapes of the same row, so that a method name
says which it returns without a second class to look up.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Text, exists, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from invana.apps.flows.models import Flow
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select
from invana.runtime.models import INTERACTIVE, RunRole, RunStatus, TaskRun


class TaskRunQuerySet:
    async def get(self, session: AsyncSession, run_id: str) -> TaskRun | None:
        return await session.get(TaskRun, run_id)

    async def stamp_trace(self, session: AsyncSession, run_id: str, *, trace_id: str | None, span_id: str) -> bool:
        """Record the run's own span, and its trace when the row has none yet.

        Called once the ``invana.run`` span is open, so the run page can open the
        run's trace in the collector. ``root_span_id`` is set only while it is
        still null, which makes the first run span win: a resumed run opens a
        second span and must not move the row away from the first. ``trace_id``
        normally arrived at insert from the column default (the request's
        trace); it is filled here only for a run queued outside any span, such
        as a schedule, and never overwritten.

        One conditional ``UPDATE``, so two workers stamping the same row cannot
        interleave. The caller commits. Returns whether the row was stamped.
        """
        result = await session.execute(
            update(TaskRun)
            .where(TaskRun.id == run_id, TaskRun.root_span_id.is_(None))
            .values(root_span_id=span_id, trace_id=func.coalesce(TaskRun.trace_id, trace_id))
            .execution_options(synchronize_session=False)
        )
        return bool(result.rowcount)

    # ── what an agent has used ───────────────────────────────────────────────

    @staticmethod
    def _agent_tokens(since: datetime):
        """Tokens per agent over its root runs that started since ``since``,
        each root's own and its steps', keyed by the root's agent.

        The root carries the agent; a step is counted through its root, so a
        step that carries no ``agent_id`` of its own is not lost. Eval runs are
        left out: they draw on the Graph's eval budget, shown apart.
        """
        root = aliased(TaskRun)
        used = func.coalesce(func.sum(func.coalesce(TaskRun.tokens_in, 0) + func.coalesce(TaskRun.tokens_out, 0)), 0)
        return (
            select(root.agent_id, used)
            .select_from(TaskRun)
            .join(root, or_(TaskRun.id == root.id, TaskRun.parent_run_id == root.id))
            .where(
                root.agent_id.is_not(None),
                root.parent_run_id.is_(None),
                root.started_at >= since,
                root.role != RunRole.evaluate.value,
            )
            .group_by(root.agent_id)
        ), root

    async def tokens_by_agent(self, session: AsyncSession, *, graph_id: str, since: datetime) -> dict[str, int]:
        """``{agent_id: tokens}`` over a window — what the list draws against
        the month budget.

        A grouped read, never a counter column: a counter can disagree with the
        runs it counts. It rides ``ix_task_runs_agent_started``, which is why
        the window is on ``started_at`` and not on ``queued_at`` — a run that
        queued in March and ran in April used April's tokens. An agent with no
        run in the window is absent; a reader takes that as ``0``.
        """
        stmt, root = self._agent_tokens(since)
        rows = await session.execute(stmt.where(root.graph_id == graph_id))
        return {agent_id: int(total) for agent_id, total in rows.all() if agent_id}

    async def tokens_for_agent(self, session: AsyncSession, *, agent_id: str, since: datetime) -> int:
        """One agent's :meth:`tokens_by_agent`, ``0`` when it ran nothing."""
        stmt, root = self._agent_tokens(since)
        row = (await session.execute(stmt.where(root.agent_id == agent_id))).first()
        return int(row[1]) if row else 0

    async def root_count_for_agent(self, session: AsyncSession, *, agent_id: str, since: datetime) -> int:
        """Runs this agent opened since ``since`` — roots only, by when they
        queued, so a run still waiting for a slot is counted."""
        stmt = (
            select(func.count())
            .select_from(TaskRun)
            .where(TaskRun.agent_id == agent_id, TaskRun.parent_run_id.is_(None), TaskRun.queued_at >= since)
        )
        return int((await session.execute(stmt)).scalar_one())

    async def agent_roots_since(self, session: AsyncSession, *, agent_id: str, since: datetime) -> list[TaskRun]:
        """This agent's root runs queued since ``since``, oldest first — eval runs left out."""
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.agent_id == agent_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.role != RunRole.evaluate.value,
                TaskRun.queued_at >= since,
            )
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def agent_recent_roots(self, session: AsyncSession, *, agent_id: str, limit: int) -> list[TaskRun]:
        """This agent's newest root runs — eval runs left out."""
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.agent_id == agent_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.role != RunRole.evaluate.value,
            )
            .order_by(TaskRun.queued_at.desc())
            .limit(limit)
        )
        return list((await session.execute(stmt)).scalars().all())

    async def agent_model_first_seen(self, session: AsyncSession, *, agent_id: str) -> dict[str, datetime]:
        """``{model_version: first queued}`` over this agent's roots and their steps, all time."""
        root = aliased(TaskRun)
        stmt = (
            select(TaskRun.model_version, func.min(root.queued_at))
            .select_from(TaskRun)
            .join(root, or_(TaskRun.id == root.id, TaskRun.parent_run_id == root.id))
            .where(
                root.agent_id == agent_id,
                root.parent_run_id.is_(None),
                root.role != RunRole.evaluate.value,
                TaskRun.model_version.is_not(None),
            )
            .group_by(TaskRun.model_version)
        )
        return {version: at for version, at in (await session.execute(stmt)).all() if version}

    async def delegated_agents(self, session: AsyncSession, *, run_ids: list[str]) -> dict[str, set[str]]:
        """``{root_id: agent ids}`` its steps delegated to — the two hops
        :meth:`children_of_nodes` reads, for many roots at once."""
        if not run_ids:
            return {}
        node = aliased(TaskRun)
        stmt = (
            select(node.parent_run_id, TaskRun.agent_id)
            .select_from(TaskRun)
            .join(node, TaskRun.parent_run_id == node.id)
            .where(node.parent_run_id.in_(run_ids), TaskRun.agent_id.is_not(None))
            .distinct()
        )
        out: dict[str, set[str]] = {}
        for root_id, agent_id in (await session.execute(stmt)).all():
            out.setdefault(root_id, set()).add(agent_id)
        return out

    async def roots_offered(
        self, session: AsyncSession, *, graph_id: str, version_ids: list[str], since: datetime
    ) -> list[TaskRun]:
        """Root runs queued since ``since`` whose prompt — on the root or one of
        its steps — carried any of these skill versions. Eval runs left out.

        The match is the quoted-substring test :meth:`skill_version_counts` explains.
        """
        if not version_ids:
            return []
        step = aliased(TaskRun)
        offered = or_(*[step.skills_offered.cast(Text).like(f'%"{v}"%') for v in version_ids])
        on_root = or_(*[TaskRun.skills_offered.cast(Text).like(f'%"{v}"%') for v in version_ids])
        on_step = exists().where(step.parent_run_id == TaskRun.id, offered)
        stmt = (
            select(TaskRun)
            .where(
                TaskRun.graph_id == graph_id,
                TaskRun.parent_run_id.is_(None),
                TaskRun.role != RunRole.evaluate.value,
                TaskRun.queued_at >= since,
                or_(on_root, on_step),
            )
            .order_by(TaskRun.queued_at)
        )
        return list((await session.execute(stmt)).scalars().all())

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
                TaskRun.flow_key == "skill-draft",
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
            TaskRun.flow_key == "skill-draft",
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

    async def roots_for_plan(
        self, session: AsyncSession, *, graph_id: str, origin: str, plan_ids: list[str], since: datetime
    ) -> list[TaskRun]:
        """The roots that executed one library plan since *since*, newest first.

        Two ways in, because a plan is run two ways: by name (``plan_origin``)
        and inlined into a skill's plan (``flow_id`` of a plan that copied
        its rows) — [LB36](docs/for-developers/modules/workflows/features/the-library.md).
        """
        by = TaskRun.plan_origin == origin
        if plan_ids:
            by = or_(by, TaskRun.flow_id.in_(plan_ids))
        stmt = (
            select(TaskRun)
            .where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_(None), TaskRun.queued_at >= since, by)
            .order_by(TaskRun.queued_at.desc())
        )
        return list((await session.execute(stmt)).scalars().all())

    # ── the effect after a change (change-log.md) ─────────────────────────────

    async def effect_of_steps(
        self, session: AsyncSession, *, graph_id: str, offered: str, version_id: str
    ) -> tuple[int, int, int, int]:
        """``(runs, failed, tokens_in, tokens_out)`` over the steps offered one
        skill or rule version. ``offered`` is ``"skills"`` or ``"rules"``.

        The step is the unit here, because the step is what was offered the
        version and what spent the tokens. The match is the quoted-substring
        test :meth:`skill_version_counts` explains.
        """
        column = TaskRun.skills_offered if offered == "skills" else TaskRun.rules_offered
        stmt = select(
            func.count(),
            func.count().filter(TaskRun.status == RunStatus.failed.value),
            func.coalesce(func.sum(TaskRun.tokens_in), 0),
            func.coalesce(func.sum(TaskRun.tokens_out), 0),
        ).where(
            TaskRun.graph_id == graph_id,
            TaskRun.parent_run_id.is_not(None),
            column.cast(Text).like(f'%"{version_id}"%'),
        )
        runs, failed, tokens_in, tokens_out = (await session.execute(stmt)).one()
        return int(runs or 0), int(failed or 0), int(tokens_in or 0), int(tokens_out or 0)

    async def effect_of_roots(
        self,
        session: AsyncSession,
        *,
        graph_id: str | None,
        agent: tuple[str, int] | None = None,
        plan: tuple[str, str] | None = None,
        run_ids: list[str] | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[int, int, int, int]:
        """``(runs, failed, tokens_in, tokens_out)`` over the roots that ran on
        one version — tokens summed over each root and its own steps.

        Exactly one way in: ``agent`` is ``(agent_id, agent_version)``; ``plan``
        is ``(flow_id, "template:<key>@<v>")``, the two ways a library plan
        is run (:meth:`roots_for_plan`); ``run_ids`` names the roots outright —
        a dataset version's bind loads, in any Graph, so ``graph_id`` is None;
        none of these is the Graph's roots queued in ``[since, until)``, the
        window a model version was published for.
        """
        where = [TaskRun.parent_run_id.is_(None)]
        if graph_id is not None:
            where.append(TaskRun.graph_id == graph_id)
        if run_ids is not None:
            if not run_ids:
                return 0, 0, 0, 0
            where.append(TaskRun.id.in_(run_ids))
        elif agent is not None:
            where += [TaskRun.agent_id == agent[0], TaskRun.agent_version == agent[1]]
        elif plan is not None:
            where.append(or_(TaskRun.flow_id == plan[0], TaskRun.plan_origin == plan[1]))
        if since is not None:
            where.append(TaskRun.queued_at >= since)
        if until is not None:
            where.append(TaskRun.queued_at < until)

        runs, failed = (
            await session.execute(
                select(func.count(), func.count().filter(TaskRun.status == RunStatus.failed.value)).where(*where)
            )
        ).one()
        if not runs:
            return 0, 0, 0, 0
        # Same table inside and out, so correlation is switched off explicitly.
        roots = select(TaskRun.id).where(*where).correlate(None)
        tokens_in, tokens_out = (
            await session.execute(
                select(
                    func.coalesce(func.sum(TaskRun.tokens_in), 0),
                    func.coalesce(func.sum(TaskRun.tokens_out), 0),
                ).where(or_(TaskRun.id.in_(roots), TaskRun.parent_run_id.in_(roots)))
            )
        ).one()
        return int(runs), int(failed or 0), int(tokens_in or 0), int(tokens_out or 0)

    async def journal_roots(
        self,
        session: AsyncSession,
        *,
        graph_ids: list[str],
        kinds: list[str] | None,
        exclude_triggers: tuple[str, ...],
        since: datetime | None = None,
        statuses: list[str] | None = None,
    ) -> list[TaskRun]:
        """The root runs the journal lists, in *graph_ids*, queued at or after *since*
        or — with *statuses* — standing in one of them, whenever queued."""
        if not graph_ids:
            return []
        stmt = select(TaskRun).where(
            TaskRun.graph_id.in_(graph_ids),
            TaskRun.parent_run_id.is_(None),
            TaskRun.triggered_by.not_in(exclude_triggers),
        )
        if kinds:
            stmt = stmt.where(TaskRun.ask_kind.in_(kinds))
        if since is not None:
            stmt = stmt.where(TaskRun.queued_at >= since)
        if statuses is not None:
            stmt = stmt.where(TaskRun.status.in_(statuses))
        return list((await session.execute(stmt)).scalars())

    async def page_roots(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        params: ListParams,
        created_after: datetime | None = None,
    ) -> tuple[Sequence[TaskRun], PageInfo]:
        """One page of the Graph's root runs — the Runs list.

        The unfiltered list is the default view: every root a person reads the
        journal for, so canvas and system runs are outside it. ``interactive``
        brings them in; naming an ``origin`` asks for exactly those triggers,
        canvas and system included. ``candidates`` is a generated plan that has
        a recorded plan, that Verify said served, and that no library entry
        names as its origin. ``created_after`` is the ``since`` window, resolved
        by the caller.
        """
        roots = select(TaskRun).where(TaskRun.graph_id == graph_id, TaskRun.parent_run_id.is_(None))
        unfiltered = roots.where(TaskRun.triggered_by.not_in(INTERACTIVE))
        origins = params.values("origin")
        stmt = roots if origins or params.one("interactive") else unfiltered
        if origins:
            stmt = stmt.where(TaskRun.triggered_by.in_(origins))
        if statuses := params.values("status"):
            stmt = stmt.where(TaskRun.status.in_(statuses))
        if agent_ids := params.values("agent_id"):
            stmt = stmt.where(TaskRun.agent_id.in_(agent_ids))
        if task_ids := params.values("task_id"):
            stmt = stmt.where(TaskRun.todo_id.in_(task_ids))
        if kinds := params.values("kind"):
            stmt = stmt.where(TaskRun.ask_kind.in_(kinds))
        if starters := params.values("started_by"):
            stmt = stmt.where(TaskRun.author_id.in_(starters))
        if created_after is not None:
            stmt = stmt.where(TaskRun.created_at >= created_after)
        if params.one("candidates"):
            verify = aliased(TaskRun)
            served = exists().where(
                verify.parent_run_id == TaskRun.id,
                verify.task_key == "plan.verify",
                verify.output["served"].as_string() == "yes",
            )
            promoted = exists().where(Flow.promoted_from_run_id == TaskRun.id)
            stmt = stmt.where(TaskRun.plan_origin == "generated", TaskRun.plan_snapshot.is_not(None), served, ~promoted)
        if params.q:
            stmt = stmt.where(contains(params.q, TaskRun.body))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"created_at": TaskRun.created_at},
            id_column=TaskRun.id,
        )

    async def node_tokens(self, session: AsyncSession, *, run_ids: list[str]) -> dict[str, int]:
        """Each run's direct nodes' tokens so far, by run — for runs not yet settled."""
        if not run_ids:
            return {}
        stmt = (
            select(TaskRun.parent_run_id, func.coalesce(func.sum(TaskRun.tokens), 0))
            .where(TaskRun.parent_run_id.in_(run_ids))
            .group_by(TaskRun.parent_run_id)
        )
        return {run_id: int(n) for run_id, n in (await session.execute(stmt)).all()}

    async def add(self, session: AsyncSession, run: TaskRun) -> TaskRun:
        session.add(run)
        await session.flush()
        return run
