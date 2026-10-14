---
"invana": minor
---

A breaking model publish goes through a review (docs/for-developers/modules/connect-and-model/features/publish-review.md).

**Every draft is classified against the published version, change by change.** Adding a type, a property or an index, widening endpoints or dropping a constraint is additive and publishes at once. Removing a type or a property, changing a property's type, narrowing cardinality or endpoints, adding a constraint or a validation rule, or changing a key is breaking. `GET …/models/{id}/draft/review` returns the classification; committing or activating a breaking draft directly is refused with 409 `breaking_publish_needs_review`, naming each breaking change.

**A review is a preview, an approval and a migration run.** `POST …/models/{id}/publish` publishes an additive draft, or opens a review for a breaking one. The preview is a run under the Graph's guardrails that scans up to 1,000 records of each touched type and reports what would change and what would fail, writing nothing. Then the other owners of the Graph (or the owners named) get an approval that shows the changes, the scan and the datasets and stitches that read the touched types. Once approved, a migration run publishes exactly the draft that was reviewed. If the draft or the published version changed in the meantime, the review is `stale` and nothing is published. Records are never rewritten; a record that fails the new model is listed in the run's result. `GET …/models/{id}/publish-reviews[/{review_id}]` reads reviews back.

**CLI.** `invana models publish --graph g --name m --user u [--dry-run] [--why …] [--approver u …]` classifies the draft, runs the preview inline and prints the scan. Without `--dry-run`, it opens the review and raises the approval right away.
