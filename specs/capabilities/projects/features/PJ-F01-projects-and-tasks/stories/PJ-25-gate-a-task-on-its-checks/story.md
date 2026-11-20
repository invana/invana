---
id: PJ-25
title: Gate a task on its checks
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.tasks, inbox]
---

# PJ-25 · Gate a task on its checks

**As** a person on a project **I want** a task's result checked by workflows that run on their own before it reaches
me **so that** I never accept work on an agent's word that it is done, and I read only results that passed what a
machine can prove.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* follows the [permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue);
checks are added by anyone who may write the task; a result is accepted by the project's people
([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Add or take off a task's checks before a result is posted; read every check's result; send back a task whose checks failed on a project they review | Not a person on the team: *Send back* disabled — *Join the team to change it* |
| Operator | The same, on every task they may read | Not a person on the team: *Send back* disabled — *Join the team to change it*. A check's run they may not read: that it ran, its outcome and its tokens — *Content withheld* |

## Flow

```mermaid
flowchart TD
  s([A task › Checks]) --> d["Its kind's and type's default checks · checks a person added — each names a workflow"]
  d --> add["Add a check: name · workflow"]
  add -->|no such workflow| nw["Refused, naming it"]
  res([A result is posted — by an agent's run or a person]) --> ck["Checking · each check runs in a run of its own"]
  ck --> all{"Every check?"}
  all -->|passed| rv["In review (PJ-12)"]
  all -->|one failed| cf["Checks failed · each failing check named, with its run · Accept off"]
  cf --> rvw{"A person on the team"}
  rvw -->|Send back, the failed checks in the note| back["Assigned · a new result runs every check again"]
  rvw -->|Cancel| cn(["Cancelled"])
  cf -->|not a person on the team| nr["Send back disabled: Join the team to change it"]
  ck -->|the agent says its work is green| ignored["Never read as a check's result"]
```

```mermaid
sequenceDiagram
  participant A as Agent's run
  participant E as Engine
  participant C as Check run
  actor R as Reviewer
  A->>E: posts a result
  E->>C: one evaluator run per check, through the project assistant
  C-->>E: passed · failed, with its steps
  alt every check passed
    E-->>R: In review · Needs you
    R->>E: Accept · Send back
  else a check failed
    E-->>R: Checks failed · Needs you
    R->>E: Send back · Cancel
  end
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-25.1 | A task of a kind, on a project of a type | it is created | its kind's and its type's default checks are on it, each naming its workflow |
| PJ-25.2 | A task before a result is posted | a person adds a check naming a workflow, or takes one off | it is saved and History records who |
| PJ-25.3 | A result posted on a task with checks | the engine takes it | the task reads *Checking*, naming each check; each runs its workflow in an evaluator run of its own, through the project assistant — never in the run that did the work |
| PJ-25.4 | Every check of the latest result | each passed | the task reads *In review* and the project's people are told in Needs you (PJ-12) |
| PJ-25.5 | A check of the latest result | it failed | the task reads *Checks failed*, naming each failing check and opening its run; it is listed in the project's people' Needs you |
| PJ-25.6 | A task whose checks have not all passed | a person on the team tries *Accept* | *Accept* is off — *{n} checks have not passed — {check}*; a call is refused the same way |
| PJ-25.7 | A task with checks failed | a person on the team sends it back | it reads *Assigned* with the failed checks in the note; the next result runs every check again — a failed check is never re-run on its own |
| PJ-25.8 | An agent's result | it says its own tests or checks are green | that claim is shown as part of the result and never counts as a check's result; only a check's run writes one |
| PJ-25.9 | A check naming a workflow that does not exist | it is saved | it is refused — *There is no workflow {key}*; nothing is saved |
| PJ-25.10 | A check's run | a person who may read it opens *How it got here* | it shows the workflow's steps and sources; anyone else reads that it ran, its outcome and its tokens |
| PJ-25.11 | A project with no assistant | a result's checks run | they run through the built-in Assistant, named as such on each check |
| PJ-25.12 | A task with checks failed and a person not on the team | they open it | the failures read; *Send back* is disabled — *Join the team to change it* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A task's checks | Admin | projects.tasks · Detail · Checks · None | — | projects.tasks · Detail · Checks · Loading | projects.tasks · Detail · Checks | projects.tasks · Detail · Checks · Workflow refused | projects.tasks · Detail · Checking | — |
| A task's checks | Operator | projects.tasks · Detail · Checks · None | — | projects.tasks · Detail · Checks · Loading | projects.tasks · Detail · Checks | projects.tasks · Detail · Checks · Workflow refused | projects.tasks · Detail · Checking | projects.tasks · Detail · Withheld |
| Checks failed | Admin | — | — | — | projects.tasks · Detail · Checks failed | projects.tasks · Detail · Checks failed · Accept off | — | projects.tasks · Detail · Checks failed · Not a person on the team |
| Checks failed | Operator | — | — | — | projects.tasks · Detail · Checks failed | projects.tasks · Detail · Checks failed · Accept off | — | projects.tasks · Detail · Checks failed · Not a person on the team |
| A check's run | Admin | — | — | projects.tasks · Detail · How it got here · Loading | projects.tasks · Detail · How it got here · Check | projects.tasks · Detail · How it got here · Check failed | projects.tasks · Detail · How it got here · Check running | — |
| A check's run | Operator | — | — | projects.tasks · Detail · How it got here · Loading | projects.tasks · Detail · How it got here · Check | projects.tasks · Detail · How it got here · Check failed | projects.tasks · Detail · How it got here · Check running | projects.tasks · Detail · How it got here · Content withheld |
| Checks failed in Needs you | Admin | — | — | inbox · Loading | inbox · Checks failed | inbox · Could not load | — | — |
| Checks failed in Needs you | Operator | — | — | inbox · Loading | inbox · Checks failed | inbox · Could not load | — | — |
