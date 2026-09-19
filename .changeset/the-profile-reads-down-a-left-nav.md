---
"studio": patch
---

The profile reads down a left nav, and the page is as wide as it needs (AC6).

Five sections on a tab strip fit a 2xl column badly — and Access tokens is a table, which
the strip was taking width from. `/settings/profile` now lists its sections down a left
nav (`NavVerticalItems`, still a tab list to a screen reader) with the section's content
beside it, and the page is capped at 1200px rather than the width of a single form.

The cap is explicit because the kit sets a 13px root: `max-w-5xl` is 832px here, not 1024.
