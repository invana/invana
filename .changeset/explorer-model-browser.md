---
"studio": minor
---

Add a read-only **Model** browser to the Explorer left rail. A new `ListTree`
rail icon (shown only on Explorer) docks a tabbed schema browser under the shared
`?settings=model` key, with two views of the active model:

- **Overview** — a file-manager-style tree: node/edge types expand to reveal
  Properties / Indexes / Constraints, and properties show their data type,
  cardinality, and inherited marker — like a SQL schema browser.
- **Canvas** — the schema rendered as a graph (reuses the Modeller's read-only
  schema canvas, so there's no duplicate render wiring).

It reads the active model version (`useActiveVersionQuery`, the same data already
used for the node-expand menus), so it's purely a viewer; all authoring stays in
the Modeller. The rail stays single-open: opening the Model panel closes Sessions
and vice versa. `GraphDetail` now lets a view own more than one native left-rail
panel.
