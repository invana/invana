# Airways — the stitching demo

Three datasets that are one story told from three angles. **air-routes** is the network
airlines fly, **news-articles** is what gets written about it, **twitter** is what gets said
about that. Load all three into one Graph and you have something real to stitch: a question
about a tweet can reach an airport, through an article, across three models nobody authored
together.

This folder is the whole demo — the data, the models, and the walkthrough below.

| | |
|---|---|
| Feature | [Stitch models](../../docs/for-developers/modules/connect-and-model/features/stitch-models.md) |
| Runs against | Neo4j, or any Cypher connector |
| Takes | About five minutes, most of it waiting for nothing |

## What you end up with

```mermaid
flowchart LR
    subgraph T["Twitter"]
        TW[Tweet]
        AC[Account]
        HT[Hashtag]
    end
    subgraph N["NewsArticles"]
        AR[Article]
        AL[Airline]
        CI[City]
        CO[Country]
        PU[Publisher]
        TO[Topic]
    end
    subgraph A["AirRoutes"]
        AP[airport]
        CN[country]
    end
    TW -->|LINKS_TO| AR
    TW -->|ABOUT| AR
    TW -->|POSTED_NEAR| AP
    AC -->|SPEAKS_FOR| PU
    AC -->|SPEAKS_FOR| AL
    HT -.->|anchor| TO
    CI -->|SERVED_BY| AP
    AL -->|HUBS_AT| AP
    CO -.->|anchor| CN
```

Dotted edges are **anchors** — the same entity, said twice. Solid edges are **relationship
links**. Eleven stitches in all, and every one of them resolves against rows that exist,
because the keys were read out of the neighbouring dataset when the data was built rather
than typed twice. Committing them writes 435 edges into the database, and the graph says of
every one which rule made it.

---

## The walkthrough

Everything runs through the `invana` CLI except creating the Graph and publishing a model,
which are Studio actions. Run it with uv, **from the repo root**:

```bash
make setup                      # once — resolves engine/ with uv
inv() { uv run --project engine --extra all invana "$@"; }
DATA=demos/airways
```

A function, not `INV="…"` — zsh does not word-split an unquoted `$INV`, so a variable
holding a multi-word command fails with `command not found: uv run --project …`. A function
behaves the same in bash and zsh.

`--project engine` points uv at the engine package while leaving your shell in the repo
root, so `$DATA` and every other relative path resolves as typed. `--directory engine`
would *move* into `engine/` and break them.

Keep `--extra all` on every call. Without it, `uv run` syncs `engine/.venv` down to the
default extras and drops the telemetry packages the engine imports when
`INVANA_TELEMETRY_ENABLED` is on — the next command then fails with an `ImportError` until
you re-run `uv sync --extra all`.

The CLI and the engine must read the same application database. Both default to
`postgresql+asyncpg://invana_user:change_this_password@localhost:5432/invana_db`, and the
Postgres container publishes 5432 on your host — so a host CLI and a Dockerised engine
already agree, with no `.env` needed. If you set `INVANA_DATABASE_URL`, set it for both.

### The whole thing, in one place

Ten commands and two visits to Studio. Everything below is the same sequence with the
reasoning attached — run that instead the first time, this when you come back.

