# Share an answer

An answer is shared with the Graph's members as a live link or a frozen snapshot, and with anyone else
as a file — never as access.

| | |
|---|---|
| Index | [4.5](../../../README.md#4--explore) · Slice **C09** (EX-15) |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | ✅ / 🔵 / ✅ |
| Related | [boards](boards.md) · [the-console](the-console.md) · [the-answer-surface](../../ask/features/the-answer-surface.md) · [roles](../../identity-and-access/features/roles.md) · products: explorer.md EX-15 |

Product spec: [EX-F02 · Share and present an answer](../../../../../specs/capabilities/explore/features/EX-F02-share-and-present-an-answer/feature.md) — the story, its criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Reply line | *Share* on the answer's meta line ([AS16](../../ask/features/the-answer-surface.md#decisions)), on a settled answer with a run — the assistant's `useShareAnswer` slot, filled by the action `explorer.shareAnswer` |
| Share dialog | `@invana-studio/explorer` `share/ShareAnswerDialog` — *With members*: Live link · Frozen snapshot, and what a snapshot holds; *Export*: PNG · CSV · Markdown; the note that outside people get a file; Cancel · Copy link |
| Snapshot page | `/u/:user/:graph/explorer?page=run:<runId>@<versionId>` — the Workbook's frozen-report page; listed under the run board's *Reports* |
| CLI | `invana views list` · `export <view> --format png\|csv\|md` — not built (🔵) |

## Engine

No new route, table or column. The snapshot is a report on the answer's run.

| Route | Used for |
|---|---|
| `POST …/boards/run/{runId}/versions` `{cause: report, label, snapshot, banner?, message_id}` | Keep the snapshot; create-or-get of the run's board happens server-side |
| `GET …/boards/run/{runId}/versions/{versionId}` | Open it — the frozen-report page |
| `GET …/runs/{runId}/emissions` | The answer's records, read once when the dialog opens |
| `GET …/dataset-bindings` | The dataset versions bound when the snapshot is taken |
| `GET …/boards?…` · `…/boards/{id}/banner` | The thread's board and its last picture, for PNG and the snapshot's thumbnail |

| Snapshot document (`BoardSpec`) | Holds |
|---|---|
| Header | The question; chips: *Snapshot*, the world as frozen; the time it was taken |
| `narrative` | The answer's sentence |
| One panel per emission | `table` (rows) · `metric` · `bars` (a chart's series) · `table` titled *Board* (a subgraph's nodes — name, type, id — with the node and edge counts) · `narrative` (prose) · `text` (an empty answer's statement) |
| `citations` | One source per emission: its query language, record count |
| `list` | The dataset versions bound when it was taken, `publisher/name@v` |

## Decisions

| # | Decision |
|---|---|
| SA1 | **Share sits on the answer's meta line strip,** on a settled answer with a run — the same condition as keeping it. The assistant owns the button; the dialog is the Explorer's, reached through the action registry (`explorer.shareAnswer`), so the assistant imports no product. |
| SA2 | **The live link is the thread's own path** — `/u/:user/:graph/explorer/:session`, the address a thread already has. Sharing it writes nothing. |
| SA3 | **A snapshot is a report on the answer's run.** It is a `board_versions` row of the run's declared board (`run:<id>`), cause `report`, label `Snapshot — <question>`, `message_id` the reply. The document is composed in the browser from what the member is looking at and stored whole; it is never re-read against the run. No new engine kind, route or table. |
| SA4 | **The snapshot link opens the frozen-report page in the Explorer** — `/u/:user/:graph/explorer?page=run:<runId>@<versionId>`. The path names no thread: a thread in the path opens its own board and takes the focus from the snapshot. The run board's *Reports* lists it with every other kept reading. Its trail is *Graph › Sessions › <question>*, the question read off the report's title. |

## Not building

| Not building | Because |
|---|---|
| Export from the CLI | `invana views export` waits for saved views in the engine |
