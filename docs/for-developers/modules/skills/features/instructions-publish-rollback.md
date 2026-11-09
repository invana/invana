# Instructions, publish and roll back

People write `instructions.md` — a skill's playbook, an agent's instructions — as a draft; publishing
regenerates the plan from exactly that text, goes through the eval gate, and reaches every bound agent
on its next run. Rolling back is one act that makes a new version from an earlier one. Plans are
generated from instructions or packaged; nobody draws one.

| | |
|---|---|
| Index | [6.5](../../../README.md#6--skills) · Slice **B02** (P-11 · P-15) |
| Module | [Skills](../spec.md) |
| API / CLI / Studio | 🟡 / 🟡 / ✅ |
| Related | [authoring-a-skill](authoring-a-skill.md) · [evals](evals.md) · [author-an-agent](../../agents/features/author-an-agent.md) · [the-library](../../workflows/features/the-library.md) · [change-log](../../operate/features/change-log.md) · products: agents.md › Instructions → plan AG-04 · AG-08 · AG-09 · AG-11 |

Product spec: [AG-F04 · Skills](../../../../../specs/capabilities/agents/features/AG-F04-skills/feature.md) — AG-19; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Surfaces

| Surface | Shape |
|---|---|
| Agent page › Instructions | The agent's draft, *Publish* through the gate, *Discard* (C03 `agents.agent.instructions`) |
| Agent page › History · Skill page › History | The change log; *Restore* on an older row, with a why, gated (C03 AG-06 · AG-09) |
| Plan page › Revisions in runs | A run that replanned, its steps against the base plan's (C03 AG-11) |
| Library › Plans | Generated and packaged plans, read-only; no *New plan* (AG-11) |
| CLI | `invana skills list` · `history` · `push <skill> --instructions <file>` · `publish` · `rollback --to N`; `invana agents list` · `push` · `publish`; `invana plans list` · `show`, all read-only for plans |

## Engine

| Column | On | Is |
|---|---|---|
| `drawn_digest` | `skill_versions` | String64, nullable — sha256 of the text the plan was last drawn from |
| `restored_from_version` | `skill_versions` | Integer, nullable — the version a rollback copied |
| `instructions_draft` | `agents` | Text, nullable — the agent's unpublished instructions; null = no draft |
| `origin` | `flows` | written `generated` · `packaged` · `promoted` |
| `uses` | `flows` | the library plans a draw inlined, `{key, version, args}` each |

| Route | Does |
|---|---|
| `POST …/skills/{id}/versions` | Publishes the draft — refused `409` when `drawn_digest` is not the digest of the draft's text |
| `POST …/skills/{id}/rollback` `{version, why}` | A new published version copying that version's prose, pin and plan; `skill.publish` with `details.restored_from` |
| `PATCH …/agents/{id}/draft` `{instructions}` · `DELETE …/agents/{id}/draft` | Writes or discards the agent's draft |
| `POST …/agents/{id}/publish` `{why}` | Moves the draft into `instructions` — an `agent.update` |
| `POST …/agents/{id}/rollback` `{version, why}` | Restores `instructions` as they were at that agent version — an `agent.update` |

## Decisions

Engine rows, and rows that stay until they are settled; the product decisions are AG-F04's.

| # | Decision |
|---|---|
| IS1 | **`instructions.md` is the record's own prose field**, not a file store: a skill version's `content`, an agent's `instructions`. *.md* names the format a person writes; the CLI's `push --instructions <file>` reads a file into that field. A schedule carries instructions when [10.1](../../operate/features/schedules.md) builds the schedule record. |
| IS2 | **Plans are generated or packaged; nobody draws one.** `flows.origin` is written `generated` (from instructions or for a Todo), `packaged` (ships with Invana or a plugin pack, seeded read-only) or `promoted` (a generated plan that served). Rows written `authored` before keep it and read as they are. |
| IS11 | **Composition is drawn.** The planner reads the Graph's reusable library plans beside the catalogue — newest version of each, as `plan:<key>@<v>` with its description and declared arguments — and a sentence may name one as a candidate. It is counted like any candidate: one is a step, two or more ask. A picked plan is inlined at the draw: copied flat, keys prefixed with the plan key, each row naming the plan and step it came from ([SK32](authoring-a-skill.md#decisions) · [SK33](authoring-a-skill.md#decisions)), and validated in the drawing envelope with every other step. A candidate's `tune` sets arguments the plan declares; an undeclared one refuses the draw by name ([LB27](../../workflows/features/the-library.md#decisions)). `flows.uses` records the composition. A person composes by naming the plan in the prose. |
| IS4 | **Publish regenerates by requiring a fresh draw.** A draw stamps `drawn_digest` — the sha256 of the draft's description, content and when-to-use. Publish compares it with the draft's text now and refuses `409` when they differ, so a published plan is always the one drawn from the published words. Studio's *Publish* draws and then publishes; the engine never publishes an undrawn change. A draft opened over a published version, and a rollback, carry that version's digest: its plan is the plan of its text, so a pin-only or why-only publish needs no draw. `PATCH …/skills/{id}` with new prose writes the draft and publishes nothing. Seeds, fixtures and imports publish through `create(publish=True)`, a Python-only path no route reaches. The draft read says `drawn` — whether the digest matches the text now. |
| IS5 | **An agent's draft is one column**, `agents.instructions_draft`. An agent has no version table — its versions are its events ([CL8](../../operate/features/change-log.md#decisions)) — so publish is an ordinary `agent.update` that moves the draft into `instructions`, with its diff and why, and clears the draft; a draft equal to `instructions` clears without a new version. Publish with no draft open is refused `409`. `PATCH …/agents/{id}` `{instructions}` stays a direct write — an `agent.update` — for a caller with no draft surface; Studio writes the draft. An agent's draw and eval gate arrive with [evals](evals.md); until then publish moves the text. |
| IS10 | **An agent's rollback reads its events.** The instructions at version N are the `after` of the last change at or before N, else the `before` of the first change after N, else today's text. It is refused `409` while a draft is open, when that text is already current, and when the change that holds it predates recorded diffs; an unknown version is `404`. The `agent.update` it writes carries `restored_from`. |
| IS12 | **`invana skills push` writes the draft and draws it**, in the CLI's own process, so the next `publish` has a plan drawn from that text. A draw that asks a question exits 2 and prints it; the question is answered in Studio, and the CLI never answers one. |

## Not building

| Not building | Because |
|---|---|
| `GET …/skills/inlinable` | the planner reads the library itself; the picker it fed is gone (IS11) |
| Instructions on schedules now | the schedule record does not exist yet ([10.1](../../operate/features/schedules.md)) |
