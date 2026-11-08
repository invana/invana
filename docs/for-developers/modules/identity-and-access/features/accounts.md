# Accounts

Sign up, sign in, and the profile behind them. Email is the login identity; everything else about a
person is small on purpose.

| | |
|---|---|
| Index | [11.1](../../../README.md#11--identity-and-access) · Slice **S1** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [usernames](usernames.md) · [sessions](sessions.md) · [membership](membership.md) |

Product spec: [ST-F03 · You — account and sessions](../../../../../specs/foundation/settings/features/ST-F03-you-account-and-sessions/feature.md) — ST-15; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| Sign up · sign in | Two fields plus name; no marketing steps in between |
| Profile | `/profile` — a left nav of sections (Basic info · Appearance · Password · Access tokens · Danger zone) with the section's content beside it. Name and password live here; username and email are their own actions |
| Admin | Platform administration, gated by the superuser flag |

## Engine

| Thing | Shape |
|---|---|
| `users` | `email` · `username` · `password_hash` · `first_name` · `last_name?` · `is_superuser` · `is_active` · `username_last_changed_at` |
| Hashing | bcrypt, cost from configuration; verification is constant-time |
| Routes | `POST /auth/register` · `POST /auth/login` · `GET PATCH /auth/me` |
| Events | `user.registered · updated · password_changed` |

## Decisions

| # | Decision |
|---|---|
| AC6 | The profile's sections are a **left nav**, not a tab strip, and the page is as wide as a reading column allows rather than the width of one form. Five labels do not fit a tab bar, and [Access tokens](tokens.md) is a table that needs the width the strip was taking. |

