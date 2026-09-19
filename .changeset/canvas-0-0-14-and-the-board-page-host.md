---
"invana": minor
---

Studio is on canvas `0.0.14`, and the page host is `BoardPagesViewPanel`.

The tab strip in `mainSection` hosts boards, and a board is not always drawn —
a run dashboard is panels bound to one record, with no camera and no layers. So
`@invana/canvas-ui` renamed the host, and Studio now calls it what it is:
`BoardPagesViewPanel`, with `BoardPage` · `BoardHeaderAction` in place of the
`Canvas*` names. The renderer keeps the word canvas, here and there.

The bump carries the rest of two canvas releases with it — a graph that arrives
(auto-fit sequencing, per-item effects and an entrance behaviour), effective
visibility decided inside the store, and the composite node types refiled from
`cards/` to `nodes/composite/` with four more of them.

All ten `@invana/*` canvas packages move `0.0.12` → `0.0.14` together; they are
released in lockstep and mixing versions across them is not supported.
