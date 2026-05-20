# Layer 1 — Identity & Access

> **Status**: Implemented (S1)
> **Author**: Invana Team
> **Created**: 2026-05-21
> **Updated**: 2026-05-21
> **Maps to MVP**: Layer 1 of `docs/internal/mvp.md`, Slice **S1**

---

## Summary

First auth surface for Invana. JWT-based access tokens with opaque server-side refresh tokens; invite-gated, **workspace-scoped** registration; three workspace roles (`developer`, `analyst`, `admin`) plus a platform-level `is_superuser` flag; CLI bootstrap (`invana init`); and a session-authed `starlette-admin` that only superusers can sign into.

**Workspace-scoped roles.** Role is **not** on the user. The same user can be `admin` of their personal workspace and `developer` (or `analyst`) of another workspace they were invited to collaborate in. Roles live on the `workspace_members` join table.

All tunable auth knobs live under `settings.auth_*` (`INVANA_AUTH_*` env vars): password length, bcrypt rounds, JWT algorithm, refresh-token entropy, and TTLs.

## Motivation

The engine is currently open: no `User`, no JWT, no auth dependency anywhere. Layer 2 (workspace registries) and Layer 3 (missions, RFC-012) both presuppose a `User` for ownership. Layer 8.3 (external-agent API) needs scoped tokens. starlette-admin is mounted at `/admin` with no protection.

Two roles (`admin | member`, the original MVP shape) collapse two distinct non-admin personas:

- People who **build** missions — connect graph DBs, author skills, configure agents, register datasets.
- People who **consume** missions — run agents, view results, do not change structure.

We split these into `developer` and `analyst`. `admin` adds platform operations on top of `developer`.

If we don't do this now: every later slice has to either skip auth (and then retrofit it across every route) or invent its own ad-hoc gating. Both are worse than building the layer once.

## Design

### Data Model

Five new tables. UUID PKs, timestamps in UTC, hard deletes only (per project memory).

#### `users`

```
users
──────────────────────────────────────────────────────
id              UUID PK
email           String(320)    UNIQUE NOT NULL
password_hash   String(255)    NOT NULL    (bcrypt)
first_name      String(120)    NOT NULL
last_name       String(120)    nullable
is_superuser    Boolean        NOT NULL default False
is_active       Boolean        NOT NULL default True
created_at      DateTime       NOT NULL
updated_at      DateTime       NOT NULL
```

- `email` is the login identity, case-folded to lower on write.
- `first_name` is required so the UI always has something to greet the user with (`Hi, <first_name>`). `last_name` is optional.
- **No `role` column** — role is workspace-scoped (see below).
- `is_superuser` is the platform-level flag — gates `/admin` and DB-level operations only. Set only by `invana init` for the root user.
- `is_active=False` blocks login and rejects existing tokens at `get_current_user`.

#### `workspaces`

```
workspaces
──────────────────────────────────────────────────────
id              UUID PK
name            String(255)    NOT NULL
slug            String(255)    UNIQUE NOT NULL
created_by_id   UUID FK → users.id  ON DELETE SET NULL
created_at      DateTime       NOT NULL
updated_at      DateTime       NOT NULL
```

- One workspace is created by `invana init` for the root user (slug derived from `first_name`).
- `slug` is unique globally (URL routing trades flexibility for simplicity in MVP).

#### `workspace_members`

```
workspace_members
──────────────────────────────────────────────────────
workspace_id    UUID FK → workspaces.id  ON DELETE CASCADE
user_id         UUID FK → users.id       ON DELETE CASCADE
role            Enum (workspace_role)    developer | analyst | admin  NOT NULL
created_at      DateTime                 NOT NULL

PRIMARY KEY (workspace_id, user_id)
```

- A user's role is read from here for the workspace whose resource is being accessed.
- Service-layer guards prevent demoting/removing the **sole admin** of a workspace (409 Conflict).

#### `invitations` (workspace-scoped)

