# Offer a skill to an agent

Which agent may be offered which skill. A skill nobody is bound to exists and is never seen; a binding
is how it reaches a run.

| | |
|---|---|
| Index | [6.2](../../../README.md#6--skills) · Slice **S12c** |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Both checks run | the **envelope** half ([BN5](#decisions)) and the **lens** half ([BN10](#decisions)); every refusal still carries `checked` and `not_checked` ([BN7](#decisions)) |
| Related | [authoring-a-skill](authoring-a-skill.md) · [author-an-agent](../../agents/features/author-an-agent.md) · [usage](usage.md) |

Product spec: [AG-F04 · Skills](../../../../../specs/capabilities/agents/features/AG-F04-skills/feature.md) — AG-30; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

| Thing | Shape |
|---|---|
| `skill_bindings` | `skill_id` · `agent_id` · `bound_by_id` · `bound_at` — unique on `(skill_id, agent_id)`. **Owned by `apps/skills/`**, which imports no agent to write one ([BN6](#decisions)) |
| The agent's side | `Agent.bound_skills`, a **read-only** association over the same table. `agent.skill_ids` reads through it; nothing assigns to it ([BN8](#decisions)) |
| Assembly | bound skills resolve to their current version at run time |
| The check | `runtime/managers/skill_bind.py` — `check` runs both halves and raises a `409 skill_binding_refused`. The **envelope** half reads the current version's plan and the agent's envelope, naming `step_key · bound`; the **lens** half reads the Graph's and the agent's guardrails and the participant catalogue, naming `layer · reason · participant · rule` ([BN10](#decisions)). Both carry `check · skill_version_id · checked · not_checked`. It is handed to `SkillBindingManager.bind` as a callable, because `apps/skills` may not import `apps/flows` ([BN6](#decisions)) |
| The dry run | `SkillBindManager.standings` runs the same two checks per agent without binding, reading the plan and the catalogue once and the guardrails per agent. It is the checks themselves, never a second reading of the rules ([BN10](#decisions)) |
| Routes | `POST DELETE …/agents/{id}/skills/{skill_id}` · `GET …/skills/{id}/agents` — bound · refused · not bound, one read for the Bindings tab |
| Events | `agent.skill_bound` · `agent.skill_unbound` |

## Surfaces, as drawn

On [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — the rows not yet settled into AG-F04.

| Surface | Shape | Artboard |
|---|---|---|
| At run time | The context assembled in a fixed order as discrete items with ids, and what the record holds afterwards — `skills_offered` against `skills_applied` | `SkillOffer` |

## Decisions

Engine rows, and rows that stay until they are settled; the product decisions are AG-F04's.

| # | Decision |
|---|---|
| BN6 | **The binding is a row in `skill_bindings`, and the table belongs to Skills.** Skills is an independent module that agents bind to, so the table is named for what it binds — not `agent_skills`, and not a JSON array on the agent. The write path is what makes [BN5](#decisions) possible: a `PATCH` replacing a whole array has no single skill to refuse, no `bound_by`, and no place to raise the event. `agents.skill_ids` is migrated into rows and dropped; prompt assembly, delegation and usage read the table. The subject is a plain `agent_id` FK — binding anything other than an agent is not a thing the product does. |
| BN7 | **Each half of [BN5](#decisions) waits on what it reads; the write path does not wait on either.** The envelope half reads the **plan** a skill version draws, and runs now that M8 gives every version one. The lens half reads the agent's **guardrails**, which became readable outside a run when lens-migration landed `lenses` and pinned them by scope ([BN10](#decisions)); both halves now run. So `skill_bindings` and its two routes shipped first and the checks hang off them. A bind is **never refused on grounds it did not check**: every refusal carries `checked` and `not_checked`, and a half-built check that says which half ran beats one that silently passes. |
| BN10 | **A plan names layers, a lens names participants — so the lens half refuses on a layer the guardrails close to the plan entirely.** A plan node declares the band it will touch ([SK16](authoring-a-skill.md)); *which* model, provider or person a run reaches is chosen inside the run, so no plan node carries a participant address and no bind-time check can invent one. What **is** knowable at bind time is whether a band is shut: a guardrail denying `third_party/**`, or a closed layer with nothing allowed inside it, or a Graph whose every participant in that layer is denied. Each of those means a run that reaches the band always refuses — the 3am failure [BN5](#decisions) exists to prevent. Anything narrower is left alone: one permitted participant is enough for the bind to stand, because refusing on *it might pick the denied one* would be refusing on grounds the check cannot read ([BN7](#decisions)), and a run that does pick it says *cannot answer — outside the lens*, which widening recovers ([GV6](../../govern/spec.md)). **It reads guardrails, never worlds.** A guardrail is always in force and a world is picked per question and may only narrow inside it, so a world that shuts a band is the run-time narrowing BN5 already excludes An agent carries no world of its own ([AG26](../../agents/features/author-an-agent.md#decisions)). The refusal names `check: lens`, the `layer`, one denied `participant` it actually checked, and the `rule` that denied it; a layer with no participants and no rule about it is not checked and never refuses. |
| BN8 | **Binding is not a field of the agent.** `POST`/`DELETE …/agents/{id}/skills/{skill_id}` is the only way to change what an agent is bound to; `AgentUpdate` does not take `skill_ids` and `AgentRead` carries it read-only. `AgentCreate` still takes it, because the skills an agent starts with are part of creating it — the same act as a spawned agent's bindings being named at spawn ([BN4](#decisions)) — and those bind through the same manager. In Studio the picker binds as you click rather than staging into `Save`: a refusal that arrived alongside six other edits could not say which one it was about. |
| BN12 | **A standing names no world, and a world is never a ground.** An agent carries no world — what a run may see comes with the work that opens it, and an agent's own narrowing is its guardrail ([AG26](../../agents/features/author-an-agent.md#decisions)). So `SkillAgentStanding` has no `world` field, and the check reads guardrails and never worlds ([BN10](#decisions)): no bind is refused for the world a later run happens to be asked in. |
