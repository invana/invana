# RFC-028: Backend-owned action messages (server-driven toasts)

**Status**: Accepted
**Author**: Invana Team
**Date**: 2026-06-14
**Related**:
- **RFC-009** (Studio v1) — established the axios client + `ApiError` + `toast` pattern this RFC
  standardises.
- **RFC-025 / RFC-026** (Studio telemetry / session tracing) — the response interceptor this RFC extends
  is the same one that ends per-request spans; the two concerns coexist in `client.ts`.

---

## Problem / intent

User-facing toast copy is split-brained:

- **Errors are backend-owned (good).** The engine raises `HTTPException(detail=...)`; the axios client's
  `formatErrorDetail` normalises FastAPI's `{ detail }` (string or 422 array) into `ApiError.message`; call
  sites `toast.error(err.message)`. The wording lives on the server.
- **Successes are frontend-owned (bad).** Mutations return either a resource body or `204 No Content` with
  **no message**, and the studio hardcodes ~30 `toast.success("…")` string literals (`"Model deleted."`,
  `"Draft created — you can now edit this model."`, `"Property updated."`, …). The server has no say in what
  the user is told happened.

This means: copy drifts between clients, the message can't reflect what the server actually did (e.g.
"Model and 3 versions deleted", "Already published — no change"), and changing a sentence needs a frontend
deploy. The intent of this RFC: **the backend owns the message for every mutating action; the frontend
displays whatever the backend sends, and never invents its own success string.**

## Decisions (locked)

1. **A standard, typed success response object carries the message in its body.** Every mutating endpoint
   that should toast returns the envelope:

   ```python
   # server/schemas.py
   DataT = TypeVar("DataT")

   class ActionResponse(BaseModel, Generic[DataT]):
       """Standard envelope for a mutating endpoint (RFC-028).

       `message` is the user-facing toast copy (backend-owned). `data` carries the
       affected resource for create/update; it is null for deletes / pure actions.
       """
       message: str
       data: DataT | None = None
   ```

   Wire examples:

   ```jsonc
   // POST  .../models            → 201
   { "message": "Model \"Customers\" created.", "data": { /* GraphModelResponse */ } }

   // PATCH .../models/{id}        → 200
   { "message": "Model updated.", "data": { /* GraphModelResponse */ } }

   // DELETE .../models/{id}       → 200   (was 204 No Content)
   { "message": "Model \"Customers\" and 3 versions deleted." }
   ```

   *Why a body object and not a header:* it is explicit, strongly typed on both ends (`ActionResponse[T]`
   ↔ `ActionResponse<T>`), shows up in OpenAPI, survives any client/proxy, and needs no CORS
   `expose_headers` or percent-encoding gymnastics for non-ASCII copy (`—`, `…`, curly quotes). A header
   was considered and rejected (see Alternatives).

2. **Deletes change `204 No Content` → `200 OK` with the envelope.** This is the one deliberate contract
   change: deletes now return a body (`{ message }`, no `data`). Status drops from `204` to `200`.

3. **The frontend toasts the envelope's `message` centrally, and unwraps `data` for callers.** The axios
   layer is the single place that knows about the envelope:
   - The **response interceptor**, on a non-`GET` 2xx whose body is an `ActionResponse` (has a string
     `message`), calls `toast.success(body.message)` — once per HTTP response.
   - The `request<T>` helper **unwraps**: when the body is an envelope it returns `body.data as T`, so
     existing service signatures (`Promise<GraphModelResponse>`, `Promise<void>` for deletes) and their
     call sites are **unchanged** apart from deleting their now-redundant `toast.success("…")` literal.

   This keeps a *proper response object on the wire* while sparing ~30 call sites from re-implementing
   `toast.success(res.message)` by hand. (GET responses are bare resources — no top-level `message` — so
   they are never unwrapped or toasted.)

4. **Presence of the envelope is the toast signal.** A mutation that should be silent (telemetry export
   `POST /v1/traces`, token refresh, connection ping, session-message streaming) simply returns its plain
   body / `204` and **does not** adopt `ActionResponse`. No envelope → no toast. The server controls both
   the wording *and* whether anything is shown.

5. **One server-side constructor; endpoints opt in explicitly.** Routes build the envelope via a tiny
   helper so the shape is uniform and greppable:

   ```python
   def action(message: str, data: DataT | None = None) -> ActionResponse[DataT]:
       return ActionResponse(message=message, data=data)
   ```

   A route declares `response_model=ActionResponse[GraphModelResponse]` (or `ActionResponse[None]` for a
   delete) and returns `action("…", model)`. Routes that stay silent are untouched.

