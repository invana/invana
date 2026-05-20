# RFC-012: Mission-Centric Architecture

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-05-20

---

## Problem

Invana today is **graph-connection-centric**. A user lands on `/graphs`, creates a connection, and only then can model or explore. The connection is the top-level entity in both the engine (`Graph`, `GraphSchema`) and Studio (`GraphsListPage`). There is no notion of a user, no notion of a mission or goal, no grouping above a single graph, and no auth at all.

This blocks every direction the product needs to go:

1. A graph database is **infrastructure**, not a goal. Users start with intent ("understand this codebase", "audit this architecture", "model this domain") — not with picking a database.
2. **Multi-model workflows** (concept model, code model, architecture model, domain model) have nowhere to live. Each is a slice of a graph DB with its own schema, skills, and queries, but the engine has no parent entity to group them under.
3. **LLM and agent features** (RFC-014, planned) need a stable context object to attach skills, instructions, and provider config to. Attaching them to a graph connection is the wrong abstraction.
4. **Multi-tenancy** (even a single-user-per-tenant model) needs a User and an ownership relationship before anything else can be safely partitioned.

This RFC inverts the model: a **Mission** becomes the top-level entity. Users, graph connections, schemas, skills, instructions, LLM configs, and logical models all hang off a Mission.

---

## Goals

1. Introduce **User** + JWT authentication as a first-class concern. All API surface (except `/auth/*`) requires a valid token.
2. Introduce **Mission** as the top-level entity owned by a User. A Mission carries intent: `name`, `description`, `objectives`, `success_criteria`, `tags`, `status`.
3. Re-parent the existing **Graph** and **GraphSchema** entities under Mission. Existing connector / schema / projection machinery is reused unchanged.
4. Add **Skill**, **Instruction**, and **LLMProvider** entities scoped to a Mission. Skills and Instructions are markdown-content rows in Postgres — no filesystem.
5. Add a **Model** registry (logical models: `concept` | `code` | `architecture` | `domain` | `custom`). Each Model optionally links to a `GraphSchema` and tags a subgraph in the underlying graph DB via `subgraph_label`.
6. Define **delete semantics** explicitly: hard deletes, cascade downward only, no upward cascade from lookup/association tables.
7. Move the entire HTTP surface from flat `/api/v1/graphs/*` to `/api/v1/missions/{mid}/...`.
8. Studio mirrors the redesign: `/missions` replaces `/graphs` as the entry route; existing modeller and explorer pages become children of a Mission.
9. Breaking change. Alembic history is reset on the `arch/redesign` branch; the previous schema is not preserved.

**Non-goals (deferred to follow-up RFCs):**

- Code / git repository import → graph DB (RFC-013).
- LLM agent runtime that consumes Skills + Instructions + LLM provider config (RFC-014).
- Auto-generation of Models from imported sources (RFC-015).
- Org / team sharing of Missions (post-1.0).
- Soft deletes / trash / undo.
- Ontology / semantics layer.

---

## Design

### Data Model

#### `users`

```
users
──────────────────────────────────────────────────────
id              UUID PK
email           String(320)    UNIQUE NOT NULL
password_hash   String(255)    NOT NULL    (bcrypt)
name            String(255)    nullable
is_active       Boolean        NOT NULL default True
created_at      DateTime
updated_at      DateTime
```

#### `missions`

```
missions
──────────────────────────────────────────────────────
id              UUID PK
owner_id        UUID FK → users.id     ON DELETE CASCADE
name            String(255)            NOT NULL
slug            String(255)            NOT NULL
description     Text                   nullable
objectives      Text                   nullable    (markdown / free-form)
success_criteria Text                  nullable    (markdown / free-form)
status          Enum                   active | archived       default active
created_at      DateTime
updated_at      DateTime

UNIQUE (owner_id, slug)
```

`slug` is unique **per owner**, not globally — so two users can each have a `code-review` mission without colliding.

#### `mission_tags`

```
mission_tags
──────────────────────────────────────────────────────
mission_id      UUID FK → missions.id  ON DELETE CASCADE
tag             String(64)             NOT NULL
PRIMARY KEY (mission_id, tag)
```

Flat tag set, no global `tags` table. Deleting a `mission_tags` row only severs the association.

