# Modeller data model — how the ontology is stored in Postgres

This shows the **RFC-019 target**: a `Graph` owns **many `GraphModel`s** (persona-scoped), each a logical
schema/subgraph over the one bound physical DB, each with its own versioned type tree.

> **Shipped today vs. target.** The current code is still *single-model* — one `graph_models` row
> linked from `graph_connections.model_id` (1:1). RFC-019 moves ownership to `graph_models.graph_id`
> (a Graph → many models) and deprecates the connection pointer. **Everything under `graph_versions`
> (the type tree) is identical in both.** The diagram below is the target.

Two sides:
- **Postgres (app state)** holds the ontology *definition* + version history.
- **The live graph DB** (Neo4j / Memgraph / …), reached through `GraphConnection`, holds the actual
  *data* and the *enforced* constraints/indexes. The Modeller's Projector/Introspector is the bridge.

**Model membership is derived from the type, not stamped on the node.** A node belongs to whichever
model's active schema declares its type label (`:Service` → the model(s) that define `Service`). So
disjoint type sets give disjoint models, and a shared type name simply means a shared node — no
per-node `subgraph_label` is needed.

## ER diagram — Postgres tables

```mermaid
erDiagram
    users                    ||--o{ graphs                   : "created_by_id (RESTRICT)"
    graphs                   ||--o| graph_connections        : "graph_id (1:1, CASCADE) — the DB binding"
    graphs                   ||--o{ graph_models             : "graph_id (1:N, CASCADE) — many models"
    graph_models             ||--o{ graph_versions           : "model_id (CASCADE)"
    graph_versions           ||--o{ property_key_definitions : "version_id"
    graph_versions           ||--o{ node_type_definitions    : "version_id"
    graph_versions           ||--o{ edge_type_definitions    : "version_id"
    graph_versions           ||--o{ constraint_definitions   : "version_id"
    graph_versions           ||--o{ index_definitions        : "version_id"
    graph_versions           ||--o{ schema_projections       : "version_id"
    property_key_definitions ||--o{ type_property_mappings   : "property_key_id"
    node_type_definitions    ||--o{ type_property_mappings   : "node_type_id (nullable)"
    edge_type_definitions    ||--o{ type_property_mappings   : "edge_type_id (nullable)"
    property_key_definitions ||--o{ validation_rules         : "property_key_id (nullable)"
    type_property_mappings   ||--o{ validation_rules         : "tpm_id (nullable)"

    graphs {
        string id PK
        string slug
        string name
        json   setup_state
        enum   status "active|archived"
        string created_by_id FK
    }
    graph_connections {
        string id PK
        string graph_id FK "UNIQUE → 1:1 graph"
        string uri
        string connector_class
        bytes  auth_encrypted "Fernet"
        enum   status "CONNECTING|ACTIVE|ERROR|INACTIVE"
    }
    graph_models {
        string id PK
        string graph_id FK "NEW — owner (RFC-019)"
        string name
        enum   persona "architecture|code|test|business|domain|custom"
        enum   status "draft|active|archived"
        bool   is_default "one per graph"
        enum   validation_mode "strict|permissive"
        string yaml_path "set if YAML-managed"
    }
    graph_versions {
        string   id PK
        string   model_id FK
        string   version
        enum     status "draft|active|archived"
        datetime activated_at
    }
    property_key_definitions {
        string id PK
        string version_id FK
        string name "global per version"
        string type "string|integer|float|…"
        enum   value_cardinality "SINGLE|LIST|SET"
    }
    node_type_definitions {
        string id PK
        string version_id FK
        string name
        string parent_type "single inheritance"
        bool   is_abstract
    }
    edge_type_definitions {
        string id PK
        string version_id FK
        string name
        json   source_node_types
        json   target_node_types
        enum   multiplicity "MULTI|SIMPLE|ONE2ONE|…"
    }
    type_property_mappings {
        string id PK
        string property_key_id FK
        string node_type_id FK "nullable"
        string edge_type_id FK "nullable"
        int    sort_order
    }
    validation_rules {
        string id PK
        string property_key_id FK "nullable"
        string type_property_mapping_id FK "nullable"
        enum   rule_type "range|pattern|enum|min_length|max_length|custom"
        json   params
    }
    constraint_definitions {
        string id PK
        string version_id FK
        enum   target_kind "node_type|edge_type"
        string target_label
        enum   constraint_type "unique|exists|node_key|…"
        json   properties
    }
    index_definitions {
        string id PK
        string version_id FK
        enum   target_kind "node_type|edge_type"
        string target_label
        json   properties
        enum   index_type "range|composite|fulltext|text|point|lookup"
    }
    schema_projections {
        string   id PK
        string   version_id FK
        string   connector_id
        enum     status "pending|projected|failed"
        json     operations
        datetime projected_at
    }
```

