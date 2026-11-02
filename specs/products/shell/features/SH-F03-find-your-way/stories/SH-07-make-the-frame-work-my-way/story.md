---
id: SH-07
title: Make the frame work my way
feature: SH-F03
status: idea
personas: [analyst]
boards: [explore.board, explore.board.left_closed, settings.me]
---

# SH-07 · Make the frame work my way

**As** an analyst who works in Invana all day **I want** to close the assistant, collapse the sidebar and pick light or
dark, and find them as I left them **so that** the product is comfortable, not merely functional.

Tasks: [task.md](task.md) · Feature: [SH-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Close and reopen the assistant, collapse the sidebar, pick light, dark or the system's | — |
| Operator | The same, for themselves | — |

## Flow

```mermaid
flowchart LR
  w([The work]) --> a["Assistant in the header"] -->|close| ac["Main widens · reopened from the header"]
  w --> s["⌘B · the toggle · the active mode"] --> sc["Sidebar collapsed · the toggle leads the tab row"]
  w --> t["Settings › You · theme"] --> tc{"Light · dark · the system's"}
  tc --> all(["Every surface switches together, the canvas included · kept for me"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SH-07.1 | The assistant open | the person closes it | main widens; the header's Assistant reopens it |
| SH-07.2 | The assistant closed | the person signs in again | it stays closed |
| SH-07.3 | A mode's sidebar | the person presses ⌘B, the toggle, or the active mode | it collapses, and the toggle leads main's tab row |
| SH-07.4 | No choice made | Invana opens | it follows the system's light or dark, applied before the first paint |
| SH-07.5 | A theme picked in Settings › You | the person switches | every surface switches together, the canvas included, with no flash |
| SH-07.6 | A theme picked | the person signs in elsewhere | it follows them |
| SH-07.7 | Dark | a board is printed or exported | it uses light |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The frame | Admin | explore.board | — | — | explore.board.left_closed | — | — | — |
| The frame | Operator | explore.board | — | — | explore.board.left_closed | — | — | — |
| Theme in Settings › You | Admin | settings.me | — | settings.me · Loading | settings.me · Theme | settings.me · Could not save | — | — |
| Theme in Settings › You | Operator | settings.me | — | settings.me · Loading | settings.me · Theme | settings.me · Could not save | — | — |
