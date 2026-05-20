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

# Start both engine and studio in dev mode
make dev
```

Run `make help` to see all available commands.

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

The engine has optional dependency groups. `uv sync` is exact — running it with one `--extra` removes packages from a previously installed `--extra`. Always specify all desired extras together:

```bash
# Install a single extra
uv sync --extra server

# Install multiple extras (required to keep all of them)
uv sync --extra server --extra telemetry

# Install everything
uv sync --extra all
```

Available extras: `server`, `telemetry`, `all`.

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