```bash
# 0 · the stack: Postgres for the app, a Cypher database for the graph
docker compose up -d postgres engine studio          # Neo4j on :7687 is yours to run
make setup                                           # once — resolves engine/ with uv

inv() { uv run --project engine --extra all invana "$@"; }
DATA=demos/airways
GRAPH=demo/airways                                   # <username>/<slug>

# 1 · a user
inv users create --non-interactive \
    --username demo --password 'ChangeMe!2026' --first-name Demo

#     ↓ STUDIO · sign in as demo → New Graph "airways" → attach the connection
#       bolt://localhost:7687 · invana.graph.connectors.OpenCypherConnector

# 3 · the bundle, before anything is loaded — no Graph, no database
inv records check $DATA

# 4 · the three models, as drafts
for m in air-routes news-articles twitter; do
  inv models import --graph $GRAPH --file $DATA/$m/graph-model.json
done

#     ↓ STUDIO · Models → open each of the three → Publish
#       A stitch binds published versions, and an import refuses a draft

# 6 · the records (air-routes takes a few minutes — 61,394 of them)
inv records import --graph $GRAPH --name air-routes    --model AirRoutes    --path $DATA/air-routes
inv records import --graph $GRAPH --name news-articles --model NewsArticles --path $DATA/news-articles
inv records import --graph $GRAPH --name twitter       --model Twitter      --path $DATA/twitter

# 7 · the stitches — declared from the same file step 3 checked, then committed
inv stitches apply   --graph $GRAPH --file $DATA/stitches.json
inv stitches resolve --graph $GRAPH                    # count them against the live data
inv stitches commit  --graph $GRAPH                    # ← this is what writes the edges

# 8 · did it cross? — counts against the live data, and what each stitch wrote
inv stitches resolve --graph $GRAPH
```

