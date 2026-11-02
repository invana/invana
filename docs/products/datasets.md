# Invana Datasets — gather the data

Reusable knowledge, labelled by where it came from. Prototype page: *Invana Datasets › Gather the data*. Example: a plant-genetics lab’s Arabidopsis accession phenotypes.

System design: [api-and-cli.md](../../specs/system-design/api-and-cli.md) — the CLI. This file keeps the CLI's build status.

| | |
|---|---|
| For | researchers, curators, labs |
| Scope | Install-wide — above Graphs. The header shows no Graph |
| Rail | Catalogue · Validation · Standards │ Imports |
| A dataset is | a versioned table (CSV today) from one source under one authorship; documents datasets are experimental |
| Release | Core: how flat data reaches a Graph. Some features are experimental — see *Core and experimental* |
| Hands off to | Modeller (bind into a model) · Projects (findings cite versions) · Agents (collectors, validators) |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

Product spec: [Data](../../specs/products/data/product.md) — its features DA-F01–F04, their stories (DS-nn are DA-nn), origin, provenance, standards and the product decisions live there. This file keeps the CLI and the rows still to place.

## CLI — build status

What each command does, and the conventions, are in [api-and-cli.md](../../specs/system-design/api-and-cli.md). This keeps where each stands.

| Command | Status |
|---|---|
| `invana records import --graph --model --name --path` · `records check <path>` | ✅ exists |
| `invana loader <path>` | ✅ exists — retire once `datasets import` lands |
| `invana datasets list [--origin --standard --bound-in]` · `show <publisher/name>` | New · P-08 |
| `invana datasets import --path --as <publisher/name> --origin --licence` | New · P-08 |
| `invana datasets versions <ds>` · `diff <ds> v2 v3` · `history <ds> --record <id>` | New · P-08 P-09 |
| `invana datasets observe <ds> --row k=v …` | New · P-08 |
| `invana datasets collect --instructions <file> --tools …` | New · P-01 P-03 P-05 |
| `invana datasets share <ds> --visibility lab\|install` · `retract <ds>@v --reason` | New · P-08 P-18 |
| `invana datasets refresh <ds> --schedule "<cron>"` | New · P-08 P-13 |
| `invana datasets bind <ds>@v --graph --model --type` | New · P-08 |
| `invana datasets export <ds>@v --format csv\|json --out` | New · P-08 |
| `invana validation list` · `resolve <id> --use official\|collected\|value` | New · P-08 |
| `invana standards list` · `show` · `import --skos <file\|url>` · `attach --dataset --mode block\|warn\|report` · `check --dataset` | ✅ B04 · B12 |
| `invana datasets pack` · `unpack` | Later |

## Decisions

| Decision | Detail |
|---|---|
| Imports tiles are the engine's | The Imports, Running and Failed counts, the median time and *Imports a day* come from `GET /api/v1/runs/stats?kind=import&kind=bulk&days=30&tz=…` over every Graph the reader is in ([IN-F02](../../specs/products/inbox/features/IN-F02-running/feature.md)) — not from the fifty newest rows per Graph the journal list reads |
| Paths carry the publisher | A dataset is `/datasets/catalogue/<publisher>/<name>`, a standard `/datasets/standards/<publisher>/<name>`, a validation item `/datasets/validation/<publisher>/<name>/<key>/<term>` |
| Launcher position | First: the launcher follows the thinker's path, and gathering comes first |

