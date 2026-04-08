# Invana — Graph Intelligence Platform

Structured knowledge graphs into interactive decision simulation environments.

## Architecture

- **Monorepo**: `engine/` (Python 3.14 + FastAPI) + `studio/` (React 19 + TypeScript)
- **Distribution**: Single pip package (`pip install invana`) and Docker images
- **CLI**: `invana start`, `invana migrate`, `invana version`

## Stack

### Engine (Python)
- **Framework**: FastAPI + uvicorn (async)
- **Package manager**: uv
- **Linting**: Ruff
- **Testing**: pytest + pytest-asyncio + pytest-cov
- **App state DB**: SQLAlchemy async (SQLite dev / PostgreSQL prod)
- **Auth**: JWT + OAuth2/SSO

### Studio (TypeScript/React)
- **Framework**: React 19 + Vite
- **Package manager**: pnpm
- **Styling**: TailwindCSS 4
- **UI components**: `@invana/design-kit` (TailwindCSS 4 + shadcn) — use existing components, don't reimplement
- **Graph rendering**: `@invana/canvas` (PixiJS 8, WebGPU + WebGL)
- **State**: Zustand (client) + TanStack Query (server)
- **Linting**: Biome
- **Testing**: Vitest + Testing Library + Playwright
- **Query editor**: CodeMirror 6

### Infrastructure
- **CI**: GitHub Actions
- **Pre-commit**: Lefthook (ruff + biome)
- **Versioning**: Unified SemVer + CalVer release tags
- **Changesets**: For changelog and version bumps
- **Docker**: Multi-target Dockerfile (invana | engine | studio)
- **Docs**: MkDocs Material
- **Registry**: Docker Hub (invana/invana, invana/engine, invana/studio)

## Supported Graph Databases
- **Cypher**: Neo4j, Memgraph, ArcadeDB
- **Gremlin**: JanusGraph, Amazon Neptune, TinkerGraph, ArcadeDB
- **Vector**: Mixin for DBs with vector index support

## Key Features
1. **Graph Modelling** — Ontology, semantics, schema versioning, constraints
2. **Query Engine** — High-performance async, Cypher + Gremlin, connection pooling
3. **Visualization** — PixiJS 8 with WebGPU, handles 100K+ nodes at 60fps
4. **Simulation** — Game theory, hypothesis testing, parameter sweeps, rule engine

## Rules

1. Don't write code without complete implementation design decisions.
2. Always ask when in doubt.
3. make the development setup work across operating systems for seamless community developer contributions. 
4. Engine and Studio are built together, distributed flexibly (one image or separate).
5. Coverage target: 80% minimum for both engine and studio.
6. Every user-facing change requires a changeset.
7. Studio uses `@invana/design-kit` for all UI components — don't create custom components unless absolutely necessary.
8. Studio uses `@invana/canvas` for all graph rendering — no PixiJS code in studio. 