6. **Granular gestures over generic endpoints keep a client summary + suppress the endpoint toast.**
   The principle is *one user action → one toast*. When a single request *is* the action (delete a
   model, create a node type, publish), the backend owns the message and the central toast fires. But
   some UI gestures are **client-orchestrated over generic endpoints**: adding a property fires *two*
   requests (`createPropertyKey` + `updateNodeType`); removing/adding a property and reversing an edge
   reuse the generic `PATCH node-type/edge-type` endpoint (whose honest message is "Node/Edge type
   updated.", wrong-grained for "Property removed." / "Direction reversed."); the canvas **erase** tool
   deletes silently by design. For these, the client wraps the calls in `suppressActionToast(() => …)`
   (a small client primitive that suppresses the central toast for the duration) and shows its own
   single summary toast (or none, for erase). This is the **only** sanctioned place a success string
   stays client-side, and only because no single endpoint message describes the gesture.

7. **Errors are unchanged.** Error wording is already backend-owned via `detail` → `ApiError.message`.
   This RFC does **not** move error toasts into the interceptor: some call sites render errors inline
   (form-field validation) or need bespoke handling, so `toast.error(err.message)` stays at call sites.
   The asymmetry is deliberate — success is uniform and safe to centralise; errors sometimes aren't. A
   future RFC may revisit centralised error toasts with an opt-out.

## Envelope (spec)

| Aspect | Value |
| --- | --- |
| Type | `ActionResponse[T]` = `{ message: str, data: T \| None }` |
| `message` | required; user-facing toast copy, backend-owned |
| `data` | the affected resource for create/update; `null`/omitted for delete / pure action |
| Status | `200`/`201` for resource ops; deletes move `204 → 200` |
| Returned by | mutations that should toast; silent mutations keep their plain body / `204` |
| Frontend | interceptor toasts `body.message` on non-GET 2xx; `request<T>` unwraps `body.data` → `T` |

## Frontend changes

1. **`types/api.ts`** — add `interface ActionResponse<T> { message: string; data?: T }`.
2. **`services/api/client.ts`** —
   - Response interceptor success branch: if `config.method !== 'get'` and the body has a string
     `message`, `toast.success(message)`.
   - `request<T>`: if the body is an envelope, return `body.data as T` (deletes → `undefined`).
3. **Delete the hardcoded success strings** at the ~30 sites listed below; error `toast.error(...)`
   stays. `DeleteModelDialog` (just added) loses its `toast.success("Model deleted.")` — the message now
   comes from `delete_model`'s envelope.
4. **No change to mutation-hook or service-method signatures** — `request<T>` still resolves to `T`.

## Backend changes

1. Add `ActionResponse[T]` + `action(...)` helper in `server/schemas.py`.
2. Set `response_model=ActionResponse[...]` and return `action(message, data)` on each user-initiated
   mutation; switch deletes from `Response(204)` to `action(message)` at `200`.

   | Router | Mutating endpoints | Toasts today? |
   | --- | --- | --- |
   | `server/routes/models.py` | 18 (model/version/type/property/constraint/index CRUD) | yes — modeller |
   | `graphs/routes.py` | 11 (graph CRUD, connection, setup, introspect) | partial |
   | `auth/routes.py` | 7 (register/login/refresh/logout/profile/password/delete) | partial; refresh/login silent |
   | `llm_providers/routes.py` | 5 | yes — settings |
   | `sessions/routes.py` | 5 (create/rename/pin/archive/message) | partial; message-send silent |
   | `skills/routes.py` | 3 | yes — settings |
   | `instructions/routes.py` | 3 | yes — settings |
   | `telemetry/routes.py` | 1 (trace export) | **no — stays silent (plain body)** |

   Silent by design (no envelope): trace export, token refresh, login, connection ping, session-message
   streaming.
3. Update affected endpoint tests for the new `200 { message, data }` delete/CRUD shape.

## Rollout

Single PR, staged so each step is independently verifiable:

1. `ActionResponse` + helper (backend) and the interceptor unwrap/toast (frontend) — infrastructure; no
   endpoint adopts the envelope yet, so no behavioural change.
2. Modeller routes adopt the envelope + drop modeller success literals (the feature in active
   development; smallest blast radius to validate the round-trip end-to-end).
3. Remaining routers (graphs, auth, llm_providers, sessions, skills, instructions) + drop their literals.

Each step removes the matching `toast.success("…")` literals in the same commit so the two sides never
drift (CLAUDE.md per-feature triplet rule).

## Studio success-toast sites to migrate (inventory at time of writing)

`ModellerPage.tsx` (introspect, draft created, draft saved, model published, type deleted, direction
reversed), `DeleteModelDialog.tsx`, `PropertyEditor.tsx` (×3), `ModelFormDialog.tsx` (×2),
`NodeTypeFormDialog.tsx` (×2), `EdgeTypeFormDialog.tsx` (×2), `PropertyKeyFormDialog.tsx` (×2),
`PropertyKeyTable.tsx`, `CompatibilityBanner.tsx` (×2), `GraphsListPage.tsx`, `GraphCreatePage.tsx`,
`ConnectionSection.tsx`, `IntentSection.tsx`, `InstructionsSection.tsx` (×3), `SkillsSection.tsx` (×3),
`LLMsSection.tsx` (×4), `ProfileSettingsPage.tsx` (×3).

Excluded (not server round-trips, keep local): `SessionsPanel.tsx` `"Copied to clipboard"` (pure
clipboard, no request).

## Alternatives considered

- **Response header `X-Invana-Message`.** Rejected: requires CORS `expose_headers`, percent-encoding for
  non-ASCII copy, is invisible in OpenAPI, and is easy for proxies/clients to drop. A typed body object is
  explicit and self-documenting.
- **Wrap *every* response (GET included) in `{ message, data }`.** Rejected: bloats read paths, forces a
  `message` on responses that have nothing to say, and churns every `res.data` access. Only mutations that
  toast adopt the envelope.
- **`204 → 200 { message }` for deletes only, hardcoded strings elsewhere.** Rejected: leaves
  create/update successes frontend-owned, so the rule is only half-true.
- **Explicit per-call-site `toast.success(res.message)` + `res.data`.** Considered and rejected: it
  re-litters ~30 sites with boilerplate that's easy to forget, and churns every call site that reads the
  created/updated resource (`res` → `res.data`). The client-layer unwrap+toast (Decision #3) is uniform,
  keeps service signatures/call sites unchanged, and is the locked approach.
- **Centralised error toasts too.** Deferred (Decision #7).

## Non-goals

- i18n / localisation of messages (plain server strings for now).
- Centralised **error** toasting (Decision #7).
- Toast levels beyond success (info/warning) — the envelope carries one success message; a future
  `level` field could extend it.
- Touching non-request toasts (clipboard, pure client-side validation).
