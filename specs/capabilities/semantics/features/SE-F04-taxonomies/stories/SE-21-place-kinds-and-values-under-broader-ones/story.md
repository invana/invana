---
id: SE-21
title: Place kinds and values under broader ones
feature: SE-F04
status: idea
personas: [modeller, curator]
boards: [model.taxonomies, model.board.draft]
---

# SE-21 · Place kinds and values under broader ones

**As** a modeller **I want** to say which broader kind a kind belongs to, and how a property's values nest
**so that** a question about a broad class reaches every kind and value under it, without changing how records are stored.

Tasks: [task.md](task.md) · Feature: [SE-F04](../../feature.md)

## Who can

Placing kinds and values is the Modeller's and the Admin's ([the role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)).

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read the trees; set a broader kind; add or change a value hierarchy, in a draft | — |
| Operator | Read the trees. A Modeller places kinds and values as an Admin does | *Set a broader kind* and *Add a value hierarchy* absent — *Needs the Modeller role — ask an Admin* |

## Flow

```mermaid
flowchart LR
  a([Model › Taxonomies]) --> t{Anything placed?}
  t -->|no| e["Nothing placed yet · both acts"]
  t -->|yes| r["Kinds under broader kinds · value hierarchies"]
  r -->|Set a broader kind · Add a value hierarchy| c{Modeller or Admin?}
  e --> c
  c -->|no| na["Needs the Modeller role — ask an Admin"]
  c -->|yes| s["Staged in the draft"]
  s -->|a cycle| x["Refused, naming the loop"]
  s -->|Publish| p(["Questions about the broader one reach the narrower ones"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SE-21.1 | A model with nothing placed | Taxonomies opens | it reads *Nothing placed yet*, with *Set a broader kind* and *Add a value hierarchy* for a Modeller or an Admin |
| SE-21.2 | A Modeller or an Admin | they set a kind's *Broader kind* | it is staged on the draft; no property, label or relationship is added to any stored record |
| SE-21.3 | A published broader kind | someone asks about it | the answer reaches every kind under it, and *How it got here* names the broader kind it widened through |
| SE-21.4 | A property held to a standard with levels | they pick *Add a value hierarchy* from it | the standard's broader and narrower values are staged as the property's hierarchy, naming the standard version |
| SE-21.5 | A published value hierarchy | someone asks for a broader value | records with any narrower value are included, and *How it got here* names the value it widened through |
| SE-21.6 | A kind or value placed under itself, directly or not | it is staged | it is refused, naming the loop |
| SE-21.7 | A published broader kind removed in a draft | the draft publishes | it is a breaking change, reviewed as SE-05 says |
| SE-21.8 | An Operator | they open Taxonomies | the trees read; the acts are absent with *Needs the Modeller role — ask an Admin* |
| SE-21.9 | Taxonomies that cannot be read | it opens | it says it could not load, with *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Taxonomies | Admin | model.taxonomies · Nothing placed yet | model.taxonomies · No match | model.taxonomies · Loading | model.taxonomies | model.taxonomies · Could not load | — | — |
| Taxonomies | Operator | model.taxonomies · Nothing placed yet | model.taxonomies · No match | model.taxonomies · Loading | model.taxonomies · Read only | model.taxonomies · Could not load | — | model.taxonomies · Read only |
| The draft · placed | Admin | — | — | — | model.board.draft | model.taxonomies · Loop refused | — | — |
| The draft · placed | Operator | — | — | — | — | — | — | — |
