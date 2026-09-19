---
"invana": patch
---

A project's detail states what the project is, and lets you edit it.

Opening a project spent its first two lines on the way back out: a breadcrumb reading
`Projects › hey` in the panel header, and a second `← Projects` row directly under it. The
project's own name appeared in neither as a heading, and the facts a folder of work is read
by — who wrote it, when, and what it is *for* — were nowhere at all.

- **The heading leads with the project.** The name is an `h2`, `created by ⟨who⟩ · ⟨when⟩` sits
  under it, and the purpose follows, clamped to three lines with **Show more**. The second
  back-link is gone; the panel breadcrumb is the only *Projects* link, which is one back-link
  rather than two.
- **A Details tab**, rightmost after Activity: `key · purpose · status · created by · created ·
  updated · tasks`. It is the only place a project is edited — `Edit` turns the two authored
  fields, name and purpose, into inputs in place, because a dialog over a 400px panel covers
  the thing being edited. Key, creator and timestamps stay rows: they are records, not fields.
- A project with no purpose says so where the purpose would be, and the sentence opens Details.
- `ProjectRead` now carries `created_by_name`, resolved in one query for the whole list, so the
  heading says a name and never a bare id — and falls back to *unknown* when that person is gone.

Decisions: [PT8 · PT9 · PT10](docs/for-developers/modules/work/features/projects-and-tasks.md).
