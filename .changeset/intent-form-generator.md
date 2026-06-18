---
"studio": patch
---

Rebuild the graph Intent form on `@invana/forms`, with state managed by
react-hook-form instead of local `useState`. The intent field uses the
generator's `TextareaField` (wired via `FormField`) rather than `ObjectField`,
so the textarea spans the panel's full width — `ObjectField` lays fields out in
a two-column grid, which left a single field at half width.
