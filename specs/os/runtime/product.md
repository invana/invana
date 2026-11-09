---
id: RT
title: Runtime
status: idea
owner: Ravi
personas: [admin, builder, owner]
---

# Runtime

> What does the work, within which limits: the AI models agents may pin, plugins and outside tools, the sandbox
> skill scripts run in, the workers and the queue that run every step, and each Graph's limits — set by an install admin, read everywhere.
> The decision it helps make: *what may agents run on, and where is work waiting?*

## Problem

Without limits an install can be spent dry by one Graph's agents; a run that waits with no reason given is one nobody
can unblock; and an agent can only do what the models and tools offered to it allow.

## Users

| Persona | Comes here to |
|---|---|
| Install admin | AI models, plugins and outside tools, workers, each Graph's limits |
| Agent builder | Pin a model version; see why a run waits and ask for more |
| Graph owner | Let outside callers use this Graph; read its limits |

## Goals

| Goal | Measured by |
|---|---|
| An install's spend stays inside each Graph's limits | Open — set at the spec review |
| A waiting run always says why | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| RT-F01 | [AI models](features/RT-F01-ai-models/feature.md) | RT-01 | idea |
| RT-F02 | [Plugins and outside tools](features/RT-F02-plugins-and-outside-tools/feature.md) | RT-02 · RT-03 · RT-04 | idea |
| RT-F03 | [Workers and the queue](features/RT-F03-workers-and-the-queue/feature.md) | RT-05 · RT-06 · RT-07 · RT-08 · RT-09 · RT-10 | idea |
| RT-F04 | [Limits](features/RT-F04-limits/feature.md) | RT-11 · RT-12 · RT-13 · RT-14 | idea |
| RT-F06 | [Skill scripts](features/RT-F06-skill-scripts/feature.md) | RT-15 · RT-16 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| AI models | modal | `settings.ai` |
| Workers | modal | `settings.workers` |
| Usage and limits | modal | `settings.usage` |

## Decisions

| Decision | Detail |
|---|---|
| The install's, read by every Graph | AI models, plugins, workers and each Graph's limits are set by an install admin; a Graph reads them and never changes them |
| Allow never passes a limit | Allow on a spend never passes an access rule's limits or the Graph's (RT-F04) |
| Everything later happens on one clock | Schedules, deliveries, rules and ask deadlines run on one clock that repeats nothing after a restart |
| Tokens, never currency | Every budget, limit, usage figure and alert is in tokens |

## Depends on

| Product or capability | For |
|---|---|
| Access | The lines that reach a model, a tool or a spend; asks for a higher limit (AC-F05) |
| Graph | Each Graph's usage (GR-F04) |
| Agents | The runs the workers execute (AG-F03) |

## Not building

| Item | Why not |
|---|---|
| A Graph raising its own limits | The install controls cost and capacity |
| Autoscaling, cloud APIs | A person adds workers; Invana says how many |
