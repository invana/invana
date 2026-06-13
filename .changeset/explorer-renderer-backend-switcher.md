---
"studio": minor
---

Add a WebGL/WebGPU renderer switcher to the Explorer canvas.

The Explorer header toolbar now has a **Renderer** toggle group to switch the
PixiJS backend between **WebGL** and **WebGPU** at runtime. The choice persists
across reloads (localStorage) and remounts the canvas so the renderer re-inits
with the selected backend.

The default is **WebGL**: the WebGPU backend intermittently crashes in PixiJS 8's
bind-group setup (`BindGroupSystem._createBindGroup`, null `gpuProgram.layout`)
on some GPUs/drivers, independent of graph size. WebGL is offered as the safe
default with WebGPU available for machines whose drivers handle it.
