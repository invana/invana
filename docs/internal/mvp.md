# MVP — Implementation Checklist

Practical, build-ordered MVP scope derived from `docs/system-design.md`. Grouped by layer. Each item is a unit of work — not a sentence, not an RFC. RFC links where the design already exists; `TBD` otherwise.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred post-1.0

## How to read this file

Every feature is decomposed into **three columns of work** so dependencies surface at planning time, not at implementation time:

- **Backend** — engine work: models, services, routes, jobs, validators.
- **Frontend** — Studio work: routes, pages, components, stores, hooks. Always defined alongside BE so the FE isn't accidentally constrained by what the BE happens to ship.
- **Integrations** — third-party libraries, infra services, vendor SDKs, dev-only tooling. Listed so they can be added to `pyproject.toml` / `package.json` / `docker-compose-infra.yml` *before* the feature is coded.

`N/A` is a legitimate value — say it explicitly so a future reader doesn't assume an omission is an oversight. When BE and FE are built in lockstep, this triplet is also the per-slice contract surface.

## Architecture summary (RFC-017)

The MVP container model is **`User → Graph (1:1 GraphConnection)`**. There is no Workspace and no Mission entity — both are folded into `Graph`. `Graph` carries members, invitations, the DB connection (1:1), schema, intent/objectives, datasets, skills, instructions, LLM bindings, and agents.

All graph-scoped URLs are namespaced under `/u/:username/:graphSlug/...`. Users have a globally unique `username`; `graphs.slug` is unique per owner. The URL path parameter is named `graphSlug` (the data field is still `Graph.slug`) — disambiguates from generic "slug" in routing code.

A new Graph progresses through a **setup wizard** (Graph Info / Intent / Skills / Datasets) before all analytical features unlock — see § 2.2.

---

## Layer 1 — Identity & Access

**Shipped in Slice S1** under prior Workspace nomenclature — full design in [`docs/internal/mvp/layer-1-identity-access.md`](mvp/layer-1-identity-access.md).

> **Rename pending (RFC-017).** Behaviors below are implemented; the **Workspace → Graph** rename + **username** addition + **removal of auto-created personal workspace** from `invana init` is the active work in Slice S1.5. Items show their target post-rename shape.

