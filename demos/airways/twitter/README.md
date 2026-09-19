# Twitter

Aviation chatter — carriers announcing schedules, outlets posting their own stories,
route watchers reposting them, and passengers complaining from the gate. Built to be
stitched onto [news-articles](../news-articles) and, through geotags, onto
[air-routes](../air-routes).

The values a stitch joins on were **read, never retyped**: article URLs and topic tags come
out of news-articles, airport codes out of air-routes.

## Model — `Twitter`

### Node types

| Type | Identity | Properties |
|---|---|---|
| `Tweet` | `tweet_id` | `text` · `created_at` · `lang` · `retweets` · `likes` · `replies` · `sentiment` · `linked_url` · `airport_code` |
| `Account` | `handle` | `display_name` · `followers` · `verified` · `kind` (airline · news · watcher · traveller) · `airline_iata` · `domain` · `country_code` |
| `Hashtag` | `tag` | — |

`linked_url` and `airport_code` are present only where the post has one — a passenger at a
gate carries a geotag and no link; an outlet posting its story carries a link and no geotag.

### Edge types

| Edge | From → To |
|---|---|
| `POSTED` | Account → Tweet |
| `TAGS` | Tweet → Hashtag |
| `MENTIONS` | Tweet → Account |
| `REPLIES_TO` | Tweet → Tweet |
| `RETWEETS` | Tweet → Tweet |
| `QUOTES` | Tweet → Tweet |

### Counts

| | Tweet | Account | Hashtag |
|---|---|---|---|
| nodes | 183 | 45 | 16 |

525 edges, plus 22 `ABOUT` stitch records. Accounts break down as 26 airline, 7 news,
4 watcher, 8 traveller.

## The keys it was built to be joined on

| Property | On | Joins to | As |
|---|---|---|---|
| `Hashtag.tag` | 10 of 16 tags | `NewsArticles.Topic.tag`, **case-insensitively** — `RouteLaunch` ≡ `routelaunch` | **anchor** |
| `Account.domain` | 7 news accounts | `NewsArticles.Publisher.domain` | `SPEAKS_FOR` |
| `Account.airline_iata` | 26 airline accounts | `NewsArticles.Airline.iata` | `SPEAKS_FOR` |
| `Tweet.linked_url` | 65 posts | `NewsArticles.Article.url` | `LINKS_TO` |
| `Tweet.airport_code` | 96 posts, 28 airports | `AirRoutes.airport.code` | `POSTED_NEAR` |

An `Account` is **not** anchored to a `Publisher` or an `Airline`. An anchor is type-level,
and `kind` says only some accounts are outlets and only some are carriers — anchoring the
whole type would claim every account is both. `SPEAKS_FOR` says what is actually true: this
account posts on behalf of that organisation.

The six hashtags with no topic behind them — `#AvGeek`, `#PaxEx`, `#Aviation`, `#Airports`,
`#FlightDelay`, `#Upgraded` — are there so the preview shows an overlap rather than a clean
union. A rule that matches everything teaches nothing about the one that matches half.

## `stitches/ABOUT.json`

22 records of `Tweet -[ABOUT]-> Article`: a watcher quoting a story without linking to it.
The post carries no key pointing at the article, because what it was about was decided when
it was written — one row per edge. This is the
[W3](../../../docs/for-developers/modules/connect-and-model/features/stitch-models.md#three-worked-stitches)
shape, where a relationship link's endpoints arrive in a dataset rather than from a join.

The file is not read by `invana records import` — `ABOUT` is not an edge type of either
model, it is the stitch's own. It is supplied as the dataset when the link is declared.

## Loading

```bash
uv run --directory engine invana models import --graph you/aviation --file ../demos/airways/twitter/graph-model.json
# publish it in Studio › Models, then:
uv run --directory engine invana records import --graph you/aviation \
    --name twitter --model Twitter --path ../demos/airways/twitter
```

`stitches/ABOUT.json` is not loaded by this command — see above.

## Editing it

The records are the source — edit `nodes/*.json` and `edges/*.json` directly, then check
the bundle:

```bash
invana records check demos/airways
```

`Tweet.linked_url` and `Hashtag.tag` point at [news-articles](../news-articles), and
`Tweet.airport_code` at [air-routes](../air-routes). Change one and the check says which
stitch stopped resolving.

## Sample queries

What the airline accounts are posting, and from where:

```cypher
MATCH (a:Account {kind: 'airline'})-[:POSTED]->(t:Tweet)
WHERE t.airport_code IS NOT NULL
RETURN a.display_name, t.airport_code, t.text
```

The posts that carry a link — the ones `Tweet.linked_url ≡ Article.url` will resolve:

```cypher
MATCH (t:Tweet) WHERE t.linked_url IS NOT NULL
RETURN count(t)
```

Complaint volume by airport, once `airport_code` is stitched to air-routes:

```cypher
MATCH (t:Tweet {sentiment: 'negative'})
WHERE t.airport_code IS NOT NULL
RETURN t.airport_code, count(t) AS gripes ORDER BY gripes DESC LIMIT 10
```

## Not this

| Not here | Why |
|---|---|
| Real posts, real handles' content | The handles are recognisable so the fixture reads naturally; every post is written for it. Nothing here was scraped |
| A follower graph | Accounts do not follow each other. Posts, tags and replies are what the stitches need |
| Non-English posts | `lang` is on the model for the day it matters; every row is `en` |
