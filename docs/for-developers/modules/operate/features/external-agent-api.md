# External-agent API

Something outside Invana — an orchestrator, a bot, someone else's agent — reading from the Graph with
a narrowed token, and getting provenance with every answer.

| | |
|---|---|
| Index | [10.4](../../../README.md#10--operate) · Slice **S10** |
| Module | [Operate](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [audit-and-activity](audit-and-activity.md) · [inspect-what-landed](../../bring-data-in/features/inspect-what-landed.md) |

Product spec: [ST-F04 · Plugins and outside tools](../../../../../specs/products/settings/features/ST-F04-plugins-and-outside-tools/feature.md) — ST-27; the story, its criteria, journey, states and product rules live there. This file keeps the engine shape and the rows not moved.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C6 | Import status is readable | What an orchestrator polls after a load |
| C7 | Revocable | Immediately, with what it last did visible |
| C8 | Rate and cost bounded | A token carries its own ceiling |

## Seams

| Seam | What the user sees |
|---|---|
| A scope that matches nothing | Refused at creation, not at first call |
| Ceiling reached | Refused with the ceiling named; the token stays valid |
| Leaked token | Revoke, and the activity shows everything it read |

## Surfaces

| Surface | Shape |
|---|---|
| Tokens | One list per Graph; `+` in the header; the secret shown once |
| Token detail | Scope, ceiling, last used, and its activity |
| Activity | External calls alongside every other actor |

## Engine

| Thing | Shape |
|---|---|
| `api_tokens` | `graph_id` · name · hashed secret · scope · ceiling · `last_used_at` · revoked |
| Scope | explicit read capabilities; anything unlisted is refused |
| Responses | records plus provenance, always |
| Routes | `…/tokens*` · the scoped read endpoints |
| Events | `token.created · used · refused · revoked` |

## Decisions

| # | Decision |
|---|---|
| EA5 | A token carries its own ceiling. |
| EA6 | **Tokens are a group inside Settings › Graph, not a settings tab of their own.** The tabs are `Basic · Graph · Agents` ([GV18](../../govern/spec.md)) and a token is Graph configuration in the same sense the connection is — a group in the form, the way the connection already is. A fourth tab would make a credential list look like a fourth subject. Drawn as `Tokens` on [The Undrawn Features](https://claude.ai/artifact/26QSEwgdJh6xiHr3xJJ4Wn). |
| EA7 | **The secret is shown once, in place, and never stored readable.** The row afterwards carries what the token *did* — last used, and what it read — because that is what answers *was this leaked*, and a re-readable secret is one the record cannot prove was yours. |

## Not building

| Not building | Because |
|---|---|
