# Invana — Graph Intelligence Platform

Structured knowledge graphs into interactive decision simulation environments.

## Scope

**The active scope is `docs/for-developers/`.** Its `README.md` is the authoritative feature index;
each module folder holds `spec.md` and one file per feature. When choosing what to build:

1. **Build only what the index lists.** Anything not in `for-developers/README.md` is out of scope, even if
   `docs/system-design.md` describes it.
2. **Respect what is deliberately absent.** Every module spec and feature file ends with a
   "Not building" table. Those are explicit non-goals — do not implement them, do not scaffold for
   them, do not "while I'm here" them.
3. **Read the feature file before writing code.** It carries the user story, capabilities, journeys,
   seams, surfaces and engine shapes. If it is missing something you need, add it there first.
4. **Build the columns a feature needs.** `API`, `CLI` and `Studio` are tracked separately in the
   index; a feature ships when every column it needs is ✅.
5. **Follow the slice order.** The `Slice` column ties each feature to the Delivery plan. Don't start a
   slice until the prior one's "Done when" is reproducible from a clean checkout.
6. **Don't re-scope silently.** If the scope looks wrong for the task at hand, update the feature file
   and the index first — then implement.
7. **Use the product's words.** `docs/for-developers/terminology.md` pins them, and names the
   ones we do not use. Code, UI copy and docs follow it.

## Architecture

- **Monorepo**: `engine/` (Python 3.14 + FastAPI) + `studio/` (React 19 + TypeScript) + `integrations/` (connector packages)
- **Distribution**: `pip install invana` (core) + `pip install invana-neo4j` (per connector) + Docker images
- **CLI**: `invana start`, `invana migrate`, `invana version`

## Stack

### Engine (Python)
- **Framework**: FastAPI + uvicorn (async)
- **Package manager**: uv
- **Linting**: Ruff
- **Testing**: pytest + pytest-asyncio + pytest-cov
- **App state DB**: SQLAlchemy async (SQLite dev / PostgreSQL prod)
- **Auth**: JWT + OAuth2/SSO

### Studio (TypeScript/React)
- **Framework**: React 19 + Vite
- **Package manager**: pnpm
- **Styling**: TailwindCSS 4
- **UI components**: `@invana/design-kit` (TailwindCSS 4 + shadcn) — use existing components, don't reimplement
- **Graph rendering**: `@invana/canvas` (PixiJS 8, WebGPU + WebGL)
- **State**: Zustand (client) + TanStack Query (server)
- **Linting**: Biome
- **Testing**: Vitest + Testing Library + Playwright
- **Query editor**: CodeMirror 6

### Integrations (Python — separate packages)
- **Pattern**: `integrations/invana-{db}/` — each is an independent pip package
- **Packages**: invana-neo4j, invana-memgraph, invana-arcadedb, invana-janusgraph, invana-neptune, invana-tinkergraph
- **Each has**: own `pyproject.toml`, `.venv`, deps, tests
- **Depends on**: `invana` (engine core)

### Infrastructure
- **CI**: GitHub Actions
- **Pre-commit**: pre-commit (ruff + biome + commitizen)
- **Versioning**: Unified SemVer + CalVer release tags
- **Changesets**: For changelog and version bumps
- **Docker**: Multi-target Dockerfile (engine | studio)
- **Docs**: MkDocs Material
- **Registry**: Docker Hub (invana/engine, invana/studio)

## Supported Graph Databases
- **Cypher**: Neo4j, Memgraph, ArcadeDB
- **Gremlin**: JanusGraph, Amazon Neptune, TinkerGraph, ArcadeDB
- **Vector**: Mixin for DBs with vector index support

