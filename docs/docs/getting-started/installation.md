# Installation

## Requirements

- Python 3.14 or later
- A supported graph database (Neo4j, Memgraph, JanusGraph, Neptune, TinkerGraph, or ArcadeDB)

## Install with pip

```bash
pip install invana
```

## Verify Installation

```bash
invana version
```

```
Invana v0.1.0
```

## Start Invana

```bash
invana start
```

This starts the Invana server on `http://localhost:8000` with Studio (the web UI) included.

```
INFO:     Invana v0.1.0
INFO:     Engine:  http://localhost:8000/api/v1
INFO:     Studio:  http://localhost:8000
INFO:     API docs: http://localhost:8000/docs
```

### CLI Options

```bash
invana start --host 0.0.0.0 --port 9000    # Custom host and port
invana start --no-studio                     # API only, no web UI
invana start --reload                        # Auto-reload on code changes (dev)
```

## Install with Docker

```bash
docker run -p 8000:8000 invana/invana:latest
```

See [Docker deployment](../deployment/docker.md) for more options.

## What's Next?

- [Quickstart](quickstart.md) — Connect to a database and run your first query
- [Configuration](configuration.md) — Environment variables and settings
