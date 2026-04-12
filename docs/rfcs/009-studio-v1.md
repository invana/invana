# RFC-009: Studio v1 — Application Shell & Graphs Management

**Status**: Draft  
**Author**: Invana Team  
**Date**: 2026-04-11

---

## Problem

The `studio/` directory is currently a placeholder (`.gitkeep`). The engine has a fully
implemented graphs connection API (RFC-008) and modeller, but there is no frontend application
to use them. Before building feature-rich capabilities (visualization, query execution, schema
modelling), the project needs:

1. A production-quality **application scaffold** using the agreed stack.
2. An **application shell** — IDE-style layout, left nav, theme support — that all future
   features plug into.
3. A working **graph connections management UI** — the first concrete feature that exercises
   the engine API and validates the frontend architecture.

---

## Goals

1. Bootstrap `studio/` with Vite 7, React 19.2.x, TypeScript 6, TailwindCSS 4, pnpm, Biome.
2. Render an IDE-style shell using `AppLayoutV2` from `@invana/themes`.
3. Implement full CRUD for graph connections (create, list, edit, delete, reconnect) against
   the engine's `/api/v1/graphs` API.
4. Establish patterns for state management (Zustand + TanStack Query) that all future features
   will follow.
5. Conditional polling of graph status while connections are being established.
6. No visualization, no query execution, no schema modelling in this version.

---

## Design

### Stack

| Concern | Choice | Version |
|---|---|---|
| Build tool | Vite | 7.x |
| Framework | React | 19.2.x |
| Language | TypeScript | 6.0.x |
| Styling | TailwindCSS | 4.x (via `@tailwindcss/vite`) |
| Package manager | pnpm | latest |
| Linting/formatting | Biome | latest |
| UI components | `@invana/ui` | GitHub `releases/ui` |
| App layouts + theme | `@invana/themes` | GitHub `releases/themes` |
| Design tokens/CSS | `@invana/styling` | GitHub `releases/styling` |
| Routing | React Router | v7 |
| Server state | TanStack Query | v5 |
| Client/UI state | Zustand | v5 |
| Icons | Lucide React | latest |

### File Structure

```
studio/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── biome.json
├── .env.example
└── src/
    ├── main.tsx                          # ThemeProvider → QueryClientProvider → RouterProvider
    ├── App.tsx                           # AppLayoutV2 shell + left nav
    ├── index.css                         # @invana/ui/styles.css + @invana/styling/themes/default.css
    ├── router.tsx                        # React Router v7 routes
    │
    ├── types/
    │   └── graphs.ts                     # GraphRead, GraphCreate, GraphUpdate, GraphStatus, CONNECTOR_CLASSES
    │
    ├── services/
    │   └── api/
    │       ├── client.ts                 # fetch wrapper reading VITE_API_BASE_URL
    │       └── graphs.ts                 # graphsApi.list/get/create/update/delete/reconnect
    │
    ├── hooks/
    │   └── queries/
    │       └── useGraphs.ts              # TanStack Query: useGraphsQuery, useGraphQuery, mutations
    │
    ├── stores/
    │   └── ui.store.ts                   # Zustand: activeNavItem, sidebarCollapsed
    │
    └── pages/
        └── graphs/
            ├── GraphsListPage.tsx        # Table: name, connector, URI, status, actions
            ├── GraphCreatePage.tsx       # GraphForm + useCreateGraphMutation
            ├── GraphEditPage.tsx         # useGraphQuery pre-populate + useUpdateGraphMutation
            └── components/
                ├── GraphForm.tsx         # Shared form: Input, Select, Switch, auth fields
                └── GraphStatusBadge.tsx  # Badge: CONNECTING | ACTIVE | ERROR | INACTIVE → color
```

### Routing

```
/                     → redirect → /graphs
/graphs               → GraphsListPage
/graphs/new           → GraphCreatePage
/graphs/:id/edit      → GraphEditPage
```

### Data Model

Types mirror the engine's Pydantic schemas exactly:

