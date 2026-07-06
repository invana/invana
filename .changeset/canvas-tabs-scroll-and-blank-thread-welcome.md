---
"studio": patch
---

Explorer canvas tab bar and blank-session polish. The tab strip now **scrolls
horizontally** when many canvases are open instead of stretching and pushing the
right-side actions off-screen, the right-side actions (help · styling · find ·
inspector) stay **pinned**, and the **"+" new-canvas button** moves next to them
so it's always visible. Selecting or creating a canvas **scrolls its tab into
view** so a freshly-added tab isn't left clipped at the edge.

A fresh session's empty thread no longer shows a bare box: it now displays a
muted, vertically-centered helper that introduces what the session is for —
asking questions to explore the graph — and lists what you can do (query ·
expand · visualise · interact · run complex logic, the same capabilities as the
first-run tutorial modal), pointing you at the composer to get started.
