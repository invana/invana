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

### Engine (Python)

```bash
make engine-test                # Run tests
make engine-lint                # Lint (ruff check)
make engine-format              # Format (ruff format)
```

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
