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

Product spec: [ST-F02 · People and access](../../../../../specs/foundation/settings/features/ST-F02-people-and-access/feature.md) — ST-09; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

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

## Surfaces

| Surface | Shape |
|---|---|
| Profile › **Access tokens** | A section of `/profile`, reached from its left nav beside Basic info · Appearance · Password · Danger zone ([AC6](accounts.md#decisions)) |
| The list | One row per token: name · `invana_pat_…abcd` · created · last used · expires · Revoke. Revoked rows are gone; expired ones stay, marked |
| At the ceiling | **New token** is disabled and the count says why; nothing is refused only after typing |
| New token | A dialog behind the **New token** button — name and expiry stacked, then the same dialog turns into the secret with Copy and a one-time warning (ST-09.2) |
| Revoke | Confirms by name, because the row is the only thing the person can still identify it by |
| Empty | `EmptyState` — what a token is for, and the button that mints the first one |
| `iam.tokens` | IAM › Tokens — *A key that acts as its holder when software calls Invana — a script, CI, Claude Code. It can only narrow what its holder may do*; table token · holder · narrowed to · expires · last used; *New token* |
| `iam.tokens.new` | Modal *New token — a key that acts as its holder, narrowed*: Name · Holder · Narrow to (*Never wider than the holder — anything else is refused when saved*) · Expires; then the secret with *Copy* and *Done* |

## Engine

| Narrowing | Shape |
|---|---|
| `personal_access_tokens.graph_id?` · `.policy_id?` · `.created_by_id?` | the Graph an IAM token is bound to · its inline policy · who minted it (a holder's iam-admin) |
| `GET·POST …/iam/tokens` · `DELETE …/iam/tokens/{id}` | `IamTokenPage` — `Page[IamTokenRow]` `{id, name, last_four, holder{user_id, username, kind}, graph_bound, narrowed_to, policy?, expires_at?, last_used_at?, created_at, created_by?, expired}` plus the deployment's `expiry_day_choices` and `max_tokens` · `{name, holder_id?, statements?, expires_in_days?}` → row + `secret` once |
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
| PT3 | The secret carries the fixed prefix `invana_pat_`, so the engine routes the credential without attempting a JWT decode and a scanner can recognise a leak. |
| PT11 | **Narrowing is an inline policy.** *Narrow to* takes statements in the policy grammar; the engine stores them as a policy of kind `inline`, named after the token, attached to it, and refuses at mint any statement its holder's own policies do not allow — *never wider than the holder*. Revoking the token deletes its inline policy. |
| PT12 | A narrowed token's request must map to an action: `core/auth/narrowing.py` names the routes a narrowed token can reach — a graph read (`GET` under the Graph) is `graph.read.api` on `graph/*`, a dataset read is `data.read` on `dataset/<publisher>/<name>`, a draft push `POST /api/v1/datasets/{p}/{n}/versions/drafts` is `data.version.draft`, a publish is `data.version.publish`, `GET /auth/me` is always allowed, and `POST …/mcp` reaches [this Graph's MCP server](../../platform/features/this-graphs-mcp-server.md), which checks each tool call against the inline policy (MS8). Any other route, or an action the inline policy does not allow, is `403 token_narrowed` naming the token and its policy. |
| PT15 | The IAM secret's prefix is the profile token's, `invana_pat_`: one credential type, routed the same way. |

## Not building

| Not building | Because |
|---|---|
| Rotation, and expiry reminders by email | revoke and mint is the whole of rotation, and the product has no mail path |
| Per-token rate or cost ceilings | a token is its owner; their ceilings already apply. A ceiling of its own is [10.4](../../operate/features/external-agent-api.md)'s |
| An `invana` CLI for minting | the profile mints it, and the caller pastes it into its own configuration |
