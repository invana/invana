---
id: EX-F01
title: The board and its canvas
product: EX
status: idea
personas: [analyst]
stories: [EX-07, EX-09, EX-14, EX-16, EX-18, EX-21]
journeys: []
boards: [explore.ask, explore.board, explore.board.left_closed, explore.board.menu, explore.board.console, explore.board.edit, explore.share]
nfrs: [NFR-PERF-4]
depends_on: []
---

# The board and its canvas

> Where an answer is looked at: a quiet, saved board that draws what the Graph holds, lets the analyst move around it,
> pick things out and read the rows behind it — so they can judge what the answer says before deciding what to do with it.
> The decision it helps make: *does this answer say what it seems to, and is it worth acting on?*

## User journey

```mermaid
flowchart TD
  start([An answer, or a board reopened]) --> b["EX-18 · The quiet board: mode, tools, rail, dock"]
  b -->|empty: nothing drawn| e0["What it is for · Ask your first question"]
  b --> d{What now?}
  d -->|look| look["Pan · zoom · hover"]
  d -->|widen| ex["EX-09 · Expand a node — counted first"]
  ex -->|too many| cap["The count, and a cap or a type to filter by"] --> ex
  ex -->|refused by the view of the graph| rf["Says which rule keeps it out"]
  d -->|arrange| lay["EX-16 · Layout: Network · Tree · Flow · Radial"]
  lay -->|over 3,000 nodes| big["Tree · Flow · Radial disabled with the cap"]
  d -->|style · hide · history| tools["EX-09 · Legend · Styling · History"]
  d -->|pick one| el["EX-21 · The Element panel"]
  el -->|Edit mode| edit["EX-21 · Its editor: type and keys from the model"]
  edit -->|a key the model lacks| kr["Refused — names who can add it"]
  edit -->|Apply| unsaved(["Marked unsaved — EX-F06 saves it"])
  d -->|read the rows| con["EX-14 · Console: Data · Queries"]
  con -->|a query failed| log["Opens on that step's Log"]
  d -->|keep it| keep["EX-07 · Autosaved · named · versioned"]
  keep -->|went wrong| hist["History · restore makes a new version"]
  keep -->|Schedule this| sch{Can work on projects?}
  sch -->|no| ask["Disabled — Ask Priya (owner)"]
  sch -->|yes| sched(["Scheduled — Agents › Schedules"])
  keep --> done([Resumed tomorrow where it was left])
```

```mermaid
sequenceDiagram
  actor P as Analyst
  participant S as Studio
  participant E as Engine
  P->>S: Expand neighbours
  S->>E: an expansion, under the board's view of the graph
  E-->>S: the count first
  S-->>P: "412 neighbours" · cap or filter
  P->>S: draw
  E-->>S: the neighbours, recorded as a run
  S-->>P: added to what is drawn · the footer says Graph ready
```

## Stories

