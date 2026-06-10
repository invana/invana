# RFC-022: Backend property-type capabilities & version compatibility

**Status**: Draft
**Author**: Invana Team
**Date**: 2026-06-10
**Related**:
- **RFC-001** (Graph Connectors) — defines the `BaseConnector` interface and the existing
  `capabilities() -> set[Capability]` method. This RFC **generalises** that into a version-aware
  capability model.
- **RFC-002** (Graph Modeller) — defines internal capability *gating* in the Projector (indexes /
  constraints conditioned on connector capabilities). This RFC surfaces capability awareness to the
  **modeller authoring surface** (which property types are offered) and adds version gating.
- **RFC-020** (Dataset ingestion) — the property-type vocabulary (`string, integer, float, boolean,
  enum, datetime, uuid, json`) this RFC adopts as the canonical superset.
- **RFC-021** (Model-first authoring) — the authoring surface whose property-type dropdowns become
  backend-driven.
- **RFC-017 / RFC-008** (Graph as primary container, GraphConnection) — `connector_class` is the
  backend identifier; this RFC adds version + compatibility columns to `graph_connections`.
- **RFC-018** (Domain audit events) — version-detected, compatibility-downgrade, and
  version-acknowledged events.

## Problem / intent

Each graph database supports a different set of property/data types, and **that set changes across
versions** (Neo4j 4 → 5 → 6 → 7 → 8/9; TinkerPop 3.7.4 → 3.8.0 …). Today the Modeller offers one
hardcoded property-type list regardless of the bound backend, and the two hardcoded lists don't even
agree:

- Engine `_TYPE_VALIDATORS` (`modeller/validator.py`): `string, integer, float, boolean, datetime`
- Studio `PROPERTY_TYPE_OPTIONS` (`modeller/components/editing.ts`): `string, integer, float,
  boolean, date, datetime`

Neither carries the RFC-020 vocabulary datasets actually use (`enum, uuid, json`), and nothing is
gated by the connected DB or its version. A user authoring a model against JanusGraph can pick
`point`; a user on Neo4j 4 can pick a type that needs 5.x — and find out only when projection fails.

A capability mechanism already exists but is too thin: a flat `Capability` StrEnum +
`BaseConnector.capabilities() -> set[Capability]` (boolean feature flags only — no property types, no
version awareness), surfaced on `GraphConnectionRead.capabilities` and resolved **without connecting**
in `graphs/routes.py::_resolve_capabilities()`.