```ts
type GraphStatus = "CONNECTING" | "ACTIVE" | "ERROR" | "INACTIVE";

const CONNECTOR_CLASSES = [
  "neo4j",
  "memgraph",
  "arcadedb",
  "janusgraph",
  "neptune",
  "tinkergraph",
] as const;

type ConnectorClass = typeof CONNECTOR_CLASSES[number];

interface GraphRead {
  id: string;
  name: string;
  description: string | null;
  uri: string;
  connector_class: ConnectorClass;
  read_only: boolean;
  status: GraphStatus;
  last_health_check_at: string | null;
  latency_ms: number | null;
  schema_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GraphCreate {
  name: string;
  description?: string;
  uri: string;
  connector_class: ConnectorClass;
  auth: { username: string; password: string };
  read_only: boolean;
}

interface GraphUpdate {
  name?: string;
  description?: string;
  uri?: string;
  auth?: { username: string; password: string };
  read_only?: boolean;
  // connector_class is intentionally excluded — immutable after creation
}
```

### API Surface (consumed, not defined here)

Engine endpoints consumed by Studio (all defined in RFC-008):

```
GET    /api/v1/graphs              → GraphRead[]
POST   /api/v1/graphs              → GraphRead  (201)
GET    /api/v1/graphs/:id          → GraphRead
PATCH  /api/v1/graphs/:id          → GraphRead
DELETE /api/v1/graphs/:id          → 204
POST   /api/v1/graphs/:id/reconnect → GraphRead
```

Base URL read from `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8200`).

### API Client

