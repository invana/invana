---
"invana": patch
---

A question is asked under a world, and the run freezes what that resolved to (C1 · C14 · GV26).

**The chip is in `header.right`, not the composer**
([WO5](docs/for-developers/modules/govern/features/worlds.md)). A world is the run's circumstances
rather than part of the question, and it has to read on a surface that has no composer — a run
opened from a schedule has none. It carries `?lens=`, which survives a panel change and a reload, so
a shared link reproduces the bound as well as the question
([WO11](docs/for-developers/modules/govern/features/worlds.md)).

It reads **`Everything`** when nothing is picked, which is a real world and the default one — never
a blank or a *choose…*, which would make the widest state look like an unanswered question. A world
naming a model version the Graph no longer publishes is **refused at the chip, naming the version**,
before a run opens rather than narrowed away silently at run time
([GR13](docs/for-developers/modules/govern/features/guardrails.md)).

**`open_turn` freezes the lens.** The Graph's guardrails, the agent's and the picked world compose
into one `Effective`, written to `task_runs.lens_snapshot` with the world's id on `task_runs.lens_id`
— once, and never recomputed ([GV8](docs/for-developers/modules/govern/spec.md)), which is what makes
a past answer reconstructible rather than a pointer at rows that have since moved. A run with no
world still freezes the guardrails, because **no world is the widest, not the narrowest**
([GV7](docs/for-developers/modules/govern/spec.md)). A world from another Graph refuses before the
run is written.

**A snapshot's contributors carry the name that was typed**, so `TraceRead.lens_name` reads what the
world was called *then* and a rename cannot rewrite what a past run says it ran under
([GV27](docs/for-developers/modules/govern/spec.md)) — [GR3](docs/for-developers/modules/govern/features/guardrails.md)
one grain down.
