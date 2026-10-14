# Invana

**An ontology-governed operating system for humans and AI agents.**

Invana is open source. People and agents work on the same knowledge graph, and
the ontology governs both of them.

## The products

| Product | For | Job |
|---|---|---|
| **Datasets** | researchers, curators | Gather the data: reusable, labelled by origin, checked against standards |
| **Modeller** | modellers, compliance leads | Give it meaning: models, stitches, worlds, guardrails, rules |
| **Explorer** | analysts | Ask and look: answers drawn on a board, each claim citing its record |
| **Projects** | anyone deciding something | Pursue a question: gather evidence for and against, decide, keep the trail |
| **Agents** | builders | Build, tune and watch the agents that do the legwork |

## Deploy

Invana has no published release yet, so you deploy it from source. You need Docker with Docker Compose.

```bash
git clone https://github.com/invana/invana.git
cd invana
docker compose up -d
docker compose exec engine uv run invana migrate
docker compose exec engine uv run invana init --non-interactive
```

| | |
|---|---|
| Studio | <http://localhost:8300>. Sign in as `admin` / `change_me_please`, then change the password |
| Engine API | <http://localhost:8200> |
| Graph database | Neo4j starts by default. Memgraph, JanusGraph and ArcadeDB are Compose profiles, for example `docker compose --profile memgraph up -d` |
| Sample data | [CONTRIBUTING.md › Quick start](CONTRIBUTING.md#quick-start) loads the air-routes graph |

`pip install invana` and the Docker Hub images arrive with the first release.

## Use cases

Invana is in **beta**. ✅ available · 🟡 partial: usable, with parts still being built.

### Govern what people and agents may touch

*Ontology-governed.* The ontology decides what anyone may read, use or send, and it is the same for a
person and for an agent.

| Capability | What you get | Status |
|---|---|---|
| Models and meaning | Models give the data its meaning, and stitches join models from different sources | ✅ |
| Worlds, guardrails and rules | A guardrail is always in force, a world narrows it for one question, and a rule can block, warn or report | 🟡 |
| Roles and access | Graph roles are enforced on every route, and search shows only what you can open | ✅ |
| Provenance | Datasets carry their origin, versions, licence and sensitivity. A retracted version flags everything that cites it | 🟡 |

### Decide with evidence

*For humans.* Ask, test and decide, with every step traceable to the data behind it.

| Capability | What you get | Status |
|---|---|---|
| Grounded answers | Every answer traces from the LLM to the query, the record and the dataset. When the graph can't answer, Invana says so | ✅ |
| Decisions with a trail | Projects keep the evidence for and against, and decisions are append-only, so anyone can follow how a call was made | ✅ |
| Simulation | Run a simulator on a project branch over pinned dataset versions, reproducible from its seed. One simulator ships today: genomic prediction | ✅ |

### Put agents to work, within bounds

*For AI agents.* Agents do the legwork; guardrails and budgets keep it inside the lines.

| Capability | What you get | Status |
|---|---|---|
| Plans from instructions | An agent's plan is generated from its instructions, versioned, and checked by evals before it publishes | 🟡 |
| Tools through plugins and MCP | Agents call tools through plugins, and through any MCP server an Admin enables | 🟡 |
| Token budgets | Each agent has a monthly and a per-run token budget, metered in tokens, never currency | ✅ |

### Run it all on one layer

*An operating system.* What every product shares, so work is visible wherever it started.

| Capability | What you get | Status |
|---|---|---|
| Runs, schedules, approvals and notifications | One journal of every run, schedules that need no project, and a person's approval before anything leaves | 🟡 |
| Change log | Every versioned thing has a history, any two versions can be compared, and the effect after a change is shown | 🟡 |
| Any graph database | Neo4j, Memgraph, ArcadeDB, JanusGraph and TinkerGraph, through Cypher or Gremlin. Amazon Neptune is planned | 🟡 |

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers the development setup, how a feature goes from the feature
index to code, and how to raise a pull request.
