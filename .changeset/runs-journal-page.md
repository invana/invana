---
"studio": minor
---

The Runs journal gets a page, and the Runs panel gets `Refresh` (SR70).

- The Runs panel header carries **Refresh** (it spins while the journal refetches) and **Dashboard**, which opens the journal as a page beside the list. Drilled into a run, **Refresh** reads the run's trace and ledger again.
- The page — `runs:<graph>` — has four tiles (In flight · Today · Spent today · Slowest) over a table of every run, newest first: run · what it was about · kind · agent · elapsed · tokens · tasks · cost · status. A row click drills the panel into that run.
- The panel and the page share one set of filter chips, so the two always show the same journal.