#### `graphs` (modified)

Adds `mission_id` (required) to the existing `Graph` model from RFC-008. All other fields unchanged.

```
graphs
──────────────────────────────────────────────────────
id              UUID PK
mission_id      UUID FK → missions.id  ON DELETE CASCADE   -- new, NOT NULL
name            String(255)
description     Text
uri             String(2048)
connector_class String(512)
auth_encrypted  LargeBinary
read_only       Boolean
status          Enum (CONNECTING | ACTIVE | ERROR | INACTIVE)
schema_id       UUID FK → graph_schemas.id  ON DELETE RESTRICT
last_health_check_at  DateTime
latency_ms      Integer
created_at      DateTime
updated_at      DateTime
```

`schema_id`'s `ON DELETE RESTRICT` means deleting a schema requires deleting the graph first (or going through the Mission cascade). This protects schema history from accidental graph removal.

#### `graph_schemas` (modified)

Adds `mission_id`. Existing schema/version/property/edge/node tables from RFC-002 are unchanged structurally but inherit the cascade from `graph_schemas`.

#### `llm_providers`

```
llm_providers
──────────────────────────────────────────────────────
id                  UUID PK
mission_id          UUID FK → missions.id  ON DELETE CASCADE
provider            Enum   anthropic | openai | google | azure | local
model_id            String(128)            NOT NULL   -- e.g. claude-opus-4-7
api_key_encrypted   LargeBinary            NOT NULL   -- Fernet, reuses graphs encryption key
base_url            String(2048)           nullable   -- optional custom endpoint
is_default          Boolean                default False
created_at          DateTime
updated_at          DateTime
```

Only one provider per Mission may have `is_default = true`. Enforced in service layer, not via partial unique index (Postgres-specific, and we use SQLite in dev).

#### `skills`

```
skills
──────────────────────────────────────────────────────
id              UUID PK
mission_id      UUID FK → missions.id  ON DELETE CASCADE
name            String(128)            NOT NULL
description     Text                   nullable
content         Text                   NOT NULL       -- markdown body
is_enabled      Boolean                default True
sort_order      Integer                default 0
created_at      DateTime
updated_at      DateTime

UNIQUE (mission_id, name)
```

#### `instructions`

```
instructions
──────────────────────────────────────────────────────
id              UUID PK
mission_id      UUID FK → missions.id  ON DELETE CASCADE
kind            Enum    general | role | constraint | format    default general
content         Text                   NOT NULL       -- markdown body
sort_order      Integer                default 0
created_at      DateTime
updated_at      DateTime
```

A Mission can have many `instructions` rows. The Studio UI may concatenate them (sorted by `sort_order`, grouped by `kind`) into a single virtual `instructions.md` view.

#### `models`

The **logical model registry** — Postgres-side metadata describing a slice of the attached graph DB.

```
models
──────────────────────────────────────────────────────
id              UUID PK
mission_id      UUID FK → missions.id  ON DELETE CASCADE
model_type      Enum    concept | code | architecture | domain | custom
name            String(255)            NOT NULL
description     Text                   nullable
schema_id       UUID FK → graph_schemas.id  ON DELETE SET NULL    nullable
subgraph_label  String(128)            nullable
                                       -- tag stamped on nodes/edges in the graph DB
                                       -- that belong to this model
source          Enum    manual | import | generated     default manual
status          Enum    draft | active | archived       default draft
metadata        JSONB                  nullable
created_at      DateTime
updated_at      DateTime

UNIQUE (mission_id, model_type, name)
```

`schema_id` is nullable because a Model may exist before it has a formal schema (e.g. a `concept` model sketched at mission setup, with the schema generated later). Deleting a schema sets it to NULL on Models — the Model record survives unlinked.

### Delete Semantics

All deletes are **hard deletes** (no `deleted_at` flags). Cascade flows strictly downward through ownership; lookup / association tables never propagate upward.

