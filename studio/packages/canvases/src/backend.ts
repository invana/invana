/**
 * The PixiJS render backend every canvas kind draws with.
 *
 * Explorer defaults to `"webgpu"` when the browser can use it (`canUseWebGPU` —
 * WebGPU API present and not WebKit, where PixiJS WebGPU crashes), else
 * `"webgl"`. The header switcher flips between them at runtime, and the model
 * canvases draw with whichever the page picked.
 */
export type CanvasBackend = "webgl" | "webgpu";
