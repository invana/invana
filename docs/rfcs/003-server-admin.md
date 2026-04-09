# RFC-003: Server & Admin Module

> **Status**: Draft
> **Author**: Ravi Merugu
> **Created**: 2026-04-09
> **Updated**: 2026-04-09
> **Depends on**: RFC-002 (Graph Modeller)

## Summary

Add a `server` module to the engine that boots a FastAPI application and mounts a `starlette-admin` instance at `/admin`. The admin panel provides CRUD views for all modeller models (graph schemas, versions, node/edge types, properties, etc.) with zero custom UI code. A `/health` endpoint is also exposed for liveness/readiness probes.

## Motivation

- **No way to inspect app state.** The modeller stores schemas, versions, node types, edge types, and projections in PostgreSQL but there is no UI to browse or manage them outside of tests.
- **Studio is not ready yet.** The Studio modelling editor will eventually be the primary UI, but it doesn't exist. A generated admin panel bridges the gap at near-zero cost.
- **Operators need visibility.** In production, operators need to inspect schema versions, projection status, and database health without writing SQL.
- **If we don't do this.** Developers must use `psql` or write throwaway scripts to inspect and fix modeller state during development.

## Design

### Module Location

```
engine/src/invana/server/
```

### Directory Structure

```
server/
├── __init__.py
├── app.py              # FastAPI app factory: create_app()
├── health.py           # GET /health endpoint
└── admin/
    ├── __init__.py
    └── views.py        # starlette-admin ModelView registrations
```

### App Factory (`app.py`)

```python
from fastapi import FastAPI
from invana.settings import settings
from invana.server.health import health_router
from invana.server.admin import mount_admin


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
    )
    app.include_router(health_router)
    mount_admin(app)
    return app
```

- The factory creates the async DB engine on startup via a lifespan handler.
- Alembic migrations run during lifespan startup (via `create_db_engine()`).
- The engine and session factory are stored on `app.state` for use by routers.

### Lifespan

```python
from contextlib import asynccontextmanager
from invana.modeller.database import create_db_engine, create_session_factory

@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = await create_db_engine(settings.database_url)
    app.state.db_engine = engine
    app.state.db_session_factory = create_session_factory(engine)
    yield
    await engine.dispose()
```

### Health Endpoint (`health.py`)

```
GET /health
```

Response `200 OK`:
```json
{
  "status": "healthy",
  "app_name": "Invana",
  "version": "0.0.0",
  "database": "connected"
}
```

Response `503 Service Unavailable` (if DB is unreachable):
```json
{
  "status": "unhealthy",
  "app_name": "Invana",
  "version": "0.0.0",
  "database": "disconnected"
}
```

The health endpoint tests the database connection with a `SELECT 1` query.

### Admin Panel (`admin/`)

Uses `starlette-admin`'s SQLAlchemy contrib to auto-generate CRUD views.

```python
from starlette_admin.contrib.sqla import Admin, ModelView
from invana.modeller.models import (
    GraphSchema, SchemaVersion, NodeTypeDefinition,
    EdgeTypeDefinition, PropertyDefinition, ValidationRule,
    IndexDefinition, SchemaProjection,
)


class GraphSchemaView(ModelView):
    fields = ["id", "name", "description", "validation_mode", "created_at", "updated_at"]
    search_fields = ["name"]


class SchemaVersionView(ModelView):
    fields = ["id", "schema_id", "version", "status", "change_summary", "created_at", "activated_at"]
    search_fields = ["version", "status"]


# ... similar views for other models


def mount_admin(app):
    from sqlalchemy import create_engine
    from invana.settings import settings

    # starlette-admin requires a sync engine for its SQLAlchemy integration
    sync_url = settings.database_url.replace("+asyncpg", "")
    sync_engine = create_engine(sync_url)

    admin = Admin(
        sync_engine,
        title="Invana Admin",
        base_url="/admin",
    )
    admin.add_view(GraphSchemaView(GraphSchema))
    admin.add_view(SchemaVersionView(SchemaVersion))
    admin.add_view(ModelView(NodeTypeDefinition))
    admin.add_view(ModelView(EdgeTypeDefinition))
    admin.add_view(ModelView(PropertyDefinition))
    admin.add_view(ModelView(ValidationRule))
    admin.add_view(ModelView(IndexDefinition))
    admin.add_view(ModelView(SchemaProjection))
    admin.mount_to(app)
```

