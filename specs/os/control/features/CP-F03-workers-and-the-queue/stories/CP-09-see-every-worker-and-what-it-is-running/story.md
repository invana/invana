---
id: CP-09
title: See every worker and what it is running
feature: CP-F03
status: idea
milestone: MVP
personas: [admin]
boards: [settings.workers, flow.drain_worker, flow.add_workers]
---

# CP-09 · See every worker and what it is running

**As** an Admin **I want** every worker in every group, what each is running, and where steps wait for want of
workers **so that** I add workers where they are short and drain the ones I am retiring.

Tasks: [task.md](task.md) · Feature: [CP-F03](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read every group and worker; with Manage on `worker/<group>`, drain a worker; revoke a join key | — |
| Operator | Read every group and worker and what each runs | *Drain* and *Revoke* disabled — *Needs Manage on the {group} worker group — ask {who can grant}* |

## Flow

```mermaid
flowchart TD
  s([Settings › Workers › Groups]) --> g["Each group: runs on · labels · workers · busy · waiting · state"]
  g -->|no workers anywhere| nw["Steps run inside the engine · Add workers"]
  g --> grp["A group: every worker · state · running now · heartbeat"]
  grp -->|filter by state| f["No worker matches"]
  grp --> w["A worker: runtimes · running now · workspaces · steps this hour · its log"]
  w -->|a run the reader may not read| wh["Its session's head · content withheld"]
  w -->|Drain| dc["Confirm: what it holds"]
  dc --> dg["Draining"]
  dg --> d(["Drained · finishes what it holds · then stops"])
  dc -->|refused| df["Could not drain"]
  grp -->|a worker silent 30 s| lost["Lost · its steps handed on"]
  s --> keys["Join keys: group · made by · expires · joined n of cap"]
  keys -->|Revoke| rc["Confirm: key · group · joined"]
  rc --> rv(["Revoked · no new joins"])
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
| CP-09.10 | An Operator | they open Workers | everything reads; *Drain* and *Revoke* are disabled — *Needs Manage on the {group} worker group — ask {who can grant}* |
| CP-09.11 | An Admin | they drain a worker group | every worker in it takes no new work, finishes what it holds, then stops; History records who and when (AC-F06) |
| CP-09.12 | An Operator | they read a group's changes | every join, loss, drain, revoke and change to the group reads newest first, with who or what caused it and why |
| CP-09.13 | A lost worker | it heartbeats again | it reads busy or idle again; the steps already handed on are not run a second time |
| CP-09.14 | A worker | it opens | its open workspaces read — the task and run each belongs to, kept or open, since when — never the files in them |
| CP-09.15 | A worker running a session for a run the reader may not read | it is read | the session reads its agent, runtime and status; the run's content is *withheld*, naming who may read it |
| CP-09.16 | An Admin | they press *Drain* on a worker or a group | a confirm names what it holds now; confirming reads *Draining* until the worker stops, then *Drained*; a refusal reads *Could not drain*, naming the cause, with *Cancel* and *Try again* |
| CP-09.17 | An Admin | they press *Revoke* on a join key | a confirm names the key, its group and how many workers joined; confirming reads *Revoked* (CP-10.23) |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Workers | Admin | settings.workers · No workers | — | settings.workers · Loading | settings.workers | settings.workers · Could not load | — | — |
| Workers | Operator | settings.workers · No workers | — | settings.workers · Loading | settings.workers · Read only | settings.workers · Could not load | — | settings.workers · Read only |
| A group | Admin | — | settings.workers · No worker matches | settings.workers · Loading | settings.workers · Group | settings.workers · Worker lost | — | — |
| A group | Operator | — | settings.workers · No worker matches | settings.workers · Loading | settings.workers · Group · Read only | settings.workers · Worker lost | — | settings.workers · Read only |
| A worker | Admin | — | — | settings.workers · Loading | settings.workers · Worker | settings.workers · Worker lost | — | — |
| A worker | Operator | — | — | settings.workers · Loading | settings.workers · Worker · Read only | settings.workers · Worker lost | — | settings.workers · Read only |
| A worker · Drain | Admin | — | — | settings.workers · Worker · Draining | settings.workers · Worker · Drain | settings.workers · Worker · Could not drain | — | — |
| A worker · Drain | Operator | — | — | — | — | — | — | settings.workers · Read only |
| A worker · Drained | Admin | — | — | — | settings.workers · Worker · Drained | — | — | — |
| A worker · Drained | Operator | — | — | — | — | — | — | settings.workers · Read only |
| A group · Drain | Admin | — | — | settings.workers · Group · Draining | settings.workers · Group · Drain | settings.workers · Group · Could not drain | — | — |
| A group · Drain | Operator | — | — | — | — | — | — | settings.workers · Read only |
| A group · Drained | Admin | — | — | — | settings.workers · Group · Drained | — | — | — |
| A group · Drained | Operator | — | — | — | — | — | — | settings.workers · Read only |
| Join keys · Revoke | Admin | — | — | — | settings.workers · Join keys · Revoke | — | — | — |
| Join keys · Revoke | Operator | — | — | — | — | — | — | settings.workers · Read only |
| Join keys · Revoked | Admin | — | — | — | settings.workers · Join keys · Revoked | — | — | — |
| Join keys · Revoked | Operator | — | — | — | — | — | — | settings.workers · Read only |
