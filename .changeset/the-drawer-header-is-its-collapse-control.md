---
"invana": patch
---

A drill-in crumb no longer nests a button inside the panel header's own button, and Studio mounts one tooltip provider.

A `PanelStack` section header **is** its collapse control, so the clickable `‹ SKILLS` crumb the
Skills and Rules drawers put in their `title` rendered a `<button>` inside a `<button>` — invalid
HTML, which React reported as a hydration error, and a click that had to fight the collapse gesture
for the same pixels. The trail is now text and *going back* is the header's action, which is free
exactly when a drawer is drilled in and the act it is for is no longer *create*. `TaskDrawer`
already drilled in this way.

`TooltipProvider` now wraps the router once in `main.tsx` instead of being mounted per screen. Radix
needs an ancestor provider for every tooltip, and a screen that brings its own is a second delay to
keep in step — whichever one wins depending on where a component happens to sit. Kit components that
provide one internally are unaffected.
