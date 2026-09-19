---
"invana": patch
---

The rail loses two icons, and Tasks becomes three drawers.

Nine top icons become seven. **Imports** and **Workflows** are gone — not the surfaces, the
icons. An import is a `kind` of TaskRun and a workflow is a reusable TaskPlan, so each was an
icon onto a *filter* of a list that already exists, and an icon per filter is how one journal
became four panels.

**Tasks** is where execution lives now, as a stack of three drawers rather than a tabbed panel,
with no panel header above them:

| Drawer | Answers |
|---|---|
| `Runs` | what ran, how did it end, what did it cost |
| `Plans` | what can I run, and what has it been good for |
| `Catalogue` | what may a plan name at all |

They are stacked because each is the definition of the one above it — a run is an execution of a
plan, and a plan is a composition of catalogue entries. Following *this run → the plan it ran →
the callable that failed* never leaves the column and never closes what you came from, which is
the thing three tabs could not do. Each drawer carries its own count, search and filter, because
the three lists filter on different columns. A drill-in replaces that drawer's body and turns its
header into `‹ RUNS / orders.csv`; the other two keep their place.

**Projects owns Todos.** The rail's *Tasks* icon named two unrelated things — Todos a person
wrote, and the runs the system made. It names only the second now. Projects is a stack of its own,
`Projects` over `Todos`, and with no project drilled into the Todos drawer is every Todo in the
Graph: a Todo nobody filed is still work somebody wrote, so the *No project* bucket needs no
pseudo-project to live in.

The URL follows the surface: `?panel=tasks&drawer=runs|plans|catalogue` with `&run=`, `&plan=` and
`&entry=` for what is open inside a drawer, and `?panel=projects&drawer=projects|todos` with
`&project=` and `&todo=`. A stack key is dropped whenever `?panel=` moves to a section that does
not own it, so a run never lingers in the URL under a different rail icon.

**`?panel=imports`, `?panel=workflows` and `?panel=thoughts` are deleted, not redirected.** They
name surfaces that no longer exist; a stale link lands on the graph page, which is what an unknown
`?panel` has always done. A redirect table would be a second vocabulary to maintain for links that
are weeks old.
