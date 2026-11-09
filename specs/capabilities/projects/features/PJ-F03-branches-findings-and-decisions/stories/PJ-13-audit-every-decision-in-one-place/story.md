---
id: PJ-13
title: Audit every decision in one place
feature: PJ-F03
status: idea
personas: [decision-maker, analyst]
boards: [projects.decide]
---

# PJ-13 · Audit every decision in one place

**As** an auditor **I want** every decision across the projects I may see — what it cited and the rules it passed —
newest first **so that** decisions can be audited in one place.

Tasks: [task.md](task.md) · Feature: [PJ-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Read the Decisions page across every project they may see; open a decision, its project and its lineage; export the rows | Decisions of a private project they are not staffed on are absent — Admins are not exempt |
| Operator | Read the same, and export the rows | Decisions of a private project they are not staffed on are absent. Nothing on the page is an act to refuse |

## Flow

```mermaid
flowchart LR
  s([Projects › Decisions]) --> load["Loading — the page is drawn"]
  load -->|fails| f["Could not load · Try again"] --> load
  load -->|none anywhere| e["No decisions yet — decide a branch in a project"]
  load --> l["Newest first · 2 current · 5 recorded · project · branch · decision · verdict · by · when · cited · rules passed"]
  l --> o["Open a decision → its branch · its project · Lineage (PJ-11)"]
  l --> x["Export for audit → a CSV of the rows shown"]
  l -->|a project is private and the reader is not staffed| h["Its decisions are not listed"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-13.1 | Decisions in several projects | a member opens Decisions | they list newest first across every project the member may see, each with its project, branch, decision, verdict, who decided and when |
| PJ-13.2 | The list | it is drawn | each decision shows what it cited and the rules it passed, with any warning |
| PJ-13.3 | The page header | the list is drawn | it reads *2 current · 5 recorded*, as the engine counted them — current is the decisions no later one supersedes; it reads *5* alone when the two match |
| PJ-13.4 | A decision | the person opens it | it opens its branch in its project, and its lineage (PJ-11) |
| PJ-13.5 | A decision | the list names *By* | it names the decider from the project's staff and the signed-in person; anyone else reads *a person* |
| PJ-13.6 | A private project the member is not staffed on | the list is drawn | none of its decisions appear — for an Admin as for anyone |
| PJ-13.7 | The list | the person chooses *Export for audit* | a CSV of the rows shown downloads |
| PJ-13.8 | A Graph with no decisions | the page opens | it reads *No decisions yet* and says decisions are recorded on a branch |
| PJ-13.9 | The engine cannot return the list | the page loads | it says *Could not load* with the reason and *Try again* |
| PJ-13.10 | An Operator | they open Decisions | the whole page reads and exports; nothing on it is disabled |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Every decision | Admin | projects.decide · Every decision · None yet | — | projects.decide · Every decision · Loading | projects.decide · Every decision | projects.decide · Every decision · Could not load | — | — |
| Every decision | Operator | projects.decide · Every decision · None yet | — | projects.decide · Every decision · Loading | projects.decide · Every decision | projects.decide · Every decision · Could not load | — | — |
