# Invana — Graph Intelligence Platform

Structured knowledge graphs into interactive decision simulation environments.

## Talk is not a request to write

**Strict, for every session and every agent.** Most of the time Ravi is only talking — with you or with an agent.

| Rule | Detail |
|---|---|
| Talk changes no file | A question, an idea or a discussion writes nothing — no doc, spec, feature file, memory or code. Write only when Ravi asks for a write in that turn ("write it", "update X", "go ahead") |
| Stay in scope | A task changes only what it was asked for. No drive-by refactors, renames, doc tidies or fixes to unrelated problems |
| Found something? Recommend it | Anything that should change and was not asked for — a bug, a gap, a missing test, a security fix, a doc, a component — becomes one row in [`.claude/team/agents-recommendations.md`](.claude/team/agents-recommendations.md), raised with the `recommend` skill, and a line in the reply — the one write allowed without asking. Nobody works a recommendation until the product-manager takes it up as a session, a phase or a project |
| Each role writes only its own files | The product-manager writes docs and specs, never code. The coder writes code and every test, never docs or specs. The designer writes the canvas only. QA, security and the project-lead write reports. In `specs/`, the designer, coder and QA write only their own rows of a story's `task.md`. Everything else is a recommendation. The matrix is `.claude/team/TEAM.md` §1 *Edit rights*, generated from `.claude/team/edit-rights.json`; the `edit_rights` hook enforces it |

## Skills — which one for which act

Every procedure lives in a skill; this file only routes. Load the skill **before** the act, every time.

| To … | Use |
|---|---|
| Write or change a spec, a story or a journey — or reason about any UI or flow question (journey first) | `product-spec` |
| Draw a story's boards | `design-story` |
| Write or change code in `engine/`, `studio/` or `integrations/` — scope, decisions, access, engine standards, tests, finishing | `build-feature` |
| Write or change Studio UI, a design-kit or canvas component — the design rules | `build-studio` (with `build-feature`) |
| Ask for a change that is not your task or not your file | `recommend` |
| Review code · a built screen against its boards · security | `code-review-invana` · `design-qa` · `security-audit` |
| Plan · run · watch a project | `create-project` · `run-project` · `project-dashboard` |
| Hand off past the context budget | `handoff` |

## The team

Every new requirement starts as a spec in `specs/`, written by the product-manager. Each user story is a folder —
`story.md`, the source of truth, and `task.md`, where the designer, coder and QA each add the tasks they deliver it
by. Roles, edit rights, gates, lanes, projects and requests are [`.claude/team/TEAM.md`](.claude/team/TEAM.md) — every agent and collaborator
follows it. Each role edits only its own files (the matrix in `TEAM.md` §1, enforced by the `edit_rights` hook);
anything else goes through `recommend`. The product's words are `docs/for-developers/terminology.md` — code, UI copy
and docs follow it.

## Architecture

- **Monorepo**: `engine/` (Python 3.14 + FastAPI) + `studio/` (React 19 + TypeScript) + `integrations/` (connector packages)
- **Distribution**: `pip install invana` (core) + `pip install invana-neo4j` (per connector) + Docker images
- **CLI**: `invana start`, `invana migrate`, `invana version`

## Stack

| Part | Stack |
|---|---|
| Engine | Python 3.14 · FastAPI + uvicorn (async) · uv · Ruff · pytest + pytest-asyncio + pytest-cov · SQLAlchemy async (SQLite dev, PostgreSQL prod) · JWT + OAuth2/SSO |
| Studio | React 19 + Vite · pnpm · TailwindCSS 4 · `@invana/design-kit` (shadcn) · `@invana/canvas` (PixiJS 8, WebGPU + WebGL) · Zustand + TanStack Query · Biome · Vitest + Testing Library + Playwright · CodeMirror 6 |
| Integrations | `integrations/invana-{db}/` — an independent pip package each (neo4j, memgraph, arcadedb, janusgraph, neptune, tinkergraph), own `pyproject.toml`, `.venv` and tests, depending on `invana` |
| Infrastructure | GitHub Actions · pre-commit (ruff, biome, commitizen) · unified SemVer + CalVer tags · changesets · multi-target Dockerfile (engine, studio) on Docker Hub (`invana/engine`, `invana/studio`) · MkDocs Material |

