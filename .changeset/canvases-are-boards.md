---
"invana": minor
---

Canvases are boards, and a board declares one kind.

The word meant three things — the renderer (`@invana/canvas`), the drawing surface, and the saved
row — so `canvas.kind = dashboard` read as a canvas that is not drawn on a canvas. The record is
now a **board**; the renderer and the surface keep the word. A board is drawn on a canvas, or it is
declared: panels bound to one record.

`kind` is **one flat axis of nine** — `data · model · plan · workflow · envelope · lineage · run ·
task_run · plan_runs` — and whether a board is drawn or declared is `renders`, a property of the
kind in the registry rather than a second column. Two columns would make `kind=canvas,
subject=run` representable and meaningless.

**`session_id` is nullable now.** It was `NOT NULL UNIQUE`, which is the reason only a `data` board
could ever be saved — a model, plan or dashboard board has no backing thread. It stays a CASCADE
foreign key for the boards that have one: provenance, not identity.

**A live dashboard has no row.** It is derived from its subject on every open, so nothing is written
when one is opened. The row is created lazily by the first act that keeps something — a saved
**report**, which is one frozen version of the board, stored with its numbers already in it so it
renders with no fetch and outlives its run's pruned `result.json`.

Renames, all of them breaking:

| Was | Is |
|---|---|
| `canvases` · `canvas_states` | `boards` · `board_versions` |
| `canvas_states.kind` | `board_versions.cause` (+ a `report` value) |
| `…/canvases` · `…/canvases/{id}/states` | `…/boards` · `…/boards/{id}/versions` |
| — | `…/boards/{kind}/{subjectId}/versions` — a declared board, addressed by what it is of |
| `canvas.create · update · delete` | `board.create · update · delete` |
| `INVANA_CANVAS_HISTORY_LIMIT` | `INVANA_BOARD_HISTORY_LIMIT` |

Migration `000000000043` renames both tables and every index, constraint and foreign key that came
with them, adds `kind` and `subject_id`, and relaxes `session_id`. Existing rows land as
`kind='data'`. The downgrade drops every board that has no session, because nothing below this
revision can read one.

The design is [docs/for-developers/building-engine/boards-migration.md](docs/for-developers/building-engine/boards-migration.md);
the feature is [4.2 Boards](docs/for-developers/modules/explore/features/boards.md).
