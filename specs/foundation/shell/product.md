---
id: SH
title: Shell
status: idea
owner: Ravi
personas: [analyst, owner, admin]
---

# Shell

> Sign in, create or open a Graph, and find anything — the frame every mode and overlay sits in. Not a mode of its
> own: what every mode shares, and the path from a new Graph to its first answer, every claim citing its record.
> The decision it helps make: *which Graph to work in, and where to go next?*

Journeys: [J01 · From an empty install to a first answer](../../journeys/J01-from-an-empty-install-to-a-first-answer.md) ·
[J05 · Join a Graph someone set up](../../journeys/J05-join-a-graph-someone-set-up.md)

## Problem

A person who has to learn five products and their settings before their first answer gives up; one who reaches a dead end when they lack
access does not know whom to ask.

## Users

| Persona | Comes here to |
|---|---|
| Analyst | Sign in, open a Graph, find a board or ask from ⌘K |
| Graph owner | Create a Graph — connect it, shape its model, invite its team — through to its first answer |
| Install admin | Reach the install's settings from anywhere |

## Goals

| Goal | Measured by |
|---|---|
| A new Graph reaches its first answer in one modal of steps | Open — set at the spec review |
| No access is never a dead end: the act names whom to ask | Open — set at the spec review |

## Features

| ID | Feature | Stories | Status |
|---|---|---|---|
| SH-F01 | Sign in and start | SH-01 · SH-02 · SH-19 · SH-24 | idea |
| SH-F02 | Create a graph | SH-03 · SH-21 · SH-25 · SH-26 | idea |
| SH-F03 | Find your way — modes, crumbs, ⌘K, no access | SH-04 · SH-05 · SH-06 · SH-07 · SH-20 | idea |

## Surfaces

| Surface | Tier | Board |
|---|---|---|
| Sign in | page | `start.signin` |
| Home, no Graph open | page | `start.home` |
| The Graph picker | peek | `start.graph_picker` |
| Create a graph | modal | `start.new_graph` · `start.new_graph.connect` · `start.new_graph.files` · `start.new_graph.shape` · `start.new_graph.invite` · `start.new_graph.ready` |
| ⌘K | modal | `shell.command` |
| No access | every surface | `shell.locked` — the act reads *Ask Priya (owner)* |

## Decisions

| Decision | Detail |
|---|---|
| Three modes, summoned overlays | Explore, Model and Projects are modes named in the wordmark; Data, Agents, Inbox and Settings are summoned over the work; there is no launcher |
| Every overlay has a URL | It survives a reload and can be shared |
| One modal for creating a Graph | Its steps stay in one modal with a step strip; the model is shaped in its third step |
| Tokens, never currency | Every budget, limit, usage figure and alert is in tokens |
| Nothing autosaves in an editor | An editor buffers, says how many changes are unsaved, and commits on one Save |
| A pulsing dot means running | A still amber dot means waiting on a person; one glyph for both would hide who acts next |

The layout, overlays and states are [design-language.md](../../design-language.md).

## Depends on

| Product or capability | For |
|---|---|
| Settings | Who may open a Graph |
| Model · Data | Shaping the model and loading data while creating a Graph |

## Not building

| Item | Why not |
|---|---|
| Picking a product before working | The person works in a mode; everything else comes to them as an overlay |
| A tour or coach marks | Each empty state and set-up step names the next act on the surface that does it; a tour repeats it in a layer that goes stale |
| A separate onboarding product | Set-up is the Graph's, shown where its facts are made |
