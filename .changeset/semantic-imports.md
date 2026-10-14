---
"invana": minor
---

Semantic imports: SKOS vocabularies become standards, RDFS / OWL ontologies become draft models.

- `POST /api/v1/standards/import/skos` reads a SKOS concept scheme — JSON-LD, Turtle or RDF/XML — into a standard: top concepts with narrower ones become terms, their descendants the allowed values (`skos:notation` → code, `skos:prefLabel` → label, `skos:broader` → `broader`). It creates the standard or publishes its next version; identical terms write nothing. `dry_run` previews.
- `POST /api/v1/u/{username}/{graphSlug}/models/import/ontology` reads an RDFS / OWL ontology, schema.org included, into a new draft model: classes → node types, literal-ranged properties → property keys, class-ranged properties → edge types, `rdfs:subClassOf` flattened. Pick classes with `types`; their ranges come along one level. `dry_run` previews.
- Both answer with an import report: what mapped, what was skipped and why (restrictions, property characteristics, SKOS mappings…), notes, and for an ontology the `owl:sameAs` / equivalence stitch suggestions.
- Standard terms and values, and model node types, edge types and property keys, keep the IRI they were imported from (`iri`, `source_iri`). Artefacts without IRIs hash as before.
- The engine never fetches a URL; a JSON-LD file with a remote `@context` is refused. `invana standards import --skos <file|url>` and `invana models import --ontology <file|url> [--types A,B]` read a file or fetch the URL themselves.
