"""What a bind is checked against — both halves of
[BN5](docs/for-developers/modules/skills/features/bindings.md).

Binding a skill an agent could **never** run must fail when someone binds it,
not inside a run hours later with half the work done. The check is possible now
and was not before: it reads the **plan** a skill version draws, and a version
only owns one from M8 (building-engine/skills-draw-as-plans.md) — which is
exactly what [BN7](docs/for-developers/modules/skills/features/bindings.md) said
it was waiting on.

Lives in ``runtime`` for the reason every composition here does: it reads rows
from ``apps/skills``, ``apps/task_plans`` **and** ``apps/govern``, and skills
sits above plans in the app order, so the package that needs all three is the
one above them (migration-plan §3).

**Both halves, and each says what it read.** The lens half refuses a skill whose
plan reaches a band the agent's guardrails have shut
([BN10](docs/for-developers/modules/skills/features/bindings.md)): a plan node
declares a band, never a participant, so what is checkable at bind time is
whether *every* participant in that band is denied — a `third_party/** deny`, a
closed layer with nothing allowed inside it, or a Graph whose whole llm layer is
denied. One permitted participant and the bind stands. Every refusal still
carries ``checked`` and ``not_checked``, so the surface states which checks ran
rather than implying both did.

What is deliberately **not** checked here:

* **A narrower world at run time.** A Todo may always narrow further than its
  agent ([GV6](docs/for-developers/modules/govern/spec.md)); that is *cannot
  answer — outside the lens*, and widening recovers it. Which is also why the
  lens half reads **guardrails** and not worlds — including the world an agent
  carries by default in ``agents.lens_id`` ([BN10]).
* **Which participant a run will pick.** A plan says *this step touches graph
  data*; which model it reads is decided inside the run. Refusing because one
  of the band's participants is denied would refuse on grounds the check cannot
  read ([BN7](docs/for-developers/modules/skills/features/bindings.md)).
* **A spawn's bindings.** A child's bindings are named at spawn, inside a run
  ([BN4](docs/for-developers/modules/skills/features/bindings.md)) — refusing
  there would manufacture the 3am failure this check exists to prevent, and
  nobody typed it to be told. The child's narrowed envelope still refuses the
  *call* at dispatch, and an offer nothing calls costs a prompt, not an answer.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.agents.envelope import Envelope
from invana.apps.agents.querysets import AgentQuerySet
from invana.apps.govern.addressing import GOVERNED_LAYERS, Layer
from invana.apps.govern.catalogue import Catalogue, CatalogueResolver
from invana.apps.govern.managers import LensManager
from invana.apps.govern.rules import Effective
from invana.apps.skills.managers import SkillBindingManager
from invana.apps.skills.models import Skill
from invana.apps.task_plans.models import Task, TaskForm
from invana.apps.task_plans.querysets import TaskPlanQuerySet
from invana.core.errors import ConflictError
from invana.runtime.catalogue import CATALOGUE
from invana.runtime.layers import LAYER_LABEL, band_for

#: The checks this build actually runs, and the ones it does not. Sent on every
#: refusal (BN7) — a half-built check that says so beats one that silently
#: passes.
CHECKED: tuple[str, ...] = ("envelope", "lens")
NOT_CHECKED: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Shut:
    """A band the guardrails have closed, and what says so."""

    #: Which of the three readings found it — named on the refusal, so the
    #: person sees the shape of the bound rather than only its effect.
    reason: str
    #: One address that was checked and denied. ``None`` when the band has no
    #: participants at all and the bound is the rule alone.
    participant: str | None
    #: The rule pattern that denied it, where one did.
    rule: str | None
    message: str


class SkillBindManager:
    """Stateless. The session is the first argument of every method."""

    agents_qs = AgentQuerySet()
    plans_qs = TaskPlanQuerySet()
    lenses = LensManager()
    catalogue = CatalogueResolver()
    bindings = SkillBindingManager()

    async def check(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
    ) -> None:
        """Both halves of [BN5], in the order they can be read.

        A :class:`~invana.apps.skills.managers.binding.BindCheck`, so it raises
        rather than returning a verdict.

        The envelope runs first because it names a **step**, which is the
        narrower and more actionable fact: *this agent may not call
        `write_graph`* tells the author what to change, where *the graph data
        band is shut* tells them who to ask. Both are refusals the person
        binding can act on; neither is worth hiding behind the other.

        One case passes without either check, and for the reason both share —
        there is nothing to read, so there is nothing to refuse: the skill has
        **no published version**, so nothing is offered it yet and the plan a
        run would read does not exist
        ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
        """
        version = skill.current_version
        if version is None:
            return
        tasks = await self.plans_qs.tasks_for(session, plan_id=version.plan_id)
        await self.envelope_check(session, skill=skill, agent_id=agent_id, agent_name=agent_name, tasks=tasks)
        await self.lens_check(session, skill=skill, agent_id=agent_id, agent_name=agent_name, tasks=tasks)

    async def lens_check(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
        tasks: list[Task] | None = None,
        catalogue: Catalogue | None = None,
    ) -> None:
        """Refuse a skill whose plan reaches a band this agent's guardrails shut
        ([BN10](docs/for-developers/modules/skills/features/bindings.md)).

        It reads **guardrails** — the Graph's, plus the one pinned on this agent
        — and never a world. A guardrail is always in force; a world is picked
        per question and may only narrow inside one, so a world that shuts a
        band is the run-time narrowing [BN5] already excludes.

        The spine is skipped: a rule denying ``agent`` would deny the run its
        own dispatches, so it is not a governed layer at all.
        """
        version = skill.current_version
        if version is None:
            return
        if tasks is None:
            tasks = await self.plans_qs.tasks_for(session, plan_id=version.plan_id)

        bands: list[Layer] = []
        for task in tasks:
            band = band_for(form=task.form, step_key=task.step_key)
            if band in GOVERNED_LAYERS and band not in bands:
                bands.append(band)
        if not bands:
            return

        guardrails = await self.lenses.effective_guardrails(session, graph_id=skill.graph_id, agent_id=agent_id)
        if not guardrails.rules and not guardrails.closed_layers:
            # Nothing is in force, so nothing can be shut — and resolving a
            # catalogue to discover that is a query per bind for no verdict.
            return

        if catalogue is None:
            catalogue = await self.catalogue.resolve(session, graph_id=skill.graph_id)
        for band in bands:
            shut = _shut(guardrails, catalogue.by_layer(band), band)
            if shut is None:
                continue
            raise ConflictError(
                {
                    "error": "skill_binding_refused",
                    "check": "lens",
                    "skill_id": skill.id,
                    "skill_version_id": version.id,
                    "agent_id": agent_id,
                    "layer": LAYER_LABEL[band],
                    # The strip the card draws: every band this plan declares,
                    # in the plan's own order, with the one above struck through
                    # (BN13). Naming only the shut band says what was closed and
                    # not what the skill needed.
                    "layers": [LAYER_LABEL[declared] for declared in bands],
                    "reason": shut.reason,
                    "participant": shut.participant,
                    "rule": shut.rule,
                    "checked": list(CHECKED),
                    "not_checked": list(NOT_CHECKED),
                    "message": (
                        f"'{skill.name}' draws a plan that reaches {LAYER_LABEL[band]}, and "
                        f"{agent_name}'s guardrails close that band: {shut.message} "
                        f"Binding it would produce a skill that refuses there, inside a run."
                    ),
                }
            )

    async def envelope_check(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        agent_id: str,
        agent_name: str,
        tasks: list[Task] | None = None,
    ) -> None:
        """Refuse a skill whose plan names a callable this agent may not call.

        A :class:`~invana.apps.skills.managers.binding.BindCheck`, so it raises
        rather than returning a verdict.

        Two cases pass without a check, and for the same reason — there is
        nothing to read, so there is nothing to refuse:

        * the skill has **no published version**, so nothing is offered it yet
          and the plan a run would read does not exist
          ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md));
        * the agent has **no envelope at all**, which is not a narrow agent but
          an unconfigured one.

        ``form: human`` nodes are skipped: a person is not something the
        envelope ceilings ([SK15](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
        which is what keeps the universal fallback bindable everywhere.
        """
        version = skill.current_version
        if version is None:
            return

        agent = await self.agents_qs.get(session, agent_id)
        if agent is None or not agent.workflow_spec:
            return
        envelope = Envelope.from_spec(agent.workflow_spec, budget=agent.effective_budget)
        if not envelope.allow:
            return

        if tasks is None:
            tasks = await self.plans_qs.tasks_for(session, plan_id=version.plan_id)
        for task in tasks:
            if task.form == TaskForm.human.value or not task.step_key:
                continue
            if task.step_key in envelope.allow:
                continue
            entry = CATALOGUE.get(task.step_key)
            bound = entry.bound.value if entry is not None else "unknown"
            raise ConflictError(
                {
                    "error": "skill_binding_refused",
                    "check": "envelope",
                    "skill_id": skill.id,
                    "skill_version_id": version.id,
                    "agent_id": agent_id,
                    "step_key": task.step_key,
                    "bound": bound,
                    "checked": list(CHECKED),
                    "not_checked": list(NOT_CHECKED),
                    "message": (
                        f"'{skill.name}' draws a plan that names '{task.step_key}', which is "
                        f"bound: {bound}, and {agent_name}'s envelope does not allow it. "
                        f"Binding it would produce a skill that refuses on that step, inside a run."
                    ),
                }
            )

    async def standings(self, session: AsyncSession, *, skill: Skill) -> list[dict]:
        """Where this skill stands with every agent in the Graph — bound,
        refused, or simply not bound yet.

        The same two checks, run as a **dry run**, so the Bindings tab can draw
        the agents this skill cannot be offered instead of finding out one click
        at a time ([BN10](docs/for-developers/modules/skills/features/bindings.md)).
        It is the checks themselves and not a second reading of the same rules:
        a surface that predicted a refusal by its own logic would be a copy to
        keep in step, and the copy is what goes stale.

        The plan and the catalogue are read once; the guardrails are per agent,
        because that is what a guardrail pinned to an agent means.
        """
        version = skill.current_version
        tasks = await self.plans_qs.tasks_for(session, plan_id=version.plan_id) if version is not None else []
        catalogue = await self.catalogue.resolve(session, graph_id=skill.graph_id) if tasks else None
        agents = await self.agents_qs.list_for_graph(session, skill.graph_id)
        bound_ids = set(await self.bindings.agent_ids_for_skill(session, skill_id=skill.id))
        # One read for the whole list, the same way the plan and the
        # catalogue are read once. The world is **context** on the row and never
        # a ground for a refusal — the check reads guardrails and never worlds
        # (BN12 · BN10) — so an agent whose lens has no name carries none.
        worlds = {
            lens.id: lens.name
            for lens in await self.lenses.list_for_graph(session, graph_id=skill.graph_id, include_unnamed=True)
            if lens.name
        }

        out: list[dict] = []
        for agent in agents:
            standing: dict = {
                "agent_id": agent.id,
                "agent_name": agent.name,
                "world": worlds.get(agent.lens_id) if agent.lens_id else None,
                "bound": agent.id in bound_ids,
                "refusal": None,
            }
            if not standing["bound"]:
                try:
                    await self.envelope_check(
                        session, skill=skill, agent_id=agent.id, agent_name=agent.name, tasks=tasks
                    )
                    await self.lens_check(
                        session,
                        skill=skill,
                        agent_id=agent.id,
                        agent_name=agent.name,
                        tasks=tasks,
                        catalogue=catalogue,
                    )
                except ConflictError as refused:
                    standing["refusal"] = refused.detail
            out.append(standing)
        return out


def _shut(guardrails: Effective, participants, band: Layer) -> Shut | None:
    """Is this band closed to everything, under these guardrails?

    Three readings, and they are ordered by how legible the bound is to the
    person who has to argue with it — a rule they can point at beats an
    exhaustive sweep that happens to come out empty.
    """
    whole = f"{band.value}/**"
    denied_whole = next((rule for rule in guardrails.rules if not rule.allow and rule.match == whole), None)
    if denied_whole is not None:
        example = participants[0].address if participants else None
        return Shut(
            reason="denied_outright",
            participant=example,
            rule=whole,
            message=f"{whole} denies it.",
        )

    allows_band = any(rule.allow and rule.layer is band for rule in guardrails.rules)
    if band in guardrails.closed_layers and not allows_band:
        example = participants[0].address if participants else None
        return Shut(
            reason="closed_layer",
            participant=example,
            rule=None,
            message=f"this world names nothing in {LAYER_LABEL[band]}, and a closed band admits only what it names.",
        )

    # The exhaustive reading, and the only one that needs the catalogue: every
    # participant that exists is denied, by rules that may differ. It needs at
    # least one participant — a band with none is a band nothing was checked
    # against, and a bind is never refused on grounds it did not check (BN7).
    if not participants:
        return None
    verdicts = [(p, guardrails.decide(p.address)) for p in participants]
    if any(verdict.allowed for _p, verdict in verdicts):
        return None
    first, verdict = verdicts[0]
    count = len(verdicts)
    return Shut(
        reason="every_participant_denied",
        participant=first.address,
        rule=verdict.rule_matched,
        message=(
            f"all {count} of this Graph's {LAYER_LABEL[band]} participants are denied — "
            f"{first.address} by {verdict.rule_matched or 'the world it is outside of'}."
        ),
    )
