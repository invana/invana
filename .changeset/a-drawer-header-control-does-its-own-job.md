---
"invana": patch
---

A drawer header control does its own job, and only its own job.

Clicking **Search** in the Tasks panel collapsed the drawer over the search box it had just
opened. So did the filter, and so did each drawer's own `+`. `PanelStack` renders a section's
title *inside* the header's collapse button, and the drawer drew its controls in that title —
so every one of them was a `<button>` inside a `<button>`, and every click toggled the drawer
as well as doing what it was clicked for.

They move to `headerActions`, which the kit renders in a sibling beside the button. Search
opens and the drawer stays open; the filter menu opens and the drawer stays open; the nested
buttons and their React error are gone.

The back control moves with them: a drilled-in drawer reads `RUNS / orders.csv` with
`Back to RUNS` beside the other controls, rather than `‹ RUNS / orders.csv` with the chevron on
the left, because the left of that bar is the collapse button. It goes back where it is drawn
once `PanelStack` offers a slot ahead of its own chevron.

**Activity had no actor.** The events API returns `actor_kind`; Studio read `actor_type`, so the
actor badge rendered empty, the actor column fell through to its last branch, and event search
indexed nothing for it. The union was three values where the engine has five — and an `agent` row
carries a null `actor` with its name in `actor_name`, so every agent's event read as
`(deleted user)`. Both surfaces now name the agent that acted.
