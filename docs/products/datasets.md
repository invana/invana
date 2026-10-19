# Invana Datasets — gather the data

Reusable knowledge, labelled by where it came from. Prototype page: *Invana Datasets › Gather the data*. Example: a plant-genetics lab’s Arabidopsis accession phenotypes.

| | |
|---|---|
| For | researchers, curators, labs |
| Scope | Install-wide — above Graphs. The header shows no Graph |
| Rail | Catalogue · Validation · Standards │ Imports |
| A dataset is | tables or documents from one source under one authorship |
| Hands off to | Modeller (bind into a model) · Projects (findings cite versions) · Agents (collectors, validators) |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| DS-F1 | Catalogue — filter by origin, standard, licence, publisher, bound-in Graph | New · Blocked · P-08 | DS-01 |
| DS-F2 | Dataset page — preview, origin, author chain, licence, validation status | New · Blocked · P-08 | DS-02 |
| DS-F3 | Versions — immutable, hashed; where each version is used | New · Blocked · P-08 | DS-03 |
| DS-F4 | Record page — values, record-level origin exceptions, change log of properties | In Studio (C04) | DS-04 |
| DS-F5 | Observations — a few rows by form or by telling the assistant | New | DS-05 |
| DS-F6 | Collect with an agent — sources, tools, gap fill as a separate generated dataset | New · Blocked · P-01 P-03 P-05 | DS-06 |
| DS-F7 | Validation queue — conflicts with official data, constraint and standard violations | New | DS-07 |
| DS-F8 | Standards library — packs and org-authored | New · Blocked · P-12 | DS-08 |
| DS-F9 | Enforce a standard — column mapping, block · warn · report, conformance score | New | DS-09 |
| DS-F10 | Documents datasets — papers and notices; extracted tables become derived datasets | New · Blocked · P-05 | DS-10 |
| DS-F11 | Bind a version into a Graph’s model | New | DS-11 |
| DS-F12 | Share within the install; a fork names its source | New | DS-12 |
| DS-F13 | Imports journal and ingestion timeline (CLI and API loads) | Moves (from Modeller) | DS-13 |
| DS-F14 | Retraction — a version marked retracted with a reason; everything citing it flagged | New · Blocked · P-08 P-13 | DS-14 |
| DS-F15 | Scheduled refresh → new version, consumers stay pinned | New · Blocked · P-08 | DS-03 |
| DS-F17 | Import a standard from **SKOS** (concept scheme → terms and allowed values); JSON-LD, Turtle or RDF/XML | ✅ B12 · C08 | DS-15 |
| DS-F16 | Sensitivity labels per dataset and column, read by guardrails | New · Blocked · P-08 | DS-01 · DS-02 |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| DS-01 | researcher | one catalogue of every dataset, filtered by origin, publisher, standard and Graph | I reuse what a lab already gathered | `datasets.catalogue` |
| DS-02 | researcher | to read a dataset with its origin, author chain, licence and checks | I know how far to trust it | `datasets.dataset` · `datasets.dataset.provenance` |
| DS-03 | researcher | immutable versions and where each is used | a result can be reproduced from the exact data | `datasets.dataset.versions` · `datasets.dataset.used` |
| DS-04 | curator | a record’s values and every property ever changed | a fix is never silent | `datasets.record` |
| DS-05 | field researcher | to add a few observations by hand or by telling the assistant | my own evidence enters the trail | `datasets.observe` · `datasets.observe.assistant` |
| DS-06 | researcher | an agent to collect a dataset from the web and cite each row | gathering takes minutes, not weeks | `datasets.collect` · `datasets.collect.run` |
| DS-07 | curator | a queue of conflicts and violations to decide | collected data is checked before anyone relies on it | `datasets.validation` · `datasets.validation.item` |
| DS-08 | curator | a library of standards — shipped packs and our own | data follows the rules our field agreed | `datasets.standards` · `datasets.standard` |
| DS-09 | curator | to enforce a standard on a dataset as block, warn or report | bad rows are caught at the door | `datasets.standard.attach` · `datasets.dataset.conformance` |
| DS-10 | researcher | papers and notices kept as a documents dataset | what I read is cited like what I measured | `datasets.documents` |
| DS-11 | modeller | to bind a dataset version into a Graph’s model | tables become a graph I can ask | `datasets.bind` |
| DS-12 | researcher | to share a dataset with other labs in the install | knowledge one lab made is reused | `datasets.share` |
| DS-14 | researcher | a retracted source kept and flagged, with everything that cites it | conclusions built on withdrawn data never go unnoticed | `datasets.dataset.retracted` |
| DS-15 | curator | to import a standard from a SKOS vocabulary | published vocabularies become standards without retyping | `datasets.standards.import` |
| DS-13 | curator | to watch CLI and API imports and what they rejected | bulk loads are visible without an import UI | `datasets.imports` · `datasets.imports.run` |

