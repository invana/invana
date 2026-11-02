---
id: EX-12
title: Add an answer to a project
feature: EX-F02
status: idea
personas: [analyst, decision-maker]
boards: [explore.board, projects.finding]
---

# EX-12 · Add an answer to a project

**As** an analyst **I want** to add an answer to a project branch as a finding **so that** what I found feeds a
decision, with its evidence attached.

Tasks: [task.md](task.md) · Feature: [EX-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Add any settled answer to a branch of any project they can see | — |
| Operator | — | *Add to a project* disabled — *Ask Priya (owner)*. With *Can work on projects*: as Admin |

## Flow

```mermaid
flowchart LR
  a([A settled answer · Add to a project]) --> g{Can work on projects?}
  g -->|no| n["Disabled — Ask Priya (owner)"]
  g -->|yes| p["Pick a project and a branch · supports · contradicts · context"]
  p -->|no project yet| e["No projects on this Graph · New project"]
  p -->|Add| f(["A finding: its records, queries and dataset versions"])
  p -->|fails| x["Could not add the finding — the reason · Try again"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-12.1 | A settled answer and a person with *Can work on projects* | they pick *Add to a project* on its reply line | they pick a project, a branch and whether it supports, contradicts or gives context |
| EX-12.2 | The choice made | they add it | the branch holds a finding with the answer's records, queries and dataset versions attached |
| EX-12.3 | A finding added from an answer | someone opens it in Projects | it shows the records behind it, the dataset and the version they came from |
| EX-12.4 | A Graph with no projects | the person picks *Add to a project* | it says *No projects on this Graph* with *New project* |
| EX-12.5 | Adding fails | the engine refuses | the person sees *Could not add the finding* with the reason and *Try again*; the answer is unchanged |
| EX-12.6 | An answer still running, failed or stopped | its reply line shows | there is no *Add to a project* |
| EX-12.7 | An Operator without *Can work on projects* | they reach *Add to a project* | it is disabled with *Ask Priya (owner)* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Add to a project | Admin | explore.board · No projects | — | explore.board · Adding | explore.board · Add to a project | explore.board · Failed | explore.board · Agent working | — |
| Add to a project | Operator | — | — | — | — | — | explore.board · Agent working | explore.board · No access |
| The finding | Admin | — | — | projects.finding · Loading | projects.finding | — | — | — |
| The finding | Operator | — | — | projects.finding · Loading | projects.finding | — | — | — |
