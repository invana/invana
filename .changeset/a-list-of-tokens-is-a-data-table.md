---
"invana": patch
---

A list of tokens is a data table, and Studio holds `@invana/tables`.

`@invana/tables@0.0.29` joins `@invana/editor` in Studio — build-order step 2, and the thing the
Agents rework needs before it starts, because half its rows are tables.

**Profile › Access tokens** is the first list to move. Six columns of hand-rolled `Table` /
`TableRow` / `TableCell` markup become one `DataTable`: sorting on the four columns that have an
order, none on `Token` or `Actions`, and the column-visibility toolbar for free. The empty state is
passed as `emptyState` rather than kept as a sibling branch, so *the list* and *the list is empty*
are one render — the header row stands in both, which is what says the columns exist before there
is anything in them.

Nothing about a token changed: the secret is still shown exactly once, and Revoke is still one
click from the row that names it.
