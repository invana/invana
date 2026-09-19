# The runtime package

**One package walks every plan in the product** — planning, dispatch, streaming, pauses, artifacts —
and `apps/skills`, `apps/sessions`, `apps/work` and `apps/datasets` all reach it without importing it.
This file is how that is arranged on disk, and what happens to every file that exists today.

| | |
|---|---|
| Model | [orchestration § 0](../orchestration.md#0-the-records) |
| Records | [task-model-migration.md](task-model-migration.md) — tables, routes, slices M1–M8 |
| Bands | [migration-plan.md § 2](migration-plan.md) — `runtime/` is band 3 |
| This file | the **files**: the target tree, and a row per file that moves, merges or dies |

---

## 1. The one rule

**Apps talk *up* through protocols. The runtime talks *down* through the catalogue.**

```
apps/sessions ──┐
apps/skills   ──┤  import core.contracts   (a Protocol — imports nothing)
apps/work     ──┤        ▲
apps/datasets ──┘        │ implements
                    runtime/            band 3
                         │ imports freely (band 3 may import 0–2)
                         ▼
              apps/*  ·  graph/  ·  core/
```

`server/deps.py` binds the protocol to the implementation at startup. Nothing else does.

| Protocol in `core/contracts.py` | Implemented by | Called by | For |
|---|---|---|---|
| `RunOpener` | `runtime` | `work` · `sessions` · `datasets` | open a run for this Todo |
| **`PlanDrafter`** *(new)* | `runtime` | `skills` | draw this playbook as a `TaskPlan` |
| `EnvelopeCheck` | `agents` | `runtime` | is this plan allowed |
| **`LensResolver`** *(new)* | `lenses` | `runtime` | what may this run see |

**This is why the catalogue is closed.** The runtime imports `apps/datasets` to run `import_dataset`;
if apps could register entries back into it, the import graph would close a cycle *and* the envelope
would become advisory. One direction, both problems gone.

---

## 2. Where each record lives

The split is **definition (band 2) vs execution (band 3)**, and it is the whole filing rule.

| Record | Package | Band | Why |
|---|---|---|---|
| `todos` · `todo_dependencies` · `projects` | `apps/work/` | 2 | what someone wants — a definition |
| `task_plans` · `tasks` | `apps/workflows/` | 2 | the library owns the flow; the runtime only walks it |
| `lenses` | **`apps/lenses/`** *(new)* | 2 | spans model versions and stitches. Making it `modeller`'s would have agents, plans and todos all deep-import `modeller` — the *cross-app read gets its own app* rule ([§2.1](migration-plan.md)) |
| `skills` · `skill_versions` · clarifications | `apps/skills/` | 2 | |
| `agents` · envelope · budget | `apps/agents/` | 2 | |
| **`task_runs` · `task_stream` · `task_prompts` · `task_artifacts`** | **`runtime/`** | 3 | execution — and only execution |

**Logs are not in this list, and that is deliberate.** A run's log lines go to `core/logging` and out
through OTel, correlated by `run_id`. There is no `runtime/logs/` and no `task_logs` table — it would
be the only one of [§11](../orchestration.md#11-what-you-can-answer-afterwards)'s six outputs stored
twice, and the fastest-growing of them.

---

## 3. The target tree

```
runtime/                        ── band 3 · imports 0–2, imported only by band 5
├── planner/
│   ├── select.py                   match a Todo's intent to a reusable TaskPlan
│   ├── draft.py                    draft_plan · the role=plan run · clarifications
│   └── validate.py                 the generated plan vs the envelope and the lens
├── interpreter/
│   ├── loop.py                     the frontier, the cursor, signals
│   ├── suspend.py                  the three pauses · resume by cursor
│   ├── bindings.py                 ${steps.x.y} → the value, before dispatch
│   ├── lanes.py                    fan-out roll-up, by declared output type (§5.1b)
│   └── payloads.py
├── catalogue/                      the CLOSED set — one file per bound (§4)
│   ├── contract.py                 what a step is handed and may raise · LoadVars — declares no entry
│   ├── registry.py                 declared entries: bound · args · outputs · requires
│   ├── bundle.py                   body · the manifest's only parser — no session, no connector
│   ├── records.py                  body · validating and writing records
│   ├── stitching.py                body · declaring and running the rules between models
│   ├── pure.py                     bound *none* — validate_query · verify_result
│   │                               shape_for_canvas · await_delegations
│   ├── network.py                  fetch_source · test_connection
│   ├── graph_read.py               run_query · introspect_schema
│   ├── graph_write.py              write_records · write_properties · bulk_write
│   │                               apply_stitches · commit_stitches
│   ├── schema_write.py             diff_models · check_capabilities
│   │                               publish_model_version · snapshot_model
│   ├── ingest.py                   check_bundle · validate_records · snapshot_model
│   ├── llm.py                      understand · plan_queries · translate
│   │                               summarise · enrich_properties · judge
│   ├── work_write.py               spawn_agent · delegate · create_task
│   └── plan_write.py               draft_plan — the only entry that writes a TaskPlan
├── executor/                       one protocol, one implementation · pools · contention
├── state/                          task_runs · models.py · querysets/ · managers/
├── prompts/                        task_prompts — clarification · approval · verdict
├── artifacts/                      task_artifacts — digest in the row, payload out of it
└── stream/                         task_stream — run frames, resumed by seq
```

**It is one package because a plan's walk is one loop.** Splitting planner, interpreter and executor
into separate top-level packages would make that loop cross a package boundary three times per node
and buy nothing — the sub-packages are for reading, not for isolation.

---

## 4. A catalogue entry is a view

The same shape the edge already uses, one band down:

| | Parses | Calls | Serialises |
|---|---|---|---|
| `server/<module>/views.py` | the request | **one manager** | the response |
| `runtime/catalogue/<bound>.py` | `args`, against the declaration | **one manager, in one app** | the declared `outputs` |

The entry owns the contract; the app owns the behaviour. That keeps the set countable, which is
what "closed" has to mean in practice.

### 4a. …but only where there is an app to view

**A view needs something to view.** `llm.py` views `apps/llm`, `graph_read.py` views
`apps/graphs`, `schema_write.py` views `apps/modeller` — each an app that owns records, managers
and routes, and that answers callers who never ran a plan. The entry is thin because the app has
its own life.

Ingestion has no such app. Once the Dataset and the ImportJob are gone
([§ 6.7](task-model-migration.md#67-the-dataset-is-retired-and-the-model-is-the-container)) the
package owns **no records**, and every caller left is the interpreter, the CLI or a route that
could call the entry directly. A package like that is not an app being viewed; it is the entry's
own body, held one import away.

So the rule has a second half:

| The bound's work is… | Where the body lives |
|---|---|
| owned by an app with records of its own | in that app — the entry is a view (§ 4) |
| owned by nothing but the run | **in the catalogue file, beside its `Entry`** |

What this costs, stated plainly: `catalogue/` grows to roughly 2,900 LOC and becomes the largest
package in `runtime/`. What it buys is that a stage stops being written twice. `stages.py` and
`catalogue/ingest.py` both declared a `validate_records`, with the same docstring, because a
pass-through in another package has to re-explain itself to be readable at all.

**And the order is still not code.** `model-import@1` in `apps/agents/registry.py` states
`validate_records → write_graph → stitch → snapshot_model`; no Python restates it. That is the
same rule commit `cc22e185` applied when it deleted `import_dataset` and `run.py` — *the importer
holds no order* — carried to the last file that still did.

---

## 5. File by file

Measured today: **runtime/ 5,594 LOC · the five apps 4,964 · their server folders 2,355 ≈ 12,900 LOC
in scope.**

### 5.1 `runtime/`

| File | LOC | Becomes |
|---|---|---|
| `interpreter/loop.py` | 942 | `interpreter/loop.py` + `interpreter/suspend.py` — **split**; the three pauses are ~a third of it |
| **`services.py`** | **606** | **dissolves.** See §6.1 — it is three openers and five read helpers in one file |
| `catalogue/query.py` | 362 | `catalogue/graph_read.py` + `catalogue/llm.py` + `catalogue/pure.py` — split by **bound**, which is the new filing rule (M1) |
| `projections.py` | 354 | unchanged, moves under `state/` |
| `models.py` | 341 | `state/models.py` — `Thinking` + `ThinkingStep` collapse to one `TaskRun`; `Thought` leaves for `apps/work` |
| `catalogue/contract.py` | 313 | stays — it is the **contract** (`RunVars` · `TaskContext` · `Out` · the failure builders) and declares no entry. The declaration is a new `catalogue/registry.py` beside it (M1); a module with entries names one bound, this one is exempt because it has none |
| `delegation.py` | 298 | merges with `catalogue/work.py` — §6.2 |
| `catalogue/work.py` | 246 | `catalogue/work_write.py` (M1), then merges into `delegation` + `catalogue/plan_write.py` — §6.2 |
| `schemas.py` | 217 | split per sub-package; `ThinkingStepRead` dies with the step table |
| `managers/workflow_runs.py` | 210 | `state/managers/run.py` |
| `catalogue/intent.py` | 209 | `catalogue/llm.py` (M1, the two entries) + `planner/select.py` — intent matching is planning, not a callable |
| `managers/agent_lifecycle.py` | 204 | **moves down** to `apps/agents/` — it is agent behaviour, not execution |
| `contention.py` | 180 | `executor/pools.py` |
| `stream.py` | 177 | `stream/` |
| `catalogue/modelling.py` | 141 | `catalogue/schema_write.py` + `catalogue/llm.py` — `propose_model` spends `llm`, the two around it spend `schema_write` (M1) |
| `planning.py` | 138 | `planner/draft.py` — **grows** `draft_plan` and the clarification pause |
| `emissions.py` | 100 | `state/emissions.py` |
| `workflows.py` | 79 | **delete** — a shim over `apps/workflows`; call the manager |
| `managers/skill_usage.py` | 57 | **moves down** to `apps/skills/` |
| `diagnosis.py` | 49 | `state/diagnosis.py` |
| `querysets/thinking.py` | 38 | `state/querysets/run.py` |
| `querysets/thinking_step.py` | 21 | **delete** — there is no step table |
| `executor.py` | 33 | `executor/` |

### 5.2 The apps

| File | LOC | Becomes |
|---|---|---|
| `apps/work/managers/task.py` | 523 | `managers/todo.py`. **Loses the status machine** (M4) and its `open_task_thinking` import — it calls `RunOpener` |
| `apps/work/plan.py` | 194 | keeps waves · `blocked_by` · critical path · order. **Lends** `find_cycle`/`assert_acyclic` to a shared `after_graph` module — §6.3b |
| `apps/work/managers/plan.py` | 78 | unchanged — it is the manager over `plan.py` |
| `apps/work/models.py` | 194 | `Task` → `Todo`; `status` column deleted |
| `apps/workflows/dag.py` | 145 | **~100 LOC deleted** — the inference has nothing left to infer. `_depth_of` inlines into the canvas projection; `pinned_by` stays — §6.3 |
| `apps/workflows/models.py` | 59 | `TaskPlan` + the new `Task` node model; `WorkflowVersion` deleted |
| `apps/sessions/schemas.py` | 220 | drops its `invana.runtime` import — an upward import that should never have existed |
| `apps/datasets/run.py` | — | drops its `invana.runtime.models` import; opens through `RunOpener` |
| `apps/agents/envelope.py` | 210 | implements `EnvelopeCheck`; **grows** the lens intersection; **loses** `DEFAULT_REQUIRE` to the catalogue declaration |
| *(new)* `apps/lenses/` | — | models · querysets · managers · schemas |

### 5.3 The edge

| File | LOC | Becomes |
|---|---|---|
| `server/runtime/thinkings.py` | 433 | `server/runtime/runs.py` — `…/thinkings` → `…/runs` |
| `server/work/views.py` | 353 | `…/tasks` → `…/todos`; accept/reject become the only closers |
| `server/workflows/views.py` | 117 | `…/workflows` → `…/task-plans`; `/{key}/plan` → `/{key}/tasks` |
| `server/runtime/templates.py` | 289 | unchanged — projections are not part of this migration |
| *(new)* `server/lenses/` | — | routes · views · deps |

---

## 6. What actually gets deleted

Four consolidations, each with a measurement behind it. **This is where the LOC goes down, not up.**

### 6.1 `services.py` is three openers and five queries

| In it today | Becomes |
|---|---|
| `open_turn` · `open_task_thinking` · `rerun_turn` | **one** `open_run(todo, plan, role, triggered_by, idem_key)`. They differ by *trigger*, which is already a column |
| `resume_turn` | stays — resuming is not opening |
| `get_thinking_or_404` · `list_steps` · `steps_for_messages` · `list_thinkings` · `awaiting_thinking` | `state/querysets/run.py`. These are queryset work that leaked into a service module |
| `_queue_steps` · `_queue_opening` · `_next_attempt` · `_prune` | `interpreter/` |
| `_session_agent` · `_agent_provider` | **down** to `apps/agents` |
| `stream_url` | `stream/` |

Nothing in that file is a *service*. Split by role and the name stops being needed.

### 6.2 `delegate` and `create_task` are one act

`orchestration § 13` states it; the code has it as `catalogue/work.py::delegate` (83 lines) +
`create_task` (49) + `delegation.py` (298). **Both make a child and may run it** — they differ only in
who is assigned and whether the parent awaits. One entry, two arguments.

`spawn_agent` and `await_delegations` stay, in `apps/agents` and `interpreter/` respectively — they
are lifecycle and control flow, not catalogue entries.

### 6.3 `dag.py` is edge *inference*, and explicit `depends_on` retires it

**This is not a merge of two DAG algorithms.** Reading both files says something better:

| File | Actually does | Edges are |
|---|---|---|
| `apps/work/plan.py` (194) | cycle detection · waves · `blocked_by` · critical path · order by `due_at` | **given** — `todo_dependencies` rows |
| `apps/workflows/dag.py` (145) | derives edges from `${steps.X.y}` bindings, then `DEFAULT_REQUIRE`, then a sequence fallback to sinks, plus a *repeated task = new branch* exception | **inferred** — a spec is an ordered list with none declared |

`_depth_of` is seven lines of byproduct. The other ~100 exist solely because a workflow spec never
said what depended on what.

**With `Task.depends_on[]` explicit, there is nothing left to infer.** And for a generated plan the
inference is not merely redundant, it is a hole:

| | With inference | With explicit `depends_on` |
|---|---|---|
| What the envelope validated | the declared list | the actual graph |
| What `plan_snapshot` froze | an incomplete plan | the plan |
| What a person approved | not what ran | what ran |

It is also the same mistake as guessing an ambiguous sentence, one level down: **[SK9](../modules/skills/features/authoring-a-skill.md) says the planner asks rather than guesses.** Inferring
an edge is the system guessing on the planner's behalf. If the planner does not know whether B must
follow A, that is a clarification, not a default.

| So | |
|---|---|
| The three inference paths (~100 LOC) | **deleted.** A binding to a step absent from `depends_on` is refused, naming both |
| `DEFAULT_REQUIRE` | becomes `requires:` on the **catalogue entry** ([§0.6](../orchestration.md#06-the-catalogue--what-a-plan-may-name)), so the planner reads it while drafting instead of being refused and redrafting |
| `_depth_of` | inlined into the canvas projection — depth is layout, not semantics |
| `pinned_by` (18) | stays in `apps/workflows` — unrelated to edges |
| Migration of existing specs | run `dag_for()` once, write the edges into `depends_on`, **then read the six builtins.** The library is what a planner selects and imitates from, so a bogus fallback edge frozen into `dataset-import` propagates into everything drafted near it |

### 6.3b What the two altitudes actually share: cycle detection

Not waves, and not the critical path.

| | Todos | plan Tasks |
|---|---|---|
| `find_cycle` · `assert_acyclic` | yes | **yes — a generated plan can contain a cycle**, and it must be refused with the loop named |
| waves · `blocked_by` · critical path | yes | no |
| order by `due_at` | yes | Tasks have no `due_at` |
| "what may run now" | the Plan canvas | **`interpreter/loop.py`'s frontier — which already exists** |

`plan.py` answers *what should a person do next*; a plan graph answers *what may the runtime dispatch
now*, and that is the interpreter's job already. Critical path over a `map_over` of 200 lanes with
`on_lane_failure: continue` is not a quantity — it is 200 chains, some permitted to fail.

**So: one shared `after_graph` module holding cycle detection (~40 LOC), called from both bands.
Everything else stays where it is.**

### 6.4 Dead on arrival

| Goes | Because |
|---|---|
| `runtime/workflows.py` (79) | a shim over `apps/workflows` |
| `runtime/querysets/thinking_step.py` (21) | there is no step table |
| `ThinkingStepRead` in `runtime/schemas.py` | ditto |
| `WorkflowVersion` model + `workflow_versions` | the run freezes `plan_snapshot` |
| `TaskStatus` enum + every transition guard on it | state derives from runs |
| `StepStatus` enum | a step is a run |
| The `schedules.kind` branch | there is one kind of schedule |

---

## 7. The guards

Four `import-linter` contracts in `pyproject.toml`, run in pre-commit and CI beside Ruff. **Deleting
one is the change, not a cleanup.**

| # | Contract |
|---|---|
| G1 | `apps/*` may not import `invana.runtime` — the four that do today are §5.2's work |
| G2 | `runtime/catalogue/*` may import **at most one** app module per file |
| G3 | Nothing outside `runtime/` may import `runtime.state.models` — the edge reads through managers |
| G4 | `core/contracts.py` imports nothing |

| Also enforced by test | |
|---|---|
| The catalogue is **closed** | `tests/golden/test_catalogue.py` asserts the entry count, that every entry declares `bound` · `args` · `outputs` · `requires`, and that no entry spans two bounds — each module names one bound and every entry in it declares that one |
| Every `${steps.x.y}` binds to a **declared** output | the validator resolves the reference against the referenced step's entry, so an undeclared output is refused at plan time, not discovered at step 6 |
| A binding is **resolved** before the step reads it | `interpreter/bindings.py`, against the same pattern and the same top-level-arg surface the validator checks. Resolving anywhere the validator does not look would open a path nothing proved legal |
| No file over ~400 lines | the standard [migration-plan.md](migration-plan.md) already sets |
| An evaluator cannot write `closed_at` | M6's test, and the governance seam in code |

## Not building

| Not building | Because |
|---|---|
| A plugin-registerable catalogue | the closed set *is* the policy, and registration would close an import cycle |
| `runtime/logs/` or `task_logs` | OTel already holds them, correlated by `run_id` |
| A separate `planner/` top-level package | the walk is one loop; splitting it costs three boundary crossings per node |
| Keeping `services.py` as a facade | it is the file this migration exists to delete |
