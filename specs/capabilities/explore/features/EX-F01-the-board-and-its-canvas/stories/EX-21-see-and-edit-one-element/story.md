---
id: EX-21
title: See and edit one element
feature: EX-F01
status: idea
personas: [analyst]
boards: [explore.board.menu, explore.board.edit]
---

# EX-21 · See and edit one element

**As** an analyst **I want** to see one node, relationship or group, and edit it with only the keys its kind has in
the model **so that** what I add matches the model, so it can be saved and asked about.

Tasks: [task.md](task.md) · Feature: [EX-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read any element on a board they open; in Edit, change it, add one, and apply the change to the board; save it (EX-20) | — |
| Operator | Read any element; in Edit, change, add and apply on the board — an edit stays on the board until saved; a Modeller also saves it (EX-20) | Saving to a graph database: *Save n changes* disabled — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart LR
  a([Click an element]) --> v["Element panel · its view · its graph database · Focus · Edit"]
  a -->|five picked| l["A list to pick one from"] --> v
  v -->|Edit mode · Edit| f["The form: Kind · Label · Properties"]
  n([Draw a node or a relationship]) --> t["New node · its kind asked first"] --> f
  f -->|a key the model lacks| r["Refused — names who can add it"]
  f -->|the same key twice| d["Refused at the row · Apply waits"]
  f -->|no published model| m["Publish a model to edit the data · Open Model"]
  f -->|Apply| u(["Marked unsaved on the board"])
  f -->|Cancel| v
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-21.1 | A drawn board | the person clicks a node | the Element panel opens on that node: swatch, name, kind, the graph database it is in, the id with copy, its properties, its relationships by direction and kind, and its group |
| EX-21.2 | A relationship clicked | the panel opens | it shows the relationship's properties and its two ends, From and To, each framing its node when clicked |
| EX-21.3 | Five elements selected | the person opens the panel | it lists the five to pick one from; it never shows more than one element at a time |
| EX-21.4 | A node open in Edit mode | the person picks *Edit* | the view is replaced in place by the form — Kind, Label, Properties, then Cancel · Apply |
| EX-21.5 | The form open | the person picks *Add property* | only the keys of the node's kind not yet set are offered; each value's placeholder is the key's type (text · number · date) |
| EX-21.6 | The form open | the person types a key the model does not have | it is refused, naming who can add it — a Modeller, in Model |
| EX-21.7 | The form open | the person adds a key a second time | the second row is refused and Apply waits until it is fixed |
| EX-21.8 | The form open | the person changes the kind | the new kind's keys become the rows; keys the new kind lacks are struck through and dropped on Apply |
| EX-21.9 | Edit mode | the person draws a node or a relationship | it opens as *New node* or *New relationship*, its kind asked first; Cancel takes it off the board |
| EX-21.10 | A deployment with no published model | the person opens the form | it says *Publish a model to edit the data* with *Open Model* |
| EX-21.11 | An element whose kind or key is not in the model | its panel opens | the key stays, tagged *not in the model*; the kind can be changed to one the model has |
| EX-21.12 | An Operator | they apply an edit | it is marked on the board; *Save n changes* is disabled — *Needs the Modeller role — ask an Admin* |
| EX-21.13 | A relationship open in Edit mode | the person looks for its kind | the kind is fixed, with *To change it, delete it and draw it again* |
| EX-21.14 | A node open in the panel | it shows | where it came from shows under its properties — the load and the run that wrote it, each opening its page |
| EX-21.15 | A sensitive property on a node | its panel opens | the property shows with a *Sensitive* tag (SE-F03); the board reads it and sends it to no AI model |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Element panel · view | Admin | explore.board.menu · Nothing picked | — | explore.board.menu · Loading | explore.board.menu | — | — | — |
| Element panel · view | Operator | explore.board.menu · Nothing picked | — | explore.board.menu · Loading | explore.board.menu | — | — | — |
| Element panel · form | Admin | explore.board.edit · No model | — | explore.board.edit · Loading the model | explore.board.edit | explore.board.edit · Refused | — | — |
| Element panel · form | Operator | explore.board.edit · No model | — | explore.board.edit · Loading the model | explore.board.edit | explore.board.edit · Refused | — | explore.board.edit · No access |
