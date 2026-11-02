---
id: EX-25
title: The answer in words
feature: EX-F04
status: idea
personas: [analyst, decision-maker]
boards: [explore.board, explore.board.why]
---

# EX-25 · The answer in words

**As** an analyst asking *tell me a fun fact about the longest airport* **I want** to be told — *Qamdo Bangda in China
has the longest runway in your graph: 18,045 ft* — with every claim cited to its record **so that** I get an answer,
not a table I have to read one from.

Tasks: [task.md](task.md) · Feature: [EX-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read the words, open a citation | — |
| Operator | The same — every member | — |

## Flow

```mermaid
flowchart LR
  v([The records read]) --> r{Any rows?}
  r -->|none| e(["The Graph does not hold this · no words"])
  r -->|yes| x{May the values leave?}
  x -->|no| rec["The records alone · the step says why"]
  x -->|yes| w["Writing the answer… · up to 50 rows"]
  w --> c{Each claim cites?}
  c -->|no| drop["Dropped · counted"]
  c -->|yes| keep["Kept"]
  drop --> left{Any claim left?}
  keep --> left
  left -->|no| rec
  left -->|yes| out(["1–3 sentences first · then the records"])
  w -->|model error| rec
  out -->|click a citation| hl["The cited rows highlighted below"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-25.1 | An answer with rows | it settles | one to three sentences in the agent's voice come first, and the records they cite follow |
| EX-25.2 | The words being written | the person watches | the records paint as soon as they are read, with *Writing the answer…* above them |
| EX-25.3 | A sentence | the person clicks its citation | the records it rests on are scrolled to and highlighted in the part below |
| EX-25.4 | A claim with no record behind it | the words are written | it is dropped before they ship, and the step counts what it dropped |
| EX-25.5 | Every claim dropped | the answer settles | the records stand alone and the step says *0 of 3 claims could be cited* |
| EX-25.6 | Zero rows | the answer settles | no words are attempted; it says the Graph does not hold this |
| EX-25.7 | A view of the graph that does not send record values to an AI model | the answer settles | the records stand alone, and the step says *Answer skipped — this view does not send record values to a model* |
| EX-25.8 | More than 50 rows | the words are written | they are written from the first 50 and say they spoke from a sample |
| EX-25.9 | The model fails or times out | the words are written | the records stand as the answer; the Answer step is marked failed and the run is still answered |
| EX-25.10 | A view of the graph that allows third-party sources | a claim comes from beyond the Graph | it is marked *Third-party* with its source |
| EX-25.11 | An answer with words | the person opens *How it got here* | the Answer step shows what it was given and the claims it kept and dropped |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| The words | Admin | — | explore.board · Nothing held | explore.board · Writing the answer | explore.board | explore.board · Records only | explore.board · Writing the answer | — |
| The words | Operator | — | explore.board · Nothing held | explore.board · Writing the answer | explore.board | explore.board · Records only | explore.board · Writing the answer | — |
| A citation | Admin | — | — | — | explore.board.why | — | — | — |
| A citation | Operator | — | — | — | explore.board.why | — | — | — |
