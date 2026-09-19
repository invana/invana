---
"studio": patch
---

Sessions lives on the right, and its close closes the drawer.

The assistant drawer is the Sessions panel moved to the right side (AD6), but
the panel was still wired as a left-rail one: its header control carried the
left-collapse chevron and called the left rail's close, so collapsing the
drawer folded whatever panel you had open on the left instead. It now closes
the drawer, and shows the ✕ the hi-fi draws.

Sessions is no longer a left panel at all — the rail icon is gone (the header's
Assistant control is the one door), and the Explorer no longer falls back to
Sessions in its left column. A `?settings=sessions` link opens the drawer.
