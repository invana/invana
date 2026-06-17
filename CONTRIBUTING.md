# Contributing to Invana

Thank you for your interest in contributing to Invana! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.14+
- Node.js 22+
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [pnpm](https://pnpm.io/) (Node package manager)
- Docker & Docker Compose (for integration tests)

### Getting Started

```bash
# Clone the repo
git clone https://github.com/invana/invana.git
cd invana

# Install all dependencies + pre-commit hooks
make setup

# Start the local infrastructure (postgres + neo4j + hyperdx)
docker compose -f docker-compose-infra.yml up -d

# Start both engine and studio in dev mode
make dev
```

Run `make help` to see all available commands.

### Local infrastructure

`docker-compose-infra.yml` provides the backing services for local development
and testing. By default it starts only the core trio:

| Service  | What it's for                          | Port(s)         |
|----------|----------------------------------------|-----------------|
| postgres | App-state database                     | 35432           |
| neo4j    | Default graph database                 | 7474, 7687      |
| hyperdx  | Observability (traces/logs/metrics) UI | 8080, 4317–4318 |

```bash
# Start the default core services
docker compose -f docker-compose-infra.yml up -d

# Stop them
docker compose -f docker-compose-infra.yml down
```

The additional graph databases (Memgraph, JanusGraph, ArcadeDB) are heavier and
**opt-in via Compose profiles** — they don't start by default. Enable one, or
all of them with the `extra-dbs` group profile:

```bash
# Add a single on-demand database
docker compose -f docker-compose-infra.yml --profile memgraph up -d
docker compose -f docker-compose-infra.yml --profile janusgraph up -d
docker compose -f docker-compose-infra.yml --profile arcadedb up -d

# Add all on-demand databases at once
docker compose -f docker-compose-infra.yml --profile extra-dbs up -d
```

Pass the same `--profile` flag to `down`/`stop` to tear those services down too
(or use `down --remove-orphans`).

### First-time bootstrap (auth)

The engine and Studio both require an authenticated user to do anything beyond `/login`. On a fresh checkout — or after wiping the Postgres data volume — create the **root superuser** + their personal workspace via the CLI:

```bash
# Interactive — prompts for first name, last name (optional), email, password
uv run --directory engine invana init

# Non-interactive (CI / scripted setup)
uv run --directory engine invana init --non-interactive \
  --email admin@invana.dev \
  --password "<at-least-12-chars>" \
  --first-name "Root" \
  --last-name "Admin"
```

The command is **idempotent** — if any user with `is_superuser=true` already exists, it exits without making changes. To re-bootstrap, wipe the `users` table (or the whole DB) first.

What gets created:

- A `users` row with `is_superuser = true` (gates `starlette-admin` at `/admin`)
- A `workspaces` row (default slug derived from your first name)
- A `workspace_members` row linking you as `admin` of that workspace

From there: log into Studio (`http://localhost:8300/login`), open the user menu → **Invitations**, and issue invite URLs for additional users. Per `docs/system-design.md §4.1`, the CLI does **not** register additional users; everyone after the root is invite-gated.

### Required environment variables

`INVANA_SECRET_KEY` and `INVANA_ENCRYPTION_KEY` are **required in production** and fall back to insecure dev defaults in `env=development` (loud warning at startup). For local dev you can ignore them; for any shared / non-dev deployment, generate real ones:

```bash
# JWT signing key (INVANA_SECRET_KEY)
python -c 'import secrets; print(secrets.token_urlsafe(48))'

# Fernet encryption key (INVANA_ENCRYPTION_KEY) — used for graph connector + LLM-provider secrets at rest
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Put them in `engine/.env`. All other auth knobs (TTLs, bcrypt rounds, min password length, JWT algorithm) live under `INVANA_AUTH_*` and have sensible defaults — see `engine/src/invana/settings.py`. The full design is in [`docs/internal/mvp/layer-1-identity-access.md`](docs/internal/mvp/layer-1-identity-access.md).

### Default ports (local dev)

| Service          | Port  | Override                                   |
|------------------|-------|--------------------------------------------|
| Engine (FastAPI) | 8200  | `INVANA_PORT` / `invana start --port`      |
| Studio (Vite)    | 8300  | `studio/vite.config.ts`                    |
| Postgres         | 35432 | `docker-compose-infra.yml`                 |

Studio's API base URL defaults to `http://localhost:8200`; override with `VITE_API_BASE_URL` in `studio/.env.local` if needed.

### Engine (Python)

```bash
make engine-test                # Run tests
make engine-lint                # Lint (ruff check)
make engine-format              # Format (ruff format)
```

#### Installing optional extras

The engine has optional dependency groups. `uv sync` is **exact** — it makes the environment match exactly what you ask for, so syncing with one `--extra` (or omitting `--dev`) **removes** packages from a previously installed set. Always specify everything you want in a single command:

```bash
# Install a single extra
uv sync --extra server

# Install multiple extras (required to keep all of them)
uv sync --extra server --extra telemetry

# Install everything
uv sync --extra all
```

Available extras: `server`, `telemetry`, `all`.

The **`dev` group** (pytest, httpx, ruff, editable connectors) is pruned the same way — `uv sync --extra all` *without* `--dev` strips it, and `uv sync --dev` *without* `--extra all` strips the extras. The canonical full developer install that keeps everything is:

```bash
uv sync --dev --extra all   # or: uv sync --dev --all-extras
```

If you sync with a missing piece, the failure shows up at **import time**, not install time, and the message points at the wrong thing:

| Missing from the sync | Symptom |
|---|---|
| `--extra telemetry` (with `INVANA_TELEMETRY_ENABLED=true` in `.env`) | `import invana` raises `ImportError: OpenTelemetry packages are required …` |
| `--extra server` | `ModuleNotFoundError: No module named 'fastapi'` when importing routes/app |
| `--dev` | tests can't import `httpx` / `pytest` (collection error) |

When something that worked yesterday suddenly can't import a top-level package, re-run the full `uv sync --dev --extra all` before debugging further — a partial sync from an earlier command is the usual cause.

### Studio (TypeScript/React)

```bash
make studio-test                # Run tests
make studio-lint                # Lint (biome check)
make studio-format              # Format (biome format)
```

### Docs

```bash
make docs                       # Serve docs locally (http://localhost:8000)
make docs-build                 # Build docs static site
```

## Making Changes

### Branch Naming

- `feature/<description>` — New features
- `bugfix/<description>` — Bug fixes
- `hotfix/<description>` — Urgent fixes for production

### Changesets

Every PR that changes user-facing behavior must include a changeset:

```bash
pnpm changeset
```

This creates a file in `.changeset/` describing your change and its semver impact.

### Commit Messages

We enforce [Conventional Commits](https://www.conventionalcommits.org/) via [commitizen](https://commitizen-tools.github.io/commitizen/). Non-conforming commit messages are **rejected automatically** by the `commit-msg` hook.

**Format:** `<type>(<optional scope>): <description>`

**Allowed types:**

| Type       | Use when...                                    |
|------------|------------------------------------------------|
| `feat`     | Adding a new feature                           |
| `fix`      | Fixing a bug                                   |
| `docs`     | Documentation only changes                     |
| `style`    | Code style (formatting, no logic change)       |
| `refactor` | Code change that neither fixes nor adds        |
| `perf`     | Performance improvement                        |
| `test`     | Adding or updating tests                       |
| `build`    | Build system or dependency changes             |
| `ci`       | CI/CD configuration changes                    |
| `chore`    | Maintenance tasks                              |
| `revert`   | Reverting a previous commit                    |
| `bump`     | Version bumps                                  |

**Examples:**

```
feat(query-engine): add query plan caching
fix(connectors): handle Neo4j connection timeout
docs: update quickstart guide
chore: bump dependencies
refactor(studio): extract sidebar into design-kit component
```

**Scopes** are optional but encouraged — use the module name (`engine`, `studio`, `docs`, `query-engine`, `connectors`, etc.).

### Pre-commit Hooks

[pre-commit](https://pre-commit.com/) runs automatically on every commit (installed via `make setup`):

- **commit-msg**: Validates commit message format (commitizen)
- **pre-commit**: Lints and formats staged files
  - Python: `ruff check --fix` + `ruff format`
  - TypeScript: `biome check`

### Testing

- Write tests for all new functionality
- Unit tests: `engine/tests/unit/` and co-located `*.test.tsx` in studio
- Integration tests: `engine/tests/integration/`
- E2E tests: `studio/tests/e2e/`
- Maintain **80%+ code coverage**

## Pull Request Process

1. Create a branch from `main`
2. Make your changes with tests
3. Add a changeset (`pnpm changeset`)
4. Push and open a PR
5. CI must pass (lint, tests, coverage)
6. Get at least one review approval
7. Squash and merge

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).
