---
"invana": minor
"studio": minor
---

Models begin by connecting a database or by *New model*, are read on their own canvas, compared on the map and published with who reads them (docs/for-developers/modules/connect-and-model/features/connect-a-database.md · the-model-page.md · publish-review.md · domain-models.md).

- **Connect a database** (`/graphs/new`): pick one of six engines, *Test* the URI, then *Connect and draft a model*. `POST …/graphs/connect` makes the Graph, saves its connection and drafts an authored model from introspection in one call; an unreachable database is refused and no Graph is made. `POST …/graphs/connect/test` checks a URI without saving anything.
- **New model** is one dialog — *Describe it* (the assistant drafts from the description), *A file* (an exported artefact) or *A starter*. Each lands on the new model's draft canvas.
- **The draft is read on its canvas, marked.** One model's canvas is the global model's board on schema cards, full-bleed. Each type the draft changes wears its mark — `+ timezone`, `~ dist integer → float`, `− version` — and a type it adds is dashed. A floating bar reads `N staged · Discard · Publish vN`.
- **Compare on the map.** *Compare* on the global model opens the Comparing bar — a model and two of its versions — and marks the changed types in place on the whole map, with `+ added · ~ changed · − removed` counts and *Review and publish* when the second version is the draft.
- **The version a draft publishes as is the engine's.** `GET …/versions/{draft}/diff` returns `next_version`, the SemVer bump its classification implies over the active version; the staged bar, the crumb, the Comparing bar and the Publish confirm all read it.
- **History names the datasets a version touched**, stored on the version at publish.
- The stitch inspector draws each end in its model's hue, an anchor reads `joined N of M`, and a stitch declared by loading a bundle records who declared it.
