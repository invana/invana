# Starter models

Importable models to begin from — memory, provenance — shipped as ordinary portable artefacts and
renamed on arrival. A starting point, not a fixed schema.

| | |
|---|---|
| Index | [1.7](../../../README.md#1--connect-and-model) · Slice **S7** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [share-a-model](share-a-model.md) · [recall-by-query](../../memory/features/recall-by-query.md) |

Product spec: [MO-F01 · Start a model](../../../../../specs/products/model/features/MO-F01-start-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| CLI | `invana models starters` · `invana models import --starter memory` |
| Studio | Starters listed at model creation; import lands in the modeller as a draft |

## Engine

| Thing | Shape |
|---|---|
| Starters | shipped artefacts in the distribution, versioned with it |
| Import | the ordinary model import path, with `source = starter` recorded |
| Events | `model.imported` with the starter's package id |

## Decisions

| # | Decision |
|---|---|
