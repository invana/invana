---
"studio": patch
---

Sessions panel reads bottom-up: newest at the bottom, history above.

Both views in the Sessions panel ran newest-first, against the direction the thread they sit above reads.

The **session list** now puts the most recent session in the row nearest the composer, with older sessions running upwards and the `MORE` expander — which reveals older sessions — heading the list instead of tailing it. A short list grows off the bottom edge and hugs the composer rather than stranding the newest session mid-panel. The view parks at the bottom on open and follows the canvas banners (docs/for-developers/modules/explore/features/graph-canvas.md) as they resolve and grow the bottom rows, unless you've scrolled up to read history.

The **Tasks tab** lists turns in the order they happened — oldest at the top, latest at the bottom — on the same `ChatSession` scroll surface as the thread. Turns still running or waiting on you sort to the bottom, next to where the view sits.
