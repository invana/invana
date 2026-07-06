---
"studio": patch
---

Rework the Explorer **Canvases** left rail to match the Sessions panel exactly. The panel now uses the same `TabbedPanel` chrome — an icon-only header (Save view · refresh · search · sort/filter · collapse), a togglable search box, and a header-anchored sort/archive/reset filter menu — plus per-row hover actions (pin · archive · ⋯ for edit/delete) instead of the old always-visible header and a single ⋯ menu.

Both panels are now built on three shared, reusable primitives (`ListPanelChrome`, `ListRow`, `ListFilterMenu`), so Sessions, Canvases and future left rails stay visually and behaviourally in sync.
