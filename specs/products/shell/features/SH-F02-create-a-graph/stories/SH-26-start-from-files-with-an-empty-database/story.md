---
id: SH-26
title: Start from files with an empty database
feature: SH-F02
status: idea
personas: [owner, curator]
boards: [start.new_graph.files, start.new_graph.shape, start.new_graph.ready]
---

# SH-26 · Start from files with an empty database

**As** a Graph owner with CSV files and an empty database **I want** to drop my files, see what each becomes and get a
model they fit **so that** I get from files to a first answer without an engineer.

Tasks: [task.md](task.md) · Feature: [SH-F02](../../feature.md)

## Who can

| Lens | Can | Otherwise sees |
|---|---|---|
| Admin | Drop files, answer the agent's questions, accept or change the model, create the Graph | — |
| Operator | The same — the creator is the new Graph's Owner | — |

## Flow

```mermaid
flowchart TD
  f([2 · Drop files]) --> r["The agent reads each file"]
  r --> w["Each file says what it becomes: a kind, or relationships between kinds"]
  w -->|a column it cannot place| q["Asks the person · never guesses"] --> w
  w -->|a file it cannot read| bad["Says why · Remove or replace"] --> f
  w --> s["3 · Shape: the model the files fit"]
  s --> d{"The person decides"}
  d -->|change| s
  d -->|accept| cr["Create graph"]
  cr --> rd(["Ready · loading carries on below · each import checked against the model"])
  rd -->|rows refused| rep["Reported, not written · DA-13"]
  f -->|the command line instead| cli(["The command to load them, filled in for this Graph"])
```

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| SH-26.1 | Step 2 · Drop files | the person drops CSV files | each file shows its name, rows and what it becomes — a kind, or relationships between kinds |
| SH-26.2 | A column the agent cannot place | the file is read | the agent asks what it is, with a recommendation, and does not go on for that file until it is answered |
| SH-26.3 | A file that cannot be read | it is dropped | it says why, with *Remove* and *Replace* |
| SH-26.4 | Step 3 | it opens | the model the files fit is shown before anything is loaded |
| SH-26.5 | The model accepted | the Graph is created | each file loads as an import run, checked against the model, while Ready shows the board |
| SH-26.6 | Rows that do not fit | an import runs | they are reported, not written, and set-up's data step reads what landed (DA-13) |
| SH-26.7 | Step 2 | the person prefers the command line | it shows the command to load the files, filled in for this Graph and model |
| SH-26.8 | An import | the person opens *How it got here* | it shows each file, the kind it became, and the rows written and refused |

## Screens

| Surface | Lens | First use | Empty after a filter | Loading | Has data | Failed | Agent working or proposing | No access |
|---|---|---|---|---|---|---|---|---|
| 2 · Drop files | Admin | start.new_graph.files · No files yet | — | start.new_graph.files · Reading | start.new_graph.files | start.new_graph.files · Cannot read | start.new_graph.files · A column asked | — |
| 2 · Drop files | Operator | start.new_graph.files · No files yet | — | start.new_graph.files · Reading | start.new_graph.files | start.new_graph.files · Cannot read | start.new_graph.files · A column asked | — |
| 3 · Shape | Admin | — | — | start.new_graph.shape · Reading | start.new_graph.shape · From files | — | start.new_graph.shape · Drafting | — |
| 3 · Shape | Operator | — | — | start.new_graph.shape · Reading | start.new_graph.shape · From files | — | start.new_graph.shape · Drafting | — |
| 5 · Ready | Admin | — | — | start.new_graph.ready · Loading below | start.new_graph.ready | start.new_graph.ready · Rows refused | start.new_graph.ready · Loading below | — |
| 5 · Ready | Operator | — | — | start.new_graph.ready · Loading below | start.new_graph.ready | start.new_graph.ready · Rows refused | start.new_graph.ready · Loading below | — |
