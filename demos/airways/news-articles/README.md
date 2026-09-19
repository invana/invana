# News Articles

Aviation coverage — what gets written about airlines, the routes they open and drop, and
the cities and countries they fly between. Built to sit next to [air-routes](../air-routes)
in the same Graph and be stitched to it.

Every airport code, city name and country code here was **read out of air-routes**, so an
anchor between the two resolves against real rows. `UK`, not `GB` — because that is how
air-routes spells it.

## Model — `NewsArticles`

### Node types

| Type | Identity | Properties |
|---|---|---|
| `Article` | `article_id` | `headline` · `url` · `summary` · `published_at` · `sentiment` · `word_count` · `language` |
| `Publisher` | `domain` | `name` · `country_code` · `kind` (wire · trade · national) |
| `Airline` | `iata` | `name` · `icao` · `callsign` · `country_code` · `hub_code` · `alliance` · `fleet_size` |
| `City` | `code` | `name` · `country_code` · `lat` · `lon` |
| `Country` | `iso_code` | `name` |
| `Route` | `route_id` | `origin_code` · `destination_code` · `status` (launched · planned · suspended) · `starts_on` · `frequency_weekly` |
| `Topic` | `tag` | `label` |

### Edge types

| Edge | From → To | Properties |
|---|---|---|
| `PUBLISHED_BY` | Article → Publisher | — |
| `MENTIONS_AIRLINE` | Article → Airline | `prominence` |
| `MENTIONS_CITY` | Article → City | — |
| `MENTIONS_COUNTRY` | Article → Country | — |
| `REPORTS_ON` | Article → Route | — |
| `TAGGED` | Article → Topic | `position` |
| `OPERATED_BY` | Route → Airline | — |
| `BASED_IN` | Airline → Country | — |
| `LOCATED_IN` | City → Country | — |

### Counts

| | Article | Publisher | Airline | City | Country | Route | Topic |
|---|---|---|---|---|---|---|---|
| nodes | 65 | 7 | 26 | 63 | 44 | 38 | 10 |

573 edges. 826 records in total.

## The keys it was built to be joined on

| Property | On | Joins to | As |
|---|---|---|---|
| `Country.iso_code` | 44 countries | `AirRoutes.country.code` | **anchor** — a country is a country |
| `Topic.tag` | 10 topics | `Twitter.Hashtag.tag`, case-insensitively | **anchor** |
| `City.code` | 63 cities | `AirRoutes.airport.code` | `SERVED_BY` |
| `Airline.hub_code` | 26 carriers | `AirRoutes.airport.code` | `HUBS_AT` |
| `Route.origin_code` · `destination_code` | 38 routes | `AirRoutes.airport.code` | `DEPARTS_FROM` · `ARRIVES_AT` |
| `Publisher.domain` | 7 outlets | `Twitter.Account.domain` | `SPEAKS_FOR` |
| `Airline.iata` | 26 carriers | `Twitter.Account.airline_iata` | `SPEAKS_FOR` |
| `Article.url` | 65 articles | `Twitter.Tweet.linked_url` | `LINKS_TO` |

`Country.iso_code` is deliberately **not** spelled `code`: air-routes calls the same fact
`code`, and a stitch that needs a key on each side is the ordinary case, not the exotic one.
A city is joined to an airport by an edge rather than anchored to it, because a city is not
an airport.

The full matrix, with resolve counts, is in the [demo walkthrough](../README.md#7--stitch-them).

## Loading

```bash
uv run --directory engine invana models import --graph you/aviation --file ../demos/airways/news-articles/graph-model.json
# publish it in Studio › Models, then:
uv run --directory engine invana records import --graph you/aviation \
    --name news-articles --model NewsArticles --path ../demos/airways/news-articles
```

`--model` is required; nothing is inferred from the data.

## Editing it

The records are the source — edit `nodes/*.json` and `edges/*.json` directly, then check
the bundle:

```bash
invana records check demos/airways
```

Its keys are shared: city and country codes point into [air-routes](../air-routes), and
article URLs and topic tags are what [twitter](../twitter) points at. Change one and the
check says which stitch stopped resolving.

## Sample queries

Coverage that crosses into the route network, once `City ≡ airport` is anchored:

```cypher
MATCH (a:Article)-[:MENTIONS_CITY]->(c:City)
MATCH (ap:airport {code: c.code})-[r:route]->(:airport)
RETURN c.name, a.headline, count(r) AS routes_out
ORDER BY routes_out DESC LIMIT 10
```

Which carriers the negative coverage is about:

```cypher
MATCH (a:Article {sentiment: 'negative'})-[:MENTIONS_AIRLINE]->(al:Airline)
RETURN al.name, al.hub_code, count(a) AS stories
ORDER BY stories DESC
```

Routes that were announced and then pulled:

```cypher
MATCH (r:Route {status: 'suspended'})-[:OPERATED_BY]->(al:Airline)
RETURN al.name, r.origin_code, r.destination_code
```

Once the stitches are committed, a post reaches the route network in one traversal:

```cypher
MATCH (t:Tweet)-[:LINKS_TO]->(a:Article)-[:MENTIONS_AIRLINE]->(al:Airline)
MATCH (al)-[:HUBS_AT]->(hub:airport)
RETURN al.name, hub.city, count(DISTINCT t) AS posts ORDER BY posts DESC
```

## Not this

| Not here | Why |
|---|---|
| Article body text | The headline, the summary and the mentions are what a stitch joins on. A corpus is a different fixture |
| Real article URLs | The URLs are shaped like the outlet's own but point at nothing. Nothing here should be fetched |
| Airlines beyond 26 | Enough carriers to make hubs and alliances interesting, few enough to read the whole list |
