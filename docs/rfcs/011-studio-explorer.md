# RFC-011: Studio — Graph Explorer

**Status**: Draft  
**Author**: Invana Team  
**Date**: 2026-04-12  
**Depends on**: RFC-009 (Studio v1), RFC-008 (Query API), RFC-010 (Modeller UI)

---

## Summary

Implement `/graphs/:id/explorer` in Studio — an interactive query workbench that executes Cypher or Gremlin queries against a connected graph and renders results as an interactive force-directed graph canvas using `@invana/canvas-core` and `@invana/layouts-d3-force`.

---

## Motivation

- The engine exposes a fully functional query API (`POST /api/v1/graphs/:id/query`) but there is no UI to drive it.
- Graph data must be explored visually — tables of vertices and edges are not human-readable at scale.
- The project needs a validated integration path for `@invana/canvas-core` before it's used in more complex features.

---

## Goals

1. Execute raw Cypher / Gremlin queries via the engine query API.
2. Render query results (nodes + edges) on an interactive canvas using `@invana/canvas-core`.
3. Apply D3 force-directed layout via `@invana/layouts-d3-force`.
4. Click a node or edge to inspect its properties in a side panel.
5. Show query history (session-local, not persisted).
6. Show live connection status in the bottom status bar.
7. Support auto-detect of query language from the graph's connector capabilities (the engine already infers it).

---

## Non-Goals (v1)

- Saving/bookmarking queries — deferred.
- Exporting canvas as image/SVG — deferred.
- Multi-graph overlay — deferred.
- Result table view (tabular mode) — deferred.

---

## Design

### Route

```
/graphs/:id/explorer
```

### Page Layout