**Note:** `starlette-admin` requires a synchronous SQLAlchemy engine. The sync URL is derived from the async URL by stripping `+asyncpg`. This sync engine is used only by the admin panel; all application code continues to use the async engine.

### Dependencies

Added to `[project.optional-dependencies] server`:

```toml
server = [
    "fastapi>=0.115",
    "uvicorn>=0.34",
    "pydantic-settings>=2.13.1",
    "starlette-admin>=0.16",
    "psycopg2-binary>=2.9",       # sync driver for starlette-admin
]
```

`starlette-admin` and `psycopg2-binary` are server-only deps — integrations and library users don't pull them in.

### CLI Entry Point

```bash
# Development
uvicorn invana.server.app:create_app --factory --reload --host 127.0.0.1 --port 8200

# Via Makefile
make dev
```

The `invana start` CLI command (future) will call `create_app()` and run uvicorn programmatically.

### URL Map

| Path | Description |
|------|-------------|
| `GET /health` | Liveness/readiness probe |
| `/admin/` | Admin dashboard (starlette-admin) |
| `/admin/{model}/list` | Model list view |
| `/admin/{model}/create` | Model create form |
| `/admin/{model}/detail/{pk}` | Model detail view |
| `/admin/{model}/edit/{pk}` | Model edit form |

Future RFCs will add API routers under `/api/v1/`.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| SQLAdmin | Simpler, SQLAlchemy-only | Less flexible, fewer features | starlette-admin has broader backend support and better custom view support for future needs |
| Custom FastAPI CRUD endpoints | Full control | Significant effort for basic CRUD | Premature — Studio will be the real UI; admin is a bridge |
| Django Admin (separate app) | Very mature | Requires Django ORM, separate process, doesn't share models | Incompatible with async SQLAlchemy stack |

## Security Considerations

- **No authentication** in this initial version. The admin panel is open. This is acceptable for local development.
- Before any deployment, admin must be gated behind auth (future RFC) or restricted to internal networks.
- `psycopg2-binary` is used for convenience; production can switch to `psycopg2` compiled from source if needed.

## Performance Considerations

- The sync engine used by starlette-admin is independent from the async engine used by application code. No performance interaction.
- Health endpoint should respond in <10ms (single `SELECT 1`).
- Admin panel is for low-traffic management, not high-throughput APIs.

## Open Questions

- [ ] Should the admin be behind a feature flag (`INVANA_ADMIN_ENABLED=true`) or always mounted when running the server?
- [ ] Should we add `psycopg` (async-capable v3) instead of `psycopg2-binary` to have a single sync+async driver?

## Implementation Plan

1. [ ] Add `starlette-admin` and `psycopg2-binary` to server extras
2. [ ] Create `server/app.py` with app factory + lifespan
3. [ ] Create `server/health.py` with health endpoint
4. [ ] Create `server/admin/views.py` with ModelView registrations
5. [ ] Add `make dev` / uvicorn command to Makefile
6. [ ] Write tests for health endpoint
7. [ ] Write tests for admin mount (smoke test)

## References

- [starlette-admin docs](https://jowilf.github.io/starlette-admin/)
- [starlette-admin SQLAlchemy integration](https://jowilf.github.io/starlette-admin/tutorials/basic/SQLAlchemy/)
- [FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/#lifespan)
- RFC-002: Graph Modeller (data model)
