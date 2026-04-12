# RFC-010: Studio — Graph Modeller UI

**Status**: Draft  
**Author**: Invana Team  
**Date**: 2026-04-12  
**Depends on**: RFC-002 (Graph Modeller engine), RFC-009 (Studio v1)

---

## Summary

Implement `/graphs/:id/modeller` in Studio — a visual schema editor that lets users inspect and manage the `GraphSchema` already stored by the engine's modeller module (RFC-002). The engine-side backend (SchemaStore, Introspector, Projector, Reconciler) is already built; this RFC is purely the frontend.

---

## Motivation

- The engine auto-introspects a schema on connection but there is no UI to view or edit it.
- Schema editing today requires raw API calls; a visual editor lowers the barrier significantly.
- Node/edge types, property keys, constraints, and indexes need a clear information hierarchy — a table/tree view communicates this better than JSON.

---

## Goals

1. Render the live `GraphSchema` for a connected graph under `/graphs/:id/modeller`.
2. List node types and edge types with their property mappings (read-only for v1).
3. List property keys, constraints, and indexes.
4. Provide entry points for future schema editing actions (create type, add property, etc.) — as disabled/placeholder buttons in v1.
5. No schema editing mutations in v1 (that is RFC-011 scope or a later iteration).

---

## Design

### Route

```
/graphs/:id/modeller
```

Accessible from the graph detail layout (shared header with Explorer tab). The `id` is the graph UUID.

### Page Layout

The modeller page uses the full `mainSection` content area of `AppLayoutV2`. Layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header: Graph name  •  [Explorer] [Modeller]  tabs                 │
├─────────────────────────────────────────────────────────────────────┤
│  Toolbar: [+ Add Node Type]  [+ Add Edge Type]                      │
│           [Introspect]  [Project]  (all disabled in v1)             │
├──────────────────┬──────────────────────────────────────────────────┤
│  Left nav        │  Detail panel (right)                            │
│  (240px)         │  (flex-1)                                        │
│                  │                                                  │
│  ▾ Node Types    │  <TypeDetailPanel — see below>                   │
│    • Person       │                                                  │
│    • Movie        │                                                  │
│  ▾ Edge Types    │                                                  │
│    • ACTED_IN     │                                                  │
│    • DIRECTED     │                                                  │
│  ▸ Property Keys │                                                  │
│  ▸ Constraints   │                                                  │
│  ▸ Indexes       │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

**Selection behaviour**: clicking any item in the left nav replaces the detail panel content. The selected item is highlighted. The URL does **not** change on selection (local state only).

---

### Detail Panel — Node Type

Rendered when a node type is selected in the left nav.

```
┌────────────────────────────────────────────────────────┐
│  ● Person                          [node type badge]   │
│  <description or em-dash if empty>                     │
│  parent_type: —  │  validation_mode: strict            │
│  is_abstract: false                                    │
├────────────────────────────────────────────────────────┤
│  Properties                                            │
│  ┌──────────────┬────────────┬─────────────┬────────┐  │
│  │ Name         │ Data type  │ Cardinality │ Rules  │  │
│  ├──────────────┼────────────┼─────────────┼────────┤  │
│  │ name         │ string     │ SINGLE      │ —      │  │
│  │ born         │ integer    │ SINGLE      │ —      │  │
│  │ tmdbId       │ string     │ SINGLE      │ —      │  │
│  └──────────────┴────────────┴─────────────┴────────┘  │
├────────────────────────────────────────────────────────┤
│  Constraints on this type                              │
│  ┌──────────────────┬───────────────┬───────────────┐  │
│  │ Name             │ Type          │ Properties    │  │
│  ├──────────────────┼───────────────┼───────────────┤  │
│  │ person_name_uniq │ unique        │ name          │  │
│  └──────────────────┴───────────────┴───────────────┘  │
├────────────────────────────────────────────────────────┤
│  Indexes on this type                                  │
│  ┌──────────────────┬────────────┬───────────────────┐ │
│  │ Name             │ Index type │ Properties        │ │
│  ├──────────────────┼────────────┼───────────────────┤ │
│  │ person_name_idx  │ range      │ name              │ │
│  └──────────────────┴────────────┴───────────────────┘ │
└────────────────────────────────────────────────────────┘
```

Data source:
- **Header**: `NodeTypeResponse.name`, `.description`, `.parent_type`, `.validation_mode`, `.is_abstract`
- **Properties table**: `NodeTypeResponse.property_mappings[]` → each row is a `TypePropertyMappingResponse`; the columns come from `mapping.property_key.name`, `mapping.property_key.type`, `mapping.property_key.value_cardinality`, `mapping.property_key.validation_rules`
- **Constraints section**: filter `ConstraintResponse[]` where `target_label === nodetype.name`
- **Indexes section**: filter `IndexResponse[]` where `target_label === nodetype.name`

