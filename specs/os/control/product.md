---
id: CP
title: Control Plane
status: idea
owner: Ravi
personas: [admin, analyst, builder, modeller]
---

# Control Plane

> What runs, where and within which limits: an overview of workloads by user, agent and team, every run and stopping
> one, ops alerts to the people who can act, the graph databases the deployment connects — each read-only or read +
> write, switched on or off, healthy or not — the AI models agents may pin, plugins and the outside servers they reach,
> the deployment's one MCP server, the sandbox skill scripts run in, the workers and the queue that run every step, the
> limits per team, user and agent that work runs against, ⌘K, and the Inbox with its channels. Set by an Admin, read
> by everyone. The decision it helps make: *what are agents doing, may they run on it, is it healthy, and where is
> work waiting?*

Journeys: [J01 · From a fresh deployment to a first answer](../../journeys/J01-from-a-fresh-deployment-to-a-first-answer.md) ·
[J07 · Ready a deployment](../../journeys/J07-ready-a-deployment.md) ·
[J08 · Watch agent workloads and act on an alert](../../journeys/J08-watch-agent-workloads-and-act-on-an-alert.md)

## Problem

A deployment whose graph databases nobody can see the state of is one nobody trusts: a database that dropped answers
nothing, one left read + write by accident takes writes nobody meant, and one switched off with no reason given is a
dead end. Without limits a deployment is spent dry by one agent; a run that waits with no reason given is one nobody
can unblock; and an agent can only do what the models and tools offered to it allow.

## Users

| Persona | Comes here to |
|---|---|
| Admin | Read workloads by user, agent and team; act on ops alerts and stop a run; connect graph databases and set each one's mode and switch; AI models and whether each is local or external, plugins, outside servers and their credentials, the MCP server, channels, workers, limits per team, user and agent |
| Analyst · Decision maker | See which graph databases and plugins are on and healthy; switch one off for their own runs; connect their own outside accounts; find anything with ⌘K; read what needs them in the Inbox and choose where it reaches them |
| Agent builder | Read their agents' runs and how they are doing; be told when an agent they own needs them and stop its run; test agents in the practice graph database; pin a model version; see why a run waits and ask for more |
| Modeller | See what each graph database holds before shaping the model across them |

## Goals