## Origin

| Origin | Example | Who is the author |
|---|---|---|
| `official` | UniProt, a stock centre, the 1001 Genomes project | the publishing organisation |
| `collected` | rows gathered from web pages by an agent | each page’s author; the agent is *collected by* |
| `generated` | AI-filled gaps, synthetic rows | the agent and its run |
| `observed` | a researcher’s field measurements | the person |
| `derived` | simulation output, tables extracted from papers | the run that computed it, citing its inputs |

## Provenance

| Level | Rule |
|---|---|
| Dataset | Required: origin, author chain, licence, validation status. Records inherit it |
| Record | Stored only where it differs from the dataset (e.g. one value taken from an official source) |
| Property | Not stored in place; every change is a change-log entry: property, old → new, who, when, why |

| Author chain step | Recorded |
|---|---|
| Original authors | organisations, pages, people |
| Collected by | agent, tools, run |
| Modified by | person, records changed |
| Validated by | agent or person, result |

## Standards and checks

| Kind | Defined in | Enforced on | When broken |
|---|---|---|---|
| Standard | Datasets › Standards | datasets that claim it; models reference its values | block · warn · report |
| Constraint | Modeller, on a property | Graph writes and bound datasets | reject · flag for review |
| Rule | Modeller › Rules | publish, share, findings, decisions | block · warn · report |

- A range used once is a constraint; a range or vocabulary many datasets share is a standard.
- Packs Invana ships: Plant Trait Ontology (TO), MIAPPE, Darwin Core, ISO 3166, IAB Content Taxonomy. Labs author their own.

## CLI

| Command | Does | Status |
|---|---|---|
| `invana records import --graph --model --name --path` · `records check <path>` | bulk load into a model; validate files before loading | ✅ exists |
| `invana loader <path>` | legacy CSV loader | ✅ exists — retire once `datasets import` lands |
| `invana datasets list [--origin --standard --bound-in]` · `show <publisher/name>` | the catalogue | New · P-08 |
| `invana datasets import --path --as <publisher/name> --origin --licence` | a dataset with its origin and licence, as a new version | New · P-08 |
| `invana datasets versions <ds>` · `diff <ds> v2 v3` · `history <ds> --record <id>` | versions, their diff, a record's change log | New · P-08 P-09 |
| `invana datasets observe <ds> --row k=v …` | add an observation as yourself | New · P-08 |
| `invana datasets collect --instructions <file> --tools …` | an agent collects a dataset | New · P-01 P-03 P-05 |
| `invana datasets share <ds> --visibility lab\|install` · `retract <ds>@v --reason` | share; retract (Admin only) | New · P-08 P-18 |
| `invana datasets refresh <ds> --schedule "<cron>"` | refresh into new versions on a schedule | New · P-08 P-13 |
| `invana datasets bind <ds>@v --graph --model --type` | bind a version into a Graph's model | New · P-08 |
| `invana validation list` · `resolve <id> --use official\|collected\|value` | the review queue | New · P-08 |
| `invana standards list` · `show` · `import --skos <file\|url>` · `attach --dataset --mode block\|warn\|report` · `check --dataset` | standards packs, SKOS import, enforcement | ✅ B04 · B12 |
| `invana datasets pack` · `unpack` | registry phase 1 — files with provenance | Later |

## Decisions