| ID | Story | Status |
|---|---|---|
| EX-18 | [A quiet board](stories/EX-18-a-quiet-board/story.md) | idea |
| EX-09 | [Shape the board by hand](stories/EX-09-shape-the-board-by-hand/story.md) | idea |
| EX-16 | [Switch the layout](stories/EX-16-switch-the-layout/story.md) | idea |
| EX-21 | [See and edit one element](stories/EX-21-see-and-edit-one-element/story.md) | idea |
| EX-14 | [Read the rows and the queries](stories/EX-14-read-the-rows-and-the-queries/story.md) | idea |
| EX-07 | [Keep a board](stories/EX-07-keep-a-board/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Open, look at, pan, zoom, select | Operator — every member | A non-member: the Graph's not-found page |
| Expand a node · change the layout · style · hide · switch modes | Operator — every member | — |
| Create, rename, delete a board · restore a version | Operator — every member | — |
| Read the console · re-run a query step of their own | Operator — every member | — |
| Open the Element panel · stage an edit on the board | Operator — every member | — |
| Save staged edits to the graph | `contributor` · shown as *Can work on projects* | Save disabled — *You can change this board, not the graph* (EX-F06) |
| Schedule the question | `contributor` · shown as *Can work on projects* | *Schedule this* disabled — *Ask Priya (owner)* |

## States

| State | What the person sees |
|---|---|
| First use | No board yet: one question box — *What do you want to know about airways?* — and the person's own kept boards, if any |
| Empty after a filter | Every type hidden in the Legend: *All types hidden · Show all* |
| Loading | The footer's message line counts the solve (*Laying out 2159 nodes · 80 / 149*); past 400 ms one toast with *Cancel*. The board stays usable |
| Has data | The drawing, the row, the rail, the dock, the footer's counts |
| Failed | What failed in a sentence and the next act — a failed query opens the console on its Log; the board is untouched |
| Agent working or proposing | An answer drawing onto the board: the reply is live in the thread, the board adds what it brings |
| No access | Every member can look; an act that needs a grant is disabled with its reason or *Ask Priya (owner)* |

## Rules

| Rule | Detail |
|---|---|
| Drawing adds | An answer, an expansion and a reopened board add to what is drawn; nothing replaces it |
| One selection | A click, a shift-click, a lasso or a box makes the same selection on every board |
| Colour by type | Every node and relationship type has a default colour from its name — the theme's `--color-data-N` slot its name hashes to, read by one function for the drawing and the Legend's dots; a colour set in Styling overrides it, and the Legend's dot always matches the drawing. Colour is never part of a layout |
| Size by connections | On by default: a node's radius grows with the square root of its connections, from 8 to 28 px. It is worked out on every draw and never saved; while it is on it wins over a type's size in Styling; switching it re-runs the layout |
| Counted before drawn | An expansion or a large answer states its count before it draws, and a cap the person can raise |
| Missing is shown | An element gone from the graph stays drawn, marked missing, with when it was last seen |
| A view of the graph hides, never marks | What the picked view of the graph leaves out is not drawn and not counted; clearing the view brings it back. An expansion into a type the view denies is refused naming the rule, never answered with zero neighbours |
| Dense results thin, never cut | Past 200 relationships edges fade to an opacity of √(200 / n), never below 0.15; a hovered, selected or highlighted relationship is drawn solid. From 500, below 50% zoom, an even sample of about 1 in 10 is drawn — every hub keeps its share — and the footer says *About 1 in 10 relationships drawn · zoom in for all* |
| Hidden is a flag | Hiding a node hides its relationships; showing it restores a relationship only when that relationship is not itself hidden and its other end is visible. Hiding never filters the data |
| The row | Top-left: the mode picker, then *Select ▾* (Select · Lasso · Box, keys V · L · M), then the mode's tools — Edit: *Add node* · *Connect*; Annotate: *Annotate* · *Highlight* · *Group*; in Edit and Annotate *Undo · Redo · Redraw*. Nothing else: layout, expand, undo and export are verbs on the menus |
| The rail | Top-right, vertical: Legend · Styling · History, then Element, Annotations (Annotate), Changes (in Edit, and in any mode while something is unsaved), a line, Export (⇧⌘E). One panel at a time floats left of it — title · count · its acts · ✕. Legend lists the drawn types with counts; a click hides a type, struck through with *Show all*; its switches for minimap, graph and background are on the board's menu. *Size by connections* is a switch at the top of Styling |
| The menus | **Board**: Layout… · Fit · Select all · Undo · Redo · minimap, grid, lock, full screen · Export image… · Export data…; in Edit *Add a node here*, in Annotate *Annotate here*. **Node**: Expand neighbours (also a double-click) · Select neighbours · Centre on it · Hide · Hide every *type* · Style *type*… · Copy id; in Edit Edit node · Duplicate · Delete. **Relationship**: Select its two nodes · Hide · Hide every *type*. **Selection**: Expand all · Hide · Layout the selection… · Export the selection… · Clear. **Minimap**: Hide minimap |
| The dock | Bottom-left: the minimap (200 × 116) over one bar — − · the zoom field · + · Fit, and a lock while the view is locked. The field takes a typed percent (Enter applies, Esc cancels, ↑ ↓ step) and offers 50% · 100% · 200% · Fit; − and + step 10 · 25 · 33 · 50 · 67 · 75 · 87 · 100 · 125 · 150 · 200 · 300 · 400. Hidden in Focus and Present |
| Export | A rail panel, Image or Data. Image: whole board · in view · selection; PNG (1× 2× 3×) or SVG; the theme's background or transparent; annotations in or out; a preview. Data: whole board or selection, as the board file (reopens with data, layout, styling and history) or CSV (nodes and relationships, a column per property). The file name follows the choices |
| The tabs | Main's tab row holds the open boards and *+*, nothing else; *Rename* and *Close* are on a tab's menu |
| One place per piece of chrome | Top-left the row; top-right the rail and its one floating panel; bottom-left the dock; bottom-centre the presenter, only while presenting. The rail and the dock show only in the work modes |
| The footer | Left: the connection · `195 nodes · 312 relationships` (opens Data) · `4 queries` (opens Queries, with a dot when one failed) · the message line. Right: `3 selected` · the view chip `87% · 1,240, −380` (a click copies it) · the renderer and frame rate. The message is plain text, never a link. The footer counts what the board draws; the Legend and the type counts count the graph — `26 nodes` in the footer and `24,477 nodes` in the Legend are both true |
| Inspect is the default | The Element panel states what an element is; it edits only in Edit mode, and only against the model |
| Leans on | Semantics — the published model gives types, keys and colours · EX-F03 — answers that draw onto the board · EX-F06 — saving edits · Agents › Schedules — *Schedule this* |

## Data touched

| Record | Read or write |
|---|---|
| Board — name, layout, styling, view, what is drawn | Read · write (autosave) |
| Board version — one per meaningful change, with what changed | Read · write |
| Graph records and their counts by type | Read, under the board's view of the graph |
| Runs — each expansion and each query step | Write (an expansion), read (the console) |
| The published model's types and keys | Read |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `explore_boards` | `graph_id` · `kind` · `subject_id?` · `session_id?` · `created_by_id` · `title` · `instructions` (what it is for) · `settings` · `styling` · `view_state` · `filters` · `snapshot` · `positions` · `source_query` · `banner` (its last picture) · `pinned` · `archived` | Unique (`graph_id`, `kind`, `subject_id`); `session_id` unique where set. `subject_id` names a run, skill, rule or Graph by kind — a string, never a foreign key. `created_by_id` never cascades. `title` · `instructions` · `settings` · `styling` · `view_state` · `filters` live as long as the board and no re-query writes them; the next query, expansion or load rewrites `snapshot` · `positions` · `banner`. `settings` holds what the kind's builder takes besides its subject — the renderer, a declared board's open view, the walkthrough (EX-F02), the annotation view (EX-F06) |
| `explore_board_versions` | `board_id` · `graph_id` · `created_by_id` · `message_id?` · `cause` (`query` · `expand` · `load` · `manual` · `report`) · `label` · `snapshot_gz` · `source_query` · `styling` · `settings` · `banner` · `node_count` · `edge_count` | Immutable; lists and reads without its board. A declared board's versions are its reports, `cause = report`, stored merged with the numbers inside them |

### Reads

| Record | Owner |
|---|---|
| Runs — each read and save opens one | [AG-F03](../../../agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md#engine) |
| The plans `expand-neighbours@1` · `count-types@1` · `resolve-elements@1` and the functions they call | [AG-F06](../../../agents/features/AG-F06-plans-and-functions/feature.md#engine) |
| Views of the graph — what a read may see | [SE-F09](../../../semantics/features/SE-F09-views-of-the-graph/feature.md#engine) |
| The published model's types and keys | [SE-F02](../../../semantics/features/SE-F02-change-and-publish-a-model/feature.md#engine) |
| Schedules — *Schedule this* | [AG-F07](../../../agents/features/AG-F07-schedules/feature.md#engine) |
| A conversation and its turns — the board's `session_id` | [EX-F03](../EX-F03-ask-a-question/feature.md#engine) |

### Routes

| Route, after `/api/v1/u/{u}/{g}/explore` | Does | Story |
|---|---|---|
| `GET /boards` · `POST /boards` | List boards — `limit` (30, up to 100) · `offset` · `sort` (`updated` · `created`) · `include_archived` · `kind` · `session_id` · create one | EX-07 |
| `GET /boards/{board}` · `PATCH /boards/{board}` · `DELETE /boards/{board}` | Read · rename, restyle, pin, archive, save what it draws · delete with its versions | EX-07 |
| `GET /boards/{board}/versions` · `POST /boards/{board}/versions` · `GET /boards/{board}/versions/{version}` | A board's versions · save one · read one | EX-07 · EX-09 |
| `GET /boards/{kind}/{subject}/versions` · `POST /boards/{kind}/{subject}/versions` · `GET /boards/{kind}/{subject}/versions/{version}` | A declared board's reports · keep one, creating or finding the board's row · read one | EX-15 |
| `POST /expand` | A node's neighbours — the variant (all · by relationship type · by neighbour type) is a field, with direction, page size and property filters; counted first | EX-09 |
| `POST /resolve` | Which elements of a reopened board are still in the graph | EX-09 |
| `GET /type-counts?lens_id=` | Every node and relationship type with its count, under the view | EX-09 |

### Events

| Event | When |
|---|---|
| `explore.boards.create` · `explore.boards.update` · `explore.boards.delete` | A board is made · changed · deleted |
| `explore.reads.expand` | An expansion runs |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 409 | A second board for a conversation | *This conversation already has a board.* | EX-07.13 |
| 409 | A second board of a kind for the same subject | *{kind} {subject} already has a board.* | API only — Studio keeps a report through the versions route, which finds the row |
| 422 | A `kind` the registry does not list | *{kind} is not a board kind.* | API only — Studio saves only registered kinds |
| 409 `outside_lens` | An expansion or count the view of the graph cannot answer | *This view has no {type} — {rule}.* | EX-09.3 |
| 409 `expand_queued` · `count_queued` | The Graph's run ceiling queued the read; carries its `run_id` | *Queued behind {n} runs — nothing drawn yet.* | EX-09.16 |
| 409 `expand_failed` · `count_failed` | The read's run failed; carries its `run_id` | *{the run's message}* | EX-09.17 |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| Board kinds | One registry in the engine, a row per kind: `renders` (`canvas` · `declared`), `subject_required`, what `subject_id` names. Drawn: `data` · `model` · `plan` · `workflow` (a plan's steps) · `envelope` · `lineage`. Declared: `run` · `task_run` · `plan_runs` · `compare` ([AG-F03](../../../agents/features/AG-F03-runs-and-how-the-agents-are-doing/feature.md)) · `skill` · `skill_usage` ([AG-F04](../../../agents/features/AG-F04-skills/feature.md)) · `rule` · `guardrails` · `requests` ([SE-F07](../../../semantics/features/SE-F07-rules/feature.md)) · `models` ([SE-F02](../../../semantics/features/SE-F02-change-and-publish-a-model/feature.md)) · `world` · `worlds` ([SE-F09](../../../semantics/features/SE-F09-views-of-the-graph/feature.md)). There is no `agent` kind — an agent opens as its own page. A new kind is written here first, never added in code |
| What a gesture writes | `model` stages add · connect · delete; `plan` writes a dependency when a card is dropped on a card; `data` stages add · connect · edit · delete in Edit mode (EX-F06). `workflow`, `envelope`, `lineage` and every declared kind only select. A declared board is drawn from a closed set of panels |
| A live declared board has no row | It is built from its subject on every open; the first report kept creates its row. A board whose subject is gone stays and reads *this run is gone* |
| Restore forks | Restoring reads a version and saves it as a new one; there is no restore route. Opening a version as its own board makes a new board and conversation |
| History cap | Each board keeps its newest `INVANA_BOARD_HISTORY_LIMIT` versions (30; `0` keeps all), pruned as a new one is written |
| Page ids | A board opens as the page `kind:id` live and `kind:id@version` frozen |
| Reads are runs with no agent | `POST /expand` runs `expand-neighbours@1` (`graph.read.get_neighbors`, trigger `canvas`); `/type-counts` runs `count-types@1` (`graph.read.types_count`, `canvas`); `/resolve` runs `resolve-elements@1` (`graph.read.resolve`, `system`). The run's `agent_id` stays empty, so a read never waits on an agent's `max_concurrent_runs` and is not listed among an agent's runs |
| The turn is written first | An expansion in a conversation writes its turn — *Expand neighbours of "LHR"* — before its run opens; one that returned nothing is still a turn |
| Type counts | `nodes` · `edges` as `[{name, count}]`, biggest first · `counted` (`false` when the database cannot count; every type still listed, `count: null`) · `total_nodes` · `total_edges`, summed once in the engine, `null` when any type is uncounted · `run_id` |
| Missing is marked | Reopening calls `/resolve`; an element gone from the graph is returned as missing with when it was last seen, never dropped |
| Studio mirrors the registry | Per drawn kind, Studio adds what its nodes and relationships stand for, its footer words, whether a gesture writes, the panel holding its detail and whether it has Layers (`data` only); the API schema keeps the two in step |
| The console's address | `?console=` — `data` · `data:<node·relationship>:<type>:<page>` · `queries` · `queries:<reply id>`; absent or stale reads as collapsed. It moves on its own beside the left section's path and `?right=`, and never collides with `?page=`. The console has no route: it reads the board and its conversation's runs |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Two tables in Invana's own store; no new store | — |
| § 8 APIs and events | The routes and events above, under `explore` | — |
| § 10 AI and agents | Board reads run built-in plans with no agent and no token budget | — |

## Decisions

| Decision | Detail |
|---|---|
| The board is quiet | On screen only the mode and its tools, what must be seen (minimap, zoom) and the rail. Every verb on a thing is on its right-click menu and on ⌘K; the footer says *Right-click anything for its actions · ⌘K for every command* until the first right-click. Long-press, Shift+F10 and the context-menu key open the same menu |
| Modes | Work modes: **Explore** (look, ask, expand) · **Edit** (add, change, delete data) · **Annotate** (EX-F06). View modes: **Focus** (⌘\\ — the drawing alone) · **Present** (EX-F02). One at a time; Esc returns to Explore. The mode is the viewer's, never saved with the board. Edit rings the board in the primary colour, Annotate in the warning colour |
| An expansion is a run | What a person saw, and so reasoned from, is recorded like any read — it runs under the board's view of the graph, spends no agent's token budget and stays out of Agents › Runs by default |
| A layout is a preset | The person picks a card — Network · Tree ↓ · Flow → · Radial — and layout, edges, labels and spacing change together. The board keeps its preset and options across every answer, and a switch is one undo step |
| A force layout does not animate its settle | Network draws once at its settled positions; switching presets glides under 2,000 nodes, in 400 ms or less, and snaps above |
| Network's force settings | Nodes keep a hard floor apart of each node's drawn radius plus 22 px for its label below; about 150 steps (`alphaDecay 0.035`, `alphaMin 0.005`); repulsion −600, reaching no further than 600 px; relationships rest at 150 px. They hold to about 2,000 nodes |
| Boards are saved and versioned | Autosave never overwrites history; restoring a version makes a new one; settings belong to the board and outlive its data |
| A board restores from what it holds | Reopening paints what was drawn and asks the graph nothing; only a board with nothing saved re-runs its last query |
| The console reads, never writes | It shows what is drawn and what ran; queries are typed in the assistant's composer (EX-F03) |
| Studio is strict about the model | A type comes from the model's types, a key from that type's keys; the engine refuses anything else whatever Studio sends |
| Boards belong to the Graph | Every member opens and changes any board on it; a board outlives the member who made it — removing a person never removes their boards |
| One board per conversation | A conversation's board is looked up, never made twice; a version opened as its own board starts its own conversation |
| History keeps the last 30 versions | Older ones are let go as new ones are saved, and History says so; an install may set a different number |
| Counts are the engine's | The Legend's counts are a run under the board's view of the graph; a database that cannot count shows types without numbers, and no total is summed from parts |

## Open questions

| Question | Who answers |
|---|---|
| Saving edits to the graph needs *Can work on projects* in the engine; the glossary puts *loading data* under *Can shape the model*. Which grant should saving a board's edits need? Recommend: *Can work on projects*, as the engine enforces | Ravi |

## Not building

| Item | Why not |
|---|---|
| Per-element colour and size saved on the element | Colour by type and the board's styling cover it |
| Physics tuning controls · raw layout-engine options | Four named presets with options beat ten knobs |
| User-authored layout presets | Nobody has asked for a fifth |
| A preset that changes colour | Colour is the theme's |
| A vertical toolbar | It takes the board's left edge, where labels need room |
| An *excluded* mark for what a view of the graph hides | The board is never told what the view hides |
| Sorting, filtering or exporting the console's rows · an editable query box in it | The console's order is the board's; export belongs to Share (EX-F02); queries are typed in the composer |
| Queries of other conversations in the console | Agents › Runs is the journal |
| Plans and other steps in the console · a REPL or terminal | A run's page owns the run; the console lists queries, and nothing here is a shell |
| A console tab per kind of board | Data and Queries are true of every board |
| Editing inline on the drawing | A drawing is not a form; the Element panel edits |
| Folders of boards | A list with search is enough |
| Real-time co-editing of a board | One editor with history, last write wins |
| Converting a board's kind | A drawn board and a dashboard share no state |
| A row for every board opened | It would mirror runs and be written before every read; a live declared board has no row until a report is kept |
| A stored `renders` or `is_declared` column | A copy of the registry that could disagree with it |
| Autosave on a declared board | It holds nothing of its own; a report is kept deliberately, once |
| A report of a report · *Reports* on a frozen page | A report is already frozen; the list belongs to the live board it is of |
| Deleting or renaming a report | Versions are append-only; a kept reading somebody linked is not tidy-up |
| Boards across Graphs | The Graph is the boundary |
