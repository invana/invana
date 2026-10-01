---
"studio": patch
---

The Layers card is canvas-ui's `LayersViewPanel`. It lists groups and gives each group its own eyes, and it drops the Refresh button because it follows the canvas live. Hiding is now the canvas's own flag, so hiding a type from the Explorer panel flips that type's eye and mutes its rows in Layers. Before, the eye never changed and Layers never noticed.
