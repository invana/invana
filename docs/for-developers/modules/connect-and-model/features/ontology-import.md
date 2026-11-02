# Import an ontology

A model can start from an ontology a field already published — **RDFS or an OWL subset, schema.org
included** — read from JSON-LD, Turtle or RDF/XML. The import maps what Invana can hold into a
**draft** model, lists what it skipped and why, and keeps each type's and property's **source IRI**.
Nothing publishes until a person does.

| | |
|---|---|
| Index | [1.10](../../../README.md#1--connect-and-model) · Slice **B12** (P-19) |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [share-a-model](share-a-model.md) · [domain-models](domain-models.md) · [stitch-models](stitch-models.md) · [skos-import](../../bring-data-in/features/skos-import.md) · products: [modeller.md](../../../../products/modeller.md) MO-15 · MO-F14 |

Product spec: [MO-F01 · Start a model](../../../../../specs/products/model/features/MO-F01-start-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `modeller.models.new.ontology` · `…ontology.preview` | Studio, C08 — Models `⋯` › *From an ontology*: one dialog, pick then preview, *Open as a draft* (`model-editor/components/OntologyImportDialog.tsx`) |
| `invana models import --graph g --ontology <file\|url> [--types A,B] [--as name] [--format] [--lang] [--dry-run]` | CLI — reads the file or fetches the URL, then the same manager |

## Engine

| Route (`/api/v1/u/{username}/{graphSlug}/models`) | Returns |
|---|---|
| `POST /import/ontology` `{content, format?, types?, name?, lang?, dry_run?}` | 201 `ActionResponse[OntologyImportResult]` (200 on `dry_run`) |

| Shape | Fields |
|---|---|
| `OntologyImportRequest` | `content` (≤ 20 MB) · `format?` (`turtle · json-ld · rdf-xml`) · `types?: [str]` · `name?` · `lang` (default `en`) · `dry_run` |
| `OntologyImportResult` | `model?` · `version?` (absent on a dry run) · `draft: SchemaExport` · `report: OntologyReport` · `unsupported_property_types` · `publishable` |
| `OntologyReport` | `format` · `triples` · `mapped: {node_types, edge_types, property_keys}` · `types: [MappedType]` · `skipped: [ImportNote]` · `skipped_count` · `notes: [ImportNote]` · `notes_count` · `suggestions: [StitchSuggestion]` |
| `MappedType` | `name` · `iri` · `kind` (`node · edge`) · `came_with?` (`Person.birthPlace`) · `properties: [str]` · `inherited: [{property, from_type}]` |
| `ImportNote` | `iri?` · `subject` · `kind` · `message` — lists keep 200, the count is the whole |
| `StitchSuggestion` | `kind` (`same_as · equivalent_class · equivalent_property`) · `name` · `iri` · `target_iri` |
| `PropertyKeyCreate/Response` · `NodeTypeCreate/Response` · `EdgeTypeCreate/Response` | gain `source_iri?` |

| Table | Column |
|---|---|
| `property_key_definitions` · `node_type_definitions` · `edge_type_definitions` | `source_iri` (nullable, ≤ 2048) — copied with the version, exported in the artefact |

| OWL / RDFS | Invana |
|---|---|
| `owl:Class` · `rdfs:Class` (not a datatype) | node type; `rdfs:label` → name, `rdfs:comment` → description |
| datatype property, or a property whose ranges are literals | property key on each domain type; XSD / schema.org datatype → Invana type |
| object property, or a property with a class range | edge type, domain → range, subclasses included on both ends |
| `rdfs:domain` · `rdfs:range` · `schema:domainIncludes` · `schema:rangeIncludes` | the property's types; an `owl:unionOf` list is read as its members |
| `rdfs:subClassOf` | flattened, inherited properties noted with their source |

| XSD / schema.org | Invana type |
|---|---|
| `string` · `anyURI` · `token` · `Text` · `URL` | `string` |
| `integer` · `int` · `long` · `nonNegativeInteger` … · `Integer` | `integer` |
| `decimal` · `float` · `double` · `Number` · `Float` | `float` |
| `boolean` · `Boolean` | `boolean` |
| `date` · `Date` · `dateTime` · `DateTime` · `time` · `Time` · `duration` | `date` · `datetime` · `time` · `duration` |
| anything else literal, or ranges that disagree | `string`, with a note |

| Event | Details |
|---|---|
| `model.import` | `name` · `package_id` · `content_hash` · `source = ontology` · `unsupported` · `skipped` (count) |

## Decisions

| # | Decision |
|---|---|
| OI2 | **The import is a draft, through the share-a-model path.** A new model with one draft version, `import_source = ontology`, a fresh `package_id`; a taken name is 409 `model_name_taken`. |
| OI10 | **Labels pick a language** — the asked one, then untagged, then any, in that order; names are made identifiers, a clash gets `_2`. |
| OI11 | **A source IRI is provenance, not shape.** It is in the content hash only when set, so an artefact without IRIs hashes as before. |
