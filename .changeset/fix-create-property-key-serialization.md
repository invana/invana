---
"invana": patch
---

Fix 500 when adding a property to a node/edge type.

`POST …/property-keys` crashed while serialising its response: a freshly-created `PropertyKeyDefinition` had its `validation_rules` relationship unloaded, so `PropertyKeyResponse.model_validate` triggered an async lazy-load and raised `MissingGreenlet`. The store's `create_property_key` now returns the key re-fetched with `validation_rules` eagerly loaded (matching `create_node_type`), so the response serialises cleanly. Adding properties in the Modeller now works.
