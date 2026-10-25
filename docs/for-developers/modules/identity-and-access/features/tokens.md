# Tokens

A long-lived credential that acts as its holder, so a script, a terminal, CI or Claude Code can call the
API without a password. A token minted in a Graph's IAM may be **narrowed** by an inline policy and is
bound to that Graph; one minted on the profile carries its holder's identity everywhere.

| | |
|---|---|
| Index | [11.5](../../../README.md#11--identity-and-access) · Slice **S1** · narrowing **I01** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [sessions](sessions.md) · [accounts](accounts.md) · [membership](membership.md) · [policies](policies.md) · [people and groups](people-and-groups.md) · [external-agent-api](../../operate/features/external-agent-api.md) · products: [iam.md](../../../../products/iam.md) IAM-09 |

> **As** someone with a script that loads a dataset every night, **I want** a token I mint once and can
> revoke, **so that** automating against my Graphs is not a password in a cron file.
>
> **As** a person or an iam-admin, **I want** a token narrowed to what one job needs, expiring, shown
> once — for me or for a service account — **so that** software pushes data without a person's login,
> and a leaked key reaches only that.

## What it is, and what it is not

A personal access token **carries identity, exactly as an access token does**. It is not a scope, not a
grant, and not a second permission system: the request resolves to the person who minted it, and
membership is looked up per request like every other request ([IA2](../spec.md#5-cross-feature-decisions)).
Revoking access to a Graph takes the token with it, at once.

| | Personal access token | Access token ([sessions](sessions.md)) | Graph token ([10.4](../../operate/features/external-agent-api.md)) |
|---|---|---|---|
| Owned by | a person | a session | a Graph |
| Lives | months, or until revoked | minutes | until revoked |
| Carries | identity | identity | a scope |
| Reaches | every Graph the person is a member of | the same | one Graph, the listed reads |
| Revoked by | the person, on their profile | signing out | the Graph |
| Built | now, S1 | S1 | S10 |

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Mint a token from the profile | A name, and an expiry chosen from a short list |
| C2 | The secret is shown once | Only its sha256 hash is stored; there is no way to read it back |
| C3 | It acts as the person | Every Graph they are a member of, read and write — the same rights as their session |
| C4 | Membership is resolved per request | Removing someone from a Graph closes their token's way in immediately |
| C5 | Revoke, immediately | One row update; the next request is refused |
| C6 | Expiry is a choice, including never | The offer is `auth_token_expiry_day_choices` (30 · 90 · 365), plus never. Studio renders the picker from it |
| C7 | Last used is visible | So a token nobody uses can be recognised and revoked |
| C8 | A token cannot manage credentials | Minting, revoking, changing a password, deleting the account and provisioning a user all need a session |
| C9 | A ceiling on how many | `auth_max_personal_access_tokens`, default 20 — a named refusal, not a silent failure |
| C10 | The list carries what the deployment allows | `GET …/tokens` returns the rows, the expiry choices and the ceiling, so neither is restated in Studio |
| C11 | IAM › Tokens | Every token that reaches the Graph: token · holder · narrowed to · expires · last used. *New token* is a modal |
| C12 | Narrowed | A token minted in IAM may carry an **inline policy** — statements that can only narrow what its holder may do. A request the inline policy does not allow is refused, naming it |
| C13 | For a service account | An iam-admin mints a token whose holder is a service account of the Graph |
| C14 | Bound to its Graph | A token minted in IAM reaches only that Graph's routes, and install routes its inline policy allows (a dataset's draft push) |

## Journey

```mermaid
flowchart TD
    A[Profile › Access tokens] --> B{Any tokens?}
    B -->|none| C[Empty state: what a token is for]
    B -->|some| D[Name · last four · created · last used · expires]
    C --> E[New token]
    D --> E
    E --> F[Dialog: name it · pick an expiry]
    F --> G{Name free · under the ceiling?}
    G -->|no| H[Refused in place, naming which rule]
    G -->|yes| I[The same dialog turns into the secret, with Copy]
    I --> J[Done — it cannot be shown again]
    J --> D
    D --> K[Revoke]
    K --> L[Confirm by name]
    L --> M[Row leaves the list · next call refused, told it was revoked]
```

A call carrying one:

```mermaid
sequenceDiagram
    participant S as Script
    participant E as Engine
    S->>E: Authorization: Bearer invana_pat_…
    E->>E: prefix says token, not JWT → hash → row
    alt revoked, expired, or unknown
        E-->>S: 401, naming which
    else live
        E->>E: identity = the owner · touch last_used_at
        E->>E: member of this Graph? (per request)
        E-->>S: allowed, or refused
    end
```

## Seams

| Seam | What the user sees |
|---|---|
| The secret dialog is dismissed | It is gone. The list says so, and offers minting another — never a way to reveal it |
| Token used after revocation | `401 Token revoked.` The attempt is recorded as `token.refused` |
| Token past its expiry | `401 Token expired.` The row stays in the list, marked **Expired**, until it is revoked — so the thing that stopped the script is visible, not missing |
| Owner deactivated or deleted | Refused with the account, not separately — `is_active` is checked as it is for a session, and the rows go with the user |
| Removed from a Graph | That Graph's routes refuse; the token still reaches the others |
| A token trying to mint a token | `403` naming the rule — credential management needs a session |
| Password changed | Tokens survive. A password change revokes **sessions** ([AC3](accounts.md#decisions)); a token is not a session, and a script should not break because a person rotated their password |
| Ceiling reached | Refused naming the ceiling and the count; revoke one, or reuse one |
| Token in a URL | Not accepted. The `?token=` SSE fallback takes access tokens only ([PT5](#decisions)) |

## Surfaces

| Surface | Shape |
|---|---|
| Profile › **Access tokens** | A section of `/settings/profile`, reached from its left nav beside Basic info · Appearance · Password · Danger zone ([AC6](accounts.md#decisions)) |
| The list | One row per token: name · `invana_pat_…abcd` · created · last used · expires · Revoke. Revoked rows are gone; expired ones stay, marked |
| At the ceiling | **New token** is disabled and the count says why; nothing is refused only after typing |
| New token | A dialog behind the **New token** button — name and expiry stacked, then the same dialog turns into the secret with Copy and a one-time warning ([PT10](#decisions)) |
| Revoke | Confirms by name, because the row is the only thing the person can still identify it by |
| Empty | `EmptyState` — what a token is for, and the button that mints the first one |
| `iam.tokens` | IAM › Tokens — *A key that acts as its holder when software calls Invana — a script, CI, Claude Code. It can only narrow what its holder may do*; table token · holder · narrowed to · expires · last used; *New token* |
| `iam.tokens.new` | Modal *New token — a key that acts as its holder, narrowed*: Name · Holder · Narrow to (*Never wider than the holder — anything else is refused when saved*) · Expires; then the secret with *Copy* and *Done* |

## Engine

| Narrowing | Shape |
|---|---|
| `personal_access_tokens.graph_id?` · `.policy_id?` · `.created_by_id?` | the Graph an IAM token is bound to · its inline policy · who minted it (a holder's iam-admin) |
| `GET·POST …/iam/tokens` · `DELETE …/iam/tokens/{id}` | `Page[IamTokenRow]` `{id, name, last_four, holder{user_id, username, kind}, graph_bound, narrowed_to, policy?, expires_at?, last_used_at?, created_at, expired}` · `{name, holder_id?, statements?, expires_in_days?}` → row + `secret` once |
| `core/auth/narrowing.py` | `ROUTE_ACTIONS`, `action_for(method, path, params)`, `check(statements, …)` |


| Thing | Shape |
|---|---|
| `personal_access_tokens` | `id` · `user_id` · `name` · `token_hash` (sha256, unique) · `last_four` · `expires_at?` · `last_used_at?` · `revoked_at?` · `created_at` |
| Secret | `invana_pat_` + `secrets.token_urlsafe(32)`. The prefix is what routes the credential and what a secret scanner matches |
| Name | Unique per user, 1–64 characters |
| Expiry | `auth_token_expiry_day_choices` — anything else is refused at validation, before the service sees it |
| Ceiling | `auth_max_personal_access_tokens`; the refusal names the ceiling and the current count |
| Resolution | The `Bearer` value starting `invana_pat_` is hashed and looked up; anything else is decoded as a JWT |
| `last_used_at` | Touched at most once a minute per token, so a busy script is not a write per request |
| Routes | `GET · POST /api/v1/auth/me/tokens` · `DELETE /api/v1/auth/me/tokens/{id}` (revokes) |
| `GET …/tokens` | `{ tokens, expiry_day_choices, max_tokens }` — the rows plus what this deployment allows |
| Session-only routes | `…/me/tokens*` · `POST /auth/me/password` · `DELETE /auth/me` · `POST /auth/register` |
| Events | `token.create` · `token.revoke` · `token.refused` (with the reason; never the secret) |

## Decisions

| # | Decision |
|---|---|
| PT1 | A token carries its holder's identity, and membership is resolved per request. A profile token reaches every Graph its holder is a member of; a token minted in a Graph's IAM reaches that Graph only, narrowed by its inline policy when it has one. |
| PT2 | Only the sha256 hash is stored. The secret is returned once, at creation, and cannot be read back. |
| PT3 | The secret carries the fixed prefix `invana_pat_`, so the engine routes the credential without attempting a JWT decode and a scanner can recognise a leak. |
| PT4 | Credential management needs a session: a request authenticated by a token may not mint or revoke tokens, change a password, delete an account, or provision a user. |
| PT5 | A token is accepted in the `Authorization` header only. The `?token=` SSE fallback stays an access-token path, so a long-lived secret never lands in a URL, a log or a referrer. |
| PT6 | A password change revokes sessions and leaves tokens alone. Revoking a token is its own, explicit action. |
| PT7 | Expiry is chosen at creation, from the offer the deployment configures in `auth_token_expiry_day_choices`, or never. An expired row is refused and stays in the list, marked, until its owner revokes it — so the list still explains what stopped working. |
| PT8 | `last_used_at` is the only usage record on the row; use is not an event. Refusals are, because a refusal is a signal. |
| PT9 | Revocation is a stamp, not a delete. The row leaves the person's list, and a call made with the secret afterwards is told it was revoked rather than that it never existed. |
| PT10 | Creating is a dialog behind **New token**, not a form standing above the list — the section is a list of what you hold. The dialog is one dialog in two states: the form, then the secret it produced, so nobody dismisses a form to be handed the thing they came for. |
| PT11 | **Narrowing is an inline policy.** *Narrow to* takes statements in the policy grammar; the engine stores them as a policy of kind `inline`, named after the token, attached to it, and refuses at mint any statement its holder's own policies do not allow — *never wider than the holder*. Revoking the token deletes its inline policy. |
| PT12 | A narrowed token's request must map to an action: `core/auth/narrowing.py` names the routes a narrowed token can reach — a graph read (`GET` under the Graph) is `graph.read.api` on `graph/*`, a dataset read is `data.read` on `dataset/<publisher>/<name>`, a draft push `POST /api/v1/datasets/{p}/{n}/versions/drafts` is `data.version.draft`, a publish is `data.version.publish`, `GET /auth/me` is always allowed. Any other route, or an action the inline policy does not allow, is `403 token_narrowed` naming the token and its policy. |
| PT13 | The holder's own rights still apply on top: a narrowed token can never do what its holder cannot. |
| PT14 | IAM › Tokens lists every live or expired token bound to the Graph and every profile token of a member; *New token* takes a name, a holder (yourself, or a service account when you hold iam-admin), *Narrow to* and an expiry from the deployment's choices; the same modal turns into the secret. Revoking another holder's token needs iam-admin. |
| PT15 | The IAM secret's prefix is the profile token's, `invana_pat_`: one credential type, routed the same way. |

## Not building

| Not building | Because |
|---|---|
| What it did, per token | use is not an event (PT8); the ledger records the person, and calls over MCP (I02) record the token |
| Showing the secret again | a secret that can be read back is a stored password |
| Rotation, and expiry reminders by email | revoke and mint is the whole of rotation, and the product has no mail path |
| Per-token rate or cost ceilings | a token is its owner; their ceilings already apply. A ceiling of its own is [10.4](../../operate/features/external-agent-api.md)'s |
| An `invana` CLI for minting | the profile mints it, and the caller pastes it into its own configuration |
