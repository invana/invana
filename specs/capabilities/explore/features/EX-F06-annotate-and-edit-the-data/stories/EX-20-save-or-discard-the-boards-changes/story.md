---
id: EX-20
title: Save or discard the board's changes
feature: EX-F06
status: idea
personas: [analyst, builder]
boards: [explore.board.edit]
---

# EX-20 · Save or discard the board's changes

**As** an analyst fixing records on a board **I want** to see what I added, changed and deleted until it is saved, and
save or discard it from one panel **so that** nothing reaches a graph database by accident, and nothing is lost by
accident.

Tasks: [task.md](task.md) · Feature: [EX-F06](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Stage, revert and discard changes; save them to a read + write graph database through the Record editor | A read-only graph database: Save disabled, naming it and its mode |
| Operator | Stage, revert and discard changes on the board; a Modeller as Admin ([role table](../../../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table) › *Edit on the board*) | *Save n changes* disabled — *Needs the Modeller role — ask an Admin*; the changes stay on the board |

## Flow

```mermaid
flowchart LR
  a([An edit applied]) --> m["Marked on the board · Changes count +1"]
  m -->|Changes| p["Added · Edited · Deleted"]
  p -->|revert a row| m
  p -->|Discard all| c(["Back as saved · ⌘Z brings it back"])
  p -->|Save n changes| g{May save?}
  g -->|an Operator · a read-only or switched-off graph database · no writer| d["Disabled or refused — the reason · changes kept"]
  g -->|no rule allows the Record editor to write| pr["Refused — the policy and rule · changes kept"]
  g -->|yes| s["Saving…"]
  s -->|refused by the model · failed| f["Could not save — why · Try again"]
  s -->|written| ok(["Marks cleared · Saved just now"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-20.1 | An edit applied on the board | it lands | a new element has a dashed outline in the warning colour, an edited one a dot, a deleted one a faded dashed ghost in place; the rail's Changes button counts it |
| EX-20.2 | Unsaved changes | the person opens Changes | they are listed under Added · Edited · Deleted; a row frames its element on the board, and its revert undoes only that change — a node taking what hangs on it |
| EX-20.3 | Unsaved changes | the person picks *Discard all* | every change goes without a question, and ⌘Z brings them back |
| EX-20.4 | Unsaved changes | the person presses ⌘Z or ⌘⇧Z | the list moves with the board's history |
| EX-20.5 | An expansion in Edit mode | the neighbours draw | they are not listed as unsaved |
| EX-20.6 | A Modeller or an Admin, a read + write graph database, and a rule allowing the Record editor Write on `data/<graph database>/<kind>` | they pick *Save n changes* | rows dim, *Saving…* shows, and when the run settles the marks clear and the panel says *Saved just now*, new elements taking their database ids |
| EX-20.7 | A change with a kind or key the model does not have | the person saves | the save is refused naming the change and the key; every change is kept |
| EX-20.8 | A save the graph database refuses | it settles | *Could not save* shows the database's reason with *Try again*; nothing is half-saved where the database runs transactions |
| EX-20.9 | Changes to records in a read-only graph database | the person opens Changes | Save is disabled, naming the graph database and that it is read-only; the changes stay, and the API refuses the same |
| EX-20.10 | Unsaved changes | the person leaves the board or reloads | they are warned first that the changes will be lost |
| EX-20.11 | An Operator | they open Changes | *Save n changes* is disabled — *Needs the Modeller role — ask an Admin*; the changes stay on the board |
| EX-20.12 | A node deleted on the board | Changes lists it | the relationships that hang on it are listed under it, and saving deletes them with it |
| EX-20.13 | Changes staged before the model was published again | the person saves | they are checked against the model as it is now; a refusal names the change and the key |
| EX-20.14 | A change to an element someone else deleted, or whose kind changed, since the board read it | the person saves | the save is refused naming that change; every change is kept |
| EX-20.15 | No rule allowing the Record editor Write on that kind in that graph database, or a Deny | the person saves | it is refused before anything is written, naming the policy, the rule and the kind; every change is kept. An Ask rule waits for the agent's approvers |
| EX-20.16 | A graph database switched off | the person saves changes to its records | it is refused before anything is written, naming who switched it off and when; every change is kept |
| EX-20.17 | A graph database whose connector cannot write yet | the person opens Changes | Save is disabled — *Saving to this database isn't supported yet*; the changes stay |
| EX-20.18 | Changes across two graph databases | the person saves | each is written to the graph database that holds its records; a refusal on one says which changes were saved and keeps the rest |
| EX-20.19 | A saved change | the person opens the save's run | it shows the Record editor, the person behind it, and per graph database what was applied |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Changes | Admin | explore.board.edit · No changes | — | explore.board.edit · Saving | explore.board.edit | explore.board.edit · Save failed | explore.board.edit · Waiting for approvers | explore.board.edit · Read-only database |
| Changes | Operator | explore.board.edit · No changes | — | — | explore.board.edit | — | — | explore.board.edit · Read only |
