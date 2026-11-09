# Import a SKOS vocabulary

A **SKOS** concept scheme becomes a [standard](standards.md): its concepts become terms and their
allowed values, `skos:prefLabel` the names and labels, `skos:notation` the codes, and `skos:broader`
the hierarchy. Each term and value keeps its **source IRI**. Read from JSON-LD, Turtle or RDF/XML;
the first semantic import Invana supports.

| | |
|---|---|
| Index | [2.8](../../../README.md#2--bring-data-in) · Slice **B12** (P-19) |
| Module | [Bring data in](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [standards](standards.md) · [ontology-import](../../connect-and-model/features/ontology-import.md) · products: datasets.md DS-15 · DS-F17 |

Product spec: [DS-F04 · Standards and checks](../../../../../specs/capabilities/datasets/features/DS-F04-standards-and-checks/feature.md) — DS-15; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `datasets.standards.import` | Studio, C08 — *Import from SKOS* on the Standards page: a dialog that reads a file or URL, previews and imports (`standards/ImportSkosDialog.tsx`) |
| `invana standards import --skos <file\|url> [--scheme IRI] [--publisher p] [--name n] [--format] [--lang] [--why] [--dry-run] [--user u]` | CLI — reads the file or fetches the URL, then the same manager |

## Engine

| Route (`/api/v1/standards`) | Returns |
|---|---|
| `POST /import/skos` `{content, format?, scheme?, publisher?, name?, lang?, why?, dry_run?}` | 201 `SkosImportResult` (200 on `dry_run` or `unchanged`) |

| Shape | Fields |
|---|---|
| `SkosImportRequest` | `content` (≤ 20 MB) · `format?` · `scheme?` (IRI) · `publisher?` (defaults to the caller) · `name?` (defaults to the slug of the scheme's title) · `lang` (default `en`) · `why?` · `dry_run` |
| `SkosImportResult` | `address` (`p/n`) · `scheme_iri` · `title` · `terms: [StandardTerm]` · `standard?: StandardRead` · `version?: StandardVersionRead` · `unchanged` · `report: SkosReport` |
| `SkosReport` | `format` · `triples` · `mapped: {terms, values}` · `skipped: [ImportNote]` · `skipped_count` · `notes: [ImportNote]` · `notes_count` |
| `StandardTerm` | gains `iri?` |
| `TermValue` | gains `iri?` · `broader?` (the code of its broader value in the same term) |

| SKOS | Standard |
|---|---|
| `skos:ConceptScheme` | the standard — `skos:prefLabel` / `dcterms:title` → title, `skos:definition` / `dcterms:description` → description |
| top concept with narrower concepts | a term, `prefLabel` → name, `definition` → description |
| its descendants | the term's values: `notation` → code, `prefLabel` → label, `broader` → `broader` |
| leaf top concepts | the values of a term named after the scheme |

## Decisions

| # | Decision |
|---|---|
| SK2 | **Top concepts** are those the scheme names (`hasTopConcept` / `topConceptOf`); none named, those in the scheme with no broader one. A concept belongs to a scheme by `inScheme`, by being top in it, or — with one scheme in the file — by having none. |
| SK4 | **The import is the `apply` path.** The address defaults to the caller's username and the slug of the scheme's title; terms identical to the current version write nothing (`unchanged`); otherwise a version is minted and the same owner rules hold ([standards](standards.md) ST1 · ST2). `why` defaults to *Imported from SKOS <scheme IRI>*. |
| SK6 | **Reading is shared with the ontology import** — formats, detection, the 20 MB cap, never fetching, labels by language ([ontology-import](../../connect-and-model/features/ontology-import.md) OI3 · OI4 · OI10). |

