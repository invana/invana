---
"invana": minor
"studio": minor
---

A stitch stages on its own row (docs/for-developers/modules/connect-and-model/features/stitch-models.md, ST21 · C8).

**Declaring a stitch no longer changes an answer.** `model_links.status` is `staged` or `active`. A declared stitch lands **staged**: the row exists, so it survives a reload and anyone who opens the Graph sees it — and `derive_global_model` unions **active rows only**, so nothing a question can reach moves until somebody commits. The declare message says so out loud rather than leaving it to be discovered: *"Staged — the global model is unchanged until you commit."*

**Commit is one action for the whole set.** `POST …/model-links/commit` flips every staged stitch in the Graph to active; `POST …/model-links/discard` drops the set, or one row out of it. Committing them one at a time would put the union through states nobody chose, and discarding deletes rather than reverts — a staged stitch was never in the union, so there is no earlier state to put back. Committing with nothing staged is refused, naming that, instead of succeeding silently.

**It is deliberately not the model's staged set.** That one is the live diff between a draft and the version it will replace and records nothing; a stitch belongs to no version, so it has no draft to diff. What the two share is the property that matters: the staged set lives on the server (ME4), not in one person's browser.

`GET …/model-links` takes `?status=staged|active`. `GlobalModel` gains `staged_count`, counted **beside** the union and never into it — the same rule the physical mirror's label count follows. Events: `model_link.commit` and `model_link.discard` join declare and remove. Existing links migrate to `active`: a stitch that was already answering questions keeps answering them.

**Studio.** The Stitches drawer sorts staged rows first with a `staged` chip and *not in the union yet* on the subtitle, and its header grows Commit and Discard while anything is staged. On the All-models canvas a staged crossing is drawn in the primary, dashed, and a bar states the count with what has **not** happened because of it.
