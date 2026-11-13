---
id: SE-F02
title: Change and publish a model
product: SE
status: idea
personas: [modeller]
stories: [SE-05, SE-08]
journeys: [J01]
boards: [model.board, model.board.kind, model.board.draft, model.board.draft.publish, inbox]
nfrs: [NFR-PERF-5, NFR-SEC-9]
depends_on: [SE-F01]
---

# Change and publish a model

> Every change to a model gathers in a draft, is compared on the map, and is published in one act. Invana says before
> publishing whether the change only adds or breaks what is already in its graph database, who reads the model, and
> how many records a breaking change touches — and a breaking change waits for a named approver's yes. The decision it
> helps make: *is this change safe to publish?*

## User journey

Journeys this feature is a step of: [J01 · From a fresh deployment to a first answer](../../../../journeys/J01-from-a-fresh-deployment-to-a-first-answer.md)

```mermaid
flowchart TD
  start([A published model on the map]) --> may{Modeller or Admin?}
  may -->|no| ro["Read only — Change in a draft disabled · Needs the Modeller role"]
  may -->|yes| d["SE-05 · Change in a draft · kinds, relationships, properties"]
  d --> held{Someone else holds the draft?}
  held -->|yes| hro["Read only · who holds it"]
  held -->|no| ch["Each change staged · the draft bar counts it · discard one or all"]
  ch --> c["SE-08 · Constrain a property: a range or a standard's values · Reject or Flag"]
  c -->|today n records break it| ch
  ch --> cmp["SE-05 · Compare on the map: + added · ~ changed · − removed"]
  cmp --> p["Publish: Invana classifies the draft"]
  p -->|nothing staged| none["Nothing to publish"]
  p -->|only adds| pub(["Published vN · who reads it told nothing breaks"])
  p -->|breaks| br["Breaking — what breaks, who reads it, why"]
  br -->|no approver but the requester · a review already open| ref["Refused — names why or the open review"]
  br -->|Request approval| prev["Preview: per kind scanned · affected · would fail"]
  prev -->|failed · cannot answer| pf["Review failed — why · the draft stays"]
  prev --> ap{A named approver decides · Inbox › Needs you}
  ap -->|Decline · expires| no(["Not published · the draft stays"])
  ap -->|Approve| mig["The change runs"]
  mig -->|the draft or the model moved| stale(["Stale · not published"])
  mig --> done(["Published vN · records that do not fit the new version listed, never changed"])
```

```mermaid
sequenceDiagram
  actor M as Modeller
  participant S as Studio
  participant E as Engine
  participant R as Run
  actor O as Named approver
  M->>S: Publish
  S->>E: is this draft additive or breaking?
  E-->>S: breaking — each change with its reason, who reads the model
  M->>S: Why · Request approval
  E->>R: preview the change, writing nothing
  R-->>E: per kind: scanned of total · affected · would fail · samples
  E-->>O: Needs you — the change, its numbers, who reads it, the deadline
  O->>E: Approve
  E->>R: check nothing moved · scan · publish
  R-->>M: Published vN · records that fail listed · How it got here
```

## Stories

