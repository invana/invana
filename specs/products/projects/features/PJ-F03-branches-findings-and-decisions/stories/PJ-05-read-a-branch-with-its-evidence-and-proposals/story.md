---
id: PJ-05
title: Read a branch with its evidence and proposals
feature: PJ-F03
status: idea
personas: [decision-maker, analyst]
boards: [projects.options]
---

# PJ-05 · Read a branch with its evidence and proposals

**As** a decision maker **I want** a branch with its hypothesis, verdict, the evidence for and against, what agents
proposed and the tasks filed on it **so that** work and evidence sit together, counter-evidence included, and I decide
what an agent proposed.

Tasks: [task.md](task.md) · Feature: [PJ-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every branch; file a task on it; accept or reject a proposal; open a finding, a decision | — |
| Operator | Read the branch, its findings, decisions and proposals | *File a task*, *Accept* and *Reject* disabled, naming *Can work on projects*. *With Can work on projects: as Admin* |

## Flow

```mermaid
flowchart LR
  s([A project › a branch]) --> load["Loading — the header is drawn, the lists fill in"]
  load -->|fails| f["Could not load · the reason · Try again"] --> load
  load --> b["Branch: title · status · balance · its verdict and current decision · findings for, against and context · decisions · proposals · tasks"]
  b -->|no findings yet| n["No findings yet · Add a finding (PJ-06)"]
  b --> fd["A finding → PJ-06"]
  b --> dc["Decide → PJ-07 · Fork → PJ-04 · Merge → PJ-08"]
  b --> tk["File a task on this branch"]
  b -->|Operator| na["Task, Accept and Reject disabled, naming Can work on projects"]
  agent([An agent]) -->|proposes a fork or a decision, with a rationale| p["Proposals: what · why · by which agent · How it got here"]
  p -->|Accept — fork| fk["Children made (PJ-04)"]
  p -->|Accept — decision| dd["The decision is recorded as the accepting person, rules checked (PJ-07)"]
  dd -->|a rule blocks| rb["Refused, naming the rule · the proposal stays open"]
  p -->|Reject| rj["Rejected · kept, with who and when"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-05.1 | A branch | a member opens it | it shows its number and title, status, balance (*3 supports · 1 contradicts*), the current verdict and decision if any, and the project's tasks filed on it |
| PJ-05.2 | A branch with findings | it opens | findings are grouped as supports, contradicts and context, each with its statement, who added it and whether a person reviewed it |
| PJ-05.3 | A branch with no findings | it opens | it reads *No findings yet* with *Add a finding* |
| PJ-05.4 | A branch decided more than once | it opens | its decisions list newest first, the current one marked and each superseded one saying which decision replaced it |
| PJ-05.5 | A person who can work on projects | they file a task from the branch | the task is created on this branch and the branch lists it |
| PJ-05.6 | An agent | it proposes a fork or a decision with a rationale | the branch lists the proposal as waiting — what it proposes, the rationale, which agent, and the person who sent it — and nothing else changes |
| PJ-05.7 | A waiting proposal | the person opens *How it got here* | it shows the agent's steps and sources behind the rationale |
| PJ-05.8 | A waiting fork proposal | a person who can work on projects accepts it | the children are made (PJ-04) and the proposal reads accepted, by whom |
| PJ-05.9 | A waiting decision proposal | a person who can work on projects accepts it | the decision is recorded in that person's name, with every rule in force checked (PJ-07); the proposal reads accepted |
| PJ-05.10 | A decision proposal a rule blocks | it is accepted | the refusal names the rule and the evidence, nothing is recorded, and the proposal stays open |
| PJ-05.11 | A waiting proposal | a person rejects it | it reads rejected, by whom and when, and stays listed |
| PJ-05.12 | A proposal already accepted or rejected | someone acts on it again | it is refused, saying it is already resolved |
| PJ-05.13 | Any agent | it tries to record a verdict or a decision | it cannot: verdicts and decisions are a person's, and an agent can only propose |
| PJ-05.14 | An Operator without *Can work on projects* | they open a branch | it reads in full; *File a task*, *Accept* and *Reject* are disabled, naming *Can work on projects* |
| PJ-05.15 | The engine cannot return the branch | the page loads | it says *Could not load* with the reason and *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A branch | Admin | projects.options · A branch · No findings yet | — | projects.options · A branch · Loading | projects.options · A branch | projects.options · A branch · Could not load | projects.options · A branch · Proposal waiting | projects.project · Private |
| A branch | Operator | projects.options · A branch · No findings yet · Read only | — | projects.options · A branch · Loading | projects.options · A branch · Read only | projects.options · A branch · Could not load | projects.options · A branch · Proposal waiting · Read only | projects.project · Private |
| A proposal | Admin | — | — | — | projects.options · A branch · Proposal waiting | projects.options · A branch · Proposal refused | projects.options · A branch · Proposal waiting | — |
| A proposal | Operator | — | — | — | projects.options · A branch · Proposal waiting · Read only | — | projects.options · A branch · Proposal waiting · Read only | projects.options · A branch · Read only |
