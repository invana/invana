# The Skills pass — what to build, and what the code actually has

**Module 6's engine work, in five slices.** Skills leads the build order
([the-sequence.md § 1a](../the-sequence.md)); the designs are reconciled into the documents already,
so this is **step 3 of the module pass: engine**.

| | |
|---|---|
| Ships | [6.1 Authoring](../modules/skills/features/authoring-a-skill.md) · [6.2 Bindings](../modules/skills/features/bindings.md) · [6.3 Usage](../modules/skills/features/usage.md) · [6.4 Rules](../modules/skills/features/rules.md) |
| Sibling to | [lens-migration.md](lens-migration.md) · [task-model-migration.md](task-model-migration.md) |
| Drawn in | `claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc` — pages *Skills · Bindings · Usage · Rules* |
| Reconciled in | [skills/spec.md § 5a](../modules/skills/spec.md) and each feature file's *Surfaces, as drawn* |
| Blocked out of it | the **Flow** tab and anything needing `skill_versions.plan_id` — M8, which needs M5 |

Read first, in this order:

```
modules/skills/spec.md                    § 2 offered-not-obeyed · § 3 what it owns ·
                                          § 4 how they reach a step · § 5a the drawn states
modules/skills/features/authoring-a-skill.md   SK1–SK18 · Surfaces, as drawn
modules/skills/features/bindings.md            BN1–BN5
modules/skills/features/usage.md               US1–US4
modules/skills/features/rules.md               RU1–RU5
```

The worked example is the skill the product already runs — `nl-query`: `translate_thought` ·
`validate_query` · `execute_graph_query` · `shape_for_canvas`
(`engine/src/invana/runtime/workflows.py`).

---

## 1. What the engine actually has

The index marks `6.1 · 6.2 · 6.3` as `API ✅`. **That is generous.** Verify before trusting it:

| Thing | State | Where |
|---|---|---|
| `skills` | exists, **flat** — `graph_id · name · description · content · when_to_use`. No versions | `apps/skills/models.py` |
| Routes | list · create · get · update · delete · `GET …/skills/{id}/usage` | `server/skills/views.py` |
| The binding | **`agents.skill_ids`, a JSON array on the agent** — not the `agent_skills` table § 3 describes | `apps/agents/models.py:118` |
| Offered / applied | `task_runs.skills_offered` · `skills_applied`, JSON arrays of **bare skill ids** | `runtime/models.py:235` |
| Usage | derived by scanning the roster | `runtime/managers/skill_usage.py` |
| `skill_versions` | **does not exist** | — |
| `rules` · `rule_versions` | **do not exist** — 6.4 is unbuilt end to end | — |
| `skill_versions.plan_id` | **blocked on M8**, which needs M5 | [task-model-migration.md](task-model-migration.md) |

Latest migration is `000000000043_canvases_are_boards`. **Check the highest number before writing
one** — [lens-migration.md](lens-migration.md) claims `44` for `a_model_declares_its_axes`, and
whoever goes second renumbers.

## 2. The forks, settled

Recorded in the feature files, which are the record ([CLAUDE.md](../../../CLAUDE.md) rule 0).

