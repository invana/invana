---
id: ST-17
title: See where work is and why it waits
feature: ST-F06
status: idea
personas: [admin]
boards: [settings.workers]
---

# ST-17 · See where work is and why it waits

**As** an install admin **I want** one view from what started a run to whether it was let in, what is running, and what
waits and why **so that** I see where work is and why it waits, instead of guessing from a slow answer.

Tasks: [task.md](task.md) · Feature: [ST-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read where work is across every Graph | — |
| Operator | Read where work is across every Graph | — |

## Flow

```mermaid
flowchart TD
  s([Settings › Workers › Where work is]) --> f["Started → let in → running → waiting · counts for each"]
  f --> w["Waiting: on a person · on an ask · on a limit · on an AI model · on workers"]
  w --> one["A waiting run: why · for how long · what is ahead"]
  one --> run(["Opens the run (AG-F03)"])
  f -->|nothing running| q["Quiet · nothing waits"]
  f -->|cannot load| e["Could not load · Try again"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| ST-17.1 | A member | they open *Where work is* | runs read by stage — started, let in, running, waiting — with a count each, as the engine stored them |
| ST-17.2 | Waiting runs | they are read | each says what it waits on — a person, an ask, the Graph's limit, an AI model's rate limit, or workers — and for how long |
| ST-17.3 | A run waiting on a person or an ask | it is read | it uses no worker and holds no slot |
| ST-17.4 | A waiting run | it is opened | its run opens, showing the same reason (AG-F03) |
| ST-17.5 | Nothing running | the view opens | it says nothing is running or waiting |
| ST-17.6 | The view cannot load | it opens | it says so and offers to try again |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Where work is | Admin | settings.workers · Nothing running | — | settings.workers · Loading | settings.workers · Where work is | settings.workers · Could not load | — | — |
| Where work is | Operator | settings.workers · Nothing running | — | settings.workers · Loading | settings.workers · Where work is | settings.workers · Could not load | — | — |
