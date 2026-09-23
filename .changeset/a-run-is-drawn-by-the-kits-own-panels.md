---
"invana": patch
---

A run's readings are drawn by the kit's own panels, and its lens is grouped by layer (SR53).

`@invana/dashboard` ships the run vocabulary — `trace · touched · attempts · artifacts · layers ·
lens · clarification` — as `RUN_PANELS`, and Studio registers it on the run page, the step page and
the frozen-report registry. Two Studio renderers that drew the same data go with it.

**This run's lens changes shape.** It was three buckets — refused, allowed-and-never-touched,
touched — which said what happened without saying *where*. It is now **one section per layer with a
row per participant**, each marked `touched · never touched · refused · miss`, refusals struck in
place. The layer comes from the address's first segment, which is the engine's own split, so a
participant the world allowed and nothing asked for still lands in its band instead of a bucket.
The four counts sit above it as tiles, and `Retune` moves to the page's own actions: narrowing opens
Govern beside the run and acts on the *next* run, not on this reading of this one.

A run whose ledger is empty now says **nothing was recorded** rather than drawing an empty axis —
a run that opened before its Graph had a lens keeps its answer and its trace, and what it engaged is
not part of them.
