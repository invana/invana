# Layer 1 — Identity & Access

> **Status**: Shipped (Slice S1, under prior Workspace nomenclature) · **Rename pending (Slice S1.5)** per [RFC-017](../../rfcs/017-graph-as-primary-container.md)
> **Author**: Invana Team
> **Created**: 2026-05-21
> **Updated**: 2026-05-21
> **Maps to MVP**: Layer 1 of `docs/internal/mvp.md`, Slices **S1** + **S1.5**

> **About this doc.** Behaviors below describe the **post-S1.5 target state** — the Workspace → Graph rename, `username` addition, `/u/:username/:slug` URL prefix, and removal of the auto-created personal workspace from `invana init`. The underlying Layer 1 behaviors (auth, invitations, role matrix, admin gating) are implemented; S1.5 is a mechanical rename + three small additive features.

---

## Summary

First auth surface for Invana. JWT-based access tokens with opaque server-side refresh tokens; invite-gated, **graph-scoped** registration; three graph roles (`developer`, `analyst`, `admin`) plus a platform-level `is_superuser` flag; CLI bootstrap (`invana init`); and a session-authed `starlette-admin` that only superusers can sign into.

**Graph-scoped roles.** Role is **not** on the user. The same user can be `admin` of one Graph and `developer` (or `analyst`) of another Graph they were invited to collaborate in. Roles live on the `graph_members` join table.

**Username-namespaced URLs.** Users have a globally unique `username` (`[a-z0-9-]`, 2–64 chars). All graph-scoped routes live under `/api/v1/u/:username/:slug/...` so usernames cannot collide with Studio's top-level route namespace.

All tunable auth knobs live under `settings.auth_*` (`INVANA_AUTH_*` env vars): password length, bcrypt rounds, JWT algorithm, refresh-token entropy, TTLs, and username-change cadence.

## Motivation

The engine launched without auth. Layers 2–6 (per the post-RFC-017 layering) all presuppose a `User` for ownership and a `Graph` for the analytical container. Layer 7.3 (external-agent API) needs scoped tokens. starlette-admin is mounted at `/admin` with no protection.

Two roles (`admin | member`) collapse two distinct non-admin personas:

- People who **build** in a Graph — manage its connection, author skills, configure agents, register datasets.
- People who **consume** the Graph — run agents, view results, do not change structure.

We split these into `developer` and `analyst`. `admin` adds member-management on top of `developer`.

If we don't do this now: every later slice has to either skip auth (and then retrofit it across every route) or invent its own ad-hoc gating. Both are worse than building the layer once.

## Design

### Data Model

Five tables. UUID PKs, timestamps in UTC, hard deletes only (per project memory).

The `graphs` table itself is defined in **Layer 2** (Graph container — see `mvp.md` § 2.1). Layer 1 governs *membership* of Graphs (`graph_members`) and *invitations* to them.

#### `users`

```
users
──────────────────────────────────────────────────────
id                       UUID PK
email                    String(320)    UNIQUE NOT NULL
username                 String(64)     UNIQUE NOT NULL    (case-insensitive)
password_hash            String(255)    NOT NULL           (bcrypt)
first_name               String(120)    NOT NULL
last_name                String(120)    nullable
is_superuser             Boolean        NOT NULL default False
is_active                Boolean        NOT NULL default True
username_last_changed_at DateTime       nullable
created_at               DateTime       NOT NULL
updated_at               DateTime       NOT NULL
```

- `email` is the login identity, case-folded to lower on write.
- `username` is the URL identity, lowercase `[a-z0-9-]`, 2–64 chars; no leading/trailing/consecutive hyphens. Globally unique with case-insensitive comparison (stored lowercase). The `/u/` URL prefix isolates usernames from Studio's top-level route namespace — no reserved-name list is needed beyond `u` itself.
- `username_last_changed_at` enforces the rate-limit (`settings.auth_username_change_cooldown_days`, default **30**). PATCH refuses with 409 if invoked inside the cooldown.
- `first_name` is required so the UI always has something to greet the user with. `last_name` is optional.
- **No `role` column** — role is graph-scoped (see below).
- `is_superuser` is the platform-level flag — gates `/admin` and DB-level operations only. Set only by `invana init` for the root user.
- `is_active=False` blocks login and rejects existing tokens at `get_current_user`.

#### `graph_members`

```
graph_members
──────────────────────────────────────────────────────
graph_id     UUID FK → graphs.id  ON DELETE CASCADE
user_id      UUID FK → users.id   ON DELETE CASCADE
role         Enum (graph_role)    developer | analyst | admin  NOT NULL
created_at   DateTime             NOT NULL

PRIMARY KEY (graph_id, user_id)
```

- A user's role is read from here for the Graph whose resource is being accessed.
- Service-layer guards prevent demoting/removing the **sole admin** of a Graph (409 Conflict).

