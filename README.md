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

# 2. Start the local infrastructure (postgres + neo4j + hyperdx)
docker compose -f docker-compose-infra.yml up -d

# 3. Run migrations + bootstrap the default root superuser
#    (admin / hi@invana.local / change_me_please — change the password after first login)
make engine-init

# 4. Start the engine + studio dev servers
make dev
```

Studio runs at `http://localhost:8300`, the engine at `http://localhost:8200`.
Log in with `hi@invana.local` / `change_me_please`.
Run `make help` to see all available commands.

The default infra brings up only the core services (postgres, neo4j, hyperdx);
the extra graph databases (Memgraph, JanusGraph, ArcadeDB) are opt-in via Docker
Compose profiles. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide —
infra profiles, environment variables, optional dependency extras, testing,
changesets, commit conventions, and the pull-request process.
