# The spec format

How every product, feature, user story and journey in `specs/` is written. The templates in `templates/` beside
this file are the starting point; copy one, never write a spec from a blank page.

## Files

```
specs/
├── README.md                       index: products, then foundation → feature → story, with status and open tasks
├── vision.md · personas.md · glossary.md · design-language.md
├── system-design/                  architecture.md · data-model.md · integrations.md
├── journeys/J<nn>-<slug>.md        end-to-end flows across products
└── products/<product>/            also foundation/<part>/ — Inbox · Settings · Shell, same layout
    ├── product.md
    └── features/<CODE>-F<nn>-<slug>/
        ├── feature.md              user journey · stories index · access · states · rules · decisions · not building
        └── stories/<CODE>-<nn>-<slug>/
            ├── story.md            the story: the source of truth for everyone who builds it
            └── task.md             the designer's, coder's and QA's tasks for it, in one table

.claude/skills/product-spec/
├── format.md                       this file
└── templates/                      product.md · feature.md · story.md · task.md · journey.md
```

| Rule | Detail |
|---|---|
| One folder per feature | `feature.md` holds what its stories share; each story is a folder of its own under `stories/` |
| One folder per story | `story.md` and `task.md`, nothing else. The story is the source of truth; the tasks are how each role delivers it |
| Folder name = ID + slug | `MO-F03-load-data-into-a-kind/` · `MO-17-pick-where-the-data-comes-from/`. The slug may change; the ID never does |
| Two areas, one format | **Products** in `products/` — Explore `EX` · Model `MO` · Data `DA` · Agents `AG` · Projects `PJ`. **Foundation** in `foundation/` — what every product uses, not a product: Inbox `IN` · Settings `ST` · Shell `SH`. Both are written the same way; the list is `vision.md` › *Products* and *Foundation* |
| Journeys cross products | A journey strings stories from several features into one person's path, with its branches |

## IDs

| Thing | Format | Example |
|---|---|---|
| Product | two-letter code | `MO` |
| Feature | `<code>-F<nn>` | `MO-F03` |
| User story | `<code>-<nn>`, unique within its product | `MO-17` |
| Task | `<story>-T<n>`, unique within its story | `MO-17-T3` |
| Acceptance criterion | `<story>.<n>` | `MO-17.2` |
| Journey | `J<nn>` | `J02` |
| Board | `area.feature.surface.variant`, lower snake | `model.kind.load_data.map` |

- An ID is never reused. A deleted story's ID stays retired.
- Numbers are assigned in order of creation, not in reading order.

## Status

| Status | Means | Reached when |
|---|---|---|
| `idea` | Named, not yet specified | The row exists |
| `specified` | Specified and approved for design | Every story has its five parts, every `## Screens` cell names its board or `—`, the check passes, and the spec review approved it |
| `designed` | Drawn and approved for build | Every board the spec names is on the canvas, and the boards review approved them |
| `built` | Shipped in Studio and the engine | Every surface the feature needs is done |
| `verified` | Proven | Every acceptance criterion has a passing test or a recorded check |

A feature's status is the lowest status among its stories. A product's status is the lowest among its features.
A story's status never runs ahead of its tasks: `designed` needs every designer task `done`, `built` every coder task,
`verified` every QA task — and at least one task of that role. Ravi's review is still the gate; the tasks are its
precondition. The check enforces both.

## Writing rules

| Rule | Detail |
|---|---|
| Tables and bullets | Prose only where a table cannot carry it, and then a line or two |
| Present tense, no history | A spec says what is true. Never what it replaced, what was renamed, or which decision id produced it |
| A story is a person's need | *As* a persona from `personas.md` · *I want* an outcome, not a button · *so that* a reason |
| A story is complete on its own | `story.md` has five parts, in order: *As / I want / so that* · `## Who can` (Admin · Operator) · `## Flow` (mermaid) · `## Acceptance criteria` · `## Screens`. It is the designer's whole input for the story's canvas page, and the coder's and QA's for the build |
| Criteria are checkable | Given / When / Then, one row each, each with its own ID. Each must be provable by a test or by looking at the screen |
| Every state, both lenses | A story's `## Screens` is its state matrix: every surface × state (first use · empty after a filter · loading · has data · failed · agent working or proposing · no access) × lens (Admin · Operator). Every cell names a board or `—`. The spec names the boards; the designer draws them and never edits the spec |
| Access is explicit | Every feature's Access table names, per act, the role that may do it — Admin, or a Graph role shown as its sentence (`.claude/team/TEAM.md` §7) — and what everyone else sees. Each refusal is also a criterion |
| Unhappy paths are stories or criteria | Empty, loading, failed, refused, no access, asks permission. A feature drawn only on its happy path is not specified |
| Every feature has a user journey diagram | `## User journey` holds a mermaid `flowchart`: where the person starts, every story's step labelled with its ID, every branch — no access, failed, refused, asks permission — and where they end. Add a `sequenceDiagram` when an agent, a background run or a permission ask is involved |
| Journeys cross features | A `journeys/J<nn>` file draws one person's path across products in mermaid, with every branch; a feature's diagram links into it |
| Flows are diagrams | A flow is never a walkthrough in prose
| Screen words come from the glossary | `glossary.md` lists the words a person reads and the ones never shown |
| Decisions in the file they govern | A feature's decisions sit in its Decisions table; a decision spanning a product sits in `product.md` |
| Not building is explicit | Every product and feature ends with what it deliberately leaves out, and why |

## Tasks

`task.md` is one table: every task the designer, the coder and QA do to deliver the story. The product manager creates
it, empty, with the story; each role adds its own rows when the story reaches its gate, before its first act on it.

| Column | Holds |
|---|---|
| ID | `<story>-T<n>`, next free number; never reused — a task no longer needed is `dropped`, not deleted |
| Owner | `designer` · `coder` · `qa` |
| Title | What gets done, in a few words |
| Description | One or two lines: what, and what it leaves out |
| Story | `[MO-17](story.md)` |
| Criteria | The criterion IDs it delivers or proves (`MO-17.2 · MO-17.4`), or `—` |
| Boards | The boards it draws, builds or checks, or `—` |
| Depends on | Task IDs it waits for, or `—` |
| Status | `todo` · `doing` · `blocked` · `done` · `dropped` |
| Evidence | When `done`: the canvas page, the commit or test, the QA report — `—` until then |

| Rule | Detail |
|---|---|
| Who adds what | Designer when the story is `specified` — one task per board or board group. Coder when it is `designed` — engine, Studio, tests, changeset, sized to one commit each. QA when it is `built` by the coder — pass 1 checks by criterion, pass 2 by board |
| Own rows only | A role adds and edits only rows whose Owner is itself. Another role's task that looks wrong is a `clarify` row to that role, never an edit |
| Rows sorted by owner | Designer · coder · QA, then by ID |
| The story governs | A task delivers what the story says and nothing else. A task the story cannot justify is a gap: a `raise` row to the product manager, who changes the story first |
| Every criterion is covered | By the time the story is `built`, every criterion appears in a coder task, and in a QA task by `verified` |
| Blocked says why | A `blocked` task's Description ends with what it waits for |

## Front-matter keys

| File | Keys |
|---|---|
| Product | `id · title · status · owner · personas` |
| Feature | `id · title · product · status · personas · stories · journeys · boards · depends_on` |
| Story | `id · title · feature · status · personas · boards` |
| Journey | `id · title · personas · stories · boards` |

The front-matter is what `check.py` reads to build the index and to catch broken links. Keep it in step with the body.
