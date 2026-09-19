---
"invana": patch
---

The project detail loses its footer and its Agents tab.

Under every tab of a project sat the same row of four buttons — `New task`, `Staff…`,
`Add dependency`, `Archive` — and not one of them acted on what the tab above was showing.
`Staff…` opened the new-task form. `Add dependency` opened a canvas to draw on. The row was a
menu of elsewhere, in the space the detail wanted for the project.

- **The footer is gone.** Each action moved to where its subject is: a task is written in the
  Tasks panel, a dependency is drawn on the Plan canvas — opening the Plan tab already draws it —
  and `Archive` / `Unarchive` now sit in **Details**, under `Edit`, with the rest of the
  project's own state.
- **Agents is no longer a tab.** The Staffed strip under the Todos already answers *who is on
  this*, beside the assignments it is derived from; the tab restated that list one click away.
  Agent chips still open the agent. Four tabs now: `Tasks · Plan · Activity · Details`.

Decisions: [PT13 · PT14](docs/for-developers/modules/work/features/projects-and-tasks.md).
