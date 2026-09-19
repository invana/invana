"""The activity tree for one task (docs/for-developers/modules/operate/features/audit-and-activity.md).

*Who did what, for whom, caused by what* — assembled from two sources and one
shape. ``events`` supplies the domain writes and the causal edges
(``parent_event_id``); ``run_nodes`` supplies the attempts, with the skills
each was offered and reported applying. A delegated child's run nests under
the step that opened it, via ``parent_run_id``.

The tree is **never** built from ``trace_id``: OTel retention is days, and this
is the record.

Band 4: it joins ``events`` (core), ``run_nodes`` (runtime) and the agent,
skill and user names (apps). No single one of those bands may reach the others,
which is why the reader is its own band (migration-plan §13.4).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.models import Agent
from invana.apps.skills.models import Skill
from invana.apps.work.schemas import ActivityNode, TaskActivityResponse
from invana.core.auth.models import User
from invana.core.events.models import ActorKind, Event
from invana.runtime.models import TaskRun

# What a step's payload can no longer show once the stream has aged out
# (docs/for-developers/modules/ask/spec.md). The step row itself survives — only the emission detail goes.
_EXPIRED = "expired after 30 d"


class TreeManager:
    async def for_task(self, session: AsyncSession, *, task_id: str) -> TaskActivityResponse:
        events = list(
            (await session.execute(select(Event).where(Event.task_id == task_id).order_by(Event.created_at, Event.id)))
            .scalars()
            .all()
        )
        runs = list(
            (await session.execute(select(TaskRun).where(TaskRun.todo_id == task_id).order_by(TaskRun.queued_at)))
            .scalars()
            .all()
        )
        # Children of those runs — a delegation's run has the *parent's*
        # task id copied down, but a defensive second pass keeps a child written by
        # an older path from vanishing from the tree.
        known = {t.id for t in runs}
        frontier = list(known)
        while frontier:
            children = list(
                (await session.execute(select(TaskRun).where(TaskRun.parent_run_id.in_(frontier)))).scalars().all()
            )
            frontier = [c.id for c in children if c.id not in known]
            for child in children:
                if child.id not in known:
                    known.add(child.id)
                    runs.append(child)

        steps = (
            list(
                (
                    await session.execute(
                        select(TaskRun)
                        .where(TaskRun.parent_run_id.in_(list(known)))
                        .order_by(TaskRun.seq, TaskRun.attempt)
                    )
                )
                .scalars()
                .all()
            )
            if known
            else []
        )

        names = await _principal_names(session, events=events, runs=runs)
        skill_names = await _skill_names(session, steps=steps)

        nodes: dict[str, ActivityNode] = {}
        for event in events:
            nodes[event.id] = ActivityNode(
                id=event.id,
                kind="event",
                action=event.action,
                label=event.action,
                detail=_event_detail(event, names),
                actor_kind=event.actor_kind.value if isinstance(event.actor_kind, ActorKind) else str(event.actor_kind),
                actor_id=event.actor_id,
                actor_name=names.get(event.actor_id or "") or event.details.get("actor_name"),
                on_behalf_of_name=names.get(event.on_behalf_of_user_id or ""),
                run_id=event.run_id,
                at=event.created_at,
            )

        # Steps hang off the event that opened their run; when that event is
        # missing (an older row) they hang off the tree root rather than vanishing.
        run_anchor: dict[str, str | None] = {}
        for run in runs:
            anchor = next((e.id for e in events if e.run_id == run.id), None)
            run_anchor[run.id] = anchor

        step_nodes: dict[str, ActivityNode] = {}
        for step in steps:
            node = ActivityNode(
                id=step.id,
                kind="step",
                action=f"step.{step.task_key}",
                label=step.label,
                detail=step.detail,
                status=step.status,
                run_id=step.parent_run_id,
                skills_offered=[skill_names.get(s, s) for s in (step.skills_offered or [])],
                skills_applied=[skill_names.get(s, s) for s in (step.skills_applied or [])],
                tokens_in=step.tokens_in,
                tokens_out=step.tokens_out,
                at=step.started_at,
            )
            if step.output is None and step.finished_at is not None and step.status == "succeeded":
                node.detail = node.detail or _EXPIRED
            step_nodes[step.id] = node

        # A delegated run's nodes nest under the node that delegated it, which
        # is simply its parent — the merge made the chain one edge.
        child_parent_step = {t.id: t.parent_run_id for t in runs if t.parent_run_id}

        roots: list[ActivityNode] = []
        for event in events:
            node = nodes[event.id]
            parent = nodes.get(event.parent_event_id or "")
            (parent.children if parent is not None else roots).append(node)

        for step in steps:
            node = step_nodes[step.id]
            owner = child_parent_step.get(step.parent_run_id)
            if owner and owner in step_nodes:
                step_nodes[owner].children.append(node)
                continue
            anchor = run_anchor.get(step.parent_run_id)
            (nodes[anchor].children if anchor and anchor in nodes else roots).append(node)

        return TaskActivityResponse(task_id=task_id, nodes=roots)


def _event_detail(event: Event, names: dict[str, str]) -> str:
    details = event.details or {}
    if event.action.endswith(".assign"):
        who = details.get("assignee_name") or names.get(details.get("assignee_id") or "", "")
        return f"→ {who}" if who else ""
    if event.action.endswith(".result"):
        return str(details.get("summary") or "")[:160]
    if event.action.endswith(".reject"):
        return str(details.get("note") or "")[:160]
    if "cause" in details:
        return f"caused by {details['cause']}"
    changed = details.get("changed")
    if isinstance(changed, dict) and changed:
        return ", ".join(sorted(changed))
    return ""


async def _principal_names(session: AsyncSession, *, events: list[Event], runs: list[TaskRun]) -> dict[str, str]:
    """Resolve every id the tree prints, in two queries rather than N."""
    ids: set[str] = set()
    for event in events:
        for candidate in (event.actor_id, event.on_behalf_of_user_id, (event.details or {}).get("assignee_id")):
            if isinstance(candidate, str):
                ids.add(candidate)
    for run in runs:
        for candidate in (run.agent_id, run.on_behalf_of_user_id):
            if candidate:
                ids.add(candidate)
    if not ids:
        return {}

    out: dict[str, str] = {}
    users = (await session.execute(select(User).where(User.id.in_(list(ids))))).scalars().all()
    for user in users:
        out[user.id] = user.username
    agents = (await session.execute(select(Agent).where(Agent.id.in_(list(ids))))).scalars().all()
    for agent in agents:
        out[agent.id] = agent.name
    return out


async def _skill_names(session: AsyncSession, *, steps: list[TaskRun]) -> dict[str, str]:
    ids: set[str] = set()
    for step in steps:
        ids.update(step.skills_offered or [])
        ids.update(step.skills_applied or [])
    if not ids:
        return {}
    rows = (await session.execute(select(Skill.id, Skill.name).where(Skill.id.in_(list(ids))))).all()
    return dict(rows)
