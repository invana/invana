---
id: SE-22
title: Derive facts from a rule
feature: SE-F08
status: idea
personas: [modeller, analyst]
boards: [model.inference, model.rules]
---

# SE-22 · Derive facts from a rule

**As** a modeller **I want** to write a derivation — when these facts hold, this one does too — and have it run in
the background, each derived fact kept with its rule and premises **so that** people and agents can ask about what
follows from the records, and see why each derived fact is there.

Tasks: [task.md](task.md) · Feature: [SE-F08](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read derivations and derived facts; create, change, stop or run a derivation; turn on write-back | — |
| Operator | Read derivations and the derived facts whose premises they may read | *New rule · A derivation*, *Run again* and *Stop* absent — *Ask Priya (owner) to shape the model*. With *Can shape the model*: as Admin, but write-back stays an Admin's |

## Flow

```mermaid
flowchart LR
  a([Rules · New rule · A derivation]) --> c{Can shape the model?}
  c -->|no| na["Ask Priya (owner) to shape the model"]
  c -->|yes| d["When … then … · scope · write back"]
  d -->|not a supported form| x["Refused, naming what is not supported"]
  d -->|Preview| p["Would derive n facts now"]
  p -->|Save rule| q["Queued run"]
  q -->|failed| f["Its reason · Run again"]
  q --> r(["Derived facts, labelled derived"])
  r -->|open one| h(["How it got here: the rule and each premise"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SE-22.1 | No derivation | Derivations opens | it reads *No derivations yet*, with *New rule · A derivation* for someone who can shape the model |
| SE-22.2 | Someone who can shape the model | they write a derivation in a supported form and pick *Preview* | the engine counts what it would derive now, before anything is saved |
| SE-22.3 | A derivation outside the supported forms | it is saved | it is refused, naming what is not supported, and nothing is saved |
| SE-22.4 | A saved derivation | it is saved | an inference run is queued on a worker, and the derivation shows it running |
| SE-22.5 | A run that ends | Derivations opens | the derivation shows its last run and the facts derived and withdrawn, counted by the engine |
| SE-22.6 | A derived fact | someone opens it | it is labelled *derived*, and *How it got here* shows its rule version and each premise, each opening its own provenance |
| SE-22.7 | A load or a change that removes a premise | the next run ends | the facts that rested on it are withdrawn |
| SE-22.8 | A derivation with write-back off | it runs | nothing is written to the graph database |
| SE-22.9 | An Admin | they turn on write-back for a derivation | its facts are also written to the graph database, marked derived, and removed when withdrawn |
| SE-22.10 | Someone who is not an Admin | they open a derivation | write-back reads; turning it on is absent with *Ask an Admin* |
| SE-22.11 | A run that fails or passes the Graph's limit | it stops | the derivation names the reason, with *Run again* |
| SE-22.12 | An Operator without *Can shape the model* | they open Derivations | the list and derived facts read; the acts are absent with *Ask Priya (owner) to shape the model* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Derivations | Admin | model.inference · No derivations | model.inference · No match | model.inference · Loading | model.inference | model.inference · Run failed | model.inference · Running | — |
| Derivations | Operator | model.inference · No derivations | model.inference · No match | model.inference · Loading | model.inference · Read only | model.inference · Run failed | model.inference · Running | model.inference · Read only |
| A derivation | Admin | model.rules · New derivation | — | model.inference · Counting | model.inference · Derivation | model.rules · Derivation refused | model.inference · Running | — |
| A derivation | Operator | — | — | model.inference · Counting | model.inference · Derivation read only | model.inference · Could not load | model.inference · Running | model.inference · Derivation read only |
| A derived fact | Admin | — | — | model.inference · Loading | model.inference · Derived fact | model.inference · Could not load | — | — |
| A derived fact | Operator | — | — | model.inference · Loading | model.inference · Derived fact | model.inference · Could not load | — | model.inference · Not readable |