*(Inter-model stitching — `anchor_mappings` binding `modelA.Type ≡ modelB.Type` — is a separate RFC-019
concern and is omitted here to keep this focused on how one model's ontology is stored.)*

## The bridge — Postgres definition ⇄ live graph DB

One physical DB holds the union of all the Graph's models. The Projector iterates the Graph's **active**
models and composes their DDL (constraints/indexes, per type label) onto that one DB.

```mermaid
flowchart LR
    subgraph PG["Postgres — ontology DEFINITION"]
        direction TB
        GM["graph (1) ──< many graph_models<br/>each: active graph_version<br/>&nbsp;&nbsp;└ node/edge types · property keys<br/>&nbsp;&nbsp;&nbsp;&nbsp;· constraints · indexes"]
    end

    subgraph BR["GraphConnection — the bridge"]
        C["uri + connector_class<br/>+ auth_encrypted (Fernet)"]
    end

    subgraph LIVE["Live graph DB — the DATA"]
        DB[("Neo4j / Memgraph /<br/>ArcadeDB / Gremlin")]
    end

    GM -- "Projector: each active model → CREATE CONSTRAINT / INDEX (per type label)" --> C
    C --> DB
    DB -- "Introspector: labels / rel-types / indexes → seed the is_default model" --> C
    C --> GM
```

## Worked example — the `Architecture` model

One of possibly several models on the Graph: `Architecture` (persona `architecture`) with
`Service {name:string UNIQUE, tier:enum}`, `Component {name:string}`,
`DependsOn(Service→Service)` decomposes into:

| table | rows |
|---|---|
| `graph_models` | `Architecture` (graph_id=…, persona=architecture, is_default=false) |
| `graph_versions` | `v1` (active) under that model |
| `property_key_definitions` | `name:string`, `tier:enum` — **global keys for this version** |
| `node_type_definitions` | `Service`, `Component` |
| `edge_type_definitions` | `DependsOn` (source `[Service]`, target `[Service]`) |
| `type_property_mappings` | name→Service, tier→Service, name→Component |
| `constraint_definitions` | `unique` on (`Service`, `[name]`) |
| `index_definitions` | `range` on (`Service`, `[tier]`) |
| `schema_projections` | one row recording `CREATE CONSTRAINT`/`INDEX` pushed to Neo4j (on `:Service`) |

A `Test` model on the **same** Graph would be another `graph_models` row (persona `test`) with its own
`Bug` / `Regression` / `TestSuite` types and its own version tree — projected onto the same Neo4j
alongside the architecture types. Because membership is type-derived, a `:Bug` node belongs to the test
model and a `:Service` node to the architecture model with no extra tagging.

**Key ideas:**
- **Many models, one DB.** `graph_models` rows are owned by the Graph (`graph_id`); they share the one
  bound `GraphConnection`. A node's model is whichever model declares its type — no per-node label.
- **Property keys are global per version**; types reference them via `type_property_mappings`. So
  `name:string` is defined once and reused — preventing `name` being a string on one type and an int on
  another. Constraints/indexes are first-class rows, so "`name` unique for `Service` but not `Component`"
  is expressible.
