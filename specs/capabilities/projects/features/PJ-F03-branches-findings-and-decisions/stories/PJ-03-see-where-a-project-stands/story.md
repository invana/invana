---
id: PJ-03
title: See where a project stands
feature: PJ-F03
status: idea
personas: [decision-maker, analyst]
boards: [projects.projects, projects.graph]
---

# PJ-03 · See where a project stands

**As** a decision maker **I want** a project's overview — its question, its branches, the loads it cited, what is only
predicted, and the work still open **so that** I know where the quest stands before I act on it.

Tasks: [task.md](task.md) · Feature: [PJ-F03](../../feature.md)

## Who can

*Branches, findings and decisions* follows the [permission catalogue](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue),
on every project the person can see ([PJ-F01](../../../PJ-F01-projects-and-tasks/feature.md#access)).

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Read the overview of any project they can see; open its branches, findings and decisions | A project they may not read: its head only, the rest *Withheld — join the team or ask {who can grant}* — Admins are not exempt |
| Operator | The same, and every act on the page | A project they may not read: its head only, the rest *Withheld — join the team or ask {who can grant}*. On an archived project every act is disabled, saying it is archived |

## Flow

```mermaid
flowchart LR
  s([Projects › a project]) --> pv{"Default agent may not Read it?"}
  pv -->|yes| pr["Head only · Withheld — for an Admin as for anyone"]
  pv -->|no| load["Loading — the page is drawn, the rows fill in"]
  load -->|fails| f["Could not load · the reason · Try again"] --> load
  load --> o["Overview: question · type · branches with status and balance · loads cited · predicted findings · open work · decisions so far"]
  o -->|only the first branch, nothing cited| j["Just started: the question as asked, open"]
  o --> mp["The map leads · a one-line where it stands · detail through peeks"]
  mp -->|a node| pk["Peek · branch · finding · task · decision · Open for the full page"]
  o --> b["A branch → PJ-05"]
  o --> t["The tree → PJ-04"]
  o --> d["Every decision of this project → PJ-13"]
  o -->|an agent proposed| p["Proposals waiting · opens the branch's proposals"]
  o -->|archived| a["Reads only · every act disabled, saying archived"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| PJ-03.1 | A project just created | a person who can see it opens it | the overview reads its question and type, and one branch — the question as asked — open, with *No findings yet* |
| PJ-03.2 | A project with branches | the overview opens | each branch shows its number (*b1*), title, status (open · pursuing · parked · dropped · merged) and balance (*3 supports · 1 contradicts*), in the words of the project's type |
| PJ-03.3 | Findings that cite loads | the overview opens | *Loads cited* lists each load those findings cite, by its name, id and content hash, each opening the load in Model › Graph Data › Loads (RC-F02); there is no second list to keep |
| PJ-03.4 | Findings added from a what-if answer ([EX-33](../../../../../explore/features/EX-F05-when-it-cannot-answer-and-how-it-reasons/stories/EX-33-ask-what-if-and-read-the-prediction-as-evidence/story.md)) | the overview opens | each branch's balance counts them apart, labelled *predicted*, so a prediction never reads as an observation |
| PJ-03.5 | A project with open tasks | the overview opens | it counts the open tasks and lists them, each opening its task |
| PJ-03.6 | A branch with proposals waiting | the overview opens | the branch shows *N proposals waiting*, opening that branch's proposals |
| PJ-03.7 | A project, a branch or a finding open | the shell's header shows the path | it reads *Projects › the project › H2 · title › the finding's statement*, each level linking one level up; the project is named by its name, never its key |
| PJ-03.8 | A branch, finding or decision open on the page | the person reloads or shares the address | it opens on the same branch, finding or decision; moving to another project clears them |
| PJ-03.9 | A project and a person who may not read `project/{key}` | they open its address | it reads its head — name, key, type, status and counts — and the rest *Withheld — join the team or ask {who can grant}*, for an Admin as for anyone; nothing reads *Not found* |
| PJ-03.10 | The engine cannot return the project | the page loads | it says *Could not load* with the reason and *Try again*; nothing partial is drawn as complete |
| PJ-03.11 | An archived project | the overview opens | it reads in full; every act is disabled, saying the project is archived |
| PJ-03.12 | An Operator who can see the project | they open its overview | it reads in full and every act on it is theirs, as for an Admin |
| PJ-03.13 | A project the person can read | its page opens | the map of the project (PJ-31) leads the page, with one line above it — *where it stands* — reading the number of branches and which are open, the open tasks, the decisions waiting on a person and when the last decision was made, every number the engine's |
| PJ-03.14 | A project's page | it is read | it answers one question at a time — *Where does it stand?* is the map; *What is open?*, *Who is on it?*, *What did we decide?* and *What did we publish?* are each their own tab, never stacked on the map's page |
| PJ-03.15 | A node on the map — a branch, finding, task or decision | the person selects it | a peek opens beside the map with its head, status and balance and *Open*; selecting another replaces it; no new page opens until *Open* |
| PJ-03.16 | A project's page | it is read | whatever can be drawn is drawn on the canvas — the branch tree (PJ-04), the reach of a decision (PJ-10), a lineage (PJ-11) — and the lists beside it read the same records |
| PJ-03.17 | A project just created | the page opens | the map shows the question as its one node, open, with *Fork* and *Add a task*; the line above it reads *Just started* |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Overview | Admin | projects.projects · Detail · Just started | — | projects.projects · Detail · Loading | projects.projects · Detail | projects.projects · Detail · Could not load | projects.projects · Detail · Proposals waiting | projects.projects · Detail · Withheld |
| Overview | Operator | projects.projects · Detail · Just started | — | projects.projects · Detail · Loading | projects.projects · Detail | projects.projects · Detail · Could not load | projects.projects · Detail · Proposals waiting | projects.projects · Detail · Withheld |
| The map and where it stands | Admin | projects.projects · Detail · Just started | — | projects.projects · Detail · Loading | projects.projects · Detail · Map | projects.projects · Detail · Could not load | projects.projects · Detail · Proposals waiting | projects.projects · Detail · Withheld |
| The map and where it stands | Operator | projects.projects · Detail · Just started | — | projects.projects · Detail · Loading | projects.projects · Detail · Map | projects.projects · Detail · Could not load | projects.projects · Detail · Proposals waiting | projects.projects · Detail · Withheld |
| A peek on the map | Admin | — | — | — | projects.projects · Detail · Map · Peek | — | — | — |
| A peek on the map | Operator | — | — | — | projects.projects · Detail · Map · Peek | — | — | projects.projects · Detail · Withheld |
| An archived project | Admin | — | — | — | projects.projects · Detail · Archived | — | — | — |
| An archived project | Operator | — | — | — | projects.projects · Detail · Archived | — | — | — |
