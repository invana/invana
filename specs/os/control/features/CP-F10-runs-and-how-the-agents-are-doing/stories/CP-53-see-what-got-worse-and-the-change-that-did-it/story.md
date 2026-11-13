---
id: CP-53
title: See what got worse and the change that did it
feature: CP-F10
status: idea
personas: [builder, admin]
boards: [agents, agents.runs]
---

# CP-53 · See what got worse and the change that did it

**As** an agent builder **I want** speed, success and tokens for every agent, skill, plan and model version against
its own baseline, with what got worse and the change before it named **so that** a regression is caught the day it
ships and I know which change to undo.

Tasks: [task.md](task.md) · Feature: [CP-F10](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read how every agent, skill, plan and model version is doing; open the runs behind a figure; open a change to compare | — |
| Operator | An Operator or a Modeller ([the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table)): the same — every figure reads and opens its runs | A run behind a figure whose content they may not read lists with its head and *withheld* ([AC-31](../../../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)) |

## Flow

```mermaid
flowchart LR
  a([How they are doing]) --> t{"Agents · Skills · Plans · Model versions"}
  t --> w{"7 · 30 · 90 days"}
  w --> n["Tiles · trend · one row per subject"]
  n -->|degraded| d["p95 now against its baseline · the change before it"]
  d --> c(["Compare the two versions"])
  n -->|failing| f(["Its latest failed run"])
  n -->|too few runs| x["Too few runs to say"]
  n -->|a figure| r(["Runs it counts"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-53.1 | Runs in the window | the person opens how they are doing | tiles read success · p50 · p95 · runs · tokens a run · degraded, each against the same window before |
| CP-53.2 | Any tab | it opens | one row per subject — runs · success · p50 · p95 · trend · tokens a run · signal |
| CP-53.3 | A subject whose last 3 runs each took more than 1.5× its 7-day p95, with at least 5 runs in that baseline | the tab opens | its row reads *degraded*, with p95 now against the baseline |
| CP-53.4 | A degraded subject with an agent or skill version published inside its baseline before the first slow run | its row opens | the change is named with who published it and *Compare*; with none, it is named by its numbers alone — *p95 7.4s, up from 4.6s* |
| CP-53.5 | A subject whose 2 or more latest runs failed | the tab opens | its row reads *failing*, outranking *degraded*, and opens its latest failed run |
| CP-53.6 | The trend | the tab opens | it draws p95 a day for the most degraded subject, else the busiest, with its baseline and each version published in the window marked |
| CP-53.7 | Cannot-answer runs | success and failures are counted | a cannot-answer is counted on its own, never as a failure |
| CP-53.8 | A subject with too few runs | its row is drawn | it reads *too few runs*, never a flat line |
| CP-53.9 | Any tile, row or point | the person opens it | Runs lists the runs it counts, filtered, the filters shown |
| CP-53.10 | A window and a tab picked | the page is reloaded or the link shared | the same window and tab open |
| CP-53.11 | Any figure | it is shown | it is in tokens; no cost is shown |
| CP-53.12 | Nothing ran in the window | the page opens | tiles read `0` or `—` and a line says nothing ran in the window |
| CP-53.13 | The engine cannot read the numbers | the page opens | it says what it could not read, in the engine's words |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| How they are doing — tiles, trend, rows | Admin | agents · Nothing ran | — | agents · Loading | agents · How they are doing | agents · Could not load | agents · Degraded | — |
| How they are doing — tiles, trend, rows | Operator | agents · Nothing ran | — | agents · Loading | agents · How they are doing | agents · Could not load | agents · Degraded | agents · How they are doing |
| Runs a figure opens | Admin | — | agents.runs · No runs match | agents.runs · Loading | agents.runs · Filtered | agents.runs · Could not load | — | — |
| Runs a figure opens | Operator | — | agents.runs · No runs match | agents.runs · Loading | agents.runs · Filtered | agents.runs · Could not load | — | agents.runs · Content withheld |
