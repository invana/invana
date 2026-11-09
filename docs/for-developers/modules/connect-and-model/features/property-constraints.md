# Constraints on properties

A modeller bounds one property's values on one type — a **range** with a unit, or **a standard's
values** — and says what happens to a record that breaks it: **Reject** or **Flag for review**. The
engine checks it wherever a record lands, names the constraint when it refuses, and says how many
records in the graph break it today before the constraint is saved.

| | |
|---|---|
| Index | [1.11](../../../README.md#1--connect-and-model) · Slice **M04** |
| Module | [Connect and model](../spec.md) |
| API / CLI / Studio | ✅ / — / ✅ |
| Related | [the-model-page](the-model-page.md) (the type page) · [publish-review](publish-review.md) · [standards](../../bring-data-in/features/standards.md) · [load-data](../../bring-data-in/features/load-data.md) · products: modeller.md MO-08 · MO-F7 · datasets.md › Standards and checks |

Product spec: [MO-F02 · Change and publish a model](../../../../../specs/capabilities/model/features/MO-F02-change-and-publish-a-model/feature.md) — the stories, their criteria, journey, states and product decisions live there. This file keeps the engine and code shape.

## Surfaces

| Surface | Where | Reads |
|---|---|---|
| Constraints tab | The type page, `type_tab=constraints` | the version tree (mappings' `validation_rules`, `constraints`) |
| *Properties and their constraints* | First panel: property · type · constraint · from · edit | each mapping's range/standard rule and the database constraints naming the property |
| *Database constraints* | Second panel: name · type · properties · delete, *Add constraint* | `constraints` of the type |
| Constraint dialog | Opened from a row's *Edit constraint* | `GET …/property-constraints/standards` for the picker · `POST …/property-constraints/check` for *today* · `PUT …/property-constraints` to save · `DELETE …/property-constraints/{id}` |
| Artboard | `modeller.model.type.constraint` | — |

## Engine

| Route | Body / query | Returns |
|---|---|---|
| `PUT /api/v1/u/{u}/{g}/models/{model}/versions/{draft}/property-constraints` | `PropertyConstraintSet` | `ActionResponse[PropertyConstraint]` — the mapping's rule, replaced |
| `DELETE …/versions/{draft}/property-constraints/{rule_id}` | — | `ActionResponse[None]` |
| `POST …/versions/{version}/property-constraints/check` | `PropertyConstraintSet` | `ConstraintCheck` — what breaks it in the graph now |
| `GET …/property-constraints/standards` | — | `StandardChoice[]` — every standard's current-version terms that carry values |

`PropertyConstraintSet`

| Field | Type | Notes |
|---|---|---|
| `type` | str | the node or edge type's name |
| `property` | str | a property the type maps (its own or inherited) |
| `kind` | `range` \| `standard` | |
| `min` · `max` | number \| null | range only; one at least |
| `unit` | str \| null | range only, ≤ 32 chars |
| `standard` | str \| null | `publisher/name`, standard only — its current version is pinned |
| `term` | str \| null | standard only |
| `on_break` | `reject` \| `flag` | default `reject` |

The rule (`validation_rules` row) gains

| Column | Type | Notes |
|---|---|---|
| `rule_type` | enum + `standard` | |
| `unit` | str(32) \| null | |
| `standard_version_id` | FK `standard_versions` \| null, `SET NULL` | the pinned version |
| `standard_ref` | str(160) \| null | `publisher/name@v`, kept when the version row is gone |
| `term` | str(255) \| null | |
| `on_break` | `reject` \| `flag` | default `reject` |
| `params` | JSON | range `{min, max}` · standard `{values: [code…]}` copied at save |

`ConstraintCheck` — `counted: bool` · `breaking: int | null` · `samples: [{record, value}]` (≤ 5) ·
`label` (the constraint as the refusal names it) · `reason: str | null` (why it was not counted).

`StandardChoice` — `standard` (`publisher/name`) · `title` · `version` · `term` · `values` (count).

## Decisions

| # | Decision |
|---|---|
| PC1 | **A constraint lives on the type's property mapping, as a validation rule.** `rule_type` is `range` or `standard`; it is copied into every draft, diffed and published with the model, so a constraint is versioned like a property. A rule on the property key itself (every type) is still read and enforced; Studio authors on the type. |
| PC2 | **One constraint per property per type.** Saving replaces that mapping's range, enum or standard rule; pattern and length rules stay beside it. A constraint on an inherited property is written on the type that inherits it, as the type's own mapping of that key. |
| PC10 | **The Constraints tab is the property's view.** *Properties and their constraints* lists every property the type maps: property · type · constraint (the database constraints naming it, then the range or the first three values and `+N`) · from (*model* for a database constraint or none, *model · constraint* for a range or values, `<standard> · <term>` for a standard's values) · *Edit constraint on <property>* (a pencil) while a draft is open. An inherited property's dialog opens empty and writes the type's own constraint; its parent's stays. The tab counts `Constraints · N` — properties carrying a constraint plus database constraints. The Properties tab's *constraint* cell carries the same label. *Database constraints* below keeps the key, unique and exists rules, with *Add constraint* and delete. |
