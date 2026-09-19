# Air Routes

Global airports and the flights between them — the network the other two datasets write
about and talk about. The records ship as JSON, `nodes/<type>.json` and `edges/<edge>.json`,
the shape `invana records import` reads, with `model.json` carrying the identity keys.

## Source

Converted from https://github.com/krlawrence/graph/tree/main/sample-data —
`air-routes-latest-nodes.csv` and `air-routes-latest-edges.csv`, split into one file per
node and edge label.

## Model — `AirRoutes`

`graph-model.json` is the authored domain model, in `invana.model/1` — the same format
`invana models export` writes. Stitching needs a **published** model on both sides, and the
global model is derived from **authored** models only, so an introspected mirror is not
enough.

### Node types

| Type | Identity | Properties |
|---|---|---|
| `airport` | `code` | `type` · `icao` · `desc` · `region` · `runways` · `longest` · `elev` · `country` · `city` · `lat` · `lon` |
| `country` | `code` | `type` · `desc` |
| `continent` | `code` | `type` · `desc` |
| `version` | `code` | `type` · `desc` · `author` · `date` — the edition of the upstream data this was built from |

### Edge types

| Edge | From → To | Properties |
|---|---|---|
| `route` | airport → airport | `dist` (miles) |
| `contains` | continent · country → airport | — |

### Counts

| | airport | country | continent | version | route | contains |
|---|---|---|---|---|---|---|
| records | 3,504 | 237 | 7 | 1 | 50,637 | 7,008 |

3,749 nodes, 57,645 edges.

## Loading

```bash
uv run --directory engine invana models import --graph you/aviation \
    --file ../demos/airways/air-routes/graph-model.json
# publish it in Studio › Models, then:
uv run --directory engine invana records import --graph you/aviation \
    --name air-routes --model AirRoutes --path ../demos/airways/air-routes
```

It takes minutes — 61,394 records, one `MERGE` each. Because it is `MERGE` and `model.json`
names the identity key, a re-import merges rather than duplicates.

## Stitching

This is the network [news-articles](../news-articles) writes about and
[twitter](../twitter) talks about. `airport.code` is the key almost everything joins on;
`country.code` is the one anchor. The matrix — which key joins to which, and how many rows
resolve — is in [the demo walkthrough](../README.md#7--stitch-them).

## Sample queries

Busiest airports by routes out:

```cypher
MATCH (a:airport)-[r:route]->(:airport)
RETURN a.code, a.city, count(r) AS routes_out ORDER BY routes_out DESC LIMIT 10
```

One hop between two airports:

```cypher
MATCH p = (:airport {code: 'LHR'})-[:route*1..2]->(:airport {code: 'BLR'})
RETURN p LIMIT 5
```
