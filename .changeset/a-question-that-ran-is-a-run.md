---
"invana": patch
---

A question that ran is a run.

The Runs drawer read `…/imports` and nothing else, so a natural-language question could be asked,
planned, translated, validated, executed and served — and leave no row anywhere a reader could find
it. The journal is the answer to *what ran*, and it was answering only about loads.

[SR23](../docs/for-developers/modules/operate/features/see-what-ran.md) says an import, a chat ask, a
stitch commit, a provider ping and a canvas expansion are all runs, and that the journal is
**filtered, not selective**. It now lists asks beside imports, newest first, each row saying how far
it got — `Verify 7/7`, `Execute 1/3` — and an ask opens a detail with the same Gantt a load draws,
because the Gantt already reads the trace a thinking writes.

An import's own thinking is deliberately left out of the list: a load already opens one, and the run
detail reads its steps for the chart, so listing both would show every load twice — once by its
dataset and once by its plan. That de-duplication exists only because `thinkings` and `import_jobs`
are still two tables. It dies with M3, when a run is one row and there is nothing to merge.

Still missing, and named rather than hidden: an ask has no Log band, because its lines go to the
stream rather than to a stored log. That is `result.json`'s job in a later slice, not a second detail
surface's.
