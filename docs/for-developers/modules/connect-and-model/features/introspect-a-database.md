# Introspect a database

Read what the database actually holds, and offer it as a **draft** to model from. The mirror is never
the model — it is what you compare the model against.

| | |
|---|---|
| Index | [1.2](../../../README.md#1--connect-and-model) · Slice **S2** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [connect-a-database](connect-a-database.md) · [domain-models](domain-models.md) |

Product spec: [MO-F01 · Start a model](../../../../../specs/products/model/features/MO-F01-start-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Settings → Connection | `Introspect` beside `Test connection` |
| Modeller | The draft it seeded, ready to edit |
| Drift | The **Database** tab of [the model page](the-model-page.md): labels, relationship types, indexes and constraints, each marked `in both` · `model only` · `database only` ([MP9](the-model-page.md#decisions)) |

## Engine

| Thing | Shape |
|---|---|
| Introspection | per-connector: labels, relationship types, property keys, counts, server version |
| Physical mirror | stored per Graph with a captured-at time; replaced wholesale on refresh |
| Routes | `POST …/connection/introspect` · `GET …/schema/physical` |
| Events | `connection.introspected` |

## Decisions

| # | Decision |
|---|---|
| ID4 | **Introspection is a run, and no lens narrows it.** `introspect_schema` (`graph_read`) runs through the runtime like every read, but it grounds the global model that every lens narrows — so it reads the whole database, and a world cannot hide a label from the thing it is defined against. |
