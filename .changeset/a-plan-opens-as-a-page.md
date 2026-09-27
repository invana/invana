---
"invana": patch
---

A library plan opens as a page. Pick a plan in **Library › Plans** and it opens in the main area
with four tabs, all read over a `7 · 30 · 90 days` window chosen on the tab strip:

- **Overview**: runs, served, elapsed and work p50, cost per run and failed, each beside the window
  before. Below them are runs a day (served and failed), work p50 a day with each version's publish
  marked, and a row per step. Pick a step to see its numbers and its slowest runs. Last come where
  the plan fails and how often its retry bound is used and exhausted.
- **Layers**: the plan's layer strip with every band open, each step carrying its p50.
- **Flow**: the plan on the same canvas as a skill's Flow tab and a run's, read-only. Pick a step
  to see its contract and how it has performed.
- **Activity**: every run of the plan, newest first, filterable by status and caller. A failed row
  names the step it failed at and why, and a row opens its run page.

The header switches between the plan's versions. The Plans drawer keeps what the plan is, a short
*how it has behaved* with a 30-day sparkline and work p50, its callers and its versions. The layer
strip has moved from the drawer to the Layers tab.