## Key Features
1. **Curated Context** — Turn scattered data into curated context: connectors ingest from heterogeneous sources, stitching binds them under a shared ontology, producing a queryable knowledge graph agents can reason over.
2. **Explainability** — No hallucinations. Every answer is grounded in the mission's knowledge graph and traceable through LLM → query → record → dataset. When the graph can't answer, the system says so.
3. **Graph Modelling** — Ontology, semantics, schema versioning, constraints
4. **Query Engine** — High-performance async, Cypher + Gremlin, connection pooling
5. **Visualization** — PixiJS 8 with WebGPU, handles 100K+ nodes at 60fps
6. **Simulation** — Game theory, hypothesis testing, parameter sweeps, rule engine

## How to respond

**Default to sections and tables. Prose is the exception, not the format.**

| Rule | Detail |
|---|---|
| Structure | Answer in short sections with headings. Inside a section, prefer a table over sentences. |
| Length | Concise. No preamble, no recap of what was asked, no restating what a table already shows. |
| Explanations | Only when asked. Don't explain reasoning, trade-offs, or background unless the request calls for it ("why", "explain", "learn more"). |
| Prose | Use it only where a table genuinely can't carry the meaning — a real trade-off, a risk, a decision that needs a caveat. Then keep it to a line or two. |
| Design content | Belongs in the document, not the reply. Write it to the feature file or module spec and point at it; don't paste it back in chat. |
| Data shapes | Whenever describing entities, columns, endpoints, enums, or config — table it, so the structure is visible at a glance. |
| Diagrams | User flows and journeys get **mermaid** diagrams in the doc, not prose walkthroughs. |

**Frontend / user-flow questions: think in user journeys first.** Any question about Studio, UI, UX, a
screen, or a flow gets reasoned about as a journey — never as a component list.

| Step | What it means |
|---|---|
| 1. Name the actor and the goal | "As a *&lt;role&gt;*, I want *&lt;outcome&gt;*, so that *&lt;reason&gt;*" — not "add a button" |
| 2. Map the journey | Entry point → steps → decision points → exit / success state. Include the unhappy paths: empty, loading, error, permission-denied, locked. |
| 3. Draw it | A **mermaid** `flowchart` (or `sequenceDiagram` for client↔server timing) in the doc. The diagram is the spec. |
| 4. Then name the surfaces | Only now: routes, pages, components, hooks, and which API each step consumes. |
| 5. Check the seams | What does the user see *while waiting*? What survives reload? What does a member without access see? |

Journeys, surfaces and engine shapes all live in the feature's own file under
`docs/for-developers/modules/<module>/features/<feature>.md` — one place per feature, not split
by layer. What several features share lives in that module's `spec.md`.

## Design rules

**Every hi-fi design is composed from `@invana/design-kit`.** Designs and code share one component
set, so a screen that can be drawn can be built, and a screen that cannot be built cannot be drawn.

