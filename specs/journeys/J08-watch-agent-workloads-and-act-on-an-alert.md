---
id: J08
title: Watch agent workloads and act on an alert
personas: [admin, builder]
stories: [CP-47, CP-60, CP-37, CP-59, CP-36, CP-57, CP-50, CP-58, CP-12, CP-05, CP-34, CP-11, CP-40, CP-39, CP-49, CP-53]
boards: [control.overview, control.alerts, inbox, agents.runs, agents.run, settings.workers, settings.usage, settings.databases]
---

# Watch agent workloads and act on an alert

> **Lee**, an Admin, wants to see what every agent is doing across the deployment — by user, agent and team — and,
> when something goes wrong, to be told, find the run behind it and act before it costs more.

## The journey

```mermaid
flowchart TD
  A([Control Plane]) --> O["CP-47 · Overview · workloads by user, agent and team"]
  A --> NR["CP-37 · Say which ops alerts reach whom — Inbox, email, Slack, Teams, webhook"]
  A --> TH["CP-60 · Tune when ops alerts fire"]
  TH --> AL
  NR --> AL{"An ops alert fires"}
  AL -->|repeated refusals| AL1["Ops alert · an agent refused again and again"]
  AL -->|spend over a limit| AL2["Ops alert · a team, user or agent past its limit"]
  AL -->|a stuck run| AL3["Ops alert · a run that has not moved"]
  AL -->|a graph database unreachable| AL4["Ops alert · names the graph database"]
  AL -->|data sent from a schema-only workflow| AL5["Ops alert · names the run and what it carried"]
  AL1 --> IN["CP-59 · CP-36 · The alert reaches the agent's owners and the Admins, in the Inbox and on their channels"]
  AL2 --> IN
  AL3 --> IN
  AL4 --> IN
  AL5 --> IN
  O --> R["CP-57 · What is running and what just ran"]
  IN --> R2["CP-50 · Find the run behind it and see where it stands"]
  R --> R2
  R2 --> D{"Lee decides"}
  D -->|it should not go on| S["CP-58 · Stop the run · the person behind it is told"]
  D -->|it waits| W["CP-12 · CP-05 · Why it waits or was refused · where work queues"]
  D -->|it spends too much| L["CP-34 · What each team, user and agent spends against its limits"]
  L --> L1["CP-11 · Raise or lower a limit"]
  D -->|the database is unreachable| G["CP-40 · CP-39 · Graph databases · its health · switch it off until it is back"]
  D -->|the agent keeps failing| Q["CP-49 · How the agent is doing"]
  Q --> Q1["CP-53 · What got worse, and the change that did it"]
  S --> E(["Recorded in History · the alert closes"])
  W --> E
  L1 --> E
  G --> E
  Q1 --> E
  A -.->|without the Admin role| NA(["Sees the runs they are behind and those of agents they own · others show that they ran, their status and cost"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Read workloads by user, agent and team | Control Plane · Overview | CP-47 | `control.overview` |
| 2 | Say which ops alerts reach whom, and on which channels | Control Plane · Inbox and notifications | CP-37 | `inbox` |
| 3 | An ops alert fires and reaches the agent's owners and the Admins | Control Plane · Ops alerting · Inbox | CP-59 · CP-36 | `control.alerts` · `inbox` |
| 4 | See what is running and what just ran | Control Plane · Runs | CP-57 | `agents.runs` |
| 5 | Find the run behind the alert | Control Plane · Runs | CP-50 | `agents.run` |
| 6 | Stop the run | Control Plane · Runs | CP-58 | `agents.run` |
| 7 | See why a run waits or was refused, and where work queues | Control Plane · Limits · Workers and the queue | CP-12 · CP-05 | `settings.workers` |
| 8 | Read spend against limits; raise or lower one | Control Plane · Limits | CP-34 · CP-11 | `settings.usage` |
| 9 | Read a graph database's health; switch it off | Control Plane · Graph databases | CP-40 · CP-39 | `settings.databases` |
| 10 | Read how the agent is doing and what got worse | Control Plane · Runs | CP-49 · CP-53 | `agents.runs` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | Stopping a run is for the person behind it, the agent's owners and the Admins; changing a limit or switching a graph database off is an Admin's | CP-58 · CP-11 | `agents.run` · `settings.usage` |
| It fails | A run that cannot be stopped in time says what it finished; an unreachable graph database is named, and its runs are refused before they start | CP-58 · CP-59 | `agents.run` |
| The person has no access | An Operator sees the runs they are behind and those of agents they own; any other run shows only that it ran, its status and its tokens | CP-57 · CP-50 | `agents.runs` |
| A graph database is switched off | Schedules that need it skip the firing and raise an alert; workflows that depend on it are flagged and their runs refused, naming who switched it off | CP-39 · CP-59 | `settings.databases` · `control.alerts` |
| No channel is set | The alert still waits in the Inbox | CP-36 | `inbox` |

## Done when

- Every ops alert reaches the agent's owners and the Admins, opens the run behind it, and the act taken on it — a stop, a limit, a switch — is a row in History.
