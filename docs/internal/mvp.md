# MVP — Implementation Checklist

Practical, build-ordered MVP scope derived from `docs/system-design.md`. Grouped by the 8-layer OS model. Each item is a unit of work — not a sentence, not an RFC. RFC links where the design already exists; `TBD` otherwise.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred post-1.0

## How to read this file

Every feature is decomposed into **three columns of work** so dependencies surface at planning time, not at implementation time:

- **Backend** — engine work: models, services, routes, jobs, validators.
- **Frontend** — Studio work: routes, pages, components, stores, hooks. Always defined alongside BE so the FE isn't accidentally constrained by what the BE happens to ship.
- **Integrations** — third-party libraries, infra services, vendor SDKs, dev-only tooling. Listed so they can be added to `pyproject.toml` / `package.json` / `docker-compose-infra.yml` *before* the feature is coded.

`N/A` is a legitimate value — say it explicitly so a future reader doesn't assume an omission is an oversight. When BE and FE are built in lockstep, this triplet is also the per-slice contract surface.

---

## Layer 1 — Identity & Access

### 1.1 User auth (register, login, refresh, me)
- **Backend:** [ ] `User` model · bcrypt hashing · `/auth/register` (invite-gated) · `/auth/login` · `/auth/refresh` · `/auth/me` · JWT encode/decode (HS256, access 15m + refresh 7d) · `get_current_user` dep applied to all non-`/auth` routes
- **Frontend:** [ ] `LoginPage` · `RegisterPage` (invite-redeem) · `stores/auth.store.ts` (Zustand) · axios interceptor (attach Bearer, refresh on 401) · `useAuth` hook · `ProtectedRoute` wrapper
- **Integrations:** `passlib[bcrypt]` (password hashing) · `PyJWT` (token codec) · browser `localStorage` (token cache, v1; HttpOnly cookies deferred)

### 1.2 CLI bootstrap
- **Backend:** [ ] `invana init` command — prompts for admin credentials, creates root user, writes initial workspace, emits first-login URL/token · idempotent guard if root user exists
- **Frontend:** [ ] First-login flow (token redeem → set password if not already set) — reuses `LoginPage`
- **Integrations:** existing CLI framework (`typer` or `click` — match what `engine/src/invana/cli/` already uses) · `rich` for prompt UX if not already in

### 1.3 Invitations
- **Backend:** [ ] `Invitation` entity (token, email, role, expires_at, accepted_at) · `POST /auth/invitations` (issue) · `POST /auth/register?invite=<token>` accept path
- **Frontend:** [ ] Invitations list in admin/settings (copy-link UX, no email send in MVP) · `RegisterPage` reads `?invite=<token>` query param
- **Integrations:** email send is **deferred** for MVP — invitation URLs are copy-pasted by the inviter

### 1.4 Roles
- **Role is workspace-scoped, not user-scoped.** Role lives on `workspace_members.role` enum (`developer` | `analyst` | `admin`). Platform-level admin is `users.is_superuser` (gates `/admin`). The same user can be `admin` of their personal workspace and `developer` of another. See `docs/internal/mvp/layer-1-identity-access.md` for the full role matrix.
- **Backend:** [x] `workspaces` + `workspace_members` tables · `workspace_role` enum · `get_workspace_membership` dep · `require_workspace_admin` / `require_workspace_builder` / `require_workspace_member` deps · `require_superuser` dep
- **Frontend:** [x] `useAuth()` exposes `role`, `isAdmin`, `isBuilder`, `isSuperuser`, `displayName`, `activeMembership` · `RoleGate` component for conditional UI
- **Integrations:** none

### 1.5 Admin UI gating
- **Backend:** [ ] starlette-admin behind JWT + admin role check
- **Frontend:** [ ] Admin link in app shell shown only to admins
- **Integrations:** `starlette-admin` (existing)

## Layer 2 — Workspace (global registries)

Global registries: defined once, bound into many missions.

