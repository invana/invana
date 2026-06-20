---
"studio": patch
---

Fix graph canvas failing to load in Safari + surface renderer capability.

Safari (and all iOS browsers) advertise a working WebGPU adapter, so the canvas defaulted to WebGPU and PixiJS 8 crashed during shader-program setup (`TypeError: null is not an object (evaluating 'program.layout[groupIndex]')`) — "Load to canvas" did nothing while Chrome worked fine. WebGPU is now treated as unusable on WebKit (the `requestAdapter()` probe can't catch this, since the adapter resolves), so Explorer and Modeller default to WebGL there and disable the WebGPU toggle.

A new capability banner overlays the canvas: an amber, dismissible notice when WebGPU is unavailable and we fall back to WebGL, and a destructive, non-dismissible notice when the browser supports neither WebGPU nor WebGL and the canvas can't render at all.
