---
"studio": patch
---

Modeller: stage draft edits, commit the whole model on Publish (RFC-029).

Editing a model no longer feels like a stream of committed actions. Draft edits — node/edge type create·edit·delete, property add·edit·remove, and canvas erase/reverse gestures — now stage silently: they still persist to the draft (so the canvas, nav and detail update immediately), but emit no per-edit success toast. A persistent "Unpublished changes — staged in this draft" indicator sits in the lifecycle footer while a draft has content. The redundant **Save** button is gone; **Publish** is the single commit and now goes through a confirmation dialog that summarises what's being committed (N node types, M edge types, K property keys). Nothing reaches the active model until that one deliberate step. Errors still toast as before.
