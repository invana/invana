---
id: CP-70
title: See what the deployment is doing from the header
feature: CP-F09
status: idea
personas: [admin, builder, analyst]
boards: [shell.operations]
---

# CP-70 · See what the deployment is doing from the header

**As** an Admin **I want** one glance from any screen at what runs, what waits, whether the workers keep up and where
this month's tokens stand against the budget **so that** I see trouble before anyone tells me, without leaving my work.

Tasks: [task.md](task.md) · Feature: [CP-F09](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Open the Operations dropdown on the deployment: every tile and every run going; *Stop* a run as [CP-58](../../../CP-F10-runs-and-how-the-agents-are-doing/stories/CP-58-stop-a-run-that-should-not-go-on/story.md) allows; follow its links | — |
| Operator | Operator · Modeller: open it on their own runs; *Stop* their own runs; follow *Agents › Runs* | The Queue, Workers and Tokens tiles, other people's runs and the *Workers* link are absent, not empty |

## Flow

```mermaid
flowchart TD
  h([The header ● n running · or the footer's]) --> d["Operations dropdown · about 720 px"]
  f([Nothing runs]) --> idle["● Idle · grey dot · keeps its place"] --> d
  d -->|loading| ld["Tiles and Running now drawn at once · fill in place"]
  d -->|could not load| fl["What could not be read · Try again"]
  d -->|Admin| t["Tiles: Running and queued · Queue waiting and oldest · Workers busy of total and lost · Tokens this month against the budget"]
  t --> run["Running now · agent · who is behind it · step progress · Stop"]
  run -->|Stop| st(["CP-58 · Stop the run"])
  run -->|Agents › Runs| ar(["The large modal at Agents › Runs (CP-50)"])
  t -->|Workers| so(["The large modal at Workers"])
  d -->|Operator| op["Running · my runs now · step progress · Stop"]
  op -->|Agents › Runs| ar
  d -->|nothing ran yet| e["Nothing has run yet · what starts a run"]
  d -->|outside click · Esc| x(["Closed · nothing moves"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-70.1 | Runs going | the header is read | it reads *● n running*, the engine's count, live; the footer reads the same |
| CP-70.2 | Nothing running | the header is read | it reads *Idle* with a grey dot and keeps its place |
| CP-70.3 | Any screen | the person clicks *● n running* in the header or the footer | the Operations dropdown opens anchored to it, about 720 px wide, no scrim; outside click or Esc closes it |
| CP-70.4 | An Admin | the dropdown opens | four tiles read *Running* with how many are queued · *Queue* — waiting, and how long the oldest has waited · *Workers* — busy of total, and how many are lost · *Tokens this month* against the deployment's budget — each as the engine counted it |
| CP-70.5 | Runs going | *Running now* is read | each run with its agent, the person behind it, its step progress — step *n of m* — and *Stop* where the reader may stop it |
| CP-70.6 | A run in *Running now* | the reader presses *Stop* | it stops as CP-58 says; the run leaves the list and the tiles move |
| CP-70.7 | No monthly budget set | the *Tokens this month* tile is read | it reads the month's tokens and *No limit* |
| CP-70.8 | The dropdown | the reader follows *Agents › Runs*, or an Admin follows *Workers* | the large modal opens at Agents › Runs (CP-50) or at Workers; Operations is never a summoner of its own |
| CP-70.9 | The dropdown | an Admin looks for agents against their budgets, workers by group, AI models, graph databases or alerts | none is in the dropdown; each is read in the large modal — Workers, Agents, Settings › Connections — and the dropdown stays a quick overview |
| CP-70.10 | The dropdown | an Admin wants to add workers, change a limit, tune an alert or drain a worker | none is offered in place; *Workers* opens the large modal, where the act is taken — *Stop* on a run is the dropdown's one act |
| CP-70.11 | An Operator | the dropdown opens | it reads *Running* and *Running now* for their own runs only; the Queue, Workers and Tokens tiles and the *Workers* link are absent |
| CP-70.12 | Any figure | it is read | it is a count or tokens — never currency |
| CP-70.13 | Runs start and end while it is open | it is read | the figures move in place, at most once a second |
| CP-70.14 | The read fails | the dropdown opens | it says what could not be read, in the engine's words, with *Try again* |
| CP-70.15 | A run the reader may not read | it is listed for an Admin | its agent, the person behind it and its step progress read; its content stays withheld (AC-31) |
| CP-70.16 | Nothing has ever run | the dropdown opens | the tiles read their counts, and *Running now* says nothing has run yet and that a question, a task or a schedule starts a run |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| *● n running* | Admin | shell.operations · Idle | — | — | shell.operations | — | shell.operations | — |
| *● n running* | Operator | shell.operations · Idle | — | — | shell.operations · Operator | — | shell.operations · Operator | — |
| The Operations dropdown | Admin | shell.operations · Nothing ran yet | — | shell.operations · Loading | shell.operations | shell.operations · Could not load | shell.operations · Stop | — |
| The Operations dropdown | Operator | shell.operations · Operator · Nothing ran yet | — | shell.operations · Loading | shell.operations · Operator | shell.operations · Could not load | shell.operations · Operator | shell.operations · Operator |
