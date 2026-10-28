# Connect a database

One Graph binds to exactly one graph database. Set once, tested before it saves, and read-only in its
connector from then on.

| | |
|---|---|
| Index | [1.1](../../../README.md#1--connect-and-model) · Slice **S2** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / — / 🟡 |
| Related | [introspect-a-database](introspect-a-database.md) · [domain-models](domain-models.md) |

> **As** someone starting a Graph, **I want** to attach my database and know it works before anything
> depends on it, **so that** nothing downstream is built on a connection that was never proven.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Bind one graph database to a Graph | 1:1; there is no second connection |
| C2 | Test gates save | A connection that has not connected cannot be saved |
| C3 | Credentials encrypted at rest | A blank field on edit means "keep", never "clear" |
| C4 | The connector is fixed after the first save | Changing engine would invalidate everything modelled against it |
| C5 | Version is detected, and may be declared | The server version decides which property types are available |
| C6 | Read-only connections are honoured | Invana never writes to a database marked read-only |
| C7 | Runtime status is visible | Connected · unreachable · degraded, with the last check time |
| C8 | The database name is part of the connection | A server can hold several databases; which one this Graph reads is stated, shown and editable |
| C9 | Connecting drafts a model | *Connect and draft a model* makes the Graph, saves the connection and reads the database into an authored **draft** model in one call; nothing is published |

## Journey

```mermaid
flowchart TD
    A[/graphs/new · Connect a database/] --> B[Pick one of six engines]
    B --> C[URI · user · password]
    C --> D{Test}
    D -->|fails| E[The connector's own error,<br/>under the fields]
    E --> C
    D -->|passes| F[connected · server version · labels]
    C --> G[Connect and draft a model]
    F --> G
    G -->|test fails| E
    G -->|database holds nothing| H[An empty draft named for the Graph:<br/>add types or bring data in]
    G -->|passes| I[Graph made · connection saved ·<br/>schema read into a draft model]
    I --> J[The draft's canvas, assistant docked:<br/>review, then Publish]
    J --> K[Graph settings › Database edits the connection later]
```

## Seams

| Seam | What the user sees |
|---|---|
| Untested | Save is disabled and says why |
| Edit after save | Connector is fixed; URI, database and credentials remain editable, and a change requires a re-test |
| Database left blank | The connector's own default is used (`neo4j` for Neo4j); the read view says "connector default" rather than showing an invented name |
| Connector ignores databases | Gremlin backends address one graph per endpoint — the field is still accepted and simply not passed on |
| Credentials rotated elsewhere | Status goes unreachable with the last successful check time, not a silent failure |
| Database empty | Not an error — the empty state explains what to do next |
| Member without admin | Sees the connection and its status, cannot edit it |

## Surfaces

| Surface | Shape |
|---|---|
| `/graphs/new` — *Connect a database* (`modeller.connect`) | One page: the title and one line (*A new Graph starts here. Point Invana at a graph database; it reads what is there and drafts a model you can review.*), six engine cards in a 3×2 grid (Neo4j · Memgraph · ArcadeDB · JanusGraph · Amazon Neptune · TinkerGraph, each with its query languages), URI, then User and Password side by side, then *Test* · *Connect and draft a model* (primary). The header crumb reads *New Graph* |
| Settings → Connection | A field group inside the settings form; `Test connection` and `Introspect` sit beside the fields |
| Status strip | Connector · version · read-write · last check |

## Engine

| Thing | Shape |
|---|---|
| `graph_connections` | 1:1 with Graph — `connector_class` · `uri` · `database` · encrypted `auth` · `read_only` · `server_version` · runtime `status` · `latency_ms` |
| Routes | `GET PUT DELETE …/connection` · `POST …/connection/test` |
| Connect | `POST /api/v1/graphs/connect/test` `{connector_class, uri, auth, database?}` → the test result, with no Graph yet · `POST /api/v1/graphs/connect` `{connector_class, uri, auth, database?, name?}` → `{graph, model_id, discovered: {node_labels, edge_labels, indexes, constraints}}` |
| Events | `graph.create` · `connection.created · updated · tested · deleted` · `model.create` for the drafted model |
| Packaging | one connector package per database; the core depends on none of them |

## Decisions

| # | Decision |
|---|---|
| CD1 | One Graph, one graph database. |
| CD2 | Test gates save — always, including on edit. |
| CD3 | `connector_class` is immutable after the first save. |
| CD4 | Blank credentials on edit mean "unchanged". |
| CD5 | A read-only connection is never written to, by any path. |
| CD6 | The connection is the `Graph` tab of the settings panel, not a page of its own. Rules, Skills and Datasets have their own pages, so they are not settings. |
| CD7 | After a passing test the strip states connector, server version, label count and read-write, in that order. |
| CD8 | The database name is a column on `graph_connections`, not a key inside the encrypted `auth` blob. It is not a secret, so it is returned by `GET …/connection`, shown beside the URI, and editable — a blank credential means "unchanged", and the database name must never inherit that rule. Blank means "the connector's default", and it is passed to the connector only when set. |
| CD9 | Changing the database re-tests, exactly as changing the URI does. It is not frozen like `connector_class` (CD3) — pointing a Graph at a restored copy of the same database is a move people make, and the model it was built against still holds. |
| CD10 | **Testing a connection is a run.** `test_connection` (bound `network`) proves the connection through the runtime — trigger `user` from the form, `system` from a ping — because *who proved this worked, and when* is an audit question ([orchestration § 4.1](../../../orchestration.md#41-what-is-a-task--and-what-is-not)). The provider row it proves stays configuration. |
| CD11 | **Connecting drafts a model, in one call.** `POST /api/v1/graphs/connect` tests the connection (a failing test refuses with the connector's message and makes nothing), makes the Graph, saves the connection, registers it, and reads the database into a new **authored** model whose draft holds every label, relationship type, index and constraint the connector reports. The draft is ready when the call returns; the Graph's read-only `global` mirror still follows from the registration, as before. Nothing is published (ID1). |
| CD12 | **The connect form names nothing it can derive.** The Graph's name is the database name when one is given, else the URI's host (`bolt://neo4j:7687` → `neo4j`); its slug is that name made URL-safe, suffixed `-2`, `-3` … when the owner already has it. The drafted model is named for the Graph. Both are renamed later — the Graph in Graph settings › Basic, the model from its page. |
| CD13 | **`/graphs/new` is the connect form.** A Graph with no database answers nothing, so there is no name-only Graph: the six engine cards, URI, User, Password, *Test* and *Connect and draft a model*. The database name is left to the connector's default here and is edited in Graph settings › Database (CD8). Success opens the drafted model's canvas with the assistant docked (`…/modeller/models?model=<id>&model_open=1&models_view=schema&right=assistant`). |
| CD14 | **Testing before a Graph exists is not an event.** `POST /api/v1/graphs/connect/test` proves the credentials and records nothing — there is no Graph to scope an event to; the connect call's own test is recorded on the new Graph as `connection.tested`. |

## Not building

| Not built | Because |
|---|---|
| Multiple databases per Graph | the Graph is the reasoning boundary |
| Connection pooling knobs in the UI | tuning belongs in configuration, not in a product surface |
| Credential vault integrations | encryption at rest is enough for now; an integration is a later decision |
