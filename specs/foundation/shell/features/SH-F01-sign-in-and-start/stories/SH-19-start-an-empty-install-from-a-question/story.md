---
id: SH-19
title: Start an empty install from a question
feature: SH-F01
status: idea
personas: [owner, admin]
boards: [start.home]
---

# SH-19 · Start an empty install from a question

**As** the first person on a new install **I want** to be asked what I am trying to decide and offered three ways in
**so that** an empty install is a start, not a wall.

Tasks: [task.md](task.md) · Feature: [SH-F01](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Create a graph · Start from data · Try a sample Graph, or read how a sample Graph is loaded when there is none | — |
| Operator | Create a graph (they become its Owner) · Start from data as DA-F01 allows · Try a sample Graph they are a member of | No sample Graph to open: *No sample Graph here yet — Ask an Admin* |

## Flow

```mermaid
flowchart TD
  h([Home, no Graph to open]) --> q["What are you trying to decide?"]
  q -->|Create a graph| cg(["SH-F02 · Create a graph, the question carried in"])
  q -->|Start from data| d(["Data · upload a dataset"])
  q -->|Try a sample Graph| s{"A sample Graph I can open?"}
  s -->|yes| ex(["Explore, in the sample Graph, with its suggested questions"])
  s -->|no, Admin| how["How a sample Graph is loaded, with the command"]
  s -->|no, Operator| ask["No sample Graph here yet — Ask an Admin"]
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SH-19.1 | A person with no Graph to open, and none archived | Home opens | it asks *What are you trying to decide?* and offers *Create a graph* · *Start from data* · *Try a sample Graph*, in that order |
| SH-19.2 | The question answered | the person picks *Create a graph* | Create a graph opens with the answer as the Graph's question (SH-21) |
| SH-19.3 | First run | the person picks *Start from data* | Data opens on upload (DA-F01) |
| SH-19.4 | A sample Graph the person can open | they pick *Try a sample Graph* | it opens in Explore with its suggested questions |
| SH-19.5 | No sample Graph on the install | an Admin picks *Try a sample Graph* | it says how a sample Graph is loaded, with the command to copy |
| SH-19.6 | No sample Graph on the install | an Operator picks *Try a sample Graph* | it reads *No sample Graph here yet — Ask an Admin* |
| SH-19.7 | First run | the person reads it | nothing it offers is experimental, and it promises nothing the install does not have |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| Home | Admin | start.home · First run | — | start.home · Loading | — | start.home · Could not load | — | — |
| Home | Operator | start.home · First run | — | start.home · Loading | — | start.home · Could not load | — | start.home · First run · No sample Graph |
