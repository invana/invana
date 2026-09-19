---
"studio": patch
---

A turn never prints the same sentence twice.

A failed reply showed its error text twice in a row — once as the reply's own line, once in the diagnosis block below it — because `_finish_failed` writes one `failure.message` into both the message content and the diagnosis summary. The diagnosis keeps the sentence, since it also carries the actions the failure allows; the reply's line stands down while it shows. The diagnosis only rides the live view, so after a reload the reply's own text prints as usual — the sentence is on screen exactly once either way.

Successful query turns had the same shape: `shape_for_canvas` mints both the reply's "Returned 10839 nodes and 5419 relationships." and the Project step's `10839 nodes · 5419 relationships → canvas` from one pair of counts. While the timeline is open the step says it, so the reply line keeps only what a step row can't carry — the **Load to canvas** offer. Fold the steps away and the full sentence is the turn's one line again. A modeller reply's summary is the model's own prose, not a restatement, and always stands.
