---
"invana": patch
---

Picking a plan in the Library draws it (G42).

Selecting a row in **Library › Plans** drilled the drawer in and left `mainSection` showing *"Pick a
plan to draw the flow it will run"* — the empty state describing the gesture the reader had just
made. The drawing only arrived if you found **Draw the DAG**, which is exactly the button every
other work panel stopped needing when selecting a row became the gesture that opens its canvas.

The cause was two homes for one fact. The drawer wrote `&plan=` into the URL; the canvas read a
separate piece of page state that only that button ever set. The canvas now follows the drill-in, so
one click opens the plan's detail in the stack **and** its flow in the main section — which is what
[G40](../docs/for-developers/building-studio/graph-detail-page.md) already said a plan's detail does.

Two consequences fall out of the URL being the one home:

| | |
|---|---|
| `?panel=library&drawer=plans&plan=nl-single` | now reopens the **drawing** as well as the drawer — a link says what it opens (G31) |
| Going back to the list | clears `&plan=` and **leaves the canvas alone**: a panel opens a canvas and never closes one. Closing stays the tab's `X`, and re-picking the row draws it again |

**And the drawer now shows the record alone (G43).** Drilling into a plan drew its detail *under*
all nine rows of the list, beneath a footer of acts and a status bar — so the one thing asked for
was the last thing in a scrolling column, which is not how any other stacked panel behaves. The
drilled-in body is now the record and nothing else, and the three pieces of chrome that were in it
have gone where they belong:

| Was in the body | Now |
|---|---|
| `Draw the DAG` | **gone** — picking the plan draws it (G42) |
| `Promote a plan…` | a header action on the **list**, like every drawer's own `+`, and absent while drilled in |
| `Export YAML` | a header action on the **record**, beside `‹ Back` |
| `Library · Promoted (0) · 9 workflows · authoring: post-MVP` | **gone** — a status bar belongs to the panel, not to one drawer of three, and it repeated the count the drawer header already shows |
