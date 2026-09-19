---
"invana": patch
---

Archiving a project is reversible, and the list says which ones are.

Archive was a one-way door: the footer button disappeared with the project's own status, so a
folder of work parked for a quarter could never be reopened from Studio. And the fact that it
*was* parked hid at the end of the row's count line — `3 open of 7 tasks · archived`.

- **Unarchive** now occupies the footer slot Archive had, so the control that froze a project
  is the control that thaws it. Its tasks become writable again with it. The word matches the
  Graph's own (`Unarchive`), rather than inventing a second one for the same act.
- The two directions are **separate events**: `project.archive` and `project.unarchive`, never a
  bare `project.update`. A folder of work being reopened is a fact someone will come looking for.
- In the projects list, `archived` is a muted badge beside the name; the subtitle goes back to
  counts alone. The state that changes what a row *means* now reads before the numbers do.

Decisions: [PT11 · PT12](docs/for-developers/modules/work/features/projects-and-tasks.md).
