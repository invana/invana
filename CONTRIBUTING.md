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

# Start both engine and studio in dev mode
./scripts/dev.sh
```

### Engine (Python)

```bash
cd engine
uv sync                         # Install dependencies
uv run pytest                   # Run tests
uv run ruff check .             # Lint
uv run ruff format .            # Format
```

### Studio (TypeScript/React)

```bash
cd studio
pnpm install                    # Install dependencies
pnpm dev                        # Start dev server
pnpm test                       # Run tests
pnpm lint                       # Lint with Biome
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

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(query-engine): add query plan caching
fix(connectors): handle Neo4j connection timeout
docs: update quickstart guide
chore: bump dependencies
```

### Pre-commit Hooks

Lefthook runs automatically on commit:
- **Python**: `ruff check --fix` + `ruff format`
- **TypeScript**: `biome check --write`

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
