---
id: PJ
title: Projects
status: idea
owner: Ravi
personas: [decision-maker, analyst]
---

# Projects

> Pursue a question to a decision: split it into tasks people and agents take, fork it into branches, weigh findings
> for and against, and decide with a trail anyone can follow.

Pillar: **Evidence** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

A decision taken in a meeting or a chat leaves no trail: nobody can see which evidence it rested on, which options
were dropped and why, or re-open it when a load it rests on is undone.

## Users

| Persona | Comes here to |
|---|---|
| Decision maker | Run a project of their type, fork branches, read findings, take a decision, publish a report |
| Analyst | Take a task, add a finding from a board |

## Goals

| Goal | Measured by |
|---|---|
| Every decision cites the findings, runs and loads it rests on | Settled — a decision's lineage opens every finding it cites and their run and load cites (PJ-11) |
| An agent proposes forks and decisions; a person accepts or rejects them | Settled — only a person who can work on projects accepts or rejects a proposal, recorded in their name (PJ-05.8–PJ-05.11 · PJ-08.11) |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| PJ-F01 | [Projects and tasks](features/PJ-F01-projects-and-tasks/feature.md) | PJ-01 · PJ-02 · PJ-12 · PJ-15 · PJ-18 | idea |
| PJ-F02 | [Objectives and review](features/PJ-F02-objectives-and-review/feature.md) | PJ-16 · PJ-17 | idea |
| PJ-F03 | [Branches, findings and decisions](features/PJ-F03-branches-findings-and-decisions/feature.md) | PJ-03 · PJ-04 · PJ-05 · PJ-06 · PJ-07 · PJ-08 · PJ-11 · PJ-13 | idea |
| PJ-F04 | [Simulation and impact](features/PJ-F04-simulation-and-impact/feature.md) | PJ-09 · PJ-10 | idea |
| PJ-F05 | [Project reports](features/PJ-F05-project-reports/feature.md) | PJ-14 | idea |
| PJ-F06 | [Alerts](features/PJ-F06-alerts/feature.md) | PJ-19 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Projects | mode | `projects.list` |
| A project | mode | `projects.project` |
| A new project | modal | `projects.new` |
| A task | mode | `projects.task` · `projects.task.thinking` · `projects.task.from_board` |
| Options and a decision | mode · modal | `projects.options` · `projects.decide` |
| A finding | peek | `projects.finding` |
| A report | sheet | `projects.report` |
| A project's alerts | mode | `projects.alerts` |

## Decisions

| Decision | Detail |
|---|---|
| Experimental | Projects is shown and labelled *Experimental*, not launched, until workers, agents, Explore and Model are strong; nothing is hidden behind a setting |
| Flat projects | A project has no sub-projects; branches live inside it and are never sub-projects. Tasks nest: sub-tasks to any depth for people, bounded by the run's limits for agents (PJ-F01) |
| A project is a repository | Tasks are issues: people ask, agents answer, and @ an agent gives it work |
| One question, of one type | A project pursues one question. Its type — Research · Investigation · Policy · General, or one a Domain pack adds — relabels Project, Task, Branch, Finding and Decision inside the project only, and carries default rules, suggested agents and skills and a report template (PJ-F03). The engine, the API and every shared place say the generic words; changing the type later only relabels |
| A task needs no project | A task may sit in no project, so a small Graph never needs a catch-all project; routine work is a schedule (AG-F07) |
| A task needs no plan | A person given a task with criteria and no steps is the smallest case; it uses no field it does not need |
| A task is worked through an agent | The agent brings its AI model, skills and bounds; assigning a task to an agent opens one run, on behalf of whoever assigned it |
| A task's state is its latest run's | Open · assigned · in progress · needs input · blocked · in review read off the run; only *done*, *failed* and *cancelled* are written — by a person accepting, rejecting or cancelling |
| Only a person decides | An agent posts results, adds findings and proposes forks and decisions; accepting a task, a verdict and a decision are always a person's |
| Agents may raise tasks | From inside a run, for a helper or for a person; handing work to another agent and raising a task are the same act |
| A plan's steps are never tasks | A run's steps — a query, a model call, a step a person does — are its plan's; a task is work someone accepts. No screen calls either a *job* |
| A private project hides for everyone else | Only the people staffed on it see it — an Admin included; every read of projects, tasks, decisions and search hides it alike |
| Archiving freezes | An archived project and its tasks read only; runs already going finish |
| Loads used are cited ones | A project's loads are the ones its findings cite, by stable id and content hash; records it saves are derived records in a kind |
| Generic by design | No project type, story or word is domain-specific; a domain arrives as a Domain pack (RT-F02) |

## Depends on

| Product or capability | For |
|---|---|
| Explore | The boards findings come from |
| Agents | The agents that take tasks and propose |
| Records | The loads a simulation is pinned to, and the derived records it saves |
| Semantics | The rules that check a decision, and the alert rules that open leads (SE-F07) |

## Not building

| Item | Why not |
|---|---|
| Sub-projects | Branches carry the forks |
| Parameter sweeps · game theory | After 1.0 |
| Criterion weights and waivers | A criterion is met, unmet or needs a person |
| Per-project roles | Graph roles govern every write; a private project only narrows who sees it |
| Gantt charts, sprints, story points, time tracking | Projects are decision quests, not project management |
| Projects spanning Graphs | A project lives in one Graph |
| Writing project types in Studio | Built-in types and Domain packs (RT-F02) |
| Soft deletes, trash, undo | Archiving covers the need |
| Agents deciding on their own | Agents propose; people decide |
