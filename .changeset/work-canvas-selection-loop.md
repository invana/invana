---
"studio": patch
---

Picking a row on a work panel no longer freezes the page.

Selecting a task, agent or step while its canvas was open put the two halves of the selection bridge into a fight: the canvas→panel direction read "the canvas disagrees with the panel" as a canvas gesture, but it runs *before* the panel→canvas direction in the same commit, so a row that had just been picked always looked like a canvas that had just been cleared. The echo cleared the row, the next commit re-selected it from the canvas, and React stopped the page with `Maximum update depth exceeded`.

The canvas now only reports a selection it actually moved — both directions record what they last applied — so a row picked in a panel lights up its node, a node picked on the canvas opens its row, and a click on empty canvas clears both.

A work row's hover actions are also no longer nested inside its own click target. A `<button>` cannot contain a `<button>` — React warned about it on every render, and the browser is free to make the inner controls unreachable — so the selecting click now lives on its own button that fills the row, with the actions beside it. The row looks and behaves the same: the whole row washes on hover, the actions still reveal, and the status badge still holds its column.
