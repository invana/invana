# Invana Engine — Claude Context

Python service powering Invana. FastAPI + SQLAlchemy async + Alembic + uv + Ruff + pytest.

## Read first

- [`docs/system-design.md`](../docs/system-design.md) — platform-wide system design (vocabulary, Graphs, agents, knowledge graph flow) — orientation only; `for-developers/` is authoritative for scope. Applies to engine + studio + integrations.
- [`docs/for-developers/README.md`](../docs/for-developers/README.md) — the feature index and the authoritative scope. Read the feature's own file before editing what it covers.
- [`docs/for-developers/terminology.md`](../docs/for-developers/terminology.md) — the product's words. Code, routes and copy follow it.
- The container model: `User → Graph (1:1 connection)`. Graph-scoped URLs live under `/api/v1/u/{username}/{graphSlug}/...`; users carry a globally unique username.

## Stack

- **Python**: 3.14
- **Web**: FastAPI + uvicorn (async)
- **DB**: SQLAlchemy 2 async (asyncpg in prod, aiosqlite in dev); Alembic migrations.
- **Auth**: JWT (HS256) + bcrypt via `passlib`. `get_current_user` dependency on every Graph-scoped route.
- **Encryption at rest**: Fernet for `graphs.auth_encrypted` and `llm_providers.api_key_encrypted`. Single shared key in `INVANA_ENCRYPTION_KEY`.
- **Package manager**: `uv`. Don't use pip directly.
- **Lint/format**: Ruff. Run `uv run ruff check .` and `uv run ruff format .`.
- **Tests**: pytest + pytest-asyncio. Real DBs only (CLAUDE.md rule #7 — no mocking).

## Module layout

**[`docs/for-developers/building-engine/migration-plan.md`](../docs/for-developers/building-engine/migration-plan.md)
is authoritative** — the bands, the import rule, and how it is enforced. See
[`docs/system-design.md`](../docs/system-design.md) for platform vocabulary and flow.

The tree is **banded**, and the band is in the import path. A package may import from a lower band and
never upward:

```
src/invana/
  core/        0  settings · db · models (Base) · migrations · utils
               │  logging/ · telemetry/ · auth/ · events/
  graph/       1  the graph engine — connectors/ (cypher · gremlin) · types/ · loaders/
  apps/        2  one product idea each — graphs · modeller · canvases · explorer · datasets
               │  sessions · skills · agents · task_plans · work · projects · llm · llm_providers
               │  (`datasets` is the Dataset row and nothing else; loading lives in runtime/catalogue)
  runtime/     3  the workhorse — catalogue/ · interpreter/ + the planner and state files
  server/      4  FastAPI app · routes/ · admin/ · middleware        ─┐ two front-ends
  cli/         4  invana start · migrate · init · version · users …  ─┘ over the same code
```

`import-linter` enforces this in pre-commit and CI — three contracts in `pyproject.toml`
(`core is independent` · `bands` · `apps are acyclic`). A new violation means the map is wrong: change
`migration-plan.md` first.

> **`invana.graph` is the graph engine; `invana.apps.graphs` is the Graph a user creates.** Different
> bands, different depths. `invana.graph.connectors.*` is a **published API** — five pip packages
> import it and `connections.connector_class` stores the dotted path, so it does not move.

### Where new code goes

**Four roles inside a package, two at the edge** — see
[migration-plan §4](../docs/for-developers/building-engine/migration-plan.md#4-inside-a-package):

```
apps/<app>/
  models.py  schemas.py
  querysets/<model>.py      every select() · update() · delete()
  managers/<capability>.py  the rules, as classes — this is the Python API
server/<module>/
  routes.py   paths → views, no function bodies
  views.py    parse · call one manager · serialise
  admin.py    that module's starlette-admin ModelViews
```

`server/` and `cli/` are **peers**: two front-ends over the same managers, and calling a manager *is*
calling the Python API. Neither may hold a rule, run a query, emit an event, or commit — **the request
owns the transaction** (`get_session` commits on clean return).

Six greppable checks enforce this in `tests/golden/test_code_shape.py`, each with a named allow-list.
**Deleting an entry is how a conversion is finished**; adding one means the map is wrong, and
`migration-plan.md` changes first.

Still old-shape, and knowingly so: parts of `runtime/`, `server/datasets/views.py`, and
`server/routes/{models,model_links,schemas}.py`. Follow whichever shape the package you are editing
already has, and do not half-convert one in passing.

## Rules that apply here

From repo-root `CLAUDE.md`:

1. **No code without the decision written down.** A change to an existing feature updates that feature's file; a new feature gets an index row and a file, before any code.
2. **No mocking in tests.** Use a real graph DB (Neo4j / Memgraph / etc.) and a real Postgres / SQLite.
3. **Few, focused tests.** Coverage target ~80%; positive + negative cases, not exhaustive permutations.
4. **Every user-facing change needs a changeset.**

## Delete semantics

Hard deletes everywhere. Cascade flows **downward only** through ownership: `User → Graph → GraphConnection / GraphMember / Invitation / (future) datasets / skills / instructions / llm_providers / agents`. `Graph.created_by_id` uses ON DELETE RESTRICT — owner deletion is blocked while Graphs with other members remain (account-deletion guard B).

## Common commands

```bash
# Install — full dev env. `uv sync` is exact: a partial sync (missing --dev or
# an --extra) PRUNES previously-installed packages, surfacing later as an
# import error (fastapi / opentelemetry / httpx). See CONTRIBUTING.md → extras.
uv sync --dev --extra all

# Run dev server (also runs Alembic to head on startup)
uv run invana start

# Migrations
uv run invana migrate                       # apply
uv run alembic revision --autogenerate -m "..."

# Lint / format
uv run ruff check .
uv run ruff format .

# Tests
uv run pytest
uv run pytest -k "missions and create"
```

## Rules

- **Every new SQLAlchemy model gets a starlette-admin view.** Add a `ModelView` for it and register it under the appropriate `DropDown` section (Identity / Graphs / Agent bindings / Modeller / a new section if none fit). **Exclude sensitive columns from `fields`** — anything ending in `_encrypted`, `_hash`, or a raw token — so they are neither displayed nor editable. Mirror the existing patterns: `User.password_hash`, `GraphConnection.auth_encrypted`, `LLMProvider.api_key_encrypted` are all excluded.
  - They live in **`server/<module>/admin.py`**, beside the code they describe. `server/admin/` keeps only the `Admin()` mount, the `DropDown` sections, the auth provider and the templates — so *views* means one thing, an HTTP handler, rather than two.
- **Queries belong in a queryset; rules belong in a manager.** No `select()`/`update()`/`delete()` outside a `querysets` module, and no rule outside a `managers` one. Three exemptions, named in [migration-plan §4.1](../docs/for-developers/building-engine/migration-plan.md#41-the-two-guarantees): `graph/connectors/*/querysets/`, `core/migrations/versions/`, and a queryset's own body.
- **Managers raise `core.errors`, never `HTTPException`.** `NotFoundError` → 404, `ConflictError` → 409, `AuthenticationError` → 401, `PermissionDeniedError` → 403, `ValidationError` → 422, mapped once in `server/app.py`. A scoping refusal reads as **absent**, not forbidden — the caller must not learn an id exists.

## Don't

- Don't introduce soft-delete columns (`deleted_at`). Deletes are hard.
- Don't create per-table encryption keys; reuse `settings.encryption_key`.
- Don't bypass `get_current_user` on user-level routes or `require_graph_*` on graph-scoped routes.
- Don't change `graph_connections.connector_class` after the schema is auto-seeded (immutable).
- Don't rename SQLAlchemy table names without a fresh Alembic revision.