| Parent | Child | `ON DELETE` |
|---|---|---|
| `users` | `missions` | `CASCADE` |
| `missions` | `mission_tags` | `CASCADE` |
| `missions` | `graphs` | `CASCADE` |
| `missions` | `graph_schemas` | `CASCADE` |
| `missions` | `llm_providers` | `CASCADE` |
| `missions` | `skills` | `CASCADE` |
| `missions` | `instructions` | `CASCADE` |
| `missions` | `models` | `CASCADE` |
| `graphs` | `graph_schemas` (`schema_id`) | `RESTRICT` |
| `graph_schemas` | `schema_versions`, `property_key_definitions`, `node_type_definitions`, `edge_type_definitions`, `type_property_mappings`, `validation_rules`, `constraint_definitions`, `index_definitions`, `schema_projections` | `CASCADE` |
| `graph_schemas` | `models.schema_id` | `SET NULL` |

**Invariant: no upward cascade.** Anything that looks like a lookup or association (tags today, future enum-like tables) is modeled either as inline columns or as a join table whose deletion only severs the link.

### Authentication

JWT bearer tokens, HS256, secret read from `settings.secret_key` (already declared, currently unused). Two tokens: short-lived access (15 min) + long-lived refresh (7 days). Passwords hashed with bcrypt via `passlib`.

```
POST /api/v1/auth/register   { email, password, name }  → { access_token, refresh_token, user }
POST /api/v1/auth/login      { email, password }        → { access_token, refresh_token, user }
POST /api/v1/auth/refresh    { refresh_token }          → { access_token }
GET  /api/v1/auth/me                                    → { user }
```

A `get_current_user` FastAPI dependency reads `Authorization: Bearer <token>`, verifies the token, loads the user. All mission-scoped routes depend on it. Ownership is checked at the service layer (`mission.owner_id == current_user.id`); a mismatch returns `403 Forbidden`. A missing/expired token returns `401 Unauthorized`.

### API Surface

```
/api/v1/auth/{register,login,refresh,me}

/api/v1/missions                              GET, POST
/api/v1/missions/{mid}                        GET, PATCH, DELETE
/api/v1/missions/{mid}/tags                   GET, PUT

/api/v1/missions/{mid}/graphs                 GET, POST        (was /api/v1/graphs)
/api/v1/missions/{mid}/graphs/{gid}           GET, PATCH, DELETE
/api/v1/missions/{mid}/graphs/{gid}/reconnect    POST
/api/v1/missions/{mid}/graphs/{gid}/introspect   POST
/api/v1/missions/{mid}/graphs/{gid}/project      POST     (verb: project schema into DB)
/api/v1/missions/{mid}/graphs/{gid}/query        POST

/api/v1/missions/{mid}/schemas/{sid}/active-version    GET

/api/v1/missions/{mid}/llm-providers          GET, POST, PATCH, DELETE
/api/v1/missions/{mid}/skills                 GET, POST, PATCH, DELETE
/api/v1/missions/{mid}/instructions           GET, POST, PATCH, DELETE
/api/v1/missions/{mid}/models                 GET, POST, PATCH, DELETE
```

The legacy `/api/v1/graphs/*` routes are **removed entirely**, not deprecated. This is acceptable because the branch is pre-1.0 and there is no production deployment.

### Studio UI

```
/login                                          login / register
/missions                                       list of Missions (replaces /graphs)
/missions/new                                   creation wizard
                                                steps: name → objectives + success criteria → tags
/missions/{mid}                                 Mission overview
                                                shows objectives, success criteria, tags,
                                                attached graphs, recent activity
/missions/{mid}/settings                        tabs: General | Graphs | LLM | Skills | Instructions
/missions/{mid}/models                          model registry
/missions/{mid}/models/{model_id}               model detail (linked schema, subgraph stats)
/missions/{mid}/graph/{gid}/modeller            existing modeller, now nested under Mission
/missions/{mid}/graph/{gid}/explorer            existing explorer, now nested under Mission
```

The existing `ModellerPage` and `ExplorerPage` components are reused without logic changes — only the route prefix changes and they gain a `missionId` URL param to forward to the API. Canvas wrappers (`GraphCanvas`, `SchemaCanvas`) are untouched.

Markdown editing for Skills and Instructions reuses the CodeMirror 6 instance already integrated in the query console.

### Module Structure (engine)