### 2.1 Connectors registry (graph DB drivers only in MVP)
- **Backend:** [ ] Existing connectors at `engine/src/invana/graph/connectors/` for Neo4j, Memgraph, ArcadeDB, JanusGraph, Neptune, TinkerGraph (RFC-001) — these are **query drivers**, not source-ingestion connectors
- **Frontend:** [ ] Existing `GraphConnectionForm` in Studio
- **Integrations:** `neo4j` (driver) · `gremlinpython` · per-driver native libs already in `integrations/invana-{db}/`
- **Deferred (post-MVP):** [-] Source-ingestion connectors (PDF / DOCX / XLSX / CSV / TXT / Git / MySQL) — datasets are produced externally in MVP, see L4 · [-] Connector plugin interface · [-] Custom connector registration

### 2.2 Skills registry
- **Backend:** [ ] `Skill` entity — `name`, `description`, `content` (markdown), `when_to_use` · CRUD routes
- **Frontend:** [ ] `SkillsListPage` · `SkillEditorPage` with markdown editor · `useSkills` hook
- **Integrations:** CodeMirror 6 markdown mode (reuse query console instance) · `@invana/design-kit` form components

### 2.3 LLM configs registry
- **Backend:** [ ] `LLMProvider` entity — provider enum (anthropic / openai / google / azure / local) · `model_id` · `api_key_encrypted` (Fernet) · `base_url` (optional) · guardrails (token budgets, allowed model families) · default-provider flag enforced at service layer · CRUD routes · `POST /llm/{id}/ping` for credential test
- **Frontend:** [ ] LLM settings tab · provider/model selector · masked api-key field · guardrails form · "Test connection" button
- **Integrations:** `cryptography.Fernet` (reuses `INVANA_ENCRYPTION_KEY`) · per-provider Python SDK lazy-imported: `anthropic` (primary), `openai`, `google-generativeai` (optional, post-MVP can be deferred)

### 2.4 Agents registry
- **Backend:** [ ] `Agent` entity — composes `skill_ids[]` + `llm_config_id` + operating policy JSONB (autonomy level, fire conditions, reporting) · CRUD routes
- **Frontend:** [ ] `AgentsListPage` · `AgentEditorPage` with skill picker, LLM picker, policy form
- **Integrations:** none (depends on 2.2 + 2.3 entities only)

## Layer 3 — Mission

### 3.1 Mission CRUD + tags
- **Backend:** [ ] `Mission` entity — `name`, `slug` (unique per owner), `description`, `objectives`, `goals`, `success_criteria`, `status` (`Open` | `Closed`), `owner_id` · `MissionTag` flat join (no global tags table) · ownership service + dep · all routes under `/api/v1/missions/{mid}/...`
- **Frontend:** [ ] `/missions` list · `/missions/new` wizard (name → objectives + goals + success criteria → tags → bindings) · `/missions/{mid}` overview · `useMissions` (TanStack Query) · mission switcher in app shell
- **Integrations:** none

### 3.2 Mission bindings (Skills · Agents · LLMs · Graph DBs · Datasets)
- **Backend:** [ ] Per-resource join tables (or a unified `mission_bindings` polymorphic table — pick during S2) · binding service · enforced visibility (mission only sees what it bound)
- **Frontend:** [ ] Bindings panel in mission settings · multi-select picker per resource type · unbind confirmation
- **Integrations:** none

### 3.3 Mission lifecycle (Open / Closed)
- **Backend:** [ ] `status` enum · middleware/dep that blocks mutating routes on closed missions · `POST /missions/{mid}/close` + `/reopen`
- **Frontend:** [ ] Close/reopen toggle in settings · read-only banner across all mission pages when closed · disable mutating actions
- **Integrations:** none

### 3.4 Mission settings shell
- **Backend:** [ ] N/A (composition of other features)
- **Frontend:** [ ] `/missions/{mid}/settings` with tabs: **General** · **Graphs** · **LLM** · **Skills** · **Instructions** · **Agents** · **Datasets** · (no `Connectors` tab in MVP)
- **Integrations:** `@invana/design-kit` tab component