```
invitations
──────────────────────────────────────────────────────
id              UUID PK
token_hash      String(64)     UNIQUE NOT NULL    (sha256 hex of raw token)
email           String(320)    NOT NULL                    (lower-cased)
workspace_id    UUID FK → workspaces.id  ON DELETE CASCADE
role            Enum (workspace_role)    NOT NULL
invited_by_id   UUID FK → users.id       ON DELETE SET NULL
expires_at      DateTime       NOT NULL
accepted_at     DateTime       nullable
created_at      DateTime       NOT NULL
```

- Invitations target a specific workspace; accepting attaches the invitee as a member of that workspace with the specified role.
- If a user with `email` already exists, accepting only creates the workspace membership (the password field of the request is ignored).
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

Roles are scoped to (workspace, user). The same user can hold different roles in different workspaces.

```
WITHIN A WORKSPACE
──────────────────────────────────────────────────────────────────────────
admin     →  everything developer can do
              + invitation / member management within THIS workspace
              ✗ platform admin (/admin) — that's the superuser flag

developer →  create / edit / delete missions in this workspace
              + datasets, skills, LLM configs, agents, bindings
              + run agents · full read
              ✗ invitation / member management

analyst   →  full read across this workspace
              + run agents (write-back persists, subject to per-agent policy)
              ✗ create / edit / delete missions, datasets, skills,
                LLM configs, agents, bindings
              ✗ invitation / member management

PLATFORM-LEVEL
──────────────────────────────────────────────────────────────────────────
is_superuser   →  signs into starlette-admin (/admin)
                  Otherwise behaves like any user in their workspaces.
                  Set only by `invana init` for the root user.
```

FastAPI dependencies (in `engine/src/invana/auth/deps.py`):

- `get_current_user` — verifies access JWT, loads user, checks `is_active`. 401 on missing/invalid, 403 on inactive.
- `require_superuser` — gates `/admin` (platform-level).
- `get_workspace_membership` — resolves `(workspace_id from path, current_user) → WorkspaceMember`; 403 if not a member.
- `require_workspace_member` — any active member of the workspace.
- `require_workspace_builder` — admin or developer in the workspace; gates mission-structure mutations.
- `require_workspace_admin` — admin in the workspace; gates invitation / member management.

The workspace deps compose: `require_workspace_admin` ⊃ `require_workspace_builder` ⊃ `require_workspace_member` ⊃ `get_workspace_membership` ⊃ `get_current_user`.

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
  The JWT carries **only the user identity** plus the `sup` (superuser) flag. Workspace role is **not** denormalised into the token — it must be looked up per request via `WorkspaceMember`, because a single token may be used across multiple workspaces with different roles.
- Refresh "token" is **not** a JWT — opaque server-side string (see `refresh_tokens`). Revocation is a single DB update; no JWT denylist needed.
- Rotation: each successful `/auth/refresh` revokes the old refresh row and issues a new one.

### Password hashing

- `passlib[bcrypt]`, cost from `settings.auth_bcrypt_rounds` (default **12**).
- **Minimum length** from `settings.auth_min_password_length` (default **12**).
- `bcrypt` pinned to `<5` (passlib 1.7.4 trips its "wrap bug" detection on bcrypt 5.x, which raises on >72-byte inputs).
- Stored in `users.password_hash`.
- Login uses `passlib.context.CryptContext.verify` (constant-time).

### API Surface

Two routers: `/api/v1/auth/*` (user-level) and `/api/v1/workspaces/*` (workspace-scoped). JSON.