```
engine/src/invana/
├── auth/
│   ├── models.py            # User
│   ├── security.py          # bcrypt + JWT helpers
│   ├── dependencies.py      # get_current_user
│   ├── schemas.py           # Pydantic
│   └── router.py            # /api/v1/auth/*
├── missions/
│   ├── models.py            # Mission, MissionTag
│   ├── service.py           # CRUD + ownership checks
│   ├── schemas.py
│   └── router.py            # /api/v1/missions
├── skills/
│   ├── models.py            # Skill, Instruction, LLMProvider
│   ├── service.py
│   ├── schemas.py
│   └── router.py            # /api/v1/missions/{mid}/{skills,instructions,llm-providers}
├── models_registry/
│   ├── models.py            # Model       (named `models_registry` to avoid Python collision)
│   ├── service.py
│   ├── schemas.py
│   └── router.py            # /api/v1/missions/{mid}/models
├── graphs/                  # existing, +mission_id FK on Graph
├── modeller/                # existing, +mission_id FK on GraphSchema
└── server/
    ├── app.py               # mounts all routers, applies get_current_user
    └── routes/
        ├── graphs.py        # re-prefixed under /missions/{mid}
        ├── query.py         # re-prefixed
        └── schemas.py       # re-prefixed
```

### Storage & Migrations

Alembic history on `arch/redesign` is reset: the two existing revisions in `engine/src/invana/modeller/migrations/versions/` (`6426041eefc5_initial_schema.py`, `a1b2c3d4e5f6_add_graphs_table.py`) are deleted and replaced with a single new initial migration that captures the full redesigned schema:

- All new tables (`users`, `missions`, `mission_tags`, `llm_providers`, `skills`, `instructions`, `models`).
- All existing modeller tables, unchanged structurally.
- `graphs` and `graph_schemas` with new `mission_id` FK.
- Full cascade matrix above.

The migration runner at `engine/src/invana/db.py:23` is unchanged.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Backfill existing graphs into a "Default" mission | Preserves continuity for existing dev environments | Migration code that no production user needs; carries forward a flat-thinking habit | Pre-1.0, no production state; clean break is honest |
| `Project` instead of `Mission` | Familiar PM vocabulary | "Project" overloaded — already used as a verb in modeller (`/project` endpoint), and as the file-watcher "project" concept | "Mission" reads more active and avoids collisions |
| `Goal` as the top-level entity | Short, intuitive | A field on a Mission is already `objectives`/`goals`; entity name collides with its own field | Avoid the collision |
| Add a `Strategy` layer between Mission and children | Strategy theory rigor (Mission → Objectives → Strategies → Tactics) | Adds nesting; every child entity would need `strategy_id`; Studio gains a layer | Defer to post-1.0 if needed |
| Skills/Instructions as files on disk | Closer to Claude-Code-skill semantics | Filesystem sync, multi-tenant scoping, backup/restore complexity | DB rows with markdown `content` are simpler and version-controllable |
| GraphSchema per Model (no separate `models` table) | Reuses existing schema machinery 1:1 | Conflates DDL/schema concerns with the higher-level "model" concept; doesn't capture `model_type`, `source`, `subgraph_label`, `metadata` | Hybrid: Postgres `models` row that *points to* a `graph_schemas` row optionally |
| Soft deletes everywhere | Undo, audit trail | Cognitive overhead, query complexity, "ghost" rows polluting joins | Pre-1.0 simplicity wins; revisit if users start losing work |

---

## Security Considerations

- **JWT secret** (`settings.secret_key`) must be a 32+ byte random value, injected via env var, never committed.
- **Password hashing**: bcrypt with default work factor (12). No plaintext passwords in logs.
- **Token storage in Studio**: localStorage for v1; XSS-vulnerable but acceptable for early-stage tool used in trusted-developer contexts. HttpOnly cookies considered for follow-up.
- **Ownership checks** are enforced server-side at the service layer for every Mission-scoped route — never client-trusted.
- **Encrypted at rest**: `graphs.auth_encrypted` (existing) and `llm_providers.api_key_encrypted` (new) both use the same Fernet key (`INVANA_ENCRYPTION_KEY`). Reusing the key keeps key-management simple; rotation is a known deferred concern.
- **No `/admin` exposure**: the existing starlette-admin UI (RFC-003) is protected behind JWT auth in this RFC.
- **CORS** stays permissive in dev; production deployments must set `INVANA_CORS_ALLOWED_ORIGINS` explicitly.

