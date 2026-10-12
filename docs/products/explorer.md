# Invana Explorer — ask and look

The simplest product. Prototype page: *Invana Explorer › Ask and look*.

| | |
|---|---|
| For | analysts |
| Scope | One Graph |
| Layout | No rail. Full width: board plus the assistant chat; floating vertical toolbar top-left (compact until Tools is on) |
| Hands off to | Shell › Schedules (“Schedule this”) · Projects (“Add to a project”) · Modeller › Requests (“Ask for a change”) |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| EX-F1 | Question box, suggestions, saved views | In Studio | EX-01 |
| EX-F2 | Answer on the board; record card; chart answers | In Studio | EX-02 · EX-03 |
| EX-F3 | Trace — LLM → query → record → dataset, with origin | In Studio (trace) · New (dataset origin) | EX-04 |
| EX-F4 | Cannot answer; guardrail refusal with a request | In Studio | EX-05 · EX-06 |
| EX-F5 | Save a view; schedule the question | In Studio (save) · Moves (schedules to shell) | EX-07 |
| EX-F6 | Query language — Cypher / Gremlin typed in the assistant’s composer; no separate query bar | In Studio (query) · New (in the composer) | EX-08 |
| EX-F7 | Manual tools — expand, styling and layers, canvas history | In Studio | EX-09 |
| EX-F8 | Sessions — the chat’s history, opened from the chat header | In Studio (sessions) · New (in the chat) | EX-10 |
| EX-F9 | Locked until set up | In Studio | EX-11 |
| EX-F10 | Add an answer to a project branch | New · Blocked · P-10 | EX-12 |
| EX-F13 | Share — live link or frozen snapshot for members; PNG · CSV · Markdown export | New | EX-15 |
| EX-F12 | Console — records · query · log under the board, resizable, Table or JSON | New (the-console.md exists, not wired) | EX-08 · EX-14 |
| EX-F11 | Assistant chat — centred to start, docked right once a conversation begins, closable | In Studio (chat) · New (centred start, close) | EX-01 · EX-02 · EX-13 |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| EX-01 | analyst | one question box with suggestions and my saved views | I start by asking, not configuring | `explorer.home` |
| EX-02 | analyst | the answer drawn on the board, every record one click away | I see it, not just read it | `explorer.answer` · `explorer.answer.node` · `explorer.answer.dark` |
| EX-03 | analyst | an answer as a chart when the shape calls for one | numbers read at a glance | `explorer.answer.chart` |
| EX-04 | analyst | to trace an answer from LLM to query to record to dataset | I can defend it | `explorer.answer.trace` |
| EX-05 | analyst | the Graph to say when it cannot answer | I am never handed a guess | `explorer.answer.cannot` |
| EX-06 | analyst | a refusal that says why and who to ask | a guardrail is a conversation, not a wall | `explorer.answer.guardrail` |
| EX-07 | analyst | to save a view or schedule the question | a good question keeps working | `explorer.answer.schedule` · `explorer.answer.scheduled` |
| EX-08 | power analyst | to write Cypher or Gremlin in the assistant’s composer and read the rows in the console | nothing is out of reach | `explorer.answer.query` · `explorer.answer.query.error` |
| EX-09 | power analyst | manual tools on demand: expand, style, layers, history | I shape the board by hand when I need to | `explorer.tools` · `explorer.tools.expand` · `explorer.tools.styling` · `explorer.tools.history` |
| EX-10 | analyst | every question I asked, searchable, reopened where I left it | work is never lost | `explorer.sessions` |
| EX-11 | analyst on a new Graph | to be told which setup step opens Explorer | I know who to ask | `explorer.locked` |
| EX-12 | analyst | to add an answer to a project branch as a finding | what I found feeds a decision | `explorer.answer.to_project` |
| EX-13 | analyst | to close the assistant and have the canvas to myself, and reopen it from the header | the board gets the whole screen when I work by hand | `explorer.answer.closed` |
| EX-15 | analyst | to share an answer as a live link or a frozen snapshot, or export it | others see what I found, with its citations | `explorer.answer.share` |
| EX-14 | analyst | the records and queries behind what is drawn, in a console under the board | I can read the rows without losing the picture | `explorer.answer.console` |