```
POST /api/v1/auth/register?invite=<raw_token>
  Body:     { "first_name": "...", "last_name": "...", "password": "..." }
  Effects:  hashes invite token → looks up invitation row → checks not expired/accepted
            → if no user exists for invitation.email: creates one with name + bcrypt(password)
            → attaches the user as a WorkspaceMember of invitation.workspace_id with invitation.role
            → marks invitation accepted
            → issues access + refresh tokens
  Returns:  { "user": {...}, "access_token": "...", "refresh_token": "..." }
  Errors:   404 (bad token), 410 (expired), 409 (already accepted)

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
              "id": "...", "email": "...",
              "first_name": "...", "last_name": "...",
              "is_superuser": false,
              "workspaces": [
                { "workspace_id": "...", "workspace_name": "...",
                  "workspace_slug": "...", "role": "admin" },
                ...
              ]
            }

PATCH /api/v1/auth/me                     [require_member]
  Body:     { "first_name"?: "...", "last_name"?: "..." }
  Effects:  updates only the supplied fields on the current user.
            Email and role are NOT editable here (email is immutable for
            MVP; role changes are an admin operation, deferred).
  Returns:  updated user payload (same shape as GET /auth/me)
  Errors:   422 (validation), 401 (no/invalid token)

POST /api/v1/auth/me/password             [require_member]
  Body:     { "current_password": "...", "new_password": "..." }
  Effects:  verifies current_password via bcrypt; on success, hashes
            new_password and writes to users.password_hash; revokes ALL
            of this user's refresh tokens (forces re-login on other
            devices). The current session's access token remains valid
            until its 15-min TTL elapses — acceptable trade-off.
  Returns:  204
  Errors:   401 (current_password wrong — generic message),
            422 (new_password fails length rule)

DELETE /api/v1/auth/me                    [require_member]
  Body:     { "password": "..." }
  Effects:  verifies password; hard-deletes the user row. Cascade per
            RFC-012 / project delete-semantics memory: missions owned by
            this user cascade down. Refresh tokens cascade via FK.
            Guard: if the user is the ONLY admin (role=admin and the
            single remaining active admin), the request is rejected
            with 409 to prevent the platform locking itself out.
  Returns:  204 (client clears session and redirects to /login)
  Errors:   401 (wrong password), 409 (sole remaining admin)

─────────────────────────────────────────────────────────────────────────
WORKSPACES
─────────────────────────────────────────────────────────────────────────

GET  /api/v1/workspaces                            [get_current_user]
  Returns:  Workspaces the current user is a member of.

POST /api/v1/workspaces                            [get_current_user]
  Body:     { "name": "...", "slug": "..." }
  Effects:  creates workspace; creator is automatically added as admin.
  Returns:  Workspace.

GET    /api/v1/workspaces/{wid}/members            [require_workspace_member]
PATCH  /api/v1/workspaces/{wid}/members/{user_id}  [require_workspace_admin]
  Body:     { "role": "developer|analyst|admin" }
  Guard:    cannot demote the sole admin of the workspace (409).

DELETE /api/v1/workspaces/{wid}/members/{user_id}  [require_workspace_admin]
  Guard:    cannot remove the sole admin (409).

POST   /api/v1/workspaces/{wid}/invitations        [require_workspace_admin]
  Body:     { "email": "...", "role": "developer|analyst|admin" }
  Returns:  { ..., "redeem_url": "<studio>/register?invite=<raw_token>" }
  Note:     raw token returned exactly once.

GET    /api/v1/workspaces/{wid}/invitations        [require_workspace_admin]
DELETE /api/v1/workspaces/{wid}/invitations/{id}   [require_workspace_admin]
```

`/admin/*` (starlette-admin) is gated by a custom `AuthProvider` that signs users in with their email + password and verifies `is_superuser=True` on every request. Session cookies via Starlette's `SessionMiddleware`, signed with `INVANA_SECRET_KEY`. Non-superusers get a `LoginFailed` error.

### CLI

`invana init` — added to the existing Click CLI at `engine/src/invana/cli/main.py`.

```
$ invana init
First name:          Ravi
Last name (optional): Merugu
Email:                rrmerugu@example.com
Password:             ********
Confirm:              ********
✓ Created root admin user (rrmerugu@example.com).
  Log in at: http://localhost:8000/login
```

