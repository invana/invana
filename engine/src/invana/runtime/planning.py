"""Turning an agent's envelope into the rows a run runs (docs/for-developers/modules/agents/spec.md).

Two modes, one function. docs/for-developers/modules/agents/spec.md ships both and makes the mode **the
agent's**, not the ask's — the envelope's ``entry`` says whether this agent
plans, which is what keeps "two agents run the same run_ask differently"
meaningful.

| Mode | Envelope | What is queued at open |
|---|---|---|
| **M1 static** | ``entry`` is a task, ``steps`` are given | every step, before the
  first LLM call — docs/for-developers/modules/ask/features/streaming-and-the-workflow.md unchanged |
| **M3 plan-first** | ``entry`` is ``understand`` / ``plan`` | *Understand* and
  *Plan* only; the rest appear when ``plan.proposed`` lands |

A static agent is the degenerate case of a planning one, which is the sign the
abstraction is right (docs/for-developers/modules/ask/spec.md's phrasing, one level up).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope, PlanRejected, PlanStep, apply_pins, validate_plan
from invana.apps.agents.models import Agent
from invana.apps.agents.registry import LABELS, template_key_for
from invana.apps.task_plans.args import resolve as resolve_args
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.apps.task_plans.yaml_export import steps_of
from invana.core.errors import NotFoundError
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.managers.task_plan_runs import TaskPlanRunsManager
from invana.runtime.models import RunStatus, TaskRun

# The two rows a planning agent always starts with. `understand_intent` is
# skipped for a QL ask — there is nothing to understand about a query the user
# typed, and pretending otherwise costs an LLM call for a certain answer.
UNDERSTAND_STEP = PlanStep(id="understand", task="understand_intent", label=LABELS["understand_intent"])
PLAN_STEP = PlanStep(id="plan", task="plan_workflow", label=LABELS["plan_workflow"])


@dataclass(frozen=True, slots=True)
class Opening:
    """What to write when a run opens."""

    steps: tuple[PlanStep, ...]
    envelope: Envelope
    plans: bool


def opening_for(agent: Agent, *, ask_kind: str) -> Opening:
    envelope = Envelope.from_spec(agent.workflow_spec, budget=agent.effective_budget)
    if not envelope.plans:
        return Opening(steps=envelope.steps, envelope=envelope, plans=False)
    head = (PLAN_STEP,) if ask_kind == "ql" else (UNDERSTAND_STEP, PLAN_STEP)
    return Opening(steps=head, envelope=envelope, plans=True)


@dataclass(frozen=True, slots=True)
class SelectedPlan:
    """A library plan, read as rows, ready to be validated."""

    plan_id: str
    key: str
    version: int
    #: The authored step list rebuilt from the rows, each carrying its
    #: ``task_id`` so the run it opens can name the node it came from. Any
    #: ``${args.N}`` the plan declares is already resolved against its defaults
    #: — a plan selected directly runs on what it declares
    #: ([LB20](docs/for-developers/modules/workflows/features/the-library.md)).
    steps: tuple[dict, ...]
    #: What the plan offers a caller, kept for the record and for the one
    #: refusal that survives resolution: an argument declared with no default
    #: that nothing supplied.
    declares: dict = field(default_factory=dict)

    @property
    def ref(self) -> str:
        return f"{self.key}@{self.version}"


async def select_plan(
    db: AsyncSession, *, envelope: Envelope, graph_id: str, ask_kind: str, intent_kind: str
) -> SelectedPlan | None:
    """The plan a Plan step picks — **no LLM call in the common case**.

    **The rows are the plan.** This reads ``task_plans`` + ``tasks`` for the
    Graph; it never reads a step list out of the registry
    (docs/for-developers/modules/workflows/features/the-library.md **LB12**).
    Before this, ``plan_workflow`` resolved against a dict, so the library was
    something only Studio read, ``TaskRun.task_id`` could not be populated from
    the runtime, and ``plan_snapshot`` froze a copy of code rather than a copy
    of the plan a person can open.

    A plan the envelope does not list is not selected even if the intent map
    points at it: the envelope permits, the map suggests, the Plan step selects
    (docs/for-developers/modules/agents/spec.md).

    Returns ``None`` — *plan it with the model* — in three cases, and they are
    deliberately the same answer: no intent match, the envelope forbids the key,
    or the library has no populated version of it. The third is why a graph
    whose library is missing an entry degrades to planning rather than failing.
    """
    key = template_key_for(ask_kind=ask_kind, intent_kind=intent_kind)
    if key is None:
        return None
    if envelope.templates and key not in envelope.templates:
        return None
    return await select_plan_by_key(db, graph_id=graph_id, key=key)


async def select_plan_by_key(db: AsyncSession, *, graph_id: str, key: str) -> SelectedPlan | None:
    """The newest populated version of one plan, as rows.

    The half of :func:`select_plan` that has nothing to do with matching — a
    load already knows which plan it runs, so it names it rather than deriving
    it from an intent. One reader of the library either way (**LB12**).
    """
    try:
        # Seeds the graph's library if it has never been listed, then takes the
        # newest version of the key.
        plan = await TaskPlanRunsManager().get(db, graph_id=graph_id, key=key, version=None)
    except NotFoundError:
        return None
    tasks = await TaskPlanQuerySet().tasks_for(db, plan_id=plan.id)
    if not tasks:
        # LB11: present is not populated, and an empty plan is not a plan.
        return None
    task_ids = {task.key: task.id for task in tasks}
    declared = dict(plan.args_schema or {})
    # Resolved **here**, before anything validates or queues: a marker that
    # reached dispatch would be run as the literal string it is.
    resolved = resolve_args(list(steps_of(tasks)), declared=declared)
    steps = tuple({**step, "task_id": task_ids.get(step["id"])} for step in resolved)
    return SelectedPlan(plan_id=plan.id, key=plan.key, version=plan.version, steps=steps, declares=declared)


def resolve_plan(
    *,
    envelope: Envelope,
    raw_steps: list[dict],
    source: str,
    declares: dict | None = None,
) -> tuple[list[PlanStep], str]:
    """Validate a proposed plan and overlay the envelope's pins.

    Raises :class:`~invana.apps.agents.envelope.PlanRejected`, which the runtime
    turns into a failure of the *planning* step — so a bad plan fails at step 2
    with a reason, never at step 6 with a surprise.

    **This is where the catalogue crosses the band.** The validator is band 2
    and the declaration is band 3, so the runtime hands its own catalogue down
    rather than the envelope reaching up for it.

    ``declares`` is the plan's own ``args_schema``, for the one caller that has
    one: a **reusable** plan whose rows bind ``${args.N}``
    ([LB20](docs/for-developers/modules/workflows/features/the-library.md)).
    Everything else validates with none, which is what makes an ``${args.…}``
    in a plan that offers nothing a refusal rather than a literal.
    """
    validated = validate_plan(raw_steps, envelope, catalogue=CATALOGUE, declares=declares)
    return apply_pins(validated, envelope), source


async def queue_plan_steps(
    db: AsyncSession,
    *,
    run: TaskRun,
    message_id: str | None,
    steps: list[PlanStep],
    start_seq: int,
) -> list[TaskRun]:
    """Write the queued rows for a landed plan.

    Called when ``plan.proposed`` is emitted, so a subscriber sees the whole
    remaining shape at once — the "this is what I'm about to do" moment that
    distinguishes plan-first from step-wise planning.
    """
    rows: list[TaskRun] = []
    for offset, step in enumerate(steps):
        row = TaskRun(
            graph_id=run.graph_id,
            parent_run_id=run.id,
            message_id=message_id,
            seq=start_seq + offset,
            step_key=step.id,
            task_key=step.task,
            # The library node this run executes. Null on a generated plan,
            # which has no rows until it is promoted (LB12).
            task_id=step.task_id,
            label=step.label,
            args=step.args or None,
            attempt=1,
            status=RunStatus.queued.value,
        )
        db.add(row)
        rows.append(row)
    await db.flush()
    return rows


def plan_payload(steps: list[PlanStep], *, source: str, version: int) -> dict:
    """The ``plan.proposed`` / ``plan.revised`` emission, and what lands in
    ``task_runs.plan_snapshot`` — the same document, so the trace replays what ran."""
    return {
        "version": version,
        "source": source,
        "steps": [s.as_dict() for s in steps],
    }


__all__ = [
    "PLAN_STEP",
    "UNDERSTAND_STEP",
    "Opening",
    "PlanRejected",
    "SelectedPlan",
    "opening_for",
    "plan_payload",
    "queue_plan_steps",
    "resolve_plan",
    "select_plan",
    "select_plan_by_key",
]
