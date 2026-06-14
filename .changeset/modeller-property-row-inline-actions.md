---
"studio": patch
---

Modeller: tidy the property table's rows.

The Edit/Delete (and inline Save/Cancel) buttons in a node/edge type's Properties table were wrapping in the narrow Actions column, stacking vertically and making each row taller than needed. They now sit inline as compact icon buttons, so rows are only as tall as their content. Editing a row no longer inflates its height or shifts the columns: the table is fixed-layout (column widths are pinned by the header), the inline inputs/selects are compact (h-7), and the name field aligns its text with the read rows instead of indenting it.