Expected at the end: **11 stitches active**, and 435 new edges in a database that had none
crossing a model. [What stitching bought](#what-stitching-bought) is the same graph asked
the questions it could not answer before.

| Where it can stop | What to do |
|---|---|
| `Graph 'demo/airways' not found` | The Studio Graph's slug is not `airways`, or `$GRAPH` names the wrong user. `inv stitches list --graph …` is the cheapest way to test a ref |
| `... has no published version` | The second Studio visit was skipped |
| `'AirRoutes' is already in this Graph` | Step 4 has already run. It creates models, so it refuses rather than re-importing — skip to step 5, or use `models upgrade` if the file has changed |
| `apply` says `skip` | That rule could not resolve — the line says which model or dataset is missing |
| `commit` says `Nothing staged to commit` | They are already committed. `inv stitches resolve --graph $GRAPH` shows what each one wrote |

### 1 · A user

```bash
inv users create --non-interactive \
    --username demo --password 'ChangeMe!2026' --first-name Demo
```

`invana init` instead creates the root superuser and is idempotent; `users create` is not,
and makes an ordinary account. Either can own the Graph.

### 2 · A Graph, and the database behind it

A Graph is created in **Studio** — sign in as `demo`, then **New Graph**. Name it anything;
the slug is what the CLI wants. Attach a connection in the same flow:

| Field | Value |
|---|---|
| URI | `bolt://localhost:7687` — `bolt://neo4j:7687` if the **engine** runs in Docker |
| Connector | `invana.graph.connectors.OpenCypherConnector` |
| Username / password | your Neo4j credentials |

From here on:

```bash
GRAPH=demo/airways
```

> A Graph needs a connection before anything below will run. Invana never writes to a
> connection marked read-only.

### 3 · Check the bundle before you load it

`stitches.json` at this folder's root declares the eleven rules below. Check the bundle
before you load it — each dataset against its own model, then the rules between them. No
Graph, no connection, no database:

```bash
inv records check $DATA
```

```
airways — 3 datasets, 11 rules

  datasets
  ok   air-routes                          3749 nodes, 57645 edges
  ok   news-articles                       253 nodes, 573 edges
  ok   twitter                             244 nodes, 525 edges
  anchors
  ok   A1   Country.iso_code ≡ country.code                    44/44 keys     44 rows
  ok   A2   Hashtag.tag ≡ Topic.tag  (ci)                      10/16 keys     16 rows
       overlap only: airports, avgeek, aviation, flightdelay, paxex, upgraded
  relationships
  ok   R1   City.code -[SERVED_BY]-> airport.code              63/63 keys     63 rows
  …

3 datasets, 3 clean · 11 rules, 11 resolve.
```

Each dataset is checked for unique ids, an identity key that is present and unique, every
property declared on its type, enum values in range, declared types honoured, and edges
landing on the types they name. An endpoint outside its dataset is reported as *deferred*,
not failed — only the import can say whether the graph already holds it.

It exits non-zero if anything does not, so it belongs in CI as much as in a terminal. The
same command works on any bundle that ships a `stitches.json` — nothing in it knows about
airways.

### 4 · The three models

Each artefact is one published version in `invana.model/1` — exactly what
`invana models export` writes. Import lands a **draft**.

```bash
for m in air-routes news-articles twitter; do
  inv models import --graph $GRAPH --file $DATA/$m/graph-model.json
done
```

```
AirRoutes    imported as a draft — 4 node types, 2 edge types.
NewsArticles imported as a draft — 7 node types, 9 edge types.
Twitter      imported as a draft — 3 node types, 6 edge types.
```

**This is the one step that is not safe to re-run.** `import` *creates* a model, so a second
run refuses with `'AirRoutes' is already in this Graph` and writes nothing — which reads as a
failure and is in fact the step already being done. `inv models list --graph $GRAPH` says which
of the three are in, and their active version says whether step 5 is done too. If the file has
changed since, the verb is `upgrade`:

```bash
inv models upgrade --graph $GRAPH --name AirRoutes --file $DATA/air-routes/graph-model.json
```

### 5 · Publish all three

**In Studio › Models**, open each model and press **Publish**.

This is not a formality and there is no CLI for it. A stitch binds *published versions*,
because a link has to point at something immutable — a draft has nothing to point at. A
dataset import also refuses a model with no published version, so nothing in step 6 works
until this is done.

### 6 · The records

All three datasets load through the **journal** path: validated against the published
model, written with provenance, and every rejection reported.

```bash
inv records import --graph $GRAPH \
    --name air-routes --model AirRoutes --path $DATA/air-routes

inv records import --graph $GRAPH \
    --name news-articles --model NewsArticles --path $DATA/news-articles

inv records import --graph $GRAPH \
    --name twitter --model Twitter --path $DATA/twitter
```

```
Import succeeded: 61394/61394 records written, 0 reported.
Import succeeded: 826/826 records written, 0 reported.
Import succeeded: 769/769 records written, 0 reported.
```

`--model` is required and nothing is inferred from the data: the model is authored first
and named here.

air-routes takes minutes rather than seconds — the journal writes one `MERGE` per record
and this dataset is mostly its 50,637 routes. That is the price of records that are
validated, provenanced and stitchable. It says where it has got to while it works:

```
  register  Importing 'air-routes': 3749 node + 57645 edge record(s)
  validate  Validated 61394 record(s) — 0 reported
  write     24500/61394  39%
```

That counter is on **stderr** and rewrites one line, so `… > run.log` still captures only
the summary, and a redirected run degrades to one line per stage. Start it and read the
next section while it runs.

### 7 · Stitch them

The bundle already states its eleven rules, and step 3 resolved every one of them against
the files. Declare the same file against the Graph — nothing is retyped:

```bash
inv stitches apply --graph $GRAPH --file $DATA/stitches.json
```

```
airways — 11 rules → demo/airways

  anchors
  ok   A1   Country.iso_code ≡ country.code                  NewsArticles → AirRoutes
  ok   A2   Hashtag.tag ≡ Topic.tag                          Twitter → NewsArticles
  relationships
  ok   R1   City.code -[SERVED_BY]-> airport.code            NewsArticles → AirRoutes
  …

11 rules — 11 declared, 0 already declared, 0 skipped.
Staged — the global model is unchanged until you commit.
```

Every rule lands **staged**: the rows exist, Studio lists and draws them — each one saying
*from the airways bundle (R1)* — and no answer has changed yet. Read the set, count it
against the data that is actually loaded, then commit:

```bash
inv stitches list    --graph $GRAPH
inv stitches resolve --graph $GRAPH
inv stitches commit  --graph $GRAPH
```

`resolve` asks the live database the question the declare card asks, once per stitch — the
same counts step 3 got from the files, now from the graph they will run against:

```
admin/airways — 11 stitches

  ok   Country.iso_code ≡ country.code                      44/44 keys  not committed
  ok   City.code -[SERVED_BY]-> airport.code                63/63 keys  not committed
  …
  --   Tweet -[ABOUT]-> Article  (from a dataset)  its rows arrive with a dataset  staged

11 stitches, 11 resolve.
```

**`commit` is what writes the edges.** Until then a stitch is a rule nobody has run:

```
      44  Country.iso_code = country.code                 -[SAME_AS]->
      10  Hashtag.tag = Topic.tag                         -[SAME_AS]->
      63  City.code = airport.code                        -[SERVED_BY]->
      65  Tweet.linked_url = Article.url                  -[LINKS_TO]->
      22  rows for ABOUT                                  -[ABOUT]->
      …
Committed 11 stitch(es) — they are in the union now, and wrote 435 edge(s).
```

An anchor writes `SAME_AS` — both nodes stay, nothing merges. A keyed relationship writes
its own edge type, derived from the keys. A relationship whose endpoints are rows is
**loaded** instead: the commit reads `twitter/stitches/ABOUT.json` from the dataset that
ships it. Every edge a stitch writes carries `_inv_origin: "stitch"`, the stitch's
id and the rule that made it, so the graph says which of it nobody loaded:

```cypher
MATCH ()-[r]->() WHERE r._inv_origin = 'stitch'
RETURN type(r) AS edge, r._inv_rule AS rule, count(*) AS n ORDER BY n DESC
```

A stitch is a **standing rule**, not a one-off: every later `records import` runs the
Graph's active stitches over the records it just wrote, so a tweet that arrives next month
reaches the airport it names without anybody re-running anything. Removing a stitch takes
its edges with it.

| Flag | What it does |
|---|---|
| `--commit` | Declares and commits in one run — and writes the edges |
| `--dry-run` | Says what it would declare, against which models, and writes nothing |
| `--user <username>` | Attributes the declarations to a person rather than to the system |

Re-running `apply` is safe: a rule already declared is reported as such, never declared
twice, and the exit code is non-zero only when a rule could not be declared at all — a model
nobody published, or a dataset this Graph has not imported.

The same eleven rules can be declared by hand: **in Studio**, switch the left nav to
**Models** with nothing selected — that draws *All models*, every published model as a frame
on one canvas. Declare a stitch from a selected type's **Stitches** drawer, or by dragging a
node type onto another frame; the declare card previews the count before anything is staged.
Both paths write the same rows, and the card is where you go when you are *finding* a rule
rather than applying one you already have.

| # | Kind | Rule | Resolves |
|---|---|---|---|
| A1 | anchor | `NewsArticles.Country.iso_code ≡ AirRoutes.country.code` | 44 / 44 |
| A2 | anchor · `case_insensitive` | `Twitter.Hashtag.tag ≡ NewsArticles.Topic.tag` | 10 / 16 |
| R1 | `SERVED_BY` | `NewsArticles.City.code → AirRoutes.airport.code` | 63 / 63 |
| R2 | `HUBS_AT` | `NewsArticles.Airline.hub_code → AirRoutes.airport.code` | 24 / 24 |
| R3 | `DEPARTS_FROM` | `NewsArticles.Route.origin_code → AirRoutes.airport.code` | 30 / 30 |
| R4 | `ARRIVES_AT` | `NewsArticles.Route.destination_code → AirRoutes.airport.code` | 25 / 25 |
| R5 | `SPEAKS_FOR` | `Twitter.Account.domain → NewsArticles.Publisher.domain` | 7 / 7 |
| R6 | `SPEAKS_FOR` | `Twitter.Account.airline_iata → NewsArticles.Airline.iata` | 26 / 26 |
| R7 | `POSTED_NEAR` | `Twitter.Tweet.airport_code → AirRoutes.airport.code` | 28 / 28 |
| R8 | `LINKS_TO` | `Twitter.Tweet.linked_url → NewsArticles.Article.url` | 65 / 65 |
| R9 | `ABOUT` | endpoints from `twitter/stitches/ABOUT.json` | 22 rows |

R9 is the one stitch nothing joins: its endpoints are their own fact, one row per edge, in
`twitter/stitches/ABOUT.json`. So it is **loaded** rather than solved — the commit reads the
rows from the dataset that ships them, and every later import of that dataset writes them
again. The other ten are derived by the commit from keys the records already carry.

Counts are **distinct key values**, which is what the preview reports. R2 reads 24 of 26
carriers because two of them fly out of DEL and two out of HND.

Committed, the union reads:

```
models=3  links=11  anchors=2  relationships=9  staged=0
Topic     anchored  [NewsArticles, Twitter]
country   anchored  [AirRoutes, NewsArticles]
```

### 8 · See that it crossed

```bash
inv stitches resolve --graph $GRAPH
```

```
demo/airways — 11 stitches

  ok   Country.iso_code ≡ country.code                      44/44 keys  44 edges
  ok   Hashtag.tag ≡ Topic.tag                              10/16 keys  10 edges
  ok   City.code -[SERVED_BY]-> airport.code                63/63 keys  63 edges
  ok   Tweet.airport_code -[POSTED_NEAR]-> airport.code     28/28 keys  96 edges
  …
  --   Tweet -[ABOUT]-> Article  (from a dataset)  its rows arrive with a dataset  active
```

A count and an edge count that differ is not a mismatch: the count is of **distinct key
values**, and 28 airports are posted near by 96 tweets.

`resolve` reads and writes nothing: it asks the live database what each rule matches, and
says how many edges that stitch has actually written. Then, in the database itself:

```cypher
MATCH ()-[r]->() WHERE r._inv_origin = 'stitch'
RETURN type(r) AS edge, r._inv_rule AS rule, count(*) AS n ORDER BY n DESC
```

```
POSTED_NEAR 96 · LINKS_TO 65 · SERVED_BY 63 · SAME_AS 54 · DEPARTS_FROM 38
ARRIVES_AT 38 · SPEAKS_FOR 33 · HUBS_AT 26 · ABOUT 22          =  435
```

**In Studio**, the same state reads three ways: the **Stitches** drawer lists all eleven —
each saying *from the airways bundle (R1)*, because the CLI declared them — *All models*
draws them as the only edges that cross a frame, and the **global model** page counts the
union they imply.

## Starting over

The demo is re-runnable as it stands: every write is a `MERGE`, so running the whole
sequence again lands exactly where it left off. To go back to nothing:

| To drop | How |
|---|---|
| Only what the stitches wrote | `MATCH ()-[r]->() WHERE r._inv_origin = 'stitch' DELETE r`. The rules stay **active**, so the next `records import` writes back the ones touching the records it loads. To put them all back, remove the eleven in Studio — removing a stitch takes its edges with it — and re-run step 7 |
| The records, keeping the models | `MATCH (n) DETACH DELETE n` in the graph database, then re-run step 6 |
| The whole Graph | Delete it in Studio. Models, datasets, stitches and the connection go with it — the records in the graph database do not |

## Why only two anchors

An anchor is **type-level**: it says every node of this type *is* a node of that one. That
holds for a country (a country is a country in both models) and for a hashtag naming the
topic a story was filed under. It does not hold for the rest.

A city is not an airport. An airline's social account is not the airline — it is an account
posting on its behalf, which is what `SPEAKS_FOR` says. Anchor those and the derived union
tells the lie back to you: `Account` disappears, folded into `Airline`, and `Publisher`
loses its Twitter side. The union is the one place a type-level over-claim surfaces, because
it is the one place an anchor is read as a claim about every node rather than about the rows
that happen to match.

A2 is deliberately partial. `#AvGeek`, `#PaxEx` and four others are hashtags nobody filed a
story under, so the preview shows an overlap rather than a clean union — a fixture where
everything matches teaches nothing about what a real preview looks like.

## What stitching bought

Three datasets loaded into one database are three islands. The nodes are all there and no
edge crosses between them, so every question that spans two of them is a question the graph
cannot answer. Committing the stitches is what changes that:

| | Before the commit | After |
|---|---|---|
| Edges in the graph | 58,743, all inside one model | **59,178** |
| Crossing a model boundary | 0 | **435** |
| `Article → City → airport` | no path | 63 `SERVED_BY` |
| `Tweet → Article` | no path | 65 `LINKS_TO` · 22 `ABOUT` |
| `Country ≡ country` | two node sets nobody related | 54 `SAME_AS` |

```cypher
MATCH ()-[r]->() WHERE r._inv_origin = 'stitch'
RETURN type(r) AS edge, count(*) AS n ORDER BY n DESC
```

```
POSTED_NEAR 96 · LINKS_TO 65 · SERVED_BY 63 · SAME_AS 54 · DEPARTS_FROM 38
ARRIVES_AT 38 · SPEAKS_FOR 33 · HUBS_AT 26 · ABOUT 22
```

Every one of them carries `_inv_stitch_id` and the rule that made it, so *why is this edge
here* has an answer, and a stitch you withdraw takes its own edges with it.

### The questions that were impossible

**Which cities in the news sit on the biggest route networks?** Reporting on the left,
50,637 flight routes on the right, joined by `City.code ≡ airport.code`:

```cypher
MATCH (a:Article)-[:MENTIONS_CITY]->(c:City)-[:SERVED_BY]->(ap:airport)-[r:route]->(:airport)
RETURN c.name AS city, count(DISTINCT a) AS stories, count(r) AS routes_out
ORDER BY routes_out DESC LIMIT 5
```

```
Dubai       5 stories   1240 routes out
New Delhi  10            1180
Frankfurt   3             930
Istanbul    3             927
Paris       3             879
```

**A post, to its article, to the airline, to that airline's hub** — three datasets, three
stitches, one traversal:

```cypher
MATCH (t:Tweet)-[:LINKS_TO]->(a:Article)-[:MENTIONS_AIRLINE]->(al:Airline)-[:HUBS_AT]->(hub:airport)
RETURN al.name AS airline, hub.city AS hub, count(DISTINCT t) AS posts
ORDER BY posts DESC LIMIT 5
```

```
IndiGo              New Delhi  5 posts
Emirates            Dubai      4
Air India           New Delhi  4
Qatar Airways       Doha       3
Singapore Airlines  Singapore  3
```

**Where are people posting from?** `Tweet -[POSTED_NEAR]-> airport` — the social dataset
never knew what an airport was:

```
Toronto 4 · Chicago 4 · New York 4 · San Francisco 4 · London 4
```

### "But I could just join on the property"

You could. That is exactly what the stitch declares, and it is the honest comparison — the
same question, written by hand against three unstitched models:

```cypher
MATCH (t:Tweet), (a:Article) WHERE t.linked_url = a.url
MATCH (a)-[:MENTIONS_AIRLINE]->(al:Airline)
MATCH (hub:airport) WHERE hub.code = al.hub_code
RETURN al.name AS airline, hub.city AS hub, count(DISTINCT t) AS posts
ORDER BY posts DESC LIMIT 5
```

| | By hand | Stitched |
|---|---|---|
| Median, 5 runs | 3.6 ms | **1.1 ms** |
| Who has to know `linked_url = url` | whoever writes the query, every time | declared once |
| Where the rule is recorded | nowhere | `model_links`, with its resolve count |
| What an agent sees in the schema | three unrelated models | one union, `…/global-model` |
| What happens to next month's tweets | re-run the join, or forget to | stitched on import |

On 244 tweets the time difference is a curiosity. The point is the other four rows: the
property join is knowledge that lives in whoever wrote the query, and it is re-derived,
unrecorded and unauditable every time somebody asks. The stitch is that same knowledge
stated once, counted before it was trusted, written into the graph, and marked so it can be
explained or withdrawn.

### And it keeps working

A stitch is a standing rule. Load more data and the import solves the active stitches over
the records it just wrote:

```bash
inv records import --graph $GRAPH --name twitter --model Twitter --path $DATA/twitter
```

```
  stitch    0 edge(s) resolved, 0 unresolved, 226 written by 5 active stitch(es)
```

Nobody re-ran a stitch. It is a MERGE, so the second import of the same records writes
nothing new — and a tweet that arrives next month reaches the airport it names on the way in.

## The datasets

| Dataset | Model | Nodes | Edges | Detail |
|---|---|---|---|---|
| [air-routes](air-routes/) | `AirRoutes` | 3,749 | 57,645 | [README](air-routes/README.md) |
| [news-articles](news-articles/) | `NewsArticles` | 253 | 573 | [README](news-articles/README.md) |
| [twitter](twitter/) | `Twitter` | 244 | 525 | [README](twitter/README.md) |

### What a dataset folder holds

| File | Read by | Purpose |
|---|---|---|
| `stitches.json` *(bundle root)* | `invana records check` · `invana stitches apply` | The rules between the datasets, in the vocabulary `POST …/model-links` uses — checked against the files, then declared against the Graph |
| `model.json` | `invana records import` | Identity keys, so a re-import merges rather than duplicates |
| `graph-model.json` | `invana models import --file` | The domain model, in `invana.model/1` |
| `nodes/<Type>.json` · `edges/<EDGE>.json` | `invana records import` | The records |
| `stitches/<EDGE_TYPE>.json` | `invana stitches commit` · `invana records import` | Edge records whose endpoints are their own fact (W3) — loaded for a declared, active stitch of that edge type |

One copy of the records, not two. The JSON above is the whole dataset — `invana loader`
reads a different shape (`nodes/*.csv` and `relationships/*.csv`) and this bundle does not
ship it, because a second copy is one that can disagree with the first and only the journal
path produces something stitchable.

## Checking a change

Edit a record and the bundle can be re-checked without a Graph, a connection or a database:

```bash
inv records check $DATA   # every rule above, counted
```

It reads `stitches.json` and the datasets beside it, counting each rule the way the preview
does, so a bundle that has drifted says so here rather than in Studio, after a load. The
keys are shared across datasets — a changed airport code in air-routes is a stitch that
stops resolving in news-articles — so run it after any edit.

## When it does not work

| Symptom | Cause |
|---|---|
| `No model named 'NewsArticles' in this Graph` | Step 4 was skipped, or it landed in a different Graph |
| `'NewsArticles' is already in this Graph, from the same package` | Step 4 has already run — it is not re-runnable. Nothing was written; go on to step 5, or `models upgrade` if the file changed |
| `is a different package … not a newer version of it` | Two different models want the same local name. The name is local — import the second with `--as <name>` |
| `... has no published version` | Step 5 was skipped — import refuses a draft |
| `Graph '<slug>' not found` | The CLI is reading a different application database than the engine — make `INVANA_DATABASE_URL` match on both |
| `Graph has no connection` | Step 2's connection was not attached |
| `This connection is marked read-only` | Invana never writes to a read-only connection |
| A stitch previews `0` | The rule is wrong, not the data — `invana records check` says what should resolve |
| The cross-model edges are missing | The stitches are staged, not committed. `inv stitches resolve` says *not committed*; committing is what writes them |
| `This connection is marked read-only` on commit | Committing writes edges, and Invana never writes to a read-only connection |
| `apply` reports `skip … has no published version` | Step 5 was skipped for that model |
| `apply` reports `skip … which this Graph has not imported` | Step 6 has not run for the dataset the rule's rows arrive with |
| `apply` reports `--  already declared` | The rule is already in this Graph. Nothing was written; that is the command being re-run, not an error |
| The import runs for minutes on air-routes | Expected — 61,394 records, one `MERGE` each. It is `MERGE`, so a re-import merges rather than duplicates |
