---
id: AC-31
title: Keep a run's content to those who may read it
feature: AC-F09
status: idea
personas: [analyst, builder, admin]
boards: [agents.run, access.ledger, inbox, inbox.history, access.locked]
---

# AC-31 · Keep a run's content to those who may read it

**As** an analyst who asked an agent a question **I want** what my run read, sent and answered to be readable by me,
and — when it is a project's work — by whoever's own agent may read what it drew on, and by no one else **so that** I
can work with sensitive data while everyone else can still see that it ran, its status and its tokens.

Tasks: [task.md](task.md) · Feature: [AC-F09](../../feature.md)

## Who can

Roles are [the role table](../../../AC-F02-access-policies/feature.md#the-role-table). No role reads a run's content
by itself.

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read the content of runs they are behind, and of a project's runs whose sources their default agent may read; read every ledger row's kinds, fields, IDs and query, never a value | Any other run: that it ran, its agent, the person behind it, its status and its tokens |
| Operator | Read the content of runs they are behind, and of a project's runs whose sources their default agent may read; a Modeller the same | Any other run: that it ran, its agent, the person behind it, its status and its tokens — content reads *withheld — only {person behind}, or someone whose agent may read its sources, reads it* |

## Flow

```mermaid
flowchart TD
  o([A run · from Runs, a call, a History row, an ask or usage]) --> b{"Behind it?"}
  b -->|yes| full["Its steps, queries, records, calls, what it sent and its answer"]
  b -->|no| p{"A project's run?"}
  p -->|no — a chat in someone's own space| meta["That it ran · agent · person behind · status · tokens"]
  p -->|yes| l{"The reader's default agent may read every source? (GP-F02)"}
  l -->|yes| full
  l -->|no| meta
  meta --> wh["Content withheld · says who may read it"]
  wh -->|a direct link to a step or call| nf(["Not found"])
  full -->|a source the reader's agent loses| re(["Withheld from the next read"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| AC-31.1 | A run | the person behind it opens it | its steps, queries, records, calls, what it sent and its answer read in full |
| AC-31.2 | A run outside any project | anyone else opens it, an Admin included | it reads that it ran, its agent, the person behind it, its status and its tokens; its content reads *withheld*; its content routes answer *Not found* |
| AC-31.3 | A run that belongs to a project | someone not behind it opens it | its content reads in full when their default agent may read every source it drew on; otherwise it is withheld as in AC-31.2, naming the first source their agent may not read (GP-F02) |
| AC-31.4 | A step of a run the reader may not read | *How it got here* is opened | the steps list by name and status; their arguments, rows and sources are withheld |
| AC-31.5 | A call of such a run, in *What left the platform* | an Operator or a Modeller opens it | its time, agent, target, class, verdict and tokens read; its kinds, fields, record IDs and query are withheld (AC-30) |
| AC-31.6 | A History row of such a run | it is opened | who, the act, the verdict and the rule read; its arguments are withheld (AC-16) |
| AC-31.7 | An ask from such a run | it is read by someone not routed to it | its kind, agent, who it waits on and its time left read; its act and what it will send are withheld (AC-15) |
| AC-31.8 | Usage over such runs | it is read | they are counted, not shown (AC-28) |
| AC-31.9 | A reader whose default agent loses Read on a source, or whose default agent changes | they open a project's run again | it is decided again at that read; what their agent may not read at that moment is withheld |
| AC-31.10 | A run started by a schedule, a pick-up or a key | its content is read | the person behind a key's run is its owner, who reads it; a schedule's or a pick-up's run has no person behind it, so it reads only through lineage as a project's run |
| AC-31.11 | The tokens of a run the reader may not read | they are read | tokens read as the engine stored them; there is no currency |
| AC-31.12 | An Admin | they open a run they may not read | its content is withheld as for anyone; the role grants no content |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| A run | Admin | — | — | agents.run · Loading | agents.run · Step | agents.run · Failed | agents.run · Running | agents.run · Content withheld |
| A run | Operator | — | — | agents.run · Loading | agents.run · Step | agents.run · Failed | agents.run · Running | agents.run · Content withheld |
| A ledger call | Admin | — | — | access.ledger · Call · Loading | access.ledger · Call | access.ledger · Call · Refused | — | — |
| A ledger call | Operator | — | — | access.ledger · Call · Loading | access.ledger · Call | access.ledger · Call · Refused | — | access.locked · Content withheld |
| A History row | Admin | — | — | inbox.history · Loading | inbox.history · Row | inbox.history · Could not load | — | inbox.history · Arguments withheld |
| A History row | Operator | — | — | inbox.history · Loading | inbox.history · Row | inbox.history · Could not load | — | inbox.history · Arguments withheld |
| An ask | Admin | — | — | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | inbox · Content withheld |
| An ask | Operator | — | — | inbox · Loading | inbox | inbox · Could not load | inbox · An agent asks to send | inbox · Content withheld |
