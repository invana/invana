---
id: PJ-23
title: Relate a project to another or start one from it
feature: PJ-F01
status: idea
personas: [decision-maker, builder]
boards: [projects.projects]
---

# PJ-23 · Relate a project to another or start one from it

**As** a person on a project **I want** to say which projects it is related to, start a new project from one of its
tasks or findings, and see which projects it waits on **so that** work that grows out of other work keeps its thread,
and its agents reach the context of the projects it belongs with — and only those.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table);
relating is a setting, its team's, on projects the person may read
([PJ-F01 › Access](../../feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Relate any project to another they may read; start a project from a task or finding; remove a relation | A project they may not read is not offered |
| Operator | The same, on a project whose team they are on; start a project from any task or finding they may read; a Modeller the same | On a project whose team they are not on, *Relate* and *Remove* are disabled — *Join the team to change it* |

## Flow

```mermaid
flowchart TD
  s([A project › Related]) --> l["Started from · Waits on · Related — both ways"]
  l -->|none| e["No related projects yet · Relate"]
  l -->|not a person on the team| na["Relate, Remove disabled: Join the team to change it"]
  l --> r["Relate to a project they may read"]
  r -->|itself, or already related that way| ref["Refused, naming why"]
  r --> ok["Related · both projects show it · History records it"]
  t([A task or finding]) --> sf["Start a project from it (PJ-02)"]
  sf --> nw["New project · started from that project, citing the task or finding"]
  g([A group waits on another project's group · PJ-18]) --> w["Waits on · written and removed with the wait"]
  ok --> scope(["A run in either project reaches the other's project memory, within its policies"])
  l -->|a project the reader may not read| wh["Its head · the rest Withheld"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-23.1 | A project | its *Related* tab opens | it lists the projects it started from, waits on and is related to, and those that started from, wait on or are related to it — each with its head and the relation |
| PJ-23.2 | A project with no relations | *Related* opens | it reads *No related projects yet*, with *Relate* for its people |
| PJ-23.3 | A person on the team | they relate the project to another they may read | both projects list *Related*, and History records who |
| PJ-23.4 | A task or a finding | a person presses *Start a project from this* | *New project* opens with *Started from* set to its project and citing the task or finding; once created, both projects list the relation |
| PJ-23.5 | A group that waits on another project's group (PJ-18) | it is saved | both projects list *Waits on*; removing the last such wait removes the relation |
| PJ-23.6 | A project related to itself, or to one already related that way | it is saved | it is refused — *{project} is already {relation}*; nothing is saved |
| PJ-23.7 | A run of a task on a project | it reads project memory | it reaches its own project, the projects related to it by any relation, and its task — nothing else, whatever its policies allow beyond ([AC-F04](../../../../../../os/access/features/AC-F04-what-an-agent-may-touch/feature.md#rules)) |
| PJ-23.8 | An Operator or a Modeller not on the team | they open *Related* | it reads; *Relate* and *Remove* are disabled — *Join the team to change it*; a call is refused the same way |
| PJ-23.9 | A related project the reader may not read | *Related* lists it | its head reads; its content reads *Withheld — join the team or ask {who can grant}* |
| PJ-23.10 | A relation | a person on the team removes it | both projects stop listing it, a run started after it reaches only the projects still related, and History records it; *Waits on* is removed only with its group waits |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Related | Admin | projects.projects · Detail · Related · None yet | — | projects.projects · Detail · Related · Loading | projects.projects · Detail · Related | projects.projects · Detail · Related · Refused | — | — |
| Related | Operator | projects.projects · Detail · Related · None yet | — | projects.projects · Detail · Related · Loading | projects.projects · Detail · Related | projects.projects · Detail · Related · Refused | — | projects.projects · Detail · Related · Not a person on the team |
| A related project withheld | Admin | — | — | — | projects.projects · Detail · Related · Withheld | — | — | projects.projects · Detail · Related · Withheld |
| A related project withheld | Operator | — | — | — | projects.projects · Detail · Related · Withheld | — | — | projects.projects · Detail · Related · Withheld |
| Start a project from this | Admin | projects.projects · New · Started from | — | projects.projects · New · Loading people | projects.projects · New · Started from · Filled | projects.projects · New · Refused | — | — |
| Start a project from this | Operator | projects.projects · New · Started from | — | projects.projects · New · Loading people | projects.projects · New · Started from · Filled | projects.projects · New · Refused | — | — |
