---
id: PJ-20
title: Give a project its kinds of task
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.projects, projects.tasks]
---

# PJ-20 · Give a project its kinds of task

**As** a person on a project **I want** the project to offer the kinds of task its work needs — each asking for its own
fields and bringing its own checks **so that** every task starts with what that kind of work needs and nobody writes
the same fields by hand each time.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* follows the [permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue);
which kinds a project uses is a setting, its team's ([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Turn any of the type's task kinds on or off on any project; write a task of any kind the project uses | — |
| Operator | Turn kinds on or off on a project they lead; write a task of any kind the project uses | On a project they do not lead, the kind switches read, disabled — *Join the team to change it* |

## Flow

```mermaid
flowchart TD
  s([A project › Details › Task kinds]) --> k["The type's kinds: each with its fields and default checks · Task and Recommendation always on"]
  k -->|not a person on the team| na["Switches disabled: Join the team to change it"]
  k --> on["Turn a kind on"]
  k --> off["Turn a kind off"]
  off -->|a task uses it| ref["Refused, naming how many tasks use it"]
  off -->|none uses it| saved["Saved · History records it"]
  on --> saved
  saved --> nt["New task (PJ-12): pick the kind first"]
  nt --> f["Its fields and default checks follow"]
  f -->|a field the kind does not declare · a kind the project does not use| fr["Refused, naming the field or kind"]
  f -->|valid| c(["Created · its kind a badge on the task"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-20.1 | A project | its Details › *Task kinds* opens | it lists every kind its type declares — each with its fields and default checks — and which the project uses; *Task* and *Recommendation* are always on and cannot be turned off |
| PJ-20.2 | A person on the team | they turn a kind on or off | it is saved, *New task* offers only the kinds on, and History records who and which kind |
| PJ-20.3 | *New task* on a project | it opens | the kind is asked first; picking it brings that kind's fields and its default checks (PJ-25) |
| PJ-20.4 | A task of a kind the project does not use, or a field its kind does not declare | it is saved | it is refused, naming the kind or the field and why; nothing is saved |
| PJ-20.5 | A kind used by any task | a person on the team turns it off | it is refused, naming how many tasks use it; nothing changes |
| PJ-20.6 | A task of a kind | it is listed or opened | its kind reads as a badge beside its title, in the type's words; shared places — My tasks, Needs you, search — show the same badge |
| PJ-20.7 | An Operator not on the team | they open *Task kinds* | the kinds read; the switches are disabled — *Join the team to change it*; a call is refused the same way |
| PJ-20.8 | A type installed by a Team pack | a project of it is created | its kinds are offered as the built-in ones are; no kind is written in Studio |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Task kinds | Admin | projects.projects · Detail · Task kinds · Only the two | — | projects.projects · Detail · Task kinds · Loading | projects.projects · Detail · Task kinds | projects.projects · Detail · Task kinds · Kind in use | — | — |
| Task kinds | Operator | projects.projects · Detail · Task kinds · Only the two | — | projects.projects · Detail · Task kinds · Loading | projects.projects · Detail · Task kinds | projects.projects · Detail · Task kinds · Kind in use | — | projects.projects · Detail · Task kinds · Not a person on the team |
| New task by kind | Admin | projects.tasks · New · Pick a kind | — | — | projects.tasks · New · Kind fields | projects.tasks · New · Field refused | — | — |
| New task by kind | Operator | projects.tasks · New · Pick a kind | — | — | projects.tasks · New · Kind fields | projects.tasks · New · Field refused | — | projects.tasks · Detail · Withheld |
