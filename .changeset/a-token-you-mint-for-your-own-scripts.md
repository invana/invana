---
"invana": minor
"studio": minor
---

Personal access tokens — a credential you mint for your own scripts (11.5, PT1–PT9).

Automating against your own Graphs meant one of two things: a password in a cron file, or
re-posting `/auth/login` every fifteen minutes for an access token that expires. Both are a
password held by a script.

**Profile › Access tokens** mints one. It carries your identity and nothing else — every
Graph you are a member of, with exactly the access you have — and membership is still
resolved per request, so losing access to a Graph closes the token's way in at the same
moment (PT1). The secret is shown once, on creation, and only its sha256 hash is stored
(PT2); the list shows `invana_pat_…abcd`, when it was last used, and when it expires.

```bash
curl -H "Authorization: Bearer invana_pat_…" \
  http://localhost:8300/api/v1/auth/me
```

| | |
|---|---|
| Routes | `GET · POST /api/v1/auth/me/tokens` · `DELETE …/tokens/{id}` (revokes) |
| Expiry | 30 · 90 · 365 days or never — the offer is `INVANA_AUTH_TOKEN_EXPIRY_DAY_CHOICES`, and Studio renders the picker from it |
| Ceiling | `INVANA_AUTH_MAX_PERSONAL_ACCESS_TOKENS`, default 20 — the refusal names the ceiling and your count |
| Refusals | unknown · revoked · expired are told apart, and recorded as `token.refused` |

Two deliberate limits. A token is read from the `Authorization` header only, never from
`?token=` — that fallback exists for `EventSource`, and a long-lived secret does not belong
in a URL or a log (PT5). And **a token cannot manage credentials**: minting, revoking,
changing a password, deleting the account and provisioning a user all need a signed-in
session, so a leaked token cannot entrench itself (PT4).

A password change still revokes your sessions and leaves tokens alone (PT6) — rotating a
password should not silently stop a script. Revoking is its own, explicit action.
