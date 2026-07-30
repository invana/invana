# MVP — Implementation Checklist

Build-ordered MVP scope derived from `docs/system-design.md`. This file is the **spine** — architecture, slice sequence, cross-cutting decisions. Feature detail lives in [`mvp/studio.md`](mvp/studio.md) (frontend) and [`mvp/engine.md`](mvp/engine.md) (backend).

## How to read this file

| Reading for | Go to |
|---|---|
| What the user does, and what they see | [`mvp/studio.md`](mvp/studio.md) — journeys, stories, flows |
| What the data looks like, and what the endpoints are | [`mvp/engine.md`](mvp/engine.md) — entities, APIs, guards |
| What to build next, and in what order | **this file** — slice sequence + risks |
| Why a decision was made | the RFC in [`mvp/`](mvp/) — start with **RFC-049** (Atlas) and **RFC-048** (thoughts & thinking) |

Status markers are used identically in all three: `[ ]` not started · `[~]` in progress · `[x]` done ·
`[-]` deferred post-1.0. Third-party dependencies live with the side that installs them — Python in
`engine.md`, TypeScript in `studio.md`, shared infra below.

## Architecture summary (RFC-017)

The MVP container model is **`User → Atlas (1:1 Connection)`**. There is no Workspace and no Mission entity — both are folded into `Atlas`. `Atlas` carries members (binary access — roles & invitations removed, RFC-023), the DB connection (1:1), schema, instructions/objectives, datasets, skills, LLM bindings, and agents.

All atlas-scoped URLs are namespaced under `/u/:username/:atlasSlug/...`. Users have a globally unique `username`; `atlases.slug` is unique per owner. The URL path parameter is named `atlasSlug` (the data field is still `Atlas.slug`) — disambiguates from generic "slug" in routing code.

A new Atlas progresses through a **setup wizard** (Atlas Info / Instructions / Skills / Datasets) before all analytical features unlock — see § 2.2.

## Engine layering (RFC-048)

The engine is **a control plane, not a worker**. Analytical work is not done inside a request. **A query is a Thought, and machines do the Thinking**: the ask is recorded, a *thinking* is opened on it, a pluggable runtime executes it, and the canvas subscribes to the resulting **thought stream**. `engine/src/invana/` is layered with a one-way dependency graph, lint-enforced:

`core/` (models · services · db · settings — no web, no orchestrator) → `tasks/` (typed, orchestrator-agnostic units of work) → `agents/` (workflow spec + interpreter) → `runtime/` (`Runtime` protocol + bundled `inline` adapter) → `api/` (FastAPI control plane) + `worker/` (task host entrypoint).

Rules: `core`/`tasks`/`agents` never import `api`; **nothing** under `src/invana/` imports `prefect` — the Prefect adapter is a separate distribution, `integrations/invana-prefect/`, registered through the `invana.runtimes` entry point exactly like a graph connector. Two distributions total: `invana` + `invana-prefect`. Full design and the decision record: [`mvp/rfc-048-agent-runtime-on-prefect.md`](mvp/rfc-048-agent-runtime-on-prefect.md); the target package tree: [`mvp/agent-runtime-code-structure.md`](mvp/agent-runtime-code-structure.md).

---

## Where the scope lives

This file is the **spine**: the shared architecture, the slice sequencing, and the cross-cutting
decisions. Per-feature detail lives in two documents so each side reads as its own spec.

| Document | Covers | Shape |
|---|---|---|
| [`mvp/studio.md`](mvp/studio.md) | Frontend — user stories, user journeys, screens, flows | organised by **user goal**, with mermaid journey diagrams |
| [`mvp/engine.md`](mvp/engine.md) | Backend — architecture, data model, API surface, guards, config | organised by **data and endpoints**, in tables |

Design records for individual decisions stay as RFCs in [`mvp/`](mvp/).

