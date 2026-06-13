---
"invana": patch
---

Fix database introspection ("Refresh from DB") silently doing nothing — and the
global model never picking up edge types — when a stale draft version was left
behind by a prior interrupted introspect. `create_version` refuses to create a
second draft, and `_auto_introspect` swallowed the resulting error, so every
subsequent refresh was a no-op and the UI kept showing the old draft (node types
but no edges). The introspected `global` model is fully rebuilt on each run, so
`Introspector.introspect` now discards any leftover draft first
(`ModelStore.delete_draft_versions`), making refresh self-healing.
