# Arabidopsis — the genetics demo

A plant-genetics lab's Graph, on the public model organism *Arabidopsis thaliana*: natural
accessions, the stock centres that hold them, the labs that sequenced them, the flowering-time
genes they carry, the traits they are known for, and the crosses a project is weighing. It is the
data the Projects and Datasets prototype boards are drawn on (*Early flowering under drought*,
*Accession phenotypes*), so the design review has something real behind `/u/admin/arabidopsis`.

The values follow public sources — the 1001 Genomes project and AraPheno — loosely. They are a
demo, not a reference set: check those sources before relying on any of them.

## What you end up with

| | |
|---|---|
| Graph | `admin/arabidopsis`, on **its own** graph database — never airways' |
| Model | `Arabidopsis` — `Accession` · `StockCentre` · `Institute` · `Trait` · `Gene` · `Cross`, published |
| Dataset | `accession-phenotypes` — 27 nodes, 67 edges |
| Projects | *Early flowering under drought* · *Allow gene-edited lines in field trials* · *Seed-stock audit 2025* |
| Todos | five, assigned to the Graph's owner — three in *Early flowering under drought*, two with no project |

| Type | Records | Key | Holds |
|---|---|---|---|
| `Accession` | Col-0 · Ler-1 · Cvi-0 · C24 · Sha · Bur-0 · Kas-1 · Van-0 | `name` | stock id, country, habit, days to flowering (15–150), rosette leaf number, drought survival %, δ13C |
| `StockCentre` | ABRC · NASC | `name` | city, country |
| `Institute` | GMI Vienna · MPI Tübingen · Salk | `name` | city, country |
| `Trait` | five, four with a Plant Trait Ontology (TO) term | `name` | term id, unit |
| `Gene` | FLC · FRI · FT · DOG1 | `name` | TAIR locus, function |
| `Cross` | the five crosses the project weighs, e.g. Col-0 × Cvi-0 | `cross_id` | status, generation |

| Edge | From → to |
|---|---|
| `HELD_BY` | Accession → StockCentre |
| `SEQUENCED_BY` | Accession → Institute |
| `NOTED_FOR` | Accession → Trait |
| `CARRIES` | Accession → Gene, with `allele`: functional · loss-of-function |
| `AFFECTS` | Gene → Trait |
| `FEMALE_PARENT` · `MALE_PARENT` | Cross → Accession |

The project's hypotheses are drawn on the boards, not stored yet — findings and branches need the
project records: H1 *FRI loss-of-function shortens flowering under drought* · H1.1 *…via lower
FLC* · H2 *DOG1 alleles trade flowering for survival*.

## Load it

```bash
make setup                                             # once — resolves engine/ with uv

# its own graph database — a Graph that shares one sees the other's records
docker run -d --name invana-arabidopsis-neo4j -p 37688:7687 \
    -e NEO4J_AUTH=neo4j/arabidopsis-demo neo4j:5-community

uv run --project engine --extra all invana records check demos/arabidopsis   # no database needed

uv run --project engine --extra all python demos/arabidopsis/load.py \
    --graph admin/arabidopsis --uri bolt://host.docker.internal:37688 \
    --db-user neo4j --db-password arabidopsis-demo
```

| Step | How |
|---|---|
| Graph and connection | `load.py`, through the engine's own managers — Studio's *New Graph* |
| Model | `invana models import` |
| Publish | `load.py` — Studio's *Publish* |
| Records | `invana records import --name accession-phenotypes --model Arabidopsis` |
| Projects and todos | `load.py`, from [projects.json](projects.json) |

`host.docker.internal` reaches the database from the engine container and, with Docker Desktop,
from the host as well — so one URI serves both. On a Linux host, run `load.py` inside the
`invana-engine` container instead. Re-running is safe: what exists is left alone and records merge
on their keys.

## What it refuses

| Refusal | Why |
|---|---|
| `--uri` missing | there is no default database |
| `… is already the database of another Graph` | another Graph — airways — is connected to that server and database |
| `Graph admin/arabidopsis is connected to …, not …` | the Graph exists on a different database |
| `The bundle does not check clean` | `invana records check demos/arabidopsis` fails |

Every refusal happens before the first write.

## Starting over

Delete the Graph in Studio (it takes its models, projects and todos with it), then
`docker rm -f invana-arabidopsis-neo4j`.
