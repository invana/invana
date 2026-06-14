---
"studio": patch
---

Modeller: remove the on-canvas inline inspector panel.

Clicking a node/edge type on the schema canvas no longer pops a small floating "Node type / Label / Rename" panel — that was redundant with the right-side **Details** panel, which already shows the selected type's label and properties and is where all editing happens (rename, add/edit properties, reverse). Clicking a type still selects it and opens it in Details.
