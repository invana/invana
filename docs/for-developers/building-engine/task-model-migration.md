# Task model migration

**Eight tables and five nouns become the records in [orchestration § 0](../orchestration.md#0-the-records).**
This is the engine + Studio plan for getting there. The model itself is not restated here — § 0 is the
model, and where this file and § 0 disagree, § 0 is right.

| | |
|---|---|
| Model | [orchestration.md § 0 – § 0.9](../orchestration.md#0-the-records) |
| Words | [terminology.md](../terminology.md) — rewritten for this model; the flip is `Task` → `Todo` |
| Package shape | [migration-plan.md](migration-plan.md) — bands, `core`, `server/<module>`. **Orthogonal to this file**: that one says where a package lives, this one says what the records are |
| **Files** | [the-runtime-package.md](the-runtime-package.md) — the target `runtime/` tree, the protocol direction, and a row per file that moves, merges or dies |
| Not in scope | renaming packages, moving bands, the events/notifications work — all of that is migration-plan.md's |

> ⚠ This is the **largest migration in the codebase**. It merges eight tables, retires five nouns and
> changes three route families that Studio is built against. It is explicitly a coordinated engine +
> Studio migration, and the slices below are ordered so that neither side is broken for long.

---

## 1. The shape change, in one table

| Today | Becomes | Note |
|---|---|---|
| `tasks` | **`todos`** | the human item — prose, criteria, assignee. **The word flips**: a `Task` is now a plan node |
| `task_dependencies` | **`todo_dependencies`** | unchanged shape; `depends_on` edges between Todos in a Project |
| `projects` · `project_assignments` | **unchanged** | Project stays its own record — it never runs, has no criteria, no plan ([§ 0.1](../orchestration.md#01-reading-the-dependencies)) |
| `workflows` | **`task_plans`** where `reusable = true` | |
| `workflow_versions` | **gone** | the run freezes `plan_snapshot`; a version table records the same fact twice |
| *(new)* | **`tasks`** | a node inside a plan — `form`, `step_key`, the plan grammar |
| `thoughts` | **`todos`** | a one-off ask from a chat message is a Todo |
| `thinkings` | **`task_runs`** | |
| `thinking_steps` | **`task_runs`** (child rows) | TaskRun is the only execution record there is |
| `thought_stream` | **`task_stream`** | `seq` is the resume cursor |
| `prompt_answers` | **`task_prompts`** | `kind`: `clarification \| approval \| verdict` |
| `emissions` · `projection_templates` | **unchanged** | they hang off a run either way |
| *(new)* | **`lenses`** | what a run may see ([§ 0.9](../orchestration.md#09-grounding-a-run--the-lens)) |
| *(new)* | **`skill_version_clarifications`** | answers recorded so a redraw never re-asks |

**Five nouns retired:** Thought · Thinking · Step (as an entity) · Workflow (as an entity) · Task (as
the human item).

---

## 2. Tables, column by column

### 2.1 `tasks` → `todos`

`apps/work/models.py` · `Task` → `Todo`

| Today | Becomes | |
|---|---|---|
| `graph_id` · `project_id?` | same | `project_id` stays nullable — the *No project* bucket |
| `parent_id?` (depth ≤ 3) | `parent_id?` | depth bounded by the envelope, not a constant |
| `title` · `body` | same | `body` is **the prose the planner reads** |
| `status` | **dropped** | derived from the latest run. Only closure is stored |
| — | `closed_at?` · `outcome?` | written by **acceptance**, which is an act, not a derivation |
| `assignee_kind/id?` | same | set → a person owns it; null → it will be planned |
| `created_by_kind/id` · `due_at?` | same | |
| `result` jsonb | **dropped** | a result is a `TaskArtifact` or the run's `outcome` |
| — | `lens_id?` | the Todo may narrow what its runs see |

**`TaskStatus` does not survive.** The `open → assigned → in_progress → review → done` machine
(`work/spec.md § 3`) becomes: *no run yet* · the latest run's status · `closed_at` set. The one thing
that was never derivable — acceptance — is the one thing that stays a column.

### 2.2 `workflows` → `task_plans`

`apps/workflows/models.py` · `Workflow` → `TaskPlan`

| Today | Becomes | |
|---|---|---|
| `graph_id` · `name` · `key` | same | `key` unique per Graph, **null unless reusable** |
| `source` (`WorkflowSource`) | `origin` | `authored \| generated \| promoted` |
| `spec` / `dag` jsonb | **dropped** | the steps become `tasks` rows. The plan is data *as rows*; YAML is the authoring format, never a second source of truth |
| — | `kind` | `ask \| import \| bulk \| stitch \| model \| enrich`. **No `work`** — that distinction is now Todo-vs-Task |
| — | `intent` | what matches it to a Todo |
| — | `todo_id?` | set when `origin = generated` |
| — | `args_schema` | `{name: {type, required, default}}` |
| — | `source_skill_version_ids[]` | provenance, N:M |
| `reusable` | same | |

### 2.3 New: `tasks` (the plan node)

Lives with the plan — `apps/workflows/` becomes the owner, not `apps/work/`.

| Column | |
|---|---|
| `task_plan_id` | **`NOT NULL`** — this constraint *is* "nothing a user authors is ever a Task" |
| `parent_id?` · `ordinal` · `key` | `key` unique among siblings |
| `form` | `callable \| composite \| human` |
| `step_key?` | callable only, from the closed catalogue |
| `title` · `body` · `args` · `assignee_kind/id?` | |
| `depends_on[]` · `when` · `map_over` · `loop` · `approval` · `timeout_s` · `retry` · `pool` · `max_parallel` · `on_lane_failure` | the plan grammar, on the node |
| `source_span?` | the prose it was drawn from — null when hand-authored |

### 2.4 `thinkings` + `thinking_steps` → `task_runs`

`runtime/models.py` · `Thinking` · `ThinkingStep` → `TaskRun`

| Today | Becomes | |
|---|---|---|
| `thought_id` | `todo_id?` · `task_plan_id` · `task_id?` | root run names the Todo and plan; child run names the node |
| `parent_thinking_id` | `parent_run_id?` | |
| — | **`role`** | `execute \| plan \| evaluate` — the new axis |
| — | `plan_snapshot` | the frozen flow. **Not `plan`** — that word names four things |
| — | `plan_origin` | `authored:<id> \| generated \| reused:<id>` |
| — | `lens_id?` · `lens_snapshot` | the world it ran against |
| `agent_id` · `agent_version` · `triggered_by` | same | |
| `lane` · `iteration` · `attempt` | same | `UNIQUE(task_id, parent_run_id, lane, iteration, attempt)` |
| `status` · `outcome` · `cursor` · `cost` · `idem_key` | same | |

`ThinkingStep` rows become child `task_runs` rows. **There is no step table.**

### 2.5 The rest

| Table | Change |
|---|---|
| `thought_stream` → `task_stream` | `thinking_id` → `run_id`; `seq` is the resume cursor |
| `prompt_answers` → `task_prompts` | gains `kind (clarification\|approval\|verdict)`, `options`, `deadline_s` |
| *(new)* `task_artifacts` | `run_id` · `task_id` · `key` · `media_type` · `size_bytes` · `digest` · `uri`. **The run row carries the digest, never the payload** |
| *(new)* `lenses` | `key?` · `name` · `model_versions[]` · `stitches[]` · `datasets[]?` · `as_of?` |
| `skill_versions` | gains **`plan_id` `NOT NULL UNIQUE`** — one version, exactly one plan |
| *(new)* `skill_version_clarifications` | `skill_version_id` · `span` · `question` · `options` · `answer` · `answered_by` |
| `schedules` | `kind` collapses to one — a schedule names a TaskPlan |
| `agents` | `workflow_spec` → envelope names `step_key`s and `ref`-able plan keys; gains `lens_id?` |

**Not built:** `task_logs`. Log lines go to OTel correlated by `run_id` — it would be the only one of
[§ 11](../orchestration.md#11-what-you-can-answer-afterwards)'s six outputs stored twice, and the
fastest-growing. `core/events` stays as it is: a fact about a write with its principal, not task-shaped.

---

## 3. Enums

| Enum | Change |
|---|---|
| `TaskStatus` | **deleted.** State derives from runs; `closed_at` + `outcome` are what remain |
| `ThinkingStatus` | → `RunStatus`, unchanged values |
| `StepStatus` | **deleted** — a step is a run |
| `WorkflowSource` | → `PlanOrigin`: `authored · generated · promoted` |
| `DependencyKind` | unchanged: `success · failure · any_outcome` |
| *(new)* `TaskForm` | `callable · composite · human` |
| *(new)* `RunRole` | `execute · plan · evaluate` |
| *(new)* `PlanKind` | `ask · import · bulk · stitch · model · enrich` — **`work` is gone** |
| *(new)* `PromptKind` | `clarification · approval · verdict` |

---

## 4. Routes

Three families change. **Studio is built against all three**, which is why § 7 pairs them.

| Today | Becomes |
|---|---|
| `…/tasks` · `/{task_id}` · `/start` · `/result` · `/accept` · `/reject` · `/cancel` · `/dependencies` · `/activity` | `…/todos` · same verbs. `/accept` and `/reject` are the **only** writers of `closed_at` |
| `…/workflows` · `/{key}` · `/{key}/plan` · `/{key}/runs` · `/{key}/export` · `/promote` | `…/task-plans` · `/{key}` · `/{key}/tasks` · `/{key}/runs` · `/{key}/export` · `/promote` |
| `…/thinkings` · `/{id}` · `/stream` · `/trace` · `/emissions` · `/answer(s)` · `/resume` · `/cancel` | `…/runs` · same verbs. `/answers` now posts a `task_prompt` answer with its `kind` |
| — | `…/lenses` — CRUD, plus `?lens=` on any start-a-run call |

`/{key}/plan` → `/{key}/tasks` is deliberate: the plan **is** its tasks, and `plan` is a word this
model spends carefully.

---

## 5. Engine packages

Package placement follows [migration-plan.md](migration-plan.md); only ownership changes here.

| Package | Owns, after |
|---|---|
| `apps/work/` | `todos` · `todo_dependencies` · `projects` · `project_assignments` · criteria · objectives |
| `apps/workflows/` | `task_plans` · `tasks` · promotion · YAML import/export. **`dag.py` survives** — the `depends_on` graph is still a DAG to sort |
| `runtime/` | `task_runs` · `task_stream` · `task_prompts` · `task_artifacts` · the interpreter · the catalogue · `lenses` |
| `apps/skills/` | `plan_id` on a version, `skill_version_clarifications`, and calling `draft_plan` |
| `apps/agents/` | the envelope (step keys, ref-able plans, `lens_id`), budget, delegation |

`runtime/planning.py` grows `draft_plan`; `runtime/catalogue/` becomes the declared catalogue with
typed `outputs` per entry ([§ 0.6](../orchestration.md#06-the-catalogue--what-a-plan-may-name)).

---

## 6. The catalogue has to be declared before anything else works

`when`, `until` and `${steps.x.y}` resolve against a callable's **declared outputs**. Today those
bindings are written against an undocumented surface. Every entry needs:

```yaml
run_query:
  bound:    graph_read
  requires: [validate_query]     # the planner reads it; the validator enforces it
  args:     {query: {type: str, required: true}, params: {type: obj, default: {}}}
  outputs:  {rows: list, count: int, truncated: bool}
```

**Four fields, four readers** — the planner (what may I name, what must precede it), the validator,
the interpreter (how lanes roll up), and every `${steps.x.y}` binding. `DEFAULT_REQUIRE` in
`apps/agents/envelope.py` folds into `requires` here: one source, not a rule the planner cannot see.

Grouped by the bound it spends, because **the group is what the envelope ceilings**: `network` ·
`graph_read` · `graph_write` · `schema_write` · `ingest` · `llm` · `plan_write` · `work_write`.
Roughly twenty-five entries, and the count is meant to stay near it — growth belongs in reusable
TaskPlans, not in new callables.

### 6.1 The catalogue as it actually is — twenty-two entries

`runtime/catalogue/registry.py` is the declaration; one module per bound holds the callables. **The
keys do not change in M1.** They are stored in `thinking_steps.task_key` and read by Studio, so
renaming them to [§0.6](../orchestration.md#06-the-catalogue--what-a-plan-may-name)'s target names is
a data migration, not a declaration.

| Key | Bound | Args | Outputs | Requires |
|---|---|---|---|---|
| `understand_intent` | `llm` | — | `kind` str · `summary` str · `refs` list · `expects` list · `confidence` float · `question` str · `options` list | — |
| `plan_workflow` | `llm` | — | `source` str · `steps` list · `rationale` str | — |
| `translate_thought` | `llm` | `ask` str | `query` str · `language` str · `rationale` str · `ask` str · `question` str · `options` list | — |
| `propose_model` | `llm` | — | `node_types` list · `edge_types` list · `summary` str | `understand_ask` |
| `validate_query` | *none* | `query` str | `verdict` str · `labels` list | — |
| `verify_result` | *none* | — | `served` str · `evidence` list | — |
| `shape_for_canvas` | *none* | — | `nodes` int · `edges` int · `result_type` str · `emission_id` str · `emission_kind` str · `template_id` str · `single_value` bool | `execute_graph_query` |
| `await_delegations` | *none* | `thinking_ids` list | `children` list | — |
| `execute_graph_query` | `graph_read` | `query` str · `read_only` bool | `rows` int · `execution_time_ms` int · `result_type` str | `validate_query` |
| `understand_ask` | `schema_write` | — | `model_id` str · `draft_version_id` str | — |
| `validate_proposal` | `schema_write` | — | `counts` obj · `draft_version_id` str | `propose_model` |
| `spawn_agent` | `work_write` | `name` str · `instructions` str · `allow` list · `skill_ids` list · `budget` obj · `llm_config_id` str · `lifetime` str | `agent_id` str · `name` str · `depth` int | — |
| `delegate` | `work_write` | `agent_id` str · `body` str | `child_thinking_id` str · `status` str | — |
| `create_task` | `work_write` | `title` str · `body` str | `task_id` str | — |
| `check_bundle` | `ingest` | `root` str | `datasets` list · `findings` list · `passed` bool | — |
| `validate_records` | `ingest` | `root` str · `model` str | `total` int · `reported` int · `model` str · `version` int | — |
| `snapshot_model` | `ingest` | `model` str | `model_id` str · `version_id` str · `version` int | `write_graph` |
| `write_graph` | `graph_write` | — | `nodes` int · `edges` int · `written` int | `validate_records` |
| `stitch` | `graph_write` | — | `resolved` int · `unresolved` int · `stitched` int | `write_graph` |
| `apply_stitches` | `graph_write` | `root` str | `declared` int · `already` int · `skipped` int · `passed` bool | — |
| `commit_stitches` | `graph_write` | — | `written` int · `rejected` int | — |
| `bulk_write` | `graph_write` | `root` str · `batch_size` int · `skip_on_error` bool · `keep_source_ids` bool | `nodes` int · `edges` int · `failed` int | **—** |

**`snapshot_model` spends `ingest`, not `schema_write`.** It writes no schema: it pins the version the load
*validated against* and records what landed on the dataset. An agent allowed to load may stamp what it
loaded; changing the model is a different ceiling, and an entry that spanned both could not be ceilinged at
all. It records what landed on the run, not on a row beside it (§ 6.7). `ingest.py` and `graph_write.py`
reach **no app at all** now that their bodies sit beside them, so neither adds a row to `SPANS_ALLOWED`
([§ 6.3](#63-an-entry-is-a-view--the-spans-that-are-still-open)).

**`bulk_write` declares no `requires`, and that is what it is for.** `write_graph` requires
`validate_records` because everything it writes was checked against a published version; the fast path
writes what the files say. Borrowing `write_graph` would have a bulk load claim a validation it never
ran, and a plan naming `write_graph` without `validate_records` is refused by the validator — correctly.
So the fast path gets its own entry rather than a relaxed version of somebody else's, and `bulk-load@1`
is seeded once that entry exists ([LB14](../modules/workflows/features/the-library.md)).

The write loop itself never needed moving: it is `CSVLoader` in `invana/graph/loaders/`, band 1, and
`cli/commands/loader.py` only assembled its config. The entry calls the same loader the CLI did.

`question` and `options` are declared because a clarification writes them to the step row and Studio
reads them — an output a surface consumes is an API whether or not a plan binds it.

**The envelope's `require` key is gone.** `workflow_spec.require` is no longer read, and an envelope
cannot waive what an entry declares: `require: []` used to turn off the read-only precondition on
`execute_graph_query`. One source, and it is the one the planner drafts against — `generate_plan`
is handed each allowed key with its `requires` and its `outputs`, so an illegal order and a binding
to a field that does not exist are both things it can avoid rather than be refused for.

### 6.2 Where today's set and § 0.6's proposed set differ

| | |
|---|---|
| **Proposed, does not exist** | `emit_table` · `read_artefact` · `fetch_source` · `test_connection` · `run_query` (is `execute_graph_query`) · `introspect_schema` · every `graph_write` entry · `diff_models` · `check_capabilities` · `publish_model_version` · `snapshot_model` · every `ingest` entry · `understand` (is `understand_intent`) · `plan_queries` (is `plan_workflow`) · `translate` (is `translate_thought`) · `summarise` · `enrich_properties` · `judge` · `draft_plan` |
| **Exists, not proposed** | `shape_for_canvas` · `verify_result` · `understand_ask` · `propose_model` · `validate_proposal` · `spawn_agent` · `delegate` · `create_task` · `await_delegations` |
| **The bound § 0.6 was missing** | `work_write` — added there, not invented here |
| **The import and modelling bounds are empty** | `ingest`, `graph_write`, `network` and `plan_write` have no entry today. Ingestion runs through `apps/datasets` without passing the catalogue, which is why M2's dual-serve has nothing to point at yet. **M11 fills `ingest` and `graph_write`** (seven entries, § 7); `network` waits for M13's `test_connection` and `plan_write` for M5's `draft_plan` |

**`await_delegations` is control flow, and § 0.6 says control flow is never a catalogue entry.**
It stays declared with `bound: none` through M1 because `COORDINATOR` allows it by key today;
[the-runtime-package § 6.2](the-runtime-package.md) moves it into `interpreter/`.

### 6.3 An entry is a view — the spans that are still open

[the-runtime-package § 4](the-runtime-package.md) says an entry parses args, calls **one manager in
one app**, and serialises the declared outputs. Three modules still reach further, each named in
`SPANS_ALLOWED` in `tests/golden/test_catalogue.py`. **Deleting an entry there is how the conversion
finishes.**

| Module | Reaches | Closes when |
|---|---|---|
| `catalogue/schema_write.py` | `apps.llm` · `apps.modeller` · `apps.sessions` | `validate_proposal`'s `reconcile_proposal` moves from `apps/sessions` to an `apps/modeller` manager, and `understand_ask` stops going through `SessionManager._ensure_model_and_draft` |
| `catalogue/work_write.py` | `apps.agents` · `apps.work` | § 6.2's merge of `delegate` and `create_task` into one entry |
| `catalogue/contract.py` | `apps.graphs` · `apps.sessions` · `apps.skills` · `apps.llm*` | it declares no entries — it is the shared contract, and the test exempts it for that reason |

**A clarification's `options_query` is an unvalidated graph read inside an `llm`-bounded entry.**
`ground_options` in `apps/llm/clarify.py` runs a query the model wrote, against the graph, with no
`validate_query` in front of it. Moving it behind the app's manager makes the entry a view again but
does **not** close the bound hole. It closes when clarification becomes its own plan step in
**M5** — a `graph_read` node the validator can see — and until then the read is confined to
resolving option values and its result is never returned to the model.

### 6.4 The four import keys already exist, and are not renamed

`apps/datasets/run.py` writes its nodes by hand, and they already carry
`task_key` values: **`validate_records` · `write_graph` · `stitch` ·
`snapshot_model`**. [§ 6.2](#62-where-todays-set-and--06s-proposed-set-differ)
lists § 0.6's *proposed* names — `import_dataset`, `import_report` — and taking
those would rename a column whose values are stored on 179 live nodes and read
by Studio, which [§ 6.1](#61-the-catalogue-as-it-actually-is--twenty-two-entries)
already settles: **a stored key is renamed by a data migration, never by a
declaration.** So M11 declares the keys that exist.

| Key | Bound | Args | Outputs |
|---|---|---|---|
| `check_bundle` | `ingest` | `root` str | `datasets` list · `findings` list · `passed` bool |
| `validate_records` | `ingest` | `root` str · `model` str | `total` int · `errors` int · `warnings` int · `report` list |
| `write_graph` | `graph_write` | `root` str · `dataset` str | `nodes` int · `edges` int · `written` int |
| `stitch` | `graph_write` | `dataset` str | `resolved` int · `skipped` int · `blocked` int |
| `snapshot_model` | `schema_write` | `model` str | `model_id` str · `version_id` str |
| `bulk_write` | `graph_write` | `root` str | `written` int · `failed` int |
| `apply_stitches` | `graph_write` | `root` str | `declared` int · `already` int · `skipped` int · `passed` bool |
| `commit_stitches` | `graph_write` | — | `written` int · `rejected` int |

`ingest` and `graph_write` stop being empty bounds here; `network` waits for
M13's `test_connection` and `plan_write` for M5's `draft_plan`.

### 6.5 `WORKFLOWS` is the third dict, and it is what blocks an import run

[LB12](../modules/workflows/features/the-library.md#decisions) flipped *which
plan a Plan step selects* to rows. It did not flip **what the interpreter
dispatches on**, and those are two different lookups:

| Dict | Keyed by | Answers | State |
|---|---|---|---|
| `TEMPLATES` (`apps/agents/registry.py`) | plan key | which tail serves this intent | **gone from the run path** (M11a) — seeds the library and nothing else |
| `INTENT_TEMPLATES` | `(ask_kind, intent_kind)` | which plan key matches | selection, not the plan; moves onto the row in **M12** |
| **`WORKFLOWS`** (`runtime/workflows.py`) | `TaskRun.workflow_key` | retry policy, and the run's declared shape | **`loop.py:296` does `WORKFLOWS[th.workflow_key]`** |

That subscript is why ingestion runs inline. A load opens a run with
`workflow_key = "dataset-import@1"`, which is not one of the three keys
`WORKFLOWS` holds, so handing an import run to the interpreter raises
`KeyError` before a single node is dispatched. **Declaring the callables and
seeding the plans is not enough on its own** — the flow would still have nowhere
to run.

| Rule | |
|---|---|
| **The lookup is lenient** | `WORKFLOWS.get(key)`, not `WORKFLOWS[key]`. A run whose flow is a library plan is the normal case now, not a missing entry |
| **Retry comes off the row** | `tasks.retry` already exists and `steps_of` already emits it, so a plan states its own retry policy. `_retry_for` prefers the row, falls back to the workflow's declaration, then to `_RETRY_BY_TASK` |
| **`WORKFLOWS` keeps the three ask keys** | `nl-query` · `ql-query` · `modeller-generate` are what a session opens against, and they retire in **M12** when a session's message selects a plan like anything else |

### 6.6 The provenance stamp names the run

Everything a load writes carries provenance on the element itself
([load-data LD4](../modules/bring-data-in/features/load-data.md)) — and the id
in it was an `import_jobs` row. That table is deleted in M11, so the stamp has
to name the record that survives.

**This is a rename where the value changes with the name.** A job id is not a
run id, so renaming the key in place would leave a job id sitting under
`_inv_run_id` — a value whose meaning moved under a name that says the new
thing, which is the M3 trap exactly. The remap goes through `import_jobs.run_id`
and is a **graph-database migration**, which Alembic cannot perform: it ships as
`invana datasets restamp --graph <ref> [--apply]`, idempotent, dry by default.

| | Before | After |
|---|---|---|
| Written by | `_provenance()` in `apps/datasets/importer.py` | same, stamping `_inv_run_id` |
| Scoping a load's stitch solve | `solve.JOB_KEY` | `solve.RUN_KEY`, `$run_id` in the generated Cypher |
| The inspector's answer | `RecordProvenance.job_id` | `RecordProvenance.run_id` — **an API change**, so `openapi.json` moves with it |

**Order matters, and it is not the obvious one.** The restamp runs *before*
`import_jobs` is dropped, because the drop destroys the only mapping there is.
A graph upgraded in the wrong order has elements no load claims, and the command
reports that count rather than passing over it.

Until a Graph is restamped, its pre-M11 elements answer nothing: a load-scoped
solve matches zero records and the inspector reports no run for a record it can
otherwise resolve. Neither fails loudly, which is why the command reports what
it would do before it does it.

### 6.7 The Dataset is retired, and the model is the container

**M11 deletes `datasets` as well as `import_jobs`.** Both were records of the
loading machinery rather than of the product: one said *this load happened*, the
other said *these records arrived together*. The run answers the first. The
model answers the second, and always did — a dataset bound to exactly one model,
carried no shape of its own, and existed so the importer had somewhere to hang a
name and a path.

| What it held | Where it goes |
|---|---|
| `model_id` | the model **is** the container; the column was the relationship stated twice |
| `name` · `storage_uri` | a fact about one load → that run's `params` |
| `record_counts` | what the runs already report |
| `last_job_id` | the latest run naming this model |
| the `_inv_record_id` namespace | `_inv_model_id` ([BD17](../modules/bring-data-in/spec.md)) |

#### The moves

| | From | To |
|---|---|---|
| Package | `apps/datasets/` | **nothing — it dissolves.** With no records left it is not an app, so its bodies move into the catalogue entries that already name them ([the-runtime-package § 4a](the-runtime-package.md#4a-but-only-where-there-is-an-app-to-view)) |
| Stamp | `_inv_dataset_id` | `_inv_model_id` — a graph migration, `invana records restamp`, same shape as [§ 6.6](#66-the-provenance-stamp-names-the-run) |
| Stitch source | `ModelLink.dataset_id` | `ModelLink.source_model_id` — *which model's records ship this edge* ([ST27](../modules/connect-and-model/spec.md) is unchanged: keys **or** a source, never both) |
| Manifest | `_dataset_row` as the third branch of `_model_for` | **deleted.** A folder's `graph-model.json` already names its model, and that is what resolves a rule's side ([LD23](../modules/bring-data-in/features/load-data.md)). The manifest's format does not change; `stitches[].dataset` is renamed `rows`, because it names a rows file and never named a Dataset |
| CLI | `invana datasets import --model X <path>` | **`invana records import --model X <path>`** · `invana records check <path>`. `restamp` is deleted with the tables it read — it remapped *through* them, so it could only ever run while they existed. **The group names the object, because the verb is already spoken for**: `invana models import` brings a *model* in (`--file` / `--starter`) and has since share-a-model. Records are their own noun ([terminology](../terminology.md)), so they get their own group rather than a second meaning for one command. |
| Routes | `/datasets` · `/datasets/{id}/jobs*` | `/models/{id}/records/{record_id}` for provenance; every *what ran* question is `/runs?kind=import` |
| Studio | `useDatasets` · the Datasets types | the Models surface and the Runs drawer |

#### Where each file lands

`stages.py` goes first, because it is the one that was written twice: every function in it shares
its name — and most of its docstring — with the catalogue entry that calls it.

| From | To |
|---|---|
| `apps/datasets/stages.py` | **deleted** — the four stage bodies inline into their entries |
| `apps/datasets/importer.py` | `catalogue/records.py` — the bodies the `ingest` and `graph_write` entries call |
| `apps/datasets/stitches.py` · `stitch_records.py` | `catalogue/stitching.py` |
| `apps/datasets/bundle.py` | `catalogue/bundle.py` — no session, no connector; `invana models check` reads it offline |
| `apps/datasets/bulk.py` | `catalogue/bulk.py`, until the write loop comes **down** from `cli/commands/loader.py` as the `bulk_write` entry |
| `apps/datasets/load.py` | `catalogue/contract.py` — `LoadVars` beside the `RunVars` that carries it |
| `stages.open_load` | `runtime/services.py`, beside `open_load_run` — it is the prologue, not a step ([LD20](../modules/bring-data-in/features/load-data.md)) |
| `engine/tests/datasets/` | `engine/tests/ingest/` |
| `apps/datasets/schemas.py` | `server/` — a provenance response is an API shape |
| `apps/datasets/models.py` · `querysets/` | deleted with the tables |

The bands hold without a new allowance: every caller that survives — `cli/commands/{datasets,loader,stitches}.py`,
`server/routes/model_links.py`, `server/admin/views.py` — sits **above** `runtime`. The one
`apps → apps` edge, `apps/setup → apps.datasets.models`, dies with the ORM it imports.

#### The order, and why it is this one

1. **Seed the plans and dispatch the load** — while `datasets` still exists, so
   the flow is proven before the record it used to write is removed.
2. **Restamp the graph** — `_inv_dataset_id` → `_inv_model_id`, mapped through
   `datasets.model_id`. That table is the only mapping, exactly as
   `import_jobs` was in [§ 6.6](#66-the-provenance-stamp-names-the-run), so it
   runs **before** the drop and the drop is refused until it has.
3. **Drop `datasets` and `import_jobs`**, delete `import_dataset`, `run.py` and
   the Studio panels, in one slice — nothing is kept "until Studio catches up".
   `invana records restamp` goes with them: it resolved the old stamps *through*
   those tables, so it cannot outlive them. **An element still carrying an old
   stamp when migration 41 runs is stranded permanently**, and no migration can
   check that — the stamps are in the graph database, which Alembic cannot see.
   It is a release note, not a guard.

**A model with no published version cannot take records**, which is the one
thing the prologue already refuses ([LD20](../modules/bring-data-in/features/load-data.md)) and the
reason this collapse is safe: the container was never optional, so making it the
only container removes a record without removing a check.

---

## 7. Slices

Each slice is reproducible from a clean checkout before the next starts.

| # | Slice | Done when |
|---|---|---|
| **M1** | **Declare the catalogue.** Every `step_key` gets `bound`, `args`, `outputs`, `requires`. `DEFAULT_REQUIRE` folds in. No schema change | every `${steps.x.y}` in the codebase resolves against a declared output, a test fails on one that does not, and lane aggregation follows the declared type |
| **M2** | **`task_plans` + `tasks`.** Migrate `workflows`, explode `spec`/`dag` jsonb into rows, **materialise `depends_on` with `dag_for()` then review the six builtins**. Routes dual-serve `…/workflows` and `…/task-plans` | a workflow round-trips to rows and back to YAML byte-identically, and no plan carries a sequence-fallback edge nobody meant |
| **M3** ✅ | **`task_runs`.** Merge `thinkings` + `thinking_steps`; add `role`, `plan_snapshot`, `plan_origin`. `thought_stream` → `task_stream`, `prompt_answers` → `task_prompts`. **`thoughts` folds in here, not in M4** — a root run had exactly one, and the merge is where the second row stops paying for itself | **Done.** A question answers end to end and its trace nests its nodes under it. Delegation is **not** covered by that run: no seeded plan names `delegate`, `spawn_agent` or `await_delegations`, so no delegated run has ever existed — the nesting is proven by a plan's own nodes, and the delegation path is proven by the migration's structure rather than by a live trace |
| **M4** | **`todos`.** `tasks` → `todos` (**done in M2**), drop `TaskStatus`, add `closed_at`/`outcome`. **Studio ships in the same release** | the Work surfaces read a derived state and nothing writes a status column |
| **M5** | **`role = plan`.** `draft_plan` + envelope validation of a generated plan before any execute run | an ad-hoc ask with no matching plan generates one, is validated, runs, and can be promoted |
| **M6** | **`role = evaluate`.** `check-criteria` as a shipped plan; verdicts as `task_prompts` | an evaluator writes a verdict and **cannot** write `closed_at` — proven by a test |
| **M7** | **Lenses.** `lenses` table, `lens_snapshot` on the run, intersection of agent ∩ plan ∩ todo | a run pinned to `stitches: []` refuses a cross-model traversal with *outside the lens*, not *cannot answer* |
| **M10** | **Replan.** `plan_revision` on every run; `plan_snapshot` becomes the revision sequence; full re-validation per revision; `max_replans` on the envelope | a `verify` that replans mid-run keeps every settled child, re-validates the whole new graph against the envelope, and a test proves a replan cannot edit a settled node or change the lens |
| **M9** | **The budget pause.** `min(agent, plan, todo)` checked between dispatches; at the ceiling a `TaskPrompt kind=approval` naming the bound, the spend and the next node's estimate. `hard_ceiling` cancels | a run reaching its ceiling mid-fan-out finishes its in-flight lanes, parks in `awaiting_approval` holding no pool slot, and resumes from its cursor when a person extends it |
| **M8** | **Skills draw as plans.** `plan_id NOT NULL` on `skill_versions`, clarifications, the Flow tab | publishing a skill version publishes its plan as one act, and a catalogue gap becomes a `form: human` step rather than a block |

**M1–M2 were engine-only.** M3 is not: the run routes move from `…/thinkings` to `…/runs` and every read schema changes shape, so Studio ships with it. M4 is the next one that cannot be shipped without Studio.

### 7a. Folding the rest of the product in

[§ 4.1a](../orchestration.md#41a-nothing-executes-outside-the-runtime) makes this the rule rather
than an aspiration: **nothing executes outside the runtime.** These slices are what that costs.

| # | Slice | Done when |
|---|---|---|
| **M11** | **`apps/datasets` is dispatched, and the runtime executes from the library.** Two halves, one slice. (a) **The plan source flips**: `resolve_plan` reads `task_plans` + `tasks` rows instead of `apps/agents/registry.py`'s `template_for`; the registry becomes the seed source only, `TaskRun.task_id` is populated, and `plan_snapshot` freezes rows ([the-library LB12](../modules/workflows/features/the-library.md#decisions)). (b) **All four builtins ship**: declare `check_bundle · validate_records · write_graph · stitch · snapshot_model · bulk_write · apply_stitches · commit_stitches` — **eight, and the names are the ones already stored** (§ 6.4) — and seed `dataset-import@1 · bundle-import@1 · bulk-load@1 · stitch-apply@1`. (c) **`WORKFLOWS` stops being the dispatch authority** (§ 6.5), which is what an import run is blocked on today. `import_jobs` is **deleted**, not migrated behind an alias | a load opened from the CLI appears in the journal as a TaskRun with per-task rows, its rejections come from `import_report`, a bulk load and a stitch commit each leave a run, no code outside `runtime/` writes a progress row, and **the ask path runs from rows too** — `nl-single@1` answers end to end with `template_for` deleted from the run path |
| **M12** | **A session executes through plans.** Message → selection (matched · expert · generated) → run. `understand` runs under `loop {until: understood}` with `max_clarifications` on the envelope; answers carry forward across iterations | three rounds of clarification are three iterations of one run, the thread shows one exchange, and an authored expert plan beats a generated one on the same question |
| **M13** | **Interactive runs.** `test_connection` and `expand_neighbours` declared; `trigger` gains `canvas` and `system`; Runs' default filter excludes them; their retention is its own | a canvas expansion and a provider ping are ordinary TaskRuns with envelope checks and `result.json`, and the journal's default page does not show them |
| **M14** | **The model flows.** `publish_model_version` and `snapshot_model` dispatched as plans. **`bulk_write`, `apply_stitches` and `commit_stitches` moved into M11** — they die with the same `import_jobs` table and the same `apps/datasets` modules, so splitting them across slices would leave that package half-dispatched | a model import and a version publish each leave a run, and nothing in `apps/` calls a connector or a provider directly |

**Order:** M11 after M3 (it needs `task_runs`), M12 after M5 (it needs `role = plan`), M13 and M14
any time after M11.

**Why the flip belongs in M11 and not later.** The runtime has never read the library — `plan_workflow → select_template → template_for` is a dict lookup, so the rows `ensure_seeded` writes are read only by Studio. M11 is the first slice that *adds* plans, and adding four more to a registry the runtime reads means writing them twice and flipping twice. Doing it here also pays M11's own debt: a dispatched import needs `TaskRun.task_id` to name the node that ran, and today that column cannot be populated from the runtime at all. **M5 is not the forcing point it looks like** — a generated plan is already rows, so if the flip waits for M5 then the ask path reads a dict, the generated path reads rows, and the interpreter carries two resolvers through the slice that is hardest to debug.

#### Measure before M13

M13 turns a click into rows. The governance rule ([§ 4.1a](../orchestration.md#41a-nothing-executes-outside-the-runtime))
is not the dial — **granularity and retention are**, and both are read-side, so tuning them never
reintroduces a second write path. Four numbers decide them, and three of the four can be taken
*before* any of this is built:

| Measure | How | Why it decides something |
|---|---|---|
| **Expands per minute, per active person** | instrument today's canvas read path for a week | the whole volume estimate multiplies from this |
| **Rows and bytes per expand** | prototype `expand_neighbours` on a dev Graph: run row + task rows + `result.json` + stream frames + event | tells you whether one expand is 3 rows or 12, and whether `result.json` needs a size cap |
| **Added latency per dispatch** | p50/p95 of envelope check + plan snapshot + lens snapshot, against the raw query | **the real risk.** A 40 ms expand that becomes a 140 ms expand is felt; a large table is not |
| **The audit window that is actually used** | what people ask of the journal past 7 days, past 30 | retention for `trigger in (canvas, system)`, which is separate from deliberate runs |

If the numbers are bad, the dials in order of preference: **coarser granularity** (one Task per
expand rather than three — [§ 4.1](../orchestration.md#41-what-is-a-task--and-what-is-not)'s three
questions are exactly this decision), **shorter interactive retention**, **prune the parts not the
row** (keep the run and its outcome, drop stream, log and `result.json` after *n* days), and
**reference rather than copy** the plan and lens snapshots for one-callable builtin plans.

### 7b. What is deleted, not migrated

No backward compatibility is kept. Each row below is removed in the slice that replaces it.

| Deleted | Slice | Replaced by |
|---|---|---|
| `import_jobs` table, manager and routes | M11 | `task_runs` where `kind in (import, bulk)` |
| `GET …/imports` (and any alias of it) | M11 | `GET …/runs?kind=import` |
| `template_for` in the run path (`apps/agents/registry.py` → `runtime/planning.py`) | M11 | `resolve_plan` reading `task_plans` + `tasks`. The registry survives as the **seed source** `ensure_seeded` explodes, and nothing else imports it |
| Direct connector writes in `apps/datasets/bulk.py` · `stitches.py` · `stitch_records.py` | M11 | `bulk_write` · `apply_stitches` · `commit_stitches`, under the `graph_write` bound |
| `POST …/stitches/apply` · `…/stitches/commit` · `…/bulk` as their own routes | M11 | starting the matching builtin plan, and `GET …/runs?kind=bulk\|stitch` to read it |
| `thinkings` · `thinking_steps` · `thoughts` · `thought_stream` · `prompt_answers` | M3 | `task_runs` · `task_stream` · `task_prompts` |
| `workflows` · `workflow_versions` as separate nouns | M2 | `task_plans` + `plan_versions` |
| `TaskStatus` column | M4 | state derived from runs (a one-way door, § 9) |
| `studio/…/features/bring-data-in/ImportsPanel.tsx` (~808 lines) | M11 | the Runs drawer, `kind = import` |
| `studio/…/features/workflows/WorkflowsPanel.tsx` (~500 lines) | M2 · M11 | the Plans drawer |
| `studio/…/features/work/TasksPanel.tsx` (~798 lines) | M4 | Todos under Projects, and the Runs drawer for execution |
| `?panel=imports` · `?panel=workflows` · `?panel=thoughts` redirects | M11 | nothing — the keys are gone, and [G31](../building-studio/graph-detail-page.md)'s read-never-written paragraph goes with them |
| Direct provider calls in `apps/llm_providers` · direct connector reads in the canvas path | M13 | `test_connection` · `expand_neighbours` |
| The words *Thought · Thinking · Step-as-a-record · job* | M3 | [terminology.md](../terminology.md) § 8 |

**The rule that makes the deletions safe:** a flow is folded in the same slice its old path is
removed, and each slice is reproducible from a clean checkout before the next starts. Nothing is
kept "until Studio catches up" — where a slice needs both sides (M4, M11), both ship together.

---

## 8. What Studio changes, and when

| Slice | Studio |
|---|---|
| M2 | `WorkflowsPanel` reads `…/task-plans`; the step view reads `/{key}/tasks` |
| M3 | The **Thoughts** journal becomes **Runs** — surface rename, route rename, nested child runs |
| **M4** | **Lockstep.** Tasks panel → Todos; no status chip driven by a column; accept/reject are the only closers |
| M6 | Review queue splits `approval` (person only) from `verdict` (either) |
| M7 | A lens picker on run dialogs; *outside the lens* as a distinct empty state from *cannot answer* |
| M8 | A **Flow** tab on the skill panel, reusing the plan canvas (screen 34) — not a new screen |

---

## 9. The one-way doors

| Decision | Why it cannot be walked back cheaply |
|---|---|
| `Task` means a plan node | Every route, type, test and Studio prop that says *task* changes referent. Doing it twice is the cost to avoid |
| `TaskStatus` is deleted | Once state is derived, re-adding a column means reconciling it with runs forever |
| The catalogue is closed | Opening it later to plugins makes the envelope advisory, and the envelope is the product's safety story |
| `skill_versions.plan_id` is `NOT NULL` | Backfilling a plan for every existing skill version is the migration; making it nullable later is easy, making it NOT NULL later is not |

## Not building

| Not building | Because |
|---|---|
| A compatibility shim that keeps `Task` meaning both things | two referents for one word is exactly what this migration exists to end |
| Versioned TaskPlans | the run freezes `plan_snapshot`; a version table records the same fact twice |
| `task_logs` | OTel already holds them, correlated by `run_id` |
| A plugin-registerable catalogue | the closed set *is* the policy |