| Area | Studio | Engine |
|---|---|---|
| Concept net (all entities + relationships) | — | §2 |
| Identity & access | Journey 2 | §4.1 |
| Atlas container & settings | Journey 3 | §4.2 |
| Model authoring | Journey 4 | §4.3 |
| Datasets & stitching | Journey 5 | §4.4 · §4.5 |
| Asking questions | Journey 6 | §4.6 · §4.7 |
| Operating & external access | Journey 7 | §4.8 |

**Both sides ship together.** A feature is not done when the backend lands — the slice sequence below
is the contract, and every slice names its BE and FE halves.

---

## Cross-cutting

- [ ] Encryption at rest — Fernet key (`INVANA_ENCRYPTION_KEY`) for `connections.auth_encrypted` + `llm_providers.api_key_encrypted`
- [ ] Object storage — MinIO in dev (`docker-compose-infra.yml`); S3-compatible client so prod can swap to AWS S3 / GCS / R2. Used for dataset files (model + nodes + edges). `INVANA_S3_*` settings.
- [ ] Logging — RFC-006
- [ ] Telemetry — RFC-007 (engine traces/metrics/logs) + RFC-025 (studio end-to-end query→render tracing) + RFC-026 (session/message tracing + FE→BE stitching fix)
- [ ] CORS — permissive in dev, `INVANA_CORS_ALLOWED_ORIGINS` in prod
- [ ] Alembic — reset on `arch/redesign`; single new initial migration covers full redesigned schema (RFC-012 + RFC-017)
- [ ] Runtime seam (RFC-048) — orchestration behind one protocol; the bundled `inline` adapter needs no infra, `invana-prefect` ships as a separate distribution
- [ ] Changesets — every user-facing change carries one (CLAUDE.md rule #8)
- [ ] Docker images — `invana/engine`, `invana/studio` (multi-target Dockerfile)
- [ ] Docs — MkDocs Material site auto-built from `docs/`

## Deferred (post-1.0)

- [-] Org / team layer above Atlas
- [-] Soft deletes / trash / undo
- [-] Ontology / semantics layer beyond user graph model
- [-] Auto-generation of user models from imported sources (RFC-015, planned)
- [-] Refresh-token rotation policy
- [-] HttpOnly cookie token storage (Studio uses localStorage in v1)
- [-] Managed/hosted graph DB provisioning + DROP on Atlas delete
- [-] Multi-connection Atlases (Atlas ↔ Connection stays 1:1 in MVP)
- [-] Source-ingestion connectors (PDF, DOCX, XLSX, CSV, TXT, Git, MySQL) — MVP uses external `dataset-importer` JSON instead
- [-] Tasks / Pipelines / Schedulers — only needed once source connectors exist
- [-] Username-change redirects (old usernames just 404 in MVP)

---

# Delivery Plan — Vertical Slices

Backend and frontend are built **together per feature**, not BE-first-then-FE. Each slice goes thin through every layer it touches.

## Working principles

- **Contract-first per slice.** Pydantic schemas → FastAPI OpenAPI → generated TS client in `studio/scripts/`. Both sides code against the same generated types. No hand-typed FE shapes.
- **Each slice is shippable.** "Done when" is a reproducible user action, not a checklist. If it can't be demoed in 30 seconds from a clean checkout, the slice isn't done — don't start the next one.
- **One moving target at a time.** Greenfield areas (ingestion, stitcher, agent runtime) get their own RFC before code.
- **Parallel tracks where possible.** After the Atlas shell lands, multiple slices run as independent BE+FE pairs.

## Slice sequence

### S0 — Foundations (½ day, no UI)
- Alembic reset on `arch/redesign`
- `settings.secret_key` + `INVANA_ENCRYPTION_KEY` wired
- Empty `auth/` and `atlases/` modules mounted
- OpenAPI → TS client generator in `studio/scripts/`

**Done when:** `make dev` runs and Studio compiles against an empty typed client.

### S1 — Auth + bootstrap (gates everything)
- **BE:** User (incl. username) · bcrypt · JWT (access+refresh) · `/auth/*` · `invana init` CLI (no auto Atlas) · `get_current_user` dep
- **FE:** `auth.store` · axios interceptor · `LoginPage` · protected route shell · post-login lands on `/atlases` (empty state prompts to create the first Atlas)

**Done when:** `invana init` creates root user with a username; UI login lands on empty `/atlases`.

### S1.5 — Workspace → container rename (RFC-017) — **shipped** ✅
- **BE:** [x] Workspace renamed to the top-level container (+ `WorkspaceMember` → member join, the old `Graph` model → the connection child); `users.username`; container `intent` + `setup_state`; routes re-prefixed to `/u/:username/:<container>/...`; Alembic regenerated.
- **FE:** [x] pages, routes, hooks, copy renamed; username added to `ProfileSettingsPage`.

> Shipped under the name **Graph**. **RFC-049** renames that container to **Atlas** — the target vocabulary used throughout these docs.

**Done when:** existing Layer 1 behaviors work under the new names, and `invana init` no longer creates a default container. — detail in [`mvp/layer-1-identity-access.md`](mvp/layer-1-identity-access.md).

### S2 — Atlas shell + setup wizard — **shipped** ✅
- **BE:** [x] Atlas CRUD; Connection sub-resource (GET/PUT/DELETE + test/ping/introspect); `setup_state` + `require_atlas_setup_complete`; `query` + `schemas` routers re-prefixed. Legacy `/api/v1/connections/*` + `/api/v1/atlases/{cid}/query` + `/api/v1/schemas/{sid}/active-version` shims deleted.
- **FE:** [x] `/atlases` list · `/atlases/new` · `/u/:username/:atlasSlug` overview with wizard · Connection + Instructions settings pages · `/u/:username/:atlasSlug/settings` index · context-aware left nav.

**Done when:** user creates an Atlas, completes Atlas Info via Neo4j, sees modeller / explorer / query unlock. — detail in [`mvp/layer-2-atlas.md`](mvp/layer-2-atlas.md).

### S3 — User graph model authoring (RFC-019 · RFC-021) — in progress
- **BE:** [x] Multi-model atlas-scoped `/u/:username/:atlasSlug/models` — full CRUD + draft→Publish + node/edge/property-key authoring (draft-only, 409-guarded).
- **FE:** [~] `ModellerPage` authoring — model CRUD, draft→Publish, node/edge type + property forms, editable Property Keys. Canvas interactive (RFC-027): Add/Connect/Delete tools author node & edge types on a draft (create via the existing dialogs), Select inline-renames; read-only versions stay pan/zoom/select-only.
- **BE/FE (RFC-022):** [ ] Backend-gated property types + DB version compatibility — version-aware `CapabilityProfile`, `supported_property_types` drives the modeller dropdowns, untested/unknown versions force read-only until acknowledged.
- **Done when:** from a clean checkout, a user creates a model, adds node + edge types with properties, publishes it, and the published version is read-only; creating a draft makes it editable again.

### S4 — LLM provider (atlas-scoped) — **shipped** ✅
- **BE:** [x] `LLMProvider` entity + Fernet · CRUD + ping + set-default under `/u/:username/:atlasSlug/llm/...` · partial unique on `is_default`.
- **FE:** [x] LLMs section in the Atlas rail · register / edit / delete provider · Test (save-first → ping) · Set default.

**Done when:** saved Anthropic key produces a 200 from `/llm/{id}/ping` for the active Atlas. — detail in [`mvp/layer-2-atlas.md`](mvp/layer-2-atlas.md) (§ 2.6).

### S5 — Skills + Instructions (atlas-scoped) — **shipped** ✅ (Instructions table later removed — RFC-040)
- **BE:** [x] Skill CRUD under `/u/:username/:atlasSlug/skills/...`; unique (atlas_id, name). The
  separate Instructions table shipped here but was **removed in RFC-040** (unwired + redundant) and
  folded into the single `Atlas.instructions` field — see § 2.5.
- **FE:** [x] Skills section in the rail · list + add/edit forms · full-page maximize route. Instructions
  is now the single-field `InstructionsSection` (RFC-040), not a list.

**Done when:** user authors a skill, sees it persisted, edits it. ✅ — detail in [`mvp/layer-2-atlas.md`](mvp/layer-2-atlas.md) (§ 2.4 + § 2.5). Markdown editor (CodeMirror reuse) deferred — plain textareas for now.

### S5.5 — Domain audit events (RFC-018) — **shipped** ✅
- **BE:** [x] `events` append-only table + indexes + Alembic 00000000000d · `emit_event` service helper + sensitive-field redaction · keyset-paginated read API + SSE companions · Postgres `pg_notify` trigger + per-worker `LISTEN events` daemon + in-process broadcaster fan-out · superuser/member auth gates · admin Audit DropDown view.
- **BE wiring:** [x] every write surface emits: atlas CRUD + setup wizard · connection (attach/update/delete/test) · llm providers (CRUD + ping + set_default) · skills · instructions · members (add) · auth (register/login/login_failed/logout/refresh/password_change/username_change) · query.execute · system events (auto-reconnect, introspect completion).
- **FE:** [x] `EventsSection` rail icon + section + full-page maximize · `PlatformEventsPage` at `/platform/events` (superuser only) · `useEventStream` SSE hook with TanStack-Query cache invalidation · filter-by-action-prefix bar · keyset infinite scroll · UserMenu link to platform events for superusers.

**Done when:** writing a Skill produces a `skill.create` row visible in both the Atlas's Events section and the platform Events page within ~1 second (live tail). ✅ — design in [`mvp/rfc-018-domain-audit-events.md`](mvp/rfc-018-domain-audit-events.md).

> **S3, S4, S5 run as parallel tracks once S2 lands.** Different BE modules, different FE routes, no shared state.

### S6 — Dataset import (MVP — no connectors)
*Pre-work: RFC for the on-disk dataset format (`model.json` + `nodes/<Type>.json` + `edges/<Type>.json`), property-constraint vocabulary, and validation rules. Half-day spec.*

- **S6a — Model + validators (BE only):**
  - Dataset + ImportJob entities (Postgres) · `graph_model` JSONB column · `atlas_id` FK
  - Pydantic schema for `model.json` + property constraints (string/int/float/bool/enum/datetime/uuid/json with required/min/max/length/pattern/enum.values)
  - Record validator runs model-driven checks; produces structured validation report (file, record_index, record_id, field, rule, message)
  - Referential integrity + node-id uniqueness checks
- **S6b — MinIO storage (BE only):**
  - MinIO in `docker-compose-infra.yml` · `INVANA_S3_*` settings · async S3 client
  - Bucket layout `atlases/<atlas_id>/datasets/<dsid>/...` · streamed + multipart uploads
  - File tree + file-fetch endpoints
- **S6c — LocalExecutor + job lifecycle + log streaming (BE only):**
  - RFC-016 executor interface + LocalExecutor impl
  - ImportJob stages: upload → validate model → validate records → derive system graph model → persist → done
  - `import_job_logs` table with structured rows (timestamp, level, stage, message, record_ref)
  - SSE log stream endpoint
- **S6d — `dataset-importer` Python API + CLI (BE only):**
  - `invana.datasets.import_dataset(atlas, name, path, *, refresh=False, strict=False)` returns `ImportJob` handle with `.wait()` / `.stream_logs()`
  - CLI: `invana datasets import --atlas <username/slug> --name <name> --path <dir>`
- **S6e — Studio dataset detail (FE):**
  - Dataset browser + import form (drag-drop folder/tarball)
  - Detail page with four tabs: **Logs** (live SSE), **Files** (MinIO tree + preview), **Model** (form + small canvas diagram), **Dataset** (paginated record table, type selector, columns from model)
  - Job status badge · validation report panel on failed jobs

**Done when:** user prepares a folder with `model.json` + `nodes/Document.json` (one bad row violating `max_length`) + `edges/MENTIONS.json`, runs `invana datasets import --atlas ravi/demo --name wiki --path ./examples/wiki`, opens Studio and sees: live logs streaming in **Logs**, the uploaded files in **Files**, the model rendered in **Model**, and the paginated records in **Dataset** with the failed row flagged in the validation report.

> Tasks / Pipelines / Schedulers / Source connectors / Distributed executors are **post-MVP**. Datasets are produced *externally* in MVP; the executor boundary is in place so Celery / Ray / K8s can drop in later without UI changes.

### S7 — Stitcher (smallest viable)
- **S7a:** mapping UI — dataset system-types on left, user-model concepts on right, drag-to-map
- **S7b:** materialize one dataset into the bound Connection
- **S7c:** provenance — every materialized node carries `dataset_id` + `record_id` + `stitch_job_id`

**Done when:** user maps `Document` → user's `Document` concept, sees nodes in Explorer with source records attached.

### S8 — Pipelines
Chain + schedule on top of S6. Pure additive. *(Deferred candidate — only land if S6→S9 has slack.)*

### S9 — Agent runtime: thoughts & thinking (RFC-048) — vertical sub-slices

| Slice | Engine | Studio |
|---|---|---|
| **S9a** | layered packages (`core/ tasks/ agents/ runtime/ api/ worker/`) + import-direction lint · `translate` · `validate` · `execute` · `shape` as typed tasks with `TaskContext` | none — no behaviour change |
| **S9b** | `thoughts` · `thinkings` · `thinking_steps` · `thought_stream` · `Runtime` protocol + bundled `inline` adapter · thought/thinking API + SSE · seeded deterministic `nl-query` train of thought | composer posts a thought and subscribes · canvas paints batched `graph.delta` · thinking card with step chips |
| **S9c** | `integrations/invana-prefect` + `invana worker` + Prefect compose profile · state sync + stale reconciler · `clarify` suspend/resume | clarification resumes the paused thinking · Thoughts list + thinking detail |
| **S9d** | `plan` task drives the bounded-agency loop over the allow-list, reading Atlas instructions + bound skills | citation chips · reasoning lines in the card |
| **S9e** | write-back with `thinking_id` provenance · success-criteria scoring | review panel (diff, accept/reject) · progress badge |

**First user-visible win is S9b: results stream instead of arriving all at once.**

**Done when:** user clicks "Ask" on an Atlas, watches the answer build on the canvas as it streams, and can open the Thinking to see every task, prompt, and query that produced it — with clickable provenance back to source records.

### S10 — External-agent API (§4.11)
Scoped tokens · retrieval endpoints (query / semantic / skill-mediated) · provenance in every response · archived-Atlas read-only freeze.

### S11 — Atlas lifecycle
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
- **S9a touches every import.** Same class of risk as S1.5: mechanical but wide. Land the import-direction lint rules *first* so they point at the work, one package per commit, suite green each time, no feature work interleaved.
- **S9b/S9c trade interactive latency for uniformity** (RFC-048 D1: everything is a thinking). Watch `submit → first emission`, not total duration. If p95 can't be held with warm workers, the fix is a per-agent fast path — a config change on the existing seam, not a redesign. Don't pre-build it.
- **Generated TS client is the contract.** Hand-typed FE shapes will drift.
- **Canvas integration is wired** (closed). Studio renders graphs exclusively through `@invana/canvas-react` (the React bindings over the `@invana/canvas` engine) — it never imports `@invana/canvas` directly. Explorer's `ExplorerCanvas` is the read/query visualiser; the Modeller's `SchemaCanvas` is the interactive schema editor (RFC-027). The old `@invana/canvas-core` + `@invana/layouts-d3-force` plugin packages are gone.
- **`connections.atlas_id` is currently nullable** — historical artefact from the deleted standalone connection surface. Tighten to `NOT NULL` in a future migration once any orphan rows are cleared.

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
