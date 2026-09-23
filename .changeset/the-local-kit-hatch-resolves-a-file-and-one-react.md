---
"invana": patch
---

The local-kit hatch resolves a file, and one React (DS10 · DS11).

`INVANA_DESIGN_KIT=../../design-kit pnpm dev` did not start. Two faults, both in
`studio/vite.config.ts`:

| Fault | Why |
|---|---|
| `EISDIR` on the first `@import` | `@invana/styling` aliased to the `src` **folder**. A Vite alias is a prefix rewrite, not a resolver — it never consults the package's `exports`, so the bare specifier handed Tailwind a directory. The bare id now names `src/index.css`, with `themes` and `themes.config` keeping their own entries above it |
| *Invalid hook call* in every kit component | a linked checkout resolves `react` from its own `node_modules`. `react` and `react-dom` join `pixi.js` in `resolve.dedupe`, which is a no-op with no hatch open |

The hatch is the supported way to see an unreleased component (DS10), and it is how the Govern
panel was drawn against a live Graph without spending a `@invana/*` release first.
