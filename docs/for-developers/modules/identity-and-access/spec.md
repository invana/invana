# Identity and access — module spec

Who you are, how you stay signed in, which Graphs you can reach and what you may change there.
Deliberately small: an account, a username that is also a URL, a session that can be revoked,
membership, and five Graph roles.

| | |
|---|---|
| Index | [§11 · Identity and access](../../README.md#11--identity-and-access) |
| Features | [accounts](features/accounts.md) · [usernames](features/usernames.md) · [sessions](features/sessions.md) · [membership](features/membership.md) · [personal access tokens](features/personal-access-tokens.md) · [roles](features/roles.md) |
| Depends on | — |
| Depended on by | everything: every request resolves to a principal |

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Account** | a person, identified by email | a seat |
| **Username** | the URL identity — `/u/<username>/<graphSlug>/…` | a display name |
| **Session** | an access token plus a revocable refresh token | a login row |
| **Personal access token** | a long-lived credential a person mints for a script, carrying their identity | a scope, or a second permission system |
| **Member** | someone with access to a Graph | a role |
| **Graph role** | what a member may change: `viewer` · `contributor` · `builder` · `modeller` · `owner` | a run's `role` |
| **Install Admin** | `is_superuser` — install rules, standards, datasets, retraction, outside any Graph | a Graph owner |

## 2. Membership, then roles

| Rule | Detail |
|---|---|
| You are a member of a Graph, or you are not | A member reads everything in it |
| A Graph role is the right to change an area | `viewer` asks · `contributor` projects and tasks · `builder` agents, skills, evals · `modeller` models, rules, guardrails · `owner` members and settings — [roles](features/roles.md) |
| The creator is the first owner | The URL namespace is theirs; a second owner is a role, not a transfer |
| The install Admin is separate | It is install administration, and never a way into someone's Graph |

What an agent may run is still an **envelope** question, and what "done" means a **criterion**
question — roles bound people, not agents.

## 3. What this module owns

| Owns | Shape |
|---|---|
| `users` | `email` (login, case-folded) · `username` · `password_hash` · `first_name` · `last_name?` · `is_superuser` · `is_active` · `username_last_changed_at` |
| `refresh_tokens` | opaque, server-side, revocable, rotated on use |
| `personal_access_tokens` | hashed, server-side, revocable, never rotated — [11.5](features/personal-access-tokens.md) |
| `graph_members` | `graph_id` · `user_id` · `roles` — the whole access model |
| Auth routes | `/api/v1/auth/*`; everything else is graph-scoped under `/api/v1/u/{username}/{graphSlug}/…` |
| The superuser flag | what the admin application checks — the application itself is [13.6](../platform/features/admin-and-health.md) |

## 4. What a token carries

```mermaid
flowchart LR
    A[Sign in] --> B[Access token · short-lived]
    A --> C[Refresh token · opaque · server-side]
    B --> D[Every request: who you are + superuser flag]
    D --> E{Member of this Graph · holds the area's role?}
    E -->|looked up per request| F[Allowed]
    E -->|no| G[Refused]
    C --> H[Refresh · rotates · old row revoked]
    H --> B
```

| Rule | Detail |
|---|---|
| The token carries identity only | Not membership, and not the username — both can change while a token lives. A [personal access token](features/personal-access-tokens.md) carries the same thing, for longer |
| Membership is checked per request | So revoking access takes effect immediately |
| The refresh token is not a JWT | It is a server-side row, so revocation is a database update rather than a denylist |
| Rotation on every refresh | A reused old refresh token is a signal, not a convenience |

## 5. Cross-feature decisions

| # | Decision |
|---|---|
| IA1 | Membership grants reading; a member's Graph roles grant writing, one area each. The policy is one table, enforced on every graph-scoped route ([roles](features/roles.md)). |
| IA2 | Access tokens carry identity and the superuser flag; membership is resolved per request. |
| IA3 | Refresh tokens are opaque, server-side and rotated on use. |
| IA4 | The username is a URL identity and is mutable, rate-limited, and never aliased. |
| IA5 | Deletes are hard; there is no soft-delete tier for accounts. |
| IA6 | Superuser is the install Admin: install rules, standards, datasets and retraction. It grants no access to a Graph's contents. |
| IA7 | The admin application browses app state for operators. It is not a product surface, and it is never how a member reaches their own Graph. |
| IA8 | Every credential this module issues carries identity and nothing else. A long-lived one is a personal access token, revocable on its own; a scoped one belongs to a Graph, and is [10.4](../operate/features/external-agent-api.md). |
| IA9 | Credential management needs a session. A request authenticated by a personal access token cannot mint or revoke one, change a password, delete an account or provision a user. |

## 6. Deliberately absent

| Not built | Because |
|---|---|
| Per-record permissions, custom roles | five Graph roles over five areas carry the product; anything finer is unproven |
| Invitations | a member is added directly; an invitation flow is a product of its own |
| Old-username aliases and redirects | a username is an address, and addresses that silently forward hide mistakes |
| SSO and OAuth providers | email and password first; a provider is a later decision |
| Admin as a product surface | it exists so an operator can inspect state without writing SQL, not as a way around the product |
| Soft deletes, trash, undo | archive covers the real need for Graphs; accounts delete outright |
