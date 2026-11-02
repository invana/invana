# Edit the graph's data

Nodes and relationships added, changed and deleted on the Explorer's board, against the graph's model,
held on the board until saved, and saved to the database as one run.

| | |
|---|---|
| Index | [4.7](../../../README.md#4--explore) · Slice **—** (not scheduled) |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [selection-and-the-panel](selection-and-the-panel.md) · [graph-canvas](graph-canvas.md) · [boards](boards.md) · [model-editor](../../connect-and-model/features/model-editor.md) · Invana Products EX-20 · EX-21 ([explorer.md](../../../../products/explorer.md)) |

Product spec: [EX-F06 · Annotate and edit the data](../../../../../specs/products/explore/features/EX-F06-annotate-and-edit-the-data/feature.md) — the story, its criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Where | Component | Reads / writes |
|---|---|---|---|
| Mode picker | the board's top-left row | canvas-react `BoardModes`, canvas-ui `BoardModePicker` | — |
| Edit tools | the row, in Edit | canvas-react `CreateNodeBehaviour` · `DrawEdgeBehaviour` | the graph store |
| Element panel | the rail, top-right | canvas-ui `ElementViewPanel` with `schema`, `strictSchema` | the active model version |
| Changes panel | the rail, with its count | canvas-ui `ChangesViewPanel` over `UnsavedChangesBehaviour` | `unsaved.save` → the save route |
| The model, as the panel reads it | host | `elementSchemaOf(version)` | `GET …/schemas/active-version` (`useActiveVersionQuery`) |
| Save | host registers `unsaved.save` | `useSaveDataEdits` | `POST /api/v1/u/{username}/{graphSlug}/data-edits` |

## Engine

**The route opens a run.** Nothing writes outside the runtime ([orchestration](../../../orchestration.md) §4.1a):
the route checks the role and the batch against the model, then opens a run of the flow
`data-edit@1`, whose one task `apply_data_edits` writes through the connector's data writer.

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/v1/u/{username}/{graphSlug}/data-edits` | `DataEditBatch` | `DataEditResult` once the run settles, or 422 / 403 / 409 with the refusal |

`DataEditBatch`

| Field | Type | Notes |
|---|---|---|
| `model_version_id` | string | the version the editor read; a batch against an older version is checked against the active one |
| `edits` | `DataEdit[]` | applied in order |

`DataEdit` — one per change, tagged by `op`

| `op` | Fields | Notes |
|---|---|---|
| `add_node` | `ref`, `type`, `properties` | `ref` is the board's id; returned mapped to the database id |
| `add_edge` | `ref`, `type`, `source`, `target`, `properties` | `source` / `target` are database ids or `ref`s of nodes added earlier in the batch |
| `update_node` | `id`, `type?`, `set`, `unset` | a new `type` relabels the node; `unset` removes keys |
| `update_edge` | `id`, `set`, `unset` | a relationship's type does not change: delete and draw again |
| `delete_node` | `id` | takes its relationships with it |
| `delete_edge` | `id` | |

`DataEditResult`

| Field | Type | Notes |
|---|---|---|
| `run_id` | string | the `data-edit@1` run |
| `ids` | `{ ref: id }` | each added element's database id |
| `applied` | int | edits written |

| Refusal | Status | Code |
|---|---|---|
| Not a contributor | 403 | `role_required` |
| Read-only connection | 409 | `read_only_graph` |
| No published model | 409 | `no_model` |
| A type or key the model does not have | 422 | `not_in_model`, naming the edit and the key |
| The same key twice in one edit | 422 | `duplicate_key` |
| A database with no data writer | 409 | `writes_unsupported` |
| The database refused | 502 | `write_failed`, with the database's message |

## Decisions

| # | Decision |
|---|---|
| DE1 | `data` is a third kind that writes, and only in Edit mode: a node or a relationship is placed by a gesture, every field is a form ([SP2](selection-and-the-panel.md#decisions)) |
| DE3 | Save is a run (`data-edit@1`), never a direct write from a route; the route only checks and opens it |
| DE7 | The panel reads the model from the active version's types and their effective property keys, with each key's data type — nothing about the model is written into Studio |
| DE8 | Added elements carry the board's id until saved; the result maps each to its database id and the board takes it |

## Not building

| Item | Why |
|---|---|
| Editing data on any other board kind | `model` and `plan` write their own things; the rest stay read-only |
