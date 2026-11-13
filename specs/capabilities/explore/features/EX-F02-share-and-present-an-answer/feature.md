---
id: EX-F02
title: Share and present an answer
product: EX
status: idea
personas: [analyst, decision-maker]
stories: [EX-12, EX-15, EX-17, EX-22]
journeys: [J02]
boards: [explore.board, explore.share, explore.board.present, projects.finding]
nfrs: []
depends_on: [EX-F01, AC-F03, AC-F07, CP-F10]
---

# Share and present an answer

> What an answer becomes once it holds up: shared with the users and teams who need it, exported for anyone else,
> shown step by step, or added to a project as evidence — so the person who decides sees what was found and how.
> The decision it helps make: *who needs to see this answer, and in which form, to decide on it?*

## User journey

Journeys this feature is a step of: [J02 · Ask and trust the answer](../../../../journeys/J02-ask-and-trust-the-answer.md)

```mermaid
flowchart TD
  start([A settled answer on the board]) --> d{Where does it go?}
  d -->|running · failed · stopped| none["No Share and no Add to a project — nothing settled yet"]
  d -->|users and teams| sh["EX-15 · Share: pick users and teams · a live link or a frozen snapshot"]
  sh -->|not an owner of the board| nown["Share disabled — Only its owners or an Admin"]
  sh -->|snapshot refused or offline| shf["Could not keep the snapshot — the reason"]
  d -->|anyone else| exp["EX-15 · Export: PNG · CSV · Markdown"]
  exp -->|nothing drawn · no rows| dis["That format disabled, with its reason"]
  sh --> open{The person opening it is shared with, an owner or an Admin?}
  open -->|no| nf["Not found — a link is never access"]
  open -->|yes| seen([They see the board and its answers, or the snapshot as it was])
  d -->|a project| pj{"An agent they may use, a project they may add to?"}
  pj -->|no| ask["Disabled — names the agent or the project's owners"]
  pj -->|yes| fi["EX-12 · Pick a project and a branch · a finding with its evidence"]
  fi --> fdone([The finding on the branch, traceable to its records])
  d -->|show someone| pr{Two steps or more?}
  pr -->|no| pz["Present disabled — Nothing to walk through yet"]
  pr -->|yes| p["EX-17 · Present: one answer at a time"]
  p -->|a step cannot play| ps["Step 4 could not play — the reason · Skip"]
  p --> story["EX-22 · Steps authored from annotations, between the answers"]
  story --> p
  p -->|Esc| back([Back at the latest step])
```

## Stories

| ID | Story | Status |
|---|---|---|
| EX-15 | [Share an answer](stories/EX-15-share-an-answer/story.md) | idea |
| EX-12 | [Add an answer to a project](stories/EX-12-add-an-answer-to-a-project/story.md) | idea |
| EX-17 | [Present a board](stories/EX-17-present-a-board/story.md) | idea |
| EX-22 | [Tell a story in steps](stories/EX-22-tell-a-story-in-steps/story.md) | idea |

## Access

Who may do what is the [role table](../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table):
*share* is *Acts* for Operator, Modeller and Admin — within the agents the person may use, those agents' Access
Policies, and what the person owns ([AC-F07](../../../../os/access/features/AC-F07-ownership/feature.md)).

