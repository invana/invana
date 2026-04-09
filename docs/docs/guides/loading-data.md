# Loading Data

Invana ships with a built-in CSV loader that imports structured graph datasets into any supported graph database — no Cypher or Gremlin required.

## Dataset Format

Datasets follow a two-directory layout:

```
dataset/
├── nodes/            # one CSV per vertex label
│   ├── movie.csv
│   └── person.csv
└── relationships/    # one CSV per edge label
    ├── acted_in.csv
    └── directed.csv
```

### Node CSV columns

| Column | Required | Description |
|---|---|---|
| `Id` | Yes | Stable source identifier (e.g. `PERSON_1`) |
| `Label` | Yes | Vertex label (e.g. `Person`) |
| `Properties:<name>` | No | Property column; optional `_type` suffix for coercion |

**Supported type suffixes:** `_string`, `_int`, `_long`, `_double`, `_float`, `_bool`

```csv title="nodes/person.csv"
Id,Label,Properties:name,Properties:born
PERSON_1,Person,Keanu Reeves,1964
PERSON_2,Person,Laurence Fishburne,1961
```

```csv title="nodes/movie.csv"
Id,Label,Properties:title,Properties:released,Properties:runtime
MOVIE_1,Movie,The Matrix,1999,136
MOVIE_2,Movie,The Matrix Reloaded,2003,138
```

### Relationship CSV columns

| Column | Required | Description |
|---|---|---|
| `Id` | Yes | Stable source identifier |
| `Label` | Yes | Edge label (e.g. `ACTED_IN`) |
| `FromId` | Yes | Node `Id` of the source vertex |
| `ToId` | Yes | Node `Id` of the target vertex |
| `Properties:<name>` | No | Property column |

```csv title="relationships/acted_in.csv"
Id,Label,FromId,ToId,Properties:roles,Properties:year
REL_ACTED_1,ACTED_IN,PERSON_1,MOVIE_1,Neo,1999
REL_ACTED_2,ACTED_IN,PERSON_2,MOVIE_1,Morpheus,1999
```

## Loading via CLI

The `invana loader` command is the easiest way to load a dataset.

### Installation

```bash
pip install invana
```

Verify the command is available:

```bash
invana --help
```

### Available connectors

Both `--uri` and `--connector` are required. Pass the dotted import path to the connector class:

| Database | Package | `--connector` value |
|---|---|---|
| Neo4j | `invana` (core) | `invana.graph.connectors.OpenCypherConnector` |
| Memgraph | `invana` (core) | `invana.graph.connectors.OpenCypherConnector` |
| JanusGraph | `invana` (core) | `invana.graph.connectors.GremlinConnector` |
| Amazon Neptune | `invana` (core) | `invana.graph.connectors.GremlinConnector` |
| TinkerGraph | `invana` (core) | `invana.graph.connectors.GremlinConnector` |
| Neo4j (richer schema) | `invana-neo4j` | `invana_neo4j.connector.Neo4jConnector` |

### Example: loading the air-routes dataset

```
$ invana loader ../datasets/air-routes \
    --uri bolt://localhost:7687 \
    --connector invana.graph.connectors.OpenCypherConnector \
    --username neo4j \
    --password testpassword
Loading ../datasets/air-routes → bolt://localhost:7687

Dataset: ../datasets/air-routes
  ✓ airport              3504 vertices
  ✓ continent               7 vertices
  ✓ country               237 vertices
  ✓ version                 1 vertices
  ✓ contains             7008 edges
  ✓ route               50637 edges

Total: 3749 vertices, 57645 edges in 7.14s
```

### Example: loading the movies dataset

=== "Neo4j / Memgraph"

    ```bash
    invana loader datasets/movies \
      --uri bolt://localhost:7687 \
      --connector invana.graph.connectors.OpenCypherConnector \
      --username neo4j \
      --password password
    ```

=== "JanusGraph / TinkerGraph"

    ```bash
    invana loader datasets/movies \
      --uri ws://localhost:8182/gremlin \
      --connector invana.graph.connectors.GremlinConnector
    ```

