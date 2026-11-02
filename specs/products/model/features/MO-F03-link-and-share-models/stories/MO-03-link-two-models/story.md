---
id: MO-03
title: Link two models
feature: MO-F03
status: idea
personas: [modeller]
boards: [model.board]
---

# MO-03 · Link two models

**As** a modeller with several models in one Graph **I want** to declare how two of them meet — the same thing, or a
relationship between them — on a key on each side, and see how many records it joins before I make it **so that** a
question can cross them without anyone guessing which `Stock` is which.

Tasks: [task.md](task.md) · Feature: [MO-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Link two published models, commit or discard staged links, and remove a link | — |
| Operator | Read every link, its rule, its counts and its history | *Link models* disabled and a drag between models refused — *Ask Priya (owner) to shape the model*. With *Can shape the model*: as Admin |

## Flow

```mermaid
flowchart LR
  a([A drag between two models · or Link models]) --> c["Same thing · Relationship · Source · Target · a key on each side"]
  c --> n{Counted}
  n -->|nothing joins| t["Try another key · the keys that matched nothing"] --> c
  n -->|no records yet| z["No records to count"]
  n -->|n of m join| s["Stage this link"]
  z --> s
  c -->|already linked| ex["The existing link's rule · Open it"]
  s --> st["Staged · changes no answer"]
  st -->|Discard| x(["Gone · nothing written"])
  st -->|Commit| r["A run writes its relationships"]
  r -->|refused · no connection| rf["Says why · stays staged"]
  r --> ac(["Active · n relationships · later loads join new records"])
  ac -->|Remove link · confirm| w["A run withdraws exactly its relationships"] --> gone(["Listed under Removed"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| MO-03.1 | Two published models | the person drags a kind onto a kind in the other model, or picks *Link models* | one card opens with both sides filled as *Source* and *Target*, the choice *Same thing* or *Relationship*, and a key on each side |
| MO-03.2 | A relationship link | the person fills the card | they name the relationship and choose where its ends come from — *These keys* or *Its own rows* from a dataset — never both |
| MO-03.3 | Both keys named | the card completes | it counts what the rule joins at once — *1,284 of 1,310 join* — with the sentence naming both keys and *Show the 26* listing the keys that matched nothing |
| MO-03.4 | A rule that joins nothing against records that exist | it is counted | *Stage this link* is disabled and the card offers *Try another key* |
| MO-03.5 | A side with no records yet | it is counted | the card reads *No records to count* and the link may still be staged |
| MO-03.6 | A key that is not a property of its kind, or a kind with no properties | the person picks keys | it is refused naming the side and the kind; a kind with no properties says so in place of the picker |
| MO-03.7 | A pair already linked | the person stages | the card names the existing link's rule with *Open the existing link* |
| MO-03.8 | A drag inside one model, or onto a model with nothing published | it ends | the footer says why: a relationship inside a model is changed in its draft; a link needs a published version |
| MO-03.9 | A staged link | anyone reads the map or asks a question | it is listed, drawn and counted as *staged*, and no answer changes until it is committed |
| MO-03.10 | Staged links | the person picks *Commit* | every staged link becomes active in one run, which writes each link's relationships — *same as* for the same thing, the named relationship for a keyed one — and returns how many it wrote; committing again writes nothing twice |
| MO-03.11 | Staged links | the person picks *Discard* | they go and nothing was written |
| MO-03.12 | An active link | new records are loaded | the load joins them by the link's rule without anyone re-running it |
| MO-03.13 | A rule that denies either model, no connection, or a read-only one | the person counts, commits or removes | it is refused with the reason; nothing is counted around it and the link stays as it was |
| MO-03.14 | An active link | the person selects it | it reads whole: its ends with their records, the rule with *n joined* or *n relationships*, the queries that crossed it in 30 days, who declared it, when and where from, and its history — declared, committed |
| MO-03.15 | An active link | the person picks *Remove link* and confirms | a run withdraws exactly the relationships it wrote, then the link goes and is listed under *Removed* with who removed it, when and what was withdrawn |
| MO-03.16 | A relationship the link wrote | the person opens *How it got here* on it | it names the link, its rule and when it was written |
| MO-03.17 | A model republished | its links show | they carry onto the new version; links on the version it replaced stay as history and are not counted twice |
| MO-03.18 | An Operator without *Can shape the model* | they drag between models or reach *Link models* | it is refused with *Ask Priya (owner) to shape the model*; every link still reads |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Link two models | Admin | model.board · Link card | — | model.board · Link counting | model.board · Link joins | model.board · Link refused | — | — |
| Link two models | Operator | — | — | — | — | — | — | model.board · Link refused |
| Links between models | Admin | model.board · No links | model.board · No link matches | model.board · Links loading | model.board · Links | model.board · Commit refused | model.board · Committing | — |
| Links between models | Operator | model.board · No links | model.board · No link matches | model.board · Links loading | model.board · Links | — | model.board · Committing | model.board · Read only |
| A link | Admin | — | — | model.board · Link loading | model.board · Link | model.board · Remove refused | model.board · Withdrawing | — |
| A link | Operator | — | — | model.board · Link loading | model.board · Link | — | — | model.board · Read only |
