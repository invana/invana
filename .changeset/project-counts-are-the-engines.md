---
"invana": patch
---

A project's counts are the engine's.

- **`GET …/projects/{key}/summary`** returns every count a project shows: branches and how many sit in each status, findings and how many a person reviewed, datasets its findings cite, its Todos per status, open Todos and how many are for agents, decisions, and the length of the plan's critical path.
- **The Overview tiles** (Branches, Findings, Datasets, Todos, *N decided*) and **the project's status bar** (`running` · `needs input` · `in review` · `blocked`, `critical path: N`) read it instead of counting the lists Studio loaded.
- The status bar now counts only the project's own Todos — a task from another project that the plan draws beside them is no longer counted.
