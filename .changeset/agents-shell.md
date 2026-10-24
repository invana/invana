---
"invana": minor
---

**Agents is a rail and a workbook, with no left column.** Every section is a page that opens as a
tab of the workbook; Home is the workbook with nothing open — the assistant's composer and one tile
per section.

| Section | Path | What it holds |
|---|---|---|
| Home | `/agents/home` | The composer and the section tiles; `/agents` lands here |
| Fleet | `/agents/fleet[/map · /table]` | Overview, the agents → skills → functions map, and every agent's numbers |
| Performance | `/agents/performance[/skills · /plans · /llms]` | The fleet's numbers by agent, skill, plan and LLM |
| Agents · Skills | `/agents/agents` · `/agents/skills` | One table each; a row opens its record as a tab |
| Functions | `/agents/functions[/plans · /promoted · /templates · /plugins]` | The catalogue by namespace, packaged and promoted plans, templates, plugins |
| Connections | `/agents/connections/mcp` | MCP servers, and *Add MCP server* |
| LLMs | `/agents/llms[/:endpoint]` | Endpoints and model versions; an endpoint and *Add endpoint* are modals |
| Settings | `/agents/settings` | The Graph's run ceiling and pools |

`+` on the strip opens ⌘K, and ⌘J opens or closes the assistant. The old `?panel=` links for the Agents overview, library and plugins
are gone, and so is the plan canvas board kind: a plan opens as its page.

A plan's Overview leads with *The plan* — origin, owner, what it matches and which agents may run it.
`GET …/projection-templates` is a list-contract page (`q` · `kind` · `surface` → `{items, total, …}`),
and `GET …/projection-templates/{id}` reads one template. A packaged plan's description follows its
package on every seed.
