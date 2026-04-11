# RFC-008: Graphs & Query API

**Status**: Draft  
**Author**: Invana Team  
**Date**: 2026-04-10

---

## Problem

The engine has connectors (`BaseConnector`, `OpenCypherConnector`, `GremlinConnector`) and a modeller
(`GraphSchema`, `Introspector`, `Projector`) but no way to:

1. **Persist** graph database connection details (URI, credentials, connector class) in the
   app-state database.
2. **Manage** a live connector pool at runtime — keep connections open, health-check them, and
   recover them after failures.
3. **Tie a connection to its schema** — so introspection and projection always operate on the
   right database.
4. **Execute raw queries** against a connected database over HTTP — essential for Studio's query
   editor and for operators who need direct access to the graph without a separate DB client.

---

## Goals

1. `Graph` entity persisted in the app-state DB with encrypted credentials.
2. `GraphConnectionManager` singleton that owns live connector instances and auto-recovers on failure.
3. 1:1 `Graph → GraphSchema` — creating a Graph auto-seeds the schema via introspection.
4. Full CRUD REST API for graphs plus introspect/project/reconnect operations.
5. `POST /api/v1/graphs/{id}/query` — raw Cypher or Gremlin execution with optional
   read-only guard.
6. Search API (structural AST queries) is **not in scope** — see RFC-009.

---

## Design

### Data Model

#### `Graph`

```
graphs
───────────────────────────────────────────────────────────
id              String(36) PK    UUID
name            String(255)      human-readable label
description     Text             optional notes
uri             String(2048)     e.g. bolt://localhost:7687
connector_class String(512)      dotted path, e.g. invana_neo4j.Neo4jConnector
auth_encrypted  LargeBinary      Fernet-encrypted JSON {username, password, ...}
read_only       Boolean          default False
status          Enum             CONNECTING | ACTIVE | ERROR | INACTIVE
schema_id       String(36) FK→graph_schemas.id  nullable, UNIQUE (1:1)
last_health_check_at  DateTime   nullable
latency_ms      Integer          nullable — last round-trip time in ms
created_at      DateTime
updated_at      DateTime
```

The `UNIQUE` constraint on `schema_id` enforces the 1:1 relationship at the database level.
A `Graph` row owns its `GraphSchema` — deleting a Graph archives (soft-deletes) the
linked schema.

**Relationship flow:**

```
Graph (1) ──owns──▶ (1) GraphSchema
                                │
                    ┌───────────┘
                    ▼
             SchemaVersion (draft → active → archived)
             NodeTypeDefinition, EdgeTypeDefinition, …
```

#### Status lifecycle

```
         create
           │
           ▼
       CONNECTING ──▶ ACTIVE ──▶ INACTIVE (manual disable)
           │             │
           └──────┬──────┘
                  │ failure
                  ▼
               ERROR ──▶ (backoff retry) ──▶ CONNECTING
```

---

### Module Structure

```
engine/src/invana/graphs/
├── __init__.py          # re-exports Graph, GraphModelStore, GraphConnectionManager
├── models.py            # SQLAlchemy async model (Graph)
├── schemas.py           # Pydantic request/response models
├── store.py             # GraphModelStore — async CRUD
├── manager.py           # GraphConnectionManager — live connector registry
└── encryption.py        # Fernet encrypt/decrypt helpers
```

> Note: The module is named `graphs/` (plural) to avoid collision with the existing
> `graph/` module which contains the connector infrastructure (querysets, serializers, etc.).

---

### Encryption