### 3.5 Delete semantics
- **Backend:** [ ] Hard delete · downward-only cascade per RFC-012 cascade matrix · server-side ownership check before delete
- **Frontend:** [ ] Confirmation dialog showing cascade preview (counts of children that will be removed)
- **Integrations:** none

## Layer 4 — Ingestion (Datasets via `dataset-importer`)

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

`type` is implicit from the filename. `id` is the source-stable identifier used for identity resolution by the stitcher (L5). Edge `from`/`to` must resolve to node `id`s present in the same dataset (or already imported into the mission — TBD per cross-dataset reference policy).

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
- [ ] Bucket layout: `s3://<bucket>/missions/<mission_id>/datasets/<dataset_id>/{model.json,nodes/*,edges/*}`
- [ ] Retention — files retained until the Dataset row is hard-deleted; deletion cascades to MinIO objects
- [ ] Streamed uploads for large files; multipart for files > 64 MB

### Import job (executor + log streaming)
- [ ] `ImportJob` entity — `id`, `dataset_id`, `status` (queued | running | succeeded | failed | cancelled), `started_at`, `finished_at`, `progress` (records_processed / records_total), `error_count`, `warning_count`
- [ ] Executed via pluggable executor — **MVP = LocalExecutor** (in-process asyncio task), interface matches RFC-016 so Celery / Ray / K8s can drop in later
- [ ] Job stages: `upload → validate model → validate records → derive system graph model → persist → done`
- [ ] **Structured log lines** persisted per job: `timestamp`, `level`, `stage`, `message`, optional `record_ref`
- [ ] Log storage: append-only table (`import_job_logs`) or MinIO append blob — TBD per volume; MVP = Postgres table for simplicity
- [ ] **Log streaming to UI** via Server-Sent Events: `GET /missions/{mid}/datasets/{dsid}/jobs/{jid}/logs/stream`
- [ ] Idempotent re-import — same `(mission_id, name)` triggers a new `ImportJob` that replaces the dataset's files + records atomically on success; failed jobs leave prior state intact

### `dataset-importer` Python API
- [ ] `invana.datasets.import_dataset(mission_id, name, path, *, refresh=False, strict=False)` — single entrypoint
- [ ] Uploads `path/` to MinIO, creates Dataset + ImportJob rows, dispatches to executor, returns `ImportJob` handle
- [ ] `job.wait()` / `job.stream_logs()` helpers for scripts
- [ ] Returns `Dataset` (with model + counts) once job succeeds; raises with validation report on failure
- [ ] CLI shim: `invana datasets import --mission <slug> --name <name> --path <dir> [--refresh] [--strict]`

