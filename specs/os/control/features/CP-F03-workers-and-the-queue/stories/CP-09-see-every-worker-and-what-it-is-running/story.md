---
id: CP-09
title: See every worker and what it is running
feature: CP-F03
status: idea
personas: [admin]
boards: [settings.workers]
---

# CP-09 · See every worker and what it is running

**As** an Admin **I want** every worker in every group, what each is running, and where steps wait for want of
workers **so that** I add workers where they are short and drain the ones I am retiring.

Tasks: [task.md](task.md) · Feature: [CP-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every group and worker; drain a worker; revoke a join key | — |
| Operator | Read every group and worker and what each runs | *Drain* and *Revoke* disabled — *Needs the Admin role — ask {admins}* |

## Flow

```mermaid
flowchart TD
  s([Control Plane › Workers]) --> g["Each group: runs on · labels · workers · busy · waiting · state"]
  g -->|no workers anywhere| nw["Steps run inside the engine · Add workers"]
  g --> grp["A group: every worker · state · running now · heartbeat"]
  grp -->|filter by state| f["No worker matches"]
  grp --> w["A worker: runtimes · running now · workspaces · steps this hour · its log"]
  w -->|a run the reader may not read| wh["Its session's head · content withheld"]
  w -->|Drain| d(["Finishes what it holds · then stops"])
  grp -->|a worker silent 30 s| lost["Lost · its steps handed on"]
  s --> keys["Join keys: group · made by · expires · joined n of cap"]
  keys -->|Revoke| rv(["No new joins"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-09.1 | An Operator | they open *Workers* | each group reads what it runs on, its labels, the runtimes it carries, workers, busy and total, steps waiting, the oldest and its state — keeping up · short · no workers |
| CP-09.2 | A deployment with no workers | Workers opens | it says steps run inside the engine and offers *Add workers* |
| CP-09.3 | A group | it opens | each worker reads its state — busy · idle · starting · lost · draining — the runtimes it loaded with their versions, what it is running now (function or session · run · agent), its heartbeat's age and how long it has been up |
| CP-09.4 | A filter by state that matches none | it is applied | *No worker matches* shows with *Clear filter* |
| CP-09.5 | A worker | it opens | what it runs now, its steps this hour and failures, and its recent log read |
| CP-09.6 | A worker silent for 30 s | it is read | it reads lost, with how many steps were handed to another worker; each runs once |
| CP-09.7 | An Admin | they drain a worker | it takes no new work, finishes what it holds, then stops |
| CP-09.8 | An Admin | they revoke a join key | no new worker joins with it; joined workers keep running |
| CP-09.9 | Every number on Workers | it is read | it is the engine's, stored every 30 s; a change against last week reads `—` when nothing was measured |
| CP-09.10 | An Operator | they open Workers | everything reads; *Drain* and *Revoke* are disabled — *Needs the Admin role — ask {admins}* |
| CP-09.11 | An Admin | they drain a worker group | every worker in it takes no new work, finishes what it holds, then stops; History records who and when (AC-F06) |
| CP-09.12 | An Operator | they read a group's changes | every join, loss, drain, revoke and change to the group reads newest first, with who or what caused it and why |
| CP-09.13 | A lost worker | it heartbeats again | it reads busy or idle again; the steps already handed on are not run a second time |
| CP-09.14 | A worker | it opens | its open workspaces read — the task and run each belongs to, kept or open, since when — never the files in them |
| CP-09.15 | A worker running a session for a run the reader may not read | it is read | the session reads its agent, runtime and status; the run's content is *withheld*, naming who may read it |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Workers | Admin | settings.workers · No workers | — | settings.workers · Loading | settings.workers | settings.workers · Could not load | — | — |
| Workers | Operator | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Read only | settings.workers · Could not load | — | settings.workers · Read only |
| A group | Admin | — | settings.workers · No worker matches | settings.workers · Loading | settings.workers · Group | settings.workers · Worker lost | — | — |
| A group | Operator | — | settings.workers · No worker matches | settings.workers · Loading | settings.workers · Group · Read only | settings.workers · Worker lost | — | settings.workers · Read only |
| A worker | Admin | — | — | settings.workers · Loading | settings.workers · Worker | settings.workers · Worker lost | — | — |
| A worker | Operator | — | — | settings.workers · Loading | settings.workers · Worker · Read only | settings.workers · Worker lost | — | settings.workers · Read only |