Behaviour:
- Interactive prompts via `click.prompt` (hidden for password).
- **`first_name` is required**; pressing enter without a value re-prompts.
- **`last_name` is optional** — pressing enter without a value stores `NULL` (matches the column nullability and the `/auth/register` contract). Prompt is labelled "Last name (optional)" and uses `click.prompt(..., default="", show_default=False)` so empty input is accepted; empty string is normalised to `NULL` before insert.
- Idempotent: if **any** user with `role=admin` already exists, exits with a clear message ("Admin user already exists; use invitations to create more"). No `--force`.
- Uses the same service used by `/auth/register` (without the invitation lookup) — never bypasses bcrypt.
- Does **not** issue tokens; new admin logs in via the UI (system-design §4.1: CLI does not register additional users beyond the root).
- Bails non-zero if Alembic migrations are not at head.

### Studio UI

New routes:

```
/login                 — LoginPage
/register?invite=<t>   — RegisterPage (reads invite from query)
/settings/profile      — ProfileSettingsPage  (any authenticated user)
/settings/users        — admin-only: list users + role
/settings/invitations  — admin-only: issue / list / revoke
```

All other routes wrapped in `<ProtectedRoute>` — redirects to `/login` if no valid access token.

Components / hooks:
- `stores/auth.store.ts` (Zustand) — `{ user, accessToken, refreshToken, login, logout, setSession, clearSession }`. Persists tokens to `localStorage`. HttpOnly cookies deferred per `mvp.md`.
- `services/api/client.ts` — replace raw `fetch()` with axios:
  - Request interceptor: attach `Authorization: Bearer <access>`.
  - Response interceptor: on 401, attempt `/auth/refresh`; on success retry once with new token; on failure clear session and route to `/login`. A single-flight lock prevents concurrent refresh storms.
- `useAuth()` — exposes `user` (including `first_name` / `last_name` for header display), `role`, `isAdmin`, `isBuilder` (admin || developer), `isAnalyst`, plus a `displayName` helper (`first_name` + optional `last_name`).
- `<ProtectedRoute>` — renders children only if `accessToken` present; otherwise navigates to `/login?next=<current>`.
- `<RoleGate role="admin|builder|member">` — conditional render for role-restricted UI.

Profile settings page (`/settings/profile`) — tabbed, available to every authenticated user:

- **Basic info** tab
  - Email field — disabled (read-only) input showing the user's email; tooltip "Email cannot be changed".
  - First name field — editable, required.
  - Last name field — editable, optional.
  - "Save changes" button — calls `PATCH /auth/me`; on success updates the auth store so the header greeting reflects immediately. Disabled while no fields have changed.
- **Password** tab
  - Current password (required).
  - New password (required, min length 12 to match registration).
  - Confirm new password (must match new password — client-side check).
  - "Update password" button — calls `POST /auth/me/password`. On 204, show a toast "Password updated. You'll need to sign in again on other devices." (the current session keeps working because its access token is still valid.)
  - On 401 (wrong current password): inline error on the current-password field; do not clear the new-password fields.
- **Danger zone** tab
  - "Delete account" section with a destructive `Delete account` button.
  - Click opens a confirmation dialog requiring the user to (1) type their email to confirm, and (2) enter their password.
  - Dialog explicitly lists cascade consequences: "All missions you own, with their datasets, skills, agents, and bindings, will be deleted permanently."
  - On confirm: `DELETE /auth/me` → on 204 clear session and redirect to `/login`. On 409 (sole-admin guard) show error: "You're the only admin. Promote another user before deleting this account." (Promotion is post-MVP — for now the only escape is `invana init` reset; the error message is intentionally honest about the dead-end.)

Reuses `@invana/design-kit` tabs + form components. No bespoke styling.

Invitations admin page:
- Table of invitations (email, role, status, expires_at, invited_by).
- "New invitation" form (email + role select). On submit, shows one-time `redeem_url` in a modal with a copy button — after dismissing, the URL is gone.
- Per-row revoke button.
- **No email send in MVP** — copy/paste only.

### Storage / Migrations

