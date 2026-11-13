---
id: CP-F05
title: Graph databases
product: CP
status: idea
personas: [admin, modeller, builder, analyst]
stories: [CP-22, CP-25, CP-26, CP-27, CP-24, CP-38, CP-39, CP-40, CP-35, CP-41, CP-17, CP-18, CP-19]
journeys: [J01, J07]
boards: [start.home, start.setup, settings.databases, settings.databases.database, settings.databases.connect, settings.databases.connect.files, settings.databases.connect.shape, settings.databases.connect.ready, access.sign_in_again]
nfrs: [NFR-REL-3, NFR-SEC-2, NFR-SEC-4, NFR-SEC-5, NFR-SEC-7, NFR-SEC-9, NFR-PERF-3]
depends_on: [AC-F01, AC-F02, AC-F06, SE-F01, RC-F02, CP-F01]
---

# Graph databases

> The graph databases the deployment connects — each through its connector, with one credential, read-only or read +
> write, switched on or off, healthy or not — and the steps from a fresh deployment to its first answer. Together
> they are the Graph. The decision it helps make: *which graph databases may agents read and write, and is each one
> working?*

## User journey

Journeys this feature is a step of: [J01 · From a fresh deployment to a first answer](../../../../journeys/J01-from-a-fresh-deployment-to-a-first-answer.md) · [J07 · Ready a deployment](../../../../journeys/J07-ready-a-deployment.md)

```mermaid
flowchart TD
  h([Home, signed in]) --> f{"Any graph database on?"}
  f -->|none| q["CP-22 · What are you trying to decide? · Connect a graph database · Try it on demo data"]
  q -->|an Operator| qa(["No graph database yet — Ask an Admin"])
  q -->|Try it on demo data| dm(["Explore, on the demo graph database"])
  q -->|Connect a graph database| c["CP-25 · One modal: Name · Connect · Shape · Ready"]
  c --> pk{"Its connector installed?"}
  pk -->|no| pkn["CP-17 · Not offered · names the package to install"]
  pk -->|yes| t{"Test connection"}
  t -->|fails| tf["The database's own words · Continue stays off"] --> t
  t -->|holds records| hd["CP-26 · What is there · the agent drafts the model"]
  t -->|empty, with files| fl["CP-27 · Drop files · each says what it becomes"]
  hd --> rd["CP-25 · Ready · read-only · off until turned on"]
  fl --> rd
  rd --> on["CP-39 · Turn it on"]
  on --> su["CP-24 · Set-up: what is left before the first answer"]
  su -->|all four done| ans(["The first answer"])
  f -->|some| ls["CP-40 · Settings › Invana › Graph databases: mode · switch · health"]
  ls --> md["CP-38 · Read-only or read + write · sign in again"]
  ls --> sw["CP-39 · On or off — for the deployment, or for my own runs"]
  ls --> one["CP-35 · One graph database: connection · test · reconnect · version · remove"]
  one -->|unreachable| rc["Reconnect · retried with a doubling delay"]
  ls --> pr["CP-41 · Name a practice graph database"]
  ls -->|an Operator or Modeller| ro(["Reads every one · acts read Ask an Admin"])
  sw -->|work needs one that is off| off(["Refused before it starts, naming who switched it off"])
  ans --> rw["CP-18 · Agents read and write in each database's language"]
  rw -->|a write to a read-only one| rwr(["Refused before the wire, naming the database"])
  rw --> vs["CP-19 · Find similar records"]
```

```mermaid
sequenceDiagram
  actor A as Admin
  participant S as Studio
  participant E as Engine
  participant G as Graph database
  participant M as Modeller agent
  A->>S: Connect a graph database · details
  S->>E: test — nothing saved
  E->>G: connect in the driver's read mode, within 10 s
  G-->>E: kinds and counts, server version — or its own error
  E-->>S: what is there
  A->>S: Continue to Shape
  S->>M: read the database's schema, never its records
  M-->>A: proposes a draft model · names what it left out
  A->>S: accept · Connect
  S->>E: save — read-only, off, credential sealed
  E-->>S: the graph database · History row
  A->>S: Turn it on
  E-->>S: on · set-up's next step
```

