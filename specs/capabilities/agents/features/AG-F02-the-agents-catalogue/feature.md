---
id: AG-F02
title: The agents catalogue
product: AG
status: idea
personas: [analyst, builder, admin]
stories: [AG-35]
journeys: [J05, J06]
boards: [agents, agents.agent, settings.people]
nfrs: []
depends_on: [AG-F01, AC-F02, AC-F03, CP-F02]
---

# The agents catalogue

> Every agent the deployment has — the built-in agents and the ones people built — each with its live version, its
> owners and who may use it. A person uses the agents granted to them or to a team they are on; an Admin grants them.
> The decision it helps make: *which agent should take this work, and who should be able to use it?*

## User journey

Journeys this feature is a step of: [J05 · Join a team](../../../../journeys/J05-join-a-team.md) · [J06 · Set what an agent may touch](../../../../journeys/J06-set-what-an-agent-may-touch.md)

```mermaid
flowchart TD
  start([Agents]) --> cat["AG-35 · Every agent — built in or custom, live version, owners, who may use it"]
  cat -->|Granted to me| mine["AG-35 · The agents this person may use, and through which team"]
  cat -->|an agent not granted to them| ng["Reads; Ask it is disabled — Ask an Admin to grant it"]
  cat -->|Admin · Grant| gr(["The Directory — grant it to a person or a team (AC-22 · AC-09)"])
  cat -->|someone else · Grant| gx["Reads Ask an Admin"]
  cat -->|an agent whose skills need a plugin switched off| po["Marked, naming the plugin and who switched it off — its runs are refused"]
  cat -->|Admin · Make default| df{"Can it answer questions?"}
  df -->|no| dfx["Refused, naming why"]
  df -->|yes| dd(["The deployment's default agent"])
  cat -->|a version| ver["AG-35 · How each version did against the one before"]
  cat -->|Map| map["AG-35 · Every agent, its skills and what they reach"]
  start -->|Import · Export · Add a library| port(["Portable agents and skills — AG-F08"])
```

## Stories

| ID | Story | Status |
|---|---|---|
| AG-35 | [See every agent and who may use it](stories/AG-35-see-every-agent-and-who-may-use-it/story.md) | idea |

## Access

The catalogue is *Acts* for every role in [the role table](../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table):
each person uses the agents granted to them; granting is the Directory's ([AC-F03](../../../../os/access/features/AC-F03-directory/feature.md)).