Alembic is reset on `arch/redesign` per the cross-cutting checklist in `mvp.md`. This RFC produces that reset:

1. Delete the two existing graph-only revisions on the branch.
2. Create a single new initial migration with `users`, `invitations`, `refresh_tokens`. Later RFCs append their tables.
3. Migration creates the `role` enum type (`developer`, `analyst`, `admin`) at the DB layer for Postgres; SQLite uses a `CHECK` constraint.

Destructive on-branch change; branch has not shipped, no data migration path needed.

### Dependencies

Python (`engine/pyproject.toml`):
- `passlib[bcrypt]`
- `PyJWT`

TypeScript (`studio/package.json`):
- `axios`

Settings (no new env vars in MVP):
- `INVANA_SECRET_KEY` (existing) — JWT signing.
- New settings fields (defaults, no env override needed):
  - `access_token_ttl_minutes = 15`
  - `refresh_token_ttl_days = 7`
  - `invitation_ttl_days = 7`

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Session cookies (server-side sessions) | Easy revocation; HttpOnly by default | Stateful engine; awkward for the external-agent token API (§4.11) | Engine stays stateless; external API needs token-style auth anyway |
| JWT refresh tokens (not opaque) | Symmetric handling on both sides | Revocation requires a denylist | Opaque refresh is simpler; denylist becomes the source of truth |
| `admin \| member` (original MVP) | Smaller surface | Conflates builder + consumer personas | Splitting now is cheap; retrofit later is painful |
| Self-service registration | No invitation flow needed | No control over who joins | Invite-gated is the MVP contract |
| Role-per-mission (mission_members) | Per-mission permissioning | Over-scoped for MVP; missions are single-owner | Deferred to org/team sharing (post-1.0) |
| HttpOnly cookie storage in Studio | XSS-safe token | Requires CORS + CSRF design | Deferred per `mvp.md`; localStorage acceptable for trusted-developer tool |

## Security Considerations

- **Bcrypt cost 12.** Re-hash on login if cost changes later.
- **Invitation tokens hashed (sha256)** — raw token only in the create response.
- **Refresh tokens hashed (sha256)** — same logic.
- **User enumeration:** `/auth/login` returns a generic 401 regardless of whether email exists or password is wrong.
- **Constant-time compare** for hash lookups (passlib for passwords; sha256 + equality for token hashes).
- **Token leakage in URLs:** invite token is a query param; HTTPS in prod, one-time, short-lived.
- **starlette-admin:** wrapped in Starlette middleware that runs **before** the admin app sees the request.
- **Rate limiting `/auth/login`:** deferred for MVP. Documented gap.
- **Password rules:** minimum length 12; no complexity rules in MVP.
- **Logout** revokes refresh token but does **not** invalidate the still-valid access token (≤15 min residual). Mitigated by short access TTL.

## Performance Considerations

- Login dominated by bcrypt verify (~150 ms at cost 12). Not on a hot path.
- `get_current_user` per request: JWT verify (microseconds) + single indexed `SELECT users WHERE id = ?`. FastAPI's dep cache handles per-request reuse.
- Refresh rotation: one update + one insert per refresh; refreshes are rare (every 15 min).
- No N+1 risk from this layer.

## Open Questions

