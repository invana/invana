---
"invana": patch
---

An edited type can be staged again (model-editor.md ME2).

`GET …/models/{id}/draft/staged` answered **500** for any draft holding a modified node or edge type: the staged set read `.changes` off the type's diff, and a type diff carries `added_property_mappings` / `removed_property_mappings` / `metadata_changes` instead — only a *property key* diff has a `changes` dict. One edited type and the model's panel could not open at all, because Studio reads the staged set on every model it shows.

Metadata keeps the `field → [was, now]` shape the row already promised; property mappings are listed under their own two keys, because a set of names has no "was".
