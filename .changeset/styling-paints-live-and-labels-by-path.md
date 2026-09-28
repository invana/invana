---
"studio": patch
"invana": patch
---

Styling a type now repaints the canvas as you edit: colour, size, label and edge width. Before, an edit only showed after the canvas remounted. A node's label can now be its `id` or its `type` as well as any property. The label is stored as a dot path (`labelKey`: `id` · `type` · `data.name`), and migration `000000000060` rewrites every stored `labelProperty` on boards and their saved versions.
