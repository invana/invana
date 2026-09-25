---
"studio": minor
---

A run's page is a report header over tabs, and a step opens inside it (SR71–SR73).

- The run page reads **Overview · Layers · Flow · Touched** under one header addressed `run:<short id>`. The Overview carries a waterfall — one row per task, on the run's clock — above what it touched, what opened it, what it returned, its bounds and its log. Lens is now the Touched tab.
- A task opens **inside the run**: from a waterfall row, a Flow card or a Layers column. The run's header stays, the step joins its crumb, and the crumb opens a picker of every step; `‹ ›` walk them and the `run:` crumb returns to the run. The address is `?page=run:<id>&step=<id>`, so a reload lands on the step; an old `task_run:` link opens the same way.
- The Runs drawer shows the waterfall too, and a row there opens that task inside the run page.
- Panels take the width they are given — no fixed-width panel on the run or step page, and the flow's cards fill their columns.
