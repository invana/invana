---
id: J02
title: Ask and trust the answer
personas: [analyst]
stories: [GR-01, EX-01, EX-23, EX-02, EX-03, EX-25, EX-04, RC-05, RC-06, EX-26, EX-05, EX-06, EX-24, EX-15, EX-12, EX-30]
boards: [graphs.home, explore.ask, explore.board, explore.board.chart, explore.board.why, data.record, explore.board.cannot, explore.share]
---

# Ask and trust the answer

> **Tom**, an analyst, asks his Graph a question in plain words and needs an answer he can defend — or to be told
> plainly that the Graph cannot answer it.

## The journey

```mermaid
flowchart TD
  A([Home]) --> B["GR-01 · Open the Graph"]
  B --> C["EX-01 · Ask in plain words"]
  C --> D{"Is the question clear?"}
  D -->|no| E["EX-23 · Asked back: seats or flights? · a recommendation"] --> C
  D -->|yes| F["EX-02 · The answer arrives on the board, step by step"]
  F --> G["EX-03 · EX-25 · In the shape that fits, and in words"]
  G --> H["EX-04 · Why? · How it got here: words, query, records, load"]
  H --> I{"Tom decides"}
  I -->|an assumption is wrong| J["EX-24 · Challenge it · ask with an approach"] --> F
  I -->|a cited record looks wrong| R["RC-05 · RC-06 · Open the record: what wrote it, every change to it"]
  R -->|a run he may not read| R1["Named, not opened"] --> I
  R --> I
  I -->|it holds| K{"What next"}
  K -->|share it| L(["EX-15 · A link that opens the answer"])
  K -->|work on it| M(["EX-12 · Add it to a project"])
  F -->|the Graph lacks a fact, and its view allows outside sources| X["EX-26 · Filled from beyond the Graph · marked Third-party with its source"] --> G
  F -->|the Graph cannot answer| N["EX-05 · Says what is missing and who can add it"]
  F -->|refused or failed| O["EX-06 · Says why, names who can help, the act that asks them"]
  N --> P(["Ask the owner · or ask again"])
  O --> P
  L --> Q(["EX-30 · The next run builds on this one, cited"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Open the Graph | Graph · Home | GR-01 | `graphs.home` |
| 2 | Ask in plain words | Explore · empty board | EX-01 | `explore.ask` |
| 3 | Answer a question asked back, when his was unclear | Explore · the assistant | EX-23 | `explore.board` |
| 4 | Watch the answer arrive on the board | Explore · board | EX-02 | `explore.board` |
| 5 | Read it in the shape that fits, and in words | Explore · board | EX-03 · EX-25 | `explore.board.chart` |
| 6 | Open *Why?* on a citation | Explore · peek | EX-04 | `explore.board.why` |
| 6a | When a cited record looks wrong: open it — what wrote it, and every change to it | Data · a record | RC-05 · RC-06 | `data.record` |
| 7 | Share it, or add it to a project | Explore | EX-15 · EX-12 | `explore.share` |
| 8 | Ask again later; the run recalls the last, cited | Explore | EX-30 | `explore.board` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | A view of the graph narrows what the agent may see; the answer says so, and the act asks its owner | EX-06 | `explore.board.cannot` |
| It fails | A failed run says why in a sentence, with the act that tries again | EX-06 | `explore.board.cannot` |
| The person has no access | Tom asks and reads as an Operator; acts beyond it name who can | EX-06 | `explore.board.cannot` |
| The Graph cannot answer | It says what is missing — never an invented answer | EX-05 | `explore.board.cannot` |
| The Graph lacks a fact, and its view of the graph allows outside sources | The agent fills it from the web or the model's own knowledge, each claim marked *Third-party ·* its source; a refused source is skipped and named | EX-26 | `explore.board` |
| An assumption is wrong | *Challenge this* asks again with Tom's approach | EX-24 | `explore.board.why` |
| A cited record's run is one he may not read | The record's lineage names the run, without opening it; a change by a member he cannot see reads *a member you cannot see* | RC-05 · RC-06 | `data.record` |

## Done when

- Tom has an answer on the board whose every claim opens its query, records and the load they came from — or a plain *cannot answer* naming what is missing and who can add it.