### Engine surface
- [ ] Dataset entity — `id`, `mission_id`, `name`, `graph_model` (JSONB), `storage_uri` (s3://…), `record_counts`, `last_job_id`, `created_at`, `updated_at`
- [ ] `POST /api/v1/missions/{mid}/datasets` — register a dataset, kicks off the import job
- [ ] `GET  /api/v1/missions/{mid}/datasets` — list
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}` — detail (model + counts + last job)
- [ ] `DELETE /api/v1/missions/{mid}/datasets/{dsid}` — hard delete (DB + MinIO)
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/jobs` — list job runs
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/jobs/{jid}` — job detail (status, progress, error/warning counts)
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/jobs/{jid}/logs` — paginated logs
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/jobs/{jid}/logs/stream` — SSE log stream
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/files` — file tree (lists MinIO keys under the dataset's prefix)
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/files/{path}` — fetch a file (signed URL or proxied)
- [ ] `GET  /api/v1/missions/{mid}/datasets/{dsid}/records?type=<T>&page=<n>&page_size=<m>` — paginated record view, scoped to one node/edge type

### Studio surface
- [ ] Dataset browser — list per mission, show graph-model summary + record counts + last job status
- [ ] "Import dataset" form — drag-drop a folder/tarball/zip; uploaded to MinIO via signed URLs; engine kicks off the import job
- [ ] **Dataset detail page — four tabs:**
  - [ ] **Logs** — live SSE log stream during a run; full history when complete; filter by stage / level; copyable
  - [ ] **Files** — file tree of MinIO contents (`model.json`, `nodes/`, `edges/`); click a file to preview JSON (truncated for large files)
  - [ ] **Model** — graph-model view: node types as cards (properties + constraints), edge types showing `from → to`; rendered as both a structured form view and as a small graph diagram via `@invana/canvas`
  - [ ] **Dataset** — table view of records with pagination, sortable columns, type selector (toggle between node types and edge types); columns derived from the graph model
- [ ] Job status badge on browser + detail pages: queued / running / succeeded / failed
- [ ] Validation report panel on failed jobs — grouped by file, expandable per error, links to the offending record in the Files tab

### L4 Integrations (consolidated)
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

## Layer 5 — Modeling (User Graph Model · Stitcher)

### 5.1 User graph model editor
- **Backend:** [ ] Reuse existing `GraphSchema` machinery (RFC-002) · ensure mission-scoped (FK added in S3) · existing versioning carries over
- **Frontend:** [ ] Nest existing `ModellerPage` under `/missions/{mid}/graph/{gid}/modeller` · `missionId` URL param forwarded to API
- **Integrations:** existing modeller code (`engine/src/invana/modeller/`)

### 5.2 Stitcher — mapping (system type → user concept)
- **Backend:** [ ] `StitchMapping` entity (`dataset_id`, `system_type`, `user_type`, `property_map` JSONB) · CRUD routes · validation that referenced types exist in both ends
- **Frontend:** [ ] Mapping UI — two columns: dataset system-types (left, from L4 graph_model) · user model concepts (right) · drag-to-map · per-property mapping form
- **Integrations:** none

### 5.3 Stitcher — identity resolution
- **Backend:** [ ] Identity-resolution config per mapping (deterministic by `id`, or property-match rules: exact / case-insensitive / fuzzy) · resolution engine · conflict report
- **Frontend:** [ ] ID-resolution rule editor · conflict-review UI (pairs of records flagged as possibly-same, accept/reject)
- **Integrations:** `rapidfuzz` (string similarity for fuzzy matching) — *evaluate at S8 spike*

### 5.4 Stitcher — materialization (into bound graph DB)
- **Backend:** [ ] `StitchJob` entity (similar shape to `ImportJob`) · executed via LocalExecutor · writes nodes/edges to the bound graph DB · idempotent re-stitch · structured log lines
- **Frontend:** [ ] "Materialize" button in mission overview · job status + progress · stats (nodes/edges materialized) · log viewer (reuses SSE pattern from L4)
- **Integrations:** existing graph DB connectors · RFC-016 executor · `sse-starlette`

### 5.5 Stitch trace + provenance
- **Backend:** [ ] Every materialized node/edge carries `dataset_id` + `record_id` + `stitch_job_id` as properties or in a side-table · `GET /missions/{mid}/provenance/{node_or_edge_id}`
- **Frontend:** [ ] Provenance panel in Explorer — click a node/edge → see source dataset + record + import job
- **Integrations:** none

## Layer 6 — Knowledge Graph

### 6.1 Query API
- **Backend:** [ ] Existing `/query` route re-prefixed under `/missions/{mid}/graphs/{gid}/query` (Cypher + Gremlin) · ownership dep
- **Frontend:** [ ] Existing query console (CodeMirror) nested under mission route
- **Integrations:** existing graph DB connectors

### 6.2 Semantic / vector retrieval
- **Backend:** [ ] Vector-index mixin for graph DBs that support it (per CLAUDE.md) · embedding generation pipeline · `POST /missions/{mid}/graphs/{gid}/search?type=semantic`
- **Frontend:** [ ] Semantic search box in Explorer · result list with similarity scores
- **Integrations:** embedding provider TBD — likely `anthropic` (when/if available) or `openai` text-embedding-3-small; spike before committing · per-DB vector index support (Neo4j vector index, Memgraph, ArcadeDB)

### 6.3 Skill-mediated retrieval
- **Backend:** [ ] Skill-execution path that returns ranked grounded snippets (each with provenance) · invoked by agent loop
- **Frontend:** [ ] Surfaced inside agent UI (L7) — not a standalone page
- **Integrations:** depends on 2.2 Skills + L7 agent runtime

### 6.4 Provenance on retrieval responses
- **Backend:** [ ] Every retrieval response schema includes `nodes[]`, `edges[]`, `records[]` (with `dataset_id` + `record_id`), `import_job_id`
- **Frontend:** [ ] Citation chips on every answer · click-through opens the source record in dataset Files/Records tab
- **Integrations:** none

### 6.5 Studio Explorer (existing)
- **Backend:** [ ] No change
- **Frontend:** [ ] Nest existing `ExplorerPage` under `/missions/{mid}/graph/{gid}/explorer`
- **Integrations:** `@invana/canvas` (PixiJS 8, WebGPU/WebGL — existing)

## Layer 7 — Intelligence (Agents · LLM grounding · Success scoring)

### 7.1 Agent runtime
- **Backend:** [ ] Agent loop service: read mission instructions → plan with bound skills → query graph for grounded context → call bound LLM → handle result (return / write-back / fail) · `POST /missions/{mid}/agents/{aid}/run` (manual fire) · streaming response via SSE
- **Frontend:** [ ] "Ask" / "Run agent" UI in mission overview · streaming response panel · agent picker
- **Integrations:** per-provider Python SDK (`anthropic` first) · `sse-starlette` for streaming

### 7.2 Grounded LLM call
- **Backend:** [ ] Prompt template assembly (instructions + skills + retrieved context) · grounding contract enforcement (refuse to call LLM with empty retrieved context for grounded ops) · prompt caching where supported (Anthropic API)
- **Frontend:** [ ] Citation chips on rendered LLM output linking back to source records
- **Integrations:** `anthropic` SDK (prompt caching first-class)

### 7.3 Agent write-back
- **Backend:** [ ] Writeback service · validates new nodes/edges against user graph model · stamps provenance (`agent_run_id`, `created_by=agent`) · auto-commit vs review-required toggle on agent policy
- **Frontend:** [ ] Review panel (when policy=review) — diff view of proposed writes, accept/reject per node/edge
- **Integrations:** existing graph DB connectors

### 7.4 Agent observability
- **Backend:** [ ] `AgentRun` entity — captures prompt, retrieved context, LLM response, write-back delta, status, latency, token usage · `GET /missions/{mid}/agent-runs` + detail
- **Frontend:** [ ] Agent runs list per mission · run detail (prompt + context + response + delta tabs, mirrors dataset detail UX)
- **Integrations:** reuses log/streaming infra from L4

### 7.5 Success-criteria scoring
- **Backend:** [ ] Criteria evaluator — each criterion is a query against the knowledge graph returning pass/fail · scheduled or on-demand re-eval
- **Frontend:** [ ] Progress badge + breakdown on mission overview · per-criterion status
- **Integrations:** none

### 7.6 Groundedness enforcement + "cannot answer" path
- **Backend:** [ ] Detect empty retrieved context · explicit "cannot answer" response payload (distinct from a model-generated empty answer) · log groundedness-fail as defect-class event
- **Frontend:** [ ] Distinct visual rendering for "cannot answer" — never styled like a normal answer
- **Integrations:** none

## Layer 8 — Interfaces

### 8.1 CLI
- **Backend:** [ ] `invana init` (L1.2) · `invana start` (run engine + studio) · `invana migrate` (alembic upgrade) · `invana version` · `invana datasets import ...` (L4) · CLI does **not** register additional users (system-design §4.1)
- **Frontend:** N/A
- **Integrations:** `typer` / `click` (whichever is in `engine/src/invana/cli/`) · `rich` for output formatting · `httpx` if CLI talks to engine over HTTP

### 8.2 Studio UI shell
- **Backend:** [ ] Optionally serve Studio static assets from FastAPI in single-image Docker mode (`/static/*` → built Studio bundle)
- **Frontend:** [ ] Application shell — sidebar, header, mission switcher · all routes mission-scoped (`/missions/{mid}/...`) · markdown editor reused for Skills + Instructions · design-kit components only (CLAUDE.md #9) · `@invana/canvas` for all graph rendering (CLAUDE.md #10)
- **Integrations:** React 19 · Vite · `@invana/design-kit` · `@invana/canvas` · TanStack Query · Zustand · React Router · CodeMirror 6 · TailwindCSS 4

### 8.3 External-agent API (§4.11)
- **Backend:** [ ] `ScopedToken` entity (`mission_id`, `scope` enum `read` | `read_write`, `created_at`, `last_used_at`, `revoked_at`) · `POST /missions/{mid}/tokens` (issue, returned exactly once) · token-auth dep parallel to JWT · retrieval endpoints reusing 6.x · write-back endpoints reusing 7.3 · closed-mission read-only freeze
- **Frontend:** [ ] Tokens tab in mission settings · "Issue token" flow showing token once with copy button · revoke action · last-used timestamp
- **Integrations:** `secrets` (stdlib) for opaque API key generation · same Fernet key for at-rest storage of token hash

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
- **Identity resolution (spike):** `rapidfuzz` (string similarity, post-S8a evaluation)
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

- [ ] Encryption at rest — Fernet key (`INVANA_ENCRYPTION_KEY`) for `graphs.auth_encrypted` + `llm_providers.api_key_encrypted`
- [ ] Object storage — MinIO in dev (`docker-compose-infra.yml`); S3-compatible client so prod can swap to AWS S3 / GCS / R2. Used for dataset files (model + nodes + edges). `INVANA_S3_*` settings.
- [ ] Logging — RFC-006
- [ ] Telemetry — RFC-007
- [ ] CORS — permissive in dev, `INVANA_CORS_ALLOWED_ORIGINS` in prod
- [ ] Alembic — reset on `arch/redesign`; single new initial migration covers full redesigned schema (RFC-012)
- [ ] Pluggable executor (RFC-016) — orchestration as a boundary; MVP ships **LocalExecutor** (in-process asyncio); distributed executors deferred
- [ ] Changesets — every user-facing change carries one (CLAUDE.md rule #8)
- [ ] Docker images — `invana/engine`, `invana/studio` (multi-target Dockerfile)
- [ ] Docs — MkDocs Material site auto-built from `docs/`

## Deferred (post-1.0)

- [-] Org / team sharing of missions
- [-] Soft deletes / trash / undo
- [-] Ontology / semantics layer beyond user graph model
- [-] Auto-generation of user models from imported sources (RFC-015, planned)
- [-] Refresh-token rotation policy
- [-] HttpOnly cookie token storage (Studio uses localStorage in v1)
- [-] Managed/hosted graph DB provisioning + DROP on mission delete
- [-] Strategy layer between Mission and children
- [-] Source-ingestion connectors (PDF, DOCX, XLSX, CSV, TXT, Git, MySQL) — MVP uses external `dataset-importer` JSON instead
- [-] Tasks / Pipelines / Schedulers — only needed once source connectors exist

---

# Delivery Plan — Vertical Slices

Backend and frontend are built **together per feature**, not BE-first-then-FE. Each slice goes thin through every layer it touches.

## Working principles

- **Contract-first per slice.** Pydantic schemas → FastAPI OpenAPI → generated TS client in `studio/scripts/`. Both sides code against the same generated types. No hand-typed FE shapes.
- **Each slice is shippable.** "Done when" is a reproducible user action, not a checklist. If it can't be demoed in 30 seconds from a clean checkout, the slice isn't done — don't start the next one.
- **One moving target at a time.** Greenfield layers (L4 ingestion, L5 stitcher, L7 agents) get their own RFC before code.
- **Parallel tracks where possible.** After mission shell lands, multiple slices run as independent BE+FE pairs.

## Slice sequence

### S0 — Foundations (½ day, no UI)
- Alembic reset on `arch/redesign`
- `settings.secret_key` + `INVANA_ENCRYPTION_KEY` wired
- Empty `auth/` and `missions/` modules mounted
- OpenAPI → TS client generator in `studio/scripts/`

**Done when:** `make dev` runs and Studio compiles against an empty typed client.

### S1 — Auth + bootstrap (gates everything)
- **BE:** User · bcrypt · JWT (access+refresh) · `/auth/*` · `invana init` CLI · `get_current_user` dep
- **FE:** `auth.store` · axios interceptor · `LoginPage` · `RegisterPage` (invite token) · protected route shell

**Done when:** `invana init` creates root user; UI login lands on empty `/missions`.

### S2 — Mission shell
- **BE:** Mission + MissionTag · ownership service · `/missions` CRUD
- **FE:** `/missions` list · `/missions/new` wizard (name → objectives + goals + success criteria → tags) · `/missions/{mid}` overview

**Done when:** user creates, lists, opens, deletes a mission.

### S3 — Graph DB binding (mostly re-prefix)
- **BE:** add `mission_id` FK to `graphs` + `graph_schemas` · re-prefix existing `graphs`/`query`/`schemas` routers under `/missions/{mid}/...` · ownership dep
- **FE:** Settings → Graphs tab using existing `GraphConnectionForm` · query console nested

**Done when:** user attaches Neo4j to a mission and runs a Cypher query.

### S4 — User graph model (reuse modeller)
- **BE:** nothing new — already mission-scoped after S3
- **FE:** nest existing `ModellerPage` under `/missions/{mid}/graph/{gid}/modeller`

**Done when:** user authors ontology against the bound graph.

### S5 — LLM provider
*Pre-work: resolve RFC-012 (mission-scoped) vs system-design §2/§5 (global registry + binding) divergence. ½ day RFC amendment.*

- **BE:** `LLMProvider` entity + Fernet · CRUD · `/llm/ping` round-trip
- **FE:** Settings → LLM tab · register provider · test-call button

**Done when:** saved Anthropic key produces a 200 from `/llm/ping`.

### S6 — Skills + Instructions
- **BE:** Skill + Instruction CRUD
- **FE:** Settings → Skills + Instructions tabs · CodeMirror markdown editor (reuse query console instance)

**Done when:** user authors a skill, sees it persisted, edits it.

> **S3, S4, S5, S6 run as parallel tracks once S2 lands.** Different BE modules, different FE routes, no shared state.

### S7 — Dataset import (MVP — no connectors)
*Pre-work: RFC for the on-disk dataset format (`model.json` + `nodes/<Type>.json` + `edges/<Type>.json`), property-constraint vocabulary, and validation rules. Half-day spec.*

- **S7a — Model + validators (BE only):**
  - Dataset + ImportJob entities (Postgres) · `graph_model` JSONB column
  - Pydantic schema for `model.json` + property constraints (string/int/float/bool/enum/datetime/uuid/json with required/min/max/length/pattern/enum.values)
  - Record validator runs model-driven checks; produces structured validation report (file, record_index, record_id, field, rule, message)
  - Referential integrity + node-id uniqueness checks
- **S7b — MinIO storage (BE only):**
  - MinIO in `docker-compose-infra.yml` · `INVANA_S3_*` settings · async S3 client
  - Bucket layout `missions/<mid>/datasets/<dsid>/...` · streamed + multipart uploads
  - File tree + file-fetch endpoints
- **S7c — LocalExecutor + job lifecycle + log streaming (BE only):**
  - RFC-016 executor interface + LocalExecutor impl
  - ImportJob stages: upload → validate model → validate records → derive system graph model → persist → done
  - `import_job_logs` table with structured rows (timestamp, level, stage, message, record_ref)
  - SSE log stream endpoint
- **S7d — `dataset-importer` Python API + CLI (BE only):**
  - `invana.datasets.import_dataset(mission_id, name, path, *, refresh=False, strict=False)` returns `ImportJob` handle with `.wait()` / `.stream_logs()`
  - CLI: `invana datasets import --mission <slug> --name <name> --path <dir>`
- **S7e — Studio dataset detail (FE):**
  - Dataset browser + import form (drag-drop folder/tarball)
  - Detail page with four tabs: **Logs** (live SSE), **Files** (MinIO tree + preview), **Model** (form + small canvas diagram), **Dataset** (paginated record table, type selector, columns from model)
  - Job status badge · validation report panel on failed jobs

**Done when:** user prepares a folder with `model.json` + `nodes/Document.json` (one bad row violating `max_length`) + `edges/MENTIONS.json`, runs `invana datasets import --mission demo --name wiki --path ./examples/wiki`, opens Studio and sees: live logs streaming in **Logs**, the uploaded files in **Files**, the model rendered in **Model**, and the paginated records in **Dataset** with the failed row flagged in the validation report.

> Tasks / Pipelines / Schedulers / Source connectors / Distributed executors are **post-MVP**. Datasets are produced *externally* in MVP; the executor boundary is in place so Celery / Ray / K8s can drop in later without UI changes.

### S8 — Stitcher (smallest viable)
- **S8a:** mapping UI — dataset system-types on left, user-model concepts on right, drag-to-map
- **S8b:** materialize one dataset into the bound graph DB
- **S8c:** provenance — every materialized node carries `dataset_id` + `task_id`

**Done when:** user maps `Document` → user's `Document` concept, sees nodes in Explorer with source records attached.

### S9 — Pipelines
Chain + schedule on top of S7. Pure additive.

### S10 — Agent runtime (vertical sub-slices)
- **S10a:** Agent entity + manual "run once" button (no autonomy)
- **S10b:** grounded LLM call — agent reads instructions, queries graph, calls LLM with retrieved context, displays response with citation chips
- **S10c:** write-back into the graph + every run recorded
- **S10d:** success-criteria scoring + mission progress badge

**Done when:** user clicks "Ask" in a mission, gets an answer with clickable provenance back to source records.

### S11 — External-agent API (§4.11)
Scoped tokens · retrieval endpoints (query / semantic / skill-mediated) · provenance in every response · closed-mission read-only freeze.

### S12 — Mission lifecycle
`Open → Closed` toggle + read-only enforcement on every mutating route. Can slot in right after S2 — small and unblocks demo storytelling.

## Per-slice working pattern

- **Day 1:** define schemas + OpenAPI in BE; regenerate TS client; FE stubs the page against the typed client.
- **Day 2–N:** BE implements; FE wires real calls; both push to a feature branch.
- **Demo gate:** "Done when" sentence reproducible from clean checkout by someone else, otherwise slice isn't done.

## Risk notes

- **Don't start S7 until S5+S6 are stable.** Agent loop needs LLM + Skills; keep one moving target at a time.
- **S7 is much cheaper in MVP** because there's no connector framework — just JSON validation + storage. Ship it small, ship it fast.
- **Hold the line on "no source connectors in MVP."** Every "but PDFs would be easy" request is a slippery slope back into a connector framework. Users producing JSON externally is the contract.
- **Resolve workspace-global vs mission-scoped Skills/LLM before S5.** Re-doing it after S10 ships is the worst time.
- **Generated TS client is the contract.** Hand-typed FE shapes will drift.

## Parallelization map

```
S0 → S1 → S2 ─┬─→ S3 ──→ S4
              ├─→ S5
              ├─→ S6
              ├─→ S12
              └─→ (S7 RFC) → S7a → S7b → S7c → S7d → S8 → S9
                                                          └→ S10 → S11
```

Net: **S0→S6 is mostly assembly and re-prefixing — fast.** S7→S10 is the actual new platform — slow, RFC-gated, where the real learning happens.
