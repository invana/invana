# Chickpea — the breeding demo

A chickpea breeder's Graph: released varieties, the institutes that bred them, the traits they
are known for, and the crosses a project is weighing. It is the data the Projects and Datasets
prototype boards are drawn on (*Drought-tolerant chickpea*, *Variety attributes*), so the design
review has something real behind `/u/admin/chickpea`.

The values follow the prototype's tables. They are a demo, not a release list — check an official
source before relying on any of them.

## What you end up with

| | |
|---|---|
| Graph | `admin/chickpea`, on **its own** graph database — never airways' |
| Model | `Chickpea` — `Variety` · `Institute` · `Trait` · `Pedigree`, published |
| Dataset | `variety-attributes` — 26 nodes, 26 edges |
| Projects | *Drought-tolerant chickpea* · *Raise the chickpea support price by 10%* · *Wilt resistance survey 2025* |
| Todos | five, assigned to the Graph's owner — three in *Drought-tolerant chickpea*, two with no project |

| Type | Records | Key | Holds |
|---|---|---|---|
| `Variety` | JG 11 · JAKI 9218 · KAK 2 · Pusa 372 · Vijay · ICCV 10 · Pusa 1003 · ICC 4958 | `name` | kind, year, seed type, maturity days (80–180), 100-seed weight g (10–70), wilt reaction, root depth |
| `Institute` | JNKVV · PDKV · MPKV · IARI · ICAR-IIPR · ICRISAT | `name` | short name, city, sector |
| `Trait` | seven, three with a Crop Ontology term (CO_338) | `name` | term id, unit |
| `Pedigree` | the five crosses the project weighs, e.g. ICC 4958 × KAK 2 | `cross_id` | status, season |

| Edge | From → to |
|---|---|
| `DEVELOPED_BY` | Variety → Institute |
| `CONSERVED_BY` | Variety (accession) → Institute (genebank) |
| `NOTED_FOR` | Variety → Trait |
| `FEMALE_PARENT` · `MALE_PARENT` | Pedigree → Variety |

## Load it

```bash
make setup                                             # once — resolves engine/ with uv

# its own graph database — a Graph that shares one sees the other's records
docker run -d --name invana-chickpea-neo4j -p 37687:7687 \
    -e NEO4J_AUTH=neo4j/chickpea-demo neo4j:5-community

uv run --project engine --extra all invana records check demos/chickpea      # no database needed

uv run --project engine --extra all python demos/chickpea/load.py \
    --graph admin/chickpea --uri bolt://host.docker.internal:37687 \
    --db-user neo4j --db-password chickpea-demo
```

| Step | How |
|---|---|
| Graph and connection | `load.py`, through the engine's own managers — Studio's *New Graph* |
| Model | `invana models import` |
| Publish | `load.py` — Studio's *Publish* |
| Records | `invana records import --name variety-attributes --model Chickpea` |
| Projects and todos | `load.py`, from [projects.json](projects.json) |

`host.docker.internal` reaches the database from the engine container and, with Docker Desktop,
from the host as well — so one URI serves both. Re-running is safe: what exists is left alone and
records merge on their keys.

## What it refuses

| Refusal | Why |
|---|---|
| `--uri` missing | there is no default database |
| `… is already the database of another Graph` | another Graph — airways — is connected to that server and database |
| `Graph admin/chickpea is connected to …, not …` | the Graph exists on a different database |
| `The bundle does not check clean` | `invana records check demos/chickpea` fails |

Every refusal happens before the first write.

## Starting over

Delete the Graph in Studio (it takes its models, projects and todos with it), then
`docker rm -f invana-chickpea-neo4j`.
