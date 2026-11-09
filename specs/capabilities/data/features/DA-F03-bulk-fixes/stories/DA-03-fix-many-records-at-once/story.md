---
id: DA-03
title: Fix many records at once
feature: DA-F03
status: idea
personas: [curator]
boards: [data.fix]
---

# DA-03 · Fix many records at once

**As** a data curator **I want** to change one property across many records, previewed before it writes **so that** a fix is right for every record it touches, and recorded.

Tasks: [task.md](task.md) · Feature: [DA-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Preview and run a fix | — |
| Operator | Preview a fix | *Run* disabled — *Ask Priya (owner)*. *With Can work on projects: as Admin* |

## Flow

```mermaid
flowchart LR
  a([Picked records]) --> c[Set · clear · map one property] --> p[Preview before → after]
  p --> d{The person decides}
  d -->|Run| r{The model checks}
  r -->|written| ok([One run · in each record's History])
  r -->|refused| no[Refused · nothing written]
  d -->|no access| x["Ask Priya (owner)"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| DA-03.1 | Picked records and a change | the preview opens | each record shows before → after, and any the model would refuse are marked with why |
| DA-03.2 | A preview the model fully allows | the person runs it | it writes as one run and each record's History names it |
| DA-03.3 | A change the model refuses | the person runs it | nothing is written and the refusal names the constraint |
| DA-03.4 | A Gremlin database refusing part way | the fix runs | it says what was written and what was not, with *Try the rest* |
| DA-03.5 | An Operator without the grant | they reach *Run* | it is disabled with *Ask Priya (owner)* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A fix | Admin | data.fix · Nothing picked | data.fix · Nothing to change | data.fix · Building preview | data.fix | data.fix · Partly written | — | — |
| A fix | Operator | data.fix · Nothing picked | data.fix · Nothing to change | data.fix · Building preview | data.fix · Preview only | — | — | data.fix · Run disabled |
