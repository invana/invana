---
"invana": minor
"studio": minor
---

Rich theming (RFC-044). Studio's bare light/dark toggle is replaced with a full
theme picker — the Invana theme plus Gold / Ocean / Forest / Rose / Minimal
presets, a light/dark/system mode, and accent swatches — surfaced from a header
popover (`ThemeMenu`) and a new **Appearance** tab in account settings. Changes
apply live and are saved to the user's profile so the selection follows them
across devices.

Engine: adds a free-form `users.preferences` JSON column (migration
`000000000022`); `PATCH /auth/me` accepts a validated `theme` selection
(`{theme, mode, accent}`) merged under `preferences.theme`, and `GET /auth/me`
returns the `preferences` bag. Bumps `@invana/themes|styling|ui|forms` to 0.0.12.
