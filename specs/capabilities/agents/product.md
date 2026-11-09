---
id: AG
title: Agents
status: idea
owner: Ravi
personas: [builder, admin, owner]
---

# Agents

> Build agents and skills once for the install, see how every run went, and put agents on a schedule.
> The decision it helps make: *which agent is ready to be given work, and on what schedule?*

Pillar: **Agents** — [Pillars and capabilities](../../vision.md#pillars-and-capabilities)

## Problem

An agent nobody can read, test or pin behaves differently every week, and a failed run nobody can open cannot be
fixed. Built separately in every Graph, the same agent drifts into many.

## Users

| Persona | Comes here to |
|---|---|
| Agent builder | Build and version agents and skills, test them with evals, read their runs |
| Install admin | Approve functions, import and export agents and skills |
| Graph owner | Invite agents into the Graph and see how they are doing here |

## Goals

| Goal | Measured by |
|---|---|
| An agent's version, model and skills are pinned, so a run can be repeated as it was | Open — set at the spec review |
| Every failed run opens to why, and to the skill to improve | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| AG-F01 | [Build an agent](features/AG-F01-build-an-agent/feature.md) | AG-21 · AG-26 · AG-29 · AG-36 | idea |
| AG-F02 | [The agents catalogue — invite](features/AG-F02-the-agents-catalogue/feature.md) | AG-35 | idea |
| AG-F03 | [Runs and how the agents are doing](features/AG-F03-runs-and-how-the-agents-are-doing/feature.md) | AG-17 · AG-22 · AG-23 · AG-25 · AG-27 · AG-28 · AG-32 · AG-41 · AG-43 | idea |
| AG-F04 | [Skills](features/AG-F04-skills/feature.md) | AG-19 · AG-20 · AG-30 · AG-37 | idea |
| AG-F05 | [Delegation and outside agents](features/AG-F05-delegation-and-outside-agents/feature.md) | AG-24 · AG-33 · AG-34 | idea |
| AG-F06 | [Plans and functions](features/AG-F06-plans-and-functions/feature.md) | AG-18 · AG-31 · AG-38 · AG-44 | idea |
| AG-F07 | [Schedules](features/AG-F07-schedules/feature.md) | AG-42 | idea |
| AG-F08 | [Portable agents and skills](features/AG-F08-portable-agents-and-skills/feature.md) | AG-39 · AG-40 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Agents | modal | `agents` |
| An agent | sheet | `agents.agent` |
| A new agent | modal | `agents.new` |
| Runs | modal | `agents.runs` |
| A run | sheet | `agents.run` · `agents.run.answer` |
| Skills · a skill | modal · sheet | `agents.skills` · `agents.skill` |
| Schedules | modal | `agents.schedules` |

## Decisions

| Decision | Detail |
|---|---|
| Built once, invited everywhere | Agents and skills are built and versioned in the install's catalogue; a Graph invites an agent as a member and gives it access, never its definition, budget or instructions |
| Core agents | The agents and skills that ship with Invana are added to every Graph and never removed from it |
| Functions are read-only | A function comes from a plugin an Admin enables, or a library whose functions an Admin approves; never authored in Studio |
| Plans are never drawn by hand | A plan is generated from instructions, packaged with a plugin, or promoted from one that served |
| An agent picks no model and no view of the graph | It carries standing limits — what it may do, effort, its token budget, its own rule; the view of the graph comes with the work, and the model version is its pin or the view's |
| Bounds nest, and each says its name | What an agent may do, the work's view of the graph, the graph's rules, its token budget, its helpers' depth and count, and the graph's runs at once each bound a run; each refuses before anything runs, naming the side that bound it (AG-F01 · AG-F05) |
| A helper is never wider than its parent | Its tokens come from its parent's, its view of the graph is its parent's or narrower, and it retires with the work (AG-F05) |
| Nothing that ran is deleted | A retired agent or helper keeps its row and its name, so every run and who made whom still resolves |
| Limits read as a table | Each limit's value beside what it bounds — set once, read often — never a form of inputs |
| Every run reads one way | Runs, how agents are doing and every hand-off read from the same stored runs, so no two numbers disagree (AG-F03) |
| Skills are offered, never obeyed | A step is offered the skills its agent holds, each as its own item, and says which it applied; the gap between offered and applied is what a person acts on — rewrite the skill, or take it off the agent. A skill is never enforcement: what must hold is a bound on the agent or a checked rule (MO-F06) (AG-F04) |
| A skill reaches a step only through its agent | A skill no agent holds exists but is never offered |
| What a step was given is kept by version | A step records the version of each skill it was offered, so a trace shows what it was given, not what the skill says today; evidence counts per version |
| One skill, one plan | A skill version draws as exactly one plan; instructions that cannot be drawn as a plan are a rule, not a skill (AG-F04 · AG-F06) |
| A plan is chosen before one is made | A run takes a plan from the library that fits its intent; it generates one only when none fits (AG-F06) |
| Where a plan came from is always in the trace | Chosen, generated or promoted, the plan and its origin show on the run |
| A person promotes a plan | A plan that served becomes a candidate; only a person puts it in the library (AG-F06) |
| A plan's steps are not tasks | A step that needs a person asks in the run; if the person owns it beyond the run, the step raises a task in Projects |
| Invana's own plans are in the library | The plans Invana ships are listed with their origin, read and reused like any plan, and never edited or retired |

## Depends on

| Product or capability | For |
|---|---|
| Runtime | AI models, workers and plugins |
| Access | Asks before an agent sends, changes or spends |

## Not building

| Item | Why not |
|---|---|
| Authoring a plan by hand | Plans are generated, packaged or promoted |
| An agent defined inside one Graph | An agent is built once for the install and invited |
| An agent's memory across runs | What runs teach goes into the graph as records an agent reads (EX-F07), or into skills a person edits |
| Agents accepting their own work | Accepting work is a person's act in Projects (PJ-F02) |
| A run that reaches into another graph | The graph is the reasoning boundary; an agent invited into two graphs runs in each separately |
| Ranking skills, or picking them by similarity | A skill is offered or it is not; its *when to use* is written by a person and can be read |
| A skill an agent rewrites by itself | A suggested change waits for a person (EX-F07) |
| Promoting a plan automatically when it served | Promotion is a person's call; serving only makes it a candidate |
| Editing an Invana plan | Its steps are the engine's functions; a changed copy names a plan nothing can run |
| A separate plan language for loading data | A load of many datasets is an ordinary plan that reuses the one-dataset load |
