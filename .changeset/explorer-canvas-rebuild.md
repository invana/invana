---
"studio": minor
---

Explorer: rebuild the graph visualiser on the full `@invana/canvas-react` surface.

The placeholder canvas (pan + wheel-zoom only) and its disabled toolbar stub are replaced with a complete read-capable visualiser. The canvas controls now live in the **app header** (center slot) as a data-driven toolbar: undo/redo history, a layout picker (Force · Layered ELK · Stress ELK) with Run + Re-render, select modes (click / brush / lasso), edge-routing styles, view (zoom in/out, fit, lock), a grid toggle, and a neighbour-highlight (magnet) toggle.

Nodes are coloured by label, query results auto-layout on every run, hover highlights neighbours, and right-click menus offer focus / select / highlight / fit / clear plus clipboard actions (cut / copy / paste / delete). Clicking a node or edge now feeds the right-side **Inspector** (its type, label, id, edge endpoints, and properties) — previously selection was never wired. Canvas colours follow Studio's light/dark theme. A minimap docks bottom-left.

The Modeller's schema canvas is unchanged (it keeps the shared minimal `GraphCanvas` wrapper). Adds the `@invana/graph-layout-elkjs` dependency for the ELK layout options.
