---
id: PJ-11
title: Follow a decision back to the original authors
feature: PJ-F03
status: idea
personas: [decision-maker, analyst]
boards: [projects.decide]
---

# PJ-11 · Follow a decision back to the original authors

**As** an auditor **I want** the lineage of a decision — the findings it cited, the runs and loads behind them, and
the authors of that data **so that** anyone can follow how we got here.

Tasks: [task.md](task.md) · Feature: [PJ-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read the lineage of any decision they can see; open every node's source | — |
| Operator | Read the same | Nothing is hidden; there is no act on a lineage to refuse |

## Flow

```mermaid
flowchart LR
  d([A decision › Lineage]) --> load["Loading — the page is drawn"]
  load -->|fails| f["Could not load · Try again"] --> load
  load -->|the decision cited nothing| e["Cites nothing — nothing to follow"]
  load --> g["Columns: authors · loads · runs · findings · decision · each edge a record: cited by · author · collected"]
  g --> n["Open a node → its source: the finding, the run, the load, the author"]
  g --> sh["Show: narrow loads, and their authors, to one source"]
  g --> l["Links: every node's hops in words, under the drawing"]
  g -->|a cited load was undone| rt["Marked: a load undone · who undid it and why"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-11.1 | A decision | someone opens its *Lineage* | it draws, left to right, authors · loads · runs · findings · the decision, with each edge named for what it is: *cited by*, *author*, *collected* |
| PJ-11.2 | The lineage | it is drawn | every node and edge comes from a stored record — the decision, its cited findings, their run and load cites, each load's author and source file; nothing is inferred |
| PJ-11.3 | Any node | the person opens it | it opens its source: the finding, the run, the load or the author |
| PJ-11.4 | The lineage | it is drawn | *Links* under the drawing names every node's hops in words (*cites run 8195c5e8 · cited by d1*), so a reader without the drawing, or a clipped label, loses nothing |
| PJ-11.5 | A lineage with loads from several sources | the person picks one under *Show* | loads, and their authors, narrow to that source; findings and runs stay |
| PJ-11.6 | A cited load that was undone in Records | the lineage opens | that node is marked *a load undone*, with who undid it and why, and the path through it stays |
| PJ-11.7 | A decision that cited no findings | its lineage opens | it says it cites nothing, and shows the decision alone |
| PJ-11.8 | A decision in a private project | a member not staffed on it asks for its lineage | it does not open |
| PJ-11.9 | The engine cannot return the records | the lineage loads | it says *Could not load* with the reason and *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Lineage | Admin | projects.decide · Lineage · Cites nothing | projects.decide · Lineage · Nothing from this source | projects.decide · Lineage · Loading | projects.decide · Lineage | projects.decide · Lineage · Could not load | — | projects.project · Private |
| Lineage | Operator | projects.decide · Lineage · Cites nothing | projects.decide · Lineage · Nothing from this source | projects.decide · Lineage · Loading | projects.decide · Lineage | projects.decide · Lineage · Could not load | — | projects.project · Private |
| A load undone | Admin | — | — | — | projects.decide · Lineage · Load undone | — | — | — |
| A load undone | Operator | — | — | — | projects.decide · Lineage · Load undone | — | — | — |
