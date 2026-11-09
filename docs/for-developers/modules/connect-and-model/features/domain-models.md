# Author a model

A model is authored against a **domain**, not a Graph — `NewsArticles`, `MarketData`, `DrugActions`.
A Graph holds many, and each one travels.

| | |
|---|---|
| Index | [1.3](../../../README.md#1--connect-and-model) · Slice **S3** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [model-editor](model-editor.md) · [share-a-model](share-a-model.md) · [stitch-models](stitch-models.md) · [publish-review](publish-review.md) |

Product spec: [MO-F01 · Start a model](../../../../../specs/capabilities/model/features/MO-F01-start-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| *New model* (`modeller.models.new`) | One dialog from the models board's *New model* (and *Import*, which opens it on *A file*): Name, Description, then **Start from** — three cards, *Describe it* (*the assistant drafts*) · *A file* (*JSON or YAML*) · *A starter* (*N templates*, the engine's count). A file card opens the file picker and names the chosen file; a starter card lists the starters to pick one. Footer *Cancel* · *Create draft*. A clashing name, or types this database cannot hold, are said in the dialog as before ([share-a-model](share-a-model.md)) |
| Model panel | Node types and edge types as stacked sections, each with its own add |
| Type detail | Properties, keys, constraints; inspect by default, edit while drafting |
| Version bar | Draft · published versions. The draft's account of what changed is its staged set; a published version's is its diff against the one before it (`GET …/versions/{id}/diff`) |

## Engine

| Thing | Shape |
|---|---|
| `models` | `graph_id` · `name` · `package_id` · `current_version_id` |
| `model_versions` | node types, edge types, property keys, constraints; immutable once published |
| `model_versions.axes` | **new** — `{time: {property}, geo: {property, vocab}, dims: [property, …]}`, default `{}`. What a [world](../../govern/features/worlds.md) may slice this model along ([GV14](../../govern/spec.md)) |
| Capability resolution | server version → available property types, per connector |
| Routes | `…/models*` · `…/models/{id}/versions*` · `POST …/models/{id}/publish` — additive now, breaking through a [review](publish-review.md) |
| Events | `model.created · updated · published` |
