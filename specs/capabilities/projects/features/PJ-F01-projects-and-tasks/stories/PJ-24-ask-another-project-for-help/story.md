---
id: PJ-24
title: Ask another project for help
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.projects, projects.tasks, inbox]
---

# PJ-24 · Ask another project for help

**As** someone working a task **I want** to ask another project for the part of it that is theirs — and have their
assistant and people on the team decide whether to take it on **so that** work crosses projects without anyone writing tasks
into a project that is not theirs, and the answer comes back to my task. *The agent proposes → the person decides.*

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table);
a person asks when they may read both projects; the other project's people on the team accept
([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Ask any project they may read for help from a task they may read; accept or reject an ask on a project whose team they are on | A project they may not read is not offered as a target |
| Operator | The same; a Modeller the same | Not a person on the asked project: the ask reads there, *Accept* and *Reject* disabled — *Join the team to change it* |

## Flow

```mermaid
flowchart TD
  s([A task › Ask another project]) --> m["Ask help (modal): the project · what is needed · what done means"]
  m -->|a project they may not read| na["Not offered"]
  m --> sent["Sent · a proposal of kind Ask in the other project · its sources' lineage with it"]
  run([A run in the project needs another project]) --> sent
  sent --> tri["The other project's assistant triages: take it as a task, or decline with why"]
  tri --> nb["Needs you of the other project's people on the team"]
  nb --> d{"A person on the team decides"}
  d -->|Accept| t["A task in the other project · the projects become Related"]
  d -->|Reject, with a note| rj(["The asking task reads declined, with the note"])
  d -->|not a person on the team| nm["Disabled: Join the team to change it"]
  t --> list["The asking task lists it under Asked of other projects, with its state"]
  t -->|reviewed and done| back(["Its result posted to the asking task's thread · as far as each reader's agent may read"])
```

```mermaid
sequenceDiagram
  actor P as Person on project A
  participant E as Engine
  participant PB as B's assistant
  actor M as Person on B's team
  P->>E: asks B for help from a task of A
  E->>E: a proposal of kind Ask in B, with its sources' lineage
  E->>PB: opens a run to triage it
  PB-->>E: proposes a task, or declining with why
  E-->>M: Needs you: an ask from A
  M->>E: Accept · Reject
  E-->>P: the asking task lists B's task, or reads declined
  E-->>P: B's result, once accepted there
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-24.1 | A task on a project | a person presses *Ask another project* | a modal asks for the project, what is needed and what done means; it offers only projects they may read |
| PJ-24.2 | An ask sent | the engine saves it | it is a proposal of kind *Ask* in the other project, naming the asking task and project, with its sources' lineage; nothing is written into the other project's tasks |
| PJ-24.3 | A run in a project that needs another project | it asks through `projects.asks.create` | the ask is made the same way, naming the run and its task |
| PJ-24.4 | An ask arriving | the other project's assistant triages it | it proposes taking it as a task — kind, fields and checks — or declining it with a reason, and the ask waits in the project's people' Needs you |
| PJ-24.5 | An ask | a person on the asked project accepts it | a task is made there, the two projects list *Related*, and the asking task lists it under *Asked of other projects* with its state |
| PJ-24.6 | An ask | a person on the team rejects it with a note | the asking task reads that it was declined, by whom and why |
| PJ-24.7 | The task an ask made | a person on the team accepts it | its result is posted to the asking task's thread; each reader reads it as far as they may read its sources |
| PJ-24.8 | A person who may not read both projects | they ask | it is refused — *Withheld — join the team or ask {who can grant}*; nothing is sent |
| PJ-24.9 | An ask and a person who is not a person on the asked project | they open it | it reads as far as they may read; *Accept* and *Reject* are disabled — *Join the team to change it* |
| PJ-24.10 | An ask or its triage | a person who may read the run opens *How it got here* | it shows the asking run or the triage run's steps and sources; anyone else reads that it ran, its status and its tokens |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Ask another project | Admin | projects.projects · Ask for help | projects.projects · Ask for help · No project matches | projects.projects · Ask for help · Loading projects | projects.projects · Ask for help · Filled | projects.projects · Ask for help · Refused | — | — |
| Ask another project | Operator | projects.projects · Ask for help | projects.projects · Ask for help · No project matches | projects.projects · Ask for help · Loading projects | projects.projects · Ask for help · Filled | projects.projects · Ask for help · Refused | — | projects.projects · Ask for help · Refused |
| An ask in the asked project | Admin | — | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Ask from a project | — | projects.projects · Assistant · Ask · Triaging | projects.projects · Assistant · Ask · Not a person on the team |
| An ask in the asked project | Operator | — | — | projects.projects · Assistant · Loading | projects.projects · Assistant · Ask from a project | — | projects.projects · Assistant · Ask · Triaging | projects.projects · Assistant · Ask · Not a person on the team |
| Asked of other projects | Admin | — | — | projects.tasks · Detail · Loading | projects.tasks · Detail · Asked of other projects | projects.tasks · Detail · Ask declined | projects.tasks · Detail · Asked · Waiting | — |
| Asked of other projects | Operator | — | — | projects.tasks · Detail · Loading | projects.tasks · Detail · Asked of other projects | projects.tasks · Detail · Ask declined | projects.tasks · Detail · Asked · Waiting | projects.tasks · Detail · Asked · Withheld |
| An ask in Needs you | Admin | — | — | inbox · Loading | inbox · An ask from a project | inbox · Could not load | — | — |
| An ask in Needs you | Operator | — | — | inbox · Loading | inbox · An ask from a project | inbox · Could not load | — | — |