| Decision | Detail |
|---|---|
| Above Graphs | One catalogue for the install; a Graph binds a version into a model |
| Formats | Tables and documents |
| Sharing | Only me · my lab · everyone in the install. Anyone may share their own dataset; a licence is required |
| Retracting | Only an install Admin retracts; the publisher can request it |
| SKOS import | A concept scheme becomes a standard: concepts → terms, `skos:prefLabel` → name, `skos:broader` → hierarchy, `skos:notation` → code. The source IRI is kept on each term. First semantic import Invana supports |
| SKOS import in Studio | *Import from SKOS* on Standards: the browser reads a file or URL (the engine never fetches), a read previews at once, several schemes become a picker, the name is editable — [2.8](../for-developers/modules/bring-data-in/features/skos-import.md) SK8–SK11 |
| Versions | Immutable; a fix is a new version; a finding cites the exact version |
| Observations | Small entry by form or assistant, authored by the person; bulk loads by CLI or API |
| Gap filling | Estimates never mix into collected data — they land in a separate `generated` dataset |
| Imports | CLI and API only; this product watches them. No import API exists in the engine today |
| Imports journal spans Graphs | Runs belong to a Graph and the engine has no install-wide runs list, so the journal reads each readable Graph's runs of kind `import` and `bulk` and merges them newest first; each row names its Graph and opens the run's page in that Graph's Activity. A Graph whose runs cannot be read is counted in the section's status, never silently left out |
| Imports tiles are the engine's | The Imports, Running and Failed counts, the median time and *Imports a day* come from `GET /api/v1/runs/stats?kind=import&kind=bulk&days=30&tz=…` over every Graph the reader is in ([SR77](../for-developers/modules/operate/features/see-what-ran.md#decisions)) — not from the fifty newest rows per Graph the journal list reads |
| Imports draws what a run row carries | Tiles: imports, running, failed (last 30 days) and median time of the loads that finished. The timeline is *imports a day* over 30 days. Records written and rejected are not on a run list row, so they are read on the run's page, not totalled here |
| Paths carry the publisher | A dataset is `/datasets/catalogue/<publisher>/<name>`, a standard `/datasets/standards/<publisher>/<name>`, a validation item `/datasets/validation/<publisher>/<name>/<key>/<term>` |
| Tabs are path levels | A dataset's tabs — Overview, Provenance, Records, Versions, Conformance, Used by — are path segments (`…/records/<key>` for one record), so a tab survives a reload. A tab is not a crumb ([shell › Breadcrumbs](shell.md#breadcrumbs)): one record reads `@user › Catalogue › <dataset> › <record>` |
| Observations by form | The form mints the next version from the current version's records plus the new rows; a new row never overwrites a key. In a dataset whose origin is not `observed`, each new row carries its own provenance (`observed`, by the person). Above 5,000 records the form points to the CLI |
| Not built in Studio | *Collect with an agent* (DS-06), documents datasets (DS-10) and *tell the assistant* (`datasets.observe.assistant`) — no engine run or tool exists for them. *Collect with an agent* is drawn disabled, naming why. *New observed dataset* is not offered: a dataset is created by `invana datasets import`, and the empty catalogue shows that command. On Standards, *Add a pack* is not offered — a pack is applied by `invana standards apply` — and *Check for a newer version* is not offered: no pack registry exists to check against |
| Validation is standard violations | The queue is every violation on the current version of every readable dataset, read from the engine's validation queue with its totals. `?dataset=` narrows it to one. Conflicts with official data need a validator agent, so *Use official* is not offered; the dataset's writer resolves an item with another value and a reason, published as the next version with the reason as its `why`. An item leaves the queue when the next version conforms |
| Who writes a dataset in Studio | Its creator or an install Admin: they share it, add observations, attach and detach standards and fix a validation item. Anyone who can read it may bind it |
| Sharing in Studio | Only me · everyone in the install. *My lab* waits for a lab record |
| Launcher position | First: the launcher follows the thinker's path, and gathering comes first |
| Retraction | Never deleted. The version is marked retracted with a reason; findings, decisions, reports and derived datasets that cite it are flagged; owners get an Inbox item; a rule can block new decisions on retracted data |
| Refresh | A dataset may carry a refresh schedule (a shared Schedule). Each refresh is a new immutable version with a diff; bound Graphs and findings stay on their version until someone moves them, and are told a newer one exists |
| Sensitivity | `public · internal · confidential · personal`, on the dataset and optionally tighter on a column. Guardrails read labels (e.g. *personal never leaves the install*, *confidential is not sent to outside LLMs*) |
| Registry seams | `publisher/name`, content hash, references by version — see [README](README.md#open-registry-later) |
| A record's change log names who | The record page's *Change log* reads *when · who · what changed · why* per version. The record log carries only an actor id, so the name comes from the dataset's own history (`/datasets/…/history`), matched by version |

## Not building

| Item | Why |
|---|---|
| Proprietary datasets, pricing | Not decided |
| Sharing across installs | Open registry, later |
| Bulk upload UI | CLI and API only |
| Images, sequences, spectra | Each needs its own viewer; later |
| Per-cell provenance | Too costly; record level + change log covers it |
