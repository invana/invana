---
"studio": patch
---

Explorer reply actions: tooltips, separated feedback, colored votes.

Each message action icon (re-run, view query, copy, view context, 👍/👎) now has a
hover tooltip via the design-kit `Tooltip` instead of a native `title`. The 👍/👎
controls move to the right of the action row so the feedback loop reads as its own
control, and the active vote is now clearly visible — 👍 turns green, 👎 turns red,
with no extra color when nothing is selected. Clicking the active vote still clears it.
