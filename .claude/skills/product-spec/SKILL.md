---
name: product-spec
description: Write, change or migrate an Invana product spec in specs/ — a product, feature, user story or journey — the standard way. Use whenever someone brings a new requirement, idea or change to what Invana does, before any design or code, or when a feature with no spec is about to be worked on. Interviews first, flags breaking changes, writes from the templates, runs the spec check.
---

# Product spec — specify it before anyone draws or builds it

The procedure the **product manager** follows — only the product manager (or Ravi) writes a spec; anyone else recommends. The format itself is
`format.md` beside this file — read it first, every time. How the team works around a spec is `.claude/team/TEAM.md`.

| Source | What it fixes |
|---|---|
| `format.md` (this skill) | Files, IDs, status ladder, writing rules, front-matter keys |
| `templates/product.md` · `feature.md` · `story.md` · `task.md` · `journey.md` (this skill) | The only starting points. Copy one; never write a spec from a blank page. A story is a folder: `story.md` and an empty `task.md` |
| `specs/glossary.md` · `personas.md` | The words a person reads on screen; who the stories are for |
| `specs/design-language.md` | How surfaces behave: modes, peek · modal · sheet, the assistant |
| `specs/vision.md` · `.claude/team/TEAM.md` §0 · §7 | What Invana is; how every role builds to it; the access model — Admin and Operator |
| `specs/migrations.md` | Agreed changes not yet made |

## 0. Journey first

**Any question about Studio, UI, UX, a screen or a flow — in a spec or in conversation — is reasoned about as a user journey first** — never as a component list.

| Step | What it means |
|---|---|
| 1. Name the actor and the goal | "As a *&lt;role&gt;*, I want *&lt;outcome&gt;*, so that *&lt;reason&gt;*" — not "add a button" |
| 2. Map the journey | Entry point → steps → decision points → exit / success state. Include the unhappy paths: empty, loading, error, permission-denied, locked. |
| 3. Draw it | A **mermaid** `flowchart` (or `sequenceDiagram` for client↔server timing) in the doc. The diagram is the spec. |
| 4. Then name the surfaces | Only now: routes, pages, components, hooks, and which API each step consumes. |
| 5. Check the seams | What does the user see *while waiting*? What survives reload? What does a member without access see? |

The feature's user journey lives in its `feature.md`; each story's flow in its `story.md`. What several features of
a product share lives in its `product.md`.

## 1. Read what exists

`specs/README.md`, the product's `product.md`, every feature the request may touch, and the journeys that cross
it. If the feature has **no spec yet**, migrate it first (step 6) — then work from the spec.

## 2. Interview

Ask only what the specs and the code cannot answer, **in one batch** — the question dialog in a session; a
*Questions* list in the report when delegated. Recommend an answer for each.

| Area | Ask |
|---|---|
| Who and why | Which persona? What problem? What do they do today without it? |
| The decision | Which decision does this help the person make? What does the agent propose, and what does the person choose? |
| Outcome | What does success look like, and how is it measured? |
| Scope | What is in, and what is deliberately out? Which product owns it — or is it a new product? |
| Access | What can an **Admin** do, and an **Operator**? What does the Operator see otherwise — hidden, disabled with its reason, or *Ask <owner>*? Does a grant (*Can work on projects · Can build agents · Can shape the model*) change it? Is any act new to the access model? |
| States | First use · empty after a filter · loading · has data · failed · agent working or proposing · no access — which apply, and what does each show? |
| Data | Which records does it read or write? Is any of that new to the engine? |
| Overlap | Does an existing story already cover it? Does it contradict a recorded decision? |
| Order | What blocks it? Which journey does it join? |

A question with an obvious conventional answer is not asked: decide it, record it in the file's Decisions table, and
say so in the report.

## 3. Breaking changes — always asked, never assumed

| Breaks | Example |
|---|---|
| A criterion of a story at `designed` or later changes | *Load data* requires a draft instead of a published kind |
| A story is removed or merged, or an ID retired | Folding MO-18 into MO-17 |
| A recorded decision is reversed or narrowed | *Agents ask before sending* becomes *agents send* |
| A feature moves between products | Imports from Data into Modeller |
| A glossary word changes | *Access rule* becomes *Policy* on screen |

For each: say exactly what breaks (story, criterion, boards, code that cites it) and offer **change it** · **add
alongside** · **drop the idea**, with a recommendation. Change nothing until Ravi answers. An ID is never reused; a
retired story keeps its ID in the feature's *Not building* table with the reason.

