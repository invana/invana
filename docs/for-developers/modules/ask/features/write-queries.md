# Write queries

Cypher or Gremlin, written directly, with the Graph's model in scope. The path for people who already
know what they want to ask.

| | |
|---|---|
| Index | [3.1](../../../README.md#3--ask) · Slice **S9a** |
| Module | [Ask](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [ask-in-natural-language](ask-in-natural-language.md) · [the-answer-surface](the-answer-surface.md) |

Product spec: [EX-F03 · Ask a question](../../../../../specs/capabilities/explore/features/EX-F03-ask-a-question/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Composer | Editor with the ask-kind toggle set to QL |
| Thread | The query, then its emissions, in order |
| Schema panel | What is available to name, beside the editor |

## Engine

| Thing | Shape |
|---|---|
| Validation | parse plus model check, before dispatch |
| Execution | connector-native, streamed, cancellable |
| Routes | `POST …/query/validate` · `POST …/query/execute` |
| Events | `query.executed` with timings and row counts |

## Decisions

| # | Decision |
|---|---|
| WQ1 | A hand-written query is a Todo and uses the same runtime as an asked one. |
| WQ5 | **A query-language ask runs through an agent that reads the graph, and never drafts a model.** An agent answers asks when its envelope allows `execute_graph_query`; the seeded Modeller's does not. An Explorer session bound to one that cannot answer is refused with a 422 that names the agent — never silently re-routed, and never run, because its steps would propose a model named after the query. A stored default that cannot answer is passed over for the seeded Explorer ([AG3](../../agents/features/author-an-agent.md#decisions)). |

