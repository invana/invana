---
name: design-story
description: Draw an Invana user story's boards on the one design canvas — one page per place in the app (Shell · Explore · Model · Projects · Inbox · Records · Agents · Library · Settings…), one board per place, named for its feature (`specs/design-language.md` §7), built on the shared shell components — from its spec (Who can · Flow · Acceptance criteria · Screens), every state for Admin and Operator, composed only from @invana/design-kit components. Use whenever a specified story needs its boards, or a story's boards change.
---

# Design a story — boards by place, every state, both lenses

The procedure the **designer** follows, and anyone else drawing a story. Only stories at `specified` or later — their
spec approved by Ravi — are drawn, or stories a project Ravi approved names in a phase's *Stories*. The designer draws; it never edits a spec and never writes code — the one file in the repo it writes is its own rows
of the story's `task.md`. How the team works around a design is `.claude/team/TEAM.md`; §0 says what Invana is — every board serves a person
making a decision.

## 0. Pick the model

This section is the only place the designer's model split is defined. The agent's default is Opus. Use Sonnet only where a pattern already exists and the job is to follow it.

| Work | Model |
|---|---|
| A story's boards drawn for the first time: layout, flow, every state, both lenses, mapping to the kit | **Opus** |
| A new shell, mode or design language, or a canvas staged for a proposal | **Opus** |
| Porting approved boards or chrome into another canvas through an existing generator | Sonnet |
| A fix round on review or design-QA comments, or one missing state on a board that already exists | Sonnet |
| Regenerating, seeding, screenshotting or republishing a canvas | Sonnet |

| Who | How |
|---|---|
| Whoever delegates to the designer | Leave the model unset for Opus work. For Sonnet work, pass `model: sonnet` and name the pass in the brief |
| A top-level designer session on Opus (`claude --agent designer`, or a runner session) | Spawn a Sonnet sub-agent for the Sonnet rows. Do the §5 check yourself before you hand back. A designer that was delegated is a sub-agent and can't spawn one: it runs on the model it was given |
| A `/run-project` run | Already applies this split: builds use the agent's model, and fix rounds and sub-agents use Sonnet (`run-project` › *Every session*, settings table) |

## 1. Read the brief

The story's `story.md` (`specs/<area>/<product>/features/<CODE>-F<nn>-*/stories/<STORY-ID>-*/story.md`) is the
whole brief:

| Part of the story | What you take from it |
|---|---|
| **As / I want / so that** | Who the page is for and what they leave with |
| `## Who can` | What **Admin** and **Operator** can each do, and what the Operator sees otherwise — hidden, disabled with its reason, or *Ask <owner>* |
| `## Flow` | The order of the boards on the page, and every branch to draw |
| `## Acceptance criteria` | What each board must show; a refusal or trace criterion is a board state |
| `## Screens` | The boards to draw: every cell names one (surface × state × lens), under the name you use |
| The feature's `## States` (`feature.md`) | What each state means across the feature |
| The story's `task.md` | Your tasks, if a session before you added them; the coder's and QA's, never yours to edit |
| `specs/design-language.md` | Modes, peek · modal · sheet, the assistant, plain words |

Anything the story does not say — a state, an act, a word, a board, who may do it — is a `clarify` row to the product
manager. Never invent it; never draw around a gap; never edit the spec yourself.

## 1b. Add your tasks

Before you draw, add your rows to the story's `task.md` (`.claude/skills/product-spec/format.md` › *Tasks*): one task
per board or board group the `## Screens` names — Owner `designer`, the criteria the board shows, the boards, `todo`.
A component request a board waits on is its own task, `blocked` until Ravi answers. Next ID after the last one; never
renumber; rows stay sorted designer · coder · QA. Mark each `doing` as you start it and `done` with its canvas page as
evidence when its boards pass §5. Edit only rows whose Owner is `designer`.

## 2. Map every element to the kit

For each surface: every element → the `@invana/design-kit` (or `@invana/canvas-ui`) component that draws it, from
`docs/for-developers/building-studio/design-kit-coverage.md`. Nothing fits, or a kit component must change → a
**component request** — a recommendation (*Kind* `component`), plus a `decide` row naming its ID when a board waits on it: what is missing or must change, the boards that need it, its states, the
components you tried, and its home — primitive → `design-kit/packages/ui/src/components/ui/`; composition →
`ui-extended/`; form field → `@invana/forms`; canvas-bound → `@invana/canvas-ui`; Studio-only composition →
`@invana-studio/ui`. On his yes the coder builds it in the kit with a story. Nothing is drawn with a component that is
not in the kit yet.