## Supported graph databases

Cypher: Neo4j, Memgraph, ArcadeDB · Gremlin: JanusGraph, Amazon Neptune, TinkerGraph, ArcadeDB · Vector: a mixin for
databases with a vector index. What Invana does for its users is `README.md` › *Core features* and
`.claude/team/TEAM.md` §0.

## How to respond

**Default to sections and tables. Prose is the exception, not the format.**

| Rule | Detail |
|---|---|
| Structure | Answer in short sections with headings. Inside a section, prefer a table over sentences. |
| Length | Concise. No preamble, no recap of what was asked, no restating what a table already shows. |
| Explanations | Only when asked. Don't explain reasoning, trade-offs, or background unless the request calls for it ("why", "explain", "learn more"). |
| Prose | Use it only where a table genuinely can't carry the meaning — a real trade-off, a risk, a decision that needs a caveat. Then keep it to a line or two. |
| Design content | Once Ravi asks for a write, it belongs in the document, not the reply — write it to the feature file or module spec and point at it. Until then, the reply carries it. |
| Data shapes | Whenever describing entities, columns, endpoints, enums, or config — table it, so the structure is visible at a glance. |
| Diagrams | User flows and journeys get **mermaid** diagrams in the doc, not prose walkthroughs. |

## Design rules

Every screen and board is composed from `@invana/design-kit` and `@invana/canvas`, tokens only. A component the kit
lacks is built in design-kit first, with a story — never in `studio/`; only a Studio-only composition of `@invana/*` and
tokens may live in `@invana-studio/ui`. Graph rendering is `@invana/canvas` alone — no PixiJS code in Studio. The rules
are the `build-studio` skill; how a board is drawn is `design-story`.

## Rules

0. **Decisions live in documents.** A decision is written — by the product-manager, once Ravi asks — into the feature
   file or module spec it governs (its Decisions table, present tense, no history); a new feature gets its index row
   and its own file. There is no RFC tree.
1. **No code without complete implementation design decisions**, written down first (rule 0).
2. Always ask when in doubt.
3. make the development setup work across operating systems for seamless community developer contributions. 
4. Engine and Studio are built together, distributed flexibly (one image or separate).
5. Don't write too many tests, write few positive and negative tests, not soo many random tests.
6. Coverage target: 80% minimum for both engine and studio.
7. Don't mock the tests, unless asked, always test using graph databases.
8. Every user-facing change requires a changeset.
9. Studio UI components — **Design rules** above.
10. Graph rendering — **Design rules** above.
11. **Never commit, push or publish automatically.** Only when the current turn asks for it; an earlier ask never
    carries over, and finishing a task is not an ask.
12. **Short on columns, full on modules** — one-line column comments, full docstrings, no decision ids in code (`build-feature` §7).
13. **The backend owns every number** — the engine stores every metric when the fact settles; Studio formats, never derives (`build-feature` §7).
14. **`docs/` never names `.claude/`.** Nothing under `docs/` links to or cites a path in `.claude/` — no agent, skill, hook or team file. `docs/` describes the product; how the team builds it stays in `.claude/`.
15. **Say it once, simply (DRY · KISS).** Every rule, fact and procedure has one home — the file that owns it: this
    file routes, a skill holds its procedure, `TEAM.md` the team, `specs/` the product. Everywhere else links to that
    home and never restates it; two copies drift into two answers. Prefer the simplest thing that works — fewer files,
    rules and words; no layer, option or abstraction without a present need.

## Hand-off at 300k tokens

Every session and sub-agent has a **300k-token** context budget unless its brief or project phase sets another. Past
it, or once compacted, hand off with the **`/handoff` skill** — budgets, the runner and the 8-hand-off limit are in it.
