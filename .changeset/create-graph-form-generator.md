---
"studio": minor
---

Rebuild the create-graph form on the `@invana/forms` schema-driven `ObjectField` generator (POC).

Fields are now declared as a config array and rendered full-size (`size="md"`), so inputs and labels
are no longer shrunk to `text-sm`. Requires `@invana/forms` >= 0.0.8 (adds the `size` prop and a
`textarea` field type).
