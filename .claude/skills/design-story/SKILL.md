---
name: design-story
description: Draw one Invana user story on its own canvas page — Product › Feature › <STORY-ID> Story name — from its spec (Who can · Flow · Acceptance criteria · Screens), every state for Admin and Operator, composed only from @invana/design-kit components. Use whenever a specified story needs its boards, or a story's boards change.
---

# Design a story — one page, every state, both lenses

The procedure the **designer** follows, and anyone else drawing a story. Only stories at `specified` or later — their
spec approved by Ravi — are drawn. The designer draws; it never edits a spec and never writes code — the one file in the repo it writes is its own rows
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
| **One page per user story** | Page name **`Product › Feature › <STORY-ID> Story name`** — `Modeller › Load data into a kind › MO-17 Pick where the data comes from`. Page id: the story ID in lower case (`mo-17`) |
| One canvas per product | *Invana Modeller*, *Invana Explorer*, … Pages in feature order, then story order. A canvas holds 40 pages: past that, split by feature group (*Invana Modeller — Data*). The index canvas links every product canvas |
| The page follows the story's flow | Boards left to right in the order of `## Flow`; branches on the row below |
| One board per surface | An interactive board with a **State** switch (first use · empty after a filter · loading · has data · failed · agent working or proposing · no access) and a **Lens** switch (Admin · Operator). A separate board only for a moment the flow must show on its own |
| Board names | Exactly as the story's `## Screens` names them — `area.feature.surface.variant`, lower snake (`model.kind.load_data`). A board lives on exactly one story's page. The file and the frame title are the name. A name that does not fit is a `clarify` row, never a rename |
| One line per board | What it draws — the same string in its `<title>` and its frame title |

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
| **The shell** | One `AppLayoutV2`: header (wordmark *Invana Explore · Model · Projects*, Graph picker, ⌘K, Inbox, assistant), leftNav, collapsible leftSection, mainSection `Workbook`, the assistant on the right, the footer. A surface fills its regions; it never builds a layout |
| **Overlays** | Peek for one fact · modal for one task or decision · sheet for heavy authoring; never a modal on a modal; Esc returns to the work |
| **Plain words** | Glossary words only; roles as sentences (*Operator*, *Can shape the model*); no internal nouns |
| **Only what a user sees** | No notes, rationale or annotations on a board. Copy a person would read — an empty state's instruction, a refusal's reason — is UI and stays |
| **Accessible** | Real buttons and inputs; an accessible name on every icon-only act; colours told apart by more than hue |

## 4b. Canvas mechanics

| Rule | Detail |
|---|---|
| **A canvas is one page per user story** | Every design canvas is one canvas per product, **one page per user story**, named `Product › Feature › <STORY-ID> Story name` — *Modeller › Load data into a kind › MO-17 Pick where the data comes from*. The story's `## Who can`, `## Flow` and `## Screens` are the page's brief (`.claude/agents/designer.md`). Never one page per batch, per layer or per screen size |
| **A page carries the whole story** | Every flow branch and state of that story lives on its page, for both lenses — the primary path · each drill-in · the decision the agent brings · **every refusal, with the reason it names** · first use, empty after a filter, loading, failed and no access, as Admin and as Operator. A story drawn only on its happy path is not drawn — but a *state* is drawn **as the UI shows it**, never as a table explaining it. The story's tables live in its `story.md`, not on the artboard |
| **An artboard draws only what the user sees** | No annotation cards, no "what this decided and why" panels, no rationale lines, no decision-id callouts. If it would not render in Studio for a real person, it does not go on the artboard. **Every note belongs in the feature file** — that is what `docs/for-developers/` is for, and a reviewer reads the two side by side. Copy a user would actually read (an empty state's instruction, a refusal's reason, a confirm card's consequences) **is** UI and stays. |
| **An artboard is named for what it draws, and the name is the map** | `area.feature.surface.variant`, lower snake, dots for depth — `library.plans.list` · `library.plans.detail.overview` · `library.plans.detail.flow_canvas` · `library.plans.detail.flow_canvas.edit` · `library.plans.detail.flow_canvas.complex_variant1`. The **file** is that name (`library.plans.detail.overview.dc.html`) and so is the **frame title**, so an artboard, a row in `the-screens.md` and a Surfaces row in the feature file are all reachable from one string. A variant is a **deeper name, never a new surface**: two readings of one screen are `x` and `x.variant`, which is what keeps the count down. If you cannot name it this way, it is not a variant — it is a screen you have not justified. **Every board also carries one line saying what it draws**, and that line is the same string in three places: the artboard's `<title>`, its frame title in `canvas.json`, and its row in `the-screens.md`. Generate all three from one place; two descriptions of one board is a drift waiting to happen. The frame strip is canvas chrome, outside the artboard, so the line there is not a note *on* the design. |
| **A row is a name prefix** | The canvas lays out **one row per prefix**, the parent leftmost and its variants to its right: `…flow_canvas` then `…flow_canvas.complex_variant1` then `…complex_variant2`. Columns are an accident of how many variants a surface has, never a layer or a batch. |
| Where a canvas is built | `.design/canvas-<name>/` — Python generators over the shared kit (`_kit · _ui · _bpanel · _dash · _flow`, and `canvas-govern/_gov.py` for the governance vocabulary: the layer strip, participant addresses, world and rule rows). **Reuse the kit; never hand-write an artboard's HTML.** `.design/` is gitignored, so the canvas is the source and the generators are the build. |
| Canvas mechanics | Artboards are 1440×900 on the shell contract (rail + 420px `leftSection` + `mainSection`), tokens only. Each `.dc.html` carries the `data-dc-script` block with `$preview: {width: 1440, height: 900}` — without it the frame is served clipped. In `project/canvas.json`, `boards` and `order` are keyed by the **bare filename** (`Main.dc.html`, not `project/Main.dc.html`), 80px between frames in a row, one `title1` note per page. |
| The canvases | `docs/for-developers/the-screens.md` § *The design canvases* lists every canvas, what it draws and whether it supersedes another. A canvas nothing cites is a decision nobody made. |

## 5. Check

1. Every cell of the story's `## Screens` has its board on the page, under that name, showing that state for that lens. The story is drawn when every named board is and every designer task is `done`. You never write to `story.md`.
2. Screenshot every board and look at each: clipping, overlap, a state or lens that does not render.
3. `python3 scripts/specs/check.py` — every board the story cites must exist on the canvas.

## 6. Hand back

Write `.agent-reports/designer/<STORY>-boards.md` (TEAM.md §3 *Reports*) with a `review` row to the product manager:
the canvas link, the page, the boards per cell, your task IDs and their status, any `decide` rows still open.
They assemble the boards review and present it to Ravi. Before publishing: back up `project/`, read the live artifact
and every file you replace, then publish only the changed files. Do not commit unless asked.
