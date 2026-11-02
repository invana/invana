# Publish review

Publishing a model says whether the change is **additive** or **breaking**. An additive change publishes
now. A breaking one is previewed as a **migration run** — affected counts, sample before/after, records
that would fail — and publishes only after **another member** approves it. Nothing changes silently.

| | |
|---|---|
| Index | [1.9](../../../README.md#1--connect-and-model) · Slice **B10** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Product | [modeller.md › Decisions](../../../../products/modeller.md#decisions) — *Publish review* · *Breaking data changes* · MO-05 · P-16 |
| Related | [domain-models](domain-models.md) · [model-editor](model-editor.md) · [approvals](../../operate/features/approvals.md) · [change-log](../../operate/features/change-log.md) · [roles](../../identity-and-access/features/roles.md) |

Product spec: [MO-F02 · Change and publish a model](../../../../../specs/products/model/features/MO-F02-change-and-publish-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| Publish confirm | `modeller.draft.publish` — reads `GET …/draft/review`; additive shows the staged changes, the projection and *Who reads*, then *Publish vN*; breaking shows *— breaking*, the changes, *Who reads*, a why and *Request approval* (`packages/modeller/src/models/model-page/ModelsDialogs.tsx`) |
| Review | `modeller.draft.migration` — the same confirm after the request: the preview run, the migration table, then *waiting on approval*, linked to the runs and Approvals |
| Comparing bar | `modeller.global_model.diff` — at the bottom of the global canvas whenever a model has a draft or someone picks a pair: `Comparing` · a model's version select → a version select (the draft listed last as `vN draft`) · `+ N added` `~ N changed` `− N removed` · *Review and publish* while the right side is the draft. The map marks each type the pair changes (PB16) (`packages/modeller/src/models/stitch/CompareBar.tsx`) |
| Activity › Approvals | The approval's `payload` is the impact list, frozen at request |
| CLI | `invana models publish --graph g --name m [--dry-run] [--why …] [--approver u …] [--user u]` — `--user` is required without `--dry-run` (a review names its requester); the preview runs inline, then one clock step raises the approval |

## Engine

| Thing | Shape |
|---|---|
| `GET …/models/{id}/draft/review` | `{classification: additive · breaking, base_version, changes: [{kind, target_kind, type, property, breaking, reason}]}` — reads only |
| `POST …/models/{id}/publish` | `{why?, version?, approvers?: [username], deadline_s?}` → `{outcome: published · review, version?, review?}` |
| `GET …/models/{id}/versions/{to}/diff?against={from}` | `SchemaDiff` plus `added` · `changed` · `removed` (the counts of its marks' lines by sign) and `marks: [{type, target_kind, mark: added · changed · removed, lines: [{sign: + · ~ · −, text}]}]` — one entry per type the pair changes; `to` may be the draft |
| `GET …/models/{id}/publish-reviews` · `…/{review_id}` | the model's reviews, newest first · one |
| `model_publish_reviews` | `graph_id` · `model_id` · `version_id` (the draft) · `base_version_id` · `draft_hash` · `classification` · `changes` · `preview` · `result` · `why` · `requested_by_id` · `approval_id` · `preview_run_id` · `run_id` · `published_version` · `status` · `reason` · `created_at` · `updated_at` |
| `status` | `previewing · pending · migrating · published · failed · declined · expired · stale` |
| Task type | `migrate_model` (bound `schema_write`, in `invana.core.schema_write`) — `apply=false` previews, `apply=true` publishes |
| Packaged flow | `model-migration@1`, one step |
| Run | `ask_kind = model_migration`, no agent, no world, the Graph's guardrails frozen on it |
| Approval | `subject_kind = model_publish`, `subject_id` = the review |
| Clock | One more step after approvals expire: settle previews, open approved migrations, close finished ones |
| Events | `model.review` (`status` in details) on request and on each end that is not a publish; a publish is `model.commit` with `review_id` and `why` |

## Decisions

| # | Decision |
|---|---|
| PB3 | **The preview is a migration run** — `model-migration@1` with `apply=false`, under the Graph's guardrails. It asks the guardrails to **admit** the model's published version, and only `allow` admits: a preview over a slice would undercount what the change touches. |
| PB10 | **The clock moves a review.** It settles previews into approvals, opens the migration run after an approval, and marks a review `failed` when either run ends without its result. Approving or declining wakes it, so the run opens (or the review ends) within a tick. |
| PB11 | **A reviewed publish is the same publish.** SemVer bump, content hash and `model.commit` (with `review_id` and `why`), so the [change log](../../operate/features/change-log.md) reads it like any other. |
| PB14 | **`draft/review` counts its changes.** It returns `added` (kinds ending `_added`), `removed` (ending `_removed`) and `changed` (the rest) beside `changes`, so the Comparing bar formats three numbers and counts nothing. |
