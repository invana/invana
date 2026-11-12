---
id: SE-02
title: Open a model and a kind
feature: SE-F06
status: idea
personas: [modeller]
boards: [model.board, model.board.kind]
---

# SE-02 · Open a model and a kind

**As** a modeller **I want** to go from the map into one model and one kind **so that** I read any part of the model
in detail — its properties, records, key and constraints.

Tasks: [task.md](task.md) · Feature: [SE-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Open a model and a kind, and from a kind change it in a draft; rename a model and change its description | — |
| Operator | Open a model and a kind and read them | *Change in a draft* and *Rename* disabled — *Ask Priya (owner) to shape the model*. With *Can shape the model*: as Admin |

## Flow

```mermaid
flowchart LR
  a([The map, or the left section]) -->|a kind| p["Its peek · properties, Must be, records"]
  p -->|Esc| a
  p -->|Open kind| k["The kind's page · Properties · Indexes · Constraints · Mappings"]
  p -->|Change in a draft| d(["The draft — SE-05"])
  a -->|a model| m["The model · its kinds, relationships, links"]
  m -->|breadcrumb| a
  k -->|Mappings · Map to a standard| ms(["Staged in the draft — SE-05"])
  k -->|no Can shape the model| na["Reads · Ask Priya (owner) to shape the model"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SE-02.1 | The map | the person clicks a kind, or picks it in the left section | a peek opens beside it: the kind, its model and record count, its description, and each property with its type and *Must be*; the left section marks it and the footer reads *<kind> selected · Esc to close* |
| SE-02.2 | A kind's peek | the person picks *Open <kind>* | the kind opens as a page of its model, breadcrumb `Model › <model> › <kind>`, with its records and key and tabs Properties · Indexes · Constraints · Mappings, each with its count |
| SE-02.3 | A model in the left section | the person picks it | the model opens with its kinds of node, its relationships and the links touching it from either side, each with its count; an empty list says what would go there |
| SE-02.4 | A kind's peek with constraints that records break | it shows | it names how many records break each, and whether new ones are rejected |
| SE-02.5 | A kind | the person presses Esc or picks the breadcrumb | they are back on the map as they left it |
| SE-02.6 | A model with a draft | its kind opens | the page shows the draft's chip and, with *Can shape the model*, *Add property* |
| SE-02.7 | An Operator without *Can shape the model* | they open a kind | it reads; *Change in a draft* is disabled with *Ask Priya (owner) to shape the model* |
| SE-02.8 | A model's head and a person with *Can shape the model* | they rename it or change its description | It saves at once, outside the draft — a name and a description are not part of a version — and History names who changed it |
| SE-02.9 | A kind's Mappings and a person with *Can shape the model* | they pick *Map to a standard* and a property, a standard and a term or value | the mapping — same as · broader · narrower — is staged on the model's draft and publishes with it |
| SE-02.10 | A kind's Mappings | it opens | each mapping lists its property, the standard's term or value and version, and who declared it; an Operator without *Can shape the model* reads them with *Map to a standard* absent |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A kind | Admin | model.board.kind · No properties | — | model.board.kind · Loading | model.board.kind | model.board.kind · Could not load | — | — |
| A kind | Operator | model.board.kind · No properties | — | model.board.kind · Loading | model.board.kind · Read only | model.board.kind · Could not load | — | model.board.kind · Read only |
| A model | Admin | model.board · Model with nothing yet | — | model.board · Loading | model.board · One model | model.board · Could not load | — | — |
| A model | Operator | model.board · Model with nothing yet | — | model.board · Loading | model.board · One model | model.board · Could not load | — | model.board · Read only |
