# Model editor

Draw the model. The canvas draws it; the bar over the canvas writes it, and every change stages until
it is committed together.

| | |
|---|---|
| Index | [1.4](../../../README.md#1--connect-and-model) · Slice **S3** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [domain-models](domain-models.md) · [graph-canvas](../../explore/features/graph-canvas.md) · [selection-and-the-panel](../../explore/features/selection-and-the-panel.md) |

> **As** someone authoring a model, **I want** to draw types and connect them and see the whole shape,
> **so that** I am designing a structure rather than filling in a form.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C1 | Add a node type from the canvas | **Node type** on the bar over the canvas, or the drawer's `+` — one form (ME8) |
| C2 | Connect two types into an edge type | **Edge type** on the bar; the form names the source and target |
| C3 | Delete, staged | Nothing leaves until the commit |
| C4 | Every change stages | The staged set is listed, counted and reversible before it lands |
| C5 | Commit publishes | One action turns the staged set into the next version |
| C6 | Published versions are pan-and-zoom only | Read-only, with no accidental edits |
| C7 | The panel edits what the canvas selects | Properties, keys and constraints in the panel, never in a modal over the drawing |

## Journey

```mermaid
flowchart TD
    A[Open a draft] --> B[Node type · Edge type · Delete from the bar and the form]
    B --> C[Each change joins the staged set]
    C --> D[Staged bar: 6 staged · what they are]
    D --> E{Commit?}
    E -->|discard one| B
    E -->|discard all| F[Draft back to its last state]
    E -->|commit| G[New published version]
    G --> H[Canvas switches to read-only for that version]
```

## Seams

| Seam | What the user sees |
|---|---|
| Nothing staged | The commit action says there is nothing to commit |
| A staged delete with dependents | Named dependents, before the commit, not after |
| Two people on one draft | Single editor at a time; the second sees it read-only with who holds it |
| Leaving mid-edit | The staged set survives; it is part of the draft, not of the session |
| Opening a model | The drawing is laid out and fitted before the first frame — it never drifts into place |
| A section with nothing in it | Its header still reads, with a `0`, and its body says what would go there (ME14) |
| Switching model mid-edit | `Models` in the crumb, then the row. The staged set stays with the draft it belongs to |
| Nothing selected yet | The model list fills the column, with `New` and `Import` on the panel header (ME17) |
| A type is selected | The panel row marks it; the type itself reads in the main column beneath the canvas (ME6, ME19) |
| A long type list | It scrolls inside its own drawer. Edge types, Stitches and Staged keep their headers on screen (ME13) |

## Surfaces

| Surface | Shape |
|---|---|
| Canvas (`kind = model`) | [`GraphModelCanvas`](../../../building-studio/graph-model-canvas.md) — the model as one frame, its types inside, its edge types between them. Detail, Layout, Settings and the theme toggle ride its header (ME26) |
| Panel | Two views (ME17). The **list** of models, or one model's **detail**: a `PanelStack` of four drawers — Node types · Edge types · Stitches · Staged (ME13), under a `Models › <name>` crumb row carrying the version readout, over the staged bar. Neither row scrolls |
| Staged bar | Count, the list, discard-one, discard-all, commit — `⌘↵` commits |
| Type detail | In the **main column**, beneath the canvas: the selected type's properties, with add and remove while drafting, and its constraints (ME19) |
| Version bar | `v2 · draft` beside `v1 · active`; `Publish v2` sits on the header, disabled with its reason when nothing is staged |
| Type form | The selection's form in the main column — name, parent, abstract, instance count, validation, and the property table with cardinality and constraint |
| Property keys | In the **main column**: the version's keys, with the types each is mapped onto (ME19) |

## Engine

| Thing | Shape |
|---|---|
| Draft state | the staged set, stored with the draft, not client-side |
| Commit | validates the whole staged set, then publishes one version |
| Routes | `…/models/{id}/draft*` · `POST …/models/{id}/commit` |
| Events | `model.staged · unstaged · committed` |

## Decisions

| # | Decision |
|---|---|
| ME1 | **The model canvas draws; the bar over it writes.** Adding a node type, adding an edge type and deleting are the only three writes, and none of them is a canvas gesture — the canvas is the shared model canvas and carries only its own behaviours (ME26). |
| ME2 | Everything stages; nothing reaches a version until a commit. |
| ME3 | A published version's canvas is read-only. |
| ME4 | The staged set lives with the draft, so it survives a reload and is visible to anyone opening it. |
| ME5 | Staged rows sort first in every type list, each carrying a `staged` chip, so what is about to land reads before what already has. |
| ME6 | The selected type is edited in a form that spans the main column beneath the canvas — never in a modal over the drawing. |
| ME7 | A run stages onto the same draft as a gesture does. There is one staged set and one commit, whoever wrote it. |
| ME8 | A type is added from **either** side — the section's `add` in the panel, or **Node type** on the bar over the canvas — and both open the same form. Two affordances, one path. |
| ME9 | A delete is confirmed as *staging* a delete, not as deleting. "Gone" and "gone when you commit" are different promises, and the confirm makes which one it is unmistakable. |
| ME10 | The compatibility banner lives on the model panel, because that is the surface whose saves the server would refuse. A warning shown where nothing is being written is a warning nobody reads. |
| ME11 | **Selection is idempotent both ways.** A click announces `{ kind, id }` from `ClickSelectBehaviour`'s `selection:change`, and the canvas drops an announcement naming the selection it already draws; the page drops a write naming the selection it already holds. The panel selects by name and the canvas by id, and `ModelCanvas` maps one to the other. |
| ME12 | **The model canvas lays out as the global model does.** ELK by default, d3-force from the Layout switch, and each run glides the camera with the nodes (`fitCamera`) — one behaviour for both modeller canvases ([GM3 · GM10](../../../building-studio/graph-model-canvas.md#decisions)). |
| ME22 | **The drawing is spaced for the Detail level it is drawn at.** Each level's template carries the ELK spacing and force distances its node size needs — circles, cards or schema cards — so switching Detail re-runs the layout with room for what is now drawn ([GM4](../../../building-studio/graph-model-canvas.md#decisions)). |
| ME23 | **The camera fits every run, gliding with the nodes.** A model opens framed, and a Detail or Layout switch reframes it; the reader's zoom holds between runs. |
| ME24 | **Every run is started by the canvas, not by the engine's auto-run.** `activeLayout` alone does not lay out a graph seeded before the layout registers, so `GraphModelCanvas` runs the active layout itself whenever its data, Detail, Layout or theme changes. |
| ME25 | **The drawing is redrawn when a solve ends.** A solve that lands in the same beat as the data flush leaves the viewport empty while the store holds the types, so `layout:run:end` calls the layer's `redraw()` — a pure render pass over what the store already holds. |
| ME26 | **The model canvas is the global model canvas, with one model in it.** `ModelCanvas` builds its version (the draft while one is open) with `buildAllModelsData` — one frame, its types, its edge types — and draws it on [`GraphModelCanvas`](../../../building-studio/graph-model-canvas.md), the same component *All models* uses. No behaviour is added for authoring; the old tool-driven schema canvas is gone. Two modeller canvases that drew one model two ways were two things to learn. |
| ME26 | **A model's board is named for the model.** The tab reads `AirRoutes`, never `Model` — the rule a lens board already follows (WO15). Two models open side by side put two tabs on the strip, and a strip reading `Model · Model` is one a reader has to click through. The name comes off the models list the panel has already read, so it costs no request; until it lands the tab falls back to the kind's label rather than to an empty one. Drilling into a model in the panel is what opens the board, so the detail and the drawing arrive together. |
| ME13 | The panel is a **stack of drawers**, not a scroll of sections. Every section's header stays on screen — `Models / <name>`, Node types, Edge types, Stitches, Staged — each collapsing to its header on its own, the open ones sharing the column with draggable dividers (`PanelStack`). The header is the thing that is always readable, and the count sits in it, so a thirty-type model never buries Edge types, Stitches or Staged below one shared fold. |
| ME14 | **Every drawer is always present.** A section with nothing in it says so in its body rather than disappearing — `Staged 0`, *Select a type on the canvas*. A stack whose sections come and go re-lays-out under the reader and discards the sizes they dragged, and a header that vanishes when its subject empties is a header nobody can learn the position of. |
| ME15 | **The model drawer, Node types and Edge types open; the rest arrive closed.** The two type lists are what the panel exists for and what the hi-fi draws; above them the drilled `Models / <name>` drawer holds a fixed 160px, because what it carries — the description line, the version ladder, and anything standing in the way of a write — does not grow with the model. Stitches and Staged are a run of closed headers beneath them, one click from open. Five open sections in a 420px column give each one a couple of visible rows, which is the fold problem again in a new shape. |
| ME16 | The open/closed state is **not** a decision the section makes. `defaultCollapsed` applies once, at mount; nothing re-opens a section because its contents arrived — a panel that opens drawers by itself moves the thing the reader was looking at. |
| ME17 | **The panel is the stack — there is no chrome above it.** The first drawer header is the top of the column (G33), and the breadcrumb over the panel already answers *where am I* (G16). What a panel header used to carry acts on a list, so it acts from that list's own header: `New model`, `Import`, `All models`, `Refresh` and `Search` on **Models**, `+ add` on **Node types** and **Edge types**, `Declare a stitch` on **Stitches** — every create CTA in the section that owns it (G3). The panel takes no close control: the rail icon that opened it closes it. |
| ME18 | **The model list and a model's detail are two views, and the first drawer is the seam.** The panel shows the list until a model is picked; then the Models drawer is **drilled in** — its header reads `MODELS / Observations` and its body is what that model *is* (ME21) — and the type drawers take the rest of the column. The trail is text and the way back is a `‹` in the header's action slot: a `PanelStack` header **is** the collapse button, so a crumb drawn there as a link would nest one interactive element in another and steal the collapse click. |
| ME19 | **The panel lists; the main column reads.** The rail carries the type lists and what is staged — never a second copy of the selected type or of the version's property keys. A type reads in the main column beneath the canvas, where the full form has room (ME6); a 300px drawer showing the same thing in miniature is a second place to look for one answer, and the one with less room always loses. |
| ME20 | **A property key is authored on the type that carries it**, in `PropertyEditor`: naming a property creates the key when no key of that name exists, and reuses it when one does. There is no separate *define a key first* step, because a key nothing maps to is a key nobody asked for. The key stays global to the version — this is where it is *declared*, not where it is *scoped*. |
| ME21 | **A model's own metadata reads on one line, with `More` for the rest.** The panel's column belongs to the type lists (ME13/ME15), so the model's description, validation mode, origin, status, version and dates cannot each take a row. The description — the one field a person scans — reads truncated to a single line in the drilled drawer's body; `More` expands the rest as a `PropertyList` and `Less` puts it back. The version chips (`VersionBar`) are the `Version` row's value rather than a row of their own — two chips that change once per publish do not earn the full width of the rail. The compatibility banner (ME10) and the *published — open a draft* notice (ME11) sit under it in the same drawer: both are about the model and the version open on it, not about one type. Collapsed height is constant across models, so switching models never moves the drawers. There is no author row: `GraphModel` records no creator, and a row that always said `—` is worse than no row. |

## Deprecated surfaces

Unreachable code, kept in the tree until a clean-up pass removes it. Nothing imports these; do
not wire them back in.

| File (under `studio/src/pages/graphs-detail/features/connect-and-model/model/components/`) | Went dead when | What does it now |
|---|---|---|
| `DetailPanel.tsx` | the right-side details panel was dropped (`6c9c8eca`) | `ModelCanvas` renders `NodeTypeDetail` / `EdgeTypeDetail` in the main column (ME19) |
| `ModelOverview.tsx` | with `DetailPanel` | `ModelMetaLine` on the model's own panel (ME21), and `ModelFormDialog` for editing |
| `NoSelectionPlaceholder.tsx` | with `DetailPanel` | each surface states its own empty state |
| `PropertyKeyTable.tsx` | with `DetailPanel` | `PropertyEditor`, on the type that carries the key (ME20) |
| `PropertyKeyFormDialog.tsx` | with `PropertyKeyTable` | `PropertyEditor` creates the key inline (ME20) |

## Not building

| Not building | Because |
|---|---|
| Freehand layout saved per type | layout is a view, not part of the model |
| Multi-user live editing | single editor with a visible holder is honest at this scale |
| Auto-layout that rewrites positions on open | a model you arranged should stay arranged |
| Writing from a canvas gesture — drag-to-connect, add on the canvas, a context menu | ME1 · ME26. The canvas is the global model canvas; the bar over it and the type form write |
