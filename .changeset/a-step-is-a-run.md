---
"invana": patch
---

A step is a run.

`thoughts`, `thinkings` and `thinking_steps` are **one `task_runs` table**. A Thinking and a
ThinkingStep were the same fact at two resolutions, so every question about *what ran* had to be
asked twice and stitched — and a delegated child, which is a whole Thinking hanging off a step, could
only be reached by joining the two. A run with no `parent_run_id` is what a Todo or a session ask
opened; a run with one is a node of that run's plan. One table, one vocabulary, one recursion.

The ask folds in with them. `thoughts` was a row every root run had exactly one of, so `body`,
`params`, `ask_kind` and the session pair are columns on the root, null on a node — which is honest,
because a node of a plan is not an ask. `session_id` and `message_id` stay foreign keys rather than
folding into a jsonb blob: a session delete has to cascade, and *the runs of this session* has to be
an indexed lookup.

`child_thinking_id` does not survive. A delegating node's children are the rows naming it in
`parent_run_id`, so the column duplicated the edge it sat on, and the fan-in reads the tree instead.
`delegated_by_step_id` goes the same way — the delegating node **is** the parent now, so three
columns describing one edge became one.

New axes on the run: `role` (execute · plan · evaluate), `plan_snapshot`, `plan_origin`,
`plan_revision`, `lens_id`, `lens_snapshot`, and `result` for SR17's `result.json`. `thought_stream`
is `task_stream`, `prompt_answers` is `task_prompts` with `kind` · `options` · `deadline_s`, and
`StepStatus` is gone because a step is a run.

**The word is gone with the tables.** No table, column or index in a freshly migrated schema says
*thinking* or *thought*, and the routes move from `…/thinkings` to `…/runs`. Two names are
deliberately kept: `translate_thought` and `plan_workflow` are catalogue keys stored in run rows and
read by Studio, and §6.1 freezes them — renaming those is a data migration, not a rename.

Data is migrated, not dropped: every Thought/Thinking pair becomes a root run and every step becomes
a child of it, each keeping its id so emissions, prompts and stream rows still resolve.
