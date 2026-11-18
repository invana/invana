---
id: PJ-21
title: Ideate with the project assistant
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.projects, inbox]
---

# PJ-21 · Ideate with the project assistant

**As** a person on a project **I want** to talk the work through with the project's assistant and have it turn what we
said — and the recommendations others raise — into tasks, groups and checks I can accept **so that** shaping the work
is a conversation, not a form, and nothing lands on the project without a person's yes. *The agent proposes → the
person decides.*

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue);
the thread reads through the person's default agent, and a proposal is accepted by the project's people
([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Talk with the assistant of any project they may read; raise a recommendation; accept or reject a proposal on a project whose team they are on | Not a person on the team: *Accept* and *Reject* disabled — *Join the team to change it* |
| Operator | The same; a Modeller the same | Not a person on the team: *Accept* and *Reject* disabled — *Join the team to change it*. A project they may not read: the thread reads *Withheld* |

## Flow

```mermaid
flowchart TD
  s([A project › its assistant]) --> any{"Assistant named?"}
  any -->|no| none["No assistant yet · Name one (PJ-22)"]
  any -->|yes| th["The thread · opens on What is this project for?"]
  th --> say["A person on the team says what the work is and what done means"]
  say --> run["The assistant runs inside the project · the project's policies ∩ its ceiling · the speaker recorded · its steps stream"]
  run -->|its policies refuse a read| rf["Says what it could not read, naming the rule"]
  run --> prop["Proposals: tasks with kinds and checks · groups · relations"]
  rec([A recommendation raised — by a person, a run or another feature]) --> tri["The assistant triages it"]
  tri --> prop2["Proposes a task of kind Recommendation, or declining, with why"]
  prop --> nb["Needs you of the project's people"]
  prop2 --> nb
  nb --> d{"A person on the team decides"}
  d -->|Accept| made(["Made · created by proposal · How it got here opens the run"])
  d -->|Reject, with a note| rj(["Rejected · kept with who and why"])
  d -->|not a person on the team| nm["Accept and Reject disabled: Join the team to change it"]
```

```mermaid
sequenceDiagram
  actor M as Person on the team
  participant E as Engine
  participant PA as Project assistant
  M->>E: says something in the project's thread
  E->>PA: opens a run inside the project (the project's policies ∩ its ceiling), the speaker recorded, with the project's purpose, fields, open tasks and proposals
  PA-->>E: replies · proposes tasks, groups, checks, relations
  E-->>M: the reply, and proposals in Needs you
  M->>E: Accept · Reject
  E-->>M: what was made, linked to the run that proposed it
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-21.1 | A project with no assistant named | its assistant region opens | it reads *No assistant yet*, with *Name one* for its people (PJ-22) |
| PJ-21.2 | A project with an assistant, no thread yet | its assistant region opens | the thread opens on *What is this project for?* with the project's purpose above it |
| PJ-21.3 | A person on the team says something in the thread | it is sent | a run of the assistant opens inside the project — it reaches the project's policies ∩ the assistant's ceiling, the speaker recorded on it, their own policies not read — with the project's purpose, fields, open tasks and open proposals as its context; its steps stream to those who may read the run |
| PJ-21.4 | The assistant's run | it replies | its reply is in the thread, and any task, group, check or relation it proposes is a proposal listed under the reply and in the project's people' Needs you — nothing is made yet |
| PJ-21.5 | A proposal | a person on the team accepts it | what it proposes is made — a task of its kind with its fields and checks, a group, a check, a relation — reads *created by proposal*, and the proposal reads accepted, by whom |
| PJ-21.6 | A proposal | a person on the team rejects it with a note | it reads rejected, by whom and why, and stays in the thread |
| PJ-21.7 | A recommendation raised for the project — by a person, a run or another feature | it arrives | it is a proposal of kind *Recommendation* in the thread; the assistant triages it, proposing a task of kind *Recommendation* or declining it with a reason, and a person on the team decides |
| PJ-21.8 | A proposal or a reply | a person who may read its run opens *How it got here* | it shows the assistant's steps and sources; anyone else reads that it ran, its status and its tokens |
| PJ-21.9 | A proposal and a person not on the team | they open it | it reads; *Accept* and *Reject* are disabled — *Join the team to change it*; a call is refused the same way |
| PJ-21.10 | The assistant's run | a read its Access Policies refuse | the reply says what it could not read, naming the rule; the project grants it nothing beyond its policies |
| PJ-21.11 | The assistant | it proposes | it never accepts its own proposal; no screen or call offers an agent acceptance |
| PJ-21.12 | A recommendation or a proposal citing another project's copy | it is read | it shows as far as the reader may read its sources ([GP-F02](../../../../../../os/graph/features/GP-F02-memory/feature.md#rules)), else that copy is absent, with no note |
| PJ-21.13 | The thread failing to load, or the run failing | it happens | the thread says why, with *Try again*; a message already sent stays |
| PJ-21.14 | The project assistant, the Lead agent | it would accept a proposal, approve its own plan or write a task on the project | the engine refuses it — *Only a person on the team decides — {agent} may propose it.* — and it lands as a proposal in the project's people' Needs you |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The assistant's thread | Admin | projects.projects · Assistant · What is this project for? | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Thread | projects.projects · Assistant · Could not load | projects.projects · Assistant · Thinking | projects.projects · Assistant · No assistant yet |
| The assistant's thread | Operator | projects.projects · Assistant · What is this project for? | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Thread | projects.projects · Assistant · Could not load | projects.projects · Assistant · Thinking | projects.projects · Assistant · Withheld |
| Proposals | Admin | projects.projects · Assistant · No proposals | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Proposals | projects.projects · Assistant · Proposal refused | projects.projects · Assistant · Proposals waiting | projects.projects · Assistant · Proposals · Not a person on the team |
| Proposals | Operator | projects.projects · Assistant · No proposals | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Proposals | projects.projects · Assistant · Proposal refused | projects.projects · Assistant · Proposals waiting | projects.projects · Assistant · Proposals · Not a person on the team |
| A recommendation | Admin | — | — | — | projects.projects · Assistant · Recommendation | — | projects.projects · Assistant · Recommendation · Triaging | — |
| A recommendation | Operator | — | — | — | projects.projects · Assistant · Recommendation | — | projects.projects · Assistant · Recommendation · Triaging | projects.projects · Assistant · Recommendation · Withheld |
| A proposal in Needs you | Admin | — | — | inbox · Loading | inbox · A proposal | inbox · Could not load | — | — |
| A proposal in Needs you | Operator | — | — | inbox · Loading | inbox · A proposal | inbox · Could not load | — | — |
