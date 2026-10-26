# Invana Modeller — give it meaning

The source of truth humans and agents reason over. Prototype page: *Invana Modeller › Give it meaning*.

| | |
|---|---|
| For | modellers, compliance leads |
| Scope | One Graph |
| Rail | Global model · Models · Stitches · Requests │ Worlds · Guardrails · Rules │ Graph settings (bottom) |
| Landing | Global model — every published model on one canvas |
| Canvas | Floating horizontal toolbar top-left: select, pan, zoom, fit, stitch, lock; a floating info bar beside it; the minimap bottom-left |

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
| MO-F4 | Version compare on the map; publish with who-reads-it; breaking publishes previewed as a migration run and approved by another member | In Studio (C04) — the map draws no per-type diff marks | MO-05 |
| MO-F5 | New model from a description, a file or a starter | In Studio | MO-06 |
| MO-F6 | Model dashboards — overview, database drift, usage, performance, growth, saved report | In Studio | MO-07 |
| MO-F7 | Constraints on properties; values named by a standard | New | MO-08 |
| MO-F8 | Model history with effect downstream | In Studio (C04) | MO-09 |
| MO-F9 | Worlds | In Studio | MO-10 |
| MO-F10 | Guardrails and the requests they cause | In Studio | MO-11 |
| MO-F11 | Rules at install, Graph or project scope | New · Blocked · P-12 | MO-12 |
| MO-F12 | Requests inbox | New | MO-13 |
| MO-F13 | Graph settings — basic, database, members and roles | In Studio (members and roles, C07) | MO-14 |
| MO-F14 | New model from an ontology — **RDFS / OWL subset, including schema.org**; JSON-LD, Turtle or RDF/XML; pick types, preview, open as a draft | ✅ B12 · C08 | MO-15 |
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
| `invana models import --ontology <file\|url> [--types A,B]` | a draft model from RDFS / OWL / schema.org | ✅ B12 |
| `invana models diff --name <m> v1 v2` · `history --name <m>` | compare versions; who changed what | New · P-09 |
| `invana models publish --name <m> [--dry-run]` | publish; `--dry-run` says additive or breaking and previews the migration | ✅ B10 |
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
| Guardrails | A guardrail is one property rule, always in force. The layered-lens guardrails are retired; each existing one is migrated to property rules, so no Graph loses its protection |
| Rule scope | Install, Graph and project. The install is the top scope: there is no tenancy, so an install rule holds in every Graph on it |
| Publish review | Additive changes publish directly. Breaking ones (removed or narrowed property, changed key, loosened guardrail) need another member’s approval, shown in Approvals with the impact list |
| Breaking data changes | A breaking publish generates a migration run: affected counts, sample before/after, records that would fail. It runs after approval; failures go to Datasets › Validation. Nothing changes silently |
| Rules show impact | A rule shows what it would have stopped in the last 30 days before it saves |
| Semantic imports | Invana keeps its own model; every import maps into it. Order: SKOS (in Datasets), then the RDFS/OWL subset with schema.org, then SHACL, then GQL graph types. Import only for now — the source IRI kept on every type and property makes export cheap later |
| Ontology import in Studio | Models `⋯` › *From an ontology*: one dialog, pick then preview; schema.org · URL · file read by the browser; the all-classes preview is the picker, and above 500 classes the picker takes names — [1.10](../for-developers/modules/connect-and-model/features/ontology-import.md) OI13–OI17 |
| OWL mapping | `owl:Class` → node type · datatype property → property (XSD → Invana type) · object property → edge type (domain → range) · `rdfs:subClassOf` → **flattened**, inherited properties noted with their source · labels and comments → names and descriptions · `owl:sameAs` / `equivalentClass` → stitch **suggestions** a person confirms · restrictions, inference and complex class expressions → **skipped and listed** in the import report |
| schema.org | Choose the types you need; the types they depend on come with them |
| Model in the settings modal | Read-only; editing hands off to the canvas |
| Rail → path | Global model `/modeller/global-model` · Models `/models` · Stitches `/stitches` · Requests `/requests` │ Worlds `/worlds[/:world]` · Guardrails `/guardrails[/:guardrail]` · Rules `/rules` │ Graph settings `/settings` (`?tab=`). Moving along the rail never remounts the page |
| Three boards, one leftSection | Each of Global model, Models and Stitches brings its own board forward as a Workbook tab: `global_model` (a full-bleed canvas), `models` (the dashboards) and `stitches` (a list). None has a leftSection, except one model's page, which has the model's outline there — Node types · Edge types · Stitches. There is no models list in the leftSection: a model is picked from the models board's rows, the global canvas or a breadcrumb |
| The global model page | Every published model on one full-bleed canvas, stitches dashed: the horizontal toolbar top-left, a floating info bar (`Global model` · node and edge type counts · stitches · *Show* · *Lens* · *Detail*), the minimap with zoom bottom-left, and a right column holding the union list — node types with their model, the anchored stitches, edge types. The right column belongs to the page, beside the canvas; the shell's `rightSection` stays the assistant's. *Show* draws all models or one; *Lens* lists the Graph's worlds and opens the picked one's page; *Detail* is the canvas's circles · cards · schema cards. Staged stitches and stitches bound to an older version are bars over the canvas. Clicking a type opens its type page; clicking a stitch on the canvas or an anchored row inspects it |
| The stitch inspector | The right column while a stitch is selected (`?stitch=<id>`), in place of the union list: the pair (`Country ≡ country`) with its kind, then tabs Stitch · Crossed by · History. **Stitch**: Ends — each side's type with its records from the latest count; Joins on — the rule and what the stitch holds in the graph now (*N joined* for an anchor, *N edges* for a relationship); Crossed by queries over 30 days; declared by whom and when. **Crossed by**: the 30-day queries, share and last crossed, from Usage's per-stitch aggregate. **History**: the stitch's declare · commit events, oldest first. *Open in a draft* opens the source model's schema canvas on its draft; *Remove stitch* confirms, then withdraws its edges. ✕ returns to the union list |
| The Stitches page | `Stitches` · *N active* · *Declare a stitch* (the declare card as a dialog, both sides picked in it), a search, then **Active** and **Removed** groups. A row is the rule — `NewsArticles.Country ≡ AirRoutes.country` or `Twitter.Tweet -[POSTED_NEAR]-> airport` — over `kind · status · N joined / N edges · crossed by N queries / never crossed by a query`; a staged stitch sits in Active marked *staged*, with the staged bar's *Commit* · *Discard* above the list. *Open* lands on the global model with that stitch inspected. **Removed** reads the removal events, which carry the rule, who removed it, when and the edges withdrawn — there is no removed row |
| Stitch counts | `model_links.edges` is how many edges the stitch holds in the graph, re-counted after every solve that writes — a commit and every import's stitch step — and `null` before the first. A MERGE re-matches what it already wrote, so the number is counted, never summed |
| The Modeller's status bar | The footer on every Modeller page: the model with a draft — `<model> · vN active · vM draft · N staged` — and whether the draft validates, then on the right `N types across M models` from the global model's counts. No draft: the models count alone. Which model has a draft is the models list's `draft_version`, so the bar asks nothing per model |
| Requests | An empty state with a lock until the engine records requests — never an empty list |
| Graph settings tabs | Basic · Graph. The Graph's concurrency is the Agents product's, in Agents › Settings |
| A rail move keeps the regions | A rail click carries `right`, `console` and `page`, so the docked chat, the Console and the Workbook's page stay open; the panel's own keys are dropped |
| No ✕ on a rail panel | Graph settings has no close control: its path is the panel, and closing it would leave the Modeller |
| Guardrails leads on its rail item | The Govern stack puts Guardrails first on `/guardrails`, Worlds first on `/worlds` |
| Main area with no board | Requests, Rules and Graph settings each say in one line what their main area is for, in Modeller words |
| One model's page | Head: breadcrumb `Models › <model>`, its description, the active readout and a draft chip, then *Open in Schema* (primary) · *Versions* · *Export* on one row, the draft's acts (*Publish vN* · *Discard draft*) beside them while one is open, and `⋯` for rename · archive · delete. Tabs Overview · Database · Usage · Performance · Growth with the window. Overview: four tiles — Types · Records · Queries a day · p95 — *Each type*, and *Records over time* from Growth's series; no *Needs attention* (the models board has it). *Open in Schema* opens the model's canvas (`models_view=schema`) full-bleed, its staged bar over it; *Versions* opens History |
| The type page | A type opens as a page of its model (`model_type=<name>`): breadcrumb `Models › <model> › <type>` with its records and key, a `node type` / `edge type` chip and the draft chip; *Add property* while a draft is open. Tabs **Properties · N** (property · type · cardinality · index · constraint) · **Indexes · N** · **Constraints · N** · **Mappings** (the type's property mappings: property · default · inherited from · validation). The board's *from source* column is not drawn: no record says which source column a property reads — a dataset binds its columns when it loads. While a draft is open, each row's delete removes the property, index or constraint from the draft, and *Add index* · *Add constraint* open their forms; without one the tabs read, with *Open a draft*. A property's own definition (rename, retype) is deleted from the draft only when no type maps it |
| Model history | The model page has a **History** reading (`models_tab=history`), opened by *Versions*: version · when · by · what changed · why · effect after, from `history/model/<id>`. *Effect after* names the datasets the version touched, stored at publish — `1 dataset now warns · 6 rows` (warning tone) or `2 datasets hold`; with none touched it reads the runs and tokens *while published*. The header action *Compare vA and vB* (the two newest) and each row's *Compare* open the shell's compare page. With All models in scope the tab lists every model's versions with a Model column, newest first |
| Publish asks the engine first | *Publish* reads `GET …/draft/review` before the confirm opens. **Additive**: the staged changes, what the database is asked to hold, and *Who reads `<model>`* — the stitches on the model and the datasets bound to it — with *None of them break: the change only adds and widens*; *Publish vN* commits. **Breaking**: the confirm turns into *Publish `<model>` — breaking*, *needs approval from another owner*: a banner naming each breaking change and its reason, the changes as a table, who reads it, a *Why* field, and *Request approval* (`POST …/publish`). A commit that still answers 409 `breaking_publish_needs_review` opens the same breaking confirm |
| The review in the confirm | After *Request approval* the confirm reads the review until it settles: *previewing* (the preview run, linked), then the migration table — per type: records scanned of total · affected · would fail — and *waiting on approval* in Activity › Approvals. Before the request, the confirm's migration table reads *counted after you request approval* in Outcome for a breaking change, and a type's property and the bare key it reads are one line (`airport.region`, not also `region`). The migration runs after approval, as a run you can watch; nothing changes before. A refusal (no other owner, an open review) is drawn as the kit's `RefusalCard` with the engine's message |
| Compare on the map | The global canvas carries a **Comparing** bar at its bottom: `Comparing` · *from* version select → *to* version select (the draft last, `vN draft`) · *+ N added · ~ N changed · − N removed* · *Review and publish* while *to* is the draft, which opens that model's publish confirm. It opens on `active → draft` for the model with a draft. The map marks each type the pair changes with one chip of its lines (`+ timezone · + index city`, `~ route.dist int → float`, `− version`), an added type is a dashed ghost in its model's frame, a removed one keeps its place with its `−` chip. Bar and marks read one engine diff ([1.9](../for-developers/modules/connect-and-model/features/publish-review.md) PB15 · PB16) |
| Connect a database | `/graphs/new` is *Connect a database*: six engine cards, URI, User and Password, *Test* · *Connect and draft a model*. One engine call makes the Graph, saves the connection and reads the database into an authored draft; Studio lands on that draft's canvas with the assistant docked ([1.1](../for-developers/modules/connect-and-model/features/connect-a-database.md) CD11–CD14) |
| The draft's canvas | A draft opens full-bleed on its workbook tab: the types marked as the Comparing bar marks them, a floating `N staged · Discard · Publish vN` top-right, the breadcrumb `Models › <model> vN · draft` ([1.8](../for-developers/modules/connect-and-model/features/the-model-page.md) MP42 · MP47 · MP48). Hidden and guarded marks arrive with the Worlds lens canvas |
| New model | One dialog — Name, Description, **Start from** *Describe it* · *A file* · *A starter* — and *Create draft* lands on the new draft's canvas. *Describe it* is a Modeller session bound to the new model whose first ask is the description ([1.3](../for-developers/modules/connect-and-model/features/domain-models.md) DM10–DM12). *Import* on the board opens it on *A file* |

## Studio today, mapped

Every `modeller.*` board of the *Invana Products* prototype against today's Studio (`@invana-studio/modeller`), and what moving it deletes. **Today**: built — the board's job and layout exist · differs — the job exists, the layout or the record does not match · missing — no surface. A move is done when its row's deletions are gone.

| Board | Story | Route | Today | What differs | Deletes |
|---|---|---|---|---|---|
| `modeller.global_model` | MO-01 | `/modeller/global-model` | built | A full-bleed canvas page with no leftSection: floating toolbar and info bar (types · stitches · *Show* · *Lens* · *Detail*), minimap, the union list in the rightSection, the Modeller's status bar; types wear their model's colour. Left: the toolbar shows select · lasso · comment · grid where the board draws the full editing row | ✅ deleted: `ModelViewPanel`'s models list; `AllModelsCanvas`; the Model tab |
| `modeller.global_model.dark` | MO-01 | the same, dark theme | built | As `modeller.global_model`, dark | — |
| `modeller.global_model.diff` | MO-05 | `/modeller/global-model` › *Compare* with a draft | built | The Comparing bar — a model select, two version selects (the draft reads `vN draft` from the diff's `next_version`), `+ added · ~ changed · − removed` and *Review and publish* — over the whole map, the compared model's frame swapped for its `to` version and each changed type chipped by sign. The board draws one combined chip per type; Studio stacks one per line | — |
| `modeller.global_model.stitch` | MO-03 | the same › a stitch (`?stitch=<id>`) | built | The stitch inspector in the rightSection: ends with their records, *Joins on* (match · holds), *Crossed by queries*, *declared*, tabs Stitch · Crossed by · History, *Open in a draft* · *Remove stitch*. Left: the header's breadcrumb does not add the stitch; *holds* reads *not solved yet* until a stitch commit or import recounts it | — |
| `modeller.stitches` | MO-03 | `/modeller/stitches` | built | The Graph-wide stitch list: *N active*, *Declare a stitch*, search, Active and Removed (folded) with *Open* | ✅ deleted: `useStitchesSection`'s graph-scope branch |
| `modeller.model.airroutes` | MO-02 | `/modeller/models?model=<id>&model_open=1` | built | The one-line outline under one *model · version* head; head *Open in Schema* · *Versions* · *Export*; five tabs; four tiles in a row; Overview ends on *Records over time* (by type, where the board draws one series) | ✅ deleted: the Model tab, `DraftCompareBar` |
| `modeller.model.type` | MO-02 | the same › a type (`&model_type=<name>`) | built | The type page: breadcrumb with records and key, *Add property*, tabs Properties · Indexes · Constraints · Mappings, each acting through `deletePropertyKey` · `createConstraint` · `deleteConstraint` · `deleteIndex`. Left: the property table reads *cardinality* where the board reads *from source* | — |
| `modeller.model.type.constraint` | MO-08 | the same › Constraints › a property | missing | A constraint dialog: a range with a unit or a standard's values, *Reject* or *Flag for review*, the records that break it today. Today constraints are the database's (unique · exists · node key); property `validation_rules` exist in the engine with no UI that authors them, and nothing references a standard. Shot: a type page lists *Constraints on this type* (`accession_name_unique`, unique · label · properties) and a validation column (`range`) read-only; no dialog opens. The shot is Arabidopsis › Accession, with a red **ERROR** status bar that is the connector's; the board uses Chickpea › Variety · `maturity_days` | — |
| `modeller.connect` | MO-04 | `/graphs/new` | built | Six engine cards, URI, user, password, *Test* · *Connect and draft a model*, landing on the drafted model's canvas with the assistant docked | — |
| `modeller.draft` | MO-04 | `/modeller/models?model=<id>&model_open=1&models_view=schema` on a draft | built | A full-bleed canvas — schema cards, toolbar, minimap — each changed type chipped and an added one dashed, the floating `N staged · Discard · Publish vN` bar, the crumb `<model> vN · draft`. The board tints the changed property *inside* its card (a `@invana/canvas` schema-card change); the Lens strip is M05's; the workbook tab reads the model's name | — |
| `modeller.draft.publish` | MO-05 | the same › *Publish* | built | *Publish* on a non-breaking draft lists the changes, *What it asks Neo4j to hold*, *Who reads* (the stitches and bound datasets — the engine has no reader record for agents, schedules or saved views) and *None of them break*. Hand-driven: the reproducible shot has no staged change, so no confirm opens | — |
| `modeller.draft.migration` | MO-05 | the same › *Publish* on a breaking draft | built | *Publish* on a breaking draft (a removed property): the *breaking* banner, the migration table counted after the request, *Why* and *Request approval*, as decided. Hand-driven: the reproducible shot has no staged change, so no confirm opens | — |
| `modeller.models.new` | MO-06 | `/modeller/models` › *New model* | built | One dialog — name, description, *Describe it* · *A file* · *A starter* — each landing on the new model's draft canvas | — |
| `modeller.models.new.ontology` | MO-15 | `/modeller/models` › `⋯` › *From an ontology* | differs | The dialog has no *Pulls in* column, and its footer reads *3 picked · types they depend on come with them* with no counts (board *3 picked · 4 pulled in · 7 types in the draft*) | — |
| `modeller.models.new.ontology.preview` | MO-15 | the same › *Preview* | built | The board draws the preview as a page; Studio keeps it in the one dialog (OI13). Skipped types read as prose lines, not rows, and there is an extra *Call it* field | — |
| `modeller.models.overview` | MO-07 | `/modeller/models?models_tab=overview` | differs | The head is *Models* · an *All models* select · count chips · *Save report* · *New model* · *Import*; live has no select and no *Save report*, and *4 models* where the board reads *4 published*. Live has seven tabs (Model and History included; the board has five) and a Models leftSection the board lacks. Needs attention has column heads and is capped with a *+N* overflow; live is uncapped, its heads render as a blank strip, and the Each-model *signal* column clips mid-word | — |
| `modeller.models.database` | MO-07 | `?models_tab=database` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.usage` | MO-07 | `?models_tab=usage` | differs | The body is the board's, without *View as table*; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.performance` | MO-07 | `?models_tab=performance` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists, and no *Advice · 2 missing indexes* sixth tile | — |
| `modeller.models.growth` | MO-07 | `?models_tab=growth` | differs | The body is the board's, but the KPI tiles sit in a 2×2 grid where the board has one row of four; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.report` | MO-07 | the same › *Save report* › a saved report | missing | *Save report* on the models board and the frozen reading (*kept by … · it will not change* · *Back to live*). The shell's `useReport` exists and `LensBoardPage` uses it; the models board does not | — |
| `modeller.model.history` | MO-09 | `?model=<id>&models_tab=history` | built | Effect after reads runs and tokens while published; the board reads the dataset effect (*1 dataset now warns · 6 rows*). The page chrome differs as on `modeller.model.airroutes` | — |
| `modeller.worlds` | MO-10 | `/modeller/worlds` | differs | The board opens a lens canvas — type cards with hidden types dimmed and guarded properties shielded, a Lens strip — and a world inspector in the rightSection (Sees · Answers go · Used by). Today the Govern stack lists worlds over guardrails and the main area is a Graph card, with an *in force on every run* guardrails band the board lacks | — |
| `modeller.worlds.board` | MO-10 | `/modeller/worlds/<world>` | differs | `LensBoardPage` exists with KPI tiles, the layers, the cast and *Save report*. Live adds a leftSection and a workbook tab; the header actions are *Board* · *spec.json* · *Edit* · *Save report* · *Reports* (board *Edit*); there is no *compute* layer; no *In force* tile and *Closed layers* is a name where the board has a count; the cast reads all denied and runs 0 (board 11); the breadcrumb shows the world's UUID where it must resolve the name | — |
| `modeller.guardrails.edit` | MO-11 | `/modeller/guardrails` › a guardrail rule | differs | A guardrail is one property rule (*When a run touches* · *It may Read / Read in counts only / Never read* · *the result May leave / Stays in the Graph*) with impact before saving. Today a guardrail is a lens of kind guardrail holding layered rules (`LensEditor` · `RuleBuilder`), and airways seeds one. The shot is the guardrail record page, whose breadcrumb shows a UUID | `RunLensWidget` |
| `modeller.guardrails.request` | MO-11 | `/modeller/guardrails/<guardrail>` with a request | missing | A request bar over the canvas (*Decline* · *Allow in a world*) and a guardrail inspector (Rule · Refusals · History). The engine records no refusal as a request. The board has no request to open, so its route is the guardrail's own page (the landing is the honest shot) | — |
| `modeller.requests` | MO-13 | `/modeller/requests` | missing | A Requests page — Open and Done groups, each row's *Decline* · *Allow in a world* · *Model it*, a rail badge. The engine has no request record; Studio shows a locked empty state | `RequestsViewPanel`'s locked empty state |
| `modeller.rules` | MO-12 | `/modeller/rules` | differs | A Rules page — scope and *Checked on* filters, rows with scope · checked on · when broken (block · warn · report) and counts, *New rule*. Today `RulesViewPanel` lists Graph invariants only, *offered and cited, never enforced*; the engine's install · Graph · project rules (`/api/v1/rules`) are never called | `RulesViewPanel`'s invariant-only list; the main area's one-line card |
| `modeller.rules.edit` | MO-12 | the same › a rule | missing | A rule dialog: statement · scope · checked on · when broken · *Because* · what it would have stopped in 30 days. `RuleBoardPage` reads an invariant; no editor writes a scoped rule. Shot: a rule opens in the leftSection with *reword* and *Stop offering it*, and the main area stays the Graph card | — |
| `modeller.settings` | MO-14 | `/modeller/settings` | differs | A page with tabs Basic · Database · Members (LLMs stay in Agents › LLMs): name, description, instructions, *Save*, Archive. Today the form is `SettingsViewPanel` in the leftSection and the main area is a Graph card | `SettingsViewPanel` in the leftSection; the main area's one-line card |
| `modeller.settings.database` | MO-14 | `/modeller/settings?tab=database` | differs | The board is a full page with an editable URI, User and Password and *Save* · *Test connection*. Live is a read-only summary in the 280px leftSection (truncated URI) with *Edit* · *Introspect*, no *Test connection*; keyed `?tab=graph`. Live adds a connected status line, a Capabilities row and an immutability note the board lacks | — |
| `modeller.settings.members` | MO-14 | `/modeller/settings?tab=members` | differs | The board has four members, five roles, *Edit* on each row and no agent rows. Live renders in the leftSection with Members and Roles stacked, eight members, six roles (an extra `iam-admin`), no per-row *Edit* and *Add member* in the panel. Live `owner` and `iam-admin` split the board's `owner` powers | — |

## Not building

| Item | Why |
|---|---|
| OSI (Open Semantic Interchange) | It standardises BI metrics, not graph models |
| Ontology reasoning and inference | Open-world reasoning does not fit Invana’s validation, which rejects what is not allowed |
| An ontology editor | Protégé and similar tools already do that; Invana imports |
| Semantic export | Later; source IRIs are kept so it is cheap to add |
| An import UI | CLI and API only |
| Standards authoring here | Datasets owns standards |
