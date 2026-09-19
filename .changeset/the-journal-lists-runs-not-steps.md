---
"invana": patch
---

The Runs drawer lists runs, not steps.

*Per-step rows in the journal* has been a stated non-goal of **See what ran** since it was written —
*"a step belongs to its run; a flat list of every step in a Graph answers no question anyone has"*.
The Runs drawer was showing them anyway. In one real Graph, 43 of the 50 rows it fetched were step
rows: `understand_intent`, `translate_thought`, `execute_graph_query`, four per ask, pushing the
seven actual runs off the list.

The rule was being enforced by accident. `ask_kind` is null on a child, so **naming a kind** —
`?kind=import` — narrowed to roots as a side effect. Every caller that named one looked correct, and
the journal names none, so the journal was the single caller that got everything. A rule that holds
only while an unrelated filter is applied is not being enforced; it is being coincided with.

`list_runs` now says `parent_run_id IS NULL`. The drawer's count follows, and so does the agent
surface's *what has this agent run* — a child inherits `agent_id`, so that list was listing steps
too.

Nothing moves. A run's children were never drawn in this list; they are drawn underneath the run when
you open it, and each one has its own dashboard. The row still says how many steps it has —
`step_count` is read off the run, which is the difference between a summary and a second list.

The journal's tests built only root runs, which is why they passed throughout. One now builds a run
with three steps and asserts the journal has four rows rather than seven.