Matches the attached screenshot reference closely:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header: Invana Studio  |  <Graph Name>  [ Explorer ] [ Modeller ]  │
├──────────────┬──────────────────────────────┬───────────────────────┤
│ Query Panel  │  Canvas                      │  Inspector Panel      │
│ (300px)      │  (flex-1)                    │  (280px)              │
│              │                              │                       │
│ [Console]    │                              │ [Properties][Design]  │
│ [History]    │                              │                       │
│              │  ┌────────────────────────┐  │  (empty: click a      │
│ [Gremlin ▼]  │  │  Run a query to        │  │   node or edge to     │
│              │  │  explore the graph     │  │   inspect it)         │
│ <editor>     │  └────────────────────────┘  │                       │
│              │                              │                       │
│ [Run Query]  │                              │                       │
├──────────────┴──────────────────────────────┴───────────────────────┤
│  ● ACTIVE  bolt://localhost:7687   0 nodes  0 relationships  0 queries│
└─────────────────────────────────────────────────────────────────────┘
```

**Panels are resizable** via drag handles (left panel: 240–400px, right panel: 240–360px, canvas takes the rest).

### Components Breakdown

#### Query Panel (left)
- **Tabs**: Console | History
- **Language selector**: `Gremlin` / `Cypher` dropdown — pre-set based on connector type (read from graph record's `connector_class`); user can override.
- **Query editor**: CodeMirror 6 with basic syntax highlighting. Keyboard shortcut: `Cmd/Ctrl+Enter` to run.
- **Run Query button**: triggers mutation; shows spinner while running.
- **History tab**: session-local list of executed queries (query string + timestamp + result count). Click to re-load into editor.

#### Canvas (centre)
- Rendered by `@invana/canvas-core` (`Canvas` class, `GraphDataPlugin`, `D3ForceLayoutPlugin`).
- Initialised imperatively inside a `useEffect` on mount; destroyed on unmount.
- Empty state: centred icon + "Run a query to explore the graph".
- Each query result **replaces** the current canvas data (not accumulated) — toggle for accumulate mode is a v2 feature.
- Node colour is assigned per label using a seeded colour palette (consistent across re-runs).
- Edge label is rendered as a text overlay on the edge.
- On node click → emit selected node to Inspector panel.
- On edge click → emit selected edge to Inspector panel.
- Canvas controls (zoom in/out/fit) via toolbar buttons overlaid top-right of canvas.

#### Inspector Panel (right)
- **Tabs**: Properties | Design
- **Properties tab**: shows selected node/edge ID, label, and all properties as key-value pairs. Empty state: "Click a node or edge to inspect it."
- **Design tab**: placeholder — future per-type style overrides.

#### Status Bar (bottom)
- Connection indicator: coloured dot + graph status badge.
- Graph URI.
- Live counters: `N nodes · M relationships · Q queries` (session counts, not total in DB).

### Canvas Integration

`@invana/canvas-core` and `@invana/layouts-d3-force` are installed from the local monorepo at:

```
/Users/ravi.merugu/Projects/Invana/canvas/packages/canvas-core
/Users/ravi.merugu/Projects/Invana/canvas/packages/layouts-d3-force
```

Added to `studio/package.json` as local file dependencies:

```json
"@invana/canvas-core": "file:../../canvas/packages/canvas-core",
"@invana/layouts-d3-force": "file:../../canvas/packages/layouts-d3-force"
```

> **Note**: These will be changed to GitHub release branch refs or npm once the canvas packages publish official releases.

Canvas initialisation pattern (inside a React component):

```ts
const canvasRef = useRef<HTMLDivElement>(null);
const canvasInstance = useRef<Canvas | null>(null);
const graphPlugin = useRef<GraphDataPlugin | null>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  const canvas = new Canvas({ container: canvasRef.current });
  canvas.init().then(async () => {
    const plugin = new GraphDataPlugin({ fitOnRender: true });
    await canvas.registerPlugin(plugin, { key: 'graph' });
    const layout = new D3ForceLayoutPlugin({ animate: true });
    await canvas.registerPlugin(layout, { key: 'layout' });
    canvasInstance.current = canvas;
    graphPlugin.current = plugin;
  });
  return () => { canvasInstance.current?.destroy(); };
}, []);
```

Query results → canvas data conversion:

```ts
// Engine returns: data: Array<{ id, label, properties, type: "vertex"|"edge", source?, target? }>
function resultToGraphData(data: QueryResultItem[]): GraphData {
  const nodes = data
    .filter(d => d.type === "vertex")
    .map(d => ({ id: d.id, label: d.label, shape: "circle" as const }));
  const edges = data
    .filter(d => d.type === "edge")
    .map(d => ({ id: d.id, source: d.source!, target: d.target!, label: d.label }));
  return { nodes, edges };
}
```

Events for selection:

```ts
canvas.on('node:click', (event) => setSelectedElement({ type: 'node', data: event.node }));
canvas.on('edge:click', (event) => setSelectedElement({ type: 'edge', data: event.edge }));
```

### API Usage

```
GET  /api/v1/graphs/:id                      → graph metadata (status, connector_class)
POST /api/v1/graphs/:id/query                → execute query
     Body: { query: string, parameters?: {} }
     Response: { result_type, query_language, data: [...], execution_time_ms, row_count }
```

### File Structure

```
studio/src/pages/graphs/explorer/
├── ExplorerPage.tsx              # Route component — layout container
├── hooks/
│   └── useQueryExecution.ts      # useMutation wrapping graphsApi.query(); history state
├── components/
│   ├── QueryPanel.tsx            # Left panel — Console/History tabs + editor + run button
│   ├── GraphCanvas.tsx           # Canvas mount/unmount wrapper, exposes onNodeClick/onEdgeClick
│   ├── CanvasToolbar.tsx         # Zoom-in / zoom-out / fit overlay
│   ├── InspectorPanel.tsx        # Right panel — Properties/Design tabs
│   └── ExplorerStatusBar.tsx     # Bottom bar — status dot + counters
│
studio/src/services/api/graphs.ts  # Add: query(graphId, body) → QueryResponse
studio/src/types/query.ts          # QueryRequest, QueryResponse, QueryResultItem types
```

### State Management

| State | Location | Why |
|---|---|---|
| Query text | `useState` in QueryPanel | Local editor state |
| Query history | `useState` in ExplorerPage | Session-only, no persistence needed |
| Running mutation | TanStack Query `useMutation` | Server interaction + loading state |
| Selected element | `useState` in ExplorerPage | Passed down to Inspector |
| Canvas instance | `useRef` | Imperative, must not cause re-renders |
| Node/edge counts | `useState` in ExplorerPage | Updated after each query |

### Query Result Shape

The engine's `QueryResponse`:

```ts
interface QueryResponse {
  result_type: "graph" | "tabular";
  query_language: "cypher" | "gremlin";
  data: QueryResultItem[] | null;     // when result_type === "graph"
  rows: Record<string, unknown>[] | null; // when result_type === "tabular"
  execution_time_ms: number;
  row_count: number;
}