`src/services/api/client.ts` — thin fetch wrapper:

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T>
// on 204: return undefined
// on non-2xx: throw ApiError { status, message }
// no auth headers in v1 (JWT deferred)
```

`src/services/api/graphs.ts` — named functions wrapping `request`:

```ts
list()              → GET  /api/v1/graphs
get(id)             → GET  /api/v1/graphs/:id
create(data)        → POST /api/v1/graphs
update(id, data)    → PATCH /api/v1/graphs/:id
remove(id)          → DELETE /api/v1/graphs/:id
reconnect(id)       → POST /api/v1/graphs/:id/reconnect
```

### State Management

**Server state** — TanStack Query v5 (`src/hooks/queries/useGraphs.ts`):

| Hook | Query key | Notes |
|---|---|---|
| `useGraphsQuery()` | `["graphs"]` | stale after 30s; conditional polling — `refetchInterval: hasConnecting ? 5000 : false` |
| `useGraphQuery(id)` | `["graphs", id]` | fetches single graph |
| `useCreateGraphMutation()` | — | invalidates `["graphs"]` on success |
| `useUpdateGraphMutation()` | — | invalidates `["graphs"]` + `["graphs", id]` on success |
| `useDeleteGraphMutation()` | — | invalidates `["graphs"]` on success |
| `useReconnectGraphMutation()` | — | invalidates `["graphs", id]` + `["graphs"]` on success |

`hasConnecting` = any graph in the list currently has `status === "CONNECTING"`. This means
the list auto-refreshes every 5s only while connections are being established, then stops.

**Client/UI state** — Zustand (`src/stores/ui.store.ts`):

```ts
interface UIState {
  activeNavItem: string;
  setActiveNavItem: (item: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}
```

### Application Shell

The root is `AppLayoutV2` from `@invana/themes`:

- **Left icon rail** (`leftNav`) — icon nav items: Graphs (active), Explorer (placeholder,
  disabled), Modeller (placeholder, disabled). Clicking navigates via `react-router-dom`.
- **Header** — app name/logo on left, `ThemeToggle` (dark/light) on right.
- **Main content area** — renders the active route page via `<Outlet />`.

`ThemeProvider` wraps the entire app, persisting theme to `localStorage` key `invana-theme`.

### Studio UI

**GraphsListPage** (`/graphs`):
- `@invana/ui` `Table` with columns: Name, Connector, URI, Status (`GraphStatusBadge`), Latency, Last Health Check
- Row actions via `DropdownMenu`: Edit, Reconnect, Delete
- Delete triggers a `Dialog` confirmation before calling `useDeleteGraphMutation`
- Empty state with call-to-action "Connect your first graph database" → `/graphs/new`
- Page header: title + "New Connection" `Button` → `/graphs/new`
- Status badge auto-updates via conditional polling (no manual refresh needed)

**GraphForm** (shared by Create + Edit):
Fields using `@invana/ui` `Form`, `Input`, `Select`, `Switch`:

| Field | Type | Notes |
|---|---|---|
| Name | `Input` | required |
| Description | `Textarea` | optional |
| URI | `Input` | required, e.g. `bolt://localhost:7687` |
| Connector Class | `Select` | required; disabled in Edit mode |
| Username | `Input` | maps to `auth.username` |
| Password | `Input` type=password | maps to `auth.password` |
| Read Only | `Switch` | defaults false |

**GraphCreatePage** (`/graphs/new`):
- `GraphForm` with empty initial values
- On submit: `useCreateGraphMutation` → success: navigate `/graphs` + toast; error: show toast

**GraphEditPage** (`/graphs/:id/edit`):
- Fetches graph via `useGraphQuery(id)` — shows `Skeleton` while loading
- `GraphForm` pre-populated; Connector Class field shown but disabled (immutable)
- On submit: `useUpdateGraphMutation` → success: navigate `/graphs` + toast; error: show toast

**GraphStatusBadge**:

| Status | Badge variant | Label |
|---|---|---|
| `ACTIVE` | green | Active |
| `CONNECTING` | yellow | Connecting |
| `ERROR` | red | Error |
| `INACTIVE` | gray | Inactive |

### Storage

No new storage. Studio is stateless — all data lives in the engine's app-state database.
`localStorage` is used only for theme preference (managed by `ThemeProvider`).

### Dependencies

- Depends on **RFC-008** (Graphs & Query API) for all backend endpoints.
- Introduces `@invana/design-kit` packages (`@invana/ui`, `@invana/themes`, `@invana/styling`)
  installed from GitHub release branches (not npm).

---

## Alternatives Considered

| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|
| Plain `useState` (like archived MVP) | Simple, no extra deps | Doesn't scale; no caching, deduplication, or optimistic updates | CLAUDE.md mandates Zustand + TanStack Query |
| Custom UI components | Full control | Duplicates work already in `@invana/design-kit` | CLAUDE.md Rule 9: use `@invana/design-kit` exclusively |
| TanStack Router | Type-safe file-based routing | Unfamiliar, larger surface area | React Router v7 used in archived reference |
| Always-on polling (fixed 30s) | Simple | Unnecessary traffic when nothing is connecting | Option A (conditional) is equally simple with `refetchInterval` |
| Mock API / local state only | No engine dependency for dev | Hides integration bugs early | User decision: wire to real engine API |

---

## Security Considerations

- Password field uses `type="password"` — never displayed in plaintext.
- Auth credentials sent over HTTPS in production (HTTP only for local dev on localhost).
- `auth_encrypted` is never returned by the engine (`GraphRead` excludes it) — no credential
  leak in list/get responses.
- `VITE_API_BASE_URL` is a build-time env var — not a runtime secret; safe to expose in bundle.
- `ApiError` captures only `status` + `message` — raw engine stack traces never surfaced in UI.
- No JWT / auth headers in v1; authentication deferred to a later RFC.

---

## Performance Considerations

- TanStack Query provides background refetch, request deduplication, and stale-while-revalidate
  — no manual polling management needed beyond the `refetchInterval` conditional.
- `@invana/ui` and `@invana/themes` pre-bundled via `vite.config.ts` `optimizeDeps.include`
  to avoid slow cold-start HMR (known pattern from archived reference).
- Conditional polling stops automatically once all graphs reach a terminal status, keeping
  network traffic minimal in steady state.

---

## Implementation Plan

1. [ ] Phase 1 — Scaffold: `package.json`, `vite.config.ts`, `tsconfig.json`, `biome.json`,
       `index.html`, `.env.example`
2. [ ] Phase 2 — App shell: `index.css`, `main.tsx`, `router.tsx`, `App.tsx` (AppLayoutV2 + left nav)
3. [ ] Phase 3a — Types + API client: `types/graphs.ts`, `services/api/client.ts`,
       `services/api/graphs.ts`
4. [ ] Phase 3b — State layer: `hooks/queries/useGraphs.ts` (with conditional polling),
       `stores/ui.store.ts` *(parallel with 3a)*
5. [ ] Phase 4 — Graphs feature: `GraphStatusBadge`, `GraphForm`, `GraphsListPage`,
       `GraphCreatePage`, `GraphEditPage`
6. [ ] Phase 5 — Changeset entry + verify: `pnpm dev`, `pnpm build`, `pnpm lint`,
       end-to-end CRUD test against running engine

---

## References

- [RFC-008: Graphs & Query API](008-graphs-query-api.md)
- [`@invana/design-kit` repository](https://github.com/invana/design-kit)
- Archived reference: `invana-mvp-2026/ui/apps/studio/`
- [TanStack Query v5 — `refetchInterval`](https://tanstack.com/query/v5/docs/framework/react/reference/useQuery)
- [Zustand v5 docs](https://zustand.docs.pmnd.rs/)
