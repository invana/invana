---
"studio": patch
---

Modeller: guard the canvas toolbar/status bar against a torn-down engine.

The read-only canvas reuses the Explorer's header toolbar, whose view-section reads `camera.scale` (→ `viewport.scale.x`) on mount. If the lifted engine reference outlived its Pixi viewport — e.g. a dev Fast-Refresh-preserved instance caught mid-remount — that read threw `Cannot read properties of null (reading 'x')` and tripped the error boundary. The header toolbar and footer status/message bars now gate on `canvas.isInitialised`, so a destroyed engine never mounts camera-reading UI.
