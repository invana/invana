---
"invana": minor
"studio": minor
---

Session canvas enhancements (RFC-045): single Sessions sidebar, tutorial, per-type styling, banner screenshots.

Sessions is now the **one** primary Explorer sidebar list — the separate "Canvases"
panel/rail is removed, since a session's canvas is its 1:1 visual layer (painted
on open). A first-run **tutorial modal** (query · expand · visualise · interact ·
run complex logic) auto-shows once and is reopenable from a "?" in the canvas
header.

The 1:1 canvas gains **per node/edge-type styling** — colour, label property and
size (nodes) / width (edges), edited in a canvas **Styling** panel and applied
live by the renderer with a stable palette fallback — and a **banner**: a
downscaled PNG screenshot captured from the renderer on save and shown as a
preview. Both are new canvas columns (`styling` JSON, `banner` text; migration
`024`) exposed on the canvas API.
