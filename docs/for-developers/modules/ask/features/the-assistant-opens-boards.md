# The assistant opens boards

Ask the assistant for a list — *show me Route Auditor's failed runs this month* — and it opens that list
with the filters set, marked *set by the assistant*, and its reply carries a link to the same view.

| | |
|---|---|
| Index | [3.15](../../../README.md#3--ask) · Slice **F05** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [the-assistant](the-assistant.md) · [list-contract](../../platform/features/list-contract.md) · [the-run-page](../../agents/features/the-run-page.md) · [the-ledger](../../operate/features/the-ledger.md) · products: agent-fabric.md › Lists, filters and the assistant · AF-26 |

Product spec: [EX-F03 · Ask a question](../../../../../specs/capabilities/explore/features/EX-F03-ask-a-question/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| The link card | in the assistant thread: an icon, `<List> · N filters`, the count — one `Button variant="outline"` |
| The list | the list page with the strip; chips marked *set by the assistant* because the URL has `via=assistant` |

## Engine

| Thing | Shape |
|---|---|
| Intent | `open_list` joins `INTENT_KINDS`; `refs` carry `{list, agent, status, since, started_by, origin, verdict}` as words |
| Flow | packaged `board.open` — `nl.understand → board.open`; `INTENT_TEMPLATES[("nl", "open_list")]` |
| Function | `board.open` (`core.pure`, bound none): in `{list, filters}`, out `{path, params, chips[{field, title, value, label}], total, unresolved[]}`; emits a `link` emission. The word table and name resolution live in `runtime/managers/board_open.py` |

## Decisions

| # | Decision |
|---|---|
| OB2 | **The engine resolves names to ids**, under the asker's rights; Studio never matches an agent name. |
| OB6 | **A list joins `board.open` by registering itself** — its key, label, path, row noun, its `ListSpec` and a counter that runs the list's own query. The runtime registers Runs and Agents; Activity registers Approvals and the ledger, so the runtime never imports the band above it. A chip carries `{field, title, value, label}`, the list contract's applied filter. |
| OB7 | **A seeded agent gains what a release ships.** On each seed, the Explorer and Coordinator agents receive the functions and packaged flows added since they were last given any (`workflow_spec.shipped`); what an owner removed is not given back. |