#### `invitations` (graph-scoped)

```
invitations
──────────────────────────────────────────────────────
id              UUID PK
token_hash      String(64)     UNIQUE NOT NULL    (sha256 hex of raw token)
email           String(320)    NOT NULL                    (lower-cased)
graph_id        UUID FK → graphs.id      ON DELETE CASCADE
role            Enum (graph_role)        NOT NULL
invited_by_id   UUID FK → users.id       ON DELETE SET NULL
expires_at      DateTime       NOT NULL
accepted_at     DateTime       nullable
created_at      DateTime       NOT NULL
```

- Invitations target a specific Graph; accepting attaches the invitee as a member with the specified role.
- If a user with `email` already exists, accepting only creates the graph membership (the password and username fields of the request are ignored).
- Raw token returned to the inviter **exactly once**; only the hash persists.
- "Pending" = `accepted_at IS NULL AND expires_at > now()`.
- Default expiry: `settings.auth_invitation_ttl_days` (7).

#### `refresh_tokens`

```
refresh_tokens
──────────────────────────────────────────────────────
id              UUID PK
user_id         UUID FK → users.id     ON DELETE CASCADE
token_hash      String(64)     UNIQUE NOT NULL    (sha256 hex)
expires_at      DateTime       NOT NULL
revoked_at      DateTime       nullable
created_at      DateTime       NOT NULL
```

- Refresh tokens are opaque random strings (32 bytes from `secrets.token_urlsafe`), not JWTs. Server-side validated against this table.
- Logout = set `revoked_at = now()`.
- Rotation: each successful `/auth/refresh` revokes the old row and inserts a new row.

### Role Model

Roles are scoped to (graph, user). The same user can hold different roles in different Graphs.

```
WITHIN A GRAPH
──────────────────────────────────────────────────────────────────────────
admin     →  everything developer can do
              + invitation / member management within THIS Graph
              + Graph settings (connection, intent, archive)
              ✗ platform admin (/admin) — that's the superuser flag

developer →  manage Graph contents — datasets, skills, instructions,
              LLM configs, agents, schema, stitching
              + run agents · full read
              ✗ invitation / member management
              ✗ Graph archive / delete

analyst   →  full read across this Graph
              + run agents (write-back persists, subject to per-agent policy)
              ✗ create / edit / delete datasets, skills, LLM configs,
                agents, schema
              ✗ invitation / member management

PLATFORM-LEVEL
──────────────────────────────────────────────────────────────────────────
is_superuser   →  signs into starlette-admin (/admin)
                  Otherwise behaves like any user in their Graphs.
                  Set only by `invana init` for the root user.
```

FastAPI dependencies (split across `engine/src/invana/auth/deps.py` for user-level deps and `engine/src/invana/graphs/deps.py` for graph-scoped deps):

- `get_current_user` — verifies access JWT, loads user, checks `is_active`. 401 on missing/invalid, 403 on inactive.
- `require_superuser` — gates `/admin` (platform-level).
- `resolve_graph_by_username_slug(username, slug)` — path-param resolver; loads `Graph` by `(created_by_id from username, slug)`. 404 if not found.
- `get_graph_membership` — resolves `(graph from resolver, current_user) → GraphMember`; 403 if not a member.
- `require_graph_member` — any active member of the Graph.
- `require_graph_builder` — admin or developer in the Graph; gates content mutations.
- `require_graph_admin` — admin in the Graph; gates invitation / member management + Graph settings.

The graph deps compose: `require_graph_admin` ⊃ `require_graph_builder` ⊃ `require_graph_member` ⊃ `get_graph_membership` ⊃ `resolve_graph_by_username_slug` + `get_current_user`.

### JWT

- Algorithm: configurable via `settings.auth_jwt_algorithm` (default **HS256**), signed with `settings.secret_key` (`INVANA_SECRET_KEY`).
- Access TTL: `settings.auth_access_token_ttl_minutes` (default **15**).
- Refresh TTL: `settings.auth_refresh_token_ttl_days` (default **7**).
- Access claims:
  ```json
  {
    "sub": "<user_uuid>",
    "sup": true,
    "type": "access",
    "iat": 1716230400,
    "exp": 1716231300
  }
  ```
  The JWT carries **only the user identity** plus the `sup` (superuser) flag. Graph role is **not** denormalised into the token — it must be looked up per request via `GraphMember`, because a single token may be used across multiple Graphs with different roles. Username is also **not** in the token — it can change, and the token outlives the change.
- Refresh "token" is **not** a JWT — opaque server-side string (see `refresh_tokens`). Revocation is a single DB update; no JWT denylist needed.
- Rotation: each successful `/auth/refresh` revokes the old refresh row and issues a new one.

### Password hashing