## CLI

| Command | Does | Status |
|---|---|---|
| `invana ask "<question>" --graph [--world]` | an answer with its citations; `--json` carries records and the trace | New |
| `invana query --graph --lang cypher\|gremlin "<q>" \| -f <file>` | run a query; `--format table\|json\|csv` | New |
| `invana sessions list` · `show <id>` | conversations on a Graph | New |
| `invana views list` · `export <view> --format png\|csv\|md` | saved views and snapshots | New |

## Decisions

| Decision | Detail |
|---|---|
| Tools on demand | Hidden by default; the user menu can keep them always shown |
| Where the tools float | A card at the board's top-left: one *Tools* toggle, and the canvas toolbar stacked under it while on. The toggle is per visit, not in the URL. The renderer switch is a setting, so the floating bar leaves it out. Layers, Styling and History stay as the board's tab-strip controls |
| Paths | `/u/:user/:graph/explorer` is the product. `/explorer/:session` is the open thread: opening, starting or leaving a thread rewrites it in place, and a reload or a shared link reopens the thread with its answer. The `:session` level has no element of its own, so it never remounts the board. Crumbs: `owner › graph › session:<short id>`. The wordmark names the product, so there is no `Explorer` crumb |
| Lock | `gate` is the `answering` set-up step, the step the assistant's lock names today |
| Chat starts centred | An empty board shows one question box in the middle, with suggestions and saved views |
| Chat docks right | The first question moves the conversation into a panel on the right; the board keeps the drawing |
| Everything answers in the chat | Answers, charts’ words, refusals, cannot-answer, traces and confirmations arrive as chat messages |
| How an answer takes shape | The LLM classifies the ask (`single_query · compound · exploration · aggregate_and_chart · model_change · out_of_scope`) and writes the words. **Code** picks the visual: the result is reduced to a shape (graph or table, rows, numeric columns, single value, category + number, empty), each template’s `accepts` is checked against it, and the most specific fit renders. Templates never enter the prompt, so the prompt does not grow with them |
| Asking for a visual | “as a chart / table / graph” is read by the intent classifier as a structured `prefer` field and ranks the eligible templates, ahead of the intent `kind` and the shape's specificity. It never forces an ineligible one: the picker offers it disabled with its reason. No substring match of the raw question ([3.4 P13](../for-developers/modules/ask/features/projections.md#7-decisions)) |
| Switching the visual | The emission’s picker lists every template, eligible or not with the reason; switching re-renders from the same records and never re-runs the query |
| Chat closes | The panel’s ✕ closes it; a pill and the header’s Assistant button reopen it where it left off |
| Query in the composer | The composer switches Ask · Cypher · Gremlin; ⌘↵ runs. The query and its outcome are chat messages. No floating query bar |
| A failed query | The chat says why and offers a fix; the console opens on Log with the failing line; the board is untouched |
| Console | `AppLayoutV2` `bottomSection`, `bottomSpan: "main"` — under the canvas only, the chat stays full height. Resizable by its grip, collapsible, tabs Records · Query · Log, Records as Table or JSON, Re-run. Per [the-console.md](../for-developers/modules/explore/features/the-console.md), plus Log |
| Sessions | Live in the chat’s history, not a second side panel |
| Sharing | Members get a live link (same board and chat) or a frozen snapshot (board image, answer, citations, dataset versions). Outside people get an exported file, never access; guardrails apply to what exports carry |
| Off entirely | The user menu switches the assistant off in every product (SH-07) |
| Schedules | “Schedule this” creates a shared schedule; the toast links to Activity › Schedules |
| Into a project | An answer becomes a finding with its evidence (records, queries, dataset versions) attached |

## Not building

| Item | Why |
|---|---|
| A rail or sidebars | Analysts get the board, nothing else |
| Model editing | Modeller owns it |
