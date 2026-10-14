# Invana

**An ontology-governed operating system for humans and AI agents.**

Invana is open source. People and agents work on the same knowledge graph, and
the ontology governs both of them:

- **Ontology-governed.** Models give the data its meaning. Worlds, guardrails and
  rules decide what anyone may read, use or send, and they apply to people and
  agents alike.
- **Grounded.** Every answer traces back from the LLM to the query, the record and
  the dataset it came from. When the graph can't answer, Invana says so.
- **An operating system.** Runs, schedules, approvals, notifications and a change
  log are shared by every product, so the work is visible wherever it started.

## The products

| Product | For | Job |
|---|---|---|
| **Datasets** | researchers, curators | Gather the data: reusable, labelled by origin, checked against standards |
| **Modeller** | modellers, compliance leads | Give it meaning: models, stitches, worlds, guardrails, rules |
| **Explorer** | analysts | Ask and look: answers drawn on a board, each claim citing its record |
| **Projects** | anyone deciding something | Pursue a question: gather evidence for and against, decide, keep the trail |
| **Agents** | builders | Build, tune and watch the agents that do the legwork |

All five run on Neo4j, Memgraph, ArcadeDB, JanusGraph, Amazon Neptune or
TinkerGraph, through Cypher or Gremlin. Each database connector is its own
package (`pip install invana-neo4j`).

## Development setup

### Prerequisites

- Python 3.14+
- Node.js 22+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (Node package manager)
- Docker & Docker Compose

### Quick start

```bash
# 1. Clone and install dependencies + pre-commit hooks
git clone https://github.com/invana/invana.git
cd invana
make setup

# 2. Start postgres, neo4j, the engine, and studio (hot-reload dev containers)
docker compose up -d

# 3. Run migrations + bootstrap the default root superuser
#    (admin / hi@invana.local / change_me_please — change the password after first login)
make engine-init
```

Studio runs at `http://localhost:8300`, the engine at `http://localhost:8200`.
Log in with `hi@invana.local` / `change_me_please`.
Run `make help` to see all available commands.

`docker compose up -d` starts only the core stack — postgres, neo4j, engine,
studio. Neo4j is the only graph database that starts by default; the extra
ones (Memgraph, JanusGraph, ArcadeDB) and the observability stack (HyperDX)
are opt-in via Docker Compose profiles. Prefer running the engine and studio
directly on your host? Use `make dev` instead of the `engine`/`studio`
containers (stop those two, or don't start them, first — same infra either
way). See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide — infra
profiles, environment variables, optional dependency extras, testing,
changesets, commit conventions, and the pull-request process.
