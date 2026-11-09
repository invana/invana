---
id: IN
title: Inbox
status: idea
owner: Ravi
personas: [analyst, owner, builder, decision-maker]
---

# Inbox

> Answer what waits on you, see what is running, and read what people and agents did — in one place, over the work.
> The decision it helps make: *which ask to approve or refuse, and which run to stop?*

## Problem

An agent that must ask before it sends, changes or spends is useless if the ask is lost; a run nobody can see is one
nobody can stop; and a Graph whose history nobody can read cannot be audited.

## Users

| Persona | Comes here to |
|---|---|
| Analyst · Decision maker | Answer the asks and notifications waiting on them; see whether their runs are moving |
| Graph owner | Allow access, budget and sends; write the rules that tell people; read and export who did what |
| Agent builder | See what is running and what ran; compare a new version with the one before |

## Goals

| Goal | Measured by |
|---|---|
| No ask waits unseen; at its deadline it is *expired, not sent*, never approved | Open — set at the spec review |
| Every act by a person or an agent is in History, append-only and provably unedited | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| IN-F01 | [Needs you — approvals and notifications](features/IN-F01-needs-you/feature.md) | IN-01 · IN-04 · IN-05 | idea |
| IN-F02 | [Running — what runs and what ran](features/IN-F02-running/feature.md) | IN-06 | idea |
| IN-F03 | [History — what people and agents did, and every change](features/IN-F03-history/feature.md) | IN-02 · IN-03 | idea |

## What it holds

| Holds | For |
|---|---|
| Asks | What an agent or a run waits on a person for — access, budget, a delegation, a send, a question — and what each decided |
| Notifications, rules and channels | Who is told of what, in the Inbox and outside it |
| A reading of the runs | What runs now and what ended today; the runs themselves are Agents' |
| History | One append-only record of every act and every write, read as rows, by actor, by record, by refusal and as changes |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Inbox — Needs you · Updates · Running · Done | modal | `inbox` |
| History | modal | `inbox.history` |
| Settings › Notifications — rules and channels | modal | `settings.notifications` |

## Rules

| Rule | Detail |
|---|---|
| Every write is in History | Graph, model, skill, rule, agent, task, load, connection — none is silent; the actor and whom it acted for are kept apart, and what caused it is linked |
| One record, many readings | History, a run's history, the evidence memory draws on and how the agents are doing all read the same record; none copies it |
| Numbers come from the record | What is slow, what spends and what fails are counted from stored runs and History, never from a second pipeline |
| Nothing leaves without a person | An outward send waits for an ask unless a schedule's owner switched it off for that schedule; an ask is never decided by itself |
| Everything later happens on one clock | Schedules, deliveries, rules and ask deadlines run on one clock that repeats nothing after a restart |
| History removes windows, never rows | Old rows go a whole window at a time, and the removal is a row |

## Decisions

| Decision | Detail |
|---|---|
| One inbox | Needs you · Running · History are the three parts of one summoned modal; Needs you carries Updates beside it and Running carries Done. A count on its leftNav icon says what needs the person |
| Only a person answers an ask | An agent never approves an ask, its own or another's |
| Runs are not History | Running reads what executed; History reads what people and agents did; neither is drawn from the other |
| One record of runs | Agents › Runs is the full list; the Inbox and Data's import history read the same runs |

## Depends on

| Product or capability | For |
|---|---|
| Agents | The runs and the asks agents raise (AG-F03) |
| Projects | Project work in Needs you (PJ-F02) |
| Settings › You | Where each person's notifications are sent |

## Not building

| Item | Why not |
|---|---|
| Editing history | History is append-only |
| A second pipeline for numbers | It would drift from the record it describes |
| On-call routing, escalation chains, quiet hours | A rule names its people and channels; paging is a monitoring platform's job |
| A feed per person | History is read per subject — a run, an agent, a record, the Graph |
| A *job* | A run and its steps already name it |
| Retry or re-run from the Inbox | A run is re-run where it was started, with its own inputs |
