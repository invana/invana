# Standards and conformance

A **standard** is a versioned, install-wide set of terms — each with a type, whether it is required, and
the values it allows. A dataset **claims** a standard by attaching one exact version with a column
mapping and an enforcement mode; every version of the dataset is then scored against it — its
**conformance**.

| | |
|---|---|
| Index | [2.7](../../../README.md#2--bring-data-in) · Slice **B04** (P-12) |
| Module | [Bring data in](../spec.md) |
| API / CLI / Studio | ✅ / ✅ / ✅ |
| Related | [datasets](datasets.md) · [bind-a-dataset](bind-a-dataset.md) · [rules](../../skills/features/rules.md) · products: datasets.md DS-08 · DS-09 · DS-F8 · DS-F9 |

Product spec: [DS-F04 · Standards and checks](../../../../../specs/capabilities/datasets/features/DS-F04-standards-and-checks/feature.md) — DS-07, DS-08 and DS-09; the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Shape |
|---|---|
| `datasets.standards` · `datasets.standard` | Studio `/datasets/standards[/<publisher>/<name>]` — `StandardsPage` with *Write a standard*, `StandardPage` with *Used by* |
| `datasets.standard.attach` · `datasets.dataset.conformance` | Studio — `AttachStandardDialog` (from a dataset or a standard) and the dataset's `conformance` tab |
| `datasets.validation` · `datasets.validation.item` | Studio `/datasets/validation[/<publisher>/<name>/<key>/<term>]` — the violation queue and one item |
| `invana standards list · show · apply --file` | CLI |
| `invana standards attach <ds> --standard <p/n[@v]> --mode --map term=column` · `detach` · `check <ds>[@v]` | CLI |

## Engine

| Table | Columns |
|---|---|
| `standards` | `id` · `publisher` · `name` (unique together) · `title` · `description` · `origin` · `current_version_id` · `created_by_id` · `created_at` · `updated_at` |
| `standard_versions` | `id` · `standard_id` · `version` (unique together) · `terms` · `content_hash` · `why` · `published_by_id` · `published_at` |
| `dataset_standards` | `id` · `dataset_id` · `standard_id` (unique together) · `standard_version_id` · `mode` · `mapping` · `attached_by_id` · `attached_at` |
| `dataset_conformance` | `id` · `dataset_version_id` · `standard_version_id` (unique together) · `mapping` · `record_count` · `conforming` · `score` · `violation_count` · `violations` · `checked_at` |

| Term field | Shape |
|---|---|
| `name` | unique in the version |
| `type` | `text · integer · number · boolean · date` (ISO `YYYY-MM-DD`); default `text` |
| `required` | default `false`; a null or empty value is missing |
| `values` | `[{code, label?, iri?, broader?}]`, codes unique; a value conforms when its text equals a code. `broader` names another value's code — the hierarchy a [SKOS import](skos-import.md) brings |
| `description` | free text |
| `iri` | the source IRI, set by a [SKOS import](skos-import.md); part of the hash |

| Violation | Means |
|---|---|
| `missing` | a required term is null, empty, or has no column |
| `not_allowed` | the value is not one of the term's codes |
| `wrong_type` | the value does not read as the term's type |

| Route (`/api/v1/standards`) | Returns |
|---|---|
| `GET ""` `?q · origin` | `StandardListResponse` |
| `POST ""` `{publisher?, name, title?, description?, origin, terms?, why?}` | 201 `StandardRead` — `terms` mints v1 |
| `GET /{publisher}/{name}` | `StandardRead` |
| `GET · POST /{publisher}/{name}/versions` | `StandardVersionListResponse` · 201 `StandardVersionRead` |
| `GET /{publisher}/{name}/versions/{v}` | `StandardVersionRead` |

| Route (`/api/v1/datasets/{publisher}/{name}`) | Returns |
|---|---|
| `GET /standards` | `DatasetStandardListResponse` |
| `POST /standards` `{standard: "p/n[@v]", mode, mapping?}` | 201 `DatasetStandardRead` |
| `DELETE /standards/{publisher}/{name}` | 204 |
| `GET /versions/{v}/conformance` | `ConformanceListResponse` — one per attached standard |

| Route (`/api/v1/datasets`) | Returns |
|---|---|
| `GET /claims` `?standard=p/n` | `DatasetClaimListResponse` — every claim on every readable dataset |
| `GET /validation` | `ValidationQueue` — every violation on a readable dataset's current version |

| Shape | Fields |
|---|---|
| `StandardRead` | `id` · `address` · `publisher` · `name` · `title` · `description` · `origin` · `current_version?` · `terms` · `content_hash?` · `created_by_id` · `created_at` · `updated_at` |
| `StandardVersionRead` | `id` · `address` (`p/n@v`) · `version` · `terms` · `content_hash` · `why?` · `published_by_id` · `published_at` |
| `DatasetStandardRead` | `standard` (`p/n@v`) · `version` · `newer_version?` · `mode` · `mapping` · `attached_by_id` · `attached_at` · `conformance: ConformanceRead?` (the current version's) |
| `DatasetStandardListResponse` | `items` · `total` · `lowest_score?` |
| `DatasetClaimListResponse` | `items: {dataset: DatasetRead, attachment: DatasetStandardRead}[]` · `total` · `by_standard: {p/n: count}` · `unreadable` |
| `ValidationQueue` | `items: {dataset (p/n), standard (p/n@v), mode, column, violation}[]` · `total` · `datasets: {address, publisher, name, title, total}[]` · `unreadable` |
| `ConformanceRead` | `dataset` (`p/n@v`) · `standard` (`p/n@v`) · `mode` · `record_count` · `conforming` · `score` · `conforms` · `violation_count` · `violations: [{key, term, kind, value?}]` · `checked_at` |
| `DatasetVersionRead` · `DatasetRead` · `DatasetBindingRead` | gain `warnings: [str]` — filled only by the act that raised them |

| Event | Details |
|---|---|
| `standard.create` (`target_kind = standard`) | `address` · `origin` |
| `standard.version` | `address` · `version` · `content_hash` · `terms` (count) · `why` |
| `dataset.standard_attach` (`target_kind = dataset`) | `address` · `standard` · `mode` · `score?` |
| `dataset.standard_detach` | `address` · `standard` |

## Decisions

| # | Decision |
|---|---|
| ST8 | **Conformance is stored, one row per dataset version × standard version,** recomputed in place when the mapping changes — it is derived, not a versioned record. At most 50 violations are kept; `violation_count` is the whole. |
| ST10 | **Rules read conformance.** A rule's `dataset.conforms` check reads the attachment and its conformance row ([rules](../../skills/features/rules.md) RU16); a dataset that does not claim the standard fails it. |
| ST11 | **The engine reads claims across the install.** `GET /api/v1/datasets/claims` returns every claim on every dataset the reader may read — the catalogue's access rule — with `total` and `by_standard` (claims per standard address), and `?standard=` narrows it to one standard; the catalogue's standard filter, the library's *N datasets claim it* and a standard's *Used by* read it. A dataset whose claims cannot be read is counted in `unreadable`, not hidden. |
| ST12 | **The validation queue is the engine's.** `GET /api/v1/datasets/validation` returns the violations kept on each claim's current-version conformance row, with `total` — the sum of `violation_count`, so a claim with more than 50 violations counts them all — and each dataset's own `total`. Studio narrows by dataset on the page and shows the engine's totals; the item count beside it is only what is listed. A queue item is a violation on a current version; its fix is a new version. |

## Not building

| Not building | Because |
|---|---|
| Validation queue items from violations | DS-F7 |
