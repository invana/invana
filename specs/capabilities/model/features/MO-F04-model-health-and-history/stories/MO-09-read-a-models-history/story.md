---
id: MO-09
title: Read a model's history
feature: MO-F04
status: idea
personas: [modeller]
boards: [model.health, model.board]
---

# MO-09 · Read a model's history

**As** a modeller **I want** a model's history — who changed what, why, and the effect after **so that** model
changes are auditable, and a change that hurt is found and undone.

Tasks: [task.md](task.md) · Feature: [MO-F04](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read every version's history, compare two versions, and restore an earlier one as a draft | — |
| Operator | Read every version's history and compare two versions | *Restore* disabled — *Ask Priya (owner) to shape the model*. With *Can shape the model*: as Admin |

## Flow

```mermaid
flowchart LR
  a([Health › History · or Versions]) --> h["version · when · by · what changed · why · effect after"]
  h -->|Compare vA and vB · a row's Compare| c(["The map's Comparing bar — MO-05"])
  h -->|a row's run| r(["How it got here — the publish and its review"])
  h -->|Restore| rs(["An earlier version as a new draft — MO-16"])
  h -->|only one version| one["The first version — everything added"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| MO-09.1 | A model with published versions | the person opens History, or *Versions* on a model | a row per version, newest first: version · when · by · what changed · why · effect after |
| MO-09.2 | A version that touched datasets loading the model | its row shows | effect after reads *1 dataset now warns · 6 rows* in the warning tone when any records fail, or *2 datasets hold* when none do — as stored when it published |
| MO-09.3 | A version that touched no dataset | its row shows | effect after reads the runs and tokens while it was published |
| MO-09.4 | A first version | its row shows | what changed reads every kind as added |
| MO-09.5 | History | the person picks *Compare vA and vB* or a row's *Compare* | the map opens with the Comparing bar on that pair |
| MO-09.6 | History at all models | it opens | every model's versions are listed newest first, with a model column |
| MO-09.7 | A version | the person opens *How it got here* from its row | it shows who published it, why, the review and its approver if it broke anything, and the runs that published it |
| MO-09.8 | A person with *Can shape the model* | they pick *Restore* on an earlier version | a new draft opens with that version's kinds, listing what returns and what goes (MO-16) |
| MO-09.9 | An Operator without *Can shape the model* | they open History | it reads; *Restore* is disabled with *Ask Priya (owner) to shape the model* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| History | Admin | model.health · One version | model.health · No history in window | model.health · Loading | model.health · History | model.health · Could not load | — | — |
| History | Operator | model.health · One version | model.health · No history in window | model.health · Loading | model.health · History | model.health · Could not load | — | model.health · History read only |
| Compare | Admin | — | — | model.board · Comparing loading | model.board · Comparing | — | — | — |
| Compare | Operator | — | — | model.board · Comparing loading | model.board · Comparing | — | — | — |
