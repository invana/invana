# The runtime

System design: [runtime.md](../../../../../specs/system-design/runtime.md) — what the runtime is, its parts, Todo → Flow → TaskRun, every kind, the plan grammar, repetition and the verdict, the frontier, fan-out, signals, bounds and pools, cancellation, the three pauses, approval, starting a run and its events, caching, the six outputs, auditability, artifacts, the records it adds, seams, decisions and what is not built. This file keeps where each kind stands, how this lands, and the rows the live task model retired.

| | |
|---|---|
| Index | [13.8](../../../README.md#13--platform) · Slice **S15** |
| API / CLI / Studio | 🟡 / — / — |
| State | Built and shipped; the system design is the shape it is being moved into |

## 3.1 Every kind runs here — where each stands

| Kind | Its plan | Opened by | Through the interpreter |
|---|---|---|---|
| `ask` | selected by intent, generated when nothing fits | the composer · a Todo · a schedule | ✅ |
| `import` | `dataset-import@1` — `validate_records · write_graph · stitch · snapshot_model` | `invana records import` · `POST …/datasets/{id}/imports` | ❌ **hand-written rows** |
| `bulk` | `bulk-load@1` — one step, `bulk_write` | `invana loader --graph` | ❌ **no run row at all** |
| `stitch` | `stitch-apply@1` | `invana stitches apply` | ❌ |
| `enrich` | authored or promoted | a plan step · a schedule | 🔵 not built |

Three of the five do not run here today, and the cost is not theoretical:

| Duplicate | Where | What it costs |
|---|---|---|
| A second run table | `import_jobs` — its own status enum, its own lifecycle, `run_id` pointing sideways at the real run | one load, two records that can disagree |
| A second interpreter | `apps/datasets/run.py` writes `RunStep` rows by hand — `start` · `finish` · `fail` | retries, timeouts, cancellation, signals and approvals are absent from imports, and adding one means writing it twice |
| A second log store | `import_jobs.logs` jsonb, against `run_logs` for everything else (§17) | level filtering is queryable for a question and not for a load |
| A second event vocabulary | `import.started · progressed · completed · failed · cancelled`, against the closed `run.*` set (§13) | an automation watching runs does not see imports |
| A plan outside the library | `dataset-import@1` is a constant in `apps/datasets/`; `WORKFLOWS` in `runtime/workflows.py` holds three more | `plan_origin` names a version the library cannot resolve, so the trace cannot show the plan that ran |

**The fold is the fix, and it runs one way.** `import_jobs` folds into `todos` · `task_runs` ·
`task_runs`; its `logs` become `run_logs`; its events become the `run.*` set; its four steps
become catalogue entries the interpreter dispatches; and its plan becomes a **builtin workflow
version** in the library like any other ([§7 F9](../../workflows/spec.md)).

## 21. How this lands — plan

`attempt` rows, `idem_key` on the stream, `plan_version` and both lineage directions already exist and
do not change.

**Not all of this is scheduled.** The shipped pipeline is seven linear steps with no branch and no
fan-out, so the frontier, lanes, loops and pools were designed here and **deferred** until a real flow
needed them — building the graph before one exists means designing the wrong graph. Four of those
triggers have now fired: [2.3](../../bring-data-in/features/load-a-bundle.md) needs a branch, a
fan-out and a composition, and a draft-judge-refine flow needs an iteration that waits on a person
(§4.1). Pools and automations are still waiting. The split, and the trigger that unblocks each, is
[building-engine §17](../../../building-engine/migration-plan.md#17-order-of-the-band-work).

| # | Change | Risk |
|---|---|---|
| 1 | Rename only — `task_key` → `step_key`, `TaskContext` → `StepContext`, `TaskFailure` → `StepFailure` | none — large diff, trivial review, done alone |
| 2 | Move files into `runtime/` submodules, no edits inside them | none |
| 3 | Split `tasks.py` (48 KB) into `catalogue/`, one file per step group; add the input schemas | low |
| 3.5 | **Green the run test suite** | precondition for 4 and 5 |
| 4 | Signals — `_loop` returns and honours one enum instead of seven exception types, still linear | real, isolated |
| 5 | Step timeout, run deadline, cancellation contract, provider rate limits | medium, independent |
| 6 | Approval — columns, routes, the Review row kind, the threshold checks | low, additive |
| 6b | **Verdict** — the columns, the route, the Review row kind, and `${self.feedback}` binding into the next pass (§4.1 · §10). Lands with `loop` | low, additive — but needs `iteration` in the step key first |
| 7 | `run_logs` with its correlation fields · `artifacts` · the lineage resolver | low, additive |
| 8 | The emitted event set · `opened_by_event_id` · run `idem_key` | low |
| 9 | Fold `import_jobs` into task_runs; its `logs` become the general ones | medium — touches shipped import surfaces |

Step 4 is the only behaviour change here, and it is not safe without a green suite. It restates
branching that already exists in `_loop`; it does not add any.

### Deferred

| Deferred | Unblocked when |
|---|---|
| **The frontier** — plan edges, readiness, parallel dispatch, `skipped`, `interrupted` (§4 · §5) | **unblocked** — `bundle-import@1` branches on a failed lane (§3.2) |
| **Lanes** — `map_over`, the key change, per-lane retry (§6) | **unblocked** — `bundle-import@1` fans out over the bundle's datasets (§3.2) |
| `uses` composition (§4) | **unblocked** — `bundle-import@1` inlines `dataset-import@1` rather than copying it (§3.2) |
| **`loop`** — node-internal iteration, including the `verdict` pause (§4.1) | **unblocked** — a draft-judge-refine flow iterates on success and waits on a person to say it is good enough. Same key change as lanes, so they land together |
| **Pools** and the other ceilings (§8) | something starves. One Graph-wide ceiling ships today and has not been hit |
| automations · the provider cache (§13 · §14) | something outside a run needs to open one, or a repeated call needs to be cheap |

The frontier is the largest change in the module and it rewrites the subtlest code in it — `cursor`,
`_pending_rows`, `_drop_pending`, and `message_id` carried on steps so a resumed run keeps its earlier
question's rows. That is a good reason to do it once, against a flow that actually exercises it. **That flow now
exists**: the first three rows above were deferred for want of one, and [2.3 Load a
bundle](../../bring-data-in/features/load-a-bundle.md) is it — declared in a manifest a person already
writes, checked offline before anything runs, and needing a branch, a fan-out and a composition each
for a stated reason rather than in anticipation.

The fold of `import_jobs` (RP29b) is step 9 of the table above and does **not** wait on the frontier:
an import's four stages are linear, so they become catalogue entries the shipped interpreter can walk
today. Only the *bundle* needs the deferred machinery.

## Retired — superseded by the live task model

The live records are [orchestration § 0](../../../orchestration.md#0-the-records).

| Section | Retired row | Why |
|---|---|---|
| 3.1 | A kind is a property of the todo; `runs.kind` selects a plan | `kind` is the subject of the Flow |
| 3 | `plan_origin = reused:<id>` | `plan_origin` is `authored · generated · reused` |
| 11 | Membership is the permission — any member decides, there are no roles | Who decides an ask is the Inbox's (IN-F01), under Graph roles |
| 11 | The decision as `approved_by` · `approved_at` · `args_before` · `args_after` on the step row | A pause is a `TaskPrompt` row — who answered, when, the answer |
| 15 · 17 | Log lines in `run_logs` rows (`ts · level · step_id · lane · message`, capped per run); `import_jobs.logs` folding into them | A log line goes to OpenTelemetry correlated by `run_id`; there is no log table |
| 19 | `task_runs` gains `approval_state` · `approved_by_id` · `approved_at` · `args_before` · `verdict_state` · `verdict_by_id` · `verdict_at` · `verdict_note` | `TaskPrompt` holds every pause and its answer |
| 19 | `todos` gains `idem_key` | `idem_key` is on the TaskRun |
| 19 | `run_logs` table · `artifacts` keyed by content hash with `graph_id` · `kind` · `bytes` · `expires_at` | No log table; an artifact is a `TaskArtifact` (`run_id` · `task_id` · `key` · `media_type` · `size_bytes` · `digest` · `uri`) |
| 19 | Routes `POST …/task_runs/{id}/steps/{step_id}/approve` · `…/reject` · `…/verdict` · `GET …/reviews?kind=` · `GET …/task_runs/{id}/logs` | A pause is answered through its `TaskPrompt`; there is no log route |
| 1 · 22 | The runtime does not distribute across machines; *distributed workers* and *a second executor* not built | Workers run steps through the engine's gateway on procrastinate |
| 22 | Approval roles | Graph roles exist; quorums and escalation chains stay not built |
| 10 | The *Today* row of the pause table, and the clarification's partial record (`status=needs_input`, `output.clarifications`, no events) | Build status, superseded by `TaskPrompt` |
