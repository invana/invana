---
id: AG-22
title: Read how one agent is doing
feature: AG-F03
status: idea
personas: [builder, owner]
boards: [agents, agents.agent, agents.runs]
---

# AG-22 · Read how one agent is doing

**As** an agent builder **I want** a live agent's numbers in one place — its runs, how many it served, how long they
took, the tokens it spent and the helpers it made — with its recent runs beside them **so that** I see whether it is
getting worse before anyone asks why.

Tasks: [task.md](task.md) · Feature: [AG-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every agent's numbers, its runs and why each ended | — |
| Operator | Read every agent's numbers, its runs and why each ended; their own conversations with it | Others' conversations with the agent are counted, never listed |

## Flow

```mermaid
flowchart LR
  a([Agents]) --> p["Pick an agent"]
  p -->|a draft| d["No numbers yet — it has not run"]
  p --> n["Runs · served · p95 · tokens today and this month · helpers made"]
  n --> w{"7 · 30 · 90 days"}
  w --> n
  n --> r["Runs a day · tokens a day · why runs ended · recent runs"]
  r -->|a run| s(["The run's sheet"])
  r -->|all runs| l(["Runs, filtered to this agent"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AG-22.1 | A live agent | the person picks it in Agents | it reads its tokens today and this month as meters against its budgets, and its recent runs, each with when, what started it and why it ended |
| AG-22.2 | A live agent | its numbers open | tiles read runs · served · p95 a run · tokens this month · helpers made, over 7, 30 or 90 days, each against the window before |
| AG-22.3 | A live agent | its numbers open | runs a day and tokens a day are drawn over the window, one bar a day, a day with none drawn as zero |
| AG-22.4 | A live agent's ended runs | its numbers open | *Why runs ended* counts each reason in the run's own word — *answered* stays *answered* |
| AG-22.5 | A live agent | the person presses *All runs* | Runs opens filtered to this agent, the filter shown as a chip, 50 a page with *Show 50 more* |
| AG-22.6 | A draft that never ran | it is picked | it says it has not run yet, with no tiles |
| AG-22.7 | An agent with no month budget | its numbers open | *Tokens this month* reads the tokens alone, with *no month budget* |
| AG-22.8 | Conversations with the agent | an Operator opens its numbers | their own conversations are listed, newest first; the graph-wide count names no one else's |
| AG-22.9 | The engine cannot read the agent's numbers | they open | it says what it could not read; the rest of the sheet still reads |
| AG-22.10 | Token counts | any number is shown | it prints as `k`, `M` or `B`; a value that rounds up is printed on the next rung (`1M`, never `1000k`) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Agents — an agent picked | Admin | agents · Draft | — | agents · Loading | agents | agents · Could not load | agents · Running | — |
| Agents — an agent picked | Operator | agents · Draft | — | agents · Loading | agents | agents · Could not load | agents · Running | agents |
| An agent's numbers on its sheet | Admin | agents.agent · Untested draft | — | agents.agent · Loading | agents.agent | agents.agent · Could not load | — | — |
| An agent's numbers on its sheet | Operator | agents.agent · Untested draft | — | agents.agent · Loading | agents.agent · Read only | agents.agent · Could not load | — | agents.agent · Read only |
| Runs filtered to the agent | Admin | — | agents.runs · No runs match | agents.runs · Loading | agents.runs · Filtered | agents.runs · Could not load | agents.runs · Running | — |
| Runs filtered to the agent | Operator | — | agents.runs · No runs match | agents.runs · Loading | agents.runs · Filtered | agents.runs · Could not load | agents.runs · Running | agents.runs · Filtered |
