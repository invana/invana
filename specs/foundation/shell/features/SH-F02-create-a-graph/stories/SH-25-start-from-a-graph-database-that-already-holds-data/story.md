---
id: SH-25
title: Start from a graph database that already holds data
feature: SH-F02
status: idea
personas: [owner, modeller]
boards: [start.new_graph.connect, start.new_graph.shape, start.new_graph.ready]
---

# SH-25 · Start from a graph database that already holds data

**As** a Graph owner who already runs a graph database **I want** to connect it and get a drafted model to review,
then publish and ask **so that** my existing graph answers questions in minutes.

Tasks: [task.md](task.md) · Feature: [SH-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Connect, test, accept or change the agent's draft, create the Graph | — |
| Operator | The same — the creator is the new Graph's Owner | — |

## Flow

```mermaid
flowchart TD
  c([2 · Connect]) --> f["Engine · address · user · password · database · read-only"]
  f --> t{"Test connection"}
  t -->|fails| tf["The database's own words · Continue stays off"] --> f
  t -->|holds records| w["What is there: kinds and counts"]
  t -->|empty| e["Empty · drafting offered disabled, saying why · SH-26 or a starting point"]
  w --> s["3 · Shape: Draft from what is there, chosen"]
  s --> a["The agent drafts · MO-04"]
  a --> p["The draft: kinds, relationships · what it left out, and why"]
  p --> d{"The person decides"}
  d -->|accept| cr(["Create graph · Ready · set-up's next step: publish the draft"])
  d -->|change| p
  d -->|another starting point| o["Ontology · starter · description · blank"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SH-25.1 | Step 2 · Connect | it draws | the engines with their query languages, then address, user, password, database name and a read-only switch |
| SH-25.2 | Connection details | the person tests them | it says it is testing; a pass reports what the database holds — kinds and counts — before any Graph exists |
| SH-25.3 | A failed test | it returns | the database's own error shows under the fields and *Continue* stays off |
| SH-25.4 | Details changed after a pass | the person looks for *Continue* | it is off until the test passes again |
| SH-25.5 | A database that holds records | step 3 opens | *Draft from what is there* is chosen, and the agent drafts the model (MO-04) |
| SH-25.6 | An empty database | step 3 opens | *Draft from what is there* is shown disabled — *The database holds nothing yet* — and the other starting points are offered |
| SH-25.7 | The agent's draft | it is shown | it lists the kinds and relationships it drafted and every kind it left out, each with why |
| SH-25.8 | The draft | the person accepts it and creates the Graph | the draft is kept unpublished, and set-up's next step is to review and publish it in Model |
| SH-25.9 | A database that holds records | the Graph is made | set-up counts the data step done on arrival |
| SH-25.10 | The password | it is saved | it is stored encrypted and never read back |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| 2 · Connect | Admin | start.new_graph.connect | — | start.new_graph.connect · Testing | start.new_graph.connect · Connected | start.new_graph.connect · Test failed | — | — |
| 2 · Connect | Operator | start.new_graph.connect | — | start.new_graph.connect · Testing | start.new_graph.connect · Connected | start.new_graph.connect · Test failed | — | — |
| 3 · Shape | Admin | start.new_graph.shape · Nothing there yet | — | start.new_graph.shape · Reading | start.new_graph.shape | start.new_graph.shape · Unreachable | start.new_graph.shape · Drafting | — |
| 3 · Shape | Operator | start.new_graph.shape · Nothing there yet | — | start.new_graph.shape · Reading | start.new_graph.shape | start.new_graph.shape · Unreachable | start.new_graph.shape · Drafting | — |
| 5 · Ready | Admin | — | — | start.new_graph.ready · Loading below | start.new_graph.ready · Draft to publish | — | start.new_graph.ready · Drafting below | — |
| 5 · Ready | Operator | — | — | start.new_graph.ready · Loading below | start.new_graph.ready · Draft to publish | — | start.new_graph.ready · Drafting below | — |
