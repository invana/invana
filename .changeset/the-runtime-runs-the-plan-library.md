---
"invana": patch
---

The runtime runs the plan library.

A plan was its rows for everything except the one thing that matters. `ensure_seeded` exploded each
builtin into `task_plans` + `tasks` rows, the Plans list read them, the YAML export rendered them —
and then a run ignored all of it. `plan_workflow` resolved the ask against a dictionary in
`apps/agents/registry.py` and executed the step list held there in code.

Nothing was visibly wrong, which is why it survived M2 and M3. The consequences were quieter:

- **A trace could not open its plan.** `TaskRun.task_plan_id` and `TaskRun.task_id` are columns with
  foreign keys, and nothing could fill them — the run had executed a dict, and a dict has no row to
  point at. *Which node of which plan was this* had no answer.
- **`plan_snapshot` froze a copy of code**, not a copy of the plan a person can read.
- **Editing a plan changed what was listed, never what ran.** The library was a catalogue of
  documents that happened to resemble what the engine did.

`plan_workflow` now reads the Graph's library: it takes the plan's rows, rebuilds the step list from
them, and validates *that* against the agent's envelope. Each queued node records the `tasks` row it
came from, and the run records the plan it is running. The registry keeps exactly one job — it is the
seed source those rows are exploded from, and nothing else reads it.

Selection is unchanged. An intent that matched `nl-single@1` still matches it, still costs no LLM
call, and an envelope that does not list a plan still refuses it. A Graph whose library cannot serve
an ask still plans it with the model rather than failing — a missing entry degrades, it does not
break.

Two rows in every trace carry no plan node: *Understand* and *Plan* are written from the agent's
envelope before a plan is chosen, so they are how a run reaches a plan rather than steps within one.
They gain their own rows when planning becomes an ordinary run of a planning plan.