| Act | Who | Everyone else sees |
|---|---|---|
| Share a board's answer with users and teams — a live link or a frozen snapshot · stop sharing | Its owners · an Admin | *Share* disabled — *Only its owners or an Admin* |
| Open a shared link | The users and teams it is shared with, the board's owners, an Admin | *Not found* |
| Export PNG, CSV or Markdown | Whoever opens the board — an export is a read; carrying confidential or personal data, or made by a key or an agent, a send ([An export](../../../../os/access/product.md#decisions)) | — |
| Add an answer to a project as a finding | Anyone who may read the answer's run and add a finding to the project's branch ([PJ-F03](../../../projects/features/PJ-F03-branches-findings-and-decisions/feature.md)) | *Add to a project* disabled, naming what is missing — the project's owners or the agent |
| Present a board | Whoever opens the board | — |
| Add, edit, move or remove an authored step | The board's owners · an Admin, as for any change to a board | Steps read and play; *Add a step here* hidden |

## States

| State | What the person sees |
|---|---|
| First use | A board with fewer than two steps: Present is disabled with *Nothing to walk through yet*; a board shared with nobody: the Share dialog's people list reads *Only you* |
| Empty after a filter | Picking users and teams with no match: *No one matches "{words}"* |
| Loading | Keeping a snapshot: *Copy snapshot link* reads *Keeping…*, disabled, the dialog open |
| Has data | The Share dialog with who it is shared with; the presenter with its steps; the finding on its branch |
| Failed | *Could not keep the snapshot* with the reason · a step that cannot play, with *Skip* |
| Agent working or proposing | The answer still running: no Share and no Add to a project on the reply |
| No access | A link opened by someone it is not shared with is *Not found*; *Share* on a board the person does not own is disabled, naming the owners |

## Rules

| Rule | Detail |
|---|---|
| Only a settled answer travels | Share and Add to a project sit on a settled answer's reply line; a running, failed or stopped answer has neither |
| Shared with people, never with a link | A board, or one snapshot of it, is shared with named users and teams; a team share holds for whoever is on the team when the link opens. A link opens only for them, the board's owners and Admins |
| Sharing opens the runs behind it | Whoever a board is shared with reads the content of its conversation's answers — their words, parts, queries and *How it got here* — as run privacy allows for a shared conversation ([CP-F10](../../../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| Outside people get a file | PNG, CSV or Markdown; an export carries only what the board and its runs already hold and never reads a graph database again |
| A snapshot is frozen | It keeps the board's records, the answer, its citations and the loads its records came from, and never re-reads them; pruning the run later changes nothing |
| A step is a reply that changed the board | Its title is the question, its words the assistant's message, whole; a table, chart or card stays in the thread. A reply that drew nothing is not a step; an expansion is one, titled *Expanded Acme Ltd* |
| Hand edits between replies are one step | Layout, hide, style and move made since the last step become one *Your changes* step when the next reply arrives or presenting starts |
| Presenting is read-only | An earlier step is only ever seen while presenting; nothing in it can be edited. Presenting writes no version and is not restored on reload |
| The walkthrough is the board's | It is saved and versioned with the board, so a reload, a live link and a snapshot carry it, and restoring a version restores its walkthrough |
| Leans on | EX-F01 — the board, its owners and its shares · RC-F07 — annotations that authored steps show · Projects — the branch a finding joins (PJ-F03) · the Directory — users and teams (AC-F03) · run privacy (CP-F10) |

## Data touched

| Record | Read or write |
|---|---|
| The answer's run and what it returned | Read |
| Snapshot — a frozen version of the answer's run board (Engine › Mechanisms *A snapshot*) | Write |
| Shares — the users and teams a board or a snapshot is shared with ([EX-F01 › Engine](../EX-F01-the-board-and-its-canvas/feature.md#engine)) | Write · read |
| Users and teams to share with (AC-F03) | Read |
| Loads the records came from (RC-F02) | Read |
| The board's walkthrough — its steps | Read · write, with the board |
| Finding on a project branch, with its evidence | Write |

## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| — | — | Stores nothing of its own: a snapshot is a board version, a share is a row of `explore_board_shares` and the walkthrough is in the board's `settings` ([EX-F01 › Engine](../EX-F01-the-board-and-its-canvas/feature.md#engine)) |

### Reads

| Record | Owner |
|---|---|
| Boards, their versions, shares and `settings`; who may open a board | [EX-F01 › Engine](../EX-F01-the-board-and-its-canvas/feature.md#engine) |
| Owners of a board | [AC-F07](../../../../os/access/features/AC-F07-ownership/feature.md#engine) |
| Users and teams, and who is on each team | [AC-F03](../../../../os/access/features/AC-F03-directory/feature.md#engine) |
| The answer's parts and their citations | [EX-F04 › Engine](../EX-F04-the-answer/feature.md#engine) |
| The answer's run · who may read its content | [CP-F10](../../../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) · [AC-F09](../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#engine) |
| Loads — stable id, content hash, undone | [RC-F02 › Engine](../../../records/features/RC-F02-bring-records-in/feature.md#engine) |
| Findings on a branch — *Add to a project* writes one through `POST /{key}/branches/{n}/findings` | [PJ-F03 › Engine](../../../projects/features/PJ-F03-branches-findings-and-decisions/feature.md#engine) |

### Routes

| Route | Does | Story |
|---|---|---|
| — | None of its own: a snapshot is kept through EX-F01's `POST /boards/run/{run}/versions`, a share through EX-F01's `PUT /boards/{board}/shares`, a finding through PJ-F03's route | EX-15 · EX-12 |

### Events

| Event | When |
|---|---|
| — | None of its own: a kept snapshot and a walkthrough change are EX-F01's `explore.boards.update`; a share EX-F01's `explore.boards.share` |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| — | None of its own; opening, sharing and keeping a snapshot meet EX-F01's (*Not found.* · *Only its owners or an Admin can change this board.*), adding a finding PJ-F03's | — | EX-15.6 · EX-15.10 · EX-15.12 · EX-12.5 |

### CLI

| Command | Does |
|---|---|
| — | No command of its own |

### Mechanisms

| Mechanism | How |
|---|---|
| A snapshot | One `explore_board_versions` row on the answer's `run` board: `cause = report`, `label` *Snapshot — {the question}*, the reply's `message_id`. Studio composes the document in the browser; the engine stores it whole. Its link opens the page `run:{run}@{version}` for those it is shared with |
| What a snapshot holds | A header — the question, the chip *Snapshot*, the graph databases it read, when it was taken · `narrative`, the answer's words · one panel per answer part: `table` · `metric` · `bars` · a `table` titled *Board* with the drawing's records and its node and relationship counts · `text` *No records* for an empty answer · `citations`, each query with its graph database, language and record count · `list` *Loads*, each load's id, content hash and whether it is undone |
| A share | `PUT /boards/{board}/shares` writes one `explore_board_shares` row per user or team, with the snapshot's `version_id` when a snapshot is shared; `may_open_board` reads them at request time, a team through who is on it then |
| The walkthrough | `settings.walkthrough` on the board, autosaved and versioned with it. A step is `id` · `title` · `narration` · `data` (what its reply added to the drawing) · `view.focus` · `view.camera` · `meta.reply_id` (absent on an authored step) · `annotation_ids` (an authored step's) |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| — | None — snapshots, shares and the walkthrough live in EX-F01's tables | — |

## Decisions

| Decision | Detail |
|---|---|
| The live link is the conversation's own address | Sharing it writes who it is shared with and nothing else; it opens the same board and thread as they are when opened |
| The snapshot keeps the board as records | The answer's drawing is kept as a *Board* table — name, kind, id, graph database, with node and relationship counts — readable at any size and in either theme; the board's last picture is its thumbnail |
| PNG is the board as last drawn · CSV is the answer's rows | PNG is disabled while nothing is drawn; CSV takes every table's rows, else the drawing's nodes, else a chart's series — disabled only when the answer has none |
| Markdown is one file | The question as the heading, the answer, each part (tables capped at 200 rows, the rest counted), the queries as citations with their graph databases, the loads cited, the run and when it was exported |
| Loads are cited by id and content hash | A snapshot names each load by its stable id and content hash, so it still resolves after a later load; an undone load is flagged on it |
| Times read in the reader's own time | `Oct 2, 9:29 PM`; only the Markdown export says UTC, because it travels |
| Present is a mode | Present sits in the mode picker; with fewer than two steps it is disabled with *Nothing to walk through yet*. While presenting the row is the picker and `◀ n/N ▶`; the rail, the dock and the forms close |
| A step and its reply point at each other | While presenting, the current step's reply is marked and scrolled into view; every step's reply carries a `Step n` chip that starts presenting there |
| Authored steps sit between the answers | An owner of the board may add a step from annotations between two answers, word it, move it among the authored steps and remove it. Reply steps keep their reply's words and the thread's order |

## Open questions

| Question | Who answers |
|---|---|
| — | — |

## Not building

| Item | Why not |
|---|---|
| A public or anonymous link | Every link opens for named users and teams only; outside people get a file |
| A snapshot that refreshes | A frozen snapshot that changes is a live link |
| Sharing into Slack, email or a channel | Delivery is the Inbox's; a link can be pasted anywhere and opens only for those it is shared with |
| A share that lets the reader change the board | Changing is its owners'; a co-owner is added through ownership (AC-F07) |
| PDF export | Markdown and the browser's print cover it |
| Auto-play on a timer | A walkthrough is talked over; the presenter sets the pace |
| Rewording or reordering a reply's step | A reply step is its reply; rewording it would make the walkthrough disagree with the thread |
| The answer's tables and charts in the presenter | The board is the drawing; they stay in the thread |
| Exporting a walkthrough as slides or video | Share the board; it plays there |
