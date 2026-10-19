"""The change log — every version of a versioned record
(docs/for-developers/modules/operate/features/change-log.md).

A change is the event that minted a version; the versions themselves stay in
the tables that already hold them. So a record's history is assembled, never
stored: the version rows say *what*, the minting events say *who, when and
why*, and the runs say *what happened after*.

Six kinds, each read from its own place:

==========  ==========================  =================================
kind        versions                    effect after
==========  ==========================  =================================
``skill``   ``skill_versions``          steps offered the version
``rule``    ``rule_versions``           steps offered the version
``plan``    ``task_plans`` by key       roots run on that plan version
``agent``   its update events           roots run on that agent version
``model``   ``graph_versions``          the Graph's roots while published
``dataset`` ``dataset_versions``        the loads that bound the version
==========  ==========================  =================================

An agent keeps no version rows, so its versions — and what changed in each —
are read back from the ``diff`` its update events carry. A model is not pinned
on runs, so its effect is a window and says so (``basis="window"``). A dataset
belongs to no Graph: it is read with ``graph_id=None``, and its effect is the
bind loads its ``dataset.bind`` events name, in any Graph (``basis="bound"``).

Usage::

    changes = ChangeLogManager()
    history = await changes.history(session, graph_id=g.id, record_kind="skill", record_id=skill.id)
    compare = await changes.compare(session, graph_id=g.id, record_kind="skill", record_id=skill.id, a="1", b="3")

A record in another Graph, a kind that is not versioned, or a dataset read
under a Graph (or a Graph's record read without one) raises ``NotFoundError`` —
absent, never forbidden. Who may read a dataset is the caller's check, made
before it asks.

Band 4: it reads ``events`` (core), every app's version rows, and ``task_runs``
(runtime) — which no lower band may join.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from difflib import unified_diff
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.schemas import ChangeCompare, ChangeEffect, ChangeEntry, ChangeField, RecordHistory, RecordsSummary
from invana.apps.agents.managers import AgentManager
from invana.apps.datasets.content import records_summary
from invana.apps.datasets.querysets import DatasetQuerySet, DatasetRecordQuerySet, DatasetVersionQuerySet
from invana.apps.modeller.models import GraphVersion
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import compute_diff
from invana.apps.skills.managers import RuleManager, SkillManager
from invana.apps.skills.querysets.rule import RuleVersionQuerySet
from invana.apps.skills.querysets.skill_version import SkillVersionQuerySet
from invana.apps.task_plans.diff import diff_arguments, diff_steps, summarise
from invana.apps.task_plans.models import TaskPlan
from invana.apps.task_plans.querysets.task_plan import TaskPlanQuerySet
from invana.apps.task_plans.schemas import PlanVersionDiff
from invana.core.auth.querysets.user import UserQuerySet
from invana.core.errors import NotFoundError
from invana.core.events import actions
from invana.core.events.models import ActorKind, Event
from invana.core.events.querysets import EventQuerySet
from invana.runtime.querysets.task_run import TaskRunQuerySet

#: The record kinds and the event ``target_kind`` each one's changes carry.
TARGETS: dict[str, str] = {
    "skill": actions.TARGET_SKILL,
    "rule": actions.TARGET_RULE,
    "plan": actions.TARGET_WORKFLOW,
    "agent": actions.TARGET_AGENT,
    "model": actions.TARGET_MODEL,
    "dataset": actions.TARGET_DATASET,
}

# The kinds above Graphs, read with ``graph_id=None``.
_ABOVE_GRAPHS = frozenset({"dataset"})

# A dataset version's fields that compare as before → after.
_DATASET_FIELDS = ("licence", "author_chain", "columns")

# A skill version's text — the fields a step was offered.
_SKILL_TEXT = ("description", "content", "when_to_use")

# Creates that mint v1 without saying so on the event.
_FIRST = frozenset({actions.SKILL_CREATE, actions.RULE_CREATE, actions.AGENT_CREATE})


@dataclass
class _Version:
    """One version, whichever table (or event) it came from."""

    label: str
    id: str | None
    at: datetime | None
    actor_id: str | None = None
    why: str | None = None
    #: The version row, or for an agent ``{field: {before, after}}``.
    row: Any = None
    events: list[Event] = field(default_factory=list)


@dataclass
class _Record:
    kind: str
    id: str
    name: str
    target_ids: list[str]
    #: Oldest first.
    versions: list[_Version]
    #: The plan's key, for a plan's ``template:<key>@<v>`` origin.
    extra: Any = None


def _text_lines(before: Any, after: Any, a: str | None, b: str) -> list[str]:
    if not isinstance(before or "", str) or not isinstance(after or "", str):
        return []
    return list(
        unified_diff(
            (before or "").splitlines(),
            (after or "").splitlines(),
            fromfile=f"v{a}" if a is not None else "(nothing)",
            tofile=f"v{b}",
            lineterm="",
        )
    )


def _field(name: str, before: Any, after: Any, a: str | None, b: str) -> ChangeField:
    return ChangeField(field=name, before=before, after=after, lines=_text_lines(before, after, a, b))


class ChangeLogManager:
    events_qs = EventQuerySet()
    users_qs = UserQuerySet()
    runs_qs = TaskRunQuerySet()
    plans_qs = TaskPlanQuerySet()
    skill_versions_qs = SkillVersionQuerySet()
    rule_versions_qs = RuleVersionQuerySet()
    datasets_qs = DatasetQuerySet()
    dataset_versions_qs = DatasetVersionQuerySet()
    dataset_records_qs = DatasetRecordQuerySet()
    skills = SkillManager()
    rules = RuleManager()
    agents = AgentManager()
    models = ModelStore()

    # ── the reads ────────────────────────────────────────────────────────────

    async def history(
        self, session: AsyncSession, *, graph_id: str | None, record_kind: str, record_id: str
    ) -> RecordHistory:
        """Every version of one record, newest first, each with who made it,
        why, a one-line summary against the version before it, and the effect
        after."""
        record = await self._load(session, graph_id=graph_id, kind=record_kind, record_id=record_id)
        user_ids = {self._actor(v)[0] for v in record.versions if self._actor(v)[1] == ActorKind.user}
        names = await self.users_qs.usernames_by_ids(session, sorted(i for i in user_ids if i))
        items: list[ChangeEntry] = []
        for i, version in enumerate(record.versions):
            previous = record.versions[i - 1] if i > 0 else None
            following = record.versions[i + 1] if i + 1 < len(record.versions) else None
            diff = await self._diff(session, record, previous, version)
            event = version.events[0] if version.events else None
            actor_id, actor_kind = self._actor(version)
            if actor_kind == ActorKind.user:
                actor_name = names.get(actor_id)
            else:
                actor_name = (event.details or {}).get("actor_name") if event is not None else None
            items.append(
                ChangeEntry(
                    version=version.label,
                    version_id=version.id,
                    at=version.at,
                    action=event.action if event is not None else None,
                    event_id=event.id if event is not None else None,
                    actor_id=actor_id,
                    actor_kind=actor_kind,
                    actor_name=actor_name,
                    why=self._why(version),
                    summary=diff.summary,
                    effect=await self._effect(session, graph_id, record, version, following),
                )
            )
        items.reverse()
        return RecordHistory(record_kind=record.kind, record_id=record.id, name=record.name, items=items)

    async def compare(
        self, session: AsyncSession, *, graph_id: str | None, record_kind: str, record_id: str, a: str | None, b: str
    ) -> ChangeCompare:
        """Two versions, from ``a`` to ``b``. ``a`` omitted is the version
        before ``b``; ``a`` newer than ``b`` reads the change backwards."""
        record = await self._load(session, graph_id=graph_id, kind=record_kind, record_id=record_id)
        to = self._find(record, b)
        if a is None:
            index = record.versions.index(to)
            source = record.versions[index - 1] if index > 0 else None
        else:
            source = self._find(record, a)
        return await self._diff(session, record, source, to)

    # ── loading a record's versions ──────────────────────────────────────────

    async def _load(self, session: AsyncSession, *, graph_id: str | None, kind: str, record_id: str) -> _Record:
        if kind not in TARGETS or (kind in _ABOVE_GRAPHS) != (graph_id is None):
            raise NotFoundError(f"'{kind}' is not a versioned record here.")
        record = await getattr(self, f"_load_{kind}")(session, graph_id, record_id)
        events = await self.events_qs.for_targets(
            session,
            graph_id=graph_id,
            target_kind=TARGETS[kind],
            target_ids=record.target_ids,
            actions=actions.CHANGE_ACTIONS_BY_TARGET[TARGETS[kind]],
        )
        by_label = {v.label: v for v in record.versions}
        for event in events:
            label = (event.details or {}).get("version")
            if label is None and event.action in _FIRST:
                label = 1
            version = by_label.get(str(label)) if label is not None else None
            if version is not None:
                version.events.append(event)
        return record

    async def _load_skill(self, session: AsyncSession, graph_id: str, record_id: str) -> _Record:
        skill = await self.skills.get(session, skill_id=record_id, graph_id=graph_id)
        rows = sorted(await self.skill_versions_qs.list_for_skill(session, skill.id), key=lambda r: r.version)
        versions = [_Version(str(r.version), r.id, r.published_at, r.published_by_id, row=r) for r in rows]
        return _Record("skill", skill.id, skill.name, [skill.id], versions)

    async def _load_rule(self, session: AsyncSession, graph_id: str, record_id: str) -> _Record:
        rule = await self.rules.get(session, rule_id=record_id, graph_id=graph_id)
        rows = sorted(await self.rule_versions_qs.list_for_rule(session, rule.id), key=lambda r: r.version)
        versions = [_Version(str(r.version), r.id, r.published_at, r.published_by_id, row=r) for r in rows]
        return _Record("rule", rule.id, rule.statement, [rule.id], versions)

    async def _load_plan(self, session: AsyncSession, graph_id: str, record_id: str) -> _Record:
        rows = await self.plans_qs.versions_of(session, graph_id=graph_id, key=record_id)
        if not rows:
            raise NotFoundError("Plan not found.")
        versions = [
            _Version(
                str(r.version), r.id, r.created_at, r.created_by_id if r.created_by_kind == "user" else None, row=r
            )
            for r in sorted(rows, key=lambda r: r.version)
        ]
        return _Record("plan", record_id, rows[-1].name or record_id, [r.id for r in rows], versions, extra=record_id)

    async def _load_agent(self, session: AsyncSession, graph_id: str, record_id: str) -> _Record:
        """An agent's versions are its events: the create is v1, and each
        update or voice change carries the version it bumped to, with ``diff``.
        """
        agent = await self.agents.get_or_404(session, agent_id=record_id, graph_id=graph_id)
        events = await self.events_qs.for_targets(
            session,
            graph_id=graph_id,
            target_kind=actions.TARGET_AGENT,
            target_ids=[agent.id],
            actions=actions.CHANGE_ACTIONS_BY_TARGET[actions.TARGET_AGENT],
        )
        versions: dict[str, _Version] = {"1": _Version("1", None, agent.created_at, row={})}
        for event in events:
            details = event.details or {}
            label = "1" if event.action == actions.AGENT_CREATE else str(details.get("version") or "")
            if not label:
                continue
            version = versions.setdefault(label, _Version(label, None, event.created_at, row={}))
            # An edit touching the voice and the rest is two events on one
            # version; the fields of both fold into it. A field named but not
            # diffed predates ``diff`` and reads as not recorded.
            recorded = details.get("diff") or {}
            for name in details.get("changed") or []:
                version.row[name] = recorded.get(name, {"before": None, "after": None})
        ordered = sorted(versions.values(), key=lambda v: int(v.label))
        return _Record("agent", agent.id, agent.name, [agent.id], ordered)

    async def _load_model(self, session: AsyncSession, graph_id: str, record_id: str) -> _Record:
        model = await self.models.get_graph_model(session, record_id)
        if model is None or model.graph_id != graph_id:
            raise NotFoundError("Model not found.")
        rows = [r for r in await self.models.list_versions(session, model.id) if r.status != "draft" and r.version]
        rows.sort(key=lambda r: r.activated_at or r.created_at)
        versions = [
            _Version(r.version, r.id, r.activated_at or r.created_at, why=r.change_summary or None, row=r) for r in rows
        ]
        return _Record("model", model.id, model.name, [model.id], versions)

    async def _load_dataset(self, session: AsyncSession, graph_id: None, record_id: str) -> _Record:
        dataset = await self.datasets_qs.get(session, record_id)
        if dataset is None:
            raise NotFoundError("Dataset not found.")
        rows = sorted(await self.dataset_versions_qs.list_for_dataset(session, dataset.id), key=lambda r: r.version)
        versions = [_Version(str(r.version), r.id, r.published_at, r.published_by_id, why=r.why, row=r) for r in rows]
        return _Record("dataset", dataset.id, dataset.address, [dataset.id], versions)

    # ── one version's parts ──────────────────────────────────────────────────

    @staticmethod
    def _find(record: _Record, label: str) -> _Version:
        for version in record.versions:
            if version.label == label:
                return version
        raise NotFoundError(f"Version {label} of this {record.kind} not found.")

    @staticmethod
    def _actor(version: _Version) -> tuple[str | None, ActorKind | None]:
        if version.events:
            return version.events[0].actor_id, version.events[0].actor_kind
        if version.actor_id is not None:
            return version.actor_id, ActorKind.user
        return None, None

    @staticmethod
    def _why(version: _Version) -> str | None:
        for event in version.events:
            why = (event.details or {}).get("why")
            if why:
                return why
        return version.why

    async def _effect(
        self,
        session: AsyncSession,
        graph_id: str | None,
        record: _Record,
        version: _Version,
        following: _Version | None,
    ) -> ChangeEffect:
        until = following.at if following is not None else None
        basis = "pinned"
        if record.kind in ("skill", "rule"):
            counts = await self.runs_qs.effect_of_steps(
                session, graph_id=graph_id, offered=f"{record.kind}s", version_id=version.id or ""
            )
        elif record.kind == "plan":
            counts = await self.runs_qs.effect_of_roots(
                session, graph_id=graph_id, plan=(version.id or "", f"template:{record.extra}@{version.label}")
            )
        elif record.kind == "agent":
            counts = await self.runs_qs.effect_of_roots(
                session, graph_id=graph_id, agent=(record.id, int(version.label))
            )
        elif record.kind == "dataset":
            basis = "bound"
            counts = await self.runs_qs.effect_of_roots(
                session, graph_id=None, run_ids=await self._bind_runs(session, record, version)
            )
        else:
            basis = "window"
            counts = await self.runs_qs.effect_of_roots(session, graph_id=graph_id, since=version.at, until=until)
        runs, failed, tokens_in, tokens_out = counts
        return ChangeEffect(
            basis=basis,
            runs=runs,
            failed=failed,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            tokens=tokens_in + tokens_out,
            tokens_per_run=round((tokens_in + tokens_out) / runs) if runs else None,
            since=version.at,
            until=until,
        )

    async def _bind_runs(self, session: AsyncSession, record: _Record, version: _Version) -> list[str]:
        """The load runs the ``dataset.bind`` events of one version name, in
        every Graph — read from the events, because a binding moved to a later
        version no longer holds this one."""
        events = await self.events_qs.for_targets(
            session,
            graph_id=None,
            any_graph=True,
            target_kind=actions.TARGET_DATASET,
            target_ids=[record.id],
            actions=frozenset({actions.DATASET_BIND}),
        )
        runs = [
            (e.details or {}).get("run_id") for e in events if str((e.details or {}).get("version")) == version.label
        ]
        return sorted({r for r in runs if r})

    async def _records(self, session: AsyncSession, version: _Version | None) -> dict[str, Any]:
        if version is None:
            return {}
        rows = await self.dataset_records_qs.all_for_version(session, version.id or "")
        return {r.key: (r.values, r.provenance) for r in rows}

    # ── the diff ─────────────────────────────────────────────────────────────

    async def _diff(self, session: AsyncSession, record: _Record, a: _Version | None, b: _Version) -> ChangeCompare:
        la = a.label if a is not None else None
        fields: list[ChangeField] = []
        plan = None
        schema_diff = None
        records = None

        if record.kind == "skill":
            for name in _SKILL_TEXT:
                before = getattr(a.row, name) if a is not None else ""
                after = getattr(b.row, name)
                if before != after:
                    fields.append(_field(name, before, after, la, b.label))
            if a is not None and a.row.plan_id != b.row.plan_id:
                prior = await self.plans_qs.get(session, a.row.plan_id)
                current = await self.plans_qs.get(session, b.row.plan_id)
                if prior is not None and current is not None:
                    plan = await self._plan_diff(session, prior, current, key=current.key or "")
        elif record.kind == "rule":
            before = a.row.statement if a is not None else ""
            if before != b.row.statement:
                fields.append(_field("statement", before, b.row.statement, la, b.label))
        elif record.kind == "plan":
            if a is not None:
                plan = await self._plan_diff(session, a.row, b.row, key=record.id)
                if a.row.description != b.row.description:
                    fields.append(_field("description", a.row.description, b.row.description, la, b.label))
        elif record.kind == "agent":
            fields = self._agent_fields(record, a, b)
        elif record.kind == "dataset":
            for name in _DATASET_FIELDS:
                before = getattr(a.row, name) if a is not None else None
                after = getattr(b.row, name)
                if before != after:
                    fields.append(_field(name, before, after, la, b.label))
            added, removed, changed = records_summary(await self._records(session, a), await self._records(session, b))
            records = RecordsSummary(added=added, removed=removed, changed=changed)
        else:
            older = await self.models.get_version(session, a.id) if a is not None else GraphVersion()
            newer = await self.models.get_version(session, b.id)
            schema_diff = compute_diff(older, newer)

        return ChangeCompare(
            record_kind=record.kind,
            record_id=record.id,
            a=la,
            b=b.label,
            summary=self._summary(a, b, fields, plan, schema_diff, records),
            fields=fields,
            records=records,
            plan=plan,
            schema_diff=schema_diff,
        )

    @staticmethod
    def _agent_fields(record: _Record, a: _Version | None, b: _Version) -> list[ChangeField]:
        """Fold each version's field changes from ``a`` (exclusive) to ``b``.

        Read backwards when ``a`` is the newer one: the same fold over
        ``(b, a]``, with before and after swapped.
        """
        if a is None:
            return []
        backwards = int(a.label) > int(b.label)
        low, high = (b, a) if backwards else (a, b)
        span = [v for v in record.versions if int(low.label) < int(v.label) <= int(high.label)]
        folded: dict[str, dict[str, Any]] = {}
        for version in span:
            for name, change in version.row.items():
                if name not in folded:
                    folded[name] = {"before": change.get("before"), "after": change.get("after")}
                else:
                    folded[name]["after"] = change.get("after")
        out = []
        for name, change in folded.items():
            before, after = (change["after"], change["before"]) if backwards else (change["before"], change["after"])
            out.append(_field(name, before, after, a.label, b.label))
        return out

    async def _plan_diff(self, session: AsyncSession, prior: TaskPlan, plan: TaskPlan, *, key: str) -> PlanVersionDiff:
        added, removed, moved, changed, unchanged = diff_steps(
            await self.plans_qs.tasks_for(session, plan_id=prior.id),
            await self.plans_qs.tasks_for(session, plan_id=plan.id),
        )
        arguments = diff_arguments(dict(prior.args_schema or {}), dict(plan.args_schema or {}))
        return PlanVersionDiff(
            key=key,
            version=plan.version,
            against_version=prior.version,
            summary=summarise(added, removed, moved, changed, arguments),
            added=added,
            removed=removed,
            moved=moved,
            changed=changed,
            unchanged=unchanged,
            arguments=arguments,
        )

    @staticmethod
    def _summary(a, b, fields, plan, schema_diff, records) -> str:
        if a is None:
            return "the first version"
        if a is b:
            return "the same version"
        parts = [f"{f.field} changed" for f in fields]
        if records is not None and (records.added or records.removed or records.changed):
            parts.insert(0, f"{records.added} added · {records.removed} removed · {records.changed} changed")
        if plan is not None and plan.summary != "the same steps":
            parts.append(f"plan: {plan.summary}")
        if schema_diff is not None:
            counts = [
                (len(schema_diff.added_node_types), "node types added"),
                (len(schema_diff.removed_node_types), "node types removed"),
                (len(schema_diff.modified_node_types), "node types changed"),
                (len(schema_diff.added_edge_types), "edge types added"),
                (len(schema_diff.removed_edge_types), "edge types removed"),
                (len(schema_diff.modified_edge_types), "edge types changed"),
                (len(schema_diff.added_property_keys), "property keys added"),
                (len(schema_diff.removed_property_keys), "property keys removed"),
            ]
            parts += [f"{n} {label}" for n, label in counts if n]
            if parts:
                parts.insert(0, schema_diff.classification)
        return " · ".join(parts) if parts else "no change"