## 4. Write

| Thing | How |
|---|---|
| A product | `products/<slug>/product.md` from the template; a new, unique two-letter code |
| A feature | `products/<product>/features/<CODE>-F<nn>-<slug>/feature.md`; the next free number; a row in `product.md` › Features. Its summary names the decision it helps make |
| The user journey | `## User journey` first: a mermaid `flowchart` from where the person starts to where they end, every story's step labelled with its ID, every branch (no access, failed, refused, asks permission). A `sequenceDiagram` too when an agent, a background run or a permission ask is involved. Draw it before the stories — the stories are its steps written down |
| A user story | A folder `stories/<CODE>-<nn>-<slug>/` in its feature: `story.md` from the template, complete on its own — the designer's whole brief for the story's canvas page, and the coder's and QA's for the build. Five parts, in order (below); its status in the front-matter. A row in the feature's `## Stories` table and its `stories:` key |
| Its tasks | `task.md` beside it, copied from the template with the table empty. You never write a task: the designer, the coder and QA each add their own when the story reaches their gate (`format.md` › *Tasks*). A task that asks for what the story does not say comes back to you as a `raise` row — change the story, or say why not |
| Access | `## Access`: each act → the role that may do it in code, and what everyone else sees. Every story's *Who can* agrees with it |
| States | `## States`: what each of the seven states means across the feature |
| A journey | `journeys/J<nn>-<slug>.md` when a person's path crosses products; every branch in mermaid |
| A decision | In the Decisions table of the file it governs; present tense, no history, no decision ids |
| A change that cannot be made now | A row in `specs/migrations.md` |

**The five parts of a story**

| # | Part | Holds |
|---|---|---|
| 1 | **As / I want / so that** | A persona · an outcome, not a button · a reason. Agent stories read *the agent proposes → the person decides* |
| 2 | `## Who can` | An **Admin** row and an **Operator** row: what each can do, what the Operator sees otherwise, and any grant that lets them do more |
| 3 | `## Flow` | A mermaid flowchart of this story's steps and every branch |
| 4 | `## Acceptance criteria` | Given / When / Then, one ID per row (`MO-17.2`). A refusal row for the Operator; a trace row for every agent outcome (*Then How it got here shows its steps and sources*) |
| 5 | `## Screens` | Every surface the story shows × the seven states × Admin and Operator. Every cell names its board (`area.feature.surface`, or `… · State` on a board with a State switch) or `—` where the state cannot happen. You name the boards; the designer draws exactly those and never edits the spec |

Write in tables and bullets, so a person and an agent read it the same way. Use only glossary words on screen.
Operator is the role code still calls `viewer` (migration M1) — write *Operator*, never touch code.

## 5. Check

`python3 scripts/specs/check.py` — fix every error — then `python3 scripts/specs/check.py --index` to rewrite
`specs/README.md`. A spec that fails the check is not done. Move a story up the status ladder only at its gate
(`.claude/team/TEAM.md` §2).

A passing spec goes to Ravi for **the spec review** (TEAM.md §5) before anyone draws it: the spec, its user journey,
Access, the boards each story names, and the open questions. Stories move to `specified` only on his yes; only then
does the designer get a `request`. A bug no criterion covers gets its criterion here, then goes to the fix lane.

## 6. Migrate (touch it, migrate it)

A feature with no spec in `specs/` is migrated before anyone works on it:

| From | Take | Leave |
|---|---|---|
| `docs/products/<product>.md` | The story rows (keep their IDs), boards, decisions | — |
| `docs/for-developers/modules/<module>/features/<feature>.md` | The user story, capabilities as criteria, journeys, decisions, *Not building* — each story into its own folder with an empty `task.md` | Engine shapes, APIs, code layout — they stay in for-developers |
| `docs/system-design.md` | Architecture → `specs/system-design/` | — |

Then write the parts the old docs lack (Who can, Flow, States, Screens), run the check, delete the migrated story
block from the old file, and list what could not be placed. When a product is fully moved, update migration M2.

## 7. Report

Files and IDs written · decisions recorded · breaking changes waiting on Ravi · open questions with recommendations ·
the check's result. Tables and bullets. A product manager writes it to `.agent-reports/product-manager/`
(`.claude/team/TEAM.md` §3 *Reports*). Do not commit unless asked.
