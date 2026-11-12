---
id: EX-07
title: Keep a board
feature: EX-F01
status: idea
personas: [analyst]
boards: [explore.ask, explore.board, explore.share]
---

# EX-07 · Keep a board

**As** an analyst **I want** my board kept — named, saved as I go, with its history — and the question scheduled when
it should keep running **so that** I resume tomorrow rather than reconstruct, and a good question keeps working.

Tasks: [task.md](task.md) · Feature: [EX-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Create, rename, delete and restore boards; schedule the question | — |
| Operator | Create, rename, delete and restore boards | *Schedule this* disabled — *Ask Priya (owner)*. With *Can work on projects*: as Admin |

## Flow

```mermaid
flowchart LR
  a([First answer]) --> b["A board, named after the question · autosaved"]
  b --> c["Close the tab"] --> o["Reopen from the boards on the left"]
  o --> r["What was drawn · layout · styling, as left"]
  r -->|went wrong| h["History · restore"] --> v(["A new version · the old ones kept"])
  b -->|Schedule this| s{Can work on projects?}
  s -->|no| n["Disabled — Ask Priya (owner)"]
  s -->|yes| d["The schedule, filled with the question"] --> t(["Toast · opens it in Agents › Schedules"])
  b -->|Delete| x["Confirms, naming how many versions go with it"]
  b -->|Save a version| m(["A named version · the last 30 kept"])
  b -->|Rename| rn(["The new name on the left"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-07.1 | A conversation with no board | its first answer draws | a board is made, named after the question, and listed on the left |
| EX-07.2 | A board being worked on | the person draws, lays out or styles | it is saved without a save button, and each meaningful change is a version saying what changed |
| EX-07.3 | A board closed yesterday | the person reopens it | what was drawn, its layout and its styling are as they were left, and the graph is not asked again |
| EX-07.4 | A board's settings | a new answer draws | the layout, styling and visible types the board holds still apply |
| EX-07.5 | A board | the person deletes it | they are asked to confirm, told how many versions go with it |
| EX-07.6 | Two tabs on one board | both change it | both read the same saved state; the last write wins and is a version |
| EX-07.7 | A settled answer | a person with *Can work on projects* picks *Schedule this* | the schedule opens filled with the question; saving it confirms with a toast that opens it in Agents › Schedules |
| EX-07.8 | An Operator without *Can work on projects* | they reach *Schedule this* | it is disabled with *Ask Priya (owner)* |
| EX-07.9 | No board kept yet | Explore opens | the question box shows alone, with no list of kept boards invented under it |
| EX-07.10 | A board | the person picks *Rename* on its tab's menu | its name and what it is for change, and the list on the left shows the new name |
| EX-07.11 | A board worth marking | the person picks *Save a version* in History and names it | a version with that name is kept beside the autosaved ones |
| EX-07.12 | A board with 30 versions | a new version is saved | the oldest is let go, and History says *Keeps the last 30 versions* |
| EX-07.13 | A conversation that already has a board | it is opened from the left, a link or ⌘K | its one board opens; a second board is never made for it |
| EX-07.14 | Two boards open as tabs | the person switches between them | each keeps its camera, layout, selection and open panel |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Boards on the left | Admin | explore.ask | explore.board · No board matches | explore.board · Loading | explore.board | explore.board · Failed | — | — |
| Boards on the left | Operator | explore.ask | explore.board · No board matches | explore.board · Loading | explore.board | explore.board · Failed | — | — |
| History · Save a version · Rename | Admin | — | — | — | explore.board | explore.board · Failed | — | — |
| History · Save a version · Rename | Operator | — | — | — | explore.board | explore.board · Failed | — | — |
| Schedule this | Admin | — | — | — | explore.share · Schedule | explore.share · Failed | — | — |
| Schedule this | Operator | — | — | — | explore.share · Schedule | explore.share · Failed | — | explore.share · No access |
