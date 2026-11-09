# Usernames

The username is an **address**: `/u/<username>/<graphSlug>/…`. It can change, rarely, and old
addresses do not forward.

| | |
|---|---|
| Index | [11.2](../../../README.md#11--identity-and-access) · Slice **S1** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — | ✅ |
| Related | [accounts](accounts.md) · [membership](membership.md) |

Product spec: [ST-F03 · You — account and sessions](../../../../../specs/foundation/settings/features/ST-F03-you-account-and-sessions/feature.md) — ST-15; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| Profile → Username | The field, the rules, the cooldown state, and a warning about old links |
| Every graph-scoped URL | `/u/<username>/<graphSlug>/…` |

## Engine

| Thing | Shape |
|---|---|
| Validation | `^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`, plus no consecutive hyphens |
| Cooldown | `username_last_changed_at` against a configured window |
| Routes | `PATCH /auth/me` — refuses inside the cooldown |
| Events | `user.username_changed` |

## Decisions

| # | Decision |
|---|---|
| UN4 | The username is not carried in a token. |