- `passlib[bcrypt]`, cost from `settings.auth_bcrypt_rounds` (default **12**).
- **Minimum length** from `settings.auth_min_password_length` (default **12**).
- `bcrypt` pinned to `<5` (passlib 1.7.4 trips its "wrap bug" detection on bcrypt 5.x, which raises on >72-byte inputs).
- Stored in `users.password_hash`.
- Login uses `passlib.context.CryptContext.verify` (constant-time).

### Username validation rules

- Regex: `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$` (2–64 chars; lowercase + digits + hyphen; no leading/trailing hyphen).
- Additional rule: no consecutive hyphens (`--`).
- Case folded to lowercase on write; uniqueness is case-insensitive.
- Reserved: `u` only (everything else is namespaced safely behind the `/u/` URL prefix).
- Mutability: PATCH allowed once per `settings.auth_username_change_cooldown_days` (default **30**). Old usernames are not aliased — existing `/u/old-name/...` URLs 404 after a change.

### API Surface

Two routers: `/api/v1/auth/*` (user-level) and `/api/v1/u/:username/:slug/*` (graph-scoped). Graph CRUD itself (`POST /api/v1/graphs`, `GET /api/v1/graphs`) lives in Layer 2.

```
GET  /api/v1/auth/username-available?username=foo
  Auth:     none (unauthenticated; rate-limited per IP, e.g. 30 req/min)
  Returns:  { "available": true }
            or { "available": false, "reason": "taken" | "reserved" | "invalid_format" }
  Notes:    purely advisory — final uniqueness enforced at register/PATCH time.

POST /api/v1/auth/register?invite=<raw_token>
  Body:     { "first_name": "...", "last_name": "...",
              "username": "...", "password": "..." }
  Effects:  validates username format + availability
            → hashes invite token → looks up invitation row → checks not expired/accepted
            → if no user exists for invitation.email: creates one with name + username + bcrypt(password)
            → if user exists for invitation.email: username field is ignored (existing username preserved)
            → attaches the user as a GraphMember of invitation.graph_id with invitation.role
            → marks invitation accepted
            → issues access + refresh tokens
  Returns:  { "user": {...}, "access_token": "...", "refresh_token": "..." }
  Errors:   404 (bad token), 410 (expired), 409 (already accepted | username taken),
            422 (username format invalid)

POST /api/v1/auth/login
  Body:     { "email": "...", "password": "..." }
  Returns:  { "user": {...}, "access_token": "...", "refresh_token": "..." }
  Errors:   401 (always — never reveal whether email exists)

POST /api/v1/auth/refresh
  Body:     { "refresh_token": "..." }
  Effects:  validates token (exists, not revoked, not expired) → revokes it
            → issues new access + new refresh
  Returns:  { "access_token": "...", "refresh_token": "..." }
  Errors:   401 (any failure)

POST /api/v1/auth/logout
  Body:     { "refresh_token": "..." }
  Effects:  revokes the refresh token (no-op if already revoked/missing)
  Returns:  204

GET  /api/v1/auth/me                      [get_current_user]
  Returns:  {
              "id": "...", "email": "...", "username": "...",
              "first_name": "...", "last_name": "...",
              "is_superuser": false,
              "username_last_changed_at": "...",
              "graphs": [
                { "graph_id": "...", "graph_name": "...",
                  "owner_username": "...", "graph_slug": "...",
                  "role": "admin" },
                ...
              ]
            }

PATCH /api/v1/auth/me                     [get_current_user]
  Body:     { "first_name"?: "...", "last_name"?: "...", "username"?: "..." }
  Effects:  updates only the supplied fields.
            Email is immutable.
            Username change validates format + availability + cooldown
            (auth_username_change_cooldown_days). Stamps username_last_changed_at.
  Returns:  updated user payload (same shape as GET /auth/me)
  Errors:   422 (format), 409 (username taken | inside cooldown window), 401

POST /api/v1/auth/me/password             [get_current_user]
  Body:     { "current_password": "...", "new_password": "..." }
  Effects:  verifies current_password via bcrypt; on success, hashes
            new_password and writes to users.password_hash; revokes ALL
            of this user's refresh tokens (forces re-login on other
            devices). The current session's access token remains valid
            until its 15-min TTL elapses — acceptable trade-off.
  Returns:  204
  Errors:   401 (current_password wrong — generic message),
            422 (new_password fails length rule)

DELETE /api/v1/auth/me                    [get_current_user]
  Body:     { "password": "..." }
  Effects:  verifies password; hard-deletes the user row. Cascade per
            RFC-012 / project delete-semantics memory: Graphs created
            by this user cascade down (members, invitations, refresh
            tokens, connection, datasets, ...) via FK.
            Guard A: if the user has is_superuser=True AND would leave
            zero remaining active superusers → 409.
            Guard B: if the user owns any Graph that has other members → 409
            (force the user to transfer admin or remove others first).
  Returns:  204 (client clears session and redirects to /login)
  Errors:   401 (wrong password), 409 (guard A | guard B)

─────────────────────────────────────────────────────────────────────────
GRAPH MEMBERSHIP & INVITATIONS
─────────────────────────────────────────────────────────────────────────
(Graph CRUD itself — POST/GET/PATCH/DELETE /api/v1/graphs[/u/…] — is Layer 2.)

GET    /api/v1/u/{username}/{slug}/members            [require_graph_member]
PATCH  /api/v1/u/{username}/{slug}/members/{user_id}  [require_graph_admin]
  Body:     { "role": "developer|analyst|admin" }
  Guard:    cannot demote the sole admin of the Graph (409).

DELETE /api/v1/u/{username}/{slug}/members/{user_id}  [require_graph_admin]
  Guard:    cannot remove the sole admin (409).

POST   /api/v1/u/{username}/{slug}/invitations        [require_graph_admin]
  Body:     { "email": "...", "role": "developer|analyst|admin" }
  Returns:  { ..., "redeem_url": "<studio>/register?invite=<raw_token>" }
  Note:     raw token returned exactly once.

GET    /api/v1/u/{username}/{slug}/invitations        [require_graph_admin]
DELETE /api/v1/u/{username}/{slug}/invitations/{id}   [require_graph_admin]
```

