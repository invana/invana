# Roles

A member of a Graph holds one or more **Graph roles**. Every member reads everything in the Graph;
a role is what lets them change a part of it. The install has one role above Graphs, the **install
Admin**.

| | |
|---|---|
| Index | [11.6](../../../README.md#11--identity-and-access) · Slice **B11** |
| Module | [Identity and access](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / 🔵 |
| Product | [shell.md › Decisions](../../../../products/shell.md#decisions) — *Roles per Graph* · *Without the role* · P-18 |
| Related | [membership](membership.md) · [search](../../platform/features/search.md) · [guardrails](../../govern/features/guardrails.md) · [rules](../../skills/features/rules.md) · [datasets](../../bring-data-in/features/datasets.md) |

> **As** the owner of a Graph, **I want** to give each person the part of the Graph they work on,
> **so that** an analyst can ask and read without being one click from republishing the model.
>
> **As** a member without a role, **I want** a refused act to say which role it needs and who holds
> it, **so that** I know who to ask instead of hitting a dead end.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| R1 | Five Graph roles | `viewer` · `contributor` · `builder` · `modeller` · `owner` |
| R2 | Several at once | A member holds a set; `owner` implies the other four; every member reads |
| R3 | Enforced on every graph-scoped route | One policy table, applied by the one membership dependency |
| R4 | A refusal names the role and who holds it | 403 `role_required` with `role`, `area` and `holders` |
| R5 | Studio can draw acts disabled before trying | `GET …/access` returns my roles and every area's role, holders and whether I may |
| R6 | My roles ride on `/auth/me` | Each Graph in `graphs[]` carries `roles` |
| R7 | Install Admin | `users.is_superuser`: install rules, standards, any dataset, retraction. Never a way into a Graph |

## What each role may change

Reading is never gated: every `GET` on a Graph is open to every member. A role governs the writes
(`POST · PUT · PATCH · DELETE`) of an **area**.

| Area | Role | Writes it covers (paths under `/api/v1/u/{username}/{graphSlug}`) |
|---|---|---|
| `ask` | viewer | `sessions…` · `explorer…` · `boards…` · `runs/{id}/answer · cancel · rerun · resume` · `connection/ping` |
| `work` | contributor | `projects…` · `tasks…` |
| `build` | builder | `agents…` · `skills…` · `evals…` · `task-plans…` · `projection-templates…` · `runs/{id}/emissions/{id}/template` |
| `model` | modeller | `models…` · `model-links…` · `rules…` · `projects/{key}/rules` · `govern…` · `dataset-bindings` · `connection/introspect` |
| `settings` | owner | the Graph itself (`PATCH` · `DELETE`) · `connection…` · `setup…` · `default-agent` · `llm…` · `members…` |

## Journey

```mermaid
flowchart TD
    A[Member opens a Graph] --> B[Studio reads …/access]
    B --> C{Holds the area's role?}
    C -->|yes| D[Act enabled]
    C -->|no| E[Act disabled · reason · who can]
    D --> F[Write]
    F --> G{Engine re-checks the role}
    G -->|held| H[Done]
    G -->|lost since| I[403 role_required · names the role and holders]
    I --> E
    J[Owner · Members] --> K[Add by email or username, with roles]
    J --> L[Change roles]
    J --> M[Remove]
    L --> N{Last owner?}
    M --> N
    N -->|yes| O[Refused · a Graph always has an owner]
    N -->|no| P[Takes effect on the next request]
```

## Seams

| Seam | What the user sees |
|---|---|
| Role removed mid-session | The next write is refused with the role it needed and who holds it |
| Demoting or removing the last owner | Refused, naming the rule — a Graph always has an owner |
| Adding someone without an account | Refused — there is no invitation flow |
| Adding with no roles | They are a viewer; `viewer` is stored, never an empty set |
| A guardrail edit | Needs `modeller`; reading the guardrails stays open to every member |
| An install Admin who is not a member | Reaches no Graph route — superuser is not membership |
| A write route the table does not name | Needs `owner`, and the route test fails until the table names it |

## Surfaces

| Surface | Shape |
|---|---|
| `GET …/members` | every member with `username` · `first_name` · `last_name` · `roles` · `added_at` |
| `POST …/members` | `{user, roles}` — `user` is an email or a username |
| `PATCH …/members/{member}` | `{roles}` — replaces the set |
| `DELETE …/members/{member}` | removes the membership; their work stays |
| `GET …/access` | `{roles, areas: [{area, role, allowed, holders}]}` |
| `/auth/me` | `graphs[].roles` |
| CLI | `invana members list · add --role · set-roles --role · remove` ([13.3](../../platform/features/command-line.md)) |
| Studio | C07 — SH-20 read-only views, MO-14 members and roles. Not built here |

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
| RO10 | The install Admin is `users.is_superuser`, which already gates install rules, standards, every dataset and retraction. It grants no Graph role and no Graph access. |
| RO11 | The CLI holds database credentials and acts as the `--user` it names; role enforcement is the API's. `invana members` refuses what the manager refuses — an unknown role, a person with no account, the last owner. |
| RO12 | Existing members keep what they had: the creator becomes `owner`, everyone else `contributor · builder · modeller`. |

## Not building

| Not building | Because |
|---|---|
| Per-record permissions | an area is the unit; a finer grain is unproven |
| Private projects | Per-project access sits on top of these roles — [9.7](../../work/features/private-projects.md) |
| Custom roles | five named roles are the product's words |
| Role-aware agents | agents are principals bounded by an envelope ([MB5](membership.md)) |
| Hiding a product a role cannot read | every role reads every product today |
| Invitations | as in [membership](membership.md) |
| Studio surfaces | C07 builds them |
