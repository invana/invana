# Invana — Graph Intelligence Platform

Structured knowledge graphs into interactive decision simulation environments.

## Current scope: MVP

**The active scope is `docs/internal/mvp.md`.** Treat it as the authoritative work list. When choosing what to build:

1. **Build only what `docs/internal/mvp.md` lists.** Anything not in MVP is out of scope, even if `docs/system-design.md` or an RFC describes it.
2. **Respect deferred items.** Lines marked `[-]` in `mvp.md` are explicit non-goals — do not implement them, do not scaffold for them, do not "while I'm here" them.
3. **Per-feature triplets.** Each feature lists Backend / Frontend / Integrations. Build all three together — do not let one side ship ahead and constrain the other.
4. **Follow the slice order.** The "Delivery Plan — Vertical Slices" section (S0 → S12) is the sequencing. Don't start a slice until the prior slice's "Done when" is reproducible from a clean checkout.
5. **Don't re-scope silently.** If MVP looks wrong or incomplete for the task at hand, surface it and update `mvp.md` first — then implement.
6. **System-design + RFCs are reference, not scope.** `docs/system-design.md` defines the long-term shape; RFCs define design decisions. Neither expands MVP scope.

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
| Design content | Belongs in the document, not the reply. Write it to the RFC / doc and point at it; don't paste it back in chat. |
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

Journeys live in `docs/internal/mvp/studio.md`, organised by user goal rather than by engine layer.
Backend shapes (entities, endpoints) live in `docs/internal/mvp/engine.md`.

## Rules

0. **Every design decision lands in a document.** RFCs and detail docs in `docs/` are the record — chat is not. If a decision was made in conversation, write it into the relevant doc in the same turn.
1. Don't write code without complete implementation design decisions. Write an RFC first:
   - **MVP-scope RFCs go in `docs/internal/mvp/rfc-NNN-<topic>.md`** — alongside the per-layer detail docs. This is where everything new lives while the MVP is being built.
   - `docs/rfcs/` is the legacy / pre-MVP / platform-architecture home (RFC-001 … RFC-017). Don't add new MVP RFCs there.
   - Numbering continues across both directories (next RFC = the next integer after the highest existing number in either dir).
2. Always ask when in doubt.
3. make the development setup work across operating systems for seamless community developer contributions. 
4. Engine and Studio are built together, distributed flexibly (one image or separate).
5. Don't write too many tests, write few positive and negative tests, not soo many random tests.
6. Coverage target: 80% minimum for both engine and studio.
7. Don't mock the tests, unless asked, always test using graph databases.
8. Every user-facing change requires a changeset.
9. Studio uses `@invana/design-kit` for all UI components — don't create custom components unless absolutely necessary.
10. Studio uses `@invana/canvas` for all graph rendering — no PixiJS code in studio.
11. **Never commit automatically.** Only run `git commit` when the user has explicitly asked for it in the current turn (e.g. "commit", "commit the changes"). Finishing a task is not implicit approval to commit — leave changes staged or unstaged and let the user decide. This rule applies even when a previous turn included a commit request; each commit needs its own ask. Same goes for `git push` and any other action that publishes work outside the local repo.
