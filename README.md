# Invana

**An ontology-governed decision intelligence platform for humans and AI agents.**

One knowledge graph, one set of rules, for every thinker and the systems they build.

Invana is open source. What it is and why is the [vision](specs/vision.md).

## Core features

Invana is in **beta**. ✅ available · 🟡 usable, with parts still being built. Features are grouped by the
[pillars and the operating system](specs/vision.md#pillars-and-capabilities).

| Feature | What you get | Pillar | Status |
|---|---|---|---|
| **Ontology-governed** | Models give the data its meaning, and links between models join models from different sources | Ontology | ✅ |
| **Rules and views of the graph** | Rules block, warn or report on what must always hold; a view of the graph bounds what agents may see, per question | Ontology | 🟡 |
| **Datasets and provenance** | Origin, versions, licence and sensitivity on every dataset; a retraction flags everything that cites it | Ontology | 🟡 |
| **Agents** | Plans generated from each agent's instructions, checked by evals before they publish, and bounded by token budgets | Agents | 🟡 |
| **Boards and the assistant** | Ask in plain words beside a saved board; the answer arrives on the canvas, and conversations pick up where they left off | Evidence | 🟡 |
| **Grounded answers** | Every answer traces from the LLM to the query, the record and the dataset. When the graph can't answer, Invana says so | Evidence | ✅ |
| **Annotations** | Note what you found on the records themselves, for the next person to read | Evidence | 🟡 |
| **Decisions with a trail** | Projects keep the evidence for and against, and decisions are append-only | Evidence | ✅ |
| **Simulation** | Run a simulator on a project branch over pinned dataset versions, reproducible from its seed | Evidence | ✅ |
| **Self-hosted** | One Docker Compose stack on your own machines. Your graph and your keys stay with you, and with Ollama the LLM can run on your network too | Operating system | ✅ |
| **Roles and access** | Graph roles are enforced on every route, and search shows only what you can open | Operating system | ✅ |
| **Plugins** | Every task comes from a plugin. Core plugins are always on; tool, MCP and simulator plugins extend what agents can do ([below](#plugins)) | Operating system | 🟡 |
| **Runs, schedules and approvals** | One journal of every run, schedules with delivery, and a person's approval before anything leaves | Operating system | 🟡 |
| **Change log** | Every versioned thing has a history; compare any two versions and see the effect after | Operating system | 🟡 |

## Deploy

Invana has no published release yet, so you deploy it from source. You need Docker with Docker Compose.

```bash
git clone https://github.com/invana/invana.git
cd invana
docker compose up -d
```

On every start, a one-off `engine-migrate` container applies pending migrations, then the engine starts.
No user exists until you create one.

### Create the first users

1. Create the first install Admin. The command asks for a username, a name, an optional email and a
   password; nothing is filled in for you:

   ```bash
   docker compose exec engine uv run invana users create --superuser
   ```

2. Open Studio at <http://localhost:8300> and sign in as that Admin.
3. Add the people who will use it. Each command asks for the password:

   ```bash
   docker compose exec engine uv run invana users create --username user --email user@invana.io
   ```

   Add `--superuser` for another install Admin. Graph roles are given per Graph, in Studio.
4. Reset a password when someone needs it:

   ```bash
   docker compose exec engine uv run invana users update-password --user user
   ```

### What is running

| | |
|---|---|
| Studio | <http://localhost:8300> |
| Engine API | <http://localhost:8200> |
| Graph database | Neo4j starts by default. Memgraph, JanusGraph and ArcadeDB are Compose profiles, for example `docker compose --profile memgraph up -d` |
| Sample data | [The airways demo](demos/airways/README.md): models, records, links between models and rules, step by step |

> **This is the development stack.** Before anyone else can reach it, set `INVANA_SECRET_KEY` and
> `INVANA_ENCRYPTION_KEY` ([CONTRIBUTING.md › Environment variables](CONTRIBUTING.md#environment-variables))
> and use strong passwords for every account.

## Integrations

### Graph databases

The graph backend is switchable: each Graph connects to the database you choose, and models, governance
and every capability work the same on any of them. Invana speaks both **Cypher** and **Gremlin**, so its
generic connectors can reach other Cypher or Gremlin databases too. The ones below have their own tested
connector.

| Database | Query language | Connector |
|---|---|---|
| Neo4j | Cypher | [`invana-neo4j`](integrations/invana-neo4j) |
| Memgraph | Cypher | [`invana-memgraph`](integrations/invana-memgraph) |
| ArcadeDB | Cypher, Gremlin | [`invana-arcadedb`](integrations/invana-arcadedb) |
| JanusGraph | Gremlin | [`invana-janusgraph`](integrations/invana-janusgraph) |
| TinkerGraph | Gremlin | [`invana-tinkergraph`](integrations/invana-tinkergraph) |
| Amazon Neptune | Gremlin | planned |

### LLM providers

| Provider | How it connects |
|---|---|
| Anthropic (Claude) | The official Anthropic API |
| Claude Agent SDK | Claude through a local Claude Code install, with an API key or a Claude subscription token |
| OpenAI | The OpenAI API |
| OpenAI-compatible servers | Any `/chat/completions` endpoint, such as vLLM, LM Studio or LocalAI |
| Ollama | Local models, no API key |

### Data and standards

| Format | Use |
|---|---|
| SKOS | Import a vocabulary as a standard |
| RDFS, OWL (subset), schema.org | Import an ontology as a draft model |
| JSON-LD, Turtle, RDF/XML | Read those ontology files |
| OpenTelemetry | Traces, logs and metrics, for example into HyperDX |

## Plugins

Everything a run does is a task from a plugin. An install Admin enables tool and MCP plugins; core
plugins are always on.

| Plugin | Type | What it does | Status |
|---|---|---|---|
| Graph read | core | Run queries, count types, resolve and expand records, preview links between models | ✅ |
| Graph write | core | Write and bulk-load records; apply, commit and withdraw links between models | ✅ |
| Ingest | core | Check a bundle, snapshot its model, validate records before they land | ✅ |
| LLM | core | Understand a question, plan the work, turn a thought into a query, draft plans and models | ✅ |
| Schema write | core | Propose, validate and migrate model changes | ✅ |
| Work write | core | Spawn agents, delegate to them, create tasks | ✅ |
| Pure | core | Validate queries, verify results, shape results for the canvas, with no side effects | ✅ |
| Web | tool | Search, fetch, and download-and-extract. Ships the *collect a dataset* skill | ✅ |
| Mail | tool | Read a mailbox over IMAP; send over SMTP only after a person approves | ✅ |
| Science sources | tool | PubMed search, UniProt and PubChem lookups | ✅ |
| MCP | mcp | One plugin per MCP server an Admin adds; each of its tools becomes a task | 🟡 |
| Genomic prediction | simulator | Predict trait outcomes for a cross, run on a project branch over pinned datasets | ✅ |
| Plugin SDK | sdk | Manifests, the task context, errors and the simulator contract, for writing a plugin. Plugins ship inside the engine today | 🟡 |

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup, how a feature goes from the feature
index to code, and how to raise a pull request.
