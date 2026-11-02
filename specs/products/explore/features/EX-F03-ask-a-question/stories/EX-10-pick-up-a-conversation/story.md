---
id: EX-10
title: Pick up a conversation
feature: EX-F03
status: idea
personas: [analyst]
boards: [explore.ask, explore.board]
---

# EX-10 · Pick up a conversation

**As** an analyst **I want** every question I asked kept in conversations I can search and reopen where I left them,
each asking in the view of the graph I chose for it **so that** work is never lost and every answer says what it was
allowed to see.

Tasks: [task.md](task.md) · Feature: [EX-F03](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Open, search, reopen and start their own conversations; pick a view of the graph per conversation or per question; set a token budget per run | — |
| Operator | The same — every member, for their own conversations | A view whose version is unpublished: disabled with its reason. A budget above the agent's: clamped, and the settings say so |

## Flow

```mermaid
flowchart LR
  h([Conversations]) -->|search| s{Matches?}
  s -->|none| e["No conversation matches · Clear"]
  s -->|some| row["A conversation"] --> o["Reopened as it was, with its outcome"]
  h -->|New| n["A blank thread · composer focused"] -->|first question| saved(["The conversation exists"])
  o --> v["The view of the graph in the composer"]
  v -->|for this conversation| all["Every question after it"]
  v -->|Next ask only| one["One question, then back"]
  v -->|unpublished version| dis["Disabled, with its reason"]
  all --> ask{Can it run inside the agent's rules?}
  one --> ask
  ask -->|no| rf["Refused before it runs, naming the rule and whose it is"]
  ask -->|yes| tag(["The turn is tagged with the view it ran in"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| EX-10.1 | A docked conversation | the person opens *Conversations* in its header | every conversation of theirs on this Graph is listed newest first — its outcome's dot, title, when, and *failed* when its last reply did — with *New* and a search |
| EX-10.2 | The history open | the person searches for *fuel* and nothing matches | it says *No conversation matches "fuel"* with *Clear* |
| EX-10.3 | A conversation in the history | the person opens it | it reopens as it was, with each run's outcome, and the board keeps its drawing while the history shows |
| EX-10.4 | An open conversation | the person reloads, or opens a shared link to it | the same conversation reopens with its answer |
| EX-10.5 | Any open conversation | the person clicks *New* | a blank thread shows with the composer focused on a question; no conversation is listed until the first question |
| EX-10.6 | A new conversation | its first question is asked | it runs in *Everything*, never in the last conversation's view of the graph |
| EX-10.7 | The view of the graph in the composer | the person picks one for this conversation | every later question in it runs in that view, and each turn is tagged with the view it ran in |
| EX-10.8 | *Next ask only* ticked | the person asks | that question runs in the picked view and the composer returns to the conversation's view after it |
| EX-10.9 | A view whose version is not published | the person opens the picker | it is disabled with its reason |
| EX-10.10 | A view that casts what the agent's own rules forbid | the person asks | it is refused before it runs, naming the rule and that it is the agent's |
| EX-10.11 | The conversation's view of the graph is deleted | the person reopens it | the composer reads *Everything* and says the view is gone; earlier turns keep the name they ran in |
| EX-10.12 | The conversation's settings | the person sets a token budget per run above the agent's | it is clamped to the agent's, and the settings say so |
| EX-10.13 | Two members on one Graph | one opens the history | they see only their own conversations |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Conversations | Admin | explore.ask · No conversations | explore.board · No conversation matches | explore.board · Loading conversations | explore.board · Conversations | explore.board · Conversations failed | — | — |
| Conversations | Operator | explore.ask · No conversations | explore.board · No conversation matches | explore.board · Loading conversations | explore.board · Conversations | explore.board · Conversations failed | — | — |
| The view of the graph | Admin | explore.board · Everything | — | — | explore.board · View picked | explore.board · Refused by a rule | — | explore.board · View unpublished |
| The view of the graph | Operator | explore.board · Everything | — | — | explore.board · View picked | explore.board · Refused by a rule | — | explore.board · View unpublished |
| Conversation settings | Admin | — | — | — | explore.board · Settings | — | — | explore.board · Budget clamped |
| Conversation settings | Operator | — | — | — | explore.board · Settings | — | — | explore.board · Budget clamped |
