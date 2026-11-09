---
id: SH-06
title: Do, open or ask anything from ⌘K
feature: SH-F03
status: idea
personas: [analyst, builder, modeller]
boards: [shell.command]
---

# SH-06 · Do, open or ask anything from ⌘K

**As** an analyst **I want** ⌘K to jump to any board, model, agent, skill, project, task or run, run an act, or ask the
assistant **so that** I reach anything without the nav — and never see what I may not open.

Tasks: [task.md](task.md) · Feature: [SH-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Find every record they may open, run any act, ask the assistant | — |
| Operator | Find every record they may open, run the acts their grants allow, ask the assistant | A record they may not open is never a hit; an act they lack is listed disabled, naming the role |

## Flow

```mermaid
flowchart TD
  k([⌘K]) --> e{"Typed?"}
  e -->|nothing| r["The open mode's sections and acts · recent records"]
  e -->|text| m["Exact · prefix · contains, grouped by where it lives"]
  m -->|a hit| o(["It opens — its address, or its section"])
  m -->|an act| a{"Their grant?"}
  a -->|yes| run(["The act runs, or its modal opens"])
  a -->|no| dis["Disabled · the role it needs"]
  m -->|nothing| none["Nothing found"]
  m --> ask["Ask the assistant — last"]
  none --> ask
  ask --> comp(["The text in the composer, focused · never sent"])
  m -->|a list could not be read| gf["That group says so · the rest match"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SH-06.1 | A Graph open, nothing typed | ⌘K opens | it lists the open mode's sections and acts, and recent records |
| SH-06.2 | Text typed on a Graph | ⌘K matches | boards and conversations, models and kinds, views, agents, skills, projects and tasks, the last runs and the Graphs the person can open — grouped by where each lives, exact then prefix then contains |
| SH-06.3 | A private project the person is not on | they search its name | it is never a hit |
| SH-06.4 | A Graph the person is not a member of | they search its name | it is never a hit |
| SH-06.5 | A hit with no address of its own | the person picks it | its section opens with it selected |
| SH-06.6 | Conversations and runs with one title | they are listed | each carries its age beside its kind |
| SH-06.7 | An act the person's grants allow | they pick it | it runs, or its modal opens |
| SH-06.8 | An act the person lacks | it is listed | it is disabled, naming the role it needs |
| SH-06.9 | Text typed on a Graph | the list draws | *Ask the assistant* is the last entry; picking it puts the text in the composer and focuses it, never sending |
| SH-06.10 | Nothing matches | the list draws | it says *Nothing found*, with *Ask the assistant* |
| SH-06.11 | A list ⌘K could not read | it matches | that group says it could not be read; the others still match |
| SH-06.12 | Off a Graph | ⌘K opens | it lists the Graphs the person can open and Settings; *Ask the assistant* is absent |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| ⌘K | Admin | shell.command · Nothing typed | shell.command · Nothing found | shell.command · Loading | shell.command | shell.command · A group failed | — | — |
| ⌘K | Operator | shell.command · Nothing typed | shell.command · Nothing found | shell.command · Loading | shell.command | shell.command · A group failed | — | shell.command · Act disabled |
