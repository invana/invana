# Invana Engine — Claude Context

Python service powering Invana. FastAPI + SQLAlchemy async + Alembic + uv + Ruff + pytest.

## Read first

- [`docs/system-design.md`](../docs/system-design.md) — platform-wide system design (vocabulary, missions, agents, knowledge graph flow). Applies to engine + studio + integrations.
- [`docs/rfcs/`](../docs/rfcs/) — every non-trivial change has an RFC. Read the relevant RFC(s) before editing.
- Most recent architectural change: **RFC-012 — Mission-Centric Architecture**. Mission is now the top-level entity; everything else (graphs, schemas, skills, instructions, LLM configs, models) is mission-scoped.

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
  auth/          JWT, User, get_current_user
  missions/      Mission, MissionTag (top-level entity)
  graphs/        Graph + GraphConnectionManager (RFC-008)
  modeller/      GraphSchema and all schema/version/projection tables (RFC-002)
  skills/        Skill, Instruction, LLMProvider
  models_registry/  Model (logical models per mission)
  graph/         Connector protocol code (BaseConnector, OpenCypherConnector, GremlinConnector)
  server/        FastAPI app + routers + starlette-admin
  cli/           `invana start`, `invana migrate`, `invana load`
  telemetry/     OpenTelemetry
  logging/       structured logging
  db.py          async engine, session factory, get_session dep, run_migrations
  settings.py    pydantic-settings, env prefix INVANA_
```

## Rules that apply here

From repo-root `CLAUDE.md`:

1. **No code without an RFC.** Significant changes get a new RFC in `docs/rfcs/` first.
2. **No mocking in tests.** Use a real graph DB (Neo4j / Memgraph / etc.) and a real Postgres / SQLite.
3. **Few, focused tests.** Coverage target ~80%; positive + negative cases, not exhaustive permutations.
4. **Every user-facing change needs a changeset.**

## Delete semantics (mission-centric era)

Hard deletes everywhere. Cascade flows **downward only** through ownership: `User → Mission → graphs / graph_schemas / skills / instructions / llm_providers / models`. Lookup / association tables (e.g. `mission_tags`) never cascade upward into their parents. See RFC-012 § Delete Semantics for the full matrix.

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

## Don't

- Don't introduce soft-delete columns (`deleted_at`). Deletes are hard.
- Don't create per-table encryption keys; reuse `settings.encryption_key`.
- Don't bypass `get_current_user` on mission-scoped routes.
- Don't change `graphs.connector_class` after the schema is auto-seeded (immutable, RFC-008).
- Don't rename SQLAlchemy table names without a fresh Alembic revision.