## 3. Lay out the page

| Rule | Detail |
|---|---|
| **One canvas** | Every board of the redesign lives on one canvas — **Invana design** (`https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`). Shared shell components (`<dc-import>` mounts sibling files only) and links between boards work only inside one canvas |
| **One page per place** | A page is where a board opens in the app, not its name's prefix: *Index* · *Components* · *Shell* · *Sign-in & Home* · *Explore* · *Model* · *Projects* · *Inbox* · *Records* · *Agents* · *Library* · *Settings · You & Invana* · *Settings · Connections* · *Settings · Operations* · *Settings · Access* · *Reference designs*. Set by each board's `page` key in `canvas.json`; 40 pages at most |
| *Index* page | One card per page, linked to its first board; the D-decision legend; each page's status |
| *Components* page | The shared shell components (§4b *The shell is components*) — the canvas's main components, like Figma's |
| *Reference designs* page | Earlier explorations kept for reference; never cited by a story, never edited |
| A row is a place | One row per board, in the order a person meets them. A `title1` note over each row group; one sticky under each row naming the stories that cite its boards |
| The flow | Boards left to right in the order of the stories' `## Flow`; a branch is a variant on the same row |
| One board per place | `specs/design-language.md` §7. A board is one place a feature lives, named for its feature; a **View** switch moves List · Detail; creates, edits, confirms, peeks, menus and panels are states drawn over it; a **State** switch (first use · empty after a filter · loading · has data · failed · agent working or proposing · no access) and a **Lens** switch (Admin · Operator) carry the rest. The Operator's locked reading is `<board> · Locked`, never its own board. A board several stories cite is drawn once |
| Overlays | A dropdown, modal, peek or confirm is a state of its board, drawn over it |
| Board names | Exactly as the stories' `## Screens` name them — `area.feature`, lower snake; a cell reads `<board> · <view or overlay> · <state>` (`model.kinds · Detail · Edit`), a cell with no view is the List. The file and the frame title are the board's name. A name that does not fit is a `clarify` row, never a rename |
| One line per board | What it draws — the same string in its `<title>` and its frame title |
| Links | Every act that opens another board links to it (`<a href="explore.board.dc.html">`), so the canvas plays as one prototype |

## 4. Draw to the standards

The kit rules — compose, tokens, density, the type ladder, where a component goes — are the **`build-studio`** skill §1.

