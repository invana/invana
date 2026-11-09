# Impact

What a branch's option reaches over the graph, hop by hop: the records its evidence cites, then
everything one, two and three relationships away — so a decision is seen at its reach before it is
made.

| | |
|---|---|
| Index | [9.9](../../../README.md#9--work) · C06 |
| Module | [Work](../spec.md) |
| API / CLI / Studio | — / — / ✅ |
| Product | capabilities/projects.md PJ-F7 · PJ-10 |
| Related | [branches-and-decisions](branches-and-decisions.md) (the cites it starts from) · [simulation](simulation.md) (what-if values) · [graph canvas](../../explore/features/graph-canvas.md) (the expand reads it walks) |

Product spec: [PJ-F04 · Simulation and impact](../../../../../specs/capabilities/projects/features/PJ-F04-simulation-and-impact/feature.md) — PJ-10; the story, its criteria, journey, states and product decisions live there. This file keeps the engine shape.

## Engine

None. Impact walks the Explorer's existing expand read ([graph canvas](../../explore/features/graph-canvas.md)).

## Decisions

Engine and code rows; the product decisions are PJ-F04's.

| # | Decision |
|---|---|
| IM2 | **Studio walks the reach through the Explorer's expand, one run per record expanded.** Every read of the graph is a run under the Graph's lens, so the reach is traceable like any canvas read; no endpoint is added for it. |
| IM4 | **Drawn on the shared layered canvas, kind `impact`.** A column is a hop; a node is a type at that hop with its count; an edge joins two groups a relationship type connects, labelled with it. A **Links** list says every group in words, for a reader who cannot see the canvas. |
