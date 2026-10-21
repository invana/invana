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
| EX-F10 | Add an answer to a project branch — *Add to a project* on the reply line ([projects.md](projects.md) › `projects.addFinding`) | In Studio | EX-12 |
| EX-F13 | Share — live link or frozen snapshot for members; PNG · CSV · Markdown export | In Studio (C09) | EX-15 |
| EX-F12 | Console — the canvas’s data per label, Table or JSON, paged · the session’s queries and each one’s step, opened from the footer | New (the-console.md) | EX-08 · EX-14 |
| EX-F11 | Assistant chat — centred to start, docked right once a conversation begins, closable | In Studio (chat) · New (centred start, close) | EX-01 · EX-02 · EX-13 |
| EX-F14 | Layout presets — Network · Tree ↓ · Flow → · Radial, each with its options ([graph-canvas.md](../for-developers/modules/explore/features/graph-canvas.md) GC22) | New | EX-16 |
| EX-F15 | Walkthrough — *Present* plays the board one answer at a time ([walkthrough.md](../for-developers/modules/explore/features/walkthrough.md)) | New | EX-17 |
| EX-F17 | Annotate — annotations on the graph's records (a record, a value, a highlight, a group), kept with the graph and shown on every board that loads them ([§ Annotate](#annotate), [4.8](../for-developers/modules/explore/features/annotations.md)) | New | EX-19 |

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
| EX-14 | analyst | the data on the board and every query this session ran, in a console under the board | I can read the rows without losing the picture | `explorer.answer.console` · `explorer.answer.console.json` · `explorer.answer.console.queries` · `explorer.answer.console.queries.step` · `explorer.answer.console.queries.empty` |
| EX-16 | analyst | to switch the board between Network, Tree, Flow and Radial and tune each | one answer reads as a network, a hierarchy or a flow | `explorer.layout` · `explorer.layout.tree` · `explorer.layout.flow` · `explorer.layout.flow.orthogonal` · `explorer.layout.radial` · `explorer.layout.too_large` |
| EX-17 | analyst | to present a board one answer at a time, with the question and the reply | I can show someone how I got there | `explorer.present` · `explorer.presenting` · `explorer.presenting.expansion` · `explorer.presenting.your_changes` · `explorer.presenting.step_failed` |
| EX-19 | analyst | to annotate the records themselves — a node, a relationship, a value, a path, a cluster — and see what others and the assistant noted on them | whoever loads those records next sees what the data says, and a walkthrough can point at it | `explorer.board.annotate` · `….in_explore*` · `….read_only` · `….legend.*` · `….record.*` · `….annotation.*` · `….highlight` · `….group.*` · `….detail.*` · `….session.*` · `….explain.*` · `….sources.*` · `….loaded.*` |

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
| Tools on demand | Off by default: the header’s *Tools* switch, first in `header.right`, turns them on for the visit. The user menu’s *Tools always shown* starts them on |
| Where the tools float | A card at the board’s top-left: select · lasso · box, and a chevron that turns *Tools* on. With *Tools* on the card grows to expand the selection · layers · history | run layout · styling · legend | undo · redo | export image, and the legend shows bottom-left (node types and relationships, each with its count on the board). Zoom in · zoom out · fit sit bottom-right whatever *Tools* says. There is no minimap. The renderer is a setting, so no bar carries it |
| Paths | `/u/:user/:graph/explorer` is the product. `/explorer/:session` is the open thread: opening, starting or leaving a thread rewrites it in place, and a reload or a shared link reopens the thread with its answer. The `:session` level has no element of its own, so it never remounts the board. Crumbs: `airways ▾ › Sessions › <session title>`. The wordmark names the product, so there is no `Explorer` crumb |
| Lock | `gate` is the `answering` set-up step. Until it opens, the board is the lock alone: *Asking opens once a model is published*, what is true now, and *Open the Modeller* |
| Chat starts centred | With no canvas open the board is one question box on the dotted ground — no strip, no tabs — headed *What do you want to know about `<Graph>`?* and the Graph’s line. Under it: the person’s three most recent distinct questions, each asked again in one click, and *Your views* — their kept canvases, pinned first. Neither is invented: a Graph never asked anything shows the box alone. With the chat docked and nothing drawn, the board is the empty ground — one question box on screen, never two |
| Chat docks right | The first question moves the conversation into a panel on the right; the board keeps the drawing. The panel’s header is the Assistant’s star · *Assistant* · the open session’s title, then Sessions · session settings · ✕ |
| Everything answers in the chat | Answers, charts’ words, refusals, cannot-answer, traces and confirmations arrive as chat messages |
| How an answer takes shape | The LLM classifies the ask (`single_query · compound · exploration · aggregate_and_chart · model_change · out_of_scope`) and writes the words. **Code** picks the visual: the result is reduced to a shape (graph or table, rows, numeric columns, single value, category + number, empty), each template’s `accepts` is checked against it, and the most specific fit renders. Templates never enter the prompt, so the prompt does not grow with them |
| Asking for a visual | “as a chart / table / graph” is read by the intent classifier as a structured `prefer` field and ranks the eligible templates, ahead of the intent `kind` and the shape's specificity. It never forces an ineligible one: the picker offers it disabled with its reason. No substring match of the raw question ([3.4 P13](../for-developers/modules/ask/features/projections.md#7-decisions)) |
| Switching the visual | The emission’s picker lists every template, eligible or not with the reason; switching re-renders from the same records and never re-runs the query |
| Chat closes | The panel’s ✕ closes it; a pill and the header’s Assistant button reopen it where it left off |
| Query in the composer | The composer switches Ask · Cypher · Gremlin; ⌘↵ runs. The query and its outcome are chat messages. No floating query bar |
| A failed query | The chat says why and offers a fix; the console opens on Queries, at that step’s Log; the board is untouched |
| Console | `AppLayoutV2` `bottomSection`, `bottomSpan: "main"` — under the canvas only, the chat stays full height. Resizable by its grip, collapsible, tabs Data · Queries ([4.4](../for-developers/modules/explore/features/the-console.md)). Data is the whole canvas, one table per node label and relationship type, 20 a page, Table or JSON. Queries is the session’s query steps, newest first; one opens as the run page’s step — Overview · Touched · Log — with Re-run. The footer’s counts open it; a failed query opens it on that step’s Log. No strip button |
| Sessions | Live in the chat’s history, not a second side panel: the header’s Sessions shows *Sessions `n`* · *New* · a search, and every session newest first — its outcome’s dot, its title, when, and *failed* when its last reply did. The history is a view over the open thread: the board keeps its canvas while it shows |
| Sharing | Members get a live link (same board and chat) or a frozen snapshot (board image, answer, citations, dataset versions). Outside people get an exported file, never access; guardrails apply to what exports carry. The snapshot is a report on the answer's run, opened at `/explorer?page=run:<id>@<version>`; its board is kept as its records, and its datasets are the bindings when it was taken ([4.5](../for-developers/modules/explore/features/share-an-answer.md) SA1–SA11) |
| Off entirely | The user menu’s *Assistant* switches it off in every product, per browser (SH-07): no header button, no docked chat whatever `?right=` says, no reopen pill, no *Ask the assistant* in ⌘K, no *Ask about* on a record. The Explorer’s start keeps *Your views* and says how to turn asking back on — queries are typed in the chat, so there is no question box without it |
| Schedules | *Schedule this* on a reply opens the schedule dialog filled with the question; saving confirms with a toast that opens it in Activity › Schedules |
| Into a project | An answer becomes a finding with its evidence (records, queries, dataset versions) attached |
| A reply | The assistant’s mark, then the words; under them what it stood on (`195 records · Everything · 9ms`); then *Load to canvas* (a graph not yet drawn) · *Save view* (keeps the board as it stands in its History) · *Schedule this* · *Add to a project* · *Share*; then *How I got this*, which unfolds the steps, the query and what the model was given. The question is a bubble on the right. While a run runs, the reply is its live steps |
| A record opened | Clicking a node or relationship opens its card top-right on the board — name, type, provenance, properties — with *Ask about `<name>`* · *Expand* (a node) · *Hide*. The chat keeps the right side; opening a tool card closes the record card, they share the corner |
| The strip | Tabs for the open canvases and *+*, nothing else; *Rename* and *Close* are on a tab’s menu |
| The footer | Two zones. Left: the database and whether it is connected (`Neo4j 5.26 · connected`) · `195 nodes · 312 relationships` (opens Data) · `4 queries` (opens Queries, with a dot when one failed) · then the message line — a mode’s hint (*Shift + drag to select several*), progress (*Laying out 195 nodes…*), or what the pointer is over. Right: `3 selected · 87%` · the renderer and frame rate (`WebGPU · 59 fps`). The message is plain text, never a link, and truncates before the right zone |

