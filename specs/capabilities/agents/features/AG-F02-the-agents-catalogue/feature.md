---
id: AG-F02
title: The agents catalogue — invite
product: AG
status: idea
personas: [admin, owner, builder]
stories: [AG-35]
journeys: []
boards: [agents, agents.agent, settings.people]
depends_on: [AG-F01]
---

# The agents catalogue — invite

> Every agent and skill the install owns, built once and versioned; a graph invites the agents it needs the way it
> invites people, at a pinned version, and takes an update only when its owner chooses. Agents and skills come in and
> go out as standard files in AG-F08. The decision it helps make: *which agent should this graph have, at which
> version?*

## User journey

```mermaid
flowchart TD
  start([Agents]) --> cat["AG-35 · Every agent the install owns — its own assistants and ones built here, the graphs that run each"]
  cat --> inv{Invite one into this graph?}
  inv -->|cannot manage people| ix["Disabled — Ask Priya (owner)"]
  inv -->|a function it needs comes from a plugin not enabled| px["Offered disabled, naming the plugin"]
  inv -->|Invite| mem["AG-35 · A member of the graph beside its people, at the published version"]
  mem --> acc["Access rules, Pause, Remove — the graph's own assistants are never removed"]
  mem -->|a newer version is published| up{"Update available — take it?"}
  up -->|Take update| next(["The next run uses it; runs in flight finish on the old one"])
  up -->|Not now| stay([Stays on its version])
  start -->|Import · Export · Add a library| port(["Portable agents and skills — AG-F08"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-35 | [See every agent the install owns and invite one into a graph](stories/AG-35-see-every-agent-the-install-owns-and-invite-one-into-a-graph/story.md) | idea |

## Access

| Act | Role (`.claude/team/TEAM.md` §7) | Everyone else sees |
|---|---|---|
| Read every agent and skill in the install, its versions and the graphs that run each | Operator — every member of the install | — |
| Invite an agent into a graph · give it access rules · pause it there · remove it · take an update | `iam-admin` · shown as *Can manage people* · Owner · Admin | The graph's agents and what they did read; *Invite agent*, *Pause*, *Remove* and *Take update* disabled — *Ask Priya (owner)* |
| Build or change an agent or skill in the catalogue | As AG-F01 and AG-F04 | As AG-F01 and AG-F04 |

## States

| State | What the person sees |
|---|---|
| First use | Agents holds only the assistants Invana ships, each marked *Included in every graph* |
| Empty after a filter | *No agents match* — the filters named, with *Clear filters* |
| Loading | Rows hold their shape |
| Has data | Every agent with its version, kind (shipped · built here) and the graphs that run each; a graph's members with each agent's version and *Update available* where one is |
| Failed | A failed read names what could not load; a refused update or remove names why |
| Agent working or proposing | — |
| No access | The catalogue reads; invite, update, pause and remove are disabled with *Ask Priya (owner)* |

## Rules

| Rule | Detail |
|---|---|
| Agent → skills → functions | An agent carries skills, a skill calls functions, functions are code. Only an agent is added to a graph; a skill reaches a graph only inside an agent |
| Built once, invited everywhere | Agents and skills are built and versioned in the install's catalogue; a graph invites an agent as a member and gives it access — never its definition, budget or instructions |
| A graph never edits an agent | It invites, gives access rules, pauses and removes; the graph's own instructions and rules reach every agent in it |
| Pinned, with updates offered | A graph runs the version it invited; a newer published version is offered, and its owner moves to it in one act. Runs in flight finish on the version they opened with |
| The graph's own assistants | The assistants Invana ships are added to every new graph and stay: they may be paused there, never removed |
| The query skill follows the database | The assistants use the query skill of the language the graph's database speaks — Cypher, Gremlin or both |
| An agent has no graph role | Its reach is the access rules the graph gives it, and it always acts as the person who started the run ∩ the agent |
| Retired in the catalogue | Graphs that invited it keep their version; it is not offered to any other |
| One plan everywhere | A skill version's plan reads only the function vocabulary, so it is the same in every graph |
| Leans on | Building an agent (AG-F01) · skills (AG-F04) · portable files (AG-F08) · access rules (AC-F02) · plugins (RT-F02) · AI models (RT-F01) · a graph's members (GR-F04) |

## Data touched

| Record | Read or write |
|---|---|
| Agents and skills of the install, and their versions | Read |
| An agent invited into a graph — its version, status, who invited it | Write · read |
| The access rules it holds in that graph | Write (AC-F03) · read |

## Decisions

| Decision | Detail |
|---|---|
| A graph's agents are its members | Invited in Settings › This graph › Members beside people, and in *Create a graph*'s people step; an agent's row opens its version, access, runs and tokens in this graph, with *Edit in Agents* |
| The catalogue shows where each agent runs | Each agent's row names the graphs that run it and at which version |
| An update is a chip | *Update available* on the agent's member row, and a line on its sheet saying what changed |
| A plugin not enabled | An agent whose functions need it is offered disabled, naming the plugin; an Admin enables it |
| Not built yet | Inviting agents into a graph and updates have no engine yet |

## Open questions

| Question | Who answers |
|---|---|
| Who builds and publishes catalogue agents — an Admin only, or *Can build agents* in any graph? (AG-F01 states the engine's rule meanwhile) | Ravi |

## Not building

| Item | Why not |
|---|---|
| Creating or editing an agent or skill inside a graph | One place to build keeps the install simple; a graph shapes its agents through access rules, its instructions and its rules |
| Adding a skill to a graph | A skill only works inside an agent |
| Budgets or runs at once set per agent by a graph | Cost and capacity are set once, per graph, by an Admin (RT-F04) |
| Automatic updates in graphs | An update can change answers; the owner moves |
| Removing one of the graph's own assistants | Its product stops working without it; pause it instead |
| A graph role for an agent | It would let an agent do whatever that role may |
| A shipped assistant for an experimental product | *Create a graph* promises nothing experimental |
