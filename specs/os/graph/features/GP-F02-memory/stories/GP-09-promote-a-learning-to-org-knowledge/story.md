---
id: GP-09
title: Promote a learning to org knowledge
feature: GP-F02
status: idea
personas: [builder, modeller]
boards: [graph.memory.org_knowledge]
---

# GP-09 · Promote a learning to org knowledge

**As** an agent builder **I want** to read what agents propose as knowledge for the whole deployment — each with the
learning and sources it came from — and promote, decline or later retire it **so that** what one agent learned helps
every agent allowed to read it, and only a person decides what the organisation knows. *The agent proposes → the
person decides.*

Tasks: [task.md](task.md) · Feature: [GP-F02](../../feature.md)

## Who can

The role × feature table is [AC-F02 › The role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table);
promoting, declining and retiring org knowledge is a Modeller's and an Admin's ([GP-F02 › Access](../../feature.md#access)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every proposal and every piece of org knowledge their default agent may Read; promote, decline and retire | A proposal whose sources their default agent may not Read: its head only, withheld |
| Operator | Read proposals and org knowledge as far as their default agent may Read `memory/org` and the sources; a Modeller may promote, decline and retire, as an Admin | *Promote*, *Decline* and *Retire* disabled — *Modellers and Admins only* |

## Flow

```mermaid
flowchart TD
  ag([An agent's run · a learning on the agent]) --> p["Proposes it as org knowledge: a statement · the learning · its sources"]
  p --> l["Memory › Org knowledge · Proposed"]
  s([Memory › Org knowledge]) --> any{"Anything?"}
  any -->|none| e["No org knowledge yet · agents propose it as they learn"]
  any -->|yes| l
  l --> d{"A Modeller or an Admin"}
  d -->|Promote| pr["Promoted · read by every agent allowed memory/org · History records who"]
  d -->|Decline, with a note| dc(["Declined · kept with why"])
  d -->|an Operator| no["Promote and Decline disabled: Modellers and Admins only"]
  pr -->|Retire, with a note| rt(["Retired · not recalled · kept"])
  l -->|sources the reader's agent may not Read| wh["Head only · Withheld"]
```

```mermaid
sequenceDiagram
  participant A as Agent's run
  participant E as Engine
  actor M as Modeller or Admin
  participant R as Another agent's run
  A->>E: memory.org.propose — statement, the learning, its sources
  E->>E: written as Proposed, with its lineage
  M->>E: Promote · Decline
  R->>E: recall
  E-->>R: promoted org knowledge — only when its policies allow Read memory/org and every source
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| GP-09.1 | No org knowledge and no proposal | Memory › Org knowledge opens | it reads *No org knowledge yet* and says agents propose it as they learn |
| GP-09.2 | An agent's run with a learning on its agent | it proposes it as org knowledge | it is listed as *Proposed* — the statement, the agent, the run, the learning it came from and who gave that learning — with its sources recorded; nothing is promoted |
| GP-09.3 | A proposal | a Modeller or an Admin presses *Promote* | it reads *Promoted*, by whom and when, History records it, and from the next run every agent whose Access Policies allow Read on `memory/org` and on its sources may recall it ([AG-F09](../../../../../../capabilities/agents/features/AG-F09-learn-from-memory/feature.md)) |
| GP-09.4 | A proposal | a Modeller or an Admin declines it with a note | it reads *Declined*, by whom and why, and is never recalled |
| GP-09.5 | Promoted org knowledge | a Modeller or an Admin retires it with a note | it reads *Retired*, is not recalled by any run that starts after, and stays listed with who retired it and why |
| GP-09.6 | An Operator | they open a proposal | it reads; *Promote*, *Decline* and *Retire* are disabled — *Modellers and Admins only*; a call is refused the same way |
| GP-09.7 | A proposal or org knowledge whose sources the reader's default agent may not Read | it is listed | its head reads — when, which agent, its state — and its statement reads *Withheld — your agent may not read {resource}* |
| GP-09.8 | A proposal | a person who may read its run opens *How it got here* | it shows the run's steps and the learning behind it; anyone else reads that it ran, its status and its tokens |
| GP-09.9 | An agent | it tries to promote, decline or retire | it cannot: only a person decides org knowledge; no function offers an agent the act |
| GP-09.10 | A team | anything is proposed | there is no team memory: org knowledge is the deployment's, and agent learnings stay on their agent |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Org knowledge | Admin | graph.memory.org_knowledge · None yet | graph.memory.org_knowledge · Nothing matches | graph.memory.org_knowledge · Loading | graph.memory.org_knowledge | graph.memory.org_knowledge · Could not load | graph.memory.org_knowledge · Proposed | graph.memory.org_knowledge · Withheld |
| Org knowledge | Operator | graph.memory.org_knowledge · None yet | graph.memory.org_knowledge · Nothing matches | graph.memory.org_knowledge · Loading | graph.memory.org_knowledge | graph.memory.org_knowledge · Could not load | graph.memory.org_knowledge · Proposed | graph.memory.org_knowledge · Not a Modeller |
| A proposal | Admin | — | — | graph.memory.org_knowledge · Proposal loading | graph.memory.org_knowledge · Proposal | graph.memory.org_knowledge · Could not promote | graph.memory.org_knowledge · Proposal | graph.memory.org_knowledge · Proposal withheld |
| A proposal | Operator | — | — | graph.memory.org_knowledge · Proposal loading | graph.memory.org_knowledge · Proposal | graph.memory.org_knowledge · Could not promote | graph.memory.org_knowledge · Proposal | graph.memory.org_knowledge · Not a Modeller |
| Retired | Admin | — | — | — | graph.memory.org_knowledge · Retired | — | — | — |
| Retired | Operator | — | — | — | graph.memory.org_knowledge · Retired | — | — | — |
