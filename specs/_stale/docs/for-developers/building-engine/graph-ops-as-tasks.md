# Graph operations as tasks — what to build, in what order

Every act that reads or writes the graph runs as a catalogue callable, through the runtime, under a
lens ([orchestration § 4.1a](../orchestration.md#41a-nothing-executes-outside-the-runtime)). The
decisions are settled in the files below. **This file is the build order and nothing else** — no
decision is made here.

| | |
|---|---|
| Sibling to | [lens-migration.md](lens-migration.md) · [task-model-migration.md](task-model-migration.md) |
| Branch | `feat/expand-as-a-task` |

## Where each decision lives

| Decision | Lives in |
|---|---|
| Nothing executes outside the runtime | [orchestration § 4.1a](../orchestration.md#41a-nothing-executes-outside-the-runtime) |
| The callables, grouped by bound | [orchestration § 0.6](../orchestration.md#06-the-catalogue--what-a-plan-may-name) · [task-model-migration § 6.1](task-model-migration.md) |
| A graph act is a one-callable builtin plan | [LB32](../modules/workflows/features/the-library.md) |
| An expansion is a run · one callable · three grains · the session's lens · awaited · refusal named · resolve on reopen | [GC6–GC14](../modules/explore/features/graph-canvas.md) |
| Type counts under the lens | [SP11](../modules/explore/features/selection-and-the-panel.md) |
| A structured reader takes the lens as input (Gremlin too) | [CC22](../modules/graph-connectors/features/the-connector-contract.md) |
| `run_inline` · `TriggeredBy.canvas / system` | [RP31](../modules/platform/features/runtime.md) |
| Writes: `allow` only, fatal target, skipped counterpart | [GV35](../modules/govern/spec.md) |
| Stitch commit, removal and preview are runs | [ST54 · ST55 · ST56](../modules/connect-and-model/features/stitch-models.md) |
| Testing a connection · introspection · DDL projection are runs | [CD10](../modules/connect-and-model/features/connect-a-database.md) · [ID4](../modules/connect-and-model/features/introspect-a-database.md) · [CM10](../modules/connect-and-model/spec.md) |

## What still reaches a connector directly

| Path | Today | Closed by |
|---|---|---|
| Connection test · ping · introspect | `server/graphs/views.py` | PR 6 |
| Model publish → DDL | `apps/modeller/projector.py` | PR 7 |
| ~~A clarification's options query~~ | ✅ inside the run, under its lens, touched | PR 3b |
| ~~`invana stitches resolve` · the drawer's stitch preview~~ | ✅ `stitch-preview@1` | PR 8 |
| ~~Stitch commit — drawer · CLI~~ | ✅ `stitch-commit@1` | PR 2 |
| ~~Remove an active stitch~~ | ✅ `stitch-withdraw@1` | PR 2b |
| ~~Expand neighbours (+ by edge type, by node type)~~ | ✅ `expand-neighbours@1` | PR 3 |
| ~~Type counts · resolve elements~~ | ✅ `count-types@1` · `resolve-elements@1` | PR 5 |

## Callables to add

| Callable | Bound | Args | Outputs | Builtin plan · trigger |
|---|---|---|---|---|
| `expand_neighbours` | `graph_read` | `vertex_id` · `direction` · `edge_label?` · `neighbor_label?` · `filters` · `sort` · `limit` · `offset` | `nodes` · `edges` · `metadata` · `total` · `has_more` | `expand-neighbours@1` · `canvas` |
| `count_types` | `graph_read` | — | `node_types` · `edge_types` · `counted` | `count-types@1` · `canvas` |
| `resolve_elements` | `graph_read` | `vertex_ids` | `present` · `missing` — what the world excludes is in neither (GC14) | `resolve-elements@1` · `system` |
| `test_connection` | `network` | `connection?` | `ok` · `latency_ms` · `version` | `test-connection@1` · `user` / `system` |
| `introspect_schema` | `graph_read` | — | `node_types` · `edge_types` | `introspect-schema@1` · `user` / `system` |
| `preview_stitches` | `graph_read` | `rules` (one draft) · `all_links` | `previews` — per rule: preview · written · refused | `stitch-preview@1` · `user` |
| `project_model` | `schema_write` | `version_id` | `created` · `dropped` · `warnings` | `project-model@1` · `user` |

Each one raises `ENTRY_COUNT` in `tests/golden/test_catalogue.py` — record it in
[task-model-migration § 6.1](task-model-migration.md) first.

## Build order — one PR each

| PR | Ships | Done when |
|---|---|---|
| 0 ✅ | Catalogue route + drawer ([7.6](../modules/workflows/features/the-catalogue.md)) | every entry is visible in Studio |
| 1 ✅ | Decisions folded into their feature files; this file cut to the build order | nothing here decides |
| 2 ✅ | Stitch commit as `stitch-commit@1`; `admit` required | a guardrail denying a model refuses its edges, drawer and CLI |
| 2b ✅ | Stitch removal as `stitch-withdraw@1` | no route calls `withdraw_link` |
| 3 ✅ | `expand_neighbours` + plan + `TriggeredBy.canvas / system`; explorer view becomes a launcher | an expansion under a world hides denied types, on Cypher **and** Gremlin; it shows in Tasks |
| 4 ✅ | Studio — expand sends the picked world, the turn renders as a run (thread and Tasks), the refusal copy names what the world lacks | the Assistant's "Added 24 nodes" rows are runs |
| 5 ✅ | `count_types` + `resolve_elements`; the fine-tune menu and the expand submenus list the types `count_types` returns, so a world's denied types are never offered (GC13) | the types panel and a reopened canvas honour the world |
| 6 | `test_connection` + `introspect_schema` | no route in `server/graphs` calls a connector |
| 7 | `project_model` | publishing a model opens a run |
| 3b ✅ | A clarification's `options_query` runs through the run's graph crossing | no query a run sends escapes its lens |
| 8 ✅ | `preview_stitches` + `stitch-preview@1` — the drawer's preview and `invana stitches resolve` | both open a run; neither the route nor the CLI calls a connector |

## Risks

| Risk | Mitigation |
|---|---|
| A click becomes a run row, a stream and touches | inline dispatch (RP31); measure p95 before and after PR 3 |
| Run volume | read-side filter and retention ([§ 4.1b](../orchestration.md#41b-interactive-runs)), never a shortcut path |
| The Gremlin structured lens is new code | one positive and one negative test per dialect, against live databases |

## Out of this work

| | Because |
|---|---|
| Algorithms, shortest path, node-by-id as callables | not in the feature index; each arrives as a callable when it gets a feature |
