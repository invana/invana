---
"studio": minor
---

Default the Explorer and Modeller canvases to WebGPU when the device supports it.

Both canvases now pick **WebGPU** as the default render backend, falling back to
**WebGL** when WebGPU isn't available (PixiJS also auto-falls-back at init). The
header **Renderer** toggle disables the WebGPU option on devices where no WebGPU
adapter resolves, so users can't select a backend that won't initialise. An
explicit user choice (persisted in localStorage) is still honoured, and a saved
WebGPU selection downgrades to WebGL if the adapter later turns out unusable.
