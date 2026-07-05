# RFC-044: Rich theming — theme catalog, mode, accent, profile-synced

**Status**: Accepted (implemented)
**Author**: Invana Team
**Date**: 2026-07-06
**Related**:
- **RFC-017** (Graph as primary container) — user-level `/api/v1/auth/me` is the
  persistence surface reused here.
- **RFC-034** (auth identifier) — same `PATCH /auth/me` route extended.

## Problem

Studio only exposed a bare light/dark toggle (`ThemeToggle`), even though
`@invana/styling` already ships a full theme catalog (the `default` Invana theme
plus `tailwind`, `vite`, and the presets `gold` / `ocean` / `forest` / `rose` /
`minimal`, each with light/dark/system variants) and `@invana/themes` exposes a
`ThemeProvider` that can drive theme + mode + a scoped **accent**. None of that
richness was surfaced, and the one bit of state that was (light/dark) lived only
in browser localStorage, so it didn't follow a user across devices.

## Decision

Surface the full picker and make the selection a **per-user profile preference**.

### 1. Package bump — `@invana/*` 0.0.11 → 0.0.12

`ThemeSelector`, `ThemeScope`, `ThemeSettingsCard`, and the accent API land in
`@invana/themes@0.0.12`. Its peers pin `@invana/styling` and `@invana/ui` to the
same version, and `@invana/forms@0.0.12` pins them too — so all four
(`themes`, `styling`, `ui`, `forms`) move to `^0.0.12` together. Studio's
`index.css` additionally imports `themes/presets-base.css` + `themes/presets.css`
so the preset themes have colours (the active `[data-theme]` block always wins
over the base `@theme` defaults).

### 2. Persistence — a `preferences` bag on `User`

A single free-form `users.preferences` JSON column (not per-field columns), so
future UI prefs don't each need a migration. The theme selection lives under
`preferences.theme` as `{ theme, mode, accent }` (`accent === null` → the theme's
own signature accent). Exposed on `UserOut`; written via a **validated** `theme`
field on `MePatchRequest` (mode constrained to `light|dark|system`) that
`patch_me` shallow-merges into the bag. Migration `000000000022` adds the column
with `server_default '{}'`, then drops the default so the ORM owns new inserts.

### 3. Sync model — live apply, live sync (no manual "Save")

The `ThemeProvider` keeps its localStorage persistence (instant restore,
works pre-login). One app-level `<ThemeSyncBridge>` reconciles with the server:

- **Hydrate** — the first time a signed-in user is known, if `preferences.theme`
  is set it's applied to the provider (server is source-of-truth on login; the
  local pre-login selection is only a fallback).
- **Persist** — after hydration, any live change is `PATCH`ed to `/auth/me` and
  the returned user written back to the auth store. A `lastSynced` guard prevents
  echoing a just-hydrated value back to the server.

Because both entry points (header + settings) drive the *same* provider, the
bridge covers persistence once — no per-widget save wiring.

**Chosen: apply-live everywhere over the `ThemeSettingsCard` Save/Reset flow.**
A manual "Save as default" in settings would be inconsistent with the header
picker (which applies instantly) under one shared provider — mixing a
`persist="manual"` island with a live header is confusing. Live-everywhere
matches how editors/OSes handle theme.

### 4. Surfaces

- **Header** — `ThemeMenu`: an icon button opening a popover with the full
  `<ThemeSelector layout="form">` (theme cards + mode + accent). Replaces
  `ThemeToggle` in the app header. The login page keeps `ThemeToggle` (pre-auth,
  nothing to sync).
- **Settings** — an **Appearance** tab in `ProfileSettingsPage` wrapping the same
  `<ThemeSelector layout="form">`.

## Out of scope / deferred

- Per-graph or per-workspace theming — this is per-user only.
- Custom user-authored themes / accent values beyond `DEFAULT_ACCENTS`.

## Canvas retinting

The Explorer/Modeller canvases paint to a PixiJS surface, so they can't use
Tailwind classes — their colours are pushed to the engine as concrete values.
Rather than one hardcoded palette, `readCanvasThemeConfig()` reads the *active*
theme's standard CSS tokens (`--color-background`, `--color-foreground`,
`--color-muted-foreground`, `--color-border`, `--color-card`, `--color-primary`)
at runtime and maps them to background / grid / node-label / edge / minimap /
viewport. Every studio theme (default, tailwind, vite, and the presets) defines
that token set, so it works uniformly. The canvases' `<ThemeBridge>` re-reads on
any `variantId`/`isDark` change, deferred one frame (via `requestAnimationFrame`)
so it runs *after* the `ThemeProvider` has applied the theme class to
`document.documentElement`. Tokens are authored as `hsl(...)`, which
`cssColorToNumber` can't parse, so a hidden probe element resolves `var(--token)`
to `rgb(...)` first.

Node *fill* colours are unchanged: query results are coloured by label via
`ColorByLabelBehaviour`, and the Modeller's authoring nodes keep the brand green.
