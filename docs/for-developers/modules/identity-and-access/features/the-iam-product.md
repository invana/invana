# The IAM product

IAM is a product of its own in the launcher, on the Agents shell: a rail, a workbook of pages and the
assistant on the right. Access spans every product and belongs to none.

| | |
|---|---|
| Index | [11.10](../../../README.md#11--identity-and-access) · Slice **I01** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [policies](policies.md) · [effective access](effective-access.md) · [people and groups](people-and-groups.md) · [tokens](tokens.md) · the Agents shell · products: iam.md · shell.md |

Product spec: [AC-F02 · People and access](../../../../../specs/os/access/features/AC-F02-access-rules/feature.md) — AC-03 · AC-07; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Shape |
|---|---|
| Routes | `/u/:username/:graphSlug/iam/{home · people · groups · agents · policies · tokens · settings}`; a detail is `?page=policy:<name>` · `iam_agent:<id>` · `iam_group:<name>` |
| `iam.home` | `AssistantStart` with heading *Who may do what in <Graph>?*, placeholder *Ask who can reach something, or draft a policy…*, suggestions *Which agents can write to the graph?* · *Who can push data?* · *What can <person> do?* · *What was refused today?*; tiles People · Groups · Agents · Policies · Tokens with the overview's lines |
| `GET …/iam/overview` | `{people, service_accounts, groups, agents, policies: {managed, custom, inline, boundary}, tokens_live, tokens_expiring_week}` |
| Package | `@invana-studio/iam` — `product.tsx`, `sections/spec.ts`, one folder per section; the app's host renders it on the Agents host |

## Decisions

| # | Decision |
|---|---|
| IP1 | IAM is the sixth product in the launcher, after Agents. It uses the Agents shell — rail, workbook, no leftSection, the assistant on the right. |
| IP2 | The rail is Home · People, Groups, Agents · Policies, Tokens, with Settings at its foot opening the Graph's settings. |
| IP3 | Home's tiles print the engine's overview lines: *N people · N service accounts*, *N groups*, *N agents — built in Agents*, *N managed · N custom · N boundary*, *N live · N expires this week*. |
| IP4 | A detail opens as a tab of its own: a policy, an IAM agent page, a group. A row selects and *Open* or a click on the name opens it, as Agents' lists do. |
| IP6 | The composer on IAM pages carries `IAM · <page>` chips; asking goes to the shared assistant. |

