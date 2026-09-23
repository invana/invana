---
"invana": patch
---

A Project shows the working rules it has and the invariants it inherits (RU8).

`GET …/projects/{key}/rules` has always returned both lists, and nothing in Studio read the second
one. A project's **Details** tab now draws them in the order a step is given them: the Graph's
invariants first — dimmed and read-only, because a project inherits them rather than owns them —
then the project's own, each rewordable in place and stoppable, with no delete (a deactivated rule
keeps its citations).

It is a section of **Details** and not a fifth tab: the four tabs answer *what is there*, *what
order*, *what happened* and *what it is*, and a rule that is always true of this work is part of
what the project **is** — which is where the project's own acts already live.

A project with no working rules of its own still shows what it inherits. An empty section would read
as an empty context, and it never is.

The Graph's `Rules` drawer and this section now compose the same row and the same form, so a rule
reads the same in both places.

**A section title was being truncated to nothing.** `PanelSection` passed its `hint` to the kit's
`count` slot, which is `shrink-0` — right for the short fact the slot is named for (`3 pinned`), and
wrong for the sentences these sections carry. A sentence took the whole header and squeezed the
title out of existence: on the Skills panel, `The flow it draws` was rendering as **zero
characters** and `The draft` as one. The hint now rides beside the title in the slot that truncates.
