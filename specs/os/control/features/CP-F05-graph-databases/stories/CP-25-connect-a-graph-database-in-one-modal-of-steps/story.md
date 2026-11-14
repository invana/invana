---
id: CP-25
title: Connect a graph database in one modal
feature: CP-F05
status: idea
personas: [admin]
boards: [settings.databases]
---

# CP-25 · Connect a graph database in one modal

**As** an Admin **I want** to connect a graph database by naming it, proving the connection and seeing the model the
agent drafts from what is there — on one page **so that** it joins Graph Data with a name people recognise,
read-only and off until I decide otherwise.

Tasks: [task.md](task.md) · Feature: [CP-F05](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Every section; *Connect* saves the graph database read-only and off | — |
| Operator | — | *Connect a graph database* reads *Ask an Admin*; the modal never opens for them |

## Flow

```mermaid
flowchart TD
  o([Connect a graph database]) --> m["One modal · numbered sections · one act"]
  m --> s1["1 · Name — optional · description"]
  s1 -->|name taken or not a valid name| t["Says why in place"]
  m --> s2["2 · The type · a card grid grouped Cypher · Gremlin · Files"]
  s2 -->|a database| s3["3 · Its details appear · CP-26 · test"]
  s2 -->|Files| s3f["3 · Drop files into an empty one · CP-27"]
  s3 -->|test passes| s4["4 · Shape appears: the agent's draft, or a starting point"]
  s3f --> s4
  s4 --> cn{"Connect"}
  cn -->|refused| rf["Says why · every answer kept"] --> m
  cn -->|saved| rd(["Ready · read-only · off · Turn it on · set-up's next step"])
  o -->|Esc before Connect| x(["Nothing saved · nothing kept"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-25.1 | *Connect a graph database* | it opens | one modal on one page of numbered sections — **1** Name (optional) · **2** the type as a card grid grouped *Cypher · Gremlin · Files* — with one act, *Connect*, disabled until the sections it needs are filled; no step strip |
| CP-25.2 | Section 1 | the Admin types a name | it is checked as they type: lowercase letters, digits and `_`, and it says the name is how rules will name it; left blank, the name the engine will give — the type's, made unique (`neo4j`, `neo4j_2`) — shows as its placeholder |
| CP-25.3 | A name another graph database holds, or with other characters | it is typed | section 1 says why and *Connect* stays disabled |
| CP-25.4 | Section 2 | the Admin picks a card | section 3 appears beneath with that type's details — the connection and its test for a database (CP-26), *Drop files* for files into an empty one (CP-27); picking another card replaces section 3 |
| CP-25.5 | The test passed or the files read | section 4, *Shape*, appears and the Admin decides | they accept the agent's draft, change it, or pick an ontology, a starter, a description or blank (SE-F01) |
| CP-25.6 | Any moment before *Connect* | the Admin closes the modal | no graph database, credential or draft is saved |
| CP-25.7 | *Connect* | it succeeds | the graph database is saved read-only and off, its credential sealed, the draft model kept as a draft; History records who connected it |
| CP-25.8 | *Connect* succeeds | Ready replaces the sections, and | it says the graph database is read-only and off, with *Turn it on* (CP-39) and set-up's next step (CP-24) |
| CP-25.9 | *Connect* | the engine refuses — the test fails again, the name was taken meanwhile | it says why and keeps every answer |
| CP-25.10 | Ready | the Admin opens *How it got here* on the draft | it shows the agent's run that drafted it, the schema it read and what it left out |
| CP-25.11 | An Operator | they reach *Connect a graph database* | it reads *Ask an Admin*, naming the Admins |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Name and type | Admin | settings.databases · Connect | — | — | settings.databases · Connect · Type picked | settings.databases · Connect · Name taken | — | — |
| Name and type | Operator | — | — | — | — | — | — | settings.databases · Read only |
| 4 · Shape | Admin | settings.databases · Connect · Shape · A starting point | — | settings.databases · Connect · Shape · Reading | settings.databases · Connect · Shape | settings.databases · Connect · Shape · Unreachable | settings.databases · Connect · Shape · Drafting | — |
| 4 · Shape | Operator | — | — | — | — | — | — | — |
| Ready | Admin | settings.databases · Connect · Ready | — | — | settings.databases · Connect · Ready | settings.databases · Connect · Ready · Could not connect | settings.databases · Connect · Ready · Drafting below | — |
| Ready | Operator | — | — | — | — | — | — | — |
