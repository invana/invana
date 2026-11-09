---
id: PJ-11
title: Follow a decision back to the original authors
feature: PJ-F03
status: idea
personas: [decision-maker, analyst]
boards: [projects.decide]
---

# PJ-11 · Follow a decision back to the original authors

**As** an auditor **I want** the lineage of a decision — the findings it cited, the runs and datasets behind them, and
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
  load --> g["Columns: authors · datasets · runs · findings · decision · each edge a record: cited by · author · collected"]
  g --> n["Open a node → its source: the finding, the run, the dataset, the author"]
  g --> sh["Show: narrow datasets, and their authors, to one origin"]
  g --> l["Links: every node's hops in words, under the drawing"]
  g -->|a cited dataset version was retracted| rt["Marked retracted · with the reason"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-11.1 | A decision | someone opens its *Lineage* | it draws, left to right, authors · datasets · runs · findings · the decision, with each edge named for what it is: *cited by*, *author*, *collected* |
| PJ-11.2 | The lineage | it is drawn | every node and edge comes from a stored record — the decision, its cited findings, their run and dataset cites, each dataset's author chain; nothing is inferred |
| PJ-11.3 | Any node | the person opens it | it opens its source: the finding, the run, the dataset version or the author |
| PJ-11.4 | The lineage | it is drawn | *Links* under the drawing names every node's hops in words (*cites run 8195c5e8 · cited by d1*), so a reader without the drawing, or a clipped label, loses nothing |
| PJ-11.5 | A lineage with several origins | the person picks one under *Show* | datasets, and their authors, narrow to that origin; findings and runs stay |
| PJ-11.6 | A cited dataset version that its source retracted | the lineage opens | that node is marked retracted with the reason, and the path through it stays |
| PJ-11.7 | A decision that cited no findings | its lineage opens | it says it cites nothing, and shows the decision alone |
| PJ-11.8 | A decision in a private project | a member not staffed on it asks for its lineage | it does not open |
| PJ-11.9 | The engine cannot return the records | the lineage loads | it says *Could not load* with the reason and *Try again* |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Lineage | Admin | projects.decide · Lineage · Cites nothing | projects.decide · Lineage · Nothing from this origin | projects.decide · Lineage · Loading | projects.decide · Lineage | projects.decide · Lineage · Could not load | — | projects.project · Private |
| Lineage | Operator | projects.decide · Lineage · Cites nothing | projects.decide · Lineage · Nothing from this origin | projects.decide · Lineage · Loading | projects.decide · Lineage | projects.decide · Lineage · Could not load | — | projects.project · Private |
| A retracted source | Admin | — | — | — | projects.decide · Lineage · Retracted source | — | — | — |
| A retracted source | Operator | — | — | — | projects.decide · Lineage · Retracted source | — | — | — |
