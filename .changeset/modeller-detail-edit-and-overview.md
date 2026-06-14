---
"studio": patch
---

Modeller: add an Edit action and a model metadata overview to the detail view.

The model detail header now has an Edit (pencil) action alongside Delete — both hidden for the read-only system/global model — that opens the same model form used by the list's rename/edit. With no node/edge type selected, the Details panel now shows a model overview (description, origin, validation mode, current version, created/updated timestamps, optional YAML path, and content counts) instead of the generic "select an item" placeholder. The overview fetches the full model so it can surface fields the list summary omits.
