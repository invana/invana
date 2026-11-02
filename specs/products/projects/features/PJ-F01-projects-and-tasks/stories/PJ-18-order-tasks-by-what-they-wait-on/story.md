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
either outcome, and see the order that follows **so that** a task that only matters when something breaks has a way to
say so, and nobody keeps an order by hand.

Tasks: [task.md](task.md) · Feature: [PJ-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Draw and remove a dependency, choose its condition; read the order, the waves and the critical path | — |
| Operator | Read the Order tab, every dependency with its condition, and why a task waits | *Draw a dependency* and *Remove* disabled, naming *Can work on projects*. *With Can work on projects: as Admin* |

## Flow

```mermaid
flowchart TD
  s([A project › Order]) --> any{"Any tasks?"}
  any -->|none| e["No tasks to order yet · New task (PJ-12)"]
  any -->|some| pl["Tasks as cards in waves · the critical path marked"]
  pl --> dr["Drag one card to another: choose when it runs"]
  dr -->|Operator| na["Disabled, naming Can work on projects"]
  dr --> c{"Condition"}
  c -->|on success| os["Runs only when the first is Done"]
  c -->|on failure| of["Runs only when the first Failed · drawn dashed · off the critical path"]
  c -->|any outcome| oa["Runs when the first ends either way"]
  os --> chk
  of --> chk
  oa --> chk{"Makes a loop?"}
  chk -->|yes| ref["Refused, naming the loop · nothing saved"]
  chk -->|no| ok["Saved · waves, waits and the critical path recomputed"]
  ok --> st{"The first task ends"}
  st -->|condition met| go["The dependent task is free to run"]
  st -->|on success, but it failed| bl["The dependent reads why it will not run"]
  st -->|on failure, but it succeeded| nt["The dependent reads never triggered, not blocked"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-18.1 | A project with no tasks | its Order tab opens | it reads *No tasks to order yet* with *New task* |
| PJ-18.2 | A project with tasks | its Order tab opens | the tasks are cards in waves, a wave being the number of dependency hops from the start, with the critical path marked |
| PJ-18.3 | A member who can work on projects | they drag one card onto another and choose a condition | a dependency is saved with *on success*, *on failure* or *any outcome*, and the dependent task lists what it waits on |
| PJ-18.4 | A dependency that would make a loop | it is saved | it is refused, naming the tasks in the loop; nothing is saved |
| PJ-18.5 | A task whose dependency is *on success* and has not yet succeeded | the task is read | it reads *Blocked*, naming that task and the condition |
| PJ-18.6 | A task whose dependency is *on success* and the first task failed | the task is read | it reads why it will not run, naming the failed task, rather than sitting blocked in silence |
| PJ-18.7 | A task whose dependency is *on failure* and the first task failed | the first task ends | the dependent task is free to run |
| PJ-18.8 | A task whose dependency is *on failure* and the first task succeeded | the first task ends | the dependent task reads *Never triggered*, not *Blocked* |
| PJ-18.9 | A task whose dependency is *any outcome* | the first task ends in any state | the dependent task is free to run |
| PJ-18.10 | A dependency *on failure* | the Order tab is drawn | its edge is dashed and the critical path ignores it |
| PJ-18.11 | The Order | waves, waits and the critical path are drawn | each is the engine's derivation; nobody types an order, and no order can be set by hand |
| PJ-18.12 | A task from another project drawn on the Order tab | the project's counts are read | it is drawn but is not counted as this project's work |
| PJ-18.13 | A dependency | a member who can work on projects removes it | the waves, waits and critical path are recomputed, and History records it |
| PJ-18.14 | A task blocked or never triggered | the person opens its run history | *How it got here* shows which dependency, which outcome and which condition decided it |
| PJ-18.15 | An Operator | they open the Order tab | it reads; *Draw a dependency* and *Remove* are disabled, naming *Can work on projects* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Order | Admin | projects.project · Order · No tasks to order | — | projects.project · Order · Loading | projects.project · Order | projects.project · Order · Loop refused | projects.project · Order · Tasks running | — |
| Order | Operator | projects.project · Order · No tasks to order · Read only | — | projects.project · Order · Loading | projects.project · Order · Read only | projects.project · Order · Could not load | projects.project · Order · Tasks running | projects.project · Order · Read only |
| A task and what it waits on | Admin | — | — | — | projects.task · Waiting on | projects.task · Will not run | projects.task · Never triggered | — |
| A task and what it waits on | Operator | — | — | — | projects.task · Waiting on · Read only | projects.task · Will not run · Read only | projects.task · Never triggered · Read only | projects.task · Read only |