=== "invana-neo4j (richer schema)"

    ```bash
    pip install invana-neo4j

    invana loader datasets/movies \
      --uri bolt://localhost:7687 \
      --connector invana_neo4j.connector.Neo4jConnector \
      --username neo4j \
      --password password
    ```

### All CLI options

```
invana loader <path> [OPTIONS]
```

**Connection options:**

| Flag | Env var | Description |
|---|---|---|
| `--uri` | `INVANA_GRAPH_URI` | Graph DB connection URI (required) |
| `--connector` | `INVANA_GRAPH_CONNECTOR` | Full dotted path to connector class (required) |
| `--username` | `INVANA_GRAPH_USERNAME` | DB username |
| `--password` | `INVANA_GRAPH_PASSWORD` | DB password |

**Loader options:**

| Flag | Default | Description |
|---|---|---|
| `--batch-size` | `500` | Records per bulk call |
| `--skip-on-error` | `False` | Log and skip failures instead of aborting |
| `--dry-run` | `False` | Parse and validate only — no DB writes |
| `--no-source-ids` | `False` | Omit the `_csv_source_id` tracking property |

### Using environment variables

Instead of repeating flags, set them in your shell or a `.env` file:

```bash
# .env
INVANA_GRAPH_URI=bolt://localhost:7687
INVANA_GRAPH_CONNECTOR=invana.graph.connectors.OpenCypherConnector
INVANA_GRAPH_USERNAME=neo4j
INVANA_GRAPH_PASSWORD=password
```

Then just run:

```bash
invana loader datasets/movies
```

### Dry run

To validate your dataset files without writing to the database:

```bash
invana loader datasets/movies \
  --uri bolt://localhost:7687 \
  --connector invana.graph.connectors.OpenCypherConnector \
  --dry-run
```

Output is prefixed with `DRY RUN —`.

---

## Loading via Python

For programmatic use — in scripts, pipelines, or tests — use `CSVLoader` directly.

### Basic usage

```python
import asyncio
from invana.graph.connectors import OpenCypherConnector
from invana.loaders import CSVLoader, LoaderConfig

async def main():
    connector = OpenCypherConnector(
        "bolt://localhost:7687",
        username="neo4j",
        password="password",
    )

    config = LoaderConfig(
        batch_size=500,
        skip_on_error=False,
        dry_run=False,
    )

    loader = CSVLoader(connector=connector, config=config)

    async with connector:
        stats = await loader.load_directory("datasets/movies")

    print(f"Loaded {stats.vertices_created} vertices, {stats.edges_created} edges")
    print(f"Duration: {stats.duration_seconds:.2f}s")

asyncio.run(main())
```

For Gremlin-compatible databases, swap the connector:

```python
from invana.graph.connectors import GremlinConnector

connector = GremlinConnector("ws://localhost:8182/gremlin")
```

### Loading individual files

```python
async with connector:
    # Load a single node file
    stats = await loader.load_nodes_file("datasets/movies/nodes/movie.csv")

    # Load a single relationship file
    stats = await loader.load_edges_file("datasets/movies/relationships/acted_in.csv")
```

### Configuration reference

```python
from invana.loaders import LoaderConfig

config = LoaderConfig(
    batch_size=500,          # records sent per connector call
    keep_source_ids=True,    # retain _csv_source_id property on each vertex
    skip_on_error=False,     # True = log and continue on failures
    dry_run=False,           # True = parse only, no DB writes
)
```

### Reading the stats object

```python
stats = await loader.load_directory("datasets/movies")

print(stats.vertices_created)       # total vertices created
print(stats.edges_created)          # total edges created
print(stats.vertices_failed)        # vertices that failed (skip_on_error=True)
print(stats.edges_failed)           # edges that failed
print(stats.vertices_by_label)      # dict: label → count
print(stats.edges_by_label)         # dict: label → count
print(stats.errors)                 # list of error messages
print(stats.duration_seconds)       # float
print(stats.dry_run)                # bool
```

### Connector auto-selection

`CSVLoader` is connector-agnostic — pass any `BaseConnector` instance and it works.
Import connectors from the short path `invana.graph.connectors`:

```python
from invana.graph.connectors import OpenCypherConnector, GremlinConnector
```