| Act | Role | Everyone else sees |
|---|---|---|
| Read every agent — kind, status, live version, owners, who may use it, its versions and the map | Every signed-in person — Operator, Modeller, Admin | — |
| Use an agent — ask it, give it a task, schedule it | A person it is granted to, or to a team they are on ([AC-F03](../../../../os/access/features/AC-F03-directory/feature.md#rules)) | *Ask*, *Assign* and *Schedule* disabled — *Not granted to you — ask an Admin* |
| Grant an agent to a person or a team, take it away | Admin, in a session, with the password again ([AC-22](../../../../os/access/features/AC-F03-directory/feature.md)) | Who may use it reads; *Grant* reads *Ask an Admin* |
| Make an agent the deployment's default | Admin | *Make default* disabled — *Needs the Admin role* |
| Build or change an agent | As [AG-F01](../AG-F01-build-an-agent/feature.md#access) | As AG-F01 |

## States

| State | What the person sees |
|---|---|
| First use | Agents holds only the built-in agents, each *Built in*, owned by *System*, granted by role; the Assistant marked *Default* |
| Empty after a filter | *No agents match* — the filters (kind · status · owner · granted to me) named, with *Clear filters* |
| Loading | Rows hold their shape |
| Has data | Every agent with its kind, status, live version, owners, who may use it — people and teams — and *Granted to you* or *Not granted to you*; the default marked |
| Failed | A failed read names what could not load; a refused *Make default* names why |
| Agent working or proposing | — |
| No access | Everything reads; an agent not granted to the person cannot be asked, naming *Ask an Admin*; *Grant* and *Make default* read *Ask an Admin* |

## Rules

| Rule | Detail |
|---|---|
| Agent → skills → functions | An agent holds skills, a skill calls functions and workflows, functions are code. A person uses an agent, never a skill on its own |
| Built once for the deployment | Every agent is one definition with one live version; there is no copy per team, person or graph database |
| Granted, never invited | A person may use the agents granted to them and to every team they are on; a grant is an Admin's, read at each step ([AC-F03](../../../../os/access/features/AC-F03-directory/feature.md#rules)) |
| A grant gives use, never access | What an agent may touch is its Access Policies ∩ the rules for the person's teams ([AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#rules)); granting an agent to someone widens nothing it may touch |
| An agent has no role | It acts for the person behind the run through its own Access Policies; it holds no Operator, Modeller or Admin role |
| The built-in agents | One of each, owned by the system user: Assistant · Query console · Modeller · Coordinator · Record editor · Loader ([Engine › Mechanisms](#mechanisms)). Each starts granted to every person whose role holds the feature it acts for. Copied to customise, never edited |
| One live version | A run opens on the agent's live version; a newer published version reaches the next run, and runs in flight finish on theirs |
| One default | The deployment has one default agent, which can answer questions; an ask that names no agent goes to it. Only an Admin changes it |
| Switched off means refused | An agent whose skills need a plugin or graph database that is switched off reads so, naming who switched it off; its runs are refused before they start ([CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#rules)) |
| Retired stays listed | A retired agent reads *Retired*, keeps its row and name, and is offered to nobody |
| Helpers are hidden by default | A helper made inside a run (AG-F05) lists only with *Show helpers* |
| The query language follows the database | The Query console and the Assistant use each graph database's own language — Cypher or Gremlin — through the typed query plan |
| Leans on | Building an agent (AG-F01) · skills (AG-F04) · delegation and outside agents (AG-F05) · portable files (AG-F08) · Access Policies (AC-F02) · the Directory and grants (AC-F03) · plugins and switches (CP-F02) · runs (CP-F10) |

## Data touched

| Record | Read or write |
|---|---|
| Agents, their kind, status, owners and versions | Read |
| Grants — who may use each agent | Read (written in AC-F03) |
| The deployment's default agent | Write · read |
| Runs per version — runs, served, p95, tokens a run | Read |
| Plugins and graph databases switched off | Read |

## Engine

### Records

| Table | Columns | Notes |
|---|---|---|
| `agents_defaults` | `default_agent_id` · `set_by_id?` · `set_at` | One row for the deployment; seeded with the Assistant |

### Reads

| Record | Owner |
|---|---|
| Agents, their versions, `kind` and `status` | [AG-F01](../AG-F01-build-an-agent/feature.md#engine) |
| Skills an agent holds | [AG-F04](../AG-F04-skills/feature.md#engine) |
| Grants and teams | [AC-F03](../../../../os/access/features/AC-F03-directory/feature.md#engine) |
| Owners | [AC-F07](../../../../os/access/features/AC-F07-ownership/feature.md#engine) |
| The built-in agents' Access Policies | [AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#engine) |
| Runs and their numbers per agent version | [CP-F10](../../../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) |
| Plugins, graph databases and their switches | [CP-F02](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#engine) · [CP-F05](../../../../os/control/features/CP-F05-graph-databases/feature.md#engine) |

### Routes

| Route, after `/api/v1/agents` | Does | Story |
|---|---|---|
| `GET /agents/catalogue` | A page by the list contract (`?q=` · `?f.kind=` · `?f.status=` · `?f.owner=` · `?f.granted=me` · `?f.helpers=`) — each agent with `live_version` · `owners[]` · `granted_to{users[], teams[]}` · `granted_to_me` (`direct` · `team:<name>` · `null`) · `switched_off[{kind, name, by}]` · `is_default` | AG-35 |
| `GET /agents/{name}/versions` | Each version — `version` · `published_by` · `published_at` · `why` · `eval_verdict` · `runs` · `served` · `p95_ms` · `tokens_per_run` · `versus_previous` | AG-35 · AG-36 |
| `GET /agents/map` | Every agent, its skills and the functions, workflows and data they reach, as nodes and edges | AG-35 |
| `GET /agents/default` · `PUT /agents/default` | The default agent · make another the default (Admin) | AG-35 |

### Events

| Event | When |
|---|---|
| `agents.set_default` | The deployment's default agent changes |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 422 | Making an agent the default that cannot answer questions, is a draft or is retired | *{agent} cannot answer questions.* · *{agent} is {state}.* | AG-35.6 |
| 403 | Making an agent the default without the Admin role | *This needs the Admin role.* | AG-35.13 |
| — | Asking, assigning or scheduling an agent not granted to the person | [AC-F02 › Refusals](../../../../os/access/features/AC-F02-access-policies/feature.md#refusals) | AG-35.3 |
| — | A run needing a switched-off plugin or graph database | [CP-F02 › Refusals](../../../../os/control/features/CP-F02-plugins-and-outside-tools/feature.md#refusals) | AG-35.4 |

### CLI

| Command | Does |
|---|---|
| `invana agents list [--granted-to-me]` | The catalogue, or the agents the caller may use |
| `invana agents default <name>` | Make an agent the default (Admin) |

### Mechanisms

| Mechanism | How |
|---|---|
| The built-in agents | One instance each, `kind = builtin`, owned by the system user, their Access Policies [AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#engine)'s: `assistant` · **Assistant** — answers questions in plain words and shows its work; the default · `query-console` · **Query console** — runs the query typed, in read mode, asks before a write, every query recorded · `modeller` · **Modeller** — turns a described change into staged edits on the model's draft · `coordinator` · **Coordinator** — plans, workflows and handing work to helpers; the one built-in agent that may make helpers · `record-editor` · **Record editor** — edits on the board, fixes and merges · `loader` · **Loader** — loads datasets. `SEEDED_AGENTS` holds exactly these six |
| Seeded at migrate | The built-in agents, their policies, their starting grants ([AC-F03 › Mechanisms](../../../../os/access/features/AC-F03-directory/feature.md#mechanisms)) and `agents_defaults` are written at migrate, idempotently |
| Versioned with the engine | A built-in agent's definition ships with the release; a release brings its new version, which reaches the next run |
| `granted_to_me` | Read from the caller's grants and team places at request time, the same reads the step check makes; `direct` wins over a team |
| `switched_off` | For each skill the agent holds, its plugins and the graph databases its needs name, against the install switch and the caller's own switch, naming who switched each off |
| Version numbers | Per agent version from CP-F10's stored counts; `versus_previous` is computed when a version's first run settles and on each settle after, never in Studio |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | `agents_defaults` in Postgres | — |
| § 8 APIs and events | The routes, events and CLI above, under `/api/v1/agents` | — |
| § 10 AI and agents | An agent is built once for the deployment with one live version; who may use it is a grant, what it may touch its Access Policies | — |

## Decisions

| Decision | Detail |
|---|---|
| Agents is the catalogue | One list of every agent, each row its name, what it does, kind, live version, owners, who may use it and *Granted to you* or *Not granted to you*; the row opens the agent's sheet (AG-F01) |
| Who may use it is shown, changed in the Directory | The row and the sheet read the people and teams it is granted to; an Admin's *Grant* opens the Directory on that agent |
| A person sees why they may use it | *Granted to you* names *directly* or the team that gives it |
| The default is marked | *Default* sits on one row; an Admin's *Make default* is on every row that can answer questions |
| A version reads against the one before | An agent's Versions list each version's runs, served, p95 and tokens a run against the version before, as the engine stores them |
| The map | Agents can be read as a map — each agent, its skills and the functions, workflows and data they reach |
| Switched off is drawn, not hidden | An agent that needs a switched-off plugin or graph database stays listed, marked, naming it and who switched it off |

## Open questions

| Question | Who answers |
|---|---|

## Not building

| Item | Why not |
|---|---|
| A copy of an agent per team or per person | One definition, one live version; teams differ by grants and team-scoped rules |
| A version pinned per team or person | A version reaches every run that opens after it publishes |
| Granting an agent from its sheet | Grants are the Directory's, one place to read who may use what |
| A role for an agent | It would let an agent do whatever that role may |
| Removing a built-in agent | What the product needs stays; an Admin takes its grants away instead |
| A router agent that classifies each ask, a fixed roster of specialists and a named skill catalogue for them | An ask goes to the agent the person picks, or the default; skills reach a step only through the agent that holds them |
| A built-in data assistant | Bringing records in is a load (RC-F02), run by the Loader as a plan |
| Built-in agents named *<Product> assistant* | A built-in agent is named for what it does |
