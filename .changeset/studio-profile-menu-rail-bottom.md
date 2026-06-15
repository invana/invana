---
"studio": minor
---

Move the user profile menu from the header's top-right to the very bottom of the left rail.

The avatar + dropdown (profile settings, platform admin/events for superusers, sign out) now lives in NavVertical's `bottom` slot on every surface — the App shell (graphs list, profile, platform pages) and the graph-scoped pages (Explorer / Modeller). On the graph rail a separator divides the settings-section icons from the profile menu pinned below them. The dropdown opens to the right of the rail. The header right cluster keeps GitHub stars, theme toggle, fullscreen toggle, and any page panel controls.
