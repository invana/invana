---
id: GP
title: Graph Plane
status: idea
owner: Ravi
personas: [analyst, builder, modeller, decision-maker, admin]
---

# Graph Plane

> What Invana reads and what it remembers: **Data** — the customer's Graph, read in place through a connector per
> graph database, in each database's own language, joined across graph databases on identity links — and **Memory** —
> Invana's own graph of the work: activity, runs, sessions, hand-off notes, tasks, findings, decisions and their
> relations, each with its lineage. The decision it helps make: *what does this answer rest on, and what has been
> learned and decided before?*

Journeys: [J02 · Ask and trust the answer](../../journeys/J02-ask-and-trust-the-answer.md) ·
[J04 · Build an agent and improve it from what runs teach](../../journeys/J04-build-an-agent-and-improve-it-from-what-runs-teach.md)

## Problem

An answer is trusted only when it reads the customer's records where they are, the same way whichever database holds
them, and when the work behind it — what ran, what was found and decided, and what each copy came from — can be
followed back. Without one home for both, every capability reads the databases its own way and keeps its own memory.

## Users

| Persona | Comes here to |
|---|---|
| Analyst · Decision maker | Ask across every graph database as one Graph; follow a decision back to its sources in Memory; see what any copy was read from and know it shows only as far as their own agent may read |
| Agent builder | See what agents' runs left in Memory, what served and what failed |
| Modeller | Rely on one shape of answer from every connector while shaping the model across them |
| Admin | Trust that every read is a read the database enforces, every raw query is checked and every call is recorded; the Admin's controls for graph databases are [CP-F05](../control/features/CP-F05-graph-databases/feature.md) |

## Goals

| Goal | Measured by |
|---|---|
| A question answers in one shape whichever vendors hold its records | Open — set at the spec review |
| Every decision in Memory opens to the records it cites | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| GP-F01 | [Data — the customer's Graph, read in place](features/GP-F01-data/feature.md) | GP-01 · GP-02 · GP-04 · GP-05 | idea |
| GP-F02 | [Memory — Invana's own graph of the work](features/GP-F02-memory/feature.md) | GP-03 · GP-06 · GP-07 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Memory — the thinking graph, a node and its sources | page | `agents.thinking` |
| A copy's sources, and a copy redacted | panel | `graph.memory.lineage` |
| A raw query refused or filtered | — | `explore.board.console` — the console is [EX-F03](../../capabilities/explore/features/EX-F03-ask-a-question/feature.md)'s |
| A step through a connector | — | No board: the asking surface — Explore, a board, a run — is its own story's |

## Decisions

| Decision | Detail |
|---|---|
| Two graphs, never mixed | **Data** is the customer's Graph: their records, read in place and never copied. **Memory** is Invana's own graph, held in the system graph: never customer data — record IDs and keyed hashes, never a record's values |
| The Admin's controls stay in Control | Installing a connector, connecting a graph database, its mode, switches, health and practice graph databases are [CP-F05](../control/features/CP-F05-graph-databases/feature.md)'s; how a connector reads and writes is Data's |
| Thinking stays in Agents | What an agent learns from Memory — recall, outcome labels, marks, evidence and suggested changes — is [AG-F09 · Learn from memory](../../capabilities/agents/features/AG-F09-learn-from-memory/feature.md)'s; Memory is the store it reads |
| One memory, no team memory | Memory is one for the deployment: project memory sits on its project, agent learnings on their agent, org knowledge on the deployment. No team holds memory of its own |
| Org knowledge is promoted by a person | An agent only proposes org knowledge; a person promotes it. A learning stays on its agent, attributed to who gave the feedback |
| Every read is read-only at the database | Every read opens a read-only session its connector gets from the database, and a connector is listed as supported only when it passes the certification test ([GP-04](features/GP-F01-data/stories/GP-04-trust-that-a-read-never-writes/story.md)). A raw query passes four layers — a static check, a read-only session, a result filter, Gremlin steps only ([GP-05](features/GP-F01-data/stories/GP-05-run-a-raw-query-within-what-the-agent-may-read/story.md)) |
| Every copy has lineage | An answer, a finding, a report, a snapshot, a transcript, a note, a memory node and an export each record their sources and show only as far as the viewer's default agent may read them; a memory node inherits its sources' resources ([GP-06](features/GP-F02-memory/stories/GP-06-see-where-any-excerpt-came-from-and-who-may-see-it/story.md) · [GP-07](features/GP-F02-memory/stories/GP-07-read-memory-only-as-far-as-its-sources-allow/story.md)) |
| Postgres is the truth | Memory follows Postgres through the outbox and is rebuilt from History ([system-design § 6](../../system-design.md#6-data-and-storage)) |

## Depends on

| Product or capability | For |
|---|---|
| Control Plane | The graph databases, their mode, switches and health ([CP-F05](../control/features/CP-F05-graph-databases/feature.md)); runs ([CP-F10](../control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| Access Plane | The Access Policies every read and write passes ([AC-F02](../access/features/AC-F02-access-policies/feature.md)); the ledger ([AC-F09](../access/features/AC-F09-what-left-the-platform/feature.md)); History ([AC-F06](../access/features/AC-F06-history/feature.md)) |
| Semantics | The published model a plan is checked against; the match rules identity links come from ([SE-F06](../../capabilities/semantics/features/SE-F06-links-and-mappings/feature.md)) |
| Agents · Projects | The runs, findings and decisions Memory holds ([AG-F06](../../capabilities/agents/features/AG-F06-plans-and-workflows/feature.md) · [PJ-F03](../../capabilities/projects/features/PJ-F03-branches-findings-and-decisions/feature.md)) |

## Not building

| Item | Why not |
|---|---|
| A copy of the customer's records | The Graph is read in place; Memory holds IDs and keyed hashes |
| Team-scoped memory | Memory is the deployment's; what a person reads of it follows run privacy and the agent's Access Policies |
| A second memory store beside the system graph | One store, one truth, rebuilt from History |
| A copy that shows without its sources | A copy with no recorded sources is not shown; no role overrides lineage |
