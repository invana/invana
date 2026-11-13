---
id: J02
title: Ask and trust the answer
personas: [analyst]
stories: [EX-01, EX-23, EX-02, EX-03, EX-25, EX-04, RC-05, RC-06, EX-26, EX-05, EX-06, EX-24, EX-15, EX-12, AG-50]
boards: [explore.ask, explore.board, explore.board.chart, explore.board.why, data.record, explore.board.cannot, explore.share]
---

# Ask and trust the answer

> **Tom**, an analyst, asks the Graph a question in plain words and needs an answer he can defend — or to be told
> plainly that the Graph cannot answer it.

## The journey

```mermaid
flowchart TD
  A([Explore]) --> C["EX-01 · Ask in plain words, through the Assistant"]
  C --> D{"Is the question clear?"}
  D -->|no| E["EX-23 · Asked back: orders or order lines? · a recommendation"] --> C
  D -->|yes| F["EX-02 · A typed plan runs one step per graph database · the answer arrives on the board"]
  F --> G["EX-03 · EX-25 · In the shape that fits, and in words"]
  G --> H["EX-04 · Why? · How it got here: words, plan, query per graph database, records, load"]
  H --> I{"Tom decides"}
  I -->|an assumption is wrong| J["EX-24 · Challenge it · ask with an approach"] --> F
  I -->|a cited record looks wrong| R["RC-05 · RC-06 · Open the record: what wrote it, every change to it"]
  R -->|a run he may not read| R1["Named, not opened"] --> I
  R --> I
  I -->|it holds| K{"What next"}
  K -->|share it| L(["EX-15 · A link that opens the answer"])
  K -->|work on it| M(["EX-12 · Add it to a project"])
  F -->|the Graph lacks a fact, and the agent's Access Policies allow Run on an outside tool| X["EX-26 · Filled from beyond the Graph · marked Third-party with its source"] --> G
  F -->|the Graph cannot answer| N["EX-05 · Says what is missing and who can add it"]
  F -->|a typed plan cannot express it| NP["EX-05 · Says so · offers a function, never a raw query"]
  F -->|refused or failed| O["EX-06 · Says why, names who can help, the act that asks them"]
  N --> P(["Ask a Modeller · or ask again"])
  NP --> P
  O --> P
  L --> Q(["AG-50 · The next run builds on this one, cited"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Ask in plain words | Evidence · Ask a question | EX-01 | `explore.ask` |
| 2 | Answer a question asked back, when his was unclear | Evidence · Ask a question | EX-23 | `explore.board` |
| 3 | Watch the answer arrive on the board | Evidence · The answer | EX-02 | `explore.board` |
| 4 | Read it in the shape that fits, and in words | Evidence · The answer | EX-03 · EX-25 | `explore.board.chart` |
| 5 | Open *Why?* on a citation | Evidence · The answer | EX-04 | `explore.board.why` |
| 5a | When a cited record looks wrong: open it — what wrote it, and every change to it | Intelligence · Records by kind · Provenance | RC-05 · RC-06 | `data.record` |
| 6 | Share it, or add it to a project | Evidence · Board · Share · Projects | EX-15 · EX-12 | `explore.share` |
| 7 | Ask again later; the run recalls the last, cited | Agents · Thinking graph and memory | AG-50 | `explore.board` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | The agent's Access Policies narrow what it may read; the answer says so, and the act asks a named approver | EX-06 | `explore.board.cannot` |
| It fails | A failed run says why in a sentence, with the act that tries again | EX-06 | `explore.board.cannot` |
| The person has no access | Tom asks and reads as an Operator; acts beyond it name the role they need | EX-06 | `explore.board.cannot` |
| The Graph cannot answer | It says what is missing — never an invented answer | EX-05 | `explore.board.cannot` |
| A typed plan cannot express the question | The agent says so and offers a function that could; it never runs a raw query unseen | EX-05 | `explore.board.cannot` |
| A graph database the plan needs is switched off | Refused before it starts, naming the graph database and who switched it off | EX-06 | `explore.board.cannot` |
| The Graph lacks a fact, and the agent's Access Policies allow Run on an outside tool (`tool/web/*`) | The agent fills it from the web or the model's own knowledge, each claim marked *Third-party ·* its source; a refused source is skipped and named | EX-26 | `explore.board` |
| An assumption is wrong | *Challenge this* asks again with Tom's approach | EX-24 | `explore.board.why` |
| He asks *what if* | A simulation answers as evidence marked *Predicted*, never mixed with what the records hold | EX-33 | `explore.board` |
| A cited record's run is one he may not read | The record's lineage names the run, without opening it; a change by a user he cannot see reads *a user you cannot see* | RC-05 · RC-06 | `data.record` |

## Done when

- Tom has an answer on the board whose every claim opens its plan, its query to each graph database, its records and the load they came from — or a plain *cannot answer* naming what is missing and who can add it.
