---
id: J01
title: From an empty install to a first answer
personas: [owner, admin, modeller, curator]
stories: [SH-01, SH-19, SH-21, SH-25, SH-26, MO-04, MO-06, MO-15, SH-03, MO-05, DS-16, DS-11, DS-13, ST-28, EX-01, EX-02, EX-04]
boards: [start.signin, start.home, start.new_graph, start.new_graph.connect, start.new_graph.files, start.new_graph.shape, start.new_graph.invite, start.new_graph.ready, model.board.draft.publish, data.upload, settings.ai, explore.ask, explore.board, explore.board.why]
---

# From an empty install to a first answer

> **Priya**, a Graph owner, has a new install and a question she must decide; she wants her data to answer it, every
> claim citing its record, without an engineer.

## The journey

```mermaid
flowchart TD
  A([An Admin has installed Invana and made Priya's account]) --> B["SH-01 · Sign in"]
  B --> C["SH-19 · What are you trying to decide?"]
  C -->|Try a sample Graph| SG(["Explore in the sample Graph"])
  C -->|Create a graph| D["SH-21 · 1 · Name and question"]
  D --> E{"Where is the data?"}
  E -->|a graph database| F["SH-25 · Connect · test"]
  E -->|files, later| G["SH-26 · Drop files — later"]
  F -->|test fails| F1["The database's own words"] --> F
  F -->|holds records| H["MO-04 · The agent drafts the model from what is there"]
  F -->|empty| H2["MO-06 · MO-15 · A description, a starter or an ontology"]
  G -->|a column unclear| G1["Asked, not guessed"] --> G
  G --> H
  H --> I{"Priya decides"}
  H2 --> I
  I -->|change| H
  I -->|accept| J["SH-21 · Invite people and agents · Create graph"]
  J --> K["SH-03 · Ready · what is left before it answers"]
  K --> L["MO-05 · Review and publish the draft"]
  L --> M{"Records in the Graph?"}
  M -->|already there| N
  M -->|from files or a dataset, later| M1["DS-16 · DS-11 · Upload, publish, add to this graph — later"]
  M1 --> M2["DS-13 · Each import checked · rows that do not fit reported, not written"]
  M2 --> N{"An AI model answers?"}
  N -->|no, Priya is not an Admin| N1["Ask an Admin · ST-28"] --> N
  N -->|yes| O["EX-01 · Ask in plain words"]
  O --> P["EX-02 · The answer arrives on the board"]
  P --> Q(["EX-04 · How it got here: query, records, dataset"])
```

## Steps

| # | Step | Product · surface | Story | Board |
|---|---|---|---|---|
| 1 | Sign in | Shell · sign in | SH-01 | `start.signin` |
| 2 | Say what she is deciding; pick *Create a graph* | Shell · Home, first run | SH-19 | `start.home` |
| 3 | Name the Graph and its question; say where the data is | Shell · Create a graph | SH-21 | `start.new_graph` |
| 4a | Connect the graph database; the test says what is there | Shell · Create a graph | SH-25 | `start.new_graph.connect` |
| 4b | Later: or drop files; each says what it becomes | Shell · Create a graph | SH-26 | `start.new_graph.files` |
| 5 | The agent drafts the model; Priya accepts or changes it | Shell · Create a graph | MO-04 · MO-06 · MO-15 | `start.new_graph.shape` |
| 6 | Invite people and agents; create the Graph | Shell · Create a graph | SH-21 | `start.new_graph.invite` |
| 7 | Land on an empty board; see what is left | Shell · Ready | SH-03 | `start.new_graph.ready` |
| 8 | Review and publish the draft | Model | MO-05 | `model.board.draft.publish` |
| 9 | Later: bring records in, when the database had none | Datasets | DS-16 · DS-11 · DS-13 | `data.upload` |
| 10 | Ask the first question | Explore | EX-01 | `explore.ask` |
| 11 | Read the answer and how it got here | Explore | EX-02 · EX-04 | `explore.board` · `explore.board.why` |

## Branches

| When | What happens | Story | Board |
|---|---|---|---|
| It needs permission | An AI model is the install's: Priya, not an Admin, reads *Ask an Admin*; an Admin offers one in Settings › Invana | ST-28 | `settings.ai` |
| It fails | A failed test names the database's own error; rows that do not fit are reported, not written | SH-25 · DS-13 | `start.new_graph.connect` · `data.upload` |
| The person has no access | Inside Create a graph none — Priya is the Owner; a set-up step needing another role names who holds it | SH-03 | `start.new_graph.ready` |
| The database is empty | Drafting is offered disabled with its reason; a description, a starter or an ontology starts the model | SH-25 · MO-06 · MO-15 | `start.new_graph.shape` |
| She only wants to look | *Try a sample Graph* opens Explore in it | SH-19 | `start.home` |

## Done when

- Priya's Graph answers her first question on the board, and *How it got here* shows the query, the records and the dataset behind it.
- Set-up reads 4 of 4 and steps aside.
