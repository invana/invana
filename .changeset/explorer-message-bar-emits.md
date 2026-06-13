---
"studio": patch
---

Explorer: actually surface messages in the footer `CanvasMessageBar`.

The message bar was wired into the footer but never displayed anything, because
nothing in the Explorer pushed to the canvas message channel (the component
renders nothing while idle). It now emits on the flows users actually trigger:

- **Query runs** — `AutoLayoutBridge` shows "Laying out N nodes…" while the
  layout settles, replaced by "Graph ready" (auto-clears after 3s). This fires
  automatically on every query, so the bar lights up without any extra action.
- **Header layout picker** — a sticky "Running X layout…" → "X layout ready".
- **Magnet toggle** — a transient hint when neighbour-highlighting flips.