**Intent:** make capabilities a **canonical, declarative, version-aware model**. Each connector
declares one `CapabilityProfile` (property types + feature flags, each gated to a version window).
The bound DB's live version is detected and cached; capabilities resolve against it. The Modeller
shows only supported property types. Unknown/untested future versions prompt the user ("not tested —
continue at your own risk") and degrade the connection to **read-only** until acknowledged; versions
below the floor are unsupported.

## Decisions

1. **Capability is data, not branching code.** A single declarative `CapabilityProfile` per connector
   class is the source of truth. It carries two axes — `property_types` and `features` (the existing
   `Capability` flags) — each entry gated to a version window via `Supports(since, until)`. The old
   flat `capabilities()` becomes `profile.resolve(version).capabilities`; nothing downstream breaks.

2. **One canonical vocabulary; connector owns canonical→native mapping.** Users author against the
   Invana `PropertyType` superset; each connector advertises the subset it supports for the detected
   version. Models stay portable across a Neo4j → JanusGraph switch. The canonical vocabulary:
   - **Universal:** `string, integer, float, boolean`
   - **Semantic overlays** (engine-enforced, stored as native string/text — *always available*):
     `enum, uuid, json`
   - **Native temporal / spatial:** `date, time, datetime, duration, point`
   - **Containers / cardinality:** `list, set, map`

3. **Family defaults on the language connectors; vendor + version overrides.** Mirrors the existing
   `capabilities()` layering:
   - `OpenCypherConnector` → `CYPHER_PROFILE`: universals + overlays + `date/datetime/duration/point/list`.
   - `GremlinConnector` → `GREMLIN_PROFILE`: universals + overlays + native `uuid` + `list/set`
     (cardinality); **no** native temporal/spatial.
   - `Neo4jConnector` → `NEO4J_PROFILE = CYPHER_PROFILE.merge(...)` with `min_version` / `tested_max`
     and feature gates (e.g. `VECTOR_SEARCH` `since=5.11`, `POINT_INDEX` `since=5.0`).
   - Bumping `tested_max` is how "we validated Neo4j N" becomes a one-line data change.

4. **Version is detected once and cached on the connection.** Capability now depends on the live
   server version, but resolution must stay *offline* (the existing no-connect fast path). So the
   version is detected at connect/health-check time and persisted on `graph_connections`; resolution
   reads the connector class's profile + the cached version, no live driver needed.
   - Cypher detection: `CALL dbms.components() YIELD versions` (Memgraph: `SHOW VERSION`).
   - Gremlin detection: a bytecode traversal can't return a server version anywhere, so detection
     submits the **`Gremlin.version()` script** via a `Client` (not the `g` traversal). This works on
     TinkerGraph, JanusGraph, and any Gremlin Server that permits Groovy evaluation, returning the
     TinkerPop version the `GREMLIN_PROFILE` windows are keyed on. Script-hostile vendors override
     `detect_version()` with an HTTP probe:
     - **Amazon Neptune** disables scripting → `GET https://<endpoint>:<port>/status` returns
       `{"dbEngineVersion": "1.2.1.0.R4", "gremlin": {"version": "tinkerpop-3.6.2"}}` (SigV4-signed
       when IAM auth is on). Parse `gremlin.version` (strip the `tinkerpop-` prefix).
     - **ArcadeDB** → `GET /api/v1/server` (basic auth) carries the server version.
     When detection fails, the version stays `UNKNOWN` (read-only) until the user declares one.

5. **Compatibility lifecycle with read-only safety valve.** Each profile declares a supported window
   `[min_version, tested_max]`. The detected version yields a `CompatibilityStatus`:
   - `SUPPORTED` (`min ≤ v ≤ tested_max`) — full read/write, capabilities resolved at `v`.
   - `UNTESTED` (`v > tested_max`) — e.g. Neo4j 8/9. **Proceed at your own risk**: connection is forced
     **read-only** and Studio prompts the user; capabilities resolved at `tested_max` (best-effort
     forward assumption). On explicit acknowledgement, writes are enabled.
   - `UNSUPPORTED` (`v < min_version`) — below the floor; writes blocked, surfaced as an error.
   - `UNKNOWN` (version not detected / undetectable) — treated conservatively: read-only, capabilities
     resolved at `min_version`, Studio prompts the user to declare the version.

6. **Effective read-only = user intent OR system safety.** The user-set `read_only` flag stays
   distinct from the version-imposed one:
   ```
   effective_read_only = connection.read_only
                         OR status in {UNSUPPORTED, UNKNOWN}
                         OR (status == UNTESTED and not version_acknowledged)
   ```
   Graph-DB **writes** (model projection, dataset ingestion, data writes) consult this. Authoring the
   model in Postgres (Invana metadata) is unaffected — only projecting/writing to the bound DB is
   gated.

7. **UI filter + server-side enforcement.** The Modeller dropdown shows only the resolved
   `property_types`, **and** property-key create/update rejects an unsupported type for the bound
   backend (422). The engine validator's `_TYPE_VALIDATORS` is derived from `PropertyType` so the two
   stay in sync.

## Data model

`graph_connections` gains (all nullable / defaulted, populated at health-check):

| column | type | meaning |
|---|---|---|
| `server_version` | `str \| None` | detected or declared version, e.g. `"5.20.0"` |
| `server_version_source` | `str \| None` | `"detected"` \| `"declared"` |
| `compatibility_status` | `str \| None` | cached `CompatibilityStatus` |
| `version_acknowledged` | `bool` (default `False`) | user accepted an `UNTESTED` version's risk |

## API

`GraphConnectionRead` adds: `supported_property_types: list[str]`, `server_version`,
`server_version_source`, `compatibility_status`, `version_acknowledged`,
`tested_version_range: str | None` (e.g. `"4.0–7.x"`), `effective_read_only: bool`.

New endpoint: `POST /u/{username}/{graphSlug}/connection/acknowledge-version` — sets
`version_acknowledged=True` (lifts the version-imposed read-only, subject to the user's own
`read_only`); emits a `connection.version_acknowledge` audit event.

**Version is detected, not typed.** For introspectable backends (Cypher) the version is read
from the database itself: `POST .../connection/test` (the studio's "Test Connection" button)
connects a transient connector and returns the **detected** `server_version` +
`compatibility_status`, and the subsequent save auto-detects-and-persists on connect. The user
never types a version for these backends — eliminating wrong input.

When detection isn't possible, the user provides the version manually. `GraphConnectionCreate`
carries an optional `server_version` so the **connection form** (create + edit) has a "Database
version" field — stored as `source="declared"`. The form prefills it from the Test Connection
result when detection succeeded. The standalone `PATCH .../connection/version` endpoint (and the
modeller's compatibility banner) offer the same after-the-fact. In all cases a later
auto-detected version overrides a declared one (`_persist_version` prefers detected).

New audit actions: `connection.version_detected`, `connection.compatibility_downgrade`,
`connection.version_acknowledge`.

## Studio

- Property-type dropdowns (`PropertyKeyFormDialog`, `PropertyEditor`) are driven by the bound
  connection's `supported_property_types` (the hardcoded `PROPERTY_TYPE_OPTIONS` is removed).
- A **compatibility banner** (design-kit components only) in the modeller / connection settings:
  - `UNTESTED`: "{backend} {version} detected — Invana is tested up to {tested_max}. Continue at your
    own risk?" with **[Browse read-only]** / **[Acknowledge & enable writes]**.
  - `UNSUPPORTED`: blocking error.
  - `UNKNOWN`: prompt to declare the server version.
  - read-only badge driven by `effective_read_only`.

## Out of scope (this RFC)

- Gremlin property **cardinality** (single/list/set) and meta-properties surfaced as first-class
  modeller columns — the profile carries `list`/`set` as types, but a dedicated cardinality axis is a
  follow-up.
- Per-version native **type-name** mapping tables beyond what projection already needs.
- Vendor `detect_version()` overrides for script-hostile backends (Neptune `GET /status`, ArcadeDB
  `GET /api/v1/server`) — designed above, implemented when those connectors are built. The generic
  `Gremlin.version()` script probe ships now; declared-version remains the fallback when it fails.
