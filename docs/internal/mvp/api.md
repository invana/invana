# API surface — MVP endpoints

The HTTP contract for the backend described in [`engine.md`](engine.md). Entities, guards and data
flow live there; user-facing journeys live in [`studio.md`](studio.md); slice sequencing stays in
[`../mvp.md`](../mvp.md).

All atlas-scoped paths are prefixed `/api/v1/u/{username}/{atlasSlug}`; guards per
[`engine.md`](engine.md) §1.5.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred post-1.0

---

## 1. Auth

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/auth/register` | **superuser-only** provisioning |
| `POST` | `/api/v1/auth/login` | |
| `POST` | `/api/v1/auth/refresh` | rotates the refresh token |
| `POST` | `/api/v1/auth/logout` | |
| `GET` | `/api/v1/auth/me` | |
| `PATCH` | `/api/v1/auth/me` | first/last name · username (rate-limited) |
| `POST` | `/api/v1/auth/me/password` | verifies current; revokes all refresh tokens |
| `DELETE` | `/api/v1/auth/me` | 409 if sole superuser or owns any Atlas |
| `GET` | `/api/v1/auth/username-available?username=` | unauthenticated → `{available, reason?}` |

## 2. Atlas & settings

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `/api/v1/atlases` | list · create |
| `GET` `PATCH` `DELETE` | `…/{atlasSlug}` (via `/u/{username}/{atlasSlug}`) | hard delete cascades downward |
| `POST` | `…/setup/{section}` | wizard progress |
| `POST` | `…/archive` · `…/unarchive` | lifecycle |
| `GET` `PUT` `DELETE` | `…/connection` | PUT is full-replace; empty `auth` keeps stored creds |
| `POST` | `…/connection/test` · `/ping` · `/introspect` | |
| `POST` | `…/connection/acknowledge-version` | clears the untested-version read-only lock |
| `GET` `POST` `PATCH` `DELETE` | `…/skills[/{id}]` | 409 on duplicate name |
| `GET` `POST` `PATCH` `DELETE` | `…/llm[/{id}]` | |
| `POST` | `…/llm/{id}/ping` · `…/llm/{id}/set-default` | |
| `GET` `POST` `PATCH` `DELETE` | `…/agents[/{key}]` | workflow + bindings + policy |
| `GET` | `…/members` | binary membership |
| `GET` | `…/events` · `…/events/stream` | keyset list · SSE tail (`?token=` fallback) |
| `GET` | `/api/v1/events` · `/api/v1/events/stream` | superuser, all Atlases |

## 3. Model

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` `PATCH` `DELETE` | `…/models[/{id}]` | model CRUD |
| `GET` `POST` | `…/models/{id}/versions` | create a draft |
| `POST` | `…/models/{id}/versions/{vid}/activate` | publish (also the "commit" for generative sessions) |
| `GET` | `…/schema/active-version` | the grounding schema |
| `POST` `PATCH` `DELETE` | `…/versions/{vid}/node-types[/{id}]` | draft-only → 409 |
| `POST` `PATCH` `DELETE` | `…/versions/{vid}/edge-types[/{id}]` | draft-only → 409 |
| `POST` `PATCH` `DELETE` | `…/property-keys[/{id}]` | type enforcement → 422 |

## 4. Datasets

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `…/datasets` | list · register (starts an import job) |
| `GET` `DELETE` | `…/datasets/{dsid}` | detail (model + counts + last job) · hard delete incl. objects |
| `GET` | `…/datasets/{dsid}/jobs[/{jid}]` | job list · detail (status, progress, counts) |
| `GET` | `…/datasets/{dsid}/jobs/{jid}/logs` | paginated |
| `GET` | `…/datasets/{dsid}/jobs/{jid}/logs/stream` | SSE |
| `GET` | `…/datasets/{dsid}/files[/{path}]` | object tree · fetch (signed or proxied) |
| `GET` | `…/datasets/{dsid}/records?type=&page=&page_size=` | paginated, scoped to one type |

**Python API** (for externally-prepared data): `invana.datasets.import_dataset(atlas, name, path, *,
refresh=False, strict=False)` → `ImportJob` handle with `.wait()` / `.stream_logs()`; `atlas` accepts a
handle or `"username/slug"`. CLI shim: `invana datasets import --atlas <u/s> --name <n> --path <dir>
[--refresh] [--strict]`.

