"""A skill version and the plan it owns — the composition, one band up.

Lives in ``runtime`` for the same reason
:mod:`invana.runtime.managers.skill_usage` does: it reads and writes rows from
**two** apps. ``apps/skills`` cannot import ``apps/task_plans`` — that package
imports ``apps/agents``, which imports ``apps/skills``, and the import-linter
refuses the cycle — so the manager that needs both lives above both
(migration-plan §3).

What it holds:

* **Every version owns exactly one plan** ([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
  A draft is written *with* its plan, so no surface branches on *does this have
  a flow*.
* **A new plan starts as one ``form: human`` node**
  ([SK22](docs/for-developers/modules/skills/features/authoring-a-skill.md)) — a
  catalogue gap, an unrun planner and a half-written playbook are the same
  shape: *a person does this step*.
* **A redraw is a revision** ([SK12](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
  a draft opened over a published version starts as a **copy** of that version's
  plan, so the diff a person reads is against what was there.
* **Composition is drawn.** A sentence may name a reusable library plan as
  its reading; the draw copies that plan's rows in, flat, each naming the plan
  and step it came from, and validates them with every other step. Nobody
  writes plan rows by hand: a plan that reads wrong is fixed in the prose.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.registry import LABELS
from invana.apps.govern.managers import LLMEndpointManager
from invana.apps.llm.draft import PLAN_PREFIX
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.models import Skill, SkillVersion, SkillVersionClarification
from invana.apps.skills.querysets import SkillClarificationQuerySet
from invana.apps.skills.schemas import (
    InlinablePlan,
    PlanUseRead,
    SkillClarificationRead,
    SkillCreate,
    SkillDraftRead,
    SkillDrawRefusal,
    SkillPlanRead,
    SkillPlanSummary,
    SkillRead,
    SkillUpdate,
    SkillVersionPublish,
    SkillVersionRead,
)
from invana.apps.task_plans.args import ArgError, check_tuning
from invana.apps.task_plans.args import resolve as resolve_args
from invana.apps.task_plans.dag import dag_for
from invana.apps.task_plans.managers.task_plan import TaskPlanManager, explode
from invana.apps.task_plans.models import PlanKind, PlanOrigin, Task, TaskForm, TaskPlan
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.plugins import load_plugins
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.layers import layer_for, ordered_layers
from invana.runtime.managers.evals import EvalManager
from invana.runtime.managers.skill_seed import BuiltinSkillSeeder
from invana.runtime.querysets import TaskRunQuerySet

#: The key of the node a plan starts life with.
FALLBACK_KEY = "do-it"

#: What an inlined plan's internal bindings look like, so they can be pointed at
#: the copies rather than at the originals.
_STEP_BINDING = re.compile(r"^\$\{steps\.([A-Za-z0-9_.]+)\.([A-Za-z0-9_.]+)\}$")


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


@dataclass(frozen=True, slots=True)
class Drawing:
    """What the planner reads before it draws: the prose, and what is settled."""

    version: SkillVersion
    graph_id: str
    name: str
    when_to_use: str
    content: str
    answered: dict[str, str]
    asked: int
    #: The digest of the text as it was read, stamped if this draw writes rows.
    digest: str = ""


@dataclass(frozen=True, slots=True)
class Drawn:
    """What a draw produced — rows, a question, or a rejection."""

    detail: str
    output: dict
    rejected: list[str] | None = None


class _Refused(Exception):
    """Reasons a draw is refused before the plan reaches the validator.

    Read like ``PlanRejected``, by its ``errors``, so both refusals settle the
    draw through one path.
    """

    def __init__(self, errors: list[str]) -> None:
        super().__init__("; ".join(errors))
        self.errors = errors


def _unique(key: str, seen: set[str]) -> str:
    """Sibling keys are unique inside a plan; a playbook may name one task twice."""
    candidate, n = key, 1
    while candidate in seen:
        n += 1
        candidate = f"{key}_{n}"
    seen.add(candidate)
    return candidate


#: The node fields a copied plan carries over — everything but identity and parent.
_COPIED_TASK_FIELDS = (
    "key",
    "form",
    "step_key",
    "task_version",
    "title",
    "body",
    "assignee_kind",
    "assignee_id",
    "ordinal",
    "when",
    "map_over",
    "timeout_s",
    "pool",
    "max_parallel",
    "on_lane_failure",
    "source_span",
    "source_plan_key",
    "source_step_key",
)


def _copy_task(task: Task, *, plan_id: str) -> Task:
    """One node of another plan, re-homed under ``plan_id``; JSON fields copied."""
    fields = {name: getattr(task, name) for name in _COPIED_TASK_FIELDS}
    return Task(
        task_plan_id=plan_id,
        args=dict(task.args or {}),
        depends_on=list(task.depends_on or []),
        loop=dict(task.loop) if task.loop else None,
        approval=dict(task.approval) if task.approval else None,
        retry=dict(task.retry) if task.retry else None,
        **fields,
    )


def _requires() -> dict[str, tuple[str, ...]]:
    return {key: entry.requires for key, entry in CATALOGUE.items()}


@dataclass(frozen=True, slots=True)
class PlanView:
    """What the Flow tab draws, and what the Playbook tab reads its spans from."""

    plan: TaskPlan
    nodes: list[dict]
    edges: list[dict]


class SkillDraftManager:
    """Stateless. The session is the first argument of every method."""

    skills = SkillManager()
    endpoints = LLMEndpointManager()
    plans_qs = TaskPlanQuerySet()
    clarifications_qs = SkillClarificationQuerySet()
    runs_qs = TaskRunQuerySet()
    seeder = BuiltinSkillSeeder()
    library = TaskPlanManager()
    evals = EvalManager()

    # ── reading a drawer ─────────────────────────────────────────────────────

    async def list_reads(self, session: AsyncSession, *, graph_id: str) -> list[SkillRead]:
        """Every skill in the Graph, seeded first.

        The seed runs here for the same reason the library's does: a Graph that
        has never listed its skills still has the product's own playbook, and
        the list is the first thing every surface asks for.
        """
        await self.seeder.ensure_seeded(session, graph_id=graph_id)
        skills = await self.skills.list_for_graph(session, graph_id=graph_id)
        drafts = await self.skills.versions_qs.drafts_for_skills(session, [s.id for s in skills])

        # The row summarises the plan that is **offered** — the head's — and
        # falls back to the draft's for a skill nothing has published yet.
        plan_ids: list[str] = []
        for skill in skills:
            head = skill.current_version
            draft = drafts.get(skill.id)
            plan_id = head.plan_id if head is not None else (draft.plan_id if draft is not None else None)
            if plan_id:
                plan_ids.append(plan_id)
        tasks_by_plan = await self.plans_qs.tasks_for_plans(session, plan_ids=plan_ids)
        plans = {p.id: p for p in [await self.plans_qs.get(session, pid) for pid in plan_ids] if p is not None}

        reads: list[SkillRead] = []
        for skill in skills:
            head = skill.current_version
            draft = drafts.get(skill.id)
            read = SkillRead.model_validate(skill)
            read.draft_version_id = draft.id if draft is not None else None
            plan_id = head.plan_id if head is not None else (draft.plan_id if draft is not None else None)
            plan = plans.get(plan_id or "")
            if plan is not None:
                tasks = tasks_by_plan.get(plan.id, [])
                read.plan = SkillPlanSummary(
                    plan_id=plan.id,
                    origin=plan.origin,
                    step_count=len(tasks),
                    layers=ordered_layers(layer_for(form=t.form, step_key=t.step_key) for t in tasks),
                )
            reads.append(read)
        return reads

    async def read_for(self, session: AsyncSession, *, skill: Skill) -> SkillRead:
        """One skill, with the same shape a row in the drawer has."""
        read = SkillRead.model_validate(skill)
        draft = await self.skills.get_draft(session, skill=skill)
        read.draft_version_id = draft.id if draft is not None else None
        version = skill.current_version or draft
        if version is not None:
            view = await self.view(session, version=version)
            read.plan = SkillPlanSummary(
                plan_id=view.plan.id,
                origin=view.plan.origin,
                step_count=len(view.nodes),
                layers=ordered_layers(n["layer"] for n in view.nodes),
            )
        return read

    async def plan_read(self, session: AsyncSession, *, version: SkillVersion) -> SkillPlanRead:
        view = await self.view(session, version=version)
        return SkillPlanRead(
            plan_id=view.plan.id,
            origin=view.plan.origin,
            nodes=view.nodes,
            edges=view.edges,
            layers=ordered_layers(n["layer"] for n in view.nodes),
            uses=await self._uses_read(session, plan=view.plan),
        )

    async def _uses_read(self, session: AsyncSession, *, plan: TaskPlan) -> list[PlanUseRead]:
        """What this plan composed, each saying whether the library has moved on.

        The row records the version it inlined; the newest is looked up beside
        it so the surface can **say** *a newer version exists*
        ([SK32](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        Saying it is the whole of it — nothing here re-inlines, because the copy
        is what makes a published skill do tomorrow what it did today.
        """
        out: list[PlanUseRead] = []
        for use in plan.uses or []:
            key = str(use.get("key", ""))
            version = int(use.get("version", 0))
            newest = await self.plans_qs.find_by_key(session, graph_id=plan.graph_id, key=key, version=None)
            out.append(
                PlanUseRead(
                    key=key,
                    version=version,
                    args=dict(use.get("args") or {}),
                    # A plan that has since been deleted leaves the row reading
                    # its own version, which is true: nothing newer is on offer.
                    latest_version=newest.version if newest is not None else version,
                )
            )
        return out

    # ── plans ────────────────────────────────────────────────────────────────

    async def _new_plan(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        name: str,
        origin: str,
        description: str = "",
        key: str | None = None,
    ) -> TaskPlan:
        """A plan a skill version owns: never listed in the library, never
        selected by an intent — ``reusable = False``, which is what keeps the
        Library a place of plans a person can choose (LB6).

        ``origin`` has no default on purpose: it is the fact the redraw warning
        rests on ([SK29](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
        so every caller states which of the three it is writing.
        """
        return await self.plans_qs.add(
            session,
            TaskPlan(
                graph_id=graph_id,
                key=key,
                version=1,
                name=name,
                description=description,
                kind=PlanKind.ask.value,
                origin=origin,
                intent=[],
                args_schema={},
                source_skill_version_ids=[],
                reusable=False,
                created_by_kind="user",
            ),
        )

    async def fallback_plan(self, session: AsyncSession, *, graph_id: str, name: str) -> TaskPlan:
        """One node, and it is a person's (SK15 · SK22).

        It is born ``generated``: nothing but the engine wrote this node, and
        a draw replaces it like any other drawn plan.
        """
        plan = await self._new_plan(session, graph_id=graph_id, name=name, origin=PlanOrigin.generated.value)
        await self.plans_qs.add_tasks(
            session,
            [
                Task(
                    task_plan_id=plan.id,
                    key=FALLBACK_KEY,
                    form=TaskForm.human.value,
                    step_key=None,
                    title=name,
                    ordinal=0,
                    args={},
                    depends_on=[],
                )
            ],
        )
        return plan

    async def copy_plan(self, session: AsyncSession, *, source_plan_id: str, graph_id: str, name: str) -> TaskPlan:
        """A new plan with the source plan's nodes, node for node, its origin
        and the library plans it composed.

        A draft starts as what the last version drew, so a redraw diffs against
        it; a rollback copies the version it restores. Every node field is
        copied, so the copy runs exactly as the source did.
        """
        source = await self.plans_qs.tasks_for(session, plan_id=source_plan_id)
        origin = await self.plans_qs.get(session, source_plan_id)
        plan = await self._new_plan(
            session,
            graph_id=graph_id,
            name=name,
            origin=(origin.origin if origin is not None else PlanOrigin.generated.value),
        )
        await self.plans_qs.add_tasks(session, [_copy_task(t, plan_id=plan.id) for t in source])
        if origin is not None:
            plan.uses = list(origin.uses or [])
            await session.flush()
        return plan

    async def rewrite(self, session: AsyncSession, *, version: SkillVersion, tasks: list[Task]) -> TaskPlan:
        """Replace a draft's nodes — what ``draft_plan`` writes. The rows go and
        come back rather than being patched:
        a redraw is a revision of the whole shape, not a merge (SK12)."""
        plan = await self.plans_qs.get(session, version.plan_id)
        if plan is None:  # pragma: no cover - a FK guarantees it
            raise NotFoundError("This version has no plan.")
        await self.plans_qs.clear_tasks(session, plan_id=plan.id)
        for ordinal, task in enumerate(tasks):
            task.task_plan_id = plan.id
            task.ordinal = ordinal
        await self.plans_qs.add_tasks(session, tasks)
        return plan

    async def inlinable(self, session: AsyncSession, *, graph_id: str) -> list[InlinablePlan]:
        """The library plans a skill may inline, newest version of each.

        Reusable only ([LB6](docs/for-developers/modules/workflows/features/the-library.md)):
        a one-off plan belongs to the Todo it was drafted for, and offering it
        here would make the library a log. Each row carries the bands it will
        touch and what it offers a caller, so picking and tuning are one read.
        """
        # Seeded on read, like every other reader of the library
        # (`select_plan_by_key`): a Graph whose library has never been listed
        # has no rows to offer, and a row seeded before its template declared
        # an argument holds `{}` while its own steps bind it.
        await self.library.ensure_seeded(
            session,
            graph_id=graph_id,
            flows=load_plugins().flows.values(),
            requires=_requires(),
            versions=load_plugins().versions(),
        )

        plans = await self.plans_qs.list_for_graph(session, graph_id=graph_id)
        newest: dict[str, TaskPlan] = {}
        for plan in plans:
            if not plan.reusable or not plan.key:
                continue
            held = newest.get(plan.key)
            if held is None or plan.version > held.version:
                newest[plan.key] = plan

        rows = await self.plans_qs.tasks_for_plans(session, plan_ids=[p.id for p in newest.values()])
        out: list[InlinablePlan] = []
        for plan in sorted(newest.values(), key=lambda p: p.key or ""):
            tasks = rows.get(plan.id) or []
            if not tasks:
                # LB11 — present is not populated, and an empty plan is not a
                # plan. Offering one would be offering a step count of zero.
                continue
            out.append(
                InlinablePlan(
                    key=plan.key,
                    version=plan.version,
                    ref=f"{plan.key}@{plan.version}",
                    name=plan.name or plan.key,
                    description=plan.description or "",
                    kind=plan.kind or "",
                    step_count=len(tasks),
                    layers=ordered_layers(layer_for(form=t.form, step_key=t.step_key) for t in tasks),
                    args_schema=dict(plan.args_schema or {}),
                )
            )
        return out

    async def _inline(
        self, session: AsyncSession, *, graph_id: str, ref: str, tuned: dict, seen: set[str]
    ) -> tuple[list[dict], dict]:
        """Copy the rows of the library plan ``ref`` names, to sit beside the skill's own.

        **Copied, not linked**: the library may publish ``@3`` tomorrow and this
        skill still does what it said it did today. The copies land **flat**,
        each carrying the plan version and the step it came from, so the
        validator sees one graph and the Flow tab can still group them.

        Keys are prefixed with the plan's key — ``nl_single_translate_thought``
        — because two plans may both name ``validate_query`` and a plan whose
        sibling keys collide is one whose bindings mean two things. An
        underscore and not a dot: a step id is ``[A-Za-z0-9_]`` in the binding
        grammar, and a dotted one would parse as *step ``nl``, output
        ``single_translate_thought.query``*. The ``${steps.X.y}`` bindings
        inside the copied plan are rewritten to match, so a plan that bound its
        own steps still does.

        Returns the copied steps — ``{key, step_key, form, title, args,
        source_step_key}`` each, arguments resolved over ``tuned`` — and the
        entry ``task_plans.uses`` records. Raises ``ValidationError`` with a
        sentence naming what is wrong: an unknown or one-off plan, an argument
        the plan does not declare, a plan with no steps.
        """
        key, _, raw_version = ref.partition("@")
        version = int(raw_version) if raw_version.isdigit() else None
        plan = await self.plans_qs.find_by_key(session, graph_id=graph_id, key=key, version=version)
        if plan is None:
            raise ValidationError(f"'{ref}' is not a plan this Graph can offer.")
        if not plan.reusable:
            raise ValidationError(f"'{ref}' belongs to the Todo it was drafted for, so it is not something to reuse.")

        declared = dict(plan.args_schema or {})
        try:
            check_tuning(declared, tuned)
        except ArgError as wrong:
            raise ValidationError(f"'{ref}': {wrong}") from None

        inlined = await self.plans_qs.tasks_for(session, plan_id=plan.id)
        if not inlined:
            raise ValidationError(f"'{ref}' has no steps, and an empty plan is not a plan.")

        prefix = _unique(key.replace("-", "_"), seen)
        renamed = {task.key: _unique(f"{prefix}_{task.key}", seen) for task in inlined}
        steps = resolve_args(
            [
                {
                    "key": renamed[task.key],
                    "step_key": task.step_key,
                    "form": task.form,
                    "title": task.title,
                    "args": _rebind(dict(task.args or {}), renamed),
                }
                for task in inlined
            ],
            declared=declared,
            tuned=tuned,
        )
        copied_from = {renamed_key: original for original, renamed_key in renamed.items()}
        for step in steps:
            step["source_step_key"] = copied_from[step["key"]]
        return steps, {"key": plan.key, "version": plan.version, "args": dict(tuned)}

    async def view(self, session: AsyncSession, *, version: SkillVersion) -> PlanView:
        """The plan as nodes and edges, each node carrying its **layer** and the
        sentence it was drawn from."""
        plan = await self.plans_qs.get(session, version.plan_id)
        if plan is None:  # pragma: no cover - a FK guarantees it
            raise NotFoundError("This version has no plan.")
        tasks = await self.plans_qs.tasks_for(session, plan_id=plan.id)
        nodes, edges = dag_for(tasks)
        spans = {t.key: (t.source_span, t.form, t.source_plan_key) for t in tasks}
        for node in nodes:
            span, form, source_plan = spans.get(node["id"], (None, TaskForm.callable.value, None))
            node["form"] = form
            node["source_span"] = span
            # Which library plan this row arrived with, so the Flow tab groups
            # five rows under the plan they came from rather than drawing five
            # unrelated steps ([SK33](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
            node["source_plan_key"] = source_plan
            node["layer"] = layer_for(form=form, step_key=node["task"] or None)
        return PlanView(plan=plan, nodes=nodes, edges=edges)

    # ── the skill, and its draft ─────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: SkillCreate,
        actor_id: str,
        publish: bool = False,
    ) -> Skill:
        """A new skill is a draft with a plan — nothing is offered it yet (SK21).

        ``publish=True`` is for a caller that has no authoring surface to go
        through — a seed, a fixture, an import — and it publishes v1 with the
        same one-node plan.
        """
        plan = await self.fallback_plan(session, graph_id=graph_id, name=payload.name)
        skill = await self.skills.create(
            session,
            graph_id=graph_id,
            payload=payload,
            actor_id=actor_id,
            plan_id=plan.id,
            publish=publish,
        )
        if publish:
            plan.source_skill_version_ids = [skill.current_version_id]
            await session.flush()
        return skill

    async def ensure_draft(self, session: AsyncSession, *, skill: Skill) -> SkillVersion:
        """The open draft, or the next version opened as one.

        Opened over a published head, it copies that version's plan so a redraw
        diffs against what was drawn (SK12). That copy is the plan of the head's
        text, so the draft opens stamped as drawn.
        """
        draft = await self.skills.get_draft(session, skill=skill)
        if draft is not None:
            return draft
        head = skill.current_version
        plan = (
            await self.copy_plan(session, source_plan_id=head.plan_id, graph_id=skill.graph_id, name=skill.name)
            if head is not None
            else await self.fallback_plan(session, graph_id=skill.graph_id, name=skill.name)
        )
        return await self.skills.start_draft(session, skill=skill, plan_id=plan.id, drawn=head is not None)

    async def publish(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        payload: SkillVersionPublish,
        actor_id: str,
    ) -> SkillVersion:
        """Publish the open draft — text, answers and plan as one act (C9).

        With no draft open this is still one path: one is opened, the payload is
        written onto it, and it publishes.

        Refused unless the plan was drawn from the text being published: a draw
        stamps the digest of the words it read, and any change since — in the
        draft or in this payload — leaves the plan describing other words. A
        draft opened over a published version carries that version's plan, so
        a pin-only or why-only publish passes without a draw.
        """
        await self._check_pin(session, skill=skill, payload=payload)
        draft = await self.ensure_draft(session, skill=skill)
        await self.skills.update_draft(session, draft=draft, payload=payload)
        if not draft.is_drawn:
            raise ConflictError(
                f"The plan of '{skill.name}' was drawn from an earlier text — draw it again before publishing."
            )
        evaluated = await self.evals.gate(
            session, graph_id=skill.graph_id, subject_kind="skill", subject_id=skill.id, why=payload.why
        )
        published = await self.skills.publish_draft(
            session, skill=skill, draft=draft, actor_id=actor_id, why=payload.why, evaluated=evaluated
        )
        plan = await self.plans_qs.get(session, published.plan_id)
        if plan is not None:
            # Provenance, N:M — the skill version this plan was drawn from (SK8).
            plan.source_skill_version_ids = [published.id]
            await session.flush()
        return published

    async def rollback(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        version: int,
        actor_id: str,
        why: str | None = None,
    ) -> SkillVersion:
        """Restore an earlier version as the next one — one act, nothing rewritten.

        The chosen version's description, content and when-to-use, and a copy of
        its plan, become a new published version that records which version it
        restored. The plan copy keeps the origin its rows had.

        Refused while a draft is open, because the draft owns the next version
        number and is a person's unpublished work; refused for the current
        version, because there is nothing to restore. A version that does not
        exist, or is the draft, reads as absent.
        """
        draft = await self.skills.get_draft(session, skill=skill)
        if draft is not None:
            raise ConflictError(
                f"v{draft.version} of '{skill.name}' is a draft — publish or discard it before rolling back."
            )
        target = await self.skills.get_version(session, skill=skill, version=version)
        if target.is_draft:  # pragma: no cover - the draft was refused above
            raise NotFoundError(f"Version {version} of '{skill.name}' not found.")
        if target.id == skill.current_version_id:
            raise ConflictError(f"v{version} is already the current version of '{skill.name}'.")
        # What once passed still runs today's set, which may have grown since.
        evaluated = await self.evals.gate(
            session, graph_id=skill.graph_id, subject_kind="skill", subject_id=skill.id, version=version, why=why
        )

        plan = await self.copy_plan(session, source_plan_id=target.plan_id, graph_id=skill.graph_id, name=skill.name)
        restored = await self.skills.start_draft(
            session,
            skill=skill,
            plan_id=plan.id,
            payload=SkillVersionPublish(
                description=target.description,
                content=target.content,
                when_to_use=target.when_to_use,
                model_pin=target.model_pin,
            ),
            drawn=True,
        )
        published = await self.skills.publish_draft(
            session,
            skill=skill,
            draft=restored,
            actor_id=actor_id,
            why=why,
            restored_from=target.version,
            evaluated=evaluated,
        )
        plan.source_skill_version_ids = [published.id]
        await session.flush()
        return published

    async def update(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        payload: SkillUpdate,
        actor_id: str,
    ) -> Skill:
        """A rename edits the row; new prose is written onto the draft.

        Nothing publishes here. Prose that differs from the head opens (or
        updates) the draft, which publishes only once its plan is drawn from
        that text — editing never changes what runs by itself.
        """
        wanted = SkillVersionPublish(
            description=payload.description, content=payload.content, when_to_use=payload.when_to_use
        )
        draft = await self.skills.get_draft(session, skill=skill)
        current = draft if draft is not None else skill
        if any(
            getattr(wanted, field) is not None and getattr(wanted, field) != getattr(current, field)
            for field in ("description", "content", "when_to_use")
        ):
            draft = await self.ensure_draft(session, skill=skill)
            await self.skills.update_draft(session, draft=draft, payload=wanted)
        return await self.skills.update(session, skill=skill, payload=SkillUpdate(name=payload.name), actor_id=actor_id)

    # ── drawing it from the prose ────────────────────────────────────────────

    async def start_draw(self, session: AsyncSession, *, graph, skill: Skill, actor_id: str):
        """Open the ``role = plan`` run that draws this skill's draft.

        The agent is the Graph's default: drawing a playbook is reading and
        composing, and the bounds that matter — which steps may be named — are
        the envelope's, which is exactly what the validator reads afterwards.
        """
        from invana.apps.agents.managers import AgentManager  # noqa: PLC0415 — band 2 from band 3, at call time
        from invana.runtime.services import open_draft_run  # noqa: PLC0415 — services imports managers

        draft = await self.ensure_draft(session, skill=skill)
        agent = await AgentManager().default_agent_for_surface(session, graph=graph, surface="explorer")
        if agent is None:
            raise NotFoundError("This Graph has no agent to draw with yet.")
        return await open_draft_run(
            session, graph=graph, version=draft, skill_name=skill.name, agent=agent, actor_id=actor_id
        )

    async def drawing(self, session: AsyncSession, *, version_id: str) -> Drawing | None:
        """What the planner needs to read: the prose, and what is already settled."""
        version = await self.skills.versions_qs.get(session, version_id)
        if version is None:
            return None
        skill = await self.skills.skills_qs.get(session, version.skill_id)
        if skill is None:  # pragma: no cover - a FK guarantees it
            return None
        rows = await self.clarifications_qs.list_for_version(session, version.id)
        return Drawing(
            version=version,
            graph_id=skill.graph_id,
            name=skill.name,
            when_to_use=version.when_to_use,
            content=version.content,
            answered={r.span: r.answer for r in rows if r.answer is not None},
            asked=len(rows),
            digest=version.digest(),
        )

    async def apply_drawing(
        self, session: AsyncSession, *, version_id: str, drafted, envelope, validate, read_digest: str | None = None
    ) -> Drawn:
        """Turn what the model read into rows — or into one question.

        A reading that names a library plan (``plan:<key>@<v>``) is inlined
        here: its rows are copied in at the sentence's place, validated with
        every other step, and the composition is recorded on the plan. A plan
        that cannot be inlined refuses the draw by name, exactly as a step the
        envelope forbids does.

        Rows written stamp the draft as drawn from ``read_digest`` — the digest
        of the text the model was handed. A text edited while the model read
        then still differs, and publish asks for a fresh draw. Left out, it is
        the draft's text now.

        The three cases are counted, not judged
        ([SK24](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        ``validate`` is handed in rather than imported: it is
        ``runtime.planning.resolve_plan``, and importing it here would close a
        cycle through the catalogue.
        """
        subject = await self.drawing(session, version_id=version_id)
        if subject is None:  # pragma: no cover - the caller just read it
            raise NotFoundError("That draft no longer exists.")
        version = subject.version
        cap = getattr(envelope, "max_clarifications", 3)

        raw_steps: list[dict] = []
        spans: dict[str, str] = {}
        #: The title of each step a person does, by key.
        human: dict[str, str] = {}
        #: For inlined rows: the plan each came from, and the step of it.
        sources: dict[str, str] = {}
        source_steps: dict[str, str] = {}
        composed: list[dict] = []
        refused: list[str] = []
        unmapped: list[str] = []
        order: list[str] = []
        seen: set[str] = set()

        for sentence in drafted.sentences:
            if not sentence.is_instruction:
                unmapped.append(sentence.span)
                continue
            picked = None
            if sentence.span in subject.answered:
                picked = next((c for c in sentence.candidates if c.task == subject.answered[sentence.span]), None)
            elif len(sentence.candidates) == 1:
                picked = sentence.candidates[0]
            elif len(sentence.candidates) > 1 and subject.asked < cap:
                # It stops here. Nothing is written, and the question sits
                # against the sentence until someone answers it (C10 · SK26).
                row = await self.clarifications_qs.add(
                    session,
                    SkillVersionClarification(
                        skill_version_id=version.id,
                        span=sentence.span,
                        question="Which of these does this sentence mean?",
                        options=[c.as_option() for c in sentence.candidates],
                    ),
                )
                return Drawn(
                    detail="asking · one sentence has two readings",
                    output={
                        "plan_id": version.plan_id,
                        "steps": 0,
                        "question": row.question,
                        "span": row.span,
                        "clarification_id": row.id,
                        "options": [o.get("step_key") for o in row.options],
                    },
                )
            # `picked is None` past the cap is the fallback, not a guess: a
            # person does that step, and can edit it afterwards (SK15).
            if picked is None:
                key = _unique(f"do-{len(human) + 1}", seen)
                human[key] = sentence.span[:250] or "A person does this"
                spans[key] = sentence.span
                order.append(key)
                continue
            if picked.task.startswith(PLAN_PREFIX):
                try:
                    steps, use = await self._inline(
                        session,
                        graph_id=subject.graph_id,
                        ref=picked.task.removeprefix(PLAN_PREFIX),
                        tuned=dict(picked.tune),
                        seen=seen,
                    )
                except ValidationError as wrong:
                    refused.append(f"'{sentence.span}' names {wrong.detail}")
                    continue
                composed.append(use)
                ref = f"{use['key']}@{use['version']}"
                for step in steps:
                    key = step["key"]
                    spans[key] = sentence.span
                    sources[key] = ref
                    source_steps[key] = step["source_step_key"]
                    order.append(key)
                    if step["form"] == TaskForm.human.value:
                        human[key] = step["title"] or "A person does this"
                        continue
                    raw_steps.append(
                        {
                            "id": key,
                            "task": step["step_key"],
                            "label": step["title"] or LABELS.get(step["step_key"], step["step_key"]),
                            "args": step["args"],
                        }
                    )
                continue
            key = _unique(picked.task, seen)
            raw_steps.append(
                {
                    "id": key,
                    "task": picked.task,
                    "label": picked.label or picked.task,
                    "args": {"input": picked.binds} if picked.binds else {},
                }
            )
            spans[key] = sentence.span
            order.append(key)

        try:
            if refused:
                # A plan that cannot be inlined is the author's to answer, like
                # every reason the validator gives; nothing is validated past it.
                raise _Refused(refused)
            # A plan every row of which is a person's reaches here with nothing
            # to validate, and `validate` reads an empty list as *no steps at
            # all*. A person is the universal fallback, so that plan is written;
            # only a playbook with no step of any kind is refused.
            validated = []
            if raw_steps or not order:
                validated, _source = validate(envelope=envelope, raw_steps=raw_steps, source="skill")
        except Exception as rejected:  # PlanRejected, raised from band 2
            errors = getattr(rejected, "errors", None)
            if errors is None:
                raise
            # Nothing is written, and the reasons ride out on the result rather
            # than on a failure ([SK31](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
            # the draft is what the author is looking at, and this is the only
            # way the refusal reaches it.
            return Drawn(
                detail="refused · " + _plural(len(errors), "reason"),
                output={"plan_id": version.plan_id, "steps": 0, "refused": errors},
                rejected=errors,
            )

        exploded = {
            t.key: t
            for t in explode(
                "", [s.as_dict() for s in validated], requires=_requires(), versions=load_plugins().versions()
            )
        }
        rows: list[Task] = []
        for key in order:
            task = exploded.get(key)
            if task is None:
                task = Task(
                    task_plan_id="",
                    key=key,
                    form=TaskForm.human.value,
                    step_key=None,
                    title=human.get(key, "A person does this"),
                    args={},
                    depends_on=[],
                )
            task.source_span = spans.get(key)
            task.source_plan_key = sources.get(key)
            task.source_step_key = source_steps.get(key)
            rows.append(task)
        await self.rewrite(session, version=version, tasks=rows)
        plan = await self.plans_qs.get(session, version.plan_id)
        if plan is not None:
            plan.origin = PlanOrigin.generated.value
            # What this plan spent, beside what each row came from, so *what
            # will this do for me* is answerable without opening the library.
            plan.uses = composed
        # The words this draw read, so publish can tell the plan is theirs.
        version.drawn_digest = read_digest or subject.digest
        await session.flush()

        detail = f"drawn · {len(rows)} step" + ("s" if len(rows) != 1 else "")
        if unmapped:
            detail += f" · {len(unmapped)} unmapped"
        return Drawn(
            detail=detail,
            output={"plan_id": version.plan_id, "steps": len(rows), "unmapped": unmapped},
        )

    async def draft_read(self, session: AsyncSession, *, skill: Skill) -> SkillDraftRead:
        """The draft, opened if it is not open yet — the authoring surface's one read."""
        draft = await self.ensure_draft(session, skill=skill)
        return await self._draft_read(session, draft=draft)

    async def write_draft(self, session: AsyncSession, *, skill: Skill, payload: SkillVersionPublish) -> SkillDraftRead:
        await self._check_pin(session, skill=skill, payload=payload)
        draft = await self.ensure_draft(session, skill=skill)
        await self.skills.update_draft(session, draft=draft, payload=payload)
        return await self._draft_read(session, draft=draft)

    async def _check_pin(self, session: AsyncSession, *, skill: Skill, payload: SkillVersionPublish) -> None:
        """Refuse a pin the Graph does not offer, or an alias, where it was typed."""
        if "model_pin" in payload.model_fields_set and payload.model_pin:
            payload.model_pin = await self.endpoints.check_pin(
                session, graph_id=skill.graph_id, address=payload.model_pin
            )

    async def answer(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        clarification_id: str,
        answer: str,
        actor_id: str,
    ) -> SkillDraftRead:
        """Record which reading the author meant.

        It is written onto the version, not onto the plan: a redraw must never
        re-ask, and the answer is part of what publishes
        ([SK11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        """
        draft = await self.ensure_draft(session, skill=skill)
        row = await self.clarifications_qs.get(session, clarification_id)
        if row is None or row.skill_version_id != draft.id:
            raise NotFoundError("That question is not open on this draft.")
        if not any(option.get("step_key") == answer for option in row.options or []) and answer != "none":
            raise ValidationError(
                "Pick one of the readings offered, or 'none' — a free-text answer is a second way to write "
                "the playbook, in a box that is not the playbook."
            )
        row.answer = answer
        row.answered_by_id = actor_id
        row.answered_at = datetime.now(UTC)
        await session.flush()
        return await self._draft_read(session, draft=draft)

    async def _draft_read(self, session: AsyncSession, *, draft: SkillVersion) -> SkillDraftRead:
        plan = await self.plan_read(session, version=draft)
        rows = await self.clarifications_qs.list_for_version(session, draft.id)
        reads = [SkillClarificationRead.model_validate(r) for r in rows]
        skill = await self.skills.skills_qs.get(session, draft.skill_id)
        drawing, refusal = None, None
        if skill is not None:
            drawing = await self.runs_qs.drawing_skill_version(session, graph_id=skill.graph_id, version_id=draft.id)
            if drawing is None:
                refusal = await self._refusal(session, graph_id=skill.graph_id, version_id=draft.id)
        return SkillDraftRead(
            version=SkillVersionRead.model_validate(draft),
            plan=plan,
            clarifications=reads,
            open_clarification=next((r for r in reads if r.answer is None), None),
            drawing_run_id=drawing,
            refusal=refusal,
            drawn=draft.is_drawn,
        )

    async def _refusal(self, session: AsyncSession, *, graph_id: str, version_id: str) -> SkillDrawRefusal | None:
        """What the last draw refused, if it refused.

        Read off the draw itself rather than kept on the draft: the reasons
        belong to the reading that produced them, and the next draw that writes
        rows is a newer run, so this clears itself
        ([SK31](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        """
        run = await self.runs_qs.last_draw_of_skill_version(session, graph_id=graph_id, version_id=version_id)
        if run is None:
            return None
        for node in await self.runs_qs.nodes_of(session, run_id=run.id):
            reasons = (node.output or {}).get("refused") if node.step_key == "draft_plan" else None
            if reasons:
                return SkillDrawRefusal(run_id=run.id, reasons=[str(r) for r in reasons])
        return None

    async def discard_draft(self, session: AsyncSession, *, skill: Skill) -> None:
        """Throw away what was being written. The plan goes with it — it was
        never published, so nothing resolves to it."""
        draft = await self.skills.get_draft(session, skill=skill)
        if draft is None:
            return
        plan_id = draft.plan_id
        await session.delete(draft)
        await session.flush()
        plan = await self.plans_qs.get(session, plan_id)
        if plan is not None:
            await session.delete(plan)
            await session.flush()

    @staticmethod
    def stamp(version: SkillVersion) -> datetime:
        return version.published_at or datetime.now(UTC)


def _rebind(args: dict, renamed: dict[str, str]) -> dict:
    """Point an inlined plan's own ``${steps.X.y}`` at its renamed copies.

    Without this, a copied ``validate_query`` would still bind
    ``${steps.translate_thought.query}`` — which now names either nothing or,
    worse, a *different* step the skill happens to have called that.
    """
    out = {}
    for key, value in args.items():
        match = _STEP_BINDING.match(value) if isinstance(value, str) else None
        if match is not None and match.group(1) in renamed:
            out[key] = f"${{steps.{renamed[match.group(1)]}.{match.group(2)}}}"
        else:
            out[key] = value
    return out
