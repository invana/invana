---
"invana": patch
---

A plan is drawn the same way everywhere: the skill's Flow tab and the run page's Flow tab both render `TaskFlowCanvas` (TF1).

The canvas lays out the plan's tasks and their edges with ELK, left to right, and a **Detail**
switch in its header draws them as **Circles** or **Cards**. Hovering a node or an edge opens its
card: the step, the bound, its arguments, and on a run its status, duration, lanes and attempts.
It is read-only, so the header carries only select, fit, lock, Detail and Settings.

**Skills.** The Flow tab draws the plan as a graph instead of six layer bands (SK16). One line
above it still says the step count and how many layers the plan declares. A step inlined from a
library plan says *from nl-single@1* on its hover card, and **Composed** under the canvas names
each plan once (SK34).

**Runs.** The Flow tab draws the run's tasks joined in `seq` order, the card grid it replaces is
gone, and clicking a node opens that step inside the page (SR32).
