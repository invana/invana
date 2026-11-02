# Sessions

A short-lived access token for every request, and an opaque refresh token that can be revoked in one
database write.

| | |
|---|---|
| Index | [11.3](../../../README.md#11--identity-and-access) · Slice **S1** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [accounts](accounts.md) · [personal access tokens](tokens.md) · [external-agent-api](../../operate/features/external-agent-api.md) |

Product spec: [ST-F03 · You — account and sessions](../../../../../specs/products/settings/features/ST-F03-you-account-and-sessions/feature.md) — ST-15; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| Sign-in | Sets both tokens; the refresh is not exposed to page scripts more than it must be |
| Sign-in, already signed in | Resumes first: `GET /auth/me` (rotating the access token if it expired), then redirects to `?next=` |
| Profile → Sessions | Sign out here, or everywhere |
| Every request | Identity resolved, membership checked |

## Engine

| Thing | Shape |
|---|---|
| Access token | signed, short TTL, claims: subject and the superuser flag |
| `refresh_tokens` | opaque value, owner, issued/expiry, revoked flag |
| Rotation | one transaction: revoke old, issue new |
| Routes | `POST /auth/login · /auth/refresh · /auth/logout` |
| Events | `session.started · refreshed · revoked · reuse_detected` |

## Decisions

| # | Decision |
|---|---|
| SS2 | Refresh tokens are opaque server-side rows, so revocation needs no denylist. |
| SS8 | Only `/auth/login`, `/auth/refresh` and `/auth/logout` skip the client's 401 refresh-and-retry. Every other authenticated route, `/auth/me` included, rotates an expired access token underneath the caller. |

## Not building

| Not building | Because |
|---|---|
| A JWT denylist | rotation plus a server-side row is simpler and exact |
