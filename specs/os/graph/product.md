---
id: GR
title: Graph
status: idea
owner: Ravi
personas: [analyst, owner, admin, builder, decision-maker]
---

# Graph

> Where am I working: create a Graph and connect its graph database, open it, find anything in it — modes, crumbs,
> ⌘K — run it — its name, connection, members and usage — and read what needs me in its Inbox. The frame every mode
> and overlay sits in, and the path from a new Graph to its first answer, every claim citing its record.
> The decision it helps make: *which Graph to work in, what needs me there, and where to go next?*

Journeys: [J01 · From an empty install to a first answer](../../journeys/J01-from-an-empty-install-to-a-first-answer.md) ·
[J05 · Join a Graph someone set up](../../journeys/J05-join-a-graph-someone-set-up.md)

## Problem

A person who has to learn five products and their settings before their first answer gives up; one who reaches a dead
end when they lack access does not know whom to ask; and an ask or an update nobody sees is one nobody acts on.

## Users

| Persona | Comes here to |
|---|---|
| Analyst · Decision maker | Open a Graph, find a board or ask from ⌘K; read what needs them in the Inbox |
| Graph owner | Create a Graph — connect it, shape its model, invite its team — through to its first answer; name it, keep its connection working, read its usage; write the rules that tell people |
| Agent builder | See what needs them across the Graph |
| Install admin | Reach the install's settings from anywhere |

## Goals

| Goal | Measured by |
|---|---|
| A new Graph reaches its first answer in one modal of steps | Open — set at the spec review |
| No access is never a dead end: the act names whom to ask | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| GR-F01 | [Open a graph](features/GR-F01-open-a-graph/feature.md) | GR-01 · GR-02 · GR-03 | idea |
| GR-F02 | [Create a graph](features/GR-F02-create-a-graph/feature.md) | GR-04 · GR-05 · GR-06 · GR-07 | idea |
| GR-F03 | [Find your way — modes, crumbs, ⌘K, no access](features/GR-F03-find-your-way/feature.md) | GR-08 · GR-09 · GR-10 · GR-11 · GR-12 | idea |
| GR-F04 | [This graph — name, connection, members, usage](features/GR-F04-this-graph/feature.md) | GR-13 · GR-14 · GR-15 | idea |
| GR-F05 | [The Inbox — what needs me, and notifications](features/GR-F05-the-inbox/feature.md) | GR-16 · GR-17 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Home, no Graph open | page | `graphs.home` |
| The Graph picker | peek | `graphs.graph_picker` |
| Create a graph | modal | `graphs.new_graph` · `graphs.new_graph.connect` · `graphs.new_graph.files` · `graphs.new_graph.shape` · `graphs.new_graph.invite` · `graphs.new_graph.ready` |
| ⌘K | modal | `graphs.command` |
| This graph — people, usage | modal | `settings.people` · `settings.usage` |
| Inbox — Needs you · Updates · Running · Done | modal | `inbox` |
| Settings › Notifications — rules and channels | modal | `settings.notifications` |
| No access | every surface | `access.locked` — the act reads *Ask Priya (owner)* |

## Decisions

| Decision | Detail |
|---|---|
| Three modes, summoned overlays | Explore, Model and Projects are modes named in the wordmark; Records, Agents, Inbox and Settings are summoned over the work; there is no launcher |
| Every overlay has a URL | It survives a reload and can be shared |
| One modal for creating a Graph | Its steps stay in one modal with a step strip; the model is shaped in its third step |
| Tokens, never currency | Every budget, limit, usage figure and alert is in tokens ([glossary › Token budget](../../glossary.md#what-may-happen)) |
| Nothing autosaves in an editor | An editor buffers, says how many changes are unsaved, and commits on one Save |
| A pulsing dot means running | A still amber dot means waiting on a person; one glyph for both would hide who acts next |
| Three parts | *This graph* (the open Graph) · *Invana* (the install, Admin only) · *You* (the person's own account) |
| An agent is a member | Members list people and agents together; an agent's row opens the agent in this Graph — its version, access, runs and spend |
| One inbox | Needs you · Running · History are the three parts of one summoned modal; Needs you carries Updates beside it and Running carries Done. A count on its leftNav icon says what needs the person |

The layout, overlays and states are [design-language.md](../../design-language.md).

## Depends on

| Product or capability | For |
|---|---|
| Access | Signing in, and who may open a Graph |
| Semantics · Records | Shaping the model and loading records while creating a Graph |
| Agents | The runs Inbox › Running reads (AG-F03) |
| Projects | Project work in Needs you (PJ-F02) |

## Not building

| Item | Why not |
|---|---|
| Picking a product before working | The person works in a mode; everything else comes to them as an overlay |
| A tour or coach marks | Each empty state and set-up step names the next act on the surface that does it; a tour repeats it in a layer that goes stale |
| A separate onboarding product | Set-up is the Graph's, shown where its facts are made |
| Multi-tenancy · an Organisation record | One install is one organisation |
| On-call routing, escalation chains, quiet hours | A rule names its people and channels; paging is a monitoring platform's job |
