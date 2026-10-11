# Invana Modeller — give it meaning

The source of truth humans and agents reason over. Prototype page: *Invana Modeller › Give it meaning*.

| | |
|---|---|
| For | modellers, compliance leads |
| Scope | One Graph |
| Rail | Global model · Models · Stitches · Requests │ Worlds · Guardrails · Rules │ Graph settings (bottom) |
| Landing | Global model — every published model on one canvas |
| Canvas | Floating vertical toolbar top-left: select, pan, add type, connect, property, stitch, world lens, guardrail, undo, layout, validate |

| Status | Means |
|---|---|
| In Studio | Exists on today’s Studio; this plan moves or re-skins it |
| Moves | Exists today in another product; this plan re-homes it |
| New | Not built; designed here |
| Blocked · P-nn | New, and cannot ship until prerequisite P-nn exists ([README](README.md#prerequisites)) |

## Features

| ID | Feature | Status | Stories |
|---|---|---|---|
| MO-F1 | Global model canvas, drill-in, dark theme | In Studio (union schema) | MO-01 · MO-02 |
| MO-F2 | Stitches — declare, inspect, crossed by queries | In Studio | MO-03 |
| MO-F3 | Connect a database, drafted model | In Studio | MO-04 |
| MO-F4 | Version compare on the map; publish with who-reads-it; breaking publishes previewed as a migration run and approved by another member | In Studio (publish) · New (map diff, migration, approval) · Blocked · P-13 (approvals) | MO-05 |
| MO-F5 | New model from a description, a file or a starter | In Studio | MO-06 |
| MO-F6 | Model dashboards — overview, database drift, usage, performance, growth, saved report | In Studio | MO-07 |
| MO-F7 | Constraints on properties; values named by a standard | New | MO-08 |
| MO-F8 | Model history with effect downstream | New · Blocked · P-09 | MO-09 |
| MO-F9 | Worlds | In Studio | MO-10 |
| MO-F10 | Guardrails and the requests they cause | In Studio | MO-11 |
| MO-F11 | Rules at install, Graph or project scope | New · Blocked · P-12 | MO-12 |
| MO-F12 | Requests inbox | New | MO-13 |
| MO-F13 | Graph settings — basic, database, members and roles | In Studio · New (roles) · Blocked · P-18 | MO-14 |
| MO-F14 | New model from an ontology — **RDFS / OWL subset, including schema.org**; JSON-LD, Turtle or RDF/XML; pick types, preview, open as a draft | New · Blocked · P-19 | MO-15 |
| MO-F15 | Constraints from **SHACL**; schema from **GQL graph types** (ISO/IEC 39075) | Later | — |

## User stories

| ID | As a | I want | So that | Boards (walk order) |
|---|---|---|---|---|
| MO-01 | modeller | every published model on one canvas, stitches dashed | I see the whole truth agents reason over | `modeller.global_model` · `modeller.global_model.dark` |
| MO-02 | modeller | to drill from the global model into a model and a type | I read any part in detail | `modeller.model.airroutes` · `modeller.model.type` |
| MO-03 | modeller | to declare and inspect stitches between models | separate models answer one question | `modeller.global_model.stitch` · `modeller.stitches` |
| MO-04 | modeller | to connect a database and get a drafted model | a new Graph starts in minutes | `modeller.connect` · `modeller.draft` |
| MO-05 | modeller | to compare versions on the map and see who reads a model before I publish | publishing never surprises anyone | `modeller.global_model.diff` · `modeller.draft.publish` · `modeller.draft.migration` |
| MO-06 | modeller | to start a model from a description, a file or a starter | modelling is not a blank page | `modeller.models.new` |
| MO-15 | modeller | to start a model from an ontology — schema.org, RDFS or OWL — and see what maps and what is skipped | modelling starts from what my field already defined | `modeller.models.new.ontology` · `modeller.models.new.ontology.preview` |
| MO-07 | modeller | health, usage, speed and growth for every model, and a saved reading | I find what is unused, slow or drifting | `modeller.models.overview` · `modeller.models.database` · `modeller.models.usage` · `modeller.models.performance` · `modeller.models.growth` · `modeller.models.report` |
| MO-08 | modeller | ranges on a property, and values named by a standard | impossible values never land | `modeller.model.type.constraint` |
| MO-09 | modeller | a model’s history: who changed what, why, and the effect after | model changes are auditable | `modeller.model.history` |
| MO-10 | modeller | named worlds that narrow what a run may see | people compare answers in different scopes | `modeller.worlds` · `modeller.worlds.board` |
| MO-11 | modeller | guardrails always in force, and the requests they cause | protected data stays protected | `modeller.guardrails.request` · `modeller.guardrails.edit` |
| MO-12 | compliance lead | rules at install, Graph or project scope, checked where they apply | organisation and certification policy holds | `modeller.rules` · `modeller.rules.edit` |
| MO-13 | modeller | one inbox of what analysts and agents asked to be modelled or allowed | gaps get fixed, not lost | `modeller.requests` |
| MO-14 | modeller | the Graph’s settings: name, instructions, connection | the Graph is grounded and reachable | `modeller.settings` · `modeller.settings.database` · `modeller.settings.members` |

## Govern: four kinds of bound

| Kind | Bounds | Scope | Checked when |
|---|---|---|---|
| Constraint | one property’s values | model | record write, bind, validation |
| Guardrail | what a run may see, use, send | Graph or agent | run time |
| World | a named narrowing picked per question | Graph | when picked |
| Rule | what people and agents may record or decide | install · Graph · project | publish, share, finding, decision |

## CLI

| Command | Does | Status |
|---|---|---|
| `invana models list` · `starters` · `export` · `import` · `upgrade` | models in a Graph; shipped starters; move models as files | ✅ exists |
| `invana models import --ontology <file\|url> [--types A,B]` | a draft model from RDFS / OWL / schema.org | New · P-19 |
| `invana models diff --name <m> v1 v2` · `history --name <m>` | compare versions; who changed what | New · P-09 |
| `invana models publish --name <m> [--dry-run]` | publish; `--dry-run` says additive or breaking and previews the migration | New · P-16 |
| `invana stitches apply` · `list` · `resolve` · `commit` · `discard` | declare and manage stitches | ✅ exists |
| `invana govern apply` · `list` · `show` | worlds and guardrails as files | ✅ exists |
| `invana rules list` · `apply --file` · `show` | rules at install, Graph or project scope | New · P-12 |
| `invana requests list` · `resolve <id> --allow\|--decline\|--model` | asks from analysts and agents | New |

## Decisions

| Decision | Detail |
|---|---|
| Landing | Global model, not a list |
| Standards | Defined in Datasets; a property **references** a standard’s values |
| Imports | Moved to Datasets |
| Publish review | Additive changes publish directly. Breaking ones (removed or narrowed property, changed key, loosened guardrail) need another member’s approval, shown in Approvals with the impact list |
| Breaking data changes | A breaking publish generates a migration run: affected counts, sample before/after, records that would fail. It runs after approval; failures go to Datasets › Validation. Nothing changes silently |
| Rules show impact | A rule shows what it would have stopped in the last 30 days before it saves |
| Semantic imports | Invana keeps its own model; every import maps into it. Order: SKOS (in Datasets), then the RDFS/OWL subset with schema.org, then SHACL, then GQL graph types. Import only for now — the source IRI kept on every type and property makes export cheap later |
| OWL mapping | `owl:Class` → node type · datatype property → property (XSD → Invana type) · object property → edge type (domain → range) · `rdfs:subClassOf` → **flattened**, inherited properties noted with their source · labels and comments → names and descriptions · `owl:sameAs` / `equivalentClass` → stitch **suggestions** a person confirms · restrictions, inference and complex class expressions → **skipped and listed** in the import report |
| schema.org | Choose the types you need; the types they depend on come with them |
| Model in the settings modal | Read-only; editing hands off to the canvas |

## Not building

| Item | Why |
|---|---|
| OSI (Open Semantic Interchange) | It standardises BI metrics, not graph models |
| Ontology reasoning and inference | Open-world reasoning does not fit Invana’s validation, which rejects what is not allowed |
| An ontology editor | Protégé and similar tools already do that; Invana imports |
| Semantic export | Later; source IRIs are kept so it is cheap to add |
| An import UI | CLI and API only |
| Standards authoring here | Datasets owns standards |
