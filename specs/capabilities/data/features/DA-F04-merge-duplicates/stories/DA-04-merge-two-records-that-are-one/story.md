---
id: DA-04
title: Merge two records that are one
feature: DA-F04
status: later
personas: [curator]
boards: [data.merge]
---

# DA-04 · Merge two records that are one

**As** a data curator **I want** to merge two records I know are the same thing, choosing which values survive **so that** the Graph says it once.

Tasks: [task.md](task.md) · Feature: [DA-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Compare and merge two records of one kind | — |
| Operator | Compare two records | *Merge* disabled — *Ask Priya (owner)*. *With Can work on projects: as Admin* |

## Flow

```mermaid
flowchart LR
  a([Two records]) --> s[Side by side · pick values] --> m{Merge}
  m -->|written| ok([One record · History names both keys])
  m -->|refused| no[Refused · nothing written]
  m -->|no access| x["Ask Priya (owner)"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| DA-04.1 | Two records of one kind | they are compared | their values show side by side with the survivor's picked |
| DA-04.2 | A merge the model allows | it runs | one record remains with the picked values and every relationship of both |
| DA-04.3 | A merged record | its History opens | it names the merge, who ran it and the other record's key |
| DA-04.4 | Two records of different kinds | a merge is asked for | it is refused before anything is written |
| DA-04.5 | An Operator without the grant | they reach *Merge* | it is disabled with *Ask Priya (owner)* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Merge | Admin | data.merge · Pick two | — | data.merge · Loading | data.merge | data.merge · Refused | — | — |
| Merge | Operator | data.merge · Pick two | — | data.merge · Loading | data.merge · Compare only | — | — | data.merge · Merge disabled |
