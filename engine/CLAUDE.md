# Invana Engine — Claude Context

Python service powering Invana. FastAPI + SQLAlchemy async + Alembic + uv + Ruff + pytest.

## Read first

- [`docs/system-design.md`](../docs/system-design.md) — platform-wide system design (vocabulary, missions, agents, knowledge graph flow). Applies to engine + studio + integrations.
- [`docs/rfcs/`](../docs/rfcs/) — every non-trivial change has an RFC. Read the relevant RFC(s) before editing.
- Most recent architectural change: **RFC-017 — Graph as the Primary Container** (partially supersedes RFC-012). `User → Graph (1:1 GraphConnection)` is the new container model. Mission is removed as an entity; its fields fold onto `Graph`. All graph-scoped URLs live under `/api/v1/u/{username}/{slug}/...`. Users carry a globally unique `username`.

## Stack

- **Python**: 3.14
- **Web**: FastAPI + uvicorn (async)
- **DB**: SQLAlchemy 2 async (asyncpg in prod, aiosqlite in dev); Alembic migrations.
- **Auth**: JWT (HS256) + bcrypt via `passlib`. `get_current_user` dependency on every mission-scoped route.
- **Encryption at rest**: Fernet for `graphs.auth_encrypted` and `llm_providers.api_key_encrypted`. Single shared key in `INVANA_ENCRYPTION_KEY`.
- **Package manager**: `uv`. Don't use pip directly.
- **Lint/format**: Ruff. Run `uv run ruff check .` and `uv run ruff format .`.
- **Tests**: pytest + pytest-asyncio. Real DBs only (CLAUDE.md rule #7 — no mocking).

## Module layout

See [`docs/system-design.md`](../docs/system-design.md) for platform vocabulary and flow. Quick engine orientation:

```
src/invana/
  auth/          JWT, User (with username), get_current_user, RefreshToken (Layer 1)
  graphs/        Graph (container) + GraphConnection (1:1) + GraphMember + Invitation
                 + GraphConnectionManager (RFC-008) + graph-scoped deps/services/routes
  modeller/      GraphSchema and all schema/version/projection tables (RFC-002)
  graph/         Connector protocol code (BaseConnector, OpenCypherConnector, GremlinConnector)
  server/        FastAPI app + routers + starlette-admin
  cli/           `invana start`, `invana migrate`, `invana init`, `invana version`
  telemetry/     OpenTelemetry
  logging/       structured logging
  db.py          async engine, session factory, get_session dep, run_migrations
  settings.py    pydantic-settings, env prefix INVANA_
```

Graph-scoped modules already shipped beyond `graphs/` itself: `llm_providers/` (S4 — RFC-017/§2.6), `skills/` + `instructions/` (S5 — §2.4/§2.5).

Future modules (per `docs/internal/mvp.md`): `datasets/`, `stitcher/`, `agents/` — all graph-scoped.

## Rules that apply here

From repo-root `CLAUDE.md`:

1. **No code without an RFC.** Significant changes get a new RFC in `docs/rfcs/` first.
2. **No mocking in tests.** Use a real graph DB (Neo4j / Memgraph / etc.) and a real Postgres / SQLite.
3. **Few, focused tests.** Coverage target ~80%; positive + negative cases, not exhaustive permutations.
4. **Every user-facing change needs a changeset.**

## Delete semantics (RFC-017 era)

Hard deletes everywhere. Cascade flows **downward only** through ownership: `User → Graph → GraphConnection / GraphMember / Invitation / (future) datasets / skills / instructions / llm_providers / agents`. `Graph.created_by_id` uses ON DELETE RESTRICT — owner deletion is blocked while Graphs with other members remain (account-deletion guard B). See RFC-012 § Delete Semantics for the legacy matrix (still applicable for non-Graph FK choices).

## Common commands

```bash
# Install
uv sync

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

- **Every new SQLAlchemy model gets a starlette-admin view.** When you add a new model (in any module — `graphs/`, `llm_providers/`, `skills/`, `instructions/`, future `datasets/` / `agents/` / etc.), also add a `ModelView` for it in `src/invana/server/admin/views.py` and register it under the appropriate `DropDown` section (Identity / Graphs / Agent bindings / Modeller / new section if none fit). Exclude sensitive columns from `fields` (anything ending in `_encrypted`, `_hash`, or a raw token) so they aren't displayed or editable. Mirror the existing patterns: `User.password_hash`, `Invitation.token_hash`, `GraphConnection.auth_encrypted`, `LLMProvider.api_key_encrypted` are all excluded.

## Don't

- Don't introduce soft-delete columns (`deleted_at`). Deletes are hard.
- Don't create per-table encryption keys; reuse `settings.encryption_key`.
- Don't bypass `get_current_user` on user-level routes or `require_graph_*` on graph-scoped routes.
- Don't change `graph_connections.connector_class` after the schema is auto-seeded (immutable, RFC-008).
- Don't rename SQLAlchemy table names without a fresh Alembic revision.
