# Invana

Invana is an open-source **graph intelligence platform** that turns structured 
knowledge graphs into interactive decision simulation environments.

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
