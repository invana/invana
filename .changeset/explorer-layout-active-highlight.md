---
"studio": patch
---

Fix the Explorer layout switcher not highlighting the active layout. Each
`ToggleGroupItem` was wrapped in `TooltipTrigger asChild`, whose injected
`data-state` ("closed"/"delayed-open") clobbered the toggle's `data-state="on"`,
so the active-state styling never matched. The tooltip trigger now lives on an
inner span, leaving the item free to carry its own state.
