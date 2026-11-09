# Connect and model — module spec

Binding a Graph to a graph database, and describing what lives in it. Everything downstream — what can
be asked, what can be imported, what an agent is grounded in — resolves against the model authored
here.

| | |
|---|---|
| Index | [§1 · Connect and model](../../README.md#1--connect-and-model) |
| Features | [connect-a-database](features/connect-a-database.md) · [introspect-a-database](features/introspect-a-database.md) · [domain-models](features/domain-models.md) · [model-editor](features/model-editor.md) · [share-a-model](features/share-a-model.md) · [stitch-models](features/stitch-models.md) · [starter-models](features/starter-models.md) · [the-model-page](features/the-model-page.md) · [publish-review](features/publish-review.md) · [ontology-import](features/ontology-import.md) |
| Depends on | — |
| Depended on by | everything: the global model is the grounding context for every question |

Product spec: [Model](../../../../specs/products/model/product.md) — the product, its features MO-F01–F04, and the module-wide product rules and decisions live there. This file keeps the engine shape.

System design: [connect-and-model.md](../../../../specs/system-design/modules/connect-and-model.md) — the three layers, connecting and portability (§§ 2 · 4 · 5). This file keeps the vocabulary, what the module owns with how a model is stored, its decisions and the drawn states.

## 1. Vocabulary

Product-wide words: [terminology.md](../../terminology.md). What this module adds:

| Noun | Is | Is not |
|---|---|---|
| **Domain model** | a model authored against a domain, portable between Graphs | a Graph's schema |
| **Published version** | an immutable model version | a draft |
| **Anchor** | a declared link saying two types are the same entity | a merge |
| **Relationship link** | a declared cross-model edge type, whose records arrive in a dataset | an inference |
| **Global model** | the read-time union of published models plus their links | a stored row |
| **Physical** | the introspected mirror of what the database actually holds | the model |

## 3. What this module owns

| Owns | Shape |
|---|---|
| `graphs` | `name` · `slug` (unique per owner) · `description` · `status (active\|archived)` · `setup_state` |
| `graph_connections` | 1:1 with a Graph — `connector_class` · `uri` · encrypted `auth` · `read_only` · runtime status · `server_version` |
| `models` · `model_versions` | domain models: name, version, node types, edge types, property keys, constraints |
| `model_links` | anchors and relationship links between two published models |
| Introspection | the physical mirror, refreshed on demand |
| Portability | export, import and upgrade of a domain model as one artefact |

### How a model is stored

The definition lives in Invana's own database; the graph database holds only data and the DDL the
projector pushed to it.

| Holds | What |
|---|---|
| `models` · `model_versions` | a domain model and its versions; one is active |
| `property_key_definitions` | keys, scoped to a version — global across the types in it |
| `node_type_definitions` · `edge_type_definitions` | the types; an edge names its source and target types |
| `type_property_mappings` | which key belongs to which type |
| `constraint_definitions` · `index_definitions` | uniqueness and lookup, per type |
| `schema_projections` | one row per DDL statement pushed to the graph database, so drift is detectable |

```mermaid
flowchart LR
    PG["Definition · Invana's store<br/>models · versions · types · keys<br/>constraints · indexes"]
    BR["The connection<br/>uri · connector · encrypted auth"]
    DB[("The graph database<br/>data")]
    PG -- "projector: active models → CREATE CONSTRAINT / INDEX" --> BR --> DB
    DB -- "introspector: labels · types · indexes → the physical mirror" --> BR --> PG
```

One graph database holds the union of a Graph's models. The projector composes DDL from every active
model onto it; the introspector reads back what is actually there. Neither writes the other's truth.

## 6. Cross-feature decisions

| # | Decision |
|---|---|
| CM7 | In Studio the module is two folders — `model/` is a model authored on its own, `stitch/` is what happens between two published ones. [code-shape.md](../../building-studio/code-shape.md) §4.1d. |
| CM8 | **Setup is derived from facts, never from a checklist someone ticks.** A section is done when the thing it asks for exists. The engine reads that at serialize time and reports it in `setup_state`; nothing has to be told a thing happened. This module owns the `graphs.setup_state` column and the derivation; **which steps there are, what they are grouped into and how they are drawn is [13.7 Setup](../platform/features/setup.md)**, which is where the six sections and their conditions are stated. |
| CM9 | The only thing `setup_state` **stores** is a skip. A required section cannot be skipped, so it has no stored state at all; an optional one is `done` (derived), `skipped` (stored) or `todo`. `POST /setup/{section}` takes `skip` and `reset`, and reset clears the skip rather than un-doing the work. |
| CM10 | **Projecting a model's DDL is a run.** Publishing pushes constraints and indexes through `project_model` (bound `schema_write`), not through the projector called from a route — the one schema write that still reached the database with no run behind it. |
| CM11 | **Every model surface is a tab of one page, and the model is a filter on it.** Overview · Model · Database · Usage · Performance · Growth, read at `All models` or one model; the panel lists models and a model's types, and every act on a model sits on the page header ([MP1 · MP2 · MP4](features/the-model-page.md#decisions)). |

## 6a. The drawn states

Hi-fi, at 1440×900, on the **Hi-fi · finance** page of the *Agents at Work Wireframes* canvas —
`claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`.

| Artboard | Feature | Shows |
|---|---|---|
| Graph · settings | [connect-a-database](features/connect-a-database.md) · [introspect-a-database](features/introspect-a-database.md) | the settings panel's three tabs — Basic · Graph · Agents — with the connection filling the second, under its one-line rule rather than a collapsible group; `Test connection` and `Introspect` beside the fields; the tested strip reading *connected · Neo4j 5.26 · 0 labels · read/write*; the overview saying what unlocks next |
| Model · Observations v2 draft | [model-editor](features/model-editor.md) · [domain-models](features/domain-models.md) | the version bar (`v2 · draft` / `v1 · active`), staged-first type lists with a `staged` chip per row, the staged bar counting six changes with Commit and Discard, and `Publish v2` on the header |
| Model · a type selected — the form spans the main column | [model-editor](features/model-editor.md) | the selected type's form filling the main column under the canvas — name, parent, abstract, instance count, validation, and the property table with cardinality and constraint |
| Model · generated by the Modeller agent | [model-editor](features/model-editor.md) | the same staged set arriving from a run rather than a gesture — understand · propose · validate, then the same Commit |
| Model · Links and the global model | [stitch-models](features/stitch-models.md) | Anchors and Relationships as stacked sections, the derived global-model table (node types · edge types · links, with their counts and sources), and the physical mirror's label count beside it |