`/admin/*` (starlette-admin) is gated by a custom `AuthProvider` that signs users in with their email + password and verifies `is_superuser=True` on every request. Session cookies via Starlette's `SessionMiddleware`, signed with `INVANA_SECRET_KEY`. Non-superusers get a `LoginFailed` error.

### CLI

`invana init` — added to the existing Click CLI at `engine/src/invana/cli/main.py`.

```
$ invana init
Username:             ravi
First name:           Ravi
Last name (optional): Merugu
Email:                rrmerugu@example.com
Password:             ********
Confirm:              ********
✓ Created root superuser (rrmerugu@example.com).
  Log in at: http://localhost:8300/login
  You can create your first Graph after signing in.
```

Behaviour:
- Interactive prompts via `click.prompt` (hidden for password).
- **`username` is required** and validated against the same rules as the API (format + reserved). If invalid or taken, re-prompts.
- **`first_name` is required**; pressing enter without a value re-prompts.
- **`last_name` is optional** — pressing enter without a value stores `NULL`.
- **No personal Graph is auto-created.** The root user lands on an empty `/graphs` list after first login and creates their first Graph manually (per RFC-017).
- Idempotent: if **any** superuser already exists, exits with a clear message ("Superuser already exists; use invitations to add members to a Graph"). No `--force`.
- Uses the same service used by `/auth/register` (without the invitation lookup) — never bypasses bcrypt or username validation.
- Does **not** issue tokens; new admin logs in via the UI (system-design §4.1: CLI does not register additional users beyond the root).
- Bails non-zero if Alembic migrations are not at head.
- `--non-interactive` flags: `--username`, `--first-name`, `--last-name`, `--email`, `--password` (read from env or `--password-stdin` for CI).

### Studio UI

New routes:

```
/login                                                  — LoginPage
/register?invite=<t>                                    — RegisterPage (collects username)
/settings/profile                                       — ProfileSettingsPage (user-level, incl. username)
/graphs                                                 — GraphsListPage (post-login landing)
/u/:username/:slug/settings/members                     — GraphMembersPage
/u/:username/:slug/settings/invitations                 — GraphInvitationsPage (admin-only)
```

Graph-scoped routes use `(username, slug)` directly from the URL. There is no derived "active workspace" anymore — the URL is the source of truth for which Graph the page targets.

All non-public routes wrapped in `<ProtectedRoute>` — redirects to `/login` if no valid access token.

Components / hooks:
- `stores/auth.store.ts` (Zustand) — `{ user, accessToken, refreshToken, login, logout, setSession, clearSession }`. Persists tokens to `localStorage`. HttpOnly cookies deferred per `mvp.md`.
- `services/api/client.ts` — axios with request/response interceptors:
  - Request: attach `Authorization: Bearer <access>`.
  - Response: on 401, attempt `/auth/refresh`; on success retry once with new token; on failure clear session and route to `/login`. Single-flight lock prevents concurrent refresh storms.
- `useAuth()` — exposes `user` (including `username`, `first_name`, `last_name`), `isSuperuser`, `displayName`, and `membershipForGraph(username, slug)` returning `{role, isAdmin, isBuilder, isAnalyst} | null`.
- `<ProtectedRoute>` — renders children only if `accessToken` present; otherwise navigates to `/login?next=<current>`.
- `<RoleGate require="admin|builder|member|superuser" graph={{username, slug}}>` — conditional render for role-restricted UI.

