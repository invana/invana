# M8 · A skill draws as a plan

**The second Skills pass.** The first one shipped versions, bindings, usage and rules
([skills-pass.md](skills-pass.md)) and deliberately left out everything that needed a skill version to
own a plan. This is that half: `skill_versions.plan_id`, the planner that draws it from the prose, the
clarification it raises instead of guessing, and the **Playbook** and **Flow** tabs that read the rows.

| | |
|---|---|
| Ships | [6.1 Authoring](../modules/skills/features/authoring-a-skill.md) — C8 · C9 · C10 · C11 · SK5 · SK6 · SK7 · SK12 · SK13 · SK15 · SK16 |
| Slice | **M8** of [task-model-migration.md](task-model-migration.md) § 7 |
| Drawn in | [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) — page *Skills*, artboards `S1`–`S5` |
| Worked example | **Answer in natural language** — the NL-query capability the product already runs, seeded into every Graph |
| Needs | `task_plans` + `tasks` (M2 ✅) · `generate_plan` and `resolve_plan` (in the tree ✅) · `TaskPrompt` (M3 ✅) |

## 1. What the tree already has

Read before writing anything — four of the six pieces exist.

| Piece | State | Where |
|---|---|---|
| `task_plans` · `tasks` | ✅ rows, with `source_span`, `form`, `step_key`, `depends_on` | `apps/task_plans/models.py` |
| Plan validation against the catalogue and the envelope | ✅ `validate_plan` · `resolve_plan` | `apps/agents/envelope.py` · `runtime/planning.py` |
| An LLM that composes steps from prose | ✅ `generate_plan`, used by `plan_workflow` | `apps/llm/` · `runtime/catalogue/llm.py` |
| `TaskPrompt kind=clarification`, suspend and resume | ✅ | `runtime/models.py` · `runtime/services.py:resume_turn` |
| `RunRole.plan` | ✅ the value exists; **nothing opens such a run yet** | `runtime/models.py` |
| `skill_versions.plan_id` · clarifications · the seeded skill | ❌ | this pass |

## 2. The shape of a draft

The fork this pass had to settle: **a clarification suspends, so the thing being drawn has to survive a
reload** — which means the draft is a row, not form state.

