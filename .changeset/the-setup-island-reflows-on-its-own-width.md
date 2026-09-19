---
"invana": patch
---

Fix: the setup wizard squeezed its lesson into two columns that did not fit.

With the Info panel and the Assistant both open, *Why it matters* and *How* rendered at ~150px —
three words a line — beside a 260px *You'll know it worked*. The lesson's `@2xl` queries had no
container of their own, so they measured the island, which is 248px of stepper wider than the pane
they were splitting: the two columns fired at a pane still under 450px.

The lesson pane is now its own `@container`, and every threshold is stated in px rather than
`@2xl`/`@3xl` — the root font dial is 13px, so a rem breakpoint fires ~19% narrower than its name
reads. The island stacks into the board below 640px of its own width, the lesson splits into two
columns only past 600px of pane, and the island's cap is the 1060px the spec asks for, not the
832px `max-w-5xl` was actually producing.

Both directions of each reflow are variants, never a base utility plus one variant: the kit's
stylesheet is concatenated after Studio's, so a base `flex-col` re-declared there wins on source
order and the column rule would never fire.

With both panels open the lesson now reads at 485px in one column (*Why it matters* 446px wide);
at full width the island is 1060px, the pane 810px, and the two columns return with 512px of prose.