| ID | Story | Status |
|---|---|---|
| SE-05 | [Change a model and publish it](stories/SE-05-change-a-model-and-publish-it/story.md) | idea |
| SE-08 | [Constrain a property's values](stories/SE-08-constrain-a-propertys-values/story.md) | idea |

## Access

The role each act needs is the role table's *Ontology* row
([AC-F02 › The role table](../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)); this
table names the acts.

| Act | Role ([the role table](../../../../os/access/features/AC-F02-access-policies/feature.md#the-role-table)) | Everyone else sees |
|---|---|---|
| Read a model, its draft, its comparison and its reviews | Operator · Modeller · Admin | — |
| Change in a draft · stage, discard · constrain a property | Modeller · Admin, through the Modeller agent | *Change in a draft* disabled — *Needs the Modeller role — ask an Admin* |
| Publish a draft that only adds · request approval for a breaking one | Modeller · Admin, through the Modeller agent | *Publish* hidden; the draft reads |
| Approve or decline a breaking publish | The Modeller agent's named approvers, never the requester ([AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md)) | Not asked; the review reads *waiting on approval* |

## States

| State | What the person sees |
|---|---|
| First use | A published model with no draft: *Change in a draft*; a draft with nothing staged: *Publish* disabled with *Nothing to publish* |
| Empty after a filter | — |
| Loading | The draft bar counts while changes save; the publish confirm reads *Checking what this changes…*; a review reads *previewing* with its run |
| Has data | The draft on its canvas, changed kinds chipped, the draft bar `n staged · Discard · Publish vN` |
| Failed | A refused change says why where it was made; a failed preview says why and keeps the draft; a stale review says what moved |
| Agent working or proposing | An agent's changes arrive staged on the same draft as a person's; the preview run scanning records |
| No access | The model and its draft read; every change disabled with *Needs the Modeller role — ask an Admin* |

## Rules

| Rule | Detail |
|---|---|
| Everything stages | Adding, changing and deleting kinds, relationships, properties and constraints join one draft; nothing reaches a version until it is published |
| One draft, one writer at a time | The draft is kept by Invana, survives a reload and is seen by everyone; while one person holds it, others read it |
| An agent stages like a person | A run's changes join the same draft and the same publish |
| A published version never changes | Changing it publishes the next version; answers and loads that used the old one still resolve to it |
| Breaking, change by change | A draft breaks when any one change does: a kind removed · a property removed · a property's type changed · a property narrowed (list to single, list to set, a unique or exists constraint, a range or a standard's values added or changed) · a relationship's ends narrowed · its multiplicity changed · a key added, removed or changed · a kind's validation, parent or abstract flag changed. Adding, widening, removing a constraint that is not a key, an index or a description only adds |
| A model never published only adds | There is nothing in its graph database it can break |
| One way past a breaking change | A review: a preview that writes nothing, a named approver's yes, then the change runs. Nothing bypasses it |
| Statements need read + write | Publishing pushes constraints and indexes to the model's graph database only when it is read + write; on a read-only one the version publishes and each statement reads *not pushed — read-only*, so drift (SE-F10) is measured against the version |
| Counts are of what was read | The preview reads at most 1,000 records a kind and says so — *first 1,000 of 52,310* — never extrapolating |
| Data is never rewritten | Publishing changes what the model says; records that do not fit the new version are listed, never changed or deleted |
| Who reads it | The loads into a touched kind, the rules and derivations on it, the links between models and identity match rules on it, and the workflows that name it. Runs do not pin a model version, so a run is not a reader |
| A constraint is one property on one kind | A range with a unit, or one standard's values; Reject or Flag for review. Checked by one check wherever a record lands — every load and every edit on a board |
| One constraint a property, versioned with the model | Saving a range or a standard replaces the one the property had; a pattern or a length rule stays beside it. A kind carries its own properties — a broader kind is meaning only (SE-F04) — so a constraint is always on the kind that has the property. A constraint is staged, compared and published with the draft like a property |
| Leans on | SE-F01 — the draft · SE-F06 — links and match rules that read a model · SE-F05 — the standards a constraint names · RC-F02 — the loads into it · AC-F05 — the approval |

## Data touched

| Record | Read or write |
|---|---|
| Model draft — its staged changes, who holds it | Read · write |
| Model versions and the comparison between two | Read · write on publish |
| Publish review — classification, changes, preview, why, requester, approval, runs, status | Read · write |
| Ask in Inbox › Needs you — the impact list, frozen when the preview settles | Write |
| Constraint on a property — range and unit, or the standard version and term, and what happens on a break | Read · write |
| Standards and their values | Read |
| Records in the model's graph database | Read — counted by the preview and by *today n break it*, in the driver's read mode |

## Engine

The low-level design: what this feature stores, serves and refuses. Conventions — naming, errors, lists, events — are
[system-design.md](../../../../system-design.md) §§ 6–8; this section only fills them in.

### Records

| Table | Columns | Notes |
|---|---|---|
| `model_versions` | `model_id` · `number` · `state` (`draft` · `published`) · `content_hash` · `axes` (`time` · `geo` · `dims`) · `held_by_id` · `published_by_id` · `published_at` · `why` | One `draft` row a model; `held_by_id` is who holds it. A published row never changes |
| `model_property_keys` | `version_id` · `name` · `type` · `cardinality` (`single` · `list` · `set`) · `source_iri?` (≤2048) | Shared by every kind in the version |
| `model_node_types` · `model_edge_types` | `version_id` · `name` · `description` · `source_iri?` (≤2048); an edge type adds its source and target kinds and its multiplicity | — |
| `model_type_properties` | `type_id` · `key_id` · `order` | Which key a kind carries |
| `model_validation_rules` | `version_id` · `type_property_id?` · `key_id?` · `rule_type` (`range` · `standard` · `pattern` · `enum` · `min_length` · `max_length`) · `min` · `max` · `unit` (≤32, a label) · `standard_version_id?` · `standard_ref` (`publisher/name@v`) · `term` · `params` · `on_break` (`reject` · `flag`) | On a kind's mapping of a key, or on the key itself. `params` holds the standard's values copied at save; `standard_version_id` is `SET NULL` when that version goes |
| `model_constraints` · `model_indexes` | `version_id` · `type_id` · `properties` · `kind` (`unique` · `exists`, constraints only) | Staged like a kind |
| `model_schema_projections` | `version_id` · `statement` · `kind` · `label` · `properties` · `pushed` | One row per statement of a published version; `pushed` is false when its graph database was read-only, so drift is matched against it |
| `model_publish_reviews` | `model_id` · `version_id` · `base_version_id` · `draft_hash` · `classification` · `changes` · `preview` · `result` · `why` · `requested_by_id` · `approval_id` · `preview_run_id` · `run_id` · `published_version_id` · `status` (`previewing` · `pending` · `migrating` · `published` · `failed` · `declined` · `expired` · `stale`) · `reason` | One open (`previewing` · `pending` · `migrating`) a model |

### Reads

| Record | Owner |
|---|---|
| The model, its name and status | [SE-F01](../SE-F01-start-a-model/feature.md#engine) |
| Standards and their versions | [SE-F05](../SE-F05-standards/feature.md#engine) |
| Links between models and identity match rules on a touched kind | [SE-F06](../SE-F06-links-and-mappings/feature.md#engine) |
| Rules and derivations on a touched kind | [SE-F07](../SE-F07-rules/feature.md#engine) · [SE-F08](../SE-F08-inference/feature.md#engine) |
| The Modeller agent's Access Policies a preview and a change run under | [AC-F02](../../../../os/access/features/AC-F02-access-policies/feature.md#engine) |
| Loads into a touched kind · the load that checks a constraint | [RC-F02](../../../records/features/RC-F02-bring-records-in/feature.md#engine) |
| The approval a breaking publish waits for, its deadline and reminder | [AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine) |
| Runs and the built-in workflows they run | [CP-F10](../../../../os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md#engine) · [AG-F06](../../../agents/features/AG-F06-plans-and-workflows/feature.md#engine) |
| The graph database's mode and the server version's property types | [CP-F05](../../../../os/control/features/CP-F05-graph-databases/feature.md#engine) |
| History — every event this feature writes | [AC-F06](../../../../os/access/features/AC-F06-history/feature.md#engine) |

### Routes

| Route, after `/api/v1/model/models/{id}` | Does | Story |
|---|---|---|
| `GET /versions` · `GET /versions/{vid}` | A model's versions and its draft · one version whole | SE-05 · SE-09 |
| `GET /versions/{vid}/node-types` · `/edge-types` · `/property-keys` · `/constraints` · `/indexes` — each `GET` · `POST` · `PATCH` · `DELETE` on the draft | Read a version's parts · stage a change on the draft | SE-05 |
| `GET /versions/{to}/diff?against=` | Compare any two: marks per kind, lines with signs, `next_version`; a first version against nothing reads every kind added | SE-05 · SE-09 |
| `PUT /versions/{draft}/property-constraints` · `DELETE /versions/{draft}/property-constraints/{rule_id}` | Stage one constraint on a kind's property — `kind` (`range` · `standard`), `min` · `max` · `unit`, or `standard` and `term`, and `on_break` (default `reject`) · stage its removal | SE-08 |
| `POST /versions/{draft}/property-constraints/check` | *Today n records break it*: `label` · `counted` · `breaking` · up to five `samples` · `reason` when it cannot count; writes nothing | SE-08 |
| `GET /draft/staged` · `POST /draft/discard` | The staged changes · discard one or all | SE-05 |
| `GET /draft/review` | `classification` (`additive` · `breaking`) · `base_version` · `changes[]` (`kind` · `target` · `breaking` · `reason`) · `added` · `changed` · `removed` · who reads it | SE-05 |
| `GET /draft/projection` | The draft's statements against its live graph database or the published version, unsupported operations listed, each marked whether it will be pushed | SE-05 |
| `POST /publish` | `{why, approvers?, deadline_s?}` — the one way a draft becomes a version; returns `published`, or `review` with its id | SE-05 |
| `GET /publish-reviews` | The model's reviews, each with its status and runs | SE-05 |

| Route, after `/api/v1/model` | Does | Story |
|---|---|---|
| `GET /models/property-constraints/standards` | The standards with a term that has values: `standard` · `title` · `version` · `term` · `values` (a count) | SE-08 |
| `GET /schema/active-version` | Each model's published version the stitched model reads now | SE-05 |

### Events

| Event | When |
|---|---|
| `model.models.stage` · `model.models.unstage` | A change staged on the draft · discarded |
| `model.models.review` | A breaking publish asks for approval: `review_id` · `why` |
| `model.models.publish` | A version publishes: `review_id` and `why` on a reviewed one |

### Refusals

| Status | When | Sentence | Criterion |
|---|---|---|---|
| 403 | A change, constraint or publish by someone without the Modeller role | *Needs the Modeller role — ask an Admin.* | SE-05.22 · SE-08.16 |
| 409 | A change to a draft another person holds | *{person} holds this draft — it reads only.* | SE-05.6 |
| 422 | A property type the connected server version cannot hold | *{type} is not available on {database} {version}.* | SE-05.27 |
| 409 | Publishing a draft with nothing staged | *Nothing to publish.* | SE-05.10 |
| 409 | Publishing a model whose kinds use a property type the server cannot hold | *{model} uses {types}, which {database} {version} cannot hold.* | SE-05.24 |
| 409 | A breaking publish with no approver but the requester, or with a review already open on the model | *Nobody but you can approve this — ask an Admin to name an approver for the Modeller agent.* · *{model} already has a review open — {review}.* | SE-05.13 |
| 422 | A range on a text property, a minimum above the maximum, or a term with no values | *{property}: {why}.* | SE-08.7 |
| 422 | A record a load or a board edit writes outside a published `reject` constraint — on the writing route | *`{Kind}.{property}` breaks its constraint {label}: {value}.* | SE-08.11 |

### CLI

| Command | Does |
|---|---|
| `invana models publish <model> [--why] [--dry-run]` | Says whether the draft adds or breaks; one that adds publishes, one that breaks opens the review; `--dry-run` writes nothing |

### Mechanisms

| Mechanism | How |
|---|---|
| A key is named on its kind | Naming a property on a kind makes its `model_property_keys` row, or reuses the one of that name |
| A key-level rule | A `model_validation_rules` row on the key itself, not a kind's mapping, is read and enforced like one on a mapping |
| One constraint a property | Saving replaces that mapping's `range`, `enum` or `standard` row; `pattern` and length rows stay. An inherited property's row is the inheriting kind's own mapping; the parent is untouched |
| The check | Every load and every board edit reads the published row: `reject` refuses the record, `flag` lands it and lists it. A record with no value does not break it |
| Classification | `GET /draft/review` classifies change by change by the rule *Breaking, change by change*; a never-published model only adds |
| Who reads it | Read at review: the loads into a touched kind, the rules and derivations on it, the links on it |
| The preview is a run | `model.migrate`, `apply = false`, the built-in workflow `model-migration@1`, run by the Modeller agent with the requester behind it; it reads at most 1,000 records a kind in the driver's read mode and returns per kind `scanned` · `total` · `affected` · `would_fail` · samples |
| The Modeller agent's policies bind | The preview and the change run only where the Modeller agent's Access Policies allow Read on `data/<graph database>/<kind>`; a refusal fails the review with the rule |
| The impact is frozen | The approval opens only when the preview succeeds; its payload — the breaking changes, the preview's counts, who reads the model, the why — is fixed then and never recomputed. A failed preview ends the review with no approval |
| Approvers | The Modeller agent's named approvers, never the requester ([AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md#engine)); `deadline_s` defaults to 72 hours; reminders, escalation and expiry are AC-F05's |
| The clock moves it | The access clock settles a preview into an approval, opens the change run after a yes, expires a review past its deadline and fails one whose run ended without its result |
| Exactly what was approved | The change run (`model.migrate`, `apply = true`) checks `draft_hash` and the base version; a difference sets `stale` and publishes nothing. On success it publishes and lists the records that do not fit, unchanged |
| Pushing statements | Publishing pushes constraints and indexes only through the function `project_model`, and only to a read + write graph database, writing a `model_schema_projections` row per statement with `pushed`; the engine never writes the database's data here |
| An agent stages | `model.understand_ask` binds the draft and the conversation; `model.validate_proposal` (needs `model.propose`) checks referential integrity and stages. Both write the draft, never the database |
| Discard | A draft is not a version: discarding removes its rows |

## System impact

| HLD section | Change | NFRs |
|---|---|---|
| § 6 Data and storage | The version, key, kind, constraint, projection and review tables in Postgres | — |
| § 8 APIs and events | The routes and events above, under `model` | — |
| § 9 Distributed execution | The preview and the change are runs of the built-in workflow `model-migration@1`, moved by the access clock | — |
| § 10 AI and agents | Two agent functions stage on the draft: `model.understand_ask` · `model.validate_proposal` | — |
| § 11 Failure modes and the outside boundary | Only `project_model` writes to a graph database's schema, and only to a read + write one; a preview reads at most 1,000 records a kind | NFR-SEC-9 |

## Decisions

| Decision | Detail |
|---|---|
| The canvas draws; the draft bar writes | Adding a kind, adding a relationship and deleting are acts on the bar over the canvas and the kind's form, never canvas gestures |
| One model draws on the map's board | A model's canvas is SE-F06's map with one frame — the same board, layout, hues and Detail — and opens on *Cards*, since one model's few kinds have room for names and counts. The draft bar, the kind's form and the read-only footer sit around the canvas, never on it |
| A delete stages | Its confirm says *gone when you publish*, naming what depends on it before, not after |
| Staged first | In every list, staged rows sort first with a *staged* chip |
| Publish asks first | *Publish* reads whether the draft adds or breaks before its confirm opens. Adding: the changes, what its graph database is asked to hold — or *not pushed — read-only* — *Who reads it* and *None of them break*, then *Publish vN*. Breaking: *— breaking*, a banner naming each breaking change and its reason, who reads it, a *Why* field and *Request approval* |
| The review in the confirm | After the request the confirm reads *previewing* with its run, then per kind *scanned of total · affected · would fail*, then *waiting on approval* linked to Inbox › Needs you. A refusal shows the engine's sentence |
| Approvers | The Modeller agent's named approvers, never the requester; with none, it is refused before anything opens. The deadline is 72 hours by default — a reminder, then escalation, then *expired, not published* ([AC-F05](../../../../os/access/features/AC-F05-asks-and-approvals/feature.md)) |
| Publish exactly what was approved, or nothing | If the draft or the published version moved after the request, the review is *stale* and nothing publishes |
| One open review a model | A second request while one is previewing, waiting or running is refused, naming it |
| Compare is any two versions, on the map | The Comparing bar: *from* → *to* among a model's versions and its draft, `+ n added · ~ n changed · − n removed`, *Review and publish* while *to* is the draft. Each changed kind wears one chip of its lines, toned by its strongest sign; an added kind is a dashed ghost, a removed one keeps its place |
| A standard's values are copied when the constraint is saved | A newer standard version reaches the model only when the constraint is saved again |
| Reject is the default | Flag lets the record land and lists it in the load's report and in the constraint's count |
| *Today n records break it* is counted by the engine | Before saving, with up to five named; nothing written. A database it cannot count on says so, and the constraint still saves |
| A property is named on its kind | Naming a property on a kind makes its key, or reuses the key of that name; keys are shared by every kind in the version |
| Indexes and keys stage like kinds | An index, a unique and an exists constraint are added and removed in the draft; an index only adds, a unique or exists constraint breaks |

## Open questions

| Question | Who answers |
|---|---|
| — | — |

## Not building

| Item | Why not |
|---|---|
| Writing from a canvas gesture — drag to connect, add on the canvas, a context menu | The canvas draws; the bar and the form write |
| Layout saved per kind · auto-layout that rewrites an arranged model | Layout is a view, not part of the model |
| Live co-editing of a draft | One writer, with who holds it visible, is honest at this scale |
| Rewriting or deleting records to fit a new version | Records are loaded against a version, not rewritten by one |
| Withdrawing a review | Decline it, or change the draft — it goes stale |
| Extrapolated counts | A number nobody read is a guess |
| A rule loosened as a breaking publish | Rules are not part of a model version (SE-F07) |
| Unit conversion | The unit is a label; values compare as written |
| Pattern, length and allowed-list constraints in the dialog | The dialog authors a range or a standard's values; the others read on the kind's mappings |
| Constraints from SHACL | Later |
| Authoring a standard in a model's draft | Standards are the install's library (SE-F05) |
| Counting breaks on a Gremlin database | The count says it cannot count there |
