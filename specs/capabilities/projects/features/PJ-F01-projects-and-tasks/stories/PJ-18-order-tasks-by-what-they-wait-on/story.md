---
id: PJ-18
title: Order tasks by what they wait on
feature: PJ-F01
status: idea
personas: [decision-maker, analyst]
boards: [projects.project, projects.task]
---

# PJ-18 · Order tasks by what they wait on

**As** someone planning a project's work **I want** to say that one task waits on another's success, its failure or
either outcome, gather tasks into groups that wait on other groups — in this project or another — and see the order
that follows **so that** a task that only matters when something breaks has a way to say so, work across projects
lands in the right order, and nobody keeps an order by hand.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

*Projects and tasks* is *Acts* for every role in the [role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table),
on every project the person's default agent may Read ([PJ-F01 › Access](../../feature.md#access)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Draw and remove a dependency, choose its condition; make a group, put tasks in it, make it wait on another group; read the order, the groups, the waves and the critical path | On an archived project, *Draw a dependency* and *Remove* disabled, saying it is archived |
| Operator | The same, on every project their default agent may Read; a group may wait on a group of another project only when their default agent may Read both; a Modeller the same | On an archived project, *Draw a dependency*, *New group* and *Remove* disabled, saying it is archived. A project their default agent may not Read is not offered as a group's wait |

## Flow

```mermaid
flowchart TD
  s([A project › Order]) --> any{"Any tasks?"}
  any -->|none| e["No tasks to order yet · New task (PJ-12)"]
  any -->|some| pl["Tasks as cards in waves · the critical path marked"]
  pl --> dr["Drag one card to another: choose when it runs"]
  dr -->|project archived| na["Disabled, saying it is archived"]
  dr --> c{"Condition"}
  c -->|on success| os["Runs only when the first is Done"]
  c -->|on failure| of["Runs only when the first Failed · drawn dashed · off the critical path"]
  c -->|any outcome| oa["Runs when the first ends either way"]
  os --> chk
  of --> chk
  oa --> sib{"Same parent?"}
  sib -->|no| rsib["Refused, naming both tasks · nothing saved"]
  sib -->|yes| chk{"Makes a loop?"}
  chk -->|yes| ref["Refused, naming the loop · nothing saved"]
  chk -->|no| ok["Saved · waves, waits and the critical path recomputed"]
  ok --> st{"The first task ends"}
  st -->|condition met| go["The dependent task is free to run"]
  st -->|on success, but it failed| bl["The dependent reads why it will not run"]
  st -->|on failure, but it succeeded| nt["The dependent reads never triggered, not blocked"]
  pl --> grp["New group · put tasks in it"]
  grp --> gw["Waits on a group — this project or another"]
  gw -->|makes a loop| gref["Refused, naming the groups · nothing saved"]
  gw -->|another project| rel["Saved · the projects read Waits on (PJ-23)"]
  gw --> gok["The group's tasks read Blocked until every task of the group it waits on is done"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-18.1 | A project with no tasks | its Order tab opens | it reads *No tasks to order yet* with *New task* |
| PJ-18.2 | A project with tasks | its Order tab opens | the tasks are cards in waves, a wave being the number of dependency hops from the start, with the critical path marked |
| PJ-18.3 | A person whose default agent may Read the project | they drag one card onto another and choose a condition | a dependency is saved with *on success*, *on failure* or *any outcome*, and the dependent task lists what it waits on |
| PJ-18.4 | A dependency that would make a loop | it is saved | it is refused, naming the tasks in the loop; nothing is saved |
| PJ-18.5 | A task whose dependency is *on success* and has not yet succeeded | the task is read | it reads *Blocked*, naming that task and the condition |
| PJ-18.6 | A task whose dependency is *on success* and the first task failed | the task is read | it reads why it will not run, naming the failed task, rather than sitting blocked in silence |
| PJ-18.7 | A task whose dependency is *on failure* and the first task failed | the first task ends | the dependent task is free to run |
| PJ-18.8 | A task whose dependency is *on failure* and the first task succeeded | the first task ends | the dependent task reads *Never triggered*, not *Blocked* |
| PJ-18.9 | A task whose dependency is *any outcome* | the first task ends in any state | the dependent task is free to run |
| PJ-18.10 | A dependency *on failure* | the Order tab is drawn | its edge is dashed and the critical path ignores it |
| PJ-18.11 | The Order | waves, waits and the critical path are drawn | each is the engine's derivation; nobody types an order, and no order can be set by hand |
| PJ-18.12 | Two tasks that do not share a parent — one a sub-task of the other, or at different levels | a dependency between them is saved | it is refused, naming both tasks and that a dependency joins tasks with the same parent; nothing is saved |
| PJ-18.16 | Sub-tasks of one parent | its Order is read | they order among themselves in waves of their own, and the parent waits on them all |
| PJ-18.13 | A dependency | a person whose default agent may Read the project removes it | the waves, waits and critical path are recomputed, and History records it |
| PJ-18.14 | A task blocked or never triggered | the person opens its History | it shows which dependency, which outcome and which condition decided it |
| PJ-18.15 | An archived project | its Order tab opens | it reads; *Draw a dependency*, *New group* and *Remove* are disabled, saying the project is archived |
| PJ-18.17 | A project with tasks | a person makes a group and puts tasks in it | the Order draws the group around its tasks, with the engine's count of its tasks done of its total |
| PJ-18.18 | A group | it is made to wait on another group, of this project or another | its tasks read *Blocked*, naming the group, until every task of that group is *Done*; a wait on another project's group makes the two projects read *Waits on* (PJ-23) |
| PJ-18.19 | A group's wait that would make a loop, across projects too | it is saved | it is refused, naming the groups in the loop; nothing is saved |
| PJ-18.20 | A task dependency between two tasks of different projects | it is saved | it is refused, saying work across projects waits through groups; nothing is saved |
| PJ-18.21 | A group that waits on another project's group | its page is read by someone whose default agent may not Read that project | the wait reads that project's head and the group's done count; its tasks read *Withheld* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Order | Admin | projects.project · Order · No tasks to order | — | projects.project · Order · Loading | projects.project · Order | projects.project · Order · Loop refused | projects.project · Order · Tasks running | — |
| Order | Operator | projects.project · Order · No tasks to order | — | projects.project · Order · Loading | projects.project · Order | projects.project · Order · Loop refused | projects.project · Order · Tasks running | projects.project · Order · Archived |
| A task and what it waits on | Admin | — | — | — | projects.task · Waiting on | projects.task · Will not run | projects.task · Never triggered | — |
| A task and what it waits on | Operator | — | — | — | projects.task · Waiting on | projects.task · Will not run | projects.task · Never triggered | — |
| Groups | Admin | projects.project · Order · No groups | — | projects.project · Order · Loading | projects.project · Order · Groups | projects.project · Order · Group loop refused | projects.project · Order · Groups · Tasks running | — |
| Groups | Operator | projects.project · Order · No groups | — | projects.project · Order · Loading | projects.project · Order · Groups | projects.project · Order · Group loop refused | projects.project · Order · Groups · Tasks running | projects.project · Order · Groups · Other project withheld |
