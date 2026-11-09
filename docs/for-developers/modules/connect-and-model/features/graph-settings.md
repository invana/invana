# Graph settings

The Graph's own configuration: what it is called and what it is for, the database it reads, who is on
it — people and agents — and what it spends against the limits the platform sets.

| | |
|---|---|
| Index | [1.12](../../../README.md#1--connect-and-model) · General and Connection built in **M07**; the product, agent members and Usage in two-places **T04** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | 🟡 / — / 🟡 |
| Related | [connect-a-database](connect-a-database.md) · [roles](../../identity-and-access/features/roles.md) · [the agents catalogue](../../agents/features/install-wide-agents-and-skills.md) |

Product spec: [GR-F04 · This graph](../../../../../specs/os/graph/features/GR-F04-this-graph/feature.md) — GR-13 · GR-14 · GR-15; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine shape and the rows not moved.

## Surfaces

| Surface | Detail |
|---|---|
| Product | Graph settings, in the launcher's *This Graph* group, with the Graph picker; its own rail — General · Connection │ Members · Usage |
| Routes | `/u/:user/:graph/settings/general\|connection\|members\|usage`; the agent in this Graph `/u/:user/:graph/settings/members/agents/:agent[/runs\|access]` as a workbook tab |
| Boards | `graph.settings.general` · `.connection` · `.members` · `.members.invite` · `.members.update` · `.usage` · `graph.settings.agent` · `.agent.runs` · `.agent.access` |

## Engine

| Route | Shape |
|---|---|
| `GET …/` · `PATCH …/` | `GraphRead` · `GraphUpdate {name, description, instructions, status}` |
| `GET …/connection` | `GraphConnectionRead` — gains `auth_username` (the stored user; the password is never returned) |
| `PUT …/connection` | `GraphConnectionCreate` — `auth` with a blank password keeps the stored password |
| `POST …/connection/test` | the same body; a blank password tests with the stored one |
| `POST …/connection/introspect` | the physical mirror |
| `GET/POST/PATCH/DELETE …/members` | [roles](../../identity-and-access/features/roles.md) RO17 |
| `GET · POST …/agents` · `PATCH · DELETE …/agents/{agent}` | The Graph's agents as members: invite, access, pause, remove ([5.16](../../agents/features/install-wide-agents-and-skills.md#engine)) |
| `POST …/agents/{agent}/update` | Move to the latest published version |
| `GET …/limits` · `GET …/usage` | The limits Settings set; tokens, lanes and pools used, spend by member — stored per run |

## Decisions

| # | Decision |
|---|---|
| GS1 | **Graph settings is a product of the Graph**, in the launcher's *This Graph* group, with its own rail — General · Connection │ Members · Usage — and the Graph picker in the header. A section is a page; an agent's page opens as a Workbook tab beside it. |
| GS3 | **The head is the shared `SectionFrame`**: `Graph settings`, its rail icon, and one line — `<Graph name> — what it is called, the database it reads, and who may change it.` |
| GS4 | **General and Connection are a centred column** (`max-w-4xl`); Members uses the full width, Members and Roles side by side from `lg`. |
| GS10 | `?panel=info` and *Graph info* land on Graph settings › General. |
