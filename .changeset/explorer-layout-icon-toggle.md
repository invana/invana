---
"studio": patch
---

Show the Explorer layout switcher as an inline icon toggle group.

The header layout picker was a dropdown `select` that hid the options until
opened. It is now an inline `ToggleGroup` of borderless icon buttons (Force,
Layered, Stress) so every layout is visible at a glance, the active one stays
highlighted, and each name reads from a hover tooltip. A divider follows the
group to separate it from the run/refresh actions.