`RegisterPage`:
- Collects `username` (with live availability check against `/auth/username-available`, debounced 300 ms), first_name, last_name, password, confirm.
- Inline error on `username` if format invalid or taken.
- Reads `?invite=<token>`. If the invitation's email matches an existing user, the username field is hidden (existing user's username is preserved).

Profile settings page (`/settings/profile`) — tabbed, available to every authenticated user:

- **Basic info** tab
  - Email field — disabled (read-only) input; tooltip "Email cannot be changed".
  - Username field — editable; live availability check; below the field, cooldown indicator showing "Can be changed again on YYYY-MM-DD" when inside the window. Save disabled while inside cooldown.
  - First name field — editable, required.
  - Last name field — editable, optional.
  - "Save changes" button — calls `PATCH /auth/me`; on success updates the auth store so the header greeting reflects immediately. Disabled while no fields have changed.
- **Password** tab
  - Current password (required).
  - New password (required, min length 12 to match registration).
  - Confirm new password (must match new password — client-side check).
  - "Update password" button — calls `POST /auth/me/password`. On 204, show toast "Password updated. You'll need to sign in again on other devices."
  - On 401 (wrong current password): inline error on the current-password field; do not clear the new-password fields.
- **Danger zone** tab
  - "Delete account" section with a destructive `Delete account` button.
  - Click opens a confirmation dialog requiring the user to (1) type their email to confirm, and (2) enter their password.
  - Dialog explicitly lists cascade consequences: "All Graphs you own — with their datasets, skills, agents, and bindings — will be deleted permanently."
  - On confirm: `DELETE /auth/me` → on 204 clear session and redirect to `/login`. On 409 guard A: "You're the sole platform admin. Promote another user before deleting this account." On 409 guard B: "You own Graphs with other members. Remove other members or transfer admin first." (Both errors are intentionally honest about the dead-end.)

`GraphsListPage` (post-login landing):
- Lists Graphs the user is a member of (`GET /api/v1/graphs`).
- Empty state: "No Graphs yet. Create your first Graph to get started." with a primary "New Graph" CTA.
- Per-row: graph name, owner `@username`, slug, role badge, last activity.
- Clicking a row navigates to `/u/{owner_username}/{slug}`.

Invitations admin page:
- Table of invitations (email, role, status, expires_at, invited_by).
- "New invitation" form (email + role select). On submit, shows one-time `redeem_url` in a modal with a copy button — after dismissing, the URL is gone.
- Per-row revoke button.
- **No email send in MVP** — copy/paste only.

Reuses `@invana/design-kit` tabs + form components. No bespoke styling.

### Storage / Migrations

**Alembic is reset on `arch/redesign` in Slice S1.5** (the cross-cutting Alembic-reset checklist in `mvp.md` lands here, not later). The S1 migration that landed under Workspace names is dropped along with the prior graph-only revisions.

1. Delete all existing revisions on the branch (`b2f1a7c3d401_add_auth_tables.py`, the two graph revisions, anything else).
2. Create a single new initial migration covering: `users` (with `username`), `graphs`, `graph_connections`, `graph_members`, `invitations` (with `graph_id`), `refresh_tokens`, `graph_schemas`. Later RFCs/slices append their tables.
3. Migration creates the `graph_role` enum type (`developer`, `analyst`, `admin`) at the DB layer for Postgres; SQLite uses a `CHECK` constraint.

Destructive on-branch change; branch has not shipped, no data migration path needed. Local dev databases must be dropped and re-initialized.

### Dependencies