| Rule | Detail |
|---|---|
| Compose, don't draw | A hi-fi screen is `@invana/ui` + `@invana/forms` + `@invana/tables` + `@invana/themes` + `@invana/canvas` components. No hand-written HTML with inline styles, no one-off CSS, no ad-hoc colours. |
| Tokens only | Colour, spacing, radius and control heights come from `@invana/styling` tokens (`--primary`, `--muted-foreground`, `--border`, `--success`, …). Never a literal `hsl()`/hex in a design or in Studio. |
| Missing component → build it in the kit first | If a design needs something the kit does not have, add it to `~/Projects/invana/design-kit` **with a story**, then use it. Never inline it into the design and never reimplement it in Studio. |
| Three repos, one direction | `design-kit` (`~/Projects/invana/design-kit`) → `canvas` (`~/Projects/invana/canvas`) → `invana` (here). `@invana/canvas-ui` peer-depends on `@invana/ui`; nothing depends back up. A component belongs in the **lowest layer that can own it** — if canvas-ui invents something general, promote it down into `@invana/ui` and have canvas-ui consume it. |
| Where it goes | shadcn-style primitive → `design-kit/packages/ui/src/components/ui/`. Composition of primitives, **including Invana-domain ones** (emissions, citations, charts) → `ui-extended/`. Form field → `@invana/forms`. Needs an external JS library (editor, uploader, heavy picker) → its own package. Anything bound to canvas state (toolbars, layers, minimap, context menus, canvas status bar) → `@invana/canvas-ui` — **check there before building it**, it already ships most canvas chrome. |
| Density is a token, not a prop | `@invana/styling` ships `data-density="compact"`; Studio and the board set it on the root. Components read `--control-h*` / `--font-size-*` — never a hard-coded `h-8`/`h-9`, never a `size="xs"` at every call site. |
| One story per file | `apps/storybook/stories/…` — one exported story per `*.stories.tsx`, folder mirroring `packages/ui/src/components/`. A new component without a story is not done. Whole *screens* are not stories — they live on the board. |
| The board | `.design/board/` is the hi-fi board: React artboards composed only from `@invana/*`, compiled by `build.mjs` into one self-contained HTML file, published as the Artifact `invana-hifi-with-design-kit`. The build fails on a raw `hsl(`, a hex colour, a `style={{}}` literal, or any element outside `@invana/*`. |
| The map | `docs/for-developers/building-studio/design-kit-coverage.md` is the authoritative board element → design-kit component map, the decisions, and the build order. Update it whenever a component ships or an artboard changes. |
| The screen index | `docs/for-developers/the-screens.md` lists all 42 hi-fi artboards with their status — is the screen built, is it on the kit, which feature it draws. **Flip a row the moment a screen ships.** It is to screens what `for-developers/README.md` is to features. |
| The shell | `docs/for-developers/building-studio/the-shell.md` — one `AppLayoutV2`, and `mainSection` is `BoardPagesViewPanel` (the open boards, `keepMounted`). Reference: `canvas-ui/apps/AppLayoutV2` in the canvas Storybook. Every screen fills its regions; no screen builds a layout. |
| How Studio is built | `docs/for-developers/building-studio/` — `code-shape.md` (feature modules, deletion lists, routing, guardrails) and `refactor-plan.md` (the phases, the ui/canvas-ui substitution tables, how a move is made safely). |
| Journeys still lead | The journey-first process above is unchanged. Naming design-kit components is step 4 (*name the surfaces*), not step 1. |

## Rules

0. **Every design decision lands in a document.** `docs/for-developers/` is the record — chat is not. If a decision was made in conversation, write it into the relevant feature file or module spec in the same turn.
1. Don't write code without complete implementation design decisions. Write them down first:
   - **A decision about an existing feature** goes in that feature's file, in its Decisions table —
     stated in present tense, with no history of what it replaced.
   - **A decision spanning a module** goes in that module's `spec.md`, under Cross-feature decisions.
   - **A new feature** gets a row in `for-developers/README.md` and its own file, before any code.
   - There is no RFC tree. A decision belongs to the feature or module it governs, stated in present
     tense; the argument that produced it is not kept.
2. Always ask when in doubt.
3. make the development setup work across operating systems for seamless community developer contributions. 
4. Engine and Studio are built together, distributed flexibly (one image or separate).
5. Don't write too many tests, write few positive and negative tests, not soo many random tests.
6. Coverage target: 80% minimum for both engine and studio.
7. Don't mock the tests, unless asked, always test using graph databases.
8. Every user-facing change requires a changeset.
9. Studio uses `@invana/design-kit` for all UI components — don't create custom components unless absolutely necessary. A component Studio needs and the kit lacks is built in design-kit, with a story, not in `studio/`. See **Design rules**.
10. Studio uses `@invana/canvas` for all graph rendering — no PixiJS code in studio.
11. **Never commit automatically.** Only run `git commit` when the user has explicitly asked for it in the current turn (e.g. "commit", "commit the changes"). Finishing a task is not implicit approval to commit — leave changes staged or unstaged and let the user decide. This rule applies even when a previous turn included a commit request; each commit needs its own ask. Same goes for `git push` and any other action that publishes work outside the local repo.
