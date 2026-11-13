---
id: CP-51
title: Read a run of hundreds of agents like any run
feature: CP-F10
status: idea
personas: [analyst, builder]
boards: [agents.run]
---

# CP-51 · Read a run of hundreds of agents like any run

**As** an analyst **I want** a run of seven hundred agents read like any run — grouped by role, with how fast they
finish and how long is left **so that** a big run is as traceable as a small one.

Tasks: [task.md](task.md) · Feature: [CP-F10](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read a big run's rates, roles and every agent in it; stop it ([CP-58](../CP-58-stop-a-run-that-should-not-go-on/story.md)) | — |
| Operator | An Operator or a Modeller ([the role table](../../../../../access/features/AC-F02-access-policies/feature.md#the-role-table)): read a big run's rates, roles and every agent in it when they are behind it or own its agent; stop it then ([CP-58](../CP-58-stop-a-run-that-should-not-go-on/story.md)) | Any other big run: that it ran, its agent, the person behind it, its status and its tokens — the rest *withheld* ([AC-31](../../../../../access/features/AC-F09-what-left-the-platform/stories/AC-31-keep-a-runs-content-to-those-who-may-read-it/story.md)); *Stop run* disabled, naming who may stop it |

## Flow

```mermaid
flowchart LR
  r([A run past 50 agents]) --> n["Agents · live · queued · finishing a minute · tokens · time left"]
  r -->|content not theirs to read| w["That it ran · status · tokens · the rest withheld"]
  n --> g{"Who did what"}
  g -->|Tree| t["Who made whom"]
  g -->|By role| b["One card per role · one cell per agent"]
  b -->|a cell| a["That agent's run"]
  n -->|nothing finished lately| e["Time left is absent"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-51.1 | A run of more than 50 agents | its sheet opens | the parts are the same as any run's; its numbers read agents · live · queued · finishing a minute · tokens · time left |
| CP-51.2 | A big run | its numbers read | *Agents finished a minute*, *Agents live* against the deployment's runs-at-once limit, and *By role* — each role with its count, p50 and p95 |
| CP-51.3 | A big run | the person picks *By role* in who did what | one card per role with a status bar, and one cell per agent; a cell opens that agent's run |
| CP-51.4 | A run of 50 agents or fewer | who did what opens | it draws the tree alone; *By role* is not offered |
| CP-51.5 | Agents finished in the last ten minutes | time left is read | it is the agents still to finish over that rate |
| CP-51.6 | No agent finished in the last ten minutes | the numbers read | time left is absent, never a guess |
| CP-51.7 | A role whose agents recorded no tokens | *By role* reads | its p50 and p95 read `—` |
| CP-51.8 | Agents waiting for workers | the numbers read | they say the run waits on workers, naming which |
| CP-51.9 | A big run still going | its sheet is open | the numbers refresh every few seconds |
| CP-51.10 | A big run whose content the reader may not read | its sheet opens | that it ran, its agent, the person behind it, its status and its tokens read; who did what and *By role* read *withheld* |
| CP-51.11 | A big run still going | the reader is not behind it and not an Admin | *Stop run* is disabled, naming who may stop it ([CP-58](../CP-58-stop-a-run-that-should-not-go-on/story.md)) |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A big run — numbers and rates | Admin | — | — | agents.run · Loading | agents.run · Many agents | agents.run · Failed | agents.run · Many agents running | — |
| A big run — numbers and rates | Operator | — | — | agents.run · Loading | agents.run · Many agents | agents.run · Failed | agents.run · Many agents running | agents.run · Content withheld |
| A big run — by role | Admin | — | — | agents.run · Loading | agents.run · By role | agents.run · Could not load | agents.run · Many agents running | — |
| A big run — by role | Operator | — | — | agents.run · Loading | agents.run · By role | agents.run · Could not load | agents.run · Many agents running | agents.run · Content withheld |
