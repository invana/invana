---
id: DA-07
title: Find and manage the Graph's annotations
feature: DA-F07
status: idea
personas: [analyst, curator]
boards: [data.annotations]
---

# DA-07 · Find and manage the Graph's annotations

**As** an analyst **I want** every annotation in the Graph in one place, found by record, author or kind **so that** I see what others found and clear what does not hold any more.

Tasks: [task.md](task.md) · Feature: [DA-F07](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every annotation; edit or delete any, with a reason kept | — |
| Operator | Read every annotation; edit or delete their own | Off on others' — *Only Priya Nair can change it* |

## Flow

```mermaid
flowchart LR
  a([Data › Annotations]) --> l[Every annotation · filter]
  l -->|open| b([Its records on a board])
  l -->|edit or delete| d{Its author?}
  d -->|yes| ok([Changed · in History])
  d -->|no| x[Only Priya Nair can change it]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| DA-07.1 | Annotations made on boards | *Annotations* opens | every annotation shows with its text, records, author and when, newest first |
| DA-07.2 | A filter by author | it matches nothing | *Nothing matches* names the filter, with *Clear* |
| DA-07.3 | An annotation | it is opened | its records open on a board with it shown |
| DA-07.4 | Their own annotation | the author edits it | it changes and History names the change |
| DA-07.5 | Someone else's annotation | an Operator tries to delete it | it is off, reading *Only Priya Nair can change it* |
| DA-07.6 | An annotation whose record was deleted | the list opens | it reads *its record was deleted*, with what it said |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Annotations | Admin | data.annotations · Nothing annotated | data.annotations · Nothing matches | data.annotations · Loading | data.annotations | data.annotations · Could not load | — | — |
| Annotations | Operator | data.annotations · Nothing annotated | data.annotations · Nothing matches | data.annotations · Loading | data.annotations | data.annotations · Could not load | — | data.annotations · Not the author |
