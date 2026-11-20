---
id: SE-20
title: Say what a kind means
feature: SE-F03
status: idea
milestone: MVP
personas: [modeller]
boards: [model.models]
---

# SE-20 · Say what a kind means

**As** a modeller **I want** each kind and property to carry its definition, the synonyms people ask with, its unit,
the outside terms it is the same as and how sensitive it is **so that** a question in anyone's words finds the right
kind, an answer can be compared with data elsewhere, and agents read only the properties their Access Policies reach.

Tasks: [task.md](task.md) · Feature: [SE-F03](../../feature.md)

## Who can

Changing meaning needs Edit on `model/<model>` ([the permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read meaning and every property's level; change them in a draft; accept or dismiss a proposed synonym | — |
| Operator | Read meaning and levels. With Edit on the model, changes them as an Admin does | *Change in a draft*, *Set level* and *Accept into the draft* disabled — *Needs Edit on the {model} model — ask {who can grant}* |

## Flow

```mermaid
flowchart LR
  a([A kind · Meaning]) --> m{Any meaning?}
  m -->|no| e["No meaning yet · Add a definition"]
  m -->|yes| r["Definition · synonyms · unit and level per property · outside terms"]
  r -->|Change in a draft| c{"Holds Edit on model/<model>?"}
  e --> c
  c -->|no| na["Needs Edit on the {model} model — ask {who can grant}"]
  c -->|yes| s["Staged in the draft"]
  s -->|synonym taken · not an address · not a level| x["Refused, naming the field"]
  s -->|a level lowered| w["Shown as a widening · History records it"]
  s -->|Publish| p(["Questions in those words find this kind · each level in force"])
  r -->|a proposed synonym| pr["Accept into the draft · Dismiss"] --> c
  p -->|an agent reads the kind| rd(["Outbound checks read each level"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SE-20.1 | A kind with no meaning | Meaning opens | it reads *No meaning yet*, with *Add a definition* for a person with Edit on the model |
| SE-20.2 | A kind with meaning | Meaning opens | it shows the definition, the synonyms, each property's unit and level, and each outside term with its label and address |
| SE-20.3 | A person with Edit on the model | they add a definition, a synonym, a unit or an outside term | it is staged on the model's draft and published with it, never changing a record |
| SE-20.4 | A synonym another published kind already has | it is staged | it is refused, naming the other kind and model |
| SE-20.5 | An outside term that is not an address | it is staged | it is refused, naming the field |
| SE-20.6 | A published synonym | someone asks a question in that word | the answer resolves to the kind, and *How it got here* names the synonym that matched |
| SE-20.7 | A synonym proposed by Explore's memory | the kind's Meaning opens | it waits with *Accept into the draft* · *Dismiss*, naming where it came from; accepting stages it |
| SE-20.8 | An Operator | they open Meaning | it reads; the acts are disabled, and a line reads *Needs Edit on the {model} model — ask {who can grant}*; the API refuses the write |
| SE-20.9 | Meaning that cannot be read | the tab opens | it says it could not load, with *Try again* |
| SE-20.10 | A person with Edit on the model on a property | they set its level to public, internal, confidential or personal | the level is staged on the draft and in force when the model publishes; a property nobody set reads *internal* |
| SE-20.11 | A level that is not one of the four, or a level on a property its kind does not carry | it is staged | it is refused, naming the level or the property |
| SE-20.12 | A draft that lowers a property's level | it is reviewed before publish | the change shows as a widening, naming the property, the old and the new level; once published, History records who lowered it, from what, to what |
| SE-20.14 | A call to an external AI model, an outside tool or an outside agent that would carry a confidential or personal property | it is made | it is refused before it leaves, naming the property and its level ([AC-F09](../../../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#engine)) |
| SE-20.15 | An export, a published report or a message to an MCP client that would carry a confidential or personal property | it is made | the value is left out and what was left out is named ([AC-F09](../../../../../../os/access/features/AC-F09-what-left-the-platform/feature.md#engine)) |
| SE-20.16 | A level change | the model publishes | the one level holds for every exit and every derived value; no policy file sets or changes it |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A kind · Meaning | Admin | model.models · Kind · Meaning · No meaning yet | — | model.models · Kind · Meaning · Loading | model.models · Kind · Meaning | model.models · Kind · Meaning · Could not load | model.models · Kind · Meaning · Proposed synonym | — |
| A kind · Meaning | Operator | model.models · Kind · Meaning · No meaning yet | — | model.models · Kind · Meaning · Loading | model.models · Kind · Meaning · Read only | model.models · Kind · Meaning · Could not load | model.models · Kind · Meaning · Read only | model.models · Kind · Meaning · Read only |
| A property · Level | Admin | model.models · Kind · Meaning · Levels | — | model.models · Kind · Meaning · Loading | model.models · Kind · Meaning · Levels | model.models · Kind · Meaning · Level refused | — | — |
| A property · Level | Operator | model.models · Kind · Meaning · Levels | — | model.models · Kind · Meaning · Loading | model.models · Kind · Meaning · Levels · Read only | model.models · Kind · Meaning · Could not load | — | model.models · Kind · Meaning · Levels · Read only |
| The draft · meaning staged | Admin | — | — | — | model.models · Draft · Widening | model.models · Kind · Meaning · Refused | — | — |
| The draft · meaning staged | Operator | — | — | — | — | — | — | — |