| # | Settled, in [authoring-a-skill.md](../modules/skills/features/authoring-a-skill.md#decisions) |
|---|---|
| [SK20](../modules/skills/features/authoring-a-skill.md#decisions) | A draft is a `skill_versions` row with `published_at IS NULL` — the one mutable version row |
| [SK21](../modules/skills/features/authoring-a-skill.md#decisions) | `current_version_id` stays null while a skill has only a draft; the read says `is_draft` |
| [SK22](../modules/skills/features/authoring-a-skill.md#decisions) | The plan exists from the first draw: a draft is written with a one-node `form: human` plan |
| [SK23](../modules/skills/features/authoring-a-skill.md#decisions) | Drawing is a `role=plan` TaskRun — the first in the product |
| [SK24](../modules/skills/features/authoring-a-skill.md#decisions) | Candidates per sentence: one → a task, two or more → a clarification, none → `form: human` |
| [SK25](../modules/skills/features/authoring-a-skill.md#decisions) | The NL-query skill is seeded per Graph with `origin = builtin`, and stays editable |

## 3. Data model

One migration — `000000000048_a_skill_draws_as_a_plan`.

| Table | Change | Notes |
|---|---|---|
| `skill_versions` | **+ `plan_id`** `String(36)` FK → `task_plans.id` `ondelete=RESTRICT`, **NOT NULL**, **UNIQUE** | one version, exactly one plan ([SK13](../modules/skills/features/authoring-a-skill.md#decisions)). `RESTRICT`, because deleting a plan out from under a published version would break a trace |
| `skill_versions` | **`published_at` → nullable** | null is the draft ([SK20](#2-the-shape-of-a-draft)). Every existing row is published, so the backfill is a no-op |
| `skills` | **+ `origin`** `String(16)` default `authored` | `builtin` · `authored` ([SK25](#2-the-shape-of-a-draft)) |
| `skill_version_clarifications` | **new** — `id · skill_version_id` (FK CASCADE) `· span · question · options` (JSON) `· answer · answered_by_id · answered_at · created_at` | recorded so a redraw never re-asks ([SK11](../modules/skills/features/authoring-a-skill.md#decisions)) |

**The backfill is the interesting half.** `plan_id NOT NULL` over existing rows means every skill version
in every Graph needs a plan before the constraint lands: for each, the migration writes a `task_plans`
row (`origin = authored`, `reusable = false`, `key = null`, `kind = ask`) with one `form: human` task
titled by the skill's name — [SK22](#2-the-shape-of-a-draft) again, and the same honest fallback the
product uses live. It is added nullable, backfilled, then altered to `NOT NULL` in one migration
([task-model-migration.md](task-model-migration.md) § the column is never left nullable for a release).

## 4. The catalogue entry

`draft_plan` — `bound: llm`, declared in `runtime/catalogue/llm.py` beside `plan_workflow`, which is
the entry it is closest to.

| | |
|---|---|
| args | `skill_version_id` (str, required) |
| outputs | `plan_id` · `steps` (int) · `unmapped` (list) · `question` · `options` — the last two declared, so **asking back is an ordinary result** rather than an error path, exactly as `translate_thought` declares them |
| stops | on the first unanswered ambiguous span: the clarification is written against the sentence and the run **settles** — it never suspends ([SK26](../modules/skills/features/authoring-a-skill.md#decisions)) |
| raises | `TaskFailure(blocked)` when no provider is bound. **A plan that does not hold together does not raise** — it settles with `steps: 0` and `refused`, the validator's reasons, which the draft read serves back ([SK31](../modules/skills/features/authoring-a-skill.md#decisions)) |
| writes | the draft's plan rows — `delete` then `insert`, so a redraw is a revision and the diff is against what was there ([SK12](../modules/skills/features/authoring-a-skill.md#decisions)) |
| bounded by | `max_clarifications` on the envelope; at the cap the run settles and the surface offers hand-authoring |

Its LLM half is a new `apps/llm/draft.py::draft_skill_plan(provider, prose, vocabulary, …)`, which
returns, per sentence: the span, the candidate `step_key`s, and the args it would write. The vocabulary
is the same `_vocabulary(envelope)` the planner already builds, so a skill can never be drawn with a
step the catalogue does not declare.

## 5. Routes

| Route | Does |
|---|---|
| `POST …/skills` | creates the skill **and its draft v1** with the fallback plan |
| `GET …/skills/{id}/draft` | the draft's text, its plan, its clarifications (open and answered), the `drawing_run_id` of a draw still in flight, and the `refusal` the last one settled with |
| `PATCH …/skills/{id}/draft` | edit the draft's four fields. Never touches a published version |
| `POST …/skills/{id}/draft/draw` | opens the `role=plan` run → `{run_id}`; Studio streams it on the existing run stream |
| `POST …/skills/{id}/draft/clarifications/{cid}` | records the answer and returns the draft. It opens **no** run — the one that asked has settled ([SK26](../modules/skills/features/authoring-a-skill.md#decisions)), and the surface opens the next draw with what comes back ([SK30](../modules/skills/features/authoring-a-skill.md#decisions)) |
| `PATCH …/skills/{id}/draft/tasks` | hand-edit the plan — the rows are replaced wholesale and `task_plans.origin` flips to `authored` ([SK7](../modules/skills/features/authoring-a-skill.md#decisions)). Bounded by the **catalogue**, not by an agent's envelope ([SK28](../modules/skills/features/authoring-a-skill.md#decisions)); an empty list is refused as *that is a rule, not a skill* |
| `POST …/skills/{id}/versions` | **publishes the draft** — text, answers and plan as one act |
| `GET …/skills/{id}/versions/{v}/tasks` | the plan as `nodes` + `edges`, each node carrying its `layer` and `source_span` — what the Flow and Playbook tabs read |

`GET …/skills` and `GET …/skills/{id}` gain `is_draft`, `draft_version_id` and a `plan` summary
(`plan_id · origin · step_count · layers`), so the drawer row can say *draft* and the Flow tab's badge
can carry a count without a second request.

## 6. The six layers

The Flow tab draws the plan in the layers it will touch ([SK16](../modules/skills/features/authoring-a-skill.md#decisions)),
so a node's `bound` becomes a layer. One mapping, in the engine, sent on the node — never computed in
Studio:

| `Bound` | Layer |
|---|---|
| `graph_read` · `graph_write` · `schema_write` · `ingest` | **graph data** |
| `llm` | **llm** |
| `network` | **third party** |
| `plan_write` · `work_write` · `none` | **agent** — the spine: the runtime working on what it already holds |
| `form: human` (not a bound) | **human** |

`cache` is the sixth band and no catalogue entry spends it yet; it is drawn dark, which is the same
thing the run dashboard does.

## 7. Studio

| Change | Where |
|---|---|
| The `+` moves into the drawer header's right, as a `headerActions` item ([SK27](../modules/skills/features/authoring-a-skill.md#decisions)) | `SkillsPanel.tsx` — `PanelStackSection.headerActions`, which the kit already takes. **Rules follows it** |
| The drill-in crumb **is** the drawer header — `‹ SKILLS / <name>` as the section `title`; the in-body header rows go | `SkillsPanel.tsx` · `SkillDetail.tsx` · the skill form |
| **Playbook** tab: the prose one sentence per line, each showing the step it produced; unmapped sentences marked | `SkillDetail.tsx` |
| **Flow** tab: the plan in six layers, from `/versions/{v}/tasks` | new `SkillFlowTab.tsx` |
| The draft banner, *Draw this*, and the clarification card — the sentence quoted, the readings as options, each naming the step it would write | new `SkillDraft.tsx` |
| Versions, reached from the Playbook footer | `SkillDetail.tsx` |

The design's own change: `S1` drew *New skill* as a footer button, and it is a header action now. The
generator (`.design/canvas-govern-agents/nl.py`) is updated in the same pass — the canvas is the source
and the generator is the build.

## 8. Slices

Each is reproducible from a clean checkout before the next starts.

| # | Slice | Done when |
|---|---|---|
| **8a** ✅ | The migration, the models, the fallback plan, and publishing as one act | every existing skill version has a plan, creating a skill leaves a draft with a one-node human plan, and publishing stamps `published_at` and moves the head |
| **8b** ✅ | The seeded builtin skill | a fresh Graph has *Answer in natural language* v1, published, with five tasks and a `source_span` on each |
| **8c** ✅ | `draft_plan`, the `role=plan` run, and clarifications | **Done.** Drawing a two-reading playbook records one clarification, writes no tasks until it is answered, records the answer, and a redraw never re-asks |
| **8d** ✅ | Studio: the header action, the crumb, Playbook, Flow, the draft and its card | **Done.** A person writes a playbook, draws it, answers a question, publishes v1, and reads its flow in six layers — without leaving the drawer |
| **8e** ✅ | The hand-edit, and the envelope half of [BN5](../modules/skills/features/bindings.md#decisions) | **Done.** `PATCH …/draft/tasks` writes the rows and takes ownership of the plan; binding a skill whose plan names a `step_key` the agent's envelope forbids is refused at bind time, naming the step, its bound, and which checks ran |
| **8f** ✅ | What the first live draw found | **Done.** `draft_skill_plan` had never made a real call. It does the three counted cases correctly — one reading draws a step with its span, two stop and ask, a sentence nothing can express becomes a person's, and *Be concise.* draws nothing. What it found was on the **other** side: a plan that does not hold together settles with its reasons instead of failing on the envelope's name ([SK31](../modules/skills/features/authoring-a-skill.md#decisions)), the plan a draft is born with is `generated` so `authored` still means a person wrote it ([SK29](../modules/skills/features/authoring-a-skill.md#decisions)), answering opens the next draw ([SK30](../modules/skills/features/authoring-a-skill.md#decisions)), and `drawing_run_id` is filled |

## 9. Both halves of a bind

[BN5](../modules/skills/features/bindings.md#decisions) was blocked twice over — *a skill has no plan*,
and *a lens exists only on a run*. Both are gone, so both halves run.

| | |
|---|---|
| Where | `runtime/managers/skill_bind.py` — skills, plans and govern are three apps, so the check that reads all three is composed one band up and handed to `SkillBindingManager.bind` as a callable |
| The **envelope** half | Reads the current version's plan: any `step_key` outside the agent's `allow` refuses, naming `step_key · bound` |
| The **lens** half | Reads the Graph's and the agent's **guardrails** and the participant catalogue: a band the plan reaches that is shut to everything refuses, naming `layer · reason · participant · rule` ([BN10](../modules/skills/features/bindings.md#decisions)). Three readings — `denied_outright` (`<layer>/**`), `closed_layer`, `every_participant_denied` |
| Guards | `POST …/agents/{id}/skills/{skill_id}`, and the skills an `AgentCreate` starts with. **Not a spawn** ([BN9](../modules/skills/features/bindings.md#decisions)) |
| Refuses with | `409 skill_binding_refused` · `check · skill_id · skill_version_id · agent_id · checked · not_checked · message`, plus the half's own fields |
| Never refuses | a skill with no published version · an agent with no envelope · a `form: human` node against the envelope · a band with no participants and no rule about it · a world, including the one on `agents.lens_id` — every one a case with nothing to read, and a bind is never refused on grounds it did not check ([BN7](../modules/skills/features/bindings.md#decisions)) |
| The dry run | `GET …/skills/{id}/agents` runs both checks per agent without binding, which is what Studio's **refused** section draws |

## 10. Not in this pass

| Not building | Because |
|---|---|
| A bespoke flow **editor** | the plan canvas already draws a `TaskPlan`; the hand-edit here is row-level, and authoring a reusable plan is Library › Plans ([SK18](../modules/skills/features/authoring-a-skill.md#decisions)) |
| Generating prose from a hand-edited flow | two generators pointing at each other is a drift machine |
| `uses:` composition (`S4`) | it needs a plan-level include; the column that records it is `source_skill_version_ids`, and the surface is the next pass |
| Redrawing on every keystroke | half a sentence is not an instruction |
