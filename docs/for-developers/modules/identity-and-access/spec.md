# Identity and access — module spec

Who you are, how you stay signed in, which Graphs you can reach and what you may change there.
An account, a username that is also a URL, a session that can be revoked, membership, six Graph
roles — and **IAM**: policies people, groups, agents and tokens hold, what they add up to, and the
product that shows it.

| | |
|---|---|
| Index | [§11 · Identity and access](../../README.md#11--identity-and-access) |
| Features | [accounts](features/accounts.md) · [usernames](features/usernames.md) · [sessions](features/sessions.md) · [membership](features/membership.md) · [tokens](features/tokens.md) · [roles](features/roles.md) · [policies](features/policies.md) · [effective access](features/effective-access.md) · [people and groups](features/people-and-groups.md) · [the IAM product](features/the-iam-product.md) |
| Depends on | — |
| Depended on by | everything: every request resolves to a principal |

Product spec: [ST · Settings](../../../../specs/foundation/settings/product.md) — its features ST-F02 and ST-F03 hold the stories, rules and product decisions of this module; ST-F01 (membership) follows. This file keeps the domain words, the engine shape and the rows not moved.

System design: [identity-and-access.md](../../../../specs/system-design/modules/identity-and-access.md) — membership and roles, what a token carries. This file keeps the vocabulary, what the module owns and the cross-feature decisions.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Account** | a person, identified by email | a seat |
| **Username** | the URL identity — `/u/<username>/<graphSlug>/…` | a display name |
| **Session** | an access token plus a revocable refresh token | a login row |
| **Personal access token** | a long-lived credential a person mints for a script, carrying their identity | a scope, or a second permission system |
| **Member** | someone with access to a Graph | a role |
| **Graph role** | what a member may change: `viewer` · `contributor` · `builder` · `modeller` · `owner` · `iam-admin` — each a managed policy | a run's `role` |
| **Policy** | statements (actions × resources, conditions) and limits a principal holds; managed · custom · inline · boundary | a role, a lens |
| **Principal** | a person, a service account, a group, an agent — what holds a policy; a token acts as its holder | a worker |
| **Service account** | a person with no sign-in that owns tokens for scripts | a bot user with a password |
| **Group** | people and agents in one Graph that hold policies together | a team page |
| **Effective access** | skill needs ∩ its policies ∩ started by ∩ world ∩ boundary | a permission list typed by hand |
| **Install Admin** | `is_superuser` — install rules, standards, datasets, retraction, outside any Graph | a Graph owner |

## 3. What this module owns

| Owns | Shape |
|---|---|
| `users` | `email` (login, case-folded) · `username` · `password_hash` · `first_name` · `last_name?` · `is_superuser` · `is_active` · `username_last_changed_at` |
| `refresh_tokens` | opaque, server-side, revocable, rotated on use |
| `personal_access_tokens` | hashed, server-side, revocable, never rotated — [11.5](features/tokens.md) |
| `graph_members` | `graph_id` · `user_id` · `roles` — the managed policies a member holds directly |
| `policies` · `policy_versions` · `policy_attachments` | [policies](features/policies.md) |
| `groups` · `group_members` | [people and groups](features/people-and-groups.md) |
| Auth routes | `/api/v1/auth/*`; everything else is graph-scoped under `/api/v1/u/{username}/{graphSlug}/…` |
| The superuser flag | what the admin application checks — the application itself is [13.6](../platform/features/admin-and-health.md) |

## 5. Cross-feature decisions

| # | Decision |
|---|---|
| IA2 | Access tokens carry identity and the superuser flag; membership is resolved per request. |
| IA3 | Refresh tokens are opaque, server-side and rotated on use. |
| IA7 | The admin application browses app state for operators. It is not a product surface, and it is never how a member reaches their own Graph. |
| IA8 | Every credential this module issues carries its holder's identity. A long-lived one is a [token](features/tokens.md), revocable on its own; one minted in a Graph's IAM is bound to that Graph and may be narrowed by an inline policy. |
