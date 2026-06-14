---
"studio": patch
---

Modeller: sync the canvas with the selected type, and keep view controls while editing a draft.

Selecting a node or edge type from the left list (or via the post-draft reselect) now highlights the matching element on the canvas — previously selection only flowed canvas → details, so list clicks left the canvas unmarked. An edge type highlights every strand it fans out to. Editable drafts now also keep a zoom / fit / lock / grid view-controls strip in the header alongside the drawing tools, so authoring no longer loses canvas navigation (the read-only models already had the full Explorer view toolbar).
