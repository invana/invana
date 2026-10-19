---
"invana": patch
---

A large result on the Explorer's canvas is readable: nodes never overlap, hubs draw bigger, and the wait for the layout is said.

- **Spacing.** Each node keeps clear space for its label, sized from its own radius, and the layout runs long enough for that space to hold across ~2,000 nodes.
- **Size by connections.** A new toggle on the board toolbar, on by default, sizes each node by its connection count. Flipping it re-lays the graph.
- **Layout progress.** The footer counts the off-screen solve (*Laying out 2159 nodes · 80 / 149*). A solve still going after 400 ms also raises a toast with *Cancel*, which draws the nodes where they are.
- **Dense edges.** Edges draw fainter as their count grows; past 500 relationships and zoomed out below 50%, about 1 in 10 are drawn, and the footer says so. Zooming in draws them all. Hovered, selected and highlighted edges stay solid.
- **Linked dev servers.** With `INVANA_CANVAS` or `INVANA_DESIGN_KIT` set, Vite now serves the linked checkouts. The force layout's Web Worker was refused before, so every solve ran on the main thread and froze the page.
