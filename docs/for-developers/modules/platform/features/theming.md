# Theming

Light and dark as equals, across every surface, at every density the app uses. Colour carries meaning
once, defined in one place.

| | |
|---|---|
| Index | [13.2](../../../README.md#13--platform) |
| Module | [Platform](../spec.md) |
| API / CLI / Studio | — / — / ✅ |
| Related | [design-system](design-system.md) · [graph-canvas](../../explore/features/graph-canvas.md) |

Product spec: [SH-07 · Make the frame work my way](../../../../../specs/foundation/shell/features/SH-F03-find-your-way/stories/SH-07-make-the-frame-work-my-way/story.md) — light and dark, the person's choice, the canvas following the theme and the rules a person sees live in SH-F03. This file keeps the build rules for theme variants, density and radius.

## Capabilities

| # | Capability | Notes |
|---|---|---|
| C2 | Theme variants | Palettes beyond the default two |
| C3 | Density | Dense inspectors and airy forms use the same components at different sizes |
| C4 | Structure square, controls slightly round | One control radius token; zero elsewhere |

## Seams

| Seam | What the user sees |
|---|---|
| A canvas mid-render | Colours resolve on the next frame; nothing redraws from scratch |
| A theme variant missing a token | Falls back to the default's token rather than rendering unstyled |

## Decisions

| # | Decision |
|---|---|
| TH2 | One radius token for controls; structure is square. |