If the node type has a non-empty `hierarchy` list, show a breadcrumb above the name: `Root → Parent → Person`.

---

### Detail Panel — Edge Type

Rendered when an edge type is selected.

```
┌────────────────────────────────────────────────────────┐
│  → ACTED_IN                        [edge type badge]   │
│  <description>                                         │
│  multiplicity: MULTI                                   │
│  source types: Person     target types: Movie          │
├────────────────────────────────────────────────────────┤
│  Properties                                            │
│  ┌──────────────┬────────────┬─────────────┬────────┐  │
│  │ Name         │ Data type  │ Cardinality │ Rules  │  │
│  ├──────────────┼────────────┼─────────────┼────────┤  │
│  │ roles        │ string     │ LIST        │ —      │  │
│  └──────────────┴────────────┴─────────────┴────────┘  │
├────────────────────────────────────────────────────────┤
│  Constraints on this type                              │
│  (same layout as node type)                            │
├────────────────────────────────────────────────────────┤
│  Indexes on this type                                  │
│  (same layout as node type)                            │
└────────────────────────────────────────────────────────┘
```

Data source: `EdgeTypeResponse` — `.source_node_types[]`, `.target_node_types[]`, `.multiplicity`, `.property_mappings[]`. Constraints/Indexes filtered by `target_label === edgetype.name`.

Source/target type chips are rendered as `Badge` components; if the list is empty show `—`.

---

### Detail Panel — Property Key (global view)

Rendered when "Property Keys" section header or an individual key is selected.

```
┌────────────────────────────────────────────────────────┐
│  Property Keys  (version-wide)                         │
│  ┌──────────┬─────────┬─────────────┬────────────────┐ │
│  │ Name     │ Type    │ Cardinality │ Used by        │ │
│  ├──────────┼─────────┼─────────────┼────────────────┤ │
│  │ name     │ string  │ SINGLE      │ Person, Movie  │ │
│  │ born     │ integer │ SINGLE      │ Person         │ │
│  │ roles    │ string  │ LIST        │ ACTED_IN       │ │
│  └──────────┴─────────┴─────────────┴────────────────┘ │
└────────────────────────────────────────────────────────┘
```

"Used by" is computed client-side by scanning all `NodeTypeResponse.property_mappings` and `EdgeTypeResponse.property_mappings` for references to each `property_key.name`.

---

### Detail Panel — Constraints

Rendered when "Constraints" section header is selected — global list across all types.

```
┌────────────────────────────────────────────────────────┐
│  Constraints                                           │
│  ┌──────────────────┬──────────┬───────────┬────────┐  │
│  │ Name             │ Kind     │ On label  │ Props  │  │
│  ├──────────────────┼──────────┼───────────┼────────┤  │
│  │ person_name_uniq │ unique   │ Person    │ name   │  │
│  └──────────────────┴──────────┴───────────┴────────┘  │
└────────────────────────────────────────────────────────┘
```

---

### Detail Panel — Indexes

Rendered when "Indexes" section header is selected — global list.

```
┌────────────────────────────────────────────────────────┐
│  Indexes                                               │
│  ┌──────────────────┬────────────┬────────┬─────────┐  │
│  │ Name             │ Index type │ Label  │ Props   │  │
│  ├──────────────────┼────────────┼────────┼─────────┤  │
│  │ person_name_idx  │ range      │ Person │ name    │  │
│  └──────────────────┴────────────┴────────┴─────────┘  │
└────────────────────────────────────────────────────────┘
```

---

### Empty / No-Selection State

When the page loads with no selection, the detail panel shows:

```
┌────────────────────────────────────────────────────────┐
│  (graph icon)                                          │
│  Select a node type, edge type, property key,          │
│  constraint, or index from the left panel to           │
│  view its details.                                     │
└────────────────────────────────────────────────────────┘
```

### API Usage

All data comes from the engine's existing modeller API endpoints:

```
GET  /api/v1/graphs/:id               → graph metadata incl. schema_id
GET  /api/v1/schemas/:schema_id       → GraphSchema + latest version
GET  /api/v1/schemas/:schema_id/versions/:version_id/node-types
GET  /api/v1/schemas/:schema_id/versions/:version_id/edge-types
GET  /api/v1/schemas/:schema_id/versions/:version_id/property-keys
GET  /api/v1/schemas/:schema_id/versions/:version_id/constraints
GET  /api/v1/schemas/:schema_id/versions/:version_id/indexes
POST /api/v1/graphs/:id/introspect    → trigger fresh introspection (async)
```

If `schema_id` is null on the graph, the page shows an "Introspect" prompt.

### File Structure

