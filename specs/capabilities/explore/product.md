---
id: EX
title: Explore
status: idea
owner: Ravi
personas: [analyst, decision-maker, modeller]
---

# Explore

> Ask the Graph a question in plain words, and read, keep and share an answer you can trace to its records.
> The decision it helps make: *does this answer hold up well enough to act on and share?*

Pillar: **Evidence** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

An analyst who cannot write queries waits on someone who can, and an answer they cannot trace to its records is one
they cannot defend. Without a board to keep it on, every answer is lost the moment the next question is asked.

## Users

| Persona | Comes here to |
|---|---|
| Analyst | Ask, look at the answer on a board, keep the board and share it |
| Decision maker | Find the evidence a branch of a project needs |
| Modeller | See what the data looks like under the model |

## Goals

| Goal | Measured by |
|---|---|
| A question in plain words gets a grounded answer, or says plainly it cannot | Open — set at the spec review |
| Every answer is traceable to its records in one click | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| EX-F01 | [The board and its canvas](features/EX-F01-the-board-and-its-canvas/feature.md) | EX-07 · EX-09 · EX-14 · EX-16 · EX-18 · EX-21 | idea |
| EX-F02 | [Share and present an answer](features/EX-F02-share-and-present-an-answer/feature.md) | EX-12 · EX-15 · EX-17 · EX-22 | idea |
| EX-F03 | [Ask a question](features/EX-F03-ask-a-question/feature.md) | EX-01 · EX-08 · EX-10 · EX-11 · EX-13 · EX-23 · EX-28 | idea |
| EX-F04 | [The answer](features/EX-F04-the-answer/feature.md) | EX-02 · EX-03 · EX-04 · EX-25 | idea |
| EX-F05 | [When it cannot answer, and how it reasons](features/EX-F05-when-it-cannot-answer-and-how-it-reasons/feature.md) | EX-05 · EX-06 · EX-24 · EX-26 · EX-27 | idea |
| EX-F06 | [Annotate and edit the data](features/EX-F06-annotate-and-edit-the-data/feature.md) | EX-19 · EX-20 | idea |
| EX-F07 | [Memory — what past runs teach](features/EX-F07-memory-what-past-runs-teach/feature.md) | EX-29 · EX-30 · EX-31 · EX-32 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| A board and its canvas | mode | `explore.board` |
| Asking | mode | `explore.ask` |
| A dashboard | mode | `explore.dashboard` |
| Why? | peek | `explore.board.why` |
| Share | modal | `explore.share` |
| Compare | sheet | `explore.compare` |

## Decisions

| Decision | Detail |
|---|---|
| Explore is the simplest product | Asking, answers, manual board tools and conversations live here; agent tuning never does |
| One assistant | The assistant sits on the right of every mode with the selection in hand |
| The board selects, the panel states or edits | Never the reverse. A click makes one selection on every kind of board; the panel says what it is and where it came from, and edits only where the board's kind allows it |
| Inspect is the default | Editing is a mode entered on purpose; edits stay on the board, visible and reversible, until saved |
| An answer draws onto the board | It adds to what is there and never replaces it |
| Boards are named, saved and versioned | Autosave never overwrites history; going back makes a new version |
| The console spans the board only | The left section and the assistant stay full height; the console describes the drawing |
| Every answer is grounded | It states only what the records hold and cites the query and records behind each part; zero rows is *Cannot answer*, never a guess; a cannot answer is never answer-shaped, and a failure is never a cannot answer (EX-F05). Facts from beyond the Graph appear only when a rule allows them, marked *Third-party* |
| Nothing runs outside a run | Nothing in a conversation reaches an AI model, the graph database or the Graph except through a run of a plan — a packaged plan matched to the question, else one generated for it — so every answer can be traced and every limit enforced |
| How a run comes together | The agent decides what is possible, the plans decide what is tried, the rules and skills decide what it knows, and *What it may do* is checked before anything runs |
| One question, one run | A conversation is a thread of runs, not a run. The run is what is governed — its view of the graph, token budget, *What it may do* and *Asks first* — so two questions in one thread can be grounded differently and spend separately |
| A conversation carries defaults | Its view of the graph and its tokens per run, capped by the agent's own; one question may narrow either, and the run keeps what it started with |
| The view of the graph names the AI model | The composer offers how to ask and the view of the graph, never a model |
| Steps show as they happen | Nothing waits for the end of a run to appear |
| An answer's part reads the same everywhere | Its kind, template and citation look the same in the thread, on a task and in a scheduled answer |
| An agent has no memory of its own | What it knows next time is a record in the Graph it reads with a planned, cited step, or a change a person accepted on the evidence of what happened (EX-F07) |
| Improvement is a version a person accepts | Never a weight that shifts; each accepted change predicts what it improves and is measured against it |
| Explore hands on | *Schedule this* → Agents › Schedules · *Add to a project* → Projects · *Ask for a change* → Model |
| Seams | An empty board says what it is for and the act that fills it · a large result states its count before it finishes drawing · an element gone from the graph stays, marked missing · nothing picked: the panel says what a selection would show |

## Depends on

| Product or capability | For |
|---|---|
| Model | The published models every question is grounded in |
| Agents | The agents and skills that answer |
| Access | Who may ask, and the views of the graph a question may pick |

## Not building

| Item | Why not |
|---|---|
| Styling a single element on the canvas | Colour by type and the board's styling cover it without a store per element |
| Editing a model in Explore | Model mode owns it |
| Free-form drawing on a board | A board draws what exists; what a person says about it is an annotation on the records |
| Real-time multi-cursor editing | One editor per board with version history is honest at this scale |
| Boards across Graphs | The Graph is the boundary |
| Unmarked outside facts in an answer | The claim is that answers are grounded; anything not from the Graph is marked with its reference (EX-F05) |
| A second place to watch imports run | An import is a run, read the same way as any other |
| Memory carried within a run from turn to turn | Each run is put together from the rules, the skills and the Graph |
