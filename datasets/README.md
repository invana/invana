# Bundled datasets

Sample graphs that ship with the repo, for the CSV bulk loader.

| Dataset | What it holds | Format |
|---|---|---|
| [movies](movies/) | the classic movies graph — people, films, and who did what on them | gold-standard CSV |
| [drug-interactions](drug-interactions/) | drugs, targets, pathways, mechanisms | gold-standard CSV |

Both load through `invana loader`, which writes vertices and edges with no model in the
picture:

```bash
uv run --directory engine invana loader ../datasets/movies \
    --uri bolt://localhost:7687 --connector invana.graph.connectors.OpenCypherConnector \
    --username neo4j --password testpassword
```

## Looking for air-routes?

It moved, with two new datasets alongside it, to **[demos/airways](../demos/airways/)** —
air-routes, news-articles and twitter, plus the models and the walkthrough for loading all
three into one Graph and stitching them together.