### 1.1 User auth (register, login, refresh, logout, me + patch + password + delete-self)
- **Backend:** [~] `User` model · bcrypt hashing (passlib + `bcrypt<5` pin) · `/api/v1/auth/register` (invite-gated) · `/login` · `/refresh` (rotates refresh token) · `/logout` · `/me` (GET) · `/me` (PATCH first/last name + username) · `/me/password` (revokes all this user's refresh tokens) · `/me` (DELETE with sole-superuser guard) · `GET /api/v1/auth/username-available?username=foo` (unauthenticated; returns `{available: bool, reason?: string}`) · HS256 access JWT (15m), opaque server-side refresh token (7d) · `get_current_user` dep — **add `users.username`** (globally unique, validated lowercase `[a-z0-9-]`, 2–64 chars, mutable with rate-limit; collected at registration)
- **Frontend:** [~] `LoginPage` · `RegisterPage` (invite-redeem) — **add username field**; `ProfileSettingsPage` with tabs (Basic info · Password · Danger zone) — **add username edit in Basic info with cooldown indicator**; `stores/auth.store.ts` (Zustand, persisted) · axios interceptor (attach Bearer, single-flight refresh on 401) · `useAuth` hook · `ProtectedRoute` wrapper
- **Integrations:** `passlib[bcrypt]` · `bcrypt<5` (passlib 1.7.4 wrap-bug guard) · `PyJWT` · `pydantic[email]` · `itsdangerous` (SessionMiddleware) · browser `localStorage` (HttpOnly cookies deferred)

### 1.2 CLI bootstrap
- **Backend:** [~] `invana init` command (Click) — prompts for **username (required, validated)**, first name (required), last name (optional), email, password+confirm; creates root user with `is_superuser=True`; idempotent (refuses if any superuser exists); also supports `--non-interactive` with flags for CI. **No personal Graph is auto-created** — the user creates their first Graph manually after login.
- **Frontend:** [~] Existing `LoginPage` is the first-login surface; on first login the user lands on an empty `/graphs` list and is prompted to create their first Graph.
- **Integrations:** `click` (existing)

### 1.3 Invitations (graph-scoped)
- **Backend:** [~] `Invitation` entity carries `graph_id` + `role` + `token_hash` (sha256) · `POST /api/v1/u/{username}/{graphSlug}/invitations` (admin only; returns one-shot `redeem_url`) · `GET .../invitations` · `DELETE .../invitations/{id}` · `POST /auth/register?invite=<token>` accept path attaches the user as a `GraphMember` with the invitation's role
- **Frontend:** [~] `/u/:username/:graphSlug/settings/invitations` page (admin only) — issue dialog shows the redeem URL once with a copy button; per-row revoke; `RegisterPage` reads `?invite=<token>`
- **Integrations:** email send is **deferred** for MVP — invitation URLs are copy-pasted

### 1.4 Roles (graph-scoped)
- **Role is graph-scoped, not user-scoped.** Role lives on `graph_members.role` enum (`developer` | `analyst` | `admin`). Platform-level admin is `users.is_superuser` (gates `/admin`). The same user can be `admin` of one Graph and `developer` of another. See `docs/internal/mvp/layer-1-identity-access.md` for the full role matrix.
- **Backend:** [~] `graphs` + `graph_members` tables · `graph_role` enum · `get_graph_membership` dep · `require_graph_admin` / `require_graph_builder` / `require_graph_member` deps · `require_superuser` dep
- **Frontend:** [~] `useAuth()` exposes `role`, `isAdmin`, `isBuilder`, `isSuperuser`, `displayName`, `activeMembership`, `membershipForGraph(username, slug)` · `RoleGate` component for conditional UI
- **Integrations:** none

### 1.5 Admin UI gating
- **Backend:** [x] `starlette-admin` mounted at `/admin`, gated by `SuperuserAuthProvider` — session-cookie auth (Starlette `SessionMiddleware`), email + password sign-in, `is_superuser=True` required (re-checked on every request, not trusted from session alone). **Distinct from the JWT Bearer flow** — `/admin` uses its own login form; API routes use Bearer tokens.
- **Frontend:** [x] App-shell dropdown shows "Platform admin" link only to superusers (uses `RoleGate require="superuser"`)
- **Integrations:** `starlette-admin` · `itsdangerous` (SessionMiddleware signing)

### 1.6 Account self-service (Profile settings)
- **Backend:** [~] `PATCH /auth/me` (first/last name, **username** — rate-limited) · `POST /auth/me/password` (verifies current; rotates all refresh tokens on success) · `DELETE /auth/me` (verifies password; refuses if user is the sole active superuser → 409; refuses if user owns any Graph with other members → 409; otherwise hard-deletes — cascade downward)
- **Frontend:** [~] `/settings/profile` with three tabs: **Basic info** (email read-only · username editable with cooldown · first/last name editable), **Password** (current + new + confirm), **Danger zone** (delete account with email + password confirmation dialog and cascade preview)
- **Integrations:** none

### 1.7 Admin model browser
- **Backend:** [~] starlette-admin model views for `Users` (with username column) · `Graphs` · `GraphConnections` · `GraphMembers` · `Invitations` · `RefreshTokens`. Sensitive columns (`password_hash`, `token_hash`, `auth_encrypted`) deliberately excluded from `fields` so they aren't shown or editable. Tightened mutability: Users disable create; Invitations disable create + edit (delete = revoke); RefreshTokens disable create + edit (delete = manual revoke).
- **Frontend:** N/A — starlette-admin renders its own UI
- **Integrations:** `starlette-admin` (existing)

---

## Layer 2 — Graph (container + settings)

The Graph is the unit of work. It carries everything previously split across Workspace and Mission: identity (slug + owner + members), the DB binding (1:1 `GraphConnection`), intent + objectives, and the analytical bindings (Skills, Instructions, LLM providers, Agents). Membership comes from Layer 1.

§ 2.1–2.3 + 2.8 shipped under S1.5 + S2. Detailed write-up: [`mvp/layer-2-graph.md`](mvp/layer-2-graph.md).

### 2.1 Graph entity + CRUD
- **Backend:** [x] `Graph` entity + CRUD at `/api/v1/graphs` and `/api/v1/u/{username}/{graphSlug}`. Hard delete cascades downward per RFC-012; sole-admin self-removal → 409.
- **Frontend:** [x] `/graphs` list · `/graphs/new` create page · `/u/:username/:graphSlug` overview. Graph switcher in app shell deferred.
- **Integrations:** none

### 2.2 Graph setup wizard + feature gating
- **Backend:** [x] `setup_state` JSONB · `POST /u/:username/:graphSlug/setup/{section}` · `require_graph_setup_complete` gates `/query`, `/schema/active-version`, `/connection/introspect` · `graph_info` auto-completes on connection save; `intent` on non-empty intent.
- **Frontend:** [x] Overview wizard card with done/skipped/todo state per section; modeller / explorer / query unlock once required sections are done.
- **Integrations:** none

### 2.3 GraphConnection (1:1 child of Graph)
- **Backend:** [x] `GraphConnection` entity · `/u/:username/:graphSlug/connection` (GET / PUT full-replace / DELETE) · `/connection/test` · `/connection/ping` · `/connection/introspect` · `connector_class` immutable after first save · empty `auth` keeps stored credentials. **Legacy `/api/v1/graph-connections/*` + `/api/v1/graphs/{connection_id}/query` + `/api/v1/schemas/{schema_id}/active-version` shims removed.**
- **Frontend:** [x] `GraphForm` at `/u/:username/:graphSlug/settings/connection` · Test Connection gates Save.
- **Integrations:** `neo4j` (driver) · `gremlinpython` · per-driver native libs in `integrations/invana-{db}/` · `cryptography.Fernet`
- **Deferred (post-MVP):** [-] Multi-connection Graphs · [-] Source-ingestion connectors (PDF / DOCX / XLSX / CSV / TXT / Git / MySQL) — datasets are produced externally in MVP, see L3 · [-] Connector plugin interface · [-] Custom connector registration

### 2.4 Skills (graph-scoped)
- **Backend:** [x] `Skill` entity (graph_id FK CASCADE, unique (graph_id, name)) — `name`, `description`, `content` (markdown), `when_to_use` (markdown) · CRUD under `/api/v1/u/{username}/{graphSlug}/skills/...` · admin-only writes · 409 on duplicate name.
- **Frontend:** [x] Skills section in the graph rail (Wand2 icon) · list + add/edit form (name / description / content textarea / when_to_use) · maximize-to-full-page route at `/settings/skills` · plain textareas for now (markdown rendering deferred).
- **Integrations:** none yet — markdown editor (CodeMirror reuse) deferred until the surface is exercised.

### 2.5 Instructions (graph-scoped)
- **Backend:** [x] `Instruction` entity (graph_id FK CASCADE, unique (graph_id, name)) — `name`, `content` (markdown), `priority` (int 0–1000, default 100; higher first) · CRUD under `/api/v1/u/{username}/{graphSlug}/instructions/...` · admin-only writes · 409 on duplicate name · service-side `ORDER BY priority DESC, name ASC`.
- **Frontend:** [x] Instructions section in the graph rail (ScrollText icon, between Skills and Datasets) · list with `p<priority>` badge · add/edit form with name + priority number input + content textarea · maximize-to-full-page route at `/settings/instructions`.
- **Integrations:** none yet.

### 2.6 LLM providers (graph-scoped)
- **Backend:** [x] `LLMProvider` entity (graph-scoped, CASCADE) with provider enum (anthropic / openai / google / azure / ollama / local). CRUD + `POST .../llm/{id}/ping` + `POST .../llm/{id}/set-default` under `/api/v1/u/{username}/{graphSlug}/llm/...`. Partial unique `(graph_id) WHERE is_default = true`. Reuses `invana.graphs.encryption` for Fernet on `api_key`.
- **Frontend:** [x] LLMs section (rail icon — see § 2.8) · provider-driven form (Ollama hides api_key, OpenAI/Azure show base_url) · masked api-key field · Test gating via save-first → ping → green/red · Set default / Edit / Delete row actions · maximize-to-full-page route at `/settings/llms`.
- **Integrations:** `cryptography.Fernet` (reuses `INVANA_ENCRYPTION_KEY`) · per-provider Python SDK lazy-imported: `anthropic`, `openai` (Google/Azure use a base-URL HTTP probe until SDKs are wired; Ollama uses an HTTP probe).

### 2.7 Agents (graph-scoped)
- **Backend:** [ ] `Agent` entity — `graph_id`, composes `skill_ids[]` + `llm_config_id` + operating policy JSONB (autonomy level, fire conditions, reporting) · CRUD under `/api/v1/u/{username}/{graphSlug}/agents/...`
- **Frontend:** [ ] Agents tab in Graph settings · list + editor pages · skill picker · LLM picker · policy form
- **Integrations:** none (depends on 2.4 + 2.6 entities only)

### 2.8 Graph settings shell
- **Backend:** N/A (composition of other features)
- **Frontend:** [x] Each settings section is its own icon in the graph page's `leftNav` rail (Info / Intent / LLMs / Skills / Datasets / Members / Invitations). Clicking a section sets `?settings=<section>`; the `leftSection` swaps in just that section's content (swap-style, VS Code-shaped). Overview / Explorer / Modeller all share the rail via `useGraphLeftNav`. Standalone `/u/.../settings/<section>` routes remain as deep-link / maximize targets, rendering the same section components inside page chrome.
- **Integrations:** `@invana/themes` `AppLayoutV2.leftSection` slot, `@invana/ui` (no Sheet/Drawer — abandoned in favour of the rail+swap pattern).

### 2.9 Graph lifecycle (active / archived)
- **Backend:** [ ] `status` enum · middleware/dep that blocks mutating routes on archived Graphs · `POST .../archive` + `.../unarchive`
- **Frontend:** [ ] Archive toggle in General settings · read-only banner across all Graph pages when archived · disable mutating actions
- **Integrations:** none

### 2.10 Delete semantics
- **Backend:** [ ] Hard delete · downward-only cascade per RFC-012 cascade matrix · server-side ownership check before delete
- **Frontend:** [ ] Confirmation dialog showing cascade preview (counts of children that will be removed)
- **Integrations:** none

---

## Layer 3 — Ingestion (Datasets via `dataset-importer`)

**MVP scope shift.** No connector framework in MVP. Users prepare graph JSON externally (their script, their pipeline, their LLM, whatever) and feed it to Invana via a thin Python API. Invana's job is to *accept, validate, derive a system graph model, and store* — not to ingest from raw sources.

### Dataset = graph model + records + import job + files in MinIO

Each dataset owns:
1. A **graph model** (its system graph model) — node/edge types + per-property constraints.
2. The **records** — node/edge JSON files validated against that model.
3. An **import job** — executed via the pluggable executor (RFC-016, MVP = LocalExecutor).
4. The raw **files** in MinIO, retained for replay, audit, and re-import.

### Dataset format (on-disk convention consumed by `dataset-importer`)

```
<dataset_dir>/
├── model.json                      # graph model — node/edge types + property constraints
├── nodes/
│   ├── <NodeType>.json             # one file per node type, array of records
│   └── ...
└── edges/
    ├── <EdgeType>.json             # one file per edge type, array of records
    └── ...
```

**`model.json` shape:**
```json
{
  "nodes": {
    "Document": {
      "properties": {
        "title":  { "type": "string",  "required": true,  "max_length": 255 },
        "url":    { "type": "string",  "required": true },
        "status": { "type": "enum",    "values": ["draft", "published"] },
        "views":  { "type": "integer", "min": 0 }
      }
    }
  },
  "edges": {
    "MENTIONS": {
      "from": ["Document"],
      "to":   ["Person"],
      "properties": {
        "weight": { "type": "float", "min": 0, "max": 1 }
      }
    }
  }
}
```

Supported property types: `string` (with `min_length` / `max_length` / `pattern`), `integer` / `float` (with `min` / `max`), `boolean`, `enum` (with `values[]`), `datetime`, `uuid`, `json`. All types support `required` and `default`.

**Node record:**
```json
{ "id": "doc-001", "properties": { "title": "Invana 101", "url": "https://...", "status": "published" } }
```

**Edge record:**
```json
{ "id": "e-001", "from": "doc-001", "to": "person-42", "properties": { "weight": 0.8 } }
```

`type` is implicit from the filename. `id` is the source-stable identifier used for identity resolution by the stitcher (L4). Edge `from`/`to` must resolve to node `id`s present in the same dataset (or already imported into the Graph — TBD per cross-dataset reference policy).

### Validation (run during the import job)
- [ ] **Model validation** — `model.json` parses cleanly; enum values non-empty; type names valid; edge `from`/`to` reference declared node types
- [ ] **Per-record validation against model:**
  - [ ] `required` — missing required property → error
  - [ ] `type` — wrong type (e.g. string where integer expected) → error
  - [ ] `min` / `max` (numeric) — out of bounds → error
  - [ ] `min_length` / `max_length` (string) — length violation → error
  - [ ] `pattern` (regex) — non-match → error
  - [ ] `enum` — value not in `values[]` → error
  - [ ] Unknown property keys → warning (strict mode → error, configurable)
- [ ] **Referential integrity** — every edge's `from` and `to` resolves to a node `id` declared in this dataset
- [ ] **ID uniqueness** — node `id` unique per node-type within the dataset
- [ ] **Fail-fast vs collect-all** — collect-all by default, capped at N errors (e.g. 1000) before aborting
- [ ] **Validation report** — error list with `file`, `record_index`, `record_id`, `field`, `rule_violated`, `message`; persisted on the job and rendered in Studio

### Storage (MinIO)
- [ ] MinIO added to `docker-compose-infra.yml` for dev
- [ ] `INVANA_S3_*` settings (endpoint, access key, secret key, bucket, region) — S3-compatible so prod can swap to AWS S3 / GCS / R2
- [ ] On import, files (`model.json`, `nodes/*.json`, `edges/*.json`) are uploaded to MinIO before the job runs
- [ ] Bucket layout: `s3://<bucket>/graphs/<graph_id>/datasets/<dataset_id>/{model.json,nodes/*,edges/*}`
- [ ] Retention — files retained until the Dataset row is hard-deleted; deletion cascades to MinIO objects
- [ ] Streamed uploads for large files; multipart for files > 64 MB

### Import job (executor + log streaming)
- [ ] `ImportJob` entity — `id`, `dataset_id`, `status` (queued | running | succeeded | failed | cancelled), `started_at`, `finished_at`, `progress` (records_processed / records_total), `error_count`, `warning_count`
- [ ] Executed via pluggable executor — **MVP = LocalExecutor** (in-process asyncio task), interface matches RFC-016 so Celery / Ray / K8s can drop in later
- [ ] Job stages: `upload → validate model → validate records → derive system graph model → persist → done`
- [ ] **Structured log lines** persisted per job: `timestamp`, `level`, `stage`, `message`, optional `record_ref`
- [ ] Log storage: append-only table (`import_job_logs`) or MinIO append blob — TBD per volume; MVP = Postgres table for simplicity
- [ ] **Log streaming to UI** via Server-Sent Events: `GET /u/{username}/{graphSlug}/datasets/{dsid}/jobs/{jid}/logs/stream`
- [ ] Idempotent re-import — same `(graph_id, name)` triggers a new `ImportJob` that replaces the dataset's files + records atomically on success; failed jobs leave prior state intact

### `dataset-importer` Python API
- [ ] `invana.datasets.import_dataset(graph, name, path, *, refresh=False, strict=False)` — single entrypoint; `graph` accepts either a `Graph` handle or `"username/slug"`
- [ ] Uploads `path/` to MinIO, creates Dataset + ImportJob rows, dispatches to executor, returns `ImportJob` handle
- [ ] `job.wait()` / `job.stream_logs()` helpers for scripts
- [ ] Returns `Dataset` (with model + counts) once job succeeds; raises with validation report on failure
- [ ] CLI shim: `invana datasets import --graph <username/slug> --name <name> --path <dir> [--refresh] [--strict]`

### Engine surface
- [ ] Dataset entity — `id`, `graph_id`, `name`, `graph_model` (JSONB), `storage_uri` (s3://…), `record_counts`, `last_job_id`, `created_at`, `updated_at`
- [ ] `POST /api/v1/u/{username}/{graphSlug}/datasets` — register a dataset, kicks off the import job
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets` — list
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}` — detail (model + counts + last job)
- [ ] `DELETE /api/v1/u/{username}/{graphSlug}/datasets/{dsid}` — hard delete (DB + MinIO)
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/jobs` — list job runs
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/jobs/{jid}` — job detail (status, progress, error/warning counts)
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/jobs/{jid}/logs` — paginated logs
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/jobs/{jid}/logs/stream` — SSE log stream
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/files` — file tree (lists MinIO keys under the dataset's prefix)
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/files/{path}` — fetch a file (signed URL or proxied)
- [ ] `GET  /api/v1/u/{username}/{graphSlug}/datasets/{dsid}/records?type=<T>&page=<n>&page_size=<m>` — paginated record view, scoped to one node/edge type

### Studio surface
- [ ] Dataset browser — list per Graph, show graph-model summary + record counts + last job status
- [ ] "Import dataset" form — drag-drop a folder/tarball/zip; uploaded to MinIO via signed URLs; engine kicks off the import job
- [ ] **Dataset detail page — four tabs:**
  - [ ] **Logs** — live SSE log stream during a run; full history when complete; filter by stage / level; copyable
  - [ ] **Files** — file tree of MinIO contents (`model.json`, `nodes/`, `edges/`); click a file to preview JSON (truncated for large files)
  - [ ] **Model** — graph-model view: node types as cards (properties + constraints), edge types showing `from → to`; rendered as both a structured form view and as a small graph diagram via `@invana/canvas`
  - [ ] **Dataset** — table view of records with pagination, sortable columns, type selector (toggle between node types and edge types); columns derived from the graph model
- [ ] Job status badge on browser + detail pages: queued / running / succeeded / failed
- [ ] Validation report panel on failed jobs — grouped by file, expandable per error, links to the offending record in the Files tab

### L3 Integrations (consolidated)
- **MinIO** in dev `docker-compose-infra.yml`; S3-compatible — prod swaps to AWS S3 / GCS / R2
- **aioboto3** (async S3 client) · `boto3-stubs` (typings)
- **pydantic v2** (model.json + constraint validators)
- **sse-starlette** (FastAPI Server-Sent Events for log streaming)
- **EventSource** browser API (FE log-stream consumer)
- RFC-016 **executor interface** (in-house) · **LocalExecutor** asyncio impl
- **@invana/canvas** (Model-tab diagram) · **@invana/design-kit** table + tabs
- CLI: existing `typer`/`click` (CLI framework) — add `invana datasets import` subcommand

### Deferred (post-MVP)
- [-] Tasks / Pipelines / Schedulers — once source connectors exist, datasets will also be produced by recurring connector runs
- [-] Distributed executors (Celery / Ray / K8s) — RFC-016 boundary in place, but only LocalExecutor in MVP
- [-] Source-connector instance configuration UI
- [-] Cross-dataset edge references (edges in dataset A pointing at nodes in dataset B) — MVP requires self-contained datasets

---

## Layer 4 — Modeling (User Graph Model · Stitcher)

### 4.1 User graph model editor
- **Backend:** [x] `GraphSchema` machinery (RFC-002) re-scoped to `graph_id` · `GET /u/{username}/{graphSlug}/schema/active-version` · `POST /u/{username}/{graphSlug}/connection/introspect` (admin) re-runs introspection against the bound DB.
- **Frontend:** [~] `ModellerPage` at `/u/:username/:graphSlug/modeller` · schema nav + detail panel work · "Introspect" button calls ping + introspect. **Schema canvas is stubbed** — placeholder shows node-type / edge-type counts; canvas rendering against the redesigned `@invana/canvas` is a follow-up.
- **Integrations:** existing modeller code (`engine/src/invana/modeller/`) · `@invana/canvas` (redesigned API — not yet wired)

### 4.2 Stitcher — mapping (system type → user concept)
- **Backend:** [ ] `StitchMapping` entity (`dataset_id`, `system_type`, `user_type`, `property_map` JSONB) · CRUD routes · validation that referenced types exist in both ends
- **Frontend:** [ ] Mapping UI — two columns: dataset system-types (left, from L3 graph_model) · user model concepts (right) · drag-to-map · per-property mapping form
- **Integrations:** none

### 4.3 Stitcher — identity resolution
- **Backend:** [ ] Identity-resolution config per mapping (deterministic by `id`, or property-match rules: exact / case-insensitive / fuzzy) · resolution engine · conflict report
- **Frontend:** [ ] ID-resolution rule editor · conflict-review UI (pairs of records flagged as possibly-same, accept/reject)
- **Integrations:** `rapidfuzz` (string similarity for fuzzy matching) — *evaluate at S7 spike*

### 4.4 Stitcher — materialization (into bound GraphConnection)
- **Backend:** [ ] `StitchJob` entity (similar shape to `ImportJob`) · executed via LocalExecutor · writes nodes/edges to the bound graph DB · idempotent re-stitch · structured log lines
- **Frontend:** [ ] "Materialize" button in Graph overview · job status + progress · stats (nodes/edges materialized) · log viewer (reuses SSE pattern from L3)
- **Integrations:** existing graph DB connectors · RFC-016 executor · `sse-starlette`

### 4.5 Stitch trace + provenance
- **Backend:** [ ] Every materialized node/edge carries `dataset_id` + `record_id` + `stitch_job_id` as properties or in a side-table · `GET /u/{username}/{graphSlug}/provenance/{node_or_edge_id}`
- **Frontend:** [ ] Provenance panel in Explorer — click a node/edge → see source dataset + record + import job
- **Integrations:** none

---

## Layer 5 — Knowledge Graph

### 5.1 Query API
- **Backend:** [x] `/query` route lives at `/api/v1/u/{username}/{graphSlug}/query` (Cypher + Gremlin) · graph-membership + `require_graph_setup_complete` deps · response shape: `result_type` (`graph` | `tabular`), `query_language`, `data: GraphResponse | null`, `rows: list[dict] | null`, `execution_time_ms`, `row_count`.
- **Frontend:** [x] Query console (CodeMirror) under `/u/:username/:graphSlug/explorer`.
- **Integrations:** existing graph DB connectors

### 5.2 Semantic / vector retrieval
- **Backend:** [ ] Vector-index mixin for graph DBs that support it (per CLAUDE.md) · embedding generation pipeline · `POST /u/{username}/{graphSlug}/search?type=semantic`
- **Frontend:** [ ] Semantic search box in Explorer · result list with similarity scores
- **Integrations:** embedding provider TBD — likely `anthropic` (when/if available) or `openai` text-embedding-3-small; spike before committing · per-DB vector index support (Neo4j vector index, Memgraph, ArcadeDB)

### 5.3 Skill-mediated retrieval
- **Backend:** [ ] Skill-execution path that returns ranked grounded snippets (each with provenance) · invoked by agent loop
- **Frontend:** [ ] Surfaced inside agent UI (L6) — not a standalone page
- **Integrations:** depends on 2.4 Skills + L6 agent runtime

### 5.4 Provenance on retrieval responses
- **Backend:** [ ] Every retrieval response schema includes `nodes[]`, `edges[]`, `records[]` (with `dataset_id` + `record_id`), `import_job_id`
- **Frontend:** [ ] Citation chips on every answer · click-through opens the source record in dataset Files/Records tab
- **Integrations:** none

### 5.5 Studio Explorer (existing)
- **Backend:** [x] No change
- **Frontend:** [~] `ExplorerPage` mounted at `/u/:username/:graphSlug/explorer`; query console + status bar + inspector all working against the graph-scoped query endpoint. **Graph canvas rendering is stubbed** — placeholder summarises node/edge counts. Canvas re-integration against the redesigned `@invana/canvas` API surface is a follow-up (same blocker as § 4.1 Modeller).
- **Integrations:** `@invana/canvas` (redesigned API surface — not yet wired)

---

## Layer 6 — Intelligence (Agents · LLM grounding · Success scoring)

### 6.1 Agent runtime
- **Backend:** [ ] Agent loop service: read Graph instructions → plan with bound skills → query graph for grounded context → call bound LLM → handle result (return / write-back / fail) · `POST /u/{username}/{graphSlug}/agents/{aid}/run` (manual fire) · streaming response via SSE · fail-fast with clear error if the Graph has zero skills or zero datasets bound at run time
- **Frontend:** [ ] "Ask" / "Run agent" UI in Graph overview · streaming response panel · agent picker
- **Integrations:** per-provider Python SDK (`anthropic` first) · `sse-starlette` for streaming

### 6.2 Grounded LLM call
- **Backend:** [ ] Prompt template assembly (instructions + skills + retrieved context) · grounding contract enforcement (refuse to call LLM with empty retrieved context for grounded ops) · prompt caching where supported (Anthropic API)
- **Frontend:** [ ] Citation chips on rendered LLM output linking back to source records
- **Integrations:** `anthropic` SDK (prompt caching first-class)

### 6.3 Agent write-back
- **Backend:** [ ] Writeback service · validates new nodes/edges against user graph model · stamps provenance (`agent_run_id`, `created_by=agent`) · auto-commit vs review-required toggle on agent policy
- **Frontend:** [ ] Review panel (when policy=review) — diff view of proposed writes, accept/reject per node/edge
- **Integrations:** existing graph DB connectors

### 6.4 Agent observability
- **Backend:** [ ] `AgentRun` entity — captures prompt, retrieved context, LLM response, write-back delta, status, latency, token usage · `GET /u/{username}/{graphSlug}/agent-runs` + detail
- **Frontend:** [ ] Agent runs list per Graph · run detail (prompt + context + response + delta tabs, mirrors dataset detail UX)
- **Integrations:** reuses log/streaming infra from L3

### 6.5 Success-criteria scoring
- **Backend:** [ ] Criteria evaluator — each criterion is a query against the knowledge graph returning pass/fail · scheduled or on-demand re-eval
- **Frontend:** [ ] Progress badge + breakdown on Graph overview · per-criterion status
- **Integrations:** none

### 6.6 Groundedness enforcement + "cannot answer" path
- **Backend:** [ ] Detect empty retrieved context · explicit "cannot answer" response payload (distinct from a model-generated empty answer) · log groundedness-fail as defect-class event
- **Frontend:** [ ] Distinct visual rendering for "cannot answer" — never styled like a normal answer
- **Integrations:** none

---

## Layer 7 — Interfaces

### 7.1 CLI
- **Backend:** [ ] `invana init` (L1.2) · `invana start` (run engine + studio) · `invana migrate` (alembic upgrade) · `invana version` · `invana datasets import ...` (L3) · CLI does **not** register additional users (system-design §4.1)
- **Frontend:** N/A
- **Integrations:** `typer` / `click` (whichever is in `engine/src/invana/cli/`) · `rich` for output formatting · `httpx` if CLI talks to engine over HTTP

### 7.2 Studio UI shell
- **Backend:** [ ] Optionally serve Studio static assets from FastAPI in single-image Docker mode (`/static/*` → built Studio bundle)
- **Frontend:** [ ] Application shell — sidebar, header, Graph switcher · all Graph-scoped routes under `/u/:username/:graphSlug/...` · markdown editor reused for Skills + Instructions · design-kit components only (CLAUDE.md #9) · `@invana/canvas` for all graph rendering (CLAUDE.md #10)
- **Integrations:** React 19 · Vite · `@invana/design-kit` · `@invana/canvas` · TanStack Query · Zustand · React Router · CodeMirror 6 · TailwindCSS 4

### 7.3 External-agent API (§4.11)
- **Backend:** [ ] `ScopedToken` entity (`graph_id`, `scope` enum `read` | `read_write`, `created_at`, `last_used_at`, `revoked_at`) · `POST /u/{username}/{graphSlug}/tokens` (issue, returned exactly once) · token-auth dep parallel to JWT · retrieval endpoints reusing 5.x · write-back endpoints reusing 6.3 · archived-Graph read-only freeze
- **Frontend:** [ ] Tokens tab in Graph settings · "Issue token" flow showing token once with copy button · revoke action · last-used timestamp
- **Integrations:** `secrets` (stdlib) for opaque API key generation · same Fernet key for at-rest storage of token hash

---

## Integrations index

Single roll-up of every third-party dependency and infra service referenced above. Useful for S0 dep-bumping in one shot.

### Python (engine — `pyproject.toml`)
- **Web / API:** `fastapi`, `uvicorn`, `sse-starlette` (SSE for log + agent streaming)
- **DB:** `sqlalchemy[asyncio]`, `alembic`, `asyncpg` (Postgres), `aiosqlite` (dev)
- **Auth:** `passlib[bcrypt]`, `PyJWT`
- **Crypto:** `cryptography` (Fernet — already used)
- **Validation:** `pydantic v2` (already used)
- **Object storage:** `aioboto3`, `boto3-stubs[s3]`
- **CLI:** existing (`typer` or `click`), `rich`
- **LLM SDKs (lazy-imported):** `anthropic` (primary), `openai` (optional), `google-generativeai` (optional, post-MVP-friendly)
- **Identity resolution (spike):** `rapidfuzz` (string similarity, post-S7a evaluation)
- **Graph DB drivers (existing):** `neo4j`, `gremlinpython`, per-driver libs in `integrations/invana-{db}/`
- **Admin:** `starlette-admin` (existing)

### TypeScript (studio — `package.json`)
- **Framework:** `react@19`, `react-dom@19`, `vite`
- **Routing / state / data:** `react-router-dom`, `zustand`, `@tanstack/react-query`
- **HTTP:** `axios` (interceptor for auth)
- **UI:** `@invana/design-kit`, `tailwindcss@4`
- **Graph rendering:** `@invana/canvas` (wraps `pixi.js@8`)
- **Editor:** `codemirror@6` (markdown + Cypher/Gremlin modes)
- **Streaming:** native `EventSource` (SSE consumer) — no extra dep
- **Lint / fmt:** `biome` (existing)
- **Test:** `vitest`, `@testing-library/react`, `playwright`

### Infrastructure (dev — `docker-compose-infra.yml`)
- **Postgres** (app state)
- **MinIO** (S3-compatible object storage for dataset files)
- **Optional graph DB containers** for each supported backend (Neo4j, Memgraph, ArcadeDB, etc.)

### Environment variables (engine)
- `INVANA_SECRET_KEY` — JWT signing key (32+ bytes)
- `INVANA_ENCRYPTION_KEY` — Fernet key (rotation deferred)
- `INVANA_S3_ENDPOINT`, `INVANA_S3_ACCESS_KEY`, `INVANA_S3_SECRET_KEY`, `INVANA_S3_BUCKET`, `INVANA_S3_REGION`
- `INVANA_CORS_ALLOWED_ORIGINS` — prod-only
- `INVANA_DATABASE_URL` — Postgres in prod, SQLite in dev
- LLM provider keys are per-`LLMProvider` row (encrypted), **not** env vars

### Tooling / CI
- **uv** (Python pkg mgmt — existing) · **pnpm** (TS) · **pre-commit** (ruff + biome + commitizen) · **GitHub Actions** (CI) · **Changesets** (changelog + bumps)
- **OpenAPI → TS client generator** in `studio/scripts/` (S0 pre-work) — `openapi-typescript` or `orval`; pick one in S0

---

## Cross-cutting

- [ ] Encryption at rest — Fernet key (`INVANA_ENCRYPTION_KEY`) for `graph_connections.auth_encrypted` + `llm_providers.api_key_encrypted`
- [ ] Object storage — MinIO in dev (`docker-compose-infra.yml`); S3-compatible client so prod can swap to AWS S3 / GCS / R2. Used for dataset files (model + nodes + edges). `INVANA_S3_*` settings.
- [ ] Logging — RFC-006
- [ ] Telemetry — RFC-007
- [ ] CORS — permissive in dev, `INVANA_CORS_ALLOWED_ORIGINS` in prod
- [ ] Alembic — reset on `arch/redesign`; single new initial migration covers full redesigned schema (RFC-012 + RFC-017)
- [ ] Pluggable executor (RFC-016) — orchestration as a boundary; MVP ships **LocalExecutor** (in-process asyncio); distributed executors deferred
- [ ] Changesets — every user-facing change carries one (CLAUDE.md rule #8)
- [ ] Docker images — `invana/engine`, `invana/studio` (multi-target Dockerfile)
- [ ] Docs — MkDocs Material site auto-built from `docs/`

## Deferred (post-1.0)

- [-] Org / team layer above Graph
- [-] Soft deletes / trash / undo
- [-] Ontology / semantics layer beyond user graph model
- [-] Auto-generation of user models from imported sources (RFC-015, planned)
- [-] Refresh-token rotation policy
- [-] HttpOnly cookie token storage (Studio uses localStorage in v1)
- [-] Managed/hosted graph DB provisioning + DROP on Graph delete
- [-] Multi-connection Graphs (Graph ↔ GraphConnection stays 1:1 in MVP)
- [-] Source-ingestion connectors (PDF, DOCX, XLSX, CSV, TXT, Git, MySQL) — MVP uses external `dataset-importer` JSON instead
- [-] Tasks / Pipelines / Schedulers — only needed once source connectors exist
- [-] Username-change redirects (old usernames just 404 in MVP)

---

# Delivery Plan — Vertical Slices

Backend and frontend are built **together per feature**, not BE-first-then-FE. Each slice goes thin through every layer it touches.

## Working principles

- **Contract-first per slice.** Pydantic schemas → FastAPI OpenAPI → generated TS client in `studio/scripts/`. Both sides code against the same generated types. No hand-typed FE shapes.
- **Each slice is shippable.** "Done when" is a reproducible user action, not a checklist. If it can't be demoed in 30 seconds from a clean checkout, the slice isn't done — don't start the next one.
- **One moving target at a time.** Greenfield layers (L3 ingestion, L4 stitcher, L6 agents) get their own RFC before code.
- **Parallel tracks where possible.** After the Graph shell lands, multiple slices run as independent BE+FE pairs.

## Slice sequence

### S0 — Foundations (½ day, no UI)
- Alembic reset on `arch/redesign`
- `settings.secret_key` + `INVANA_ENCRYPTION_KEY` wired
- Empty `auth/` and `graphs/` modules mounted
- OpenAPI → TS client generator in `studio/scripts/`

**Done when:** `make dev` runs and Studio compiles against an empty typed client.

### S1 — Auth + bootstrap (gates everything)
- **BE:** User (incl. username) · bcrypt · JWT (access+refresh) · `/auth/*` · `invana init` CLI (no auto Graph) · `get_current_user` dep
- **FE:** `auth.store` · axios interceptor · `LoginPage` · `RegisterPage` (invite token) · protected route shell · post-login lands on `/graphs` (empty state prompts to create first Graph)

**Done when:** `invana init` creates root user with a username; UI login lands on empty `/graphs`.

### S1.5 — Workspace → Graph rename (RFC-017) — **shipped** ✅
- **BE:** [x] Workspace → Graph rename (+ `WorkspaceMember` → `GraphMember`, existing `Graph` → `GraphConnection`); `users.username`; `graphs.intent` + `graphs.setup_state`; routes re-prefixed to `/u/:username/:graphSlug/...`; Alembic regenerated.
- **FE:** [x] pages, routes, hooks, copy renamed; username added to `RegisterPage` + `ProfileSettingsPage`.

**Done when:** existing Layer 1 behaviors work under the new names, and `invana init` no longer creates a default Graph. — detail in [`mvp/layer-1-identity-access.md`](mvp/layer-1-identity-access.md).

### S2 — Graph shell + setup wizard — **shipped** ✅
- **BE:** [x] Graph CRUD; GraphConnection sub-resource (GET/PUT/DELETE + test/ping/introspect); `setup_state` + `require_graph_setup_complete`; `query` + `schemas` routers re-prefixed. Legacy `/api/v1/graph-connections/*` + `/api/v1/graphs/{cid}/query` + `/api/v1/schemas/{sid}/active-version` shims deleted.
- **FE:** [x] `/graphs` list · `/graphs/new` · `/u/:username/:graphSlug` overview with wizard · Connection + Intent settings pages · `/u/:username/:graphSlug/settings` index · context-aware left nav.

**Done when:** user creates a Graph, completes Graph Info via Neo4j, sees modeller / explorer / query unlock. — detail in [`mvp/layer-2-graph.md`](mvp/layer-2-graph.md).

### S3 — User graph model (reuse modeller) — partially shipped
- **BE:** [x] `GraphSchema` graph-scoped — `/u/:username/:graphSlug/schema/active-version` + `/connection/introspect`.
- **FE:** [~] `ModellerPage` at `/u/:username/:graphSlug/modeller`; Introspect wired up. **Schema canvas stubbed** — canvas re-integration tracked under Risk notes.

### S4 — LLM provider (graph-scoped) — **shipped** ✅
- **BE:** [x] `LLMProvider` entity + Fernet · CRUD + ping + set-default under `/u/:username/:graphSlug/llm/...` · partial unique on `is_default`.
- **FE:** [x] LLMs section in the graph rail · register / edit / delete provider · Test (save-first → ping) · Set default.

**Done when:** saved Anthropic key produces a 200 from `/llm/{id}/ping` for the active Graph. — detail in [`mvp/layer-2-graph.md`](mvp/layer-2-graph.md) (§ 2.6).

### S5 — Skills + Instructions (graph-scoped) — **shipped** ✅
- **BE:** [x] Skill + Instruction CRUD under `/u/:username/:graphSlug/{skills,instructions}/...`; unique (graph_id, name) on both; Instructions priority field (0–1000, sorted desc).
- **FE:** [x] Skills + Instructions sections in the rail · list + add/edit forms · full-page maximize routes.

**Done when:** user authors a skill, sees it persisted, edits it. ✅ — detail in [`mvp/layer-2-graph.md`](mvp/layer-2-graph.md) (§ 2.4 + § 2.5). Markdown editor (CodeMirror reuse) deferred — plain textareas for now.

> **S3, S4, S5 run as parallel tracks once S2 lands.** Different BE modules, different FE routes, no shared state.

### S6 — Dataset import (MVP — no connectors)
*Pre-work: RFC for the on-disk dataset format (`model.json` + `nodes/<Type>.json` + `edges/<Type>.json`), property-constraint vocabulary, and validation rules. Half-day spec.*

- **S6a — Model + validators (BE only):**
  - Dataset + ImportJob entities (Postgres) · `graph_model` JSONB column · `graph_id` FK
  - Pydantic schema for `model.json` + property constraints (string/int/float/bool/enum/datetime/uuid/json with required/min/max/length/pattern/enum.values)
  - Record validator runs model-driven checks; produces structured validation report (file, record_index, record_id, field, rule, message)
  - Referential integrity + node-id uniqueness checks
- **S6b — MinIO storage (BE only):**
  - MinIO in `docker-compose-infra.yml` · `INVANA_S3_*` settings · async S3 client
  - Bucket layout `graphs/<graph_id>/datasets/<dsid>/...` · streamed + multipart uploads
  - File tree + file-fetch endpoints
- **S6c — LocalExecutor + job lifecycle + log streaming (BE only):**
  - RFC-016 executor interface + LocalExecutor impl
  - ImportJob stages: upload → validate model → validate records → derive system graph model → persist → done
  - `import_job_logs` table with structured rows (timestamp, level, stage, message, record_ref)
  - SSE log stream endpoint
- **S6d — `dataset-importer` Python API + CLI (BE only):**
  - `invana.datasets.import_dataset(graph, name, path, *, refresh=False, strict=False)` returns `ImportJob` handle with `.wait()` / `.stream_logs()`
  - CLI: `invana datasets import --graph <username/slug> --name <name> --path <dir>`
- **S6e — Studio dataset detail (FE):**
  - Dataset browser + import form (drag-drop folder/tarball)
  - Detail page with four tabs: **Logs** (live SSE), **Files** (MinIO tree + preview), **Model** (form + small canvas diagram), **Dataset** (paginated record table, type selector, columns from model)
  - Job status badge · validation report panel on failed jobs

**Done when:** user prepares a folder with `model.json` + `nodes/Document.json` (one bad row violating `max_length`) + `edges/MENTIONS.json`, runs `invana datasets import --graph ravi/demo --name wiki --path ./examples/wiki`, opens Studio and sees: live logs streaming in **Logs**, the uploaded files in **Files**, the model rendered in **Model**, and the paginated records in **Dataset** with the failed row flagged in the validation report.

> Tasks / Pipelines / Schedulers / Source connectors / Distributed executors are **post-MVP**. Datasets are produced *externally* in MVP; the executor boundary is in place so Celery / Ray / K8s can drop in later without UI changes.

### S7 — Stitcher (smallest viable)
- **S7a:** mapping UI — dataset system-types on left, user-model concepts on right, drag-to-map
- **S7b:** materialize one dataset into the bound GraphConnection
- **S7c:** provenance — every materialized node carries `dataset_id` + `record_id` + `stitch_job_id`

**Done when:** user maps `Document` → user's `Document` concept, sees nodes in Explorer with source records attached.

### S8 — Pipelines
Chain + schedule on top of S6. Pure additive. *(Deferred candidate — only land if S6→S9 has slack.)*

### S9 — Agent runtime (vertical sub-slices)
- **S9a:** Agent entity + manual "run once" button (no autonomy)
- **S9b:** grounded LLM call — agent reads Graph instructions, queries graph, calls LLM with retrieved context, displays response with citation chips
- **S9c:** write-back into the graph + every run recorded
- **S9d:** success-criteria scoring + progress badge on Graph overview

**Done when:** user clicks "Ask" on a Graph, gets an answer with clickable provenance back to source records.

### S10 — External-agent API (§4.11)
Scoped tokens · retrieval endpoints (query / semantic / skill-mediated) · provenance in every response · archived-Graph read-only freeze.

### S11 — Graph lifecycle
`active → archived` toggle + read-only enforcement on every mutating route. Can slot in right after S2 — small and unblocks demo storytelling.

## Per-slice working pattern

- **Day 1:** define schemas + OpenAPI in BE; regenerate TS client; FE stubs the page against the typed client.
- **Day 2–N:** BE implements; FE wires real calls; both push to a feature branch.
- **Demo gate:** "Done when" sentence reproducible from clean checkout by someone else, otherwise slice isn't done.

## Risk notes

- **Don't start S6 until S4+S5 are stable.** Agent loop needs LLM + Skills; keep one moving target at a time.
- **S6 is much cheaper in MVP** because there's no connector framework — just JSON validation + storage. Ship it small, ship it fast.
- **Hold the line on "no source connectors in MVP."** Every "but PDFs would be easy" request is a slippery slope back into a connector framework. Users producing JSON externally is the contract.
- **S1.5 (the rename) is mechanical but touches everywhere.** Land it before S2 starts so no new code is written against the old names.
- **Generated TS client is the contract.** Hand-typed FE shapes will drift.
- **Canvas integration is an open dependency on S3 + S5.5.** The old `@invana/canvas-core` + `@invana/layouts-d3-force` packages are unpublished; the sibling `@invana/canvas` exposes a redesigned API surface that the old plugin code can't be retargeted to mechanically. Modeller's `SchemaCanvas`, Explorer's `GraphCanvas`, and `CanvasToolbar` are currently stubs that summarise counts. Wiring up the redesigned canvas is its own task — don't let it block other slices.
- **`graph_connections.graph_id` is currently nullable** — historical artefact from the deleted standalone connection surface. Tighten to `NOT NULL` in a future migration once any orphan rows are cleared.

## Parallelization map

```
S0 → S1 → S1.5 → S2 ─┬─→ S3
                     ├─→ S4
                     ├─→ S5
                     ├─→ S11
                     └─→ (S6 RFC) → S6a → S6b → S6c → S6d → S6e → S7 → (S8)
                                                                  └→ S9 → S10
```

Net: **S0→S5 is mostly assembly and re-prefixing — fast.** S6→S9 is the actual new platform — slow, RFC-gated, where the real learning happens.
