---
"invana": patch
---

Govern is a rail item over two drawers, and the ceiling is on screen while you pick (GV17 · GV25).

`?panel=govern` is its own `leftNav` item — not a tab of Graph settings — holding `Worlds` over
`Guardrails` as one `PanelStack`. Both drawers read **one** query split by `kind`, because a
guardrail and a world are one record (GV1); a second endpoint would be the second enforcement path
this module exists not to have.

| Route | Opens |
|---|---|
| `?panel=govern` | the worlds list, with the guardrails locked above it |
| `?panel=govern&drawer=worlds&world=<id>` | that world, read as one object — five layer bands, the slices, the cast |
| `?panel=govern&drawer=guardrails` | the guardrails in force |
| `?panel=govern&drawer=guardrails&guardrail=<id>` | its rules, grouped by layer, with what may be sent |

**A guardrail can now be read.** It is in force on every run whatever world is chosen, so the strip
above the worlds list offers nothing selectable — it names the layers the guardrails narrow and how
many rules each holds, and its one control is the way down to the drawer that holds them. A bound
nobody may read is a bound nobody can work within
([GR5](../docs/for-developers/modules/govern/features/guardrails.md)).

Read-only. Authoring is W3 · G2 and is not built; every control that would write is absent rather
than disabled, so nothing promises a screen that does not exist.

**Studio now loads the categorical data palette.** The import sat commented behind a `TODO` naming
`@invana/styling` 0.0.21 and Studio has been on 0.0.28 for some time, so every `bg-data-*` swatch
rendered transparent — six layer chips that exist to be told apart at a glance were six identical
grey labels, and the Explorer's type dots were neutral rather than coloured. The whole eight-slot
scale is named once in `studio/src/index.css`, because Tailwind 4 emits a theme variable only where
it sees a utility reading it and the classes that read these live in `@invana/ui`'s precompiled CSS.

The nine `/govern/*` routes had never been called over HTTP before this; drawing the panel is what
exercised the auth hop.