## Stories

| ID | Story | Status |
|---|---|---|
| CP-22 | [Start a fresh deployment from a question](stories/CP-22-start-a-fresh-deployment-from-a-question/story.md) | idea |
| CP-25 | [Connect a graph database in one modal of steps](stories/CP-25-connect-a-graph-database-in-one-modal-of-steps/story.md) | idea |
| CP-26 | [Connect a graph database that already holds data](stories/CP-26-connect-a-graph-database-that-already-holds-data/story.md) | idea |
| CP-27 | [Start from files with an empty graph database](stories/CP-27-start-from-files-with-an-empty-graph-database/story.md) | later |
| CP-24 | [See what is left before the first answer](stories/CP-24-see-what-is-left-before-the-first-answer/story.md) | idea |
| CP-38 | [Set a graph database read-only or read + write](stories/CP-38-set-a-graph-database-read-only-or-read-write/story.md) | idea |
| CP-39 | [Switch a graph database on or off](stories/CP-39-switch-a-graph-database-on-or-off/story.md) | idea |
| CP-40 | [See every graph database and its health](stories/CP-40-see-every-graph-database-and-its-health/story.md) | idea |
| CP-35 | [Keep a graph database connected](stories/CP-35-keep-a-graph-database-connected/story.md) | idea |
| CP-41 | [Name a practice graph database](stories/CP-41-name-a-practice-graph-database/story.md) | idea |
| CP-17 | [Install a graph connector and see it offered](stories/CP-17-install-a-graph-connector-and-see-it-offered/story.md) | idea |
| CP-18 | [Read and write any supported database in its own language](stories/CP-18-read-and-write-any-supported-database-in-its-own-language/story.md) | idea |
| CP-19 | [Find similar records with the database's own vector index](stories/CP-19-find-similar-records-with-the-databases-own-vector-index/story.md) | idea |

## Access

The role each act needs is the one role table's row *Graph databases — connect, mode, switch, health*
([AC-F02 › The role table](../../../access/features/AC-F02-access-policies/feature.md#the-role-table)); this table
names the acts.

| Act | Role | Everyone else sees |
|---|---|---|
| Read every graph database — name, connector, address, database, mode, switch, health, server version, practice; never its credential | Operator · Modeller · Admin | — |
| Connect a graph database · change its connection · test · reconnect · read its types again · declare or accept a server version · remove it | Admin | The list and each graph database read; each act reads *Ask an Admin* |
| Set read-only or read + write | Admin, signing in again for read + write | The mode reads; *Change* reads *Ask an Admin* |
| Turn a graph database on or off for the deployment | Admin | The switch reads, with who set it and when; it reads *Ask an Admin* |
| Turn a graph database off, or back on, for the runs one is behind | Every signed-in person, for themselves | — |
| Name or unname a practice graph database | Admin | *Practice* reads; the act reads *Ask an Admin* |
| Install or remove a connector package | Admin — on the engine's machine, outside Studio | — |
| Read, write or search a graph database | An agent, as its Access Policies allow on `data/<graph database>/<kind>`, within the mode and both switches | Refused before it starts, naming the rule, the mode or who switched it off |
| Start on a fresh deployment — *Connect a graph database* | Admin | *No graph database yet — Ask an Admin* |
| Try it on demo data | Operator · Modeller · Admin, when a demo graph database is on | — |

## States

| State | What the person sees |
|---|---|
| First use | No graph database on: Home asks *What are you trying to decide?* and offers *Connect a graph database* and, when there is one, *Try it on demo data* |
| Empty after a filter | Graph databases filtered to none: *No graph database matches* and *Clear* |
| Loading | A test says it is testing; Shape says the agent is reading the schema; the list draws its rows and fills health in place |
| Has data | Every graph database with its connector, mode, switch, health and last connected; set-up with each done step checked |
| Failed | A test failed in the database's own words; a name already used; a save refused with the reason; a connector not installed, naming its package |
| Agent working or proposing | The Modeller agent reading the schema and drafting the model, the draft shown for a decision before anything is saved |
| No access | Every graph database reads; each act reads *Ask an Admin*; the credential is never shown |

## Rules

| Rule | Detail |
|---|---|
| A graph database is one connection | One connector, one address, one database, one credential. The Graph is every graph database the deployment has on |
| Its name is a resource segment | Lowercase letters, digits and `_`, unique, fixed once saved — it is the `<graph database>` of `data/<graph database>/<kind>` in every rule |
| A test gates every save | Nothing is saved until the details passed a test — on the first save and on every change to address, user, password, database |
| The connector is fixed once saved | Address, user, password and database stay editable; a different connector is a different graph database |
| The credential is write-only | Sealed like every secret; the user reads back, the password field is blank — *Stored encrypted. Leave blank to keep it* |
| Read-only by default | A new graph database is read-only. Read + write is a second, deliberate act by an Admin who signs in again; both directions are History rows |
| A read never writes | Every read runs in the driver's read mode or Gremlin's `ReadOnlyStrategy`, whatever the mode; a write to a read-only graph database is refused before the wire, naming it |
| New starts off | A new graph database is off until an Admin turns it on; nothing reads it while it is off |
| Two switches | The deployment's switch, an Admin's, is a hard off for everyone. A person's own switch narrows only the runs they are behind and never turns on what the deployment has off |
| Off means refused, named | Work that needs a graph database that is off — for the deployment or for the person behind it — is refused before it starts, naming who switched it off; a schedule skips its firing and raises an ops alert; a workflow that depends on it is flagged and its runs refused until it is on |
| Health is honest | Connected · unreachable · degraded, with the last time it connected and its latency; rotated credentials read unreachable, never silence. Work that needs no step on an unreachable graph database keeps answering |
| The server version decides the property types | Detected on connect, or declared by an Admin; a version Invana has not tested keeps the graph database read-only until an Admin accepts it |
| A practice graph database is never the Graph | It stands in for one graph database in an agent's or a skill's tests; no question, board, schedule or workflow reads it |
| Removing never touches the data | Removing a graph database removes Invana's records of it; the database's own data is untouched. It is refused while a rule, a match rule or a workflow names it |
| Set-up is the deployment's | Four required steps — a graph database is connected and on · a model is published · the Graph holds records · an AI model answers. Each is done because its fact exists, whoever made it and from wherever; only a skipped offer is stored |
| Each step opens a gate | *Connected* — reading the graph databases · *Modelled* — loading data and links between models · *Grounded* — answers that cite a record · *Answering* — asking, the Assistant and every agent run. A surface waits on the one gate it needs and names the step that opens it |
| Set-up owns no forms | Each step opens the place that makes its fact — Graph databases, Model, Records, AI models — with its command beside it |
| Agents read the schema, never records, to draft | The draft model comes from the kinds, properties and counts the database reports ([SE-F01](../../../../capabilities/semantics/features/SE-F01-start-a-model/feature.md)) |
| One package per database | `invana-<db>`, installed beside the engine; the engine depends on no driver |
| Two languages | openCypher and Gremlin, each complete in the engine; a package adds a driver and what the language cannot say |
| One shape | Every vendor answers in vertices, edges and records; nobody downstream sees a driver's types |
| Unsupported is declared | An act a vendor cannot do is refused before the wire, naming the vendor and the act — never a driver error |
| Vector search is the database's | Its own index; no store beside the graph |
| Proven against a live database | Every package passes one conformance suite against a running database, never mocked |
| Leans on | Signing in again ([AC-F01](../../../access/features/AC-F01-sign-in-account-and-sessions/feature.md)) · Access Policies on `data/…` ([AC-F02](../../../access/features/AC-F02-access-policies/feature.md)) · History ([AC-F06](../../../access/features/AC-F06-history/feature.md)) · the ledger ([AC-F09](../../../access/features/AC-F09-what-left-the-platform/feature.md)) · drafting a model ([SE-F01](../../../../capabilities/semantics/features/SE-F01-start-a-model/feature.md)) · loads ([RC-F02](../../../../capabilities/records/features/RC-F02-bring-records-in/feature.md)) · AI models ([CP-F01](../CP-F01-ai-models/feature.md)) |

## Data touched

| Record | Read or write |
|---|---|
| Graph databases — name, connector, address, database, sealed credential, mode, switch, health, server version, practice | Read · write |
| A person's own switches | Read · write — their own |
| Set-up — derived from the facts; only a skipped offer is stored | Read · write a skip |
| The drafted model ([SE-F01](../../../../capabilities/semantics/features/SE-F01-start-a-model/feature.md)) | Write — a draft, never published here |
| Loads started from files ([RC-F02](../../../../capabilities/records/features/RC-F02-bring-records-in/feature.md)) | Write |
| History rows of every change ([AC-F06](../../../access/features/AC-F06-history/feature.md)) | Write |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `control_graph_databases` | `name` (unique, `[a-z0-9_]+`, fixed once saved) · `description` · `connector` (its registered name under `invana.connectors`, fixed once saved) · `uri` · `database?` (blank is the connector's default) · `credential_sealed` · `mode` (`read_only` · `read_write`, default `read_only`) · `enabled` (default `false`) · `switched_by_id?` · `switched_at?` · `practice_for_id?` (the graph database a practice one stands in for) · `demo` · `status` (`connected` · `unreachable` · `degraded`) · `last_connected_at?` · `latency_ms?` · `server_version?` · `server_version_source` (`detected` · `declared`) · `compatibility_status` · `version_acknowledged_by_id?` · `created_by_id` · `created_at` · `updated_at` | Every record that belongs to one graph database carries `database_id` and cascades from it |
| `control_graph_database_switches` | `database_id` · `user_id` · `off_at` | A person's own off; a row exists only while it is off. Unique (`database_id`, `user_id`) |
| `control_setup` | `step` (an optional offer) · `skipped_by_id` · `skipped_at` | One row per skipped offer; required steps are never stored |

### Reads

| Record | Owner |
|---|---|
| Who may act and the role table | [AC-F02](../../../access/features/AC-F02-access-policies/feature.md#engine) |
| Signing in again for an act | [AC-F01](../../../access/features/AC-F01-sign-in-account-and-sessions/feature.md#engine) |
| Rules, match rules and workflows that name a graph database | [AC-F02](../../../access/features/AC-F02-access-policies/feature.md#engine) · [SE-F06](../../../../capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#engine) · [AG-F06](../../../../capabilities/agents/features/AG-F06-plans-and-workflows/feature.md#engine) |
| The drafted model, and whether a model is published | [SE-F01](../../../../capabilities/semantics/features/SE-F01-start-a-model/feature.md#engine) · [SE-F02](../../../../capabilities/semantics/features/SE-F02-change-and-publish-a-model/feature.md#engine) |
| Loads — the first that succeeded | [RC-F02](../../../../capabilities/records/features/RC-F02-bring-records-in/feature.md#engine) |
| The default AI model and its last check | [CP-F01](../CP-F01-ai-models/feature.md#engine) |
| The query step that calls a connector, and the ledger row it writes | [AG-F06](../../../../capabilities/agents/features/AG-F06-plans-and-workflows/feature.md#engine) · [AC-F09](../../../access/features/AC-F09-what-left-the-platform/feature.md#engine) |
| History — every event this feature writes | [AC-F06](../../../access/features/AC-F06-history/feature.md#engine) |

### Routes

| Route, after `/api/v1/control` | Does | Story |
|---|---|---|
| `GET /graph-databases` | By the list contract — `?q=` name or address · `?f.connector=` · `?f.mode=` · `?f.enabled=` · `?f.status=` · `?f.practice=`. Each: `name` · `description` · `connector` · `language` · `uri` · `database` · `auth_username` · `mode` · `enabled` · `switched_by` · `switched_at` · `my_switch` (`on` · `off`) · `practice_for?` · `demo` · `status` · `last_connected_at` · `latency_ms` · `server_version` · `compatibility_status` | CP-40 |
| `POST /graph-databases/test` | Test details before anything is saved — `{connector, uri, auth, database?}` → `{ok, latency_ms?, server_version?, compatibility_status?, error?, discovered?: {node_labels, edge_labels, counts, indexes, constraints}}`; records nothing | CP-25 · CP-26 · CP-35 |
| `POST /graph-databases` | Connect — `{name, description?, connector, uri, auth, database?, model?}`: tests again, saves it read-only and off, seals the credential, writes the drafted model as a draft. `201` `{graph_database, model_id?, discovered}` | CP-25 · CP-26 |
| `GET /graph-databases/{name}` · `PATCH /graph-databases/{name}` | One graph database · change description, address, user, password or database after a passing test of the same details; a blank password keeps the stored one; takes `password` (signing in again) when the credential changes | CP-35 |
| `DELETE /graph-databases/{name}?confirm=<name>` | Remove Invana's records of it; takes `password` | CP-35 |
| `PUT /graph-databases/{name}/mode` | `{mode}` — `read_write` takes `password` | CP-38 |
| `PUT /graph-databases/{name}/switch` | `{enabled}` — the deployment's switch | CP-39 |
| `PUT /graph-databases/{name}/my-switch` | `{on}` — the caller's own switch | CP-39 |
| `PUT /graph-databases/{name}/practice` | `{practice_for: <name> \| null}` | CP-41 |
| `POST /graph-databases/{name}/ping` | *Reconnect* — try the saved connection again, refresh its status | CP-35 · CP-40 |
| `POST /graph-databases/{name}/introspect` | *Read types again*, in the background | CP-35 |
| `POST /graph-databases/{name}/acknowledge-version` · `PUT /graph-databases/{name}/version` | Accept an untested server version · declare one the connector cannot detect | CP-35 |
| `GET /setup` · `POST /setup/{step}` | The four required steps and the offers, derived on every read — `{step, done, completed_at?, skipped_at?, required, gate?, blocked_by?, broken?}` · `{act: skip · reset}` on an offer | CP-24 |
| `GET /connectors` | Every installed connector — `name` · `language` (`opencypher` · `gremlin`) · `package` · `version` · `state` (`loaded` · `failed`) · `error?` | CP-17 |

### Events

| Event | When |
|---|---|
| `control.graph_databases.create` · `control.graph_databases.update` · `control.graph_databases.delete` | Connected · its connection changed, which reconnects · removed, its name kept in `details` |
| `control.graph_databases.mode` | Read-only ↔ read + write — `{from, to}` |
| `control.graph_databases.switch` · `control.graph_databases.my_switch` | The deployment's switch · a person's own — `{enabled}` |
| `control.graph_databases.practice` | Named or unnamed a practice graph database — `{practice_for}` |
| `control.graph_databases.test` · `control.graph_databases.ping` · `control.graph_databases.introspect` · `control.graph_databases.introspect_completed` | A saved one tested · reconnected · its types read again, started · finished |
| `control.graph_databases.health_checked` · `control.graph_databases.reconnected` · `control.graph_databases.unreachable` | The engine's own check · its own reconnect · a graph database dropped — actor `system`; `unreachable` raises an ops alert |
| `control.graph_databases.version_detected` · `control.graph_databases.version_acknowledge` · `control.graph_databases.version_declare` | A version found · accepted · declared |
| `control.setup.skip` · `control.setup.reset` | An offer skipped · brought back |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 403 | Any write by a person whose role is not Admin — `role_required` | *This needs an Admin — ask {admins}.* | CP-40.6 · CP-35.13 · CP-38.6 · CP-39.7 · CP-41.5 |
| 401 | Read + write, a credential change or removal without the password, or with a key | *Sign in again to do this.* | CP-38.3 · CP-35.14 |
| 409 | A name another graph database holds | *{name} is already a graph database.* | CP-25.3 |
| 422 | A name with characters outside `[a-z0-9_]`, or a field past its length | *{field}: {why}.* | CP-25.3 |
| 422 | Connecting or saving details that fail their test — `connection_failed`, nothing written | *{the connector's own words}* | CP-25.9 · CP-26.3 · CP-35.6 |
| 409 | Saving details that have not passed a test | *Test the connection to save it.* | CP-35.5 |
| 422 | Changing the connector or the name once saved | *The {field} is fixed once saved.* | CP-35.8 |
| 409 | A write to a read-only graph database, or one on an untested server version, by any path — before the wire | *{name} is read-only — {why}.* | CP-38.5 · CP-35.17 |
| 409 | Work that needs a graph database that is off — `switched_off`, with who and when | *{name} is off — switched off by {person} {when}.* | CP-39.4 · CP-39.5 |
| 409 | Turning on, for oneself, a graph database the deployment has off | *{name} is off for the deployment — ask {admin}.* | CP-39.6 |
| 409 | Removing a graph database a rule, a match rule or a workflow names | *{name} is named by {what} — change {it} first.* | CP-35.12 |
| 422 | Removing with a `confirm` that is not its name | *Type {name} to remove it.* | CP-35.11 |
| 422 | A practice graph database standing in for itself, for a practice one, or for one with another connector | *{name} cannot stand in for {other} — {why}.* | CP-41.4 |
| 409 | A question, board, schedule or workflow step on a practice graph database | *{name} is for practice — it is never asked.* | CP-41.3 |
| 409 | A route whose gate is shut — `setup_incomplete`, with `gate` and `missing` | *{surface} opens when {step}.* | CP-24.6 |
| 422 | Skipping a required step | *{step} is required — it cannot be skipped.* | API only — Studio offers *Skip* only on an offer |
| 503 | *Read types again* while it is not connected | *{name} is not connected — reconnect first.* | CP-35.18 |
| 409 | A graph database whose connector is not installed | *{connector} is not installed — install {package}.* | CP-17.7 |
| 422 | An act the vendor declares unsupported | *{vendor} cannot {act}.* | CP-18.4 · CP-19.2 |
| 422 | A vector search on a property with no vector index | *{property} has no vector index — it needs {index}.* | CP-19.3 |
| 422 | A query vector of another dimension than the index | *The index holds {n} dimensions; the query has {m}.* | CP-19.4 |
| 502 | The database refuses or fails a query | *{connector}: {the database's own message}.* | CP-18.8 |

### CLI

| Command | Does |
|---|---|
| `invana databases list · show · test · add · update · remove --database <name>` | The routes, as the person signed in; `add` and `update` read the password from a prompt, never a flag |
| `invana databases mode <name> read-only · read-write` · `invana databases on · off <name> [--mine]` · `invana databases practice <name> --for <other>` | Mode, switches and practice |
| `invana version` | The engine version and every installed connector — name, language, package version — a failed one named with its package and error |

### Mechanisms

| Mechanism | How |
|---|---|
| Nothing before *Connect* | Testing and drafting write nothing; the one create call saves the graph database, read-only and off, and the draft model in one transaction, or nothing |
| A test | Builds a transient connector, connects in the driver's read mode within 10 seconds and discards it; `error` is the connector's own words, or *Connect timed out after 10s.* A save needs a passing test of the same details |
| The credential | Sealed under the install key like every secret ([system-design § 6](../../../../system-design.md#files-and-encryption)); never in an event, a log, a span or a ledger row |
| Read mode | Every read session opens in the driver's read mode — Bolt `READ` access mode, Gremlin `ReadOnlyStrategy`; a write session opens only for a write step on a `read_write` graph database, after the step's policy check |
| Admission | Before a run is dispatched the coordinator checks every graph database its plan names against `enabled`, the person's own switch and `status`; one that is off refuses the run, naming who switched it off ([CP-F03](../CP-F03-workers-and-the-queue/feature.md)) |
| Off, later | Turning a graph database off flags each workflow whose steps name it — its runs refused until it is on — and each schedule skips its next firing with an ops alert to the schedule's creator and the Admins |
| Health | The engine checks each graph database on a fixed interval and on every failure; a lost connection retries with a doubling delay (1 s, 2 s, 4 s …) up to `INVANA_GRAPH_RETRY_MAX_INTERVAL_S` (60); a failed attempt never cancels its own retry |
| Practice | A test run resolves `data/<graph database>/<kind>` for the graph database a practice one stands in for to the practice one; anything else that names a practice graph database is refused |
| Set-up is derived | `GET /setup` composes the steps from the facts on every read; `connected` — a graph database on with a passing last test · `modelled` — a published model · `grounded` — a load succeeded, or a graph database holds records of a published kind · `answering` — the default AI model passed its last check |
| Removing | Removes the graph database and every record that carries its `database_id`; its History rows stay, its name kept |
| Supported databases | openCypher — Neo4j (`neo4j`) · Memgraph (`memgraph`) · ArcadeDB (`arcadedb-cypher`) · Gremlin — JanusGraph (`janusgraph`) · Amazon Neptune (`neptune`) · TinkerGraph (`tinkergraph`) · ArcadeDB (`arcadedb-gremlin`); vector search where the database has an index |
| Three layers | **Base** (core) — lifecycle, transactions, health, the queryset contracts · **language** (core) — a complete openCypher or Gremlin connector with its reference driver, `neo4j` or `gremlinpython` · **integration** (`integrations/invana-<db>/`, its own manifest, dependencies and tests) — a driver the reference one cannot replace, a schema dialect, an algorithm library, a vector index. No code above the connector branches on a database's name |
| Registration | `[project.entry-points."invana.connectors"]` `<name> = "invana_<db>.connector:<Class>"`; read once at start. Names are lowercase and unique; two packages declaring one name both fail to load, named; a connector that cannot be imported is listed `failed` and the engine still starts |
| The contract | A connector subclasses a language connector. `_create_driver` · `_close_driver` · `execute` · `health_check` are implemented already; a package overrides one only where its vendor differs, and any queryset method, or marks it unsupported. Vendor hooks: `message_serializer()` · `query_builder` · `coerce_id()` · `classify_error()` · the serializer's `coerce_element_id()` |
| Querysets | Data reader (vertices and edges, filtered, paged; neighbours, counts, resolve) · data writer (creates, updates, deletes, bulk) · schema (labels, relationship types, property keys, constraints, indexes) · algorithms · vector. Every method is `async` |
| Filters | A `FilterGroup` — a nested AND / OR of conditions — compiled by each language's query builder; nothing is concatenated from strings |
| One shape | A serializer per language turns driver records into the engine's vertices and edges; anything else — a scalar, a map, a list, a count — is a record. Driver types never leave the connector |
| `execute()` is the one door | `execute(query, parameters, *, timeout_s, read_only=True)` runs a compiled step in its language's raw form — openCypher over Bolt; Gremlin as a script with bindings. The querysets compose traversals and send bytecode (`execute_traversal`). Every call writes its ledger row before its result is used ([AC-F09](../../../access/features/AC-F09-what-left-the-platform/feature.md#engine)) |
| Vendor differences | Wire serializer: GraphBinary by default, GraphSON for JanusGraph (its `RelationIdentifier`) · identity function: `elementId()` by default, Memgraph's `id()` via its builder's `ELEMENT_ID` · every id passes `coerce_id` · a construct spelled differently is overridden (Memgraph's `-[*BFS ..n]-`), never refused · a server that does not evaluate scripts is declared (Amazon Neptune) |
| Capabilities | Property types and features — constraints, index kinds, algorithms, vector search — keyed by connector and server version, resolved from the server on connect and on demand, or declared by an Admin, and cached with the connection. Enforced at authoring, publish and import: a model version validated against a database that has since changed is refused naming the difference; a model whose types the target cannot hold arrives as an unpublishable draft listing them; an untested version locks the graph database read-only until acknowledged |
| Vector search | A queryset in each language connector, overridden per vendor; the database's own index. Results are records with scores, cited; an index with nothing embedded returns none, worded *nothing embedded*. Memgraph declares none |
| Conformance | One shared suite every package runs against a live database, never mocked; a method left unimplemented fails it, named |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | Three tables in Postgres; credentials sealed like every secret | NFR-SEC-2 |
| § 7 Architecture and components | Connector packages found by entry point; base · language · integration layers | — |
| § 8 APIs and events | The graph databases, their mode, switches, practice and set-up under `/api/v1/control`; `control.graph_databases.*` events | NFR-PERF-3 |
| § 9 Distributed execution | Admission refuses work on a graph database that is off, naming who switched it off | — |
| § 11 Failure modes | An unreachable graph database reads unreachable with when it last connected; work that needs no step on it keeps answering | NFR-REL-3 |
| § 12 Qualities | Security: read-only by default, every read in the driver's read mode, read + write needs the password again, every call ledgered | NFR-SEC-4 · NFR-SEC-5 · NFR-SEC-7 · NFR-SEC-9 |

## Decisions

| Decision | Detail |
|---|---|
| Graph databases are the deployment's | Settings › Invana › Graph databases; one list, Admin acts, everyone reads |
| Connecting is a modal of steps | Name · Connect · Shape · Ready on a step strip; it shows a person's own data back to them and asks for a decision at each step |
| The model is shaped while connecting | The Modeller agent reads the schema and proposes a draft before anything is saved; publishing happens in Model |
| The name is fixed | It is the resource segment every rule names; renaming would silently change what rules reach |
| Read + write needs the password | It widens what agents can do to customer data — a change to access ([NFR-SEC-4](../../../../system-design.md#3-non-functional-requirements)) |
| Reconnecting is an Admin's | It changes nothing the graph database holds, but the one role table gives Operators and Modellers reads only; an unreachable database raises an ops alert to the Admins |
| Demo data is a graph database | The contributor setup connects one, marked demo; *Try it on demo data* opens Explore on it. An Admin switches it off or removes it like any other |
| The first-run question carries into the first ask | *What are you trying to decide?* is kept in the browser and put in the Assistant's composer when set-up is done — never sent by itself |
| Connectors need no switch | Installed is offered; a connector reaches a graph database, not the outside, so it is not a plugin |

## Open questions

| Question | Who answers |
|---|---|
| The one role table has no row for a person's own graph database switch; this feature lets every signed-in person narrow their own runs, as the glossary's *On · Off* says. Recommend: add *Graph databases — a person's own switch: Own · Own · Own* beside the plugins' row | Ravi |

## Not building

| Item | Why not |
|---|---|
| Installing a connector from Studio | Installs on premises run only what an Admin installed on the machine |
| A second credential per graph database | One credential each; what an agent may touch is its Access Policies, not a second login |
| Renaming a graph database | Its name is in every rule that reaches it |
| Translating between openCypher and Gremlin | Each step runs in its own graph database's language; the engine joins the results |
| SQL or SPARQL databases | Not families Invana targets |
| A vector store beside the graph · embeddings made by the engine | Two stores are two truths; embeddings arrive with the data |
| A Python fallback for an algorithm a database lacks | The honest answer is that it cannot |
| Connection pooling settings in Studio | Tuning belongs to configuration |
| A tour or a set-up page of its own | Each step opens the place that makes its fact; set-up steps aside at the first answer |
| Writing demo data into a person's own database | Demo data lives in its own graph database |