## 5. Stitching

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` `PATCH` `DELETE` | `…/mappings[/{id}]` | system type → user concept |
| `POST` | `…/stitch` | materialise into the bound connection |
| `GET` | `…/stitch-jobs[/{id}]` | status · progress · logs (SSE like imports) |
| `GET` | `…/provenance/{node_or_edge_id}` | source dataset · record · job |

## 6. Sessions & canvases

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `…/sessions` | `?surface=` filter |
| `GET` `PATCH` `DELETE` | `…/sessions/{id}` | |
| `GET` `POST` | `…/sessions/{id}/messages` | append a turn |
| `GET` `POST` `PATCH` `DELETE` | `…/canvases[/{id}]` | paginated · `?include_archived` · shared atlas-wide |
| `GET` `POST` | `…/canvases/{id}/states` | version list (summary) · capture |
| `GET` | `…/canvases/{id}/states/{sid}` | full snapshot + thumbnail |

## 7. Thoughts & thinking

| Method | Path | Purpose |
|---|---|---|
| `POST` | `…/thoughts` | pose a thought → opens a thinking → `202 {thought_id, thinking_id, stream_url}` |
| `GET` | `…/thoughts?session_id=` | list, each with its newest thinking |
| `GET` | `…/thoughts/{id}` | the ask + all its thinkings |
| `POST` | `…/thoughts/{id}/rethink` | new thinking over the same thought (`{agent?}`) |
| `GET` | `…/thinkings/{id}` | thinking + steps |
| `GET` | `…/thinkings/{id}/stream?after=` | **SSE** live tail |
| `GET` | `…/thinkings/{id}/trace?after=&limit=` | thought-stream replay page |
| `POST` | `…/thinkings/{id}/resume` | answer a clarification, carry on |
| `POST` | `…/thinkings/{id}/cancel` | stop thinking |

**Internal surface** — authenticates a *thinking*, not a user:

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/internal/thinkings/{id}/stream` | worker → engine emission ingest |
| `POST` | `/internal/thinkings/{id}/steps` | step transitions |
| `GET` | `/internal/thinkings/{id}/resources` | exchange the thinking token for short-lived scoped credentials |
| `POST` | `/internal/thinkings/{id}/state` | orchestrator automation: terminal state backstop |

## 8. Schedules

A schedule re-asks one existing, immutable `Thought`. Each firing opens a new `Thinking` on it —
identical in shape to a rethink — so nothing downstream needs to know whether a human or the clock
triggered it.

| Method | Path | Purpose |
|---|---|---|
| `GET` `POST` | `…/thoughts/{id}/schedule` | read · create-or-replace (a thought carries at most one) |
| `PATCH` `DELETE` | `…/thoughts/{id}/schedule` | edit cron/timezone/agent · remove (fired thinkings survive) |
| `POST` | `…/thoughts/{id}/schedule/{pause,resume}` | move `state` between `active` and `paused` without losing the definition |
| `POST` | `…/thoughts/{id}/schedule/run-now` | fire once out of band → `202 {thinking_id, stream_url}` |
| `GET` | `…/schedules?state=` | every schedule in the Atlas, with `next_run_at` + last outcome |
| `GET` | `…/schedules/{id}/runs?after=&limit=` | firing history. **Not a table** — a projection over `thinkings` (`thought_id` + `triggered_by='schedule'`) unioned with `schedule.run_skipped` / `schedule.halted` events. See [`rfc-051-workflows.md`](rfc-051-workflows.md) § 4.1 |

**Payload** — `{cron, timezone, state, agent?}`. `cron` is a 5-field expression resolved in
`timezone` (IANA name, defaults to the Atlas owner's); `state` is `active · paused · halted`
(`halted` is set by the system when the Atlas is archived, never by the client); `agent` overrides
the workflow the thought was originally answered with.

| Rule | Behaviour |
|---|---|
| Minimum interval | `INVANA_SCHEDULE_MIN_INTERVAL_MINUTES` (default 15) → 422 below it |
| Overlap | a firing is skipped, not queued, while the previous thinking is still running — logged as a skipped run |
| Missed windows | no backfill; a schedule that was down resumes at the next slot |
| Archived / read-only Atlas | schedules stop firing; definitions are kept |
| Attribution | fired thinkings carry `triggered_by=schedule` + `schedule_id`, never a user id |
| Deleting the thought | cascades to the schedule |

## 9. Retrieval & external access

| Method | Path | Purpose |
|---|---|---|
| `POST` | `…/search?type=semantic` | vector retrieval, similarity-scored |
| `POST` | `…/explorer/expand/{neighbors,by-edge-type,by-node-type}` | read-only neighbour reads → `{data, total, offset, limit, returned, has_more}` |
| `POST` `GET` `DELETE` | `…/tokens[/{id}]` | issue (returned exactly once) · list · revoke |

Every retrieval response carries provenance: `nodes[]` · `edges[]` · `records[]` (with `dataset_id` +
`record_id`) · `import_job_id`.