| Standard | Detail |
|---|---|
| **Kit only** | `@invana/ui`, `forms`, `tables`, `themes`, `styling`, `@invana/canvas-ui`. Tokens only: no hex, no `hsl(`, no inline style literals, no hard-coded control heights. Never a look-alike or a one-off |
| **The agent proposes, the person decides** | The agent's proposal and the choice — a recommendation and **one** primary act — never a blank form where an agent could draft |
| **Simple by default** | The first screen shows the decision and its result. Steps, queries, logs and plans are not on it |
| **Traceable on demand** | Every agent answer, proposal and act has *Why?* / *How it got here* one click away (peek), and the full run one more (sheet) |
| **Asks before it acts** | An act that writes, sends, spends or changes access shows exactly what will happen before the person agrees |
| **Every state, both lenses** | All seven states as the UI shows them — first use says why it is empty and offers the one act that starts it; failed says what failed and the next act. The Operator lens shows each act as its *Who can* row says |
| **The shell** | As `specs/design-language.md` §2 draws it — header (☰ Invana / mode › view › item · ⌘K · n running · Access · Inbox · Assistant · avatar), leftNav (the mode's views on top, Records · Agents · Library · Settings below), a 260 px leftSection by default, mainSection, the 420 px assistant on the right, the footer — always from the shell components. A surface fills its regions; it never builds a layout |
| **Overlays** | Peek for one fact · modal for one task or decision · sheet for heavy authoring; never a modal on a modal; Esc returns to the work |
| **Plain words** | Glossary words only; roles as sentences (*Operator*, *Can shape the model*); no internal nouns |
| **Only what a user sees** | No notes, rationale or annotations on a board. Copy a person would read — an empty state's instruction, a refusal's reason — is UI and stays |
| **Accessible** | Real buttons and inputs; an accessible name on every icon-only act; colours told apart by more than hue |

## 4b. Canvas mechanics

| Rule | Detail |
|---|---|
| **One canvas, a page per place** | §3. The stories' `## Who can`, `## Flow` and `## Screens` are the brief (`.claude/agents/designer.md`). Never one page per batch, per layer or per screen size |
| **The shell is components** | The shell is drawn once, on the *Components* page, as sibling files every board mounts with `<dc-import>`: `ShellHeader` (mode · crumb · counts · lens · theme · open dropdown) · `ShellRail` (mode · active view · active summoner) · `ShellLeftSection` (title · items · width, 260 default) · `ShellFooter` (health · running · theme) · `SheetFrame` (sheet · nav groups · active item · crumb) · `AssistantPanel` (state). A board is a layout of these imports around its own main content; it owns theme, lens and state and passes them down as props (`dc-import` takes props, no children; never a prop called `name`). A change to the shell is an edit to one component, never to the boards. A board never copies shell markup |
| **A board carries the whole story** | Every flow branch and state of a story lives on its boards, for both lenses — the primary path · each drill-in · the decision the agent brings · **every refusal, with the reason it names** · first use, empty after a filter, loading, failed and no access, as Admin and as Operator. A story drawn only on its happy path is not drawn — but a *state* is drawn **as the UI shows it**, never as a table explaining it. The story's tables live in its `story.md`, not on the artboard |
| **An artboard draws only what the user sees** | No annotation cards, no "what this decided and why" panels, no rationale lines, no decision-id callouts. If it would not render in Studio for a real person, it does not go on the artboard. **Every note belongs in the feature file** — that is what `docs/for-developers/` is for, and a reviewer reads the two side by side. Copy a user would actually read (an empty state's instruction, a refusal's reason, a confirm card's consequences) **is** UI and stays. |
| **An artboard is named for its place** | `area.feature`, lower snake, as `specs/design-language.md` §7 names it — `model.kinds` · `agents.runs`. The **file** is that name (`model.kinds.dc.html`) and so is the **frame title**, so an artboard, a row in `the-screens.md` and a Surfaces row in the feature file are all reachable from one string. Views, overlays and states — `Detail`, `Edit`, `Locked` — are switches on the board, never deeper names. **Every board also carries one line saying what it draws**, and that line is the same string in three places: the artboard's `<title>`, its frame title in `canvas.json`, and its row in `the-screens.md`. Generate all three from one place; two descriptions of one board is a drift waiting to happen. The frame strip is canvas chrome, outside the artboard, so the line there is not a note *on* the design. |
| **A row is a place** | The canvas lays out one row per board, in the order a person meets them; never a layer or a batch. |
| Where the canvas is built | `.design/canvas-invana/project/` — the local mirror of the canvas, one flat folder (boards, components and `canvas.json`; `dc-import` and `check.py` need it flat). Read the live files into it before editing, edit there, publish from it with `root` `.design/canvas-invana`. A generator script is allowed when a page has many boards of one pattern; it writes into the mirror. `.design/` is gitignored, so the canvas is the source |
| The kit | The canvas's `ds/invana-kit/` bundle is the design-kit artifact (`https://claude.ai/artifact/PovTcmwPkgKDrxdrcA5TBD`); boards mount its components from `InvanaUI`. A kit component the boards need and the bundle lacks is a component request (§2), never a look-alike |
| Canvas mechanics | Artboards are Full HD, 1920×1080, on the shell contract (rail + 260px `leftSection` by default + `mainSection`), tokens only. Each `.dc.html` carries the `data-dc-script` block with `$preview: {width: 1920, height: 1080}` — without it the frame is served clipped. In `project/canvas.json`, `boards` and `order` are keyed by the **bare filename** (`Main.dc.html`, not `project/Main.dc.html`), 80px between frames in a row, one `title1` note per page. |
| The canvases | *Invana design* supersedes every earlier canvas in `.design/`; they are reference only, never edited. `docs/for-developers/the-screens.md` § *The design canvases* lists them |

## 5. Check

1. Every cell of the story's `## Screens` has its board on its place's page, under that name, showing that state for that lens, on the shell components, its links resolving to boards that exist. The story is drawn when every named board is and every designer task is `done`. You never write to `story.md`.
2. Screenshot every board and look at each: clipping, overlap, a state or lens that does not render.
3. `python3 scripts/specs/check.py` — every board the story cites must exist on the canvas.

## 6. Hand back

Write `.agent-reports/designer/<STORY>-boards.md` (TEAM.md §3 *Reports*) with a `review` row to the product manager:
the canvas link, the page, the boards per cell, your task IDs and their status, any `decide` rows still open.
They assemble the boards review and present it to Ravi. Before publishing: back up `project/`, read the live artifact
and every file you replace, then publish only the changed files. Do not commit unless asked.