| # | Settled | Where |
|---|---|---|
| 1 | **The binding is a table, `skill_bindings`, owned by `apps/skills/`** — named for what it binds, not `agent_skills`. `agents.skill_ids` migrates into rows and is dropped | [BN6](../modules/skills/features/bindings.md#decisions) |
| 2 | **A step records the version.** Every existing skill becomes its own immutable v1, and historical `skills_offered` / `skills_applied` entries are rewritten to name it — one id shape, no *before versions* bucket | [SK19](../modules/skills/features/authoring-a-skill.md#decisions) · [US5](../modules/skills/features/usage.md#decisions) |
| 3 | **[BN5](../modules/skills/features/bindings.md#decisions) lands in halves.** The envelope check in K3; the lens check when an agent has a lens, with [lens-migration](lens-migration.md). Until then a bind never claims to have checked the lens | [BN7](../modules/skills/features/bindings.md#decisions) |

### What § 1 missed

| Thing | State |
|---|---|
| Bind / unbind routes | **Do not exist.** `bindings.md` § Engine lists `POST DELETE …/agents/{id}/skills/{skill_id}`; binding today is a `PATCH …/agents/{id}` writing the whole array, with no `agent.skill_bound` event. K3 builds the write path from zero |
| `agents.lens` | **Does not exist.** A lens is only `task_runs.lens_id` · `lens_snapshot`, and [lens-migration § 22](lens-migration.md) says both are never written and never read — hence fork 3 |
| `task_plans.source_skill_version_ids` | **Already a column** (`apps/task_plans/models.py:113`, migration `38`), pointing at a table that does not exist. Always `[]`, nothing reads it. K1 makes it referenceable; it stays empty until M8 |
| The next migration number | `43` was latest and [lens-migration](lens-migration.md) had reserved `44` without landing it. Skills leads the build order ([the-sequence § 1a](../the-sequence.md)), so **K1 takes `44`** and lens renumbers to `45` — a revision chain has no gaps to reserve into |

## 3. The slices

| Slice | Lands | Done when |
|---|---|---|
| **K1** ✅ | `skill_versions` + `skills.current_version_id`; publish mints an immutable version; editing publishes the next | A published version never changes, the previous one still resolves, and the diff against it reads |
| **K2** ✅ | A step records the **version** it was offered; usage derives per version | *Offered 40, applied 31* is a claim about v3, and v4 starts its own count (US3) |
| **K3** 🟡 | The binding, per decision 1 — plus the **bind-time check**: refuse a skill whose plan names a `step_key` the agent may not call, or needs a participant its lens denies, **naming the bound or the rule** ([BN5](../modules/skills/features/bindings.md)) | A bind is refused with the name in the message, and a narrower world at *run* time is still *cannot answer — outside the lens*, never a binding error |
| **K4** ✅ | `rules` · `rule_versions` — scope `graph\|project`, kind `invariant\|working`, `active`, `order`; offered discretely with ids in the fixed order of [§ 4](../modules/skills/spec.md); cited per step | A step cites the rule it followed, an inactive rule is not offered, and its past citations still resolve |
| **K5** ✅ | The read surfaces Studio needs: the version list, the diff, usage by version / agent / outcome, rule citations | Each answers in one request what its artboard draws |

**K1 landed** as migration `000000000044_a_skill_is_its_versions`: `skill_versions` ·
`skills.current_version_id` · publish-on-edit · the three version routes · every existing skill
backfilled to its own v1. The `skills` table no longer carries prose, and `SkillRead` reads it
through the head so no caller had to change. The OpenAPI and schema goldens were regenerated
deliberately. **The K1 diff surface is K5's**, with the rest of the read shapes.

**K2 landed** as migration `000000000045_a_step_records_the_version`: the writers in
`runtime/catalogue/contract.py` record `skill_version_id`, both `task_runs` columns are rewritten to
name v1, the activity trace resolves names through `skill_versions`, and `GET …/skills/{id}/usage`
answers `versions[] · offered · applied · gap` with each step row naming the version it read. The
counts are SQL over the whole Graph. **That route was broken before this** — it called a queryset
method that does not exist and raised `AttributeError` on every request, so `6.3 API ✅` in the index
was describing a route nobody had called.

**K3 landed except its check**, as migration `000000000046_a_binding_is_a_row`: `skill_bindings`
owned by `apps/skills/`, the two routes that never existed, `agent.skill_bound` ·
`skill_unbound`, `agents.skill_ids` migrated to rows and dropped, and Studio's picker binding as
it clicks. **The bind-time check is not in it** — and not because it was skipped: the envelope
half reads the plan a skill version draws (**M8**) and the lens half reads the agent's lens
(**lens-migration**), and neither exists. K3 closes when the first of those lands
([BN7](../modules/skills/features/bindings.md#decisions)).

**K4 landed** as migration `000000000047_a_rule_is_a_statement`: `rules` · `rule_versions`, the
nine routes, the fixed assembly order as discrete numbered lines, `task_runs.rules_offered` ·
`rules_cited`, and the trace resolving a citation to the wording that was offered. Two decisions the
documents did not have: **`project_id` is the only axis** ([RU6](../modules/skills/features/rules.md#decisions)),
and **a step records what it was offered as well as what it cited**
([RU7](../modules/skills/features/rules.md#decisions)).

**K5 landed**, no migration: the version diff (`…/versions/{version}/diff`), `by_agent` and
`by_outcome` on the usage route, `enough_to_read` in place of a percentage
([US6](../modules/skills/features/usage.md#decisions)), and rule citations — `…/rules/{id}/citations`
plus a `citations` count on every rule row. The version list itself shipped in K1.

**The Flow tab is not in this pass.** Studio ships it as an `EmptyState` naming what unlocks it
([DS15](../modules/platform/features/design-system.md)).

## 4. Gates

| | |
|---|---|
| Tests | **Few** positive and negative tests, not many random ones. 80% coverage. Skills is app state, so Postgres/SQLite — rule 7's *no mocks, real graph databases* binds the graph tests, and `tests/graph/` **flushes the local Neo4j and Memgraph**, so do not run it unprompted |
| The OpenAPI golden | `tests/golden/test_openapi.py` is a **guard, not a snapshot to refresh** — but this pass changes the API on purpose, so regenerate deliberately with `uv run python -m tests.golden.update` and say so. `Field(exclude=True)` does **not** keep a field out of the schema; `PrivateAttr` does |
| The four hooks | ruff · ruff format · import-linter (engine bands) · biome |
| A changeset | Every user-facing change |
| Committing | **Never without being asked in that turn** |

## 5. Closing the pass — done

| | |
|---|---|
| Index | `6.1 · 6.3 · 6.4` are **API ✅**. `6.2` is **API 🟡** and says why, because [BN5](../modules/skills/features/bindings.md#decisions) is not built |
| Partly built | 6.3's row is gone; a 6.2 row replaces it, naming the one missing check and what it waits on |
| Shipped | one row for the pass, stating what landed and what did not |
| Migrations | `44` a skill is its versions · `45` a step records the version · `46` a binding is a row · `47` a rule is a statement |
| Changesets | four, one per slice |

**What reopens 6.2:** whichever of [M8](task-model-migration.md) or [lens-migration](lens-migration.md)
lands first gives one half of the check something to read. The write path, the refusal shape and the
surface are already here.

## 5a. The original closing instructions

Flip `6.1 · 6.2 · 6.3 · 6.4` in [README.md](../README.md), delete the module's rows from **Partly
built**, and write what landed into **Shipped**. A slice is closed only when it runs from a clean
checkout.

**Where the code and the documents disagree — and on the two forks above, they do — say so and
stop.** The documents are the record; the code is what happened. Changing either is a decision, not
a cleanup.
