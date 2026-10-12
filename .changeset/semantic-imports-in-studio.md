---
"invana": minor
---

Studio imports what a field already published (skos-import.md, ontology-import.md).

- **SKOS → a standard** — *Import from SKOS* on Datasets › Standards reads a vocabulary from a file or
  a URL, previews what it found, how SKOS maps onto a standard, the terms and what it skipped, then
  creates the standard or mints its next version. A file with several concept schemes asks which.
- **An ontology → a draft model** — Modeller › Models › *From an ontology* reads schema.org, a URL or
  a file (RDFS / OWL in JSON-LD, Turtle or RDF/XML), lets you pick the types you need, previews the
  mapping — node types, edges, stitch suggestions, skips with their reasons — and opens it as a draft.
  Above 500 classes, the types are named rather than ticked.

The browser reads the document; the engine never fetches. Two small demo files are in
`demos/arabidopsis/semantic/`.