interface QueryResultItem {
  id: string;
  label: string;
  type: "vertex" | "edge";
  properties: Record<string, unknown>;
  source?: string;   // edge source vertex id
  target?: string;   // edge target vertex id
}
```

### Language Detection

The query language selector defaults based on `connector_class`:

```ts
const DEFAULT_LANGUAGE: Record<string, "cypher" | "gremlin"> = {
  "invana_neo4j.connector.Neo4jConnector": "cypher",
  "invana_memgraph.connector.MemgraphConnector": "cypher",
  "invana_arcadedb.connector.ArcadeDBConnector": "cypher",
  "invana_janusgraph.connector.JanusGraphConnector": "gremlin",
  "invana_tinkergraph.connector.TinkerGraphConnector": "gremlin",
};
```

The engine ignores the client-side language hint — it infers from the connector. The selector is cosmetic (affects syntax highlighting only) but should stay in sync.

---

## Dependencies

| Package | Source | Why |
|---|---|---|
| `@invana/canvas-core` | local file path (→ GitHub release later) | Graph canvas rendering |
| `@invana/layouts-d3-force` | local file path (→ GitHub release later) | Force layout |
| `@codemirror/view` + `@codemirror/state` + `@codemirror/lang-javascript` | npm | Query editor |
| `d3-force` | npm (peer dep of layouts-d3-force) | Layout internals |

---

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Cytoscape.js / vis-network | Project standard is `@invana/canvas-core`; other libs not considered |
| Accumulate results across queries | Simple replace-on-run is safer UX; expansion mode deferred |
| Persist query history in engine | Over-engineered for v1; session history is sufficient |

---

## Security Considerations

- Queries are passed verbatim to the engine; the engine enforces read-only mode on read-only graphs.
- No query sanitisation needed on the frontend — the engine is the trust boundary.
- Canvas renders data from the engine; XSS risk is mitigated because all rendering is Canvas2D/WebGL (no innerHTML).

---

## Performance Considerations

- Force layout animation can be expensive for >500 nodes; `D3ForceLayoutPlugin` supports `animate: false` for large datasets — auto-disable animation above a threshold (e.g. 200 nodes).
- `fitToContent` called after each query to keep graph in view.
- Canvas is destroyed on unmount to prevent WebGL context leak.

---

## Open Questions

- [ ] Should result_type="tabular" show a table below the canvas or replace it?
- [ ] What is the maximum node count before we switch to static layout?
- [ ] Should query history survive page navigation (move to `sessionStorage`)?

---

## Implementation Plan

1. [ ] Install `@invana/canvas-core` and `@invana/layouts-d3-force` from local file paths
2. [ ] Add `QueryRequest`, `QueryResponse`, `QueryResultItem` types to `studio/src/types/query.ts`
3. [ ] Add `graphsApi.query()` method to existing graphs API service
4. [ ] Build `GraphCanvas` component (imperative canvas lifecycle in `useEffect`)
5. [ ] Build `QueryPanel` (tabs, language selector, CodeMirror editor, Run button)
6. [ ] Build `InspectorPanel` (Properties tab + empty state)
7. [ ] Build `ExplorerStatusBar`
8. [ ] Build `ExplorerPage` wiring all panels together with resizable layout
9. [ ] Wire `/graphs/:id/explorer` route; update App nav Explorer icon
10. [ ] Verify build + lint (`pnpm build`, `pnpm lint`)
11. [ ] Add changeset

---

## References

- RFC-008: Graphs Query API (engine backend)
- RFC-009: Studio v1 (app shell, patterns)
- RFC-010: Studio Modeller UI (shared graph detail layout)
- `@invana/canvas-core` README: `canvas/packages/canvas-core/README.md`
- `@invana/layouts-d3-force`: `canvas/packages/layouts-d3-force/src/D3ForceLayoutPlugin.ts`