```
studio/src/pages/graphs/modeller/
├── ModellerPage.tsx              # Route component — fetches graph + schema; owns selectedItem state
├── components/
│   ├── SchemaNav.tsx             # Left nav: collapsible sections, each item calls onSelect()
│   ├── DetailPanel.tsx           # Switches on selectedItem.kind to render the right detail view
│   ├── NodeTypeDetail.tsx        # Node type header + properties table + filtered constraints + indexes
│   ├── EdgeTypeDetail.tsx        # Edge type header + source/target chips + properties + constraints + indexes
│   ├── PropertyKeyTable.tsx      # Global property keys table with "Used by" computed column
│   ├── ConstraintTable.tsx       # Global constraints table (name, kind, label, properties)
│   ├── IndexTable.tsx            # Global indexes table (name, type, label, properties)
│   ├── PropertyMappingTable.tsx  # Reusable: renders TypePropertyMappingResponse[] as a table
│   └── NoSelectionPlaceholder.tsx# Empty state shown before any selection
│
studio/src/services/api/
├── schemas.ts                    # schemasApi.getSchema, listNodeTypes, listEdgeTypes, …
│
studio/src/hooks/queries/
└── useSchema.ts                  # TanStack Query hooks: useSchemaQuery, useNodeTypesQuery, …
```

`PropertyMappingTable` is shared by both `NodeTypeDetail` and `EdgeTypeDetail`; it renders columns: Name, Data type, Cardinality, Validation rules.

### State

- URL params carry `graphId`; schema/version IDs are derived from the graph record.
- `selectedItem: { kind: 'node-type' | 'edge-type' | 'property-keys' | 'constraints' | 'indexes', id?: string }` is `useState` in `ModellerPage` — passed down as props. No URL change, no global store.
- All API calls fetched once at page load via TanStack Query; `staleTime: 60_000`, no polling.
- Constraints and indexes are fetched globally, then filtered client-side when rendering a specific node/edge type detail (no extra API call per selection).
- "Used by" column in the property keys table is computed client-side from the already-fetched node/edge type lists.

### Empty States

| Condition | Display |
|---|---|
| `schema_id === null` | "No schema yet — run introspection to discover your database schema." + Introspect button |
| Schema exists but 0 node types | "No node types found in this schema version." |
| Graph status ≠ ACTIVE | "Graph is not connected — schema data may be stale." banner |

---

## Dependencies

- `@invana/ui` — `Table`, `Badge`, `Button`, `Tabs`, `ScrollArea`, `Separator` — existing
- No new npm packages needed

---

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Inline editing in v1 | Engine mutation API (create_node_type etc.) exists but UX needs careful design — deferred to next iteration |
| Visualise schema as a graph | Impressive but adds complexity; list/tree view is faster to build and more accessible |

---

## Security Considerations

- All reads go through the engine API which enforces auth (future).
- No writes in v1 — no mutation risk.

---

## Open Questions

- [x] Should the modeller show properties table-wide or per node/edge type? → **Per type** in the detail panel; a global flat list is also available via the "Property Keys" section.
- [ ] Do we need pagination for graphs with 100+ node types? (defer — use virtual scroll if needed)

---

## Implementation Plan

1. [ ] Add TypeScript types mirroring engine Pydantic schemas (`NodeTypeResponse`, `EdgeTypeResponse`, `PropertyKeyResponse`, `TypePropertyMappingResponse`, `ConstraintResponse`, `IndexResponse`)
2. [ ] Add `schemasApi` service (`getSchema`, `listNodeTypes`, `listEdgeTypes`, `listPropertyKeys`, `listConstraints`, `listIndexes`)
3. [ ] Add TanStack Query hooks: `useSchemaQuery`, `useNodeTypesQuery`, `useEdgeTypesQuery`, `usePropertyKeysQuery`, `useConstraintsQuery`, `useIndexesQuery`
4. [ ] Build `ModellerPage` — page layout, `selectedItem` state, loading/error/empty states
5. [ ] Build `SchemaNav` — collapsible sections, item list with selection highlighting
6. [ ] Build `PropertyMappingTable` (shared reusable)
7. [ ] Build `NodeTypeDetail` — header metadata + `PropertyMappingTable` + filtered constraints + filtered indexes
8. [ ] Build `EdgeTypeDetail` — header + source/target `Badge` chips + `PropertyMappingTable` + filtered constraints + indexes
9. [ ] Build `PropertyKeyTable` with computed "Used by" column
10. [ ] Build `ConstraintTable` and `IndexTable` (global views)
11. [ ] Build `DetailPanel` switcher + `NoSelectionPlaceholder`
12. [ ] Wire `/graphs/:id/modeller` route; update App nav
13. [ ] Add changeset

---

## References

- RFC-002: Graph Modeller (engine backend)
- RFC-009: Studio v1 (app shell, patterns)
- Engine modeller API: `engine/src/invana/server/routes/`
