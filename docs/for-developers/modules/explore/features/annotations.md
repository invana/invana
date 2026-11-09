# Annotate the data

What people and the assistant say about the graph's records, kept with the records: a note on a node or a
relationship, on one of its values, around a set of them. Any board that loads the records shows what is on
them.

| | |
|---|---|
| Index | [4.8](../../../README.md#4--explore) · Slice **—** (not scheduled) |
| Module | [Explore](../spec.md) |
| API / CLI / Studio | 🔵 / — / 🔵 |
| Related | [graph-canvas](graph-canvas.md) · [boards](boards.md) · [walkthrough](walkthrough.md) · [selection-and-the-panel](selection-and-the-panel.md) · [the-answer-surface](../../ask/features/the-answer-surface.md) · design canvas *Explorer · Annotate* (<https://claude.ai/artifact/Mqr1mcEde4MN4Hdf5kmK2B>) |

Product spec: [EX-F06 · Annotate and edit the data](../../../../../specs/capabilities/explore/features/EX-F06-annotate-and-edit-the-data/feature.md) — the story, its criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Where | Component | Reads / writes |
|---|---|---|---|
| Annotation layer | the board | canvas-ui `AnnotationsProjection` — cards, links, rings and count pills as graph elements, a group's frame on graph's `GroupFramesLayer` under them — and `AnnotationsOverlay` for the editor, the group name and the format bar, over `GraphBoard` | `annotations` prop |
| Annotate tools | the row, in Annotate | canvas-ui `ANNOTATE_TOOLS` (annotate · highlight · group) | `onAnnotationCreate` |
| Format bar | over the selected annotation | canvas-ui `AnnotationFormatBar` | `onAnnotationUpdate` · `onAnnotationDelete` |
| Annotations panel | the rail | canvas-ui `AnnotationsViewPanel` (list · record · detail) | the same callbacks |
| Legend section | the Legend panel | canvas-ui `LegendViewPanel` *Annotations* | `annotationView` · `onAnnotationViewChange` |
| Card, row, author mark | — | the card in the graph: `@invana/graph` `annotationTemplates()`; the panel's row and author mark: `@invana/ui` `AnnotationRow` · `AuthorMark` (`AnnotationCard` kept for off-board surfaces, slice 2) | — |
| Host | Explorer board | Studio `useAnnotations` | `GET/POST/PATCH/DELETE …/annotations`; the hides in the board's `styling.annotations` |

## Engine

| Endpoint | Body / query | Returns |
|---|---|---|
| `GET /api/v1/u/{username}/{graphSlug}/annotations` | `record` (repeatable) · `session` · `scope` = `session` · `graph` (default) · `all` · `limit` · `offset` | `AnnotationListResponse` — `items`, `total` |
| `POST …/annotations` | `AnnotationCreate` | `AnnotationDetail`, 201 |
| `PATCH …/annotations/{id}` | `AnnotationUpdate` | `AnnotationDetail` |
| `DELETE …/annotations/{id}` | — | 204 |

`annotations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `graph_id` | fk graphs, cascade | |
| `kind` | `note` · `value` · `highlight` · `group` | |
| `records` | json | `[{id, kind: node·edge, label}]`, in the order written |
| `prop` | string? | the property a `value` annotation is on |
| `value_then` | json? | the value when written |
| `text` | text | |
| `label` | string | a group's name |
| `color` | `amber` · `blue` · `green` · `red` · `grey` | a token, never a hex |
| `author_kind` | `user` · `assistant` | |
| `created_by_id` | fk users, set null | the person, or the session's owner for the assistant |
| `session_id` | fk sessions, set null | where it was written |
| `message_id` | fk session_messages, set null | the reply that wrote it (assistant) |
| `reach` | `session` · `graph` | |
| `promoted_by_id` | fk users, set null | who added an assistant annotation to the graph |
| `evidence` | json? | `{query, record_count, query_language}` (assistant) |
| `created_at` · `updated_at` | timestamps | |

`annotation_anchors` — one row per record an annotation is on, so *what is on these records* is one indexed lookup

| Column | Type | Notes |
|---|---|---|
| `annotation_id` | fk annotations, cascade | |
| `graph_id` | string | indexed with `record_id` |
| `record_id` | string | the database's element id |

`AnnotationCreate`

| Field | Type | Rule |
|---|---|---|
| `kind` | enum | |
| `records` | `[{id, kind, label}]` | `note` and `value`: exactly one · `highlight`: one or more nodes · `group`: two or more nodes |
| `prop` | string? | required for `value`, refused otherwise |
| `value_then` | any? | |
| `text` | string | required for `note` and `value` |
| `label` | string? | |
| `color` | enum? | default `amber`; `blue` for a group |
| `session_id` | string? | the caller's own session in this graph |

`AnnotationUpdate`: `text?` · `label?` · `color?` · `reach?` (only `session` → `graph`).

| Refusal | Status | When |
|---|---|---|
| `role_required` | 403 | a viewer writes |
| validation | 422 | the record count for the kind, `prop` on a non-value, empty text |
| not found | 404 | another graph's annotation, another person's session, or a session-only annotation from someone else's session — absent, never forbidden |
| permission denied | 403 | changing or deleting another person's annotation |

## Decisions

| # | Decision |
|---|---|
| AN9 | **Hidden is the board's.** The Legend's eyes and *In full / Badges* are saved in the board's `styling.annotations`, so everyone who opens the board sees the same; a viewer's toggles stay theirs and are not saved |
| AN10 | **Colours are tokens.** `amber` `--warning` · `blue` `--primary` · `green` `--success` · `red` `--destructive` · `grey` `--muted-foreground` |
| AN11 | **An annotation is part of the graph.** A card, its link, a highlight's rings and a badge's pill are graph elements, and a group's frame is painted on a layer under the graph; the board draws them from the host's annotations — never data: they are not saved, counted, typed, exported or undone. Layouts place cards like any node, so the layout considers them and an image export carries them. A group is a frame round its records, read off their places every frame; it is not a node, never re-parents them and no layout places it. Hiding annotations removes them, and the records stay where they are |

## Delivery

| Slice | What | Status |
|---|---|---|
| 1 | People's annotations: engine table and routes, the layer, the tools, the Annotations panel, the Legend section, Studio wiring, stories; cards drawn in the graph (AN11) | built — committed as the baseline, then the drawing moved into the graph |
| 2 | The assistant's annotations: session reach, Add to the graph / Dismiss, evidence, gaps, *Explain this*, *From* (this session · + the graph · all sessions), conflicts | not started |
| 3 | Authored walkthrough steps that show chosen annotations | not started — reverses [walkthrough](walkthrough.md) *Not building* rows on editing and reordering steps |

### Drawn, not built yet (slice 1)

| Gap | Why it waits |
|---|---|
| A card placed clear of the board's chrome | a new card avoids nodes and cards, not the row, rail, open panel or dock; it can sit under an open panel until the next layout run |
| *Load* on an annotation elsewhere in the graph | the engine has no load-records-by-id route the board can call; the panel omits *Load* until it does |
| Moving a card by hand that survives a reload | a card can be dragged; its place is not stored with the annotation yet |
| A deleted record listed as *its record was deleted* | the engine does not yet check the graph for the record; such an annotation lists as *elsewhere* |