Credentials (`username`, `password`, and any extra auth fields) are serialised to JSON and
encrypted with [Fernet symmetric encryption](https://cryptography.io/en/latest/fernet/) before
being stored in `auth_encrypted`.

```python
# encryption.py
def encrypt_credentials(data: dict) -> bytes: ...
def decrypt_credentials(data: bytes) -> dict: ...
```

The key is read from `settings.INVANA_ENCRYPTION_KEY` (32-byte URL-safe base64, required).
Credentials are **never** returned in API responses.

---

### GraphConnectionManager

A single `GraphConnectionManager` instance is stored on `app.state` during the FastAPI lifespan.
It is the only place in the codebase that holds live connector instances — `GraphModelStore` handles
persistence, `GraphConnectionManager` handles runtime.

**Responsibilities:**

| Responsibility | Detail |
|---|---|
| Startup | Load all non-`INACTIVE` graphs from DB; call `connector.connect()` |
| Registry | `dict[str, BaseConnector]` keyed by `graph.id` |
| `get_connector(id)` | Returns live connector or raises `GraphUnavailableError` (→ HTTP 503) |
| `register(graph)` | Connect a newly created graph and add to registry |
| `deregister(graph_id)` | Disconnect and remove from registry (on delete/disable) |
| `reconnect(graph)` | Disconnect existing + reconnect with fresh config (on PATCH) |
| Health loop | Background asyncio task; pings each `ACTIVE` connector every 30 s; updates `last_health_check_at` and `latency_ms` |
| Recovery | On connect failure: mark `status=ERROR`; retry with exponential backoff (1 s → 2 s → 4 s … 60 s cap); flip back to `ACTIVE` on success |
| Auto-introspect | On first successful connect with `graph.schema_id IS NULL`: run `Introspector` → create `GraphSchema` + `SchemaVersion(status=draft)` → set `graph.schema_id` |
| Shutdown | Call `connector.disconnect()` on all active connectors |

---

### API Surface

All endpoints are mounted under `/api/v1/`. Credentials are write-only — they appear in
`GraphCreate` but never in any response model.

#### Graph CRUD

```
POST   /api/v1/graphs               Create graph (triggers connect + auto-introspect)
GET    /api/v1/graphs               List all graphs
GET    /api/v1/graphs/{id}          Get single graph
PATCH  /api/v1/graphs/{id}          Update (reconnects if URI/auth changed)
DELETE /api/v1/graphs/{id}          Disconnect + archive schema + soft-delete
```

#### Graph Actions

```
POST   /api/v1/graphs/{id}/reconnect    Manual re-enable from ERROR or INACTIVE
POST   /api/v1/graphs/{id}/introspect   Re-run introspection → new SchemaVersion(draft)
POST   /api/v1/graphs/{id}/project      Push active SchemaVersion DDL to graph DB
```

#### Request / Response Shapes

**`POST /api/v1/graphs` — create**

```json
// Request (GraphCreate)
{
  "name": "Production Neo4j",
  "description": "Main production graph DB",
  "uri": "bolt://prod-neo4j:7687",
  "connector_class": "invana_neo4j.Neo4jConnector",
  "auth": { "username": "neo4j", "password": "secret" },
  "read_only": false
}

// Response 201 (GraphRead) — no credentials
{
  "id": "uuid",
  "name": "Production Neo4j",
  "description": "Main production graph DB",
  "uri": "bolt://prod-neo4j:7687",
  "connector_class": "invana_neo4j.Neo4jConnector",
  "read_only": false,
  "status": "CONNECTING",
  "schema_id": null,
  "last_health_check_at": null,
  "latency_ms": null,
  "created_at": "2026-04-10T10:00:00Z",
  "updated_at": "2026-04-10T10:00:00Z"
}
```

Graph is created synchronously; the actual `connector.connect()` and auto-introspect
run in a background task. `status` starts as `CONNECTING` and transitions to `ACTIVE` (or
`ERROR`) asynchronously. Poll `GET /api/v1/graphs/{id}` to observe the transition.

**`GET /api/v1/graphs` — list**

```json
// Response 200
{
  "items": [ { ...GraphRead... } ],
  "total": 3
}
```

**`DELETE /api/v1/graphs/{id}`**

```json
// Response 204 No Content
```

Soft-deletes the graph row, sets `GraphSchema.status = archived` on the linked schema,
calls `connector.disconnect()`.

---

#### Query API

```
POST /api/v1/graphs/{id}/query
```

Execute a raw Cypher or Gremlin query against the connected database.

**Request (`QueryRequest`)**

```json
{
  "query": "MATCH (n:Person) WHERE n.age > 30 RETURN n LIMIT 50",
  "parameters": { "limit": 50 },
  "timeout_ms": 5000
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `query` | string | ✓ | — | Raw Cypher or Gremlin string |
| `parameters` | dict | — | `{}` | Named parameters passed to the driver |
| `timeout_ms` | int | — | `10000` | Query-level timeout |

**Write guard (read-only graphs)**

If `graph.read_only = true`, the engine inspects the query string for write keywords before
sending to the driver:

```
Cypher:  CREATE  MERGE  SET  DELETE  REMOVE  DROP  DETACH
Gremlin: addV    addE   property  drop  inject
```

If any keyword is found → `400 Bad Request` with `{ "error": "read_only_violation", "detail": "..." }`.
This is a best-effort guard, not a DB-level permission.

**Response (`QueryResponse`)**

```json
{
  "result_type": "graph",
  "query_language": "cypher",
  "data": [
    { "type": "vertex", "id": "1", "label": "Person", "properties": { "age": 35, "name": "Alice" } }
  ],
  "rows": null,
  "execution_time_ms": 42,
  "row_count": 1
}
```

| Field | Type | Notes |
|---|---|---|
| `result_type` | `"graph"` \| `"tabular"` | `graph` if data could be deserialised into `Vertex`/`Edge`; `tabular` for scalar/aggregation results |
| `query_language` | `"cypher"` \| `"gremlin"` | Determined from `connector.query_language` |
| `data` | `list[Vertex \| Edge \| Path]` \| null | Populated when `result_type = graph` |
| `rows` | `list[dict]` \| null | Populated when `result_type = tabular` |
| `execution_time_ms` | int | Wall-clock time for the driver call |
| `row_count` | int | Total rows/items returned |

**Error responses**

| Condition | HTTP | `error` code |
|---|---|---|
| Graph not found | 404 | `graph_not_found` |
| Graph not ACTIVE | 503 | `graph_unavailable` |
| Read-only violation | 400 | `read_only_violation` |
| Query execution failure | 422 | `query_execution_error` |
| Timeout | 504 | `query_timeout` |

---

### Settings

| Setting | Default | Description |
|---|---|---|
| `INVANA_ENCRYPTION_KEY` | — | **Required.** Fernet key (32-byte URL-safe base64) for credential encryption |
| `INVANA_GRAPH_HEALTH_INTERVAL_S` | `30` | Seconds between health-check pings |
| `INVANA_GRAPH_RETRY_MAX_INTERVAL_S` | `60` | Cap for exponential backoff retry interval |

---

### Storage & Migrations

- New table: `graphs` in the app-state DB (SQLite dev / PostgreSQL prod).
- New Alembic migration under `engine/src/invana/modeller/migrations/versions/`.
- No changes to existing modeller tables — `GraphConnectionManager` creates `GraphSchema` rows via
  the existing `SchemaStore`.

---

### Wiring

1. `settings.py` — add `INVANA_ENCRYPTION_KEY` and health/retry settings.
2. `server/app.py` lifespan — on startup call `GraphConnectionManager.startup()`; on shutdown call
   `GraphConnectionManager.shutdown()`.
3. `server/app.py` — register `graphs_router` and `query_router` under `/api/v1/`.
4. `pyproject.toml` — add `cryptography>=42` to core deps.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Store credentials in external secrets manager (Vault) | Industry best practice | Heavy operational dependency, complex dev setup | Deferred — plan to add as opt-in `credentials_backend` setting later |
| On-demand connect per request (no pool) | Simpler, no background tasks | High latency per request, no auto-recovery | Performance unacceptable for interactive Studio queries |
| N:1 graph → schema (shared schema) | Schema reuse across environments | Hard to reason about which DB owns which schema; introspect/project ambiguity | 1:1 maps cleanly: one DB, one schema, no confusion |
| Sub-path search URL (`/graphs/{id}/search`) | RESTfully grouped under graph | Chosen for Search RFC-009 separately | Out of scope here |

---

## Security Considerations

- Credentials are Fernet-encrypted at rest; the key is never logged or returned in responses.
- `INVANA_ENCRYPTION_KEY` must be treated as a secret (injected via env var, not config file).
- The read-only guard on the Query API is advisory — it prevents accidental writes but is not a
  substitute for DB-level permissions. Operators should provision read-only DB users for
  `read_only=true` graphs.
- Query parameters are passed to the native driver (not interpolated into strings), preventing
  injection via `parameters`.
- Direct string query construction (user-supplied `query` string) is intentional for the Query
  API — it is a power-user feature equivalent to a DB console. Access should be protected behind
  authentication (RFC-003 auth layer).

---

## Performance Considerations

- Persistent connector pool means no TCP handshake overhead per query.
- Health-check loop is low-frequency (30 s default) and non-blocking.
- Encryption/decryption of credentials only happens at `startup()` and on graph create/update
  — not on the hot path.
- Timeout is enforced at the driver level via `timeout_ms` — prevents slow queries from blocking
  the event loop indefinitely.

---

## Resolved Decisions

- **`DELETE /graphs/{id}`**: soft-delete — graph row marked `INACTIVE`, linked
  `GraphSchema` status set to `archived`. Reversible via `POST /graphs/{id}/reconnect`.
- **`PATCH /graphs/{id}` + `connector_class`**: `connector_class` is immutable once a schema
  has been auto-seeded. Attempts to change it return `409 Conflict` with
  `{ "error": "connector_class_immutable" }`. To switch DB type, delete the graph and create
  a new one.
- **`INVANA_ENCRYPTION_KEY` rotation**: deferred to a future RFC. Noted as a known gap — rotating
  the key requires re-encrypting all `auth_encrypted` rows.

---

## Implementation Plan

1. [ ] Add `INVANA_ENCRYPTION_KEY` and related settings to `settings.py`
2. [ ] Create `graphs/encryption.py` — Fernet helpers + tests
3. [ ] Create `graphs/models.py` — SQLAlchemy `Graph` model
4. [ ] Create `graphs/schemas.py` — Pydantic request/response models (`GraphCreate`, `GraphUpdate`, `GraphRead`)
5. [ ] Create `graphs/store.py` — `GraphModelStore` CRUD
6. [ ] Create `graphs/manager.py` — `GraphConnectionManager` with health loop + backoff retry
7. [ ] Wire auto-introspect into Graph startup flow
8. [ ] Write Alembic migration for `graphs` table
9. [ ] Create `server/routes/graphs.py` — CRUD + action endpoints
10. [ ] Create `server/routes/query.py` — raw query endpoint
11. [ ] Register routers + wire lifespan in `server/app.py`
12. [ ] Write tests: `engine/tests/graphs/` (create, encrypt/decrypt, connect, auto-introspect, backoff, read-only guard, query execution)
13. [ ] Update user-facing docs

## Follow-up (separate PR)

- [ ] Rename `SchemaStore` → `SchemaModelStore` in `engine/src/invana/modeller/store.py` and all
  call sites — for naming consistency with `GraphModelStore`. Not in scope for this RFC to keep
  the diff focused.

---

## References

- [RFC-001 — Graph Connectors](001-graph-connectors.md): `BaseConnector`, `OpenCypherConnector`, `GremlinConnector`
- [RFC-002 — Graph Modeller](002-graph-modeller.md): `GraphSchema`, `SchemaModelStore` (née `SchemaStore`), `Introspector`, `Projector`
- [RFC-003 — Server & Admin](003-server-admin.md): FastAPI app factory, lifespan pattern
- RFC-009 (planned): Search API — structural AST queries over graphs
- [cryptography — Fernet](https://cryptography.io/en/latest/fernet/)
