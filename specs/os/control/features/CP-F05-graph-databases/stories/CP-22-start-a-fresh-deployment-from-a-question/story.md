---
id: CP-22
title: Start a fresh deployment from a question
feature: CP-F05
status: idea
milestone: MVP
personas: [admin, analyst]
boards: [start.home]
---

# CP-22 · Start a fresh deployment from a question

**As** the first person on a fresh deployment **I want** to be asked what I am trying to decide and offered the way in
**so that** an empty deployment is a start, not a wall.

Tasks: [task.md](task.md) · Feature: [CP-F05](../../feature.md)

## Who can

| Access | Can | Otherwise sees |
|---|---|---|
| Admin | Answer the question · *Connect a graph database* · *Try it on demo data* when a demo graph database is on | — |
| Operator | Answer the question · *Try it on demo data* when a demo graph database is on | *Ask {Admin}* stands where *Connect a graph database* would, naming an Admin, and raises the ask |

## Flow

```mermaid
flowchart TD
  h([Home · no graph database on]) --> q["What are you trying to decide?"]
  q -->|Connect a graph database, an Admin| cg(["CP-25 · Connect a graph database"])
  q -->|an Operator| ask(["Ask {Admin} · the ask reaches the Admins"])
  h -->|before set-up starts| lock["Mode switches disabled · Opens when set-up starts"]
  q -->|Try it on demo data| d{"A demo graph database on?"}
  d -->|yes| ex(["Explore, on the demo graph database, with suggested questions"])
  d -->|no| none["Not offered"]
  q -->|the question| keep(["Kept for the first ask · put in the Assistant's composer when set-up is done"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| CP-22.1 | A deployment with no graph database on | a person signs in and Home opens | it asks *What are you trying to decide?* and offers *Connect a graph database* and, when a demo graph database is on, *Try it on demo data* |
| CP-22.2 | The question answered | an Admin picks *Connect a graph database* | the connect modal opens (CP-25) |
| CP-22.3 | The question answered | set-up's four steps are done | the Assistant's composer holds the answer, never sent until the person sends it |
| CP-22.4 | A demo graph database on | the person picks *Try it on demo data* | Explore opens on it with suggested questions |
| CP-22.5 | No demo graph database | Home draws | *Try it on demo data* is not offered |
| CP-22.6 | An Operator | Home draws | it offers *Ask {Admin}*, naming an Admin, where an Admin sees *Connect a graph database*; picking it sends the ask to the Admins' Inbox (AC-F05) |
| CP-22.7 | First use | the person reads it | nothing it offers is experimental, and it promises nothing the deployment does not have |
| CP-22.8 | Home | it cannot read the graph databases | it says what it could not read, with *Try again* |
| CP-22.9 | A deployment before set-up starts — no graph database connected and nobody has picked *Try it on demo data* | anyone reads the switcher or presses ⌘1–⌘4 | Explore, Model, Projects and Agents are disabled, reading *Opens when set-up starts*; Home is the only place |
| CP-22.10 | Set-up started | Home draws | it shows set-up as *n of 4* (CP-24); once the four are done, the first answer |
| CP-22.11 | Home before set-up | the leftNav is read | it holds no views — only the summoners |

## Screens

| Surface | Access | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Home | Admin | start.home · First use | — | start.home · Loading | start.home · Demo data | start.home · Could not load | — | — |
| Home | Operator | start.home · First use · Ask an Admin | — | start.home · Loading | start.home · Demo data | start.home · Could not load | — | start.home · First use · Ask an Admin |
| A typed question | Admin | — | — | start.home · Set-up · Drafting | start.home · Set-up | — | — | — |
| A typed question | Operator | — | — | — | — | — | — | start.home · First use · Ask an Admin |