---

## Performance Considerations

- New routes add one DB roundtrip per request to load the Mission and check ownership. Negligible. A future optimization can cache the Mission on `request.state` if hot paths emerge.
- The connector pool (RFC-008) is keyed by `graph.id` and is unchanged; the Mission re-parenting is purely metadata.
- Skills/Instructions are markdown text rows; expected size < 100 KB total per Mission. No indexing strategy beyond `mission_id` FK index.
- Cascade deletes through the Mission → graph_schemas → schema_versions → property/edge/node tree could touch many rows on a large schema. Acceptable: deletes are administrative, not on the hot path. A future RFC may add a background-job pattern if needed.

---

## Open Questions

- [ ] `slug` uniqueness: per-owner (current plan) vs. globally unique. Per-owner is more user-friendly; globally unique would simplify shareable URLs later.
- [ ] When a Mission is deleted, do we also issue best-effort `DROP`/`DELETE` against the attached external graph DB? Current plan: **no** — only Invana metadata is deleted. The user remains responsible for cleaning up data in their own graph DB. To revisit when we add managed/hosted graph DB provisioning.
- [ ] Is `instructions` one row per Mission or many? Current plan: many (each with `kind` and `sort_order`). Reconsider if the UX consistently treats it as a single document.
- [ ] Refresh token rotation policy: rotate on every refresh, or keep until expiry? Current plan: keep until expiry; revisit if abuse appears.

---

## Implementation Plan

1. [ ] Write `docs/system-design.md` — platform system-design doc reflecting this RFC.
2. [ ] Write `engine/CLAUDE.md` — engine-scoped Claude context.
3. [ ] `engine/src/invana/auth/` — User model, security helpers, dependency, router. Wire JWT settings.
4. [ ] `engine/src/invana/missions/` — Mission + MissionTag + service + router.
5. [ ] Reset Alembic; create single new initial migration covering the full redesigned schema with the cascade matrix above.
6. [ ] Add `mission_id` to `graphs.Graph` and `modeller.GraphSchema`. Move `graphs`, `query`, `schemas` routers under `/api/v1/missions/{mid}/...`. Apply `get_current_user` + ownership check.
7. [ ] `engine/src/invana/skills/` — Skill, Instruction, LLMProvider entities + routers + Fernet for API keys.
8. [ ] `engine/src/invana/models_registry/` — Model entity + router.
9. [ ] Studio: `stores/auth.store.ts` + interceptor + LoginPage + RegisterPage + `useAuth`.
10. [ ] Studio: replace `GraphsListPage` with `MissionsListPage`; add `MissionCreatePage` (wizard) + `MissionOverviewPage` + `useMissions`.
11. [ ] Studio: settings tabs (General, Graphs, LLM, Skills, Instructions) + markdown editor via CodeMirror.
12. [ ] Studio: models registry pages.
13. [ ] Studio: move modeller/explorer under `/missions/{mid}/graph/{gid}/...`; remove `/graphs` routes; update `useGraphs` to be mission-scoped.
14. [ ] Add changeset entry describing the breaking redesign (CLAUDE.md rule #8).

Per user direction, no automated tests are written for this redesign. Verification is by manual run-through (see `docs/system-design.md` and the Phase-1 plan file).

---

## References

- [RFC-001 — Graph Connectors](001-graph-connectors.md)
- [RFC-002 — Graph Modeller](002-graph-modeller.md)
- [RFC-003 — Server & Admin Module](003-server-admin.md)
- [RFC-008 — Graphs & Query API](008-graphs-query-api.md) — Graph, GraphConnectionManager, Fernet encryption pattern
- [RFC-009 — Studio v1](009-studio-v1.md) — Application shell, Zustand + TanStack Query patterns
- [RFC-010 — Studio Modeller](010-studio-modeller.md)
- [RFC-011 — Studio Explorer](011-studio-explorer.md)
- RFC-013 (planned) — Code / git repository import pipeline
- RFC-014 (planned) — LLM agent runtime
- RFC-015 (planned) — Model auto-generation
- [PyJWT](https://pyjwt.readthedocs.io/) — JWT encode/decode
- [passlib](https://passlib.readthedocs.io/) — bcrypt password hashing
