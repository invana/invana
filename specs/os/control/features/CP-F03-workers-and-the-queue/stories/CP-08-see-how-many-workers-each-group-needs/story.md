---
id: CP-08
title: See how many workers each group needs
feature: CP-F03
status: idea
personas: [admin]
boards: [settings.workers]
---

# CP-08 · See how many workers each group needs

**As** an Admin **I want** the slots every worker together has now — total, busy and free, overall and per group —
each group's steps waiting, the oldest, and advice to add workers or drain idle ones **so that** I size the workers to
the load, without Invana holding cloud keys or scaling anything itself.

Tasks: [task.md](task.md) · Feature: [CP-F03](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read the slots and where steps wait; *Add workers* on a short group; *Drain* idle workers the advice names | — |
| Operator | Read the slots, where steps wait and the advice | *Add workers* disabled — *Needs Create on Workers*, and *Drain* — *Needs Manage on the {group} worker group* — ask {who can grant} |

## Flow

```mermaid
flowchart TD
  s([Settings › Workers › Groups › Where steps wait]) --> sl["Slots: total · busy · free — overall and per group"]
  sl --> g["Each group: steps waiting · oldest · workers · suggested"]
  g -->|more workers than the load needs| idle["n idle — drain n"]
  idle -->|Drain · Admin| dr(["CP-09 · those workers finish what they hold, then stop"])
  g -->|a group short| c["Says so · how many would clear it"]
  c -->|Add workers| add(["CP-10 · on that group"])
  g -->|no worker in a group| nw["No workers — start one"]
  g -->|a step no group covers| un["Waiting · names the missing label"]
  g -->|keeping up| ok(["Nothing to do"])
  sl --> ch["Workers over time · queued and workers · a window"]
  ch -->|a change in the count| ev["Worker events · when · group · change · why · by"]
  ch -->|nothing stored in the window| nd["No history yet"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-08.1 | An Operator | they open *Where steps wait* | each worker group reads steps waiting, the oldest, its workers and how many are suggested, as the engine stored them every 30 s |
| CP-08.2 | A group with more steps waiting than its workers take | it is read | it says it is short and how many workers would clear it — steps waiting ÷ steps a worker took over the last ten minutes |
| CP-08.3 | A short group | the Admin presses *Add workers* | Add workers opens on that group (CP-10) |
| CP-08.4 | A group with no worker | it is read | it says *no workers — start one*, and a run waiting on it names the group |
| CP-08.5 | A step whose labels no live group covers | it waits | it is named, with the missing label, and fails when its wait runs out |
| CP-08.6 | Any group | Invana suggests workers | nothing starts a machine; a person adds them |
| CP-08.7 | An Operator | they open Where steps wait | everything reads; *Add workers* are disabled — *Needs Create on Workers*, and *Drain* — *Needs Manage on the {group} worker group* — ask {who can grant} |
| CP-08.8 | Workers in any group | Settings › Workers › Groups opens | its head reads the slots every worker together has now — *48 slots · 31 busy · 17 free* — and each group reads its own; a slot is one agent step a worker can take at once, and every number is the engine's, stored every 30 s |
| CP-08.9 | A group whose suggested count is above its workers | it is read | its advice reads *Add {n} workers*, the number the engine suggested |
| CP-08.10 | A group with workers idle over the last ten minutes and a suggested count below its workers, above its minimum | it is read | its advice reads *{n} idle — drain {n}*, never below the group's minimum; an Admin's *Drain* drains that many idle workers (CP-09) |
| CP-08.11 | A group whose workers match the load | it is read | its advice reads *Keeping up*; no act is offered |
| CP-08.12 | Any group, or all groups | Where steps wait opens | it leads with a KPI strip — workers · slots busy · steps waiting · the oldest — and one chart of workers and steps queued over a window the reader picks (*1 h* · *24 h* · *7 days*), each point a count the engine stored every 30 s; a window with nothing stored reads *No history yet* |
| CP-08.13 | A change in a group's worker count | the chart is read | the change is marked on the chart and listed under it as an event — *when · group · change · why · by whom*: a worker joined, lost, drained or stopped, a count declared on Kubernetes, or a group changed; *why* reads what the engine recorded (*joined with key {prefix}* · *silent 30 s* · *drained by {person}* · *replicas 2 → 4 declared by {person}*), *by* a person or *the engine*; they are the changes of CP-09.12, across every group, newest first |
| CP-08.14 | The chart or the events | an Operator reads them | they read as the Admin does; a number the engine did not store reads `—`, never an estimate |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Where steps wait | Admin | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Where steps wait | settings.workers · Short of workers | — | — |
| Where steps wait | Operator | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Where steps wait | settings.workers · Short of workers | — | settings.workers · Read only |
| Slots and advice | Admin | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Slots and advice | settings.workers · Short of workers | — | — |
| Slots and advice | Operator | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Slots and advice | settings.workers · Short of workers | — | settings.workers · Read only |
| Workers over time and worker events | Admin | settings.workers · No workers | settings.workers · No history yet | settings.workers · Loading | settings.workers · Workers over time | settings.workers · Short of workers | — | — |
| Workers over time and worker events | Operator | settings.workers · No workers | settings.workers · No history yet | settings.workers · Loading | settings.workers · Workers over time | settings.workers · Short of workers | — | settings.workers · Read only |