- [ ] Rotate refresh on every refresh? **Proposal: yes.**
- [ ] In-process token bucket for `/auth/login` rate limiting, or fully defer? **Proposal: defer.**
- [ ] Analyst write-back gated by per-agent policy (`auto-commit` vs. `review-required`, L7.3)? **Proposal: yes** — same policy applies regardless of who runs the agent.
- [ ] `audit_log` for auth events (login, invitation issue/accept, role change) in MVP? **Proposal: not in MVP; emit through RFC-006 logging.**
- [ ] Role promotion / demotion endpoint (admin changes another user's role)? **Proposal: defer to post-S1.** The sole-admin delete guard surfaces this gap, but for MVP the workaround is: invite a second admin first, then delete. Documented in the delete-account error message.

## Implementation Plan

Maps to MVP Slice **S1**. BE + FE tracked together.

1. **Deps**
   - [ ] Add `passlib[bcrypt]`, `PyJWT` to `engine/pyproject.toml`; `uv lock`.
   - [ ] Add `axios` to `studio/package.json`; `pnpm install`.

2. **Schema**
   - [ ] Reset Alembic history on `arch/redesign`.
   - [ ] Initial migration: `users`, `invitations`, `refresh_tokens`, role enum.

3. **Engine — auth module** (`engine/src/invana/auth/`)
   - [ ] `models.py` — SQLAlchemy models.
   - [ ] `schemas.py` — pydantic request/response.
   - [ ] `passwords.py` — passlib context, hash + verify.
   - [ ] `jwt.py` — encode/decode access tokens.
   - [ ] `tokens.py` — refresh-token issue / validate / revoke.
   - [ ] `services.py` — register, login, refresh, logout, me (get + patch + change_password + delete_self with sole-admin guard), invitations CRUD.
   - [ ] `deps.py` — `get_current_user`, `require_member`, `require_builder`, `require_admin`.
   - [ ] `routes.py` — FastAPI router under `/api/v1/auth`.

4. **Engine — wiring**
   - [ ] Add settings fields (`access_token_ttl_minutes`, `refresh_token_ttl_days`, `invitation_ttl_days`).
   - [ ] Attach `get_current_user` to every router except `/auth/*`.
   - [ ] Wrap `/admin` mount in JWT + admin middleware (currently unprotected, RFC-003).

5. **CLI** (`engine/src/invana/cli/main.py`)
   - [ ] Add `invana init` Click command. Reuses register-without-invitation path.

6. **Studio**
   - [ ] Replace `services/api/client.ts` `fetch` with axios + interceptors.
   - [ ] `stores/auth.store.ts` (Zustand, persisted).
   - [ ] `useAuth` hook + `ProtectedRoute` + `RoleGate`.
   - [ ] `LoginPage`, `RegisterPage` (reads `?invite=`; collects first/last name + password).
   - [ ] `/settings/profile` with three tabs: Basic info, Password, Danger zone (delete account with email + password confirmation).
   - [ ] Admin: `/settings/users`, `/settings/invitations`.
   - [ ] App shell: hide admin links via `RoleGate`.

7. **Docs**
   - [ ] Update `docs/internal/mvp.md` Layer 1.4 role enum to `developer | analyst | admin`.

8. **Done when** (Slice S1 demo gate)
   - From a clean checkout: `invana init` → admin created.
   - Admin logs in via UI, lands on empty `/missions`.
   - Admin issues a developer invitation, copies URL.
   - Second browser opens URL, sets first/last name + password, lands on `/missions` as developer; header shows "Hi, &lt;first_name&gt;".
   - Same flow with analyst — analyst's `POST /missions` returns 403.
   - `/admin` is 401 without token, 403 with developer/analyst token, 200 with admin token.
   - Refresh flow: kill the access token client-side, next request 401 → interceptor refreshes → request retried → 200.
   - `/settings/profile` Basic info: edit first/last name → header greeting updates without reload; email field is read-only.
   - `/settings/profile` Password: with wrong current password → inline 401 error; with correct → 204; other devices' refresh tokens revoked (re-login forced on next refresh).
   - `/settings/profile` Danger zone: typing email + password deletes the account; if it's the only admin, 409 is shown and the account is preserved.

## References

- [`docs/internal/mvp.md`](../mvp.md) — Layer 1 scope and Slice S1.
- [RFC-003 — Server & Admin Module](../../rfcs/003-server-admin.md) — current starlette-admin mount.
- [RFC-005 — CLI](../../rfcs/005-cli.md) — existing Click structure.
- [RFC-012 — Mission-Centric Architecture](../../rfcs/012-mission-centric-architecture.md) — `users` table draft.
- [`docs/system-design.md`](../../system-design.md) §4.1, §4.11.
