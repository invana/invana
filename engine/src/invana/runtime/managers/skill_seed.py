"""*Answer in natural language* — the product's own playbook, as a skill.

The capability Invana has always run is four tasks and a check: translate the
question, validate the query, execute it, shape the rows, say whether it served.
Until now that lived only in the catalogue, where a person could not read it,
could not bind it to one agent rather than another, and could not see where it
was applied.

So it is **a skill like any other**
([SK25](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
seeded into every Graph with ``origin = builtin``, re-seeded idempotently by
name, never deleted — and **editable**, because publishing v2 over it is an
ordinary act and a product that could not be corrected by its user would be
making a different promise.

Its plan is the real one: five catalogue entries, ordered by what each declares
it ``requires``, each carrying the **sentence it was drawn from**
(``Task.source_span``). That is what makes the Playbook tab's sentence-to-step
mapping true on a Graph's first day rather than after someone runs the planner.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.registry import LABELS, step
from invana.apps.skills.managers import SkillManager
from invana.apps.skills.models import Skill
from invana.apps.skills.schemas import SkillCreate
from invana.apps.task_plans.managers.task_plan import explode
from invana.apps.task_plans.models import PlanKind, PlanOrigin, TaskPlan
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.core.events.models import ActorKind
from invana.runtime.catalogue import CATALOGUE

NAME = "Answer in natural language"
PLAN_KEY = "skill:answer-in-nl"

WHEN_TO_USE = "when someone asks a question of the graph in prose"
DESCRIPTION = (
    "The product's own playbook for answering a question about the graph: "
    "translate it, check it, run it, shape it, and say whether it served."
)

#: One sentence per line. The blank-lined last one produces no step and is drawn
#: **unmapped** — a playbook may say things that are not instructions.
CONTENT = "\n".join(
    [
        "Read the question and turn it into a query against the models in view.",
        "If it could mean two things, ask which — do not guess.",
        "Check the query before it runs, and refuse anything outside the read subset.",
        "Run it against the graph, inside whatever world the run was opened in.",
        "Shape the rows for the canvas, and say what the answer rests on.",
        "Say whether the answer actually served the question.",
        "Be concise.",
    ]
)

#: ``(step_key, args, the sentences it was drawn from)``. *Understand* carries
#: two, because asking back is part of translating rather than a step of its
#: own — `translate_thought` declares `question` and `options` beside `query`.
STEPS: tuple[tuple[str, dict, str], ...] = (
    (
        "translate_thought",
        {},
        "Read the question and turn it into a query against the models in view. "
        "If it could mean two things, ask which — do not guess.",
    ),
    (
        "validate_query",
        {"query": "${steps.translate_thought.query}"},
        "Check the query before it runs, and refuse anything outside the read subset.",
    ),
    (
        "execute_graph_query",
        {"query": "${steps.translate_thought.query}", "read_only": True},
        "Run it against the graph, inside whatever world the run was opened in.",
    ),
    (
        "shape_for_canvas",
        {},
        "Shape the rows for the canvas, and say what the answer rests on.",
    ),
    (
        "verify_result",
        {},
        "Say whether the answer actually served the question.",
    ),
)


def _requires() -> dict[str, tuple[str, ...]]:
    """What the catalogue declares must precede each entry — handed down from
    band 3, never imported up (migration-plan §4.1)."""
    return {key: entry.requires for key, entry in CATALOGUE.items()}


class BuiltinSkillSeeder:
    """Stateless. Idempotent by name, so a Graph converges on one copy."""

    skills = SkillManager()
    plans_qs = TaskPlanQuerySet()

    async def ensure_seeded(self, session: AsyncSession, *, graph_id: str) -> Skill | None:
        """Write *Answer in natural language* into this Graph if it is absent.

        Matching is by **name**, which is unique per Graph: a person who has
        renamed it has made it theirs, and seeding a second copy beside it would
        be the product arguing with them.
        """
        existing = await self.skills.skills_qs.by_name(session, graph_id=graph_id, name=NAME)
        if existing is not None:
            return None

        plan = await self.plans_qs.add(
            session,
            TaskPlan(
                graph_id=graph_id,
                key=PLAN_KEY,
                version=1,
                name=NAME,
                description=DESCRIPTION,
                kind=PlanKind.ask.value,
                origin=PlanOrigin.builtin.value,
                intent=[],
                args_schema={},
                source_skill_version_ids=[],
                # Not the library's: a skill's plan is read from the skill, and
                # listing it beside the plans a person can select would make the
                # Library a log (LB6).
                reusable=False,
                created_by_kind="system",
            ),
        )
        steps = [step(key, **args) for key, args, _span in STEPS]
        tasks = explode(plan.id, steps, requires=_requires())
        spans = {key: span for key, _args, span in STEPS}
        for task in tasks:
            task.source_span = spans.get(task.step_key or "")
            task.title = LABELS.get(task.step_key or "", task.title)
        await self.plans_qs.add_tasks(session, tasks)

        return await self.skills.create(
            session,
            graph_id=graph_id,
            payload=SkillCreate(
                name=NAME,
                description=DESCRIPTION,
                content=CONTENT,
                when_to_use=WHEN_TO_USE,
            ),
            actor_id=None,
            actor_kind=ActorKind.system,
            plan_id=plan.id,
            origin="builtin",
            publish=True,
        )
