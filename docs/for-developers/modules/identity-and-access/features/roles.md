# Roles

A member of a Graph holds one or more **Graph roles**. Every member reads everything in the Graph;
a role is what lets them change a part of it. The install has one role above Graphs, the **install
Admin**.

| | |
|---|---|
| Index | [11.6](../../../README.md#11--identity-and-access) · Slice **B11** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Product | [shell.md › Decisions](../../../../products/shell.md#decisions) — *Roles per Graph* · *Without the role* · P-18 |
| Related | [membership](membership.md) · [search](../../platform/features/search.md) · [guardrails](../../govern/features/guardrails.md) · [rules](../../skills/features/rules.md) · [datasets](../../bring-data-in/features/datasets.md) |

Product spec: [ST-F02 · People and access](../../../../../specs/foundation/settings/features/ST-F02-people-and-access/feature.md) — ST-06; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## What each role may change

Reading is never gated: every `GET` on a Graph is open to every member. A role governs the writes
(`POST · PUT · PATCH · DELETE`) of an **area**.

| Area | Role | Writes it covers (paths under `/api/v1/u/{username}/{graphSlug}`) |
|---|---|---|
| `ask` | viewer | `sessions…` · `explorer…` · `boards…` · `runs/{id}/answer · cancel · rerun · resume` · `connection/ping` · `notifications/read` · `approvals…` |
| `work` | contributor | `projects…` · `tasks…` · `schedules…` |
| `build` | builder | `agents…` · `skills…` · `evals…` · `flows…` · `projection-templates…` · `runs/{id}/emissions/{id}/template` |
| `model` | modeller | `models…` · `model-links…` · `rules…` · `projects/{key}/rules` · `govern…` · `dataset-bindings` · `connection/introspect` |
| `settings` | owner | the Graph itself (`PATCH` · `DELETE`) · `connection…` · `setup…` · `default-agent` · `llm…` · `notifications…` (rules and channels) · `alert-rules…` |
| `iam` | iam-admin | `members…` · `iam…` except `iam/tokens`, which is `ask` |

## Surfaces

| Surface | Shape |
|---|---|
| `GET …/members` | every member with `user_id` · `username` · `first_name` · `last_name` · `roles` · `added_at` |
| `POST …/members` | `{user, roles}` — `user` is an email or a username |
| `PATCH …/members/{member}` | `{roles}` — replaces the set |
| `DELETE …/members/{member}` | removes the membership; their work stays |
| `GET …/access` | `{roles, areas: [{area, role, allowed, holders}]}` |
| `/auth/me` | `graphs[].roles` |
| CLI | `invana members list · add --role · set-roles --role · remove` ([13.3](../../platform/features/command-line.md)) |
| Studio · access | `useAccess()` (shell) reads `GET …/access` once per Graph, key `["access", owner, graph]`; `gateOf` (core) turns an area into allowed · role · holders · reason |
| Studio · a gated act | `ActButton area=…` (shell) — the kit `Button`, or disabled with the reason as tooltip and accessible description; `gateItem(item, gate)` does the same for a panel header action |
| Studio · a read-only surface | `ReadOnlyNotice area noun` (shell) — *You can read this skill. Editing needs the builder role — ask ravi.* (board `agents.skills.detail.readonly`) |
| Studio · Members | Graph settings › **Members** tab (Modeller, board `modeller.settings.members`): member · roles · since, *Edit* roles, *Remove*, *Add member*; a **Roles** key below it |

## Engine

| Thing | Shape |
|---|---|
| `graph_members.roles` | JSON list of role names, never empty; replaces `can_edit_guardrails` |
| `apps/graphs/roles.py` | `GraphRole`, `AREAS`, `area_for(method, path)`, `holds(roles, role)` — pure |
| `GraphMemberManager` | `members` · `add` · `set_roles` · `remove` · `holders` · `access` |
| Guard | `require_graph_member` reads the matched route and method, resolves the area, refuses without its role |
| Refusal | `403 {error: "role_required", area, role, holders, message}` |
| Events | `member.add` · `member.remove` · `member.roles` with `{username, roles}` |
| Migration | `069`: add `roles`; the Graph's creator gets `owner`, every other member `contributor · builder · modeller`; drop `can_edit_guardrails` |

## Decisions

| # | Decision |
|---|---|
| RO1 | A member holds a **set** of Graph roles, stored as a JSON list on `graph_members`. `viewer` is the floor and is stored when no other role is given; the set is never empty. |
| RO2 | `owner` implies `contributor`, `builder` and `modeller`; the other three are peers. Every member reads. |
| RO3 | Reads are never gated by role. A role governs the writes of one **area**, and the area is read off the route: a path prefix after the Graph, with a short list of narrower prefixes that win over a broader one (`projects/{key}/rules` is `model`, not `work`). |
| RO4 | The policy is one table in `apps/graphs/roles.py`, applied by `require_graph_member` from the matched route — no route names its own role. A write route the table does not name needs `owner`, and `tests/graphs/test_roles.py` walks every graph-scoped route and fails on one without the gate or a write the table does not name. |
| RO5 | Asking is a viewer's act: sessions, Explorer expansions, boards, and answering, cancelling, re-running or resuming a run. A run spends tokens, and so does an ask; the bound on spend is the agent's envelope, not a role. |
| RO6 | LLM providers are `settings`: they hold credentials and decide what the Graph spends tokens on. Pinning a model on an agent stays `build`. |
| RO7 | Guardrails are a Modeller's. `can_edit_guardrails` is retired; `may_edit_guardrails` on the lens list is `holds(roles, modeller)`. |
| RO8 | A Graph always has an owner. Removing or demoting the last one is refused (409), naming the rule. |
| RO9 | A refusal is `403` with `role_required`, the area, the role and the usernames that hold it, so Studio and the CLI can say who to ask. |
| RO11 | The CLI holds database credentials and acts as the `--user` it names; role enforcement is the API's. `invana members` refuses what the manager refuses — an unknown role, a person with no account, the last owner. |
| RO12 | Existing members keep what they had: the creator becomes `owner`, everyone else `contributor · builder · modeller`. |
| RO15 | What is gated is the **entry act** of an area — the button that opens an authoring dialog or writes straight away (*New agent*, *Edit instructions*, *Publish*, *New project*, *Save*). A dialog's own submit is not gated again: its entry already was. Area by product follows the engine table: Agents' agents, skills, evals, plans, templates and plugins → `build`; LLM providers → `settings`; Modeller's models, stitches, rules and guardrails → `model`, its Graph settings and Members → `settings`; Projects' projects, findings, decisions, todos → `work`; Activity's schedules → `work`, rules and channels → `settings`. Asking is every member's. Datasets are install-scoped and keep B03's checks; a plugin's enable and disable are install-wide (`/api/v1/plugins…`) and gated by no Graph role. *Save as dataset* on a simulation is gated as `work`, the act that starts it, though the dataset route itself is install-wide. |
| RO17 | Graph settings gains a **Members** tab: one row per member — name, roles as badges, *since* — and for an owner *Edit* (the five roles as a checkbox set; `viewer` always held) and *Remove* (confirmed). *Add member* takes an email or a username and roles. Below it a **Roles** key: role · what it may change. The last owner's refusal (409) and an unknown account (404) show in the dialog, in the engine's words. Without `owner` the tab reads, its acts disabled as ST-06 says. |
| RO20 | `iam-admin` is a peer role: `owner` does not imply it. The Graph's creator holds `owner` and `iam-admin`. A Graph always has an iam-admin — removing or demoting the last one is refused (409), as for the last owner. |
| RO21 | Members moves to the `iam` area: adding, re-roling and removing a member needs iam-admin, from IAM › People or Graph settings › Members. |
| RO18 | Graph settings' connection tab is **Database**, keyed `?tab=database`, so the strip reads Basic · Database · Members as the product names them ([1.12](../../connect-and-model/features/graph-settings.md)). |

## Not building

| Not building | Because |
|---|---|
| Private projects | Per-project access sits on top of these roles — [9.7](../../work/features/private-projects.md) |
| Role-aware agents | agents are principals bounded by an envelope ([MB5](membership.md)) |
| Hiding a product a role cannot read | every role reads every product today |
| *Request access* on a read-only surface | there is no access-request flow (no invitations); the notice names who to ask |
| Agents in the Members table | agents are principals bounded by an envelope, not members holding roles |
