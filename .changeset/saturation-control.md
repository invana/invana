---
"studio": minor
---

Add a **Saturation** slider to the theme picker (RFC-044 follow-up). A single control — in the header theme popover and the settings Appearance tab — scales the active theme's primary and accent colours from 0% (greyed) through 100% (the theme as authored) to 200% (twice as saturated, clamped at the HSL ceiling), with a Reset back to 100%.

The value is applied live by a new `SaturationBridge`: it scales only the S channel of each theme's HSL primary/ring/accent custom properties and writes the result as inline overrides on `<html>` (which beat the `[data-theme]` rules), re-applying on every theme/mode change via a `data-theme` MutationObserver. The preference is stored locally (`invana.appearance`) — a per-device visual tweak, not synced to the profile like the theme selection.