Python (`engine/pyproject.toml`):
- `passlib[bcrypt]`
- `bcrypt<5` (pinned — passlib 1.7.4 trips its internal "wrap bug" probe on bcrypt 5.x)
- `PyJWT`
- `pydantic[email]` (for `EmailStr` in request schemas)
- `itsdangerous` (explicit in `[server]` extras — required by Starlette's `SessionMiddleware`)

TypeScript (`studio/package.json`):
- `axios`

Settings:
- `INVANA_SECRET_KEY` (existing) — JWT signing **and** SessionMiddleware cookie signing.
- New settings under the `auth_` prefix (override via `INVANA_AUTH_*`):
  - `auth_min_password_length = 12`
  - `auth_bcrypt_rounds = 12`
  - `auth_jwt_algorithm = "HS256"`
  - `auth_token_bytes = 32`  *(entropy for opaque refresh + invite tokens)*
  - `auth_access_token_ttl_minutes = 15`
  - `auth_refresh_token_ttl_days = 7`
  - `auth_invitation_ttl_days = 7`
  - `auth_username_change_cooldown_days = 30`
  - `auth_username_available_rate_limit_per_minute = 30`
- `studio_base_url` (default `http://localhost:8300`) — used to build invitation redeem URLs.

### starlette-admin auth provider

`/admin/*` is mounted as a Starlette **sub-app**, so it has its own `state` separate from the parent FastAPI. Gating implementation:

- `SuperuserAuthProvider` (in `engine/src/invana/server/admin/auth.py`) extends `starlette_admin.auth.AuthProvider`. It receives a reference to the parent FastAPI app at construction time (in `mount_admin`) so it can read `parent_app.state.db_session_factory` — the lifespan-managed factory — without trying to look up state on the sub-app.
- `login(username, password, ...)`: case-folds email, looks up `User`, runs a dummy bcrypt verify if the user is missing/inactive to even out timing, refuses unless `is_superuser=True`, stashes `admin_user_id` in `request.session` on success.
- `is_authenticated()` runs on every request, re-loads the user from the DB, and revalidates `is_active + is_superuser` (a stale `admin_user_id` in a session cookie can't escalate after a demote). Stores the resolved user on `request.state.admin_user` for `get_admin_user()` to display.
- Sessions ride on Starlette's `SessionMiddleware`, signed with `settings.secret_key`. Cookie name: `invana_admin_session`. `same_site="lax"`.

This is a **separate auth flow from the JWT Bearer API.** A user logs into `/admin` via the admin's own form; the JWT access token from the Studio API is not honored by `/admin`, and vice versa. They share the underlying `User` row and the `is_superuser` flag.

#### Admin model browser (read/edit surface)

starlette-admin model views are registered for the Layer 1 + identity-adjacent tables. Sensitive columns are excluded from `fields`:

| View              | Sensitive cols excluded         | Create | Edit | Delete |
|-------------------|---------------------------------|--------|------|--------|
| Users             | `password_hash`                 | ✗      | ✓    | ✓      |
| Graphs            |                                 | ✓      | ✓    | ✓      |
| Graph connections | `auth_encrypted`                | ✓      | ✓    | ✓      |
| Graph members     |                                 | ✓      | ✓    | ✓      |
| Invitations       | `token_hash`                    | ✗      | ✗    | ✓      |
| Refresh tokens    | `token_hash`                    | ✗      | ✗    | ✓      |

`Users` view shows the `username` column. Users are bootstrapped via `invana init` or the graph invitations API — never the admin UI. Invitations carry a one-shot raw token surfaced exactly once in the create response; admin-UI re-create would defeat that contract. Refresh tokens are session state — view + delete (manual revocation) only.

Note: starlette-admin exposes `can_create` / `can_edit` / `can_delete` as **methods** on `BaseView`, not class attributes. Override them as methods returning `False`; a bool class attribute crashes with `TypeError: 'bool' object is not callable`.

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Session cookies (server-side sessions) | Easy revocation; HttpOnly by default | Stateful engine; awkward for the external-agent token API (§4.11) | Engine stays stateless; external API needs token-style auth anyway |
| JWT refresh tokens (not opaque) | Symmetric handling on both sides | Revocation requires a denylist | Opaque refresh is simpler; denylist becomes the source of truth |
| `admin \| member` (original MVP) | Smaller surface | Conflates builder + consumer personas | Splitting now is cheap; retrofit later is painful |
| Self-service registration | No invitation flow needed | No control over who joins | Invite-gated is the MVP contract |
| Global slug uniqueness (Workspace MVP behavior) | Single URL segment, no `/u/` prefix | Forces a reserved-name list maintained over time; collisions with Studio top-level routes | `/u/` prefix isolates user content from Studio routes — eliminates the reserved-name maintenance burden |
| Immutable username | No URL churn for shared links | Users stuck with initial choice | Mutable + rate-limited + URLs-just-404 was accepted as a simpler model than maintaining a username alias table |
| Auto-create personal Graph on `invana init` | One-step onboarding | Forces a name/slug/intent the user hasn't thought about; creates a "placeholder" Graph that may never get cleaned up | Defer Graph creation to a deliberate user action; landing on empty `/graphs` is fine |
| HttpOnly cookie storage in Studio | XSS-safe token | Requires CORS + CSRF design | Deferred per `mvp.md`; localStorage acceptable for trusted-developer tool |

## Security Considerations

- **Bcrypt cost 12.** Re-hash on login if cost changes later.
- **Invitation tokens hashed (sha256)** — raw token only in the create response.
- **Refresh tokens hashed (sha256)** — same logic.
- **User enumeration via `/auth/login`:** returns a generic 401 regardless of whether email exists or password is wrong.
- **Username enumeration via `/auth/username-available`:** this endpoint *intentionally* discloses whether a username is taken (that's the point). Rate-limit per IP (`auth_username_available_rate_limit_per_minute`, default 30) to make scraping the namespace costly. Usernames are not secret — they appear in every Graph URL.
- **Constant-time compare** for hash lookups (passlib for passwords; sha256 + equality for token hashes).
- **Token leakage in URLs:** invite token is a query param; HTTPS in prod, one-time, short-lived.
- **starlette-admin:** wrapped in Starlette middleware that runs **before** the admin app sees the request.
- **Rate limiting `/auth/login`:** deferred for MVP. Documented gap.
- **Password rules:** minimum length 12; no complexity rules in MVP.
- **Logout** revokes refresh token but does **not** invalidate the still-valid access token (≤15 min residual). Mitigated by short access TTL.
- **Username squatting:** no protections in MVP. If it becomes a problem, gate registration behind a separate invitation system at the platform level (post-MVP).

## Performance Considerations

- Login dominated by bcrypt verify (~150 ms at cost 12). Not on a hot path.
- `get_current_user` per request: JWT verify (microseconds) + single indexed `SELECT users WHERE id = ?`. FastAPI's dep cache handles per-request reuse.
- `resolve_graph_by_username_slug` per graph-scoped request: one indexed lookup on `users.username` (unique) + one on `graphs (created_by_id, slug)` (composite unique). FastAPI dep cache de-duplicates within a request.
- Refresh rotation: one update + one insert per refresh; refreshes are rare (every 15 min).
- `/auth/username-available`: single indexed lookup on `users.username`. Rate-limit prevents abuse.
- No N+1 risk from this layer.

## Open Questions

Resolved during S1 implementation:
- [x] Rotate refresh on every refresh? **Yes** — implemented; each `/auth/refresh` revokes the presented refresh and issues a new pair.
- [x] Role promotion / demotion endpoint? **Yes (graph-scoped)** — implemented as `PATCH /u/{username}/{slug}/members/{user_id}` with a sole-admin demotion guard (409).

Resolved by RFC-017 (for S1.5):
- [x] Slug uniqueness scope — **per-owner** (`UNIQUE (created_by_id, slug)`).
- [x] Username mutability — **mutable, rate-limited, URLs break on change** (no alias table).
- [x] Personal Graph on `invana init` — **removed**.
- [x] Workspace switcher UI — **no longer applies**; active Graph is derived from the URL.
- [x] Workspace edit / delete endpoints — **now Layer 2** (Graph CRUD lands in Slice S2).
- [x] Alembic reset on `arch/redesign` — **happens in S1.5** as part of the rename.

Still open (deferred past S1.5):
- [ ] In-process token bucket for `/auth/login` rate limiting, or fully defer? **Proposal: defer.**
- [ ] `audit_log` for auth events (login, invitation issue/accept, role change, username change) in MVP? **Proposal: not in MVP; emit through RFC-006 logging.**
- [ ] Final username-change cadence (30 days is a placeholder).
- [ ] Final rate-limit cadence on `/auth/username-available` (30 req/min IP is a placeholder).

## Implementation Plan

### Slice S1 — original Layer 1 (shipped under Workspace nomenclature)

See commits `0915c7d` (initial Layer 1) and `e30e7e7` (admin views + slug-scoped routes). All [x] below describe the *current* state on `arch/redesign` prior to the S1.5 rename.

1. **Deps** — [x] `passlib[bcrypt]`, `bcrypt<5`, `PyJWT`, `pydantic[email]`, `itsdangerous` (server extras); `axios` in Studio.
2. **Schema** — [x] auth migration `b2f1a7c3d401`: `users`, `workspaces`, `workspace_members`, `invitations`, `refresh_tokens`, `workspace_role` enum. (To be replaced in S1.5.)
3. **Engine — auth module** — [x] models, schemas, passwords, jwt, tokens, services, deps, routes.
4. **Engine — wiring** — [x] auth + workspaces routers mounted; SessionMiddleware; `SuperuserAuthProvider`-gated `/admin`.
5. **CLI** — [x] `invana init` (with personal-workspace creation — to be removed in S1.5).
6. **Studio** — [x] axios + interceptors; Zustand auth store; `useAuth`; `ProtectedRoute`; `RoleGate`; `LoginPage`; `RegisterPage`; `/settings/profile` (Basic / Password / Danger zone); `/workspaces/:slug/settings/{members,invitations}`; user-menu dropdown.
7. **Admin** — [x] `SuperuserAuthProvider`; Users / Workspaces / WorkspaceMembers / Invitations / RefreshTokens views.

### Slice S1.5 — Workspace → Graph rename + username + Alembic reset (RFC-017)

Mechanical rename + three additive features (`username`, `/auth/username-available`, removal of personal-Graph on init).

1. **Schema** — full Alembic reset
   - [ ] Delete all existing revisions on `arch/redesign` (auth + graph migrations).
   - [ ] Single new initial migration: `users` (with `username` + `username_last_changed_at`), `graphs`, `graph_connections`, `graph_members`, `invitations` (with `graph_id`), `refresh_tokens`, `graph_schemas`, `graph_role` enum.
   - [ ] Local dev DBs must be dropped and re-initialized — call out in S1.5 commit message.

2. **Engine — rename + additions**
   - [ ] `auth/models.py` — add `User.username` + `username_last_changed_at`; drop `Workspace`, `WorkspaceMember`, `workspace_role`.
   - [ ] `graphs/models.py` — existing `Graph` → `GraphConnection`; new `Graph` container; `GraphMember`; `graph_role` enum.
   - [ ] `auth/schemas.py` — add `username` to register / me / patch schemas; new `UsernameAvailabilityResponse`.
   - [ ] `auth/services.py` — username validator (regex + reserved + cooldown); availability service.
   - [ ] `auth/routes.py` — add `GET /auth/username-available` (unauthenticated, rate-limited); update PATCH `/auth/me` to accept username with cooldown enforcement.
   - [ ] Move graph-membership deps from `auth/deps.py` → new `graphs/deps.py` (`resolve_graph_by_username_slug`, `get_graph_membership`, `require_graph_{member,builder,admin}`).
   - [ ] Re-prefix all graph-scoped routes from `/workspaces/{wid}` → `/u/{username}/{slug}`.
   - [ ] `server/app.py` — update mount registrations.
   - [ ] `server/admin/views.py` — rename `Workspaces*` views → `Graphs*` + `GraphMembers`; add `GraphConnectionsView`; add `username` column to `UsersView`.

3. **Engine — settings**
   - [ ] Add `auth_username_change_cooldown_days = 30`, `auth_username_available_rate_limit_per_minute = 30`.

4. **CLI**
   - [ ] `invana init` — prompt for `username` (validated); **remove** personal-Graph creation; update copy to "You can create your first Graph after signing in"; `--non-interactive` accepts `--username`.

5. **Studio**
   - [ ] `types/auth.ts` — add `username` to `User`; replace `Workspace*` types with `Graph*`.
   - [ ] `services/api/auth.ts` — `username` in register payload + PATCH; new `checkUsernameAvailable(username)`.
   - [ ] `services/api/workspaces.ts` → `services/api/graphs.ts` (re-targeted to `/u/:username/:slug/...`).
   - [ ] `stores/auth.store.ts` — drop "derive active workspace from session" assumption.
   - [ ] `hooks/useAuth.ts` — `membershipForSlug` → `membershipForGraph(username, slug)`.
   - [ ] `pages/auth/RegisterPage.tsx` — add username field with live availability check (debounced 300 ms).
   - [ ] `pages/auth/LoginPage.tsx` — redirect to `/graphs` on success.
   - [ ] `pages/settings/ProfileSettingsPage.tsx` — username field with live check + cooldown indicator.
   - [ ] `pages/settings/WorkspaceMembersPage.tsx` → `GraphMembersPage.tsx`; same for Invitations.
   - [ ] **New** `pages/graphs/GraphsListPage.tsx` — post-login landing with empty state + create CTA.
   - [ ] `App.tsx` / `router.tsx` — `/workspaces/:slug/...` → `/u/:username/:slug/...`; add `/graphs`.

6. **Manual verification (per project memory: no test rewrites for `arch/redesign`)**
   - [ ] `invana init` creates a root superuser with a username; no Graph is auto-created.
   - [ ] Root logs in → lands on empty `/graphs` with create-CTA.
   - [ ] `/auth/username-available?username=foo` returns `{available: true}` for unused, `{available: false, reason: "taken"}` for the root's username.
   - [ ] PATCH `/auth/me` rejects username change inside cooldown with 409.
   - [ ] All Layer 1 flows from the original S1 demo gate work under the new URLs.

### Done when (Slice S1.5 demo gate)

- From a clean checkout: drop dev DB → `alembic upgrade head` → `invana init` → root superuser with username created, no Graph created.
- Root logs in, lands on `/graphs` (empty state).
- Root opens `/settings/profile` → Basic info tab shows username; tries to change it → succeeds, stamps `username_last_changed_at`; tries again immediately → 409 with cooldown message.
- (Once Slice S2 lands) Root creates a Graph, invites a developer; developer registers via the invite URL, picks a username with live availability check, lands on `/u/<root-username>/<graph-slug>` as developer.

## References

- [`docs/internal/mvp.md`](../mvp.md) — Layer 1 scope and Slices S1 + S1.5.
- [RFC-017 — Graph as the Primary Container](../../rfcs/017-graph-as-primary-container.md) — the rename + username + setup wizard.
- [RFC-003 — Server & Admin Module](../../rfcs/003-server-admin.md) — starlette-admin mount.
- [RFC-005 — CLI](../../rfcs/005-cli.md) — existing Click structure.
- [RFC-012 — Mission-Centric Architecture](../../rfcs/012-mission-centric-architecture.md) — partially superseded by RFC-017; `users` table draft and delete-semantics still apply.
- [`docs/system-design.md`](../../system-design.md) §4.1, §4.11.