## Annotate

Design canvas: *Explorer · Annotate* (<https://claude.ai/artifact/Mqr1mcEde4MN4Hdf5kmK2B>), staging for EX-19. The feature and its
decisions are [4.8 Annotate the data](../for-developers/modules/explore/features/annotations.md).

| Decision | Detail |
|---|---|
| On data | Every annotation is on records: a node, a relationship, one value, a set (highlight) or a group. Nothing free on the board |
| One noun | *Annotation*, with an author — a person or the assistant. Tools in Annotate: Annotate · Highlight · Group |
| The graph's | Stored by the engine against record ids, never on a board and never in the customer's database; any board that loads a record shows its annotations |
| Sessions | Each annotation records the session it was written in. People's reach the graph; the assistant's stay in their session until a person adds them (*Add to the graph*) or dismisses them |
| Evidence | The assistant's carry their query, what came back and the reply; where the graph cannot answer, a gap annotation, never a number |
| Hide and show | The Legend's *Annotations* section, by author and kind, with *In full / Badges*; saved with the board. The Annotations panel lists, opens and acts |
| Walkthrough | A step shows its own annotations whatever the Legend hides; authored steps come with slice 3 |

## Drawn, not built yet

What the prototype draws that Studio does not do yet. Each is a gap, not a non-goal.

| Board | What is missing | Needs |
|---|---|---|
| `explorer.answer.chart` (EX-03) | A chart answer draws on the board; today the emission renders in the chat | The board to host an emission beside the graph |
| `explorer.answer` (EX-02) | Numbered notes the answer pins on the board, and the board tool that adds one | A notes layer on the canvas |
| `explorer.answer.trace` (EX-04) | *Datasets behind the records* under the steps | The run’s dataset bindings on the reply |
| `explorer.home` | The composer’s first chip reads the skill (*Explain*); today it reads the ask kind | The engine picks a skill inside each run from the agent’s bound skills, so nothing names one before the ask; the chip needs the run’s skill exposed on the thread |

## Not building

| Item | Why |
|---|---|
| A rail or sidebars | Analysts get the board, nothing else |
| Model editing | Modeller owns it |