| Goal | Measured by |
|---|---|
| A fresh deployment reaches its first answer through one modal of steps | Open — set at the spec review |
| Every graph database's mode, switch and health is one glance away | Open — set at the spec review |
| A waiting or refused run always says why, and who can change it | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| CP-F09 | [Overview — workloads by user, agent and team](features/CP-F09-overview/feature.md) | CP-47 | idea |
| CP-F10 | [Runs and how the agents are doing](features/CP-F10-runs-and-how-the-agents-are-doing/feature.md) | CP-48 · CP-49 · CP-53 · CP-50 · CP-58 · CP-51 · CP-52 · CP-54 · CP-55 · CP-56 · CP-57 | idea |
| CP-F11 | [Ops alerting](features/CP-F11-ops-alerting/feature.md) | CP-59 · CP-60 | idea |
| CP-F01 | [AI models](features/CP-F01-ai-models/feature.md) | CP-01 · CP-61 | idea |
| CP-F02 | [Plugins and MCP](features/CP-F02-plugins-and-outside-tools/feature.md) | CP-04 · CP-44 · CP-02 · CP-42 · CP-43 · CP-03 · CP-20 | idea |
| CP-F03 | [Workers and the queue](features/CP-F03-workers-and-the-queue/feature.md) | CP-05 · CP-06 · CP-07 · CP-08 · CP-09 · CP-10 | idea |
| CP-F04 | [Limits](features/CP-F04-limits/feature.md) | CP-11 · CP-34 · CP-12 · CP-13 · CP-14 | idea |
| CP-F05 | [Graph databases](features/CP-F05-graph-databases/feature.md) | CP-22 · CP-25 · CP-26 · CP-27 · CP-24 · CP-38 · CP-39 · CP-40 · CP-35 · CP-41 · CP-17 · CP-18 · CP-19 | idea |
| CP-F06 | [Skill scripts](features/CP-F06-skill-scripts/feature.md) | CP-15 · CP-16 | idea |
| CP-F07 | [Find your way — ⌘K and search](features/CP-F07-find-your-way/feature.md) | CP-30 | idea |
| CP-F08 | [The Inbox — what needs me, and notifications](features/CP-F08-the-inbox/feature.md) | CP-36 · CP-37 · CP-45 · CP-46 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Home — first use and set-up | page | `start.home` · `start.setup` |
| Overview — workloads by user, agent and team | page | `control.overview` |
| Runs — how the agents are doing, every run | modal | `agents` · `agents.runs` · `agents.agent` |
| A run | sheet | `agents.run` · `agents.run.answer` |
| Ops alerts — the list, an alert, thresholds | modal | `control.alerts` · `control.alerts.alert` · `control.alerts.settings` |
| Graph databases — the list, one graph database | modal | `settings.databases` · `settings.databases.database` |
| Connect a graph database | modal | `settings.databases.connect` · `settings.databases.connect.files` · `settings.databases.connect.shape` · `settings.databases.connect.ready` |
| ⌘K | modal | `shell.command` |
| Inbox — Needs you · Updates · Running · Done | modal | `inbox` |
| Settings › Notifications — rules and channels | modal | `settings.notifications` |
| Settings › You — outside accounts · where asks reach me | modal | `settings.me` |
| Plugins — every plugin, a plugin, Domain packs | modal | `settings.plugins` |
| An outside MCP server — its tools, how Invana signs in | modal | `settings.plugins.server` |
| The deployment's MCP server — what it serves, recent calls | modal | `settings.mcp` |
| AI models | modal | `settings.ai` |
| Workers | modal | `settings.workers` |
| Usage and limits | modal | `settings.usage` |

## Decisions

| Decision | Detail |
|---|---|
| The deployment's, set by an Admin | Graph databases, AI models, plugins, outside servers, the MCP server, channels, workers and limits are set by an Admin and read by everyone ([the role table](../access/features/AC-F02-access-policies/feature.md#the-role-table)) |
| Two switches, new starts off | Graph databases and plugins have the deployment's switch and each person's own; anything new starts off until an Admin turns it on; off is refused before the work starts, naming who switched it off |
| No credential in an environment variable | Graph database credentials, AI model keys, outside servers' secrets and accounts, and channel secrets are sealed under the install key, set with the password again, never read back |
| Allow never passes a limit | Allow on a spend never passes a limit ([CP-F04](features/CP-F04-limits/feature.md)) |
| One record of runs | Every run is one row of [CP-F10](features/CP-F10-runs-and-how-the-agents-are-doing/feature.md); the overview, Runs, the Inbox's Running and ops alerts all read it |
| Those it costs can stop it | The person behind a run, its agent's owners and the Admins stop it; whoever acts on an ops alert closes it |
| Everything later happens on one clock | Schedules, deliveries, rules and ask deadlines run on one clock that repeats nothing after a restart |
| Tokens, never currency | Every budget, limit, usage figure and alert is in tokens ([glossary › Token budget](../../glossary.md#what-may-happen)) |

## Depends on

| Product or capability | For |
|---|---|
| Access Plane | The rules that reach a graph database, a model, a tool or a spend; asks for a higher limit ([AC-F05](../access/features/AC-F05-asks-and-approvals/feature.md)); History |
| Ontology | The one model across the graph databases |
| Agents | The runs the workers execute |

## Not building

| Item | Why not |
|---|---|
| Autoscaling, cloud APIs | A person adds workers; Invana says how many |
| Workspaces, tenants or a unit inside the deployment | One deployment is everything; multi-tenancy is out of scope |
