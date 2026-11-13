---
id: CP-07
title: A lost coordinator costs seconds, not runs
feature: CP-F03
status: idea
personas: [admin]
boards: [settings.workers]
---

# CP-07 · A lost coordinator costs seconds, not runs

**As** an Admin **I want** to see the coordinators that hand out work and which runs each holds, and a lost
one's runs move on by themselves **so that** a crash costs seconds, not runs.

Tasks: [task.md](task.md) · Feature: [CP-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every coordinator, the runs it holds and when it last renewed | — |
| Operator | Read every coordinator, the runs it holds and when it last renewed | — |

## Flow

```mermaid
flowchart TD
  s([Control Plane › Workers › Coordinators]) --> l["Each coordinator: runs it holds · last renewed"]
  l -->|stops renewing| lost["Lost after 15 s"]
  lost --> mv(["Its runs move to another · resume from their last saved step"])
  l -->|only one| one["Runs here · a crash pauses work until it restarts"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-07.1 | An Operator | they open *Coordinators* | each reads with the runs it holds and when it last renewed them |
| CP-07.2 | A coordinator that stops renewing | 15 s pass | it reads lost, and its runs move to another coordinator, resuming from their last saved step |
| CP-07.3 | A moved run | it resumes | no step it finished runs again, and the run says it moved |
| CP-07.4 | A run waiting on a person, an ask or a limit | it is read | no coordinator holds it |
| CP-07.5 | A deployment with one coordinator | the list is read | it says a crash pauses work until it restarts |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Coordinators | Admin | settings.workers · One coordinator | — | settings.workers · Loading | settings.workers · Coordinators | settings.workers · Coordinator lost | — | — |
| Coordinators | Operator | settings.workers · One coordinator | — | settings.workers · Loading | settings.workers · Coordinators | settings.workers · Coordinator lost | — | — |
