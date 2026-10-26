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
| One Models panel, three readings | Global model, Models and Stitches share the Models panel; Global model and Stitches open the board on its Model tab, Models on Overview |
| Stitches | Read on the global canvas, where a stitch is declared, until a stitch list exists |
| Requests | An empty state with a lock until the engine records requests — never an empty list |
| Graph settings tabs | Basic · Graph. The Graph's concurrency is the Agents product's, in Agents › Settings |
| A rail move keeps the regions | A rail click carries `right`, `console` and `page`, so the docked chat, the Console and the Workbook's page stay open; the panel's own keys are dropped |
| No ✕ on a rail panel | Graph settings has no close control: its path is the panel, and closing it would leave the Modeller |
| Guardrails leads on its rail item | The Govern stack puts Guardrails first on `/guardrails`, Worlds first on `/worlds` |
| Main area with no board | Requests, Rules and Graph settings each say in one line what their main area is for, in Modeller words |
| Model history | The model page gains a **History** tab (`models_tab=history`), after Growth: version · when · by · what changed · why · effect after, from `history/model/<id>`. A model's effect is a `window`, so the column says *while published*. The header action *Compare vA and vB* (the two newest) and each row's *Compare* open the shell's compare page. With All models in scope the tab lists every model's versions with a Model column, newest first |
| Publish asks the engine first | *Publish* reads `GET …/draft/review` before the confirm opens. **Additive**: the staged changes, what the database is asked to hold, and *Who reads `<model>`* — the stitches on the model and the datasets bound to it — with *None of them break: the change only adds and widens*; *Publish vN* commits. **Breaking**: the confirm turns into *Publish `<model>` — breaking*, *needs approval from another owner*: a banner naming each breaking change and its reason, the changes as a table, who reads it, a *Why* field, and *Request approval* (`POST …/publish`). A commit that still answers 409 `breaking_publish_needs_review` opens the same breaking confirm |
| The review in the confirm | After *Request approval* the confirm reads the review until it settles: *previewing* (the preview run, linked), then the migration table — per type: records scanned of total · affected · would fail — and *waiting on approval* in Activity › Approvals. Before the request, the confirm's migration table reads *counted after you request approval* in Outcome for a breaking change, and a type's property and the bare key it reads are one line (`airport.region`, not also `region`). The migration runs after approval, as a run you can watch; nothing changes before. A refusal (no other owner, an open review) is drawn as the kit's `RefusalCard` with the engine's message |
| Compare on the map | When a model has a draft, the global canvas carries a **Comparing** bar: `<model> vActive → vN draft` · *+ added · ~ changed · − removed* from `draft/review` · *Review and publish*, which opens that model's publish confirm. With several drafts a select picks the model. The map itself is not re-coloured: the canvas library has no per-type diff marks yet, so the counts and the confirm carry the diff. The bar is pinned to the canvas panel's visible bottom (`sticky`), so it stays on screen however tall the canvas and the union list draw |

## Studio today, mapped

Every `modeller.*` board of the *Invana Products* prototype against today's Studio (`@invana-studio/modeller`), and what moving it deletes. **Today**: built — the board's job and layout exist · differs — the job exists, the layout or the record does not match · missing — no surface. A move is done when its row's deletions are gone.

| Board | Story | Route | Today | What differs | Deletes |
|---|---|---|---|---|---|
| `modeller.global_model` | MO-01 | `/modeller/global-model` | differs | The board is a full-bleed canvas page with no leftSection: a horizontal toolbar top-left, a floating info bar (types · stitches · *Show* · *Lens* · *Detail*), a minimap, the union list in the rightSection and a status bar (`<model> · v1 active · v2 draft · N staged · valid`). Today it is the `models` board's Model tab — a header, seven tabs, a canvas card and the union list inside the page — beside the `ModelViewPanel` models list | `ModelViewPanel`'s models list on Global model, Models and Stitches; the unread `panelPaths` sections `global` · `models` · `stitches` |
| `modeller.global_model.dark` | MO-01 | the same, dark theme | differs | The theme is app-wide and built; the layout differs as on `modeller.global_model` | — |
| `modeller.global_model.diff` | MO-05 | `/modeller/global-model` with a draft | differs | The board marks each changed type on the map (`+` added property or index · `~` changed type · `−` removed · a dashed ghost for a new type) and the Comparing bar has two version selects. Today the bar carries counts and one model select; the canvas draws no per-type marks | `modelsApi.versionDiff`, unless the marks read it |
| `modeller.global_model.stitch` | MO-03 | the same › click a stitch | missing | A stitch inspector in the rightSection: the ends and anchor, *Joins on* with the match count, tabs Stitch · Crossed by · History, *Open in a draft* · *Remove stitch*. Today a stitch is read only in the per-model Stitches section of the panel drill-in. Shot: a click on an *anchored* row of the union list opens nothing, and a stitch edge on the canvas is hover-only (*Hover an edge for its stitch rule*) | — |
| `modeller.stitches` | MO-03 | `/modeller/stitches` | missing | A Graph-wide stitch list page: *N active*, *Declare a stitch*, search, Active and Removed groups (ends · kind · counts · crossed by · *Open*). Today `/stitches` opens the same Model tab as Global model | `useStitchesSection`'s `scope="graph"` branch |
| `modeller.model.airroutes` | MO-02 | `/modeller/models?model=<id>&model_open=1` | differs | The outline in the leftSection, the breadcrumb and *Each type* match. Live has six tiles (board four), seven tabs (board five — the extra Model and History), a three-row head, a workbook tab, actions *Publish* · *Discard draft* · *Compare* (board *Open in Schema* · *Versions* · *Export*) and an Overview that ends on *Needs attention* with *P95 a day* (board *Records over time*) | — |
| `modeller.model.type` | MO-02 | the same › a node type | differs | A type page: breadcrumb with records and key, *Add property*, tabs Properties · Indexes · Constraints · Mappings, a property table (type · from source · index · constraint · staged). Today `NodeTypeDetail` is one scroll (Properties · Constraints on this type · Indexes) with no Mappings | `modelsApi.deletePropertyKey` · `createConstraint` · `deleteConstraint` · `deleteIndex`, unless the tabs call them |
| `modeller.model.type.constraint` | MO-08 | the same › Constraints › a property | missing | A constraint dialog: a range with a unit or a standard's values, *Reject* or *Flag for review*, the records that break it today. Today constraints are the database's (unique · exists · node key); property `validation_rules` exist in the engine with no UI that authors them, and nothing references a standard. Shot: a type page lists *Constraints on this type* (`accession_name_unique`, unique · label · properties) and a validation column (`range`) read-only; no dialog opens | — |
| `modeller.connect` | MO-04 | `/graphs/new` | differs | The board connects a database in one step — six engine cards, URI, user, password, *Test* · *Connect and draft a model* — and lands on a drafted model. Today `GraphCreatePage` asks a name and a slug; the connection is Graph settings › Database, and introspection refreshes the read-only `global` model, so no authored draft follows. The header reads *Invana Studio* with an `@admin` crumb; the board's reads *Invana Modeller* with a graph switcher | — |
| `modeller.draft` | MO-04 | `/modeller/models?model=<id>` on a draft | differs | A full-bleed canvas on the draft's workbook tab: type cards marked staged · changed · guarded · hidden, a Lens strip, a staged bar (*N staged · Discard · Publish vN*), the assistant docked right. Today a draft is the Model tab of the `models` board with *Publish vN* · *Discard draft* · *Compare* in the header. Shot with a staged add: *2 staged* bar with chips, *STAGED* on the type, *Discard all* · *publish* | — |
| `modeller.draft.publish` | MO-05 | the same › *Publish* | built | *Publish* on a non-breaking draft lists the changes, *What it asks Neo4j to hold*, *Who reads* (the stitches and bound datasets — the engine has no reader record for agents, schedules or saved views) and *None of them break* | — |
| `modeller.draft.migration` | MO-05 | the same › *Publish* on a breaking draft | built | *Publish* on a breaking draft (a removed property): the *breaking* banner, the migration table counted after the request, *Why* and *Request approval*, as decided | — |
| `modeller.models.new` | MO-06 | `/modeller/models` › *New model* | differs | The dialog starts from *Describe it* (the assistant drafts) · *A file* · *A starter*. Today `ModelFormDialog` asks name, description and validation mode; file and starter are a separate `ImportModelDialog`; nothing drafts from a description | — |
| `modeller.models.new.ontology` | MO-15 | `/modeller/models` › `⋯` › *From an ontology* | built | — | — |
| `modeller.models.new.ontology.preview` | MO-15 | the same › *Preview* | built | The board draws the preview as a page; Studio keeps it in the one dialog (OI13) | — |
| `modeller.models.overview` | MO-07 | `/modeller/models?models_tab=overview` | differs | The head is *Models* · an *All models* select · count chips · *Save report* · *New model* · *Import*; live has no select and no *Save report*, and *4 models* where the board reads *4 published*. Live has seven tabs (Model and History included; the board has five) and a Models leftSection the board lacks. Needs attention has column heads and is capped with a *+N* overflow; live is uncapped | — |
| `modeller.models.database` | MO-07 | `?models_tab=database` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.usage` | MO-07 | `?models_tab=usage` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.performance` | MO-07 | `?models_tab=performance` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists, and an empty sixth tile | — |
| `modeller.models.growth` | MO-07 | `?models_tab=growth` | differs | The body is the board's; the head differs as on `modeller.models.overview` — no *All models* select or *Save report*, seven tabs, a Models leftSection, uncapped lists | — |
| `modeller.models.report` | MO-07 | the same › *Save report* › a saved report | missing | *Save report* on the models board and the frozen reading (*kept by … · it will not change* · *Back to live*). The shell's `useReport` exists and `LensBoardPage` uses it; the models board does not | — |
| `modeller.model.history` | MO-09 | `?model=<id>&models_tab=history` | built | Effect after reads runs and tokens while published; the board reads the dataset effect (*1 dataset now warns · 6 rows*). The page chrome differs as on `modeller.model.airroutes` | — |
| `modeller.worlds` | MO-10 | `/modeller/worlds` | differs | The board opens a lens canvas — type cards with hidden types dimmed and guarded properties shielded, a Lens strip — and a world inspector in the rightSection (Sees · Answers go · Used by). Today the Govern stack lists worlds over guardrails and the main area is a Graph card | — |
| `modeller.worlds.board` | MO-10 | `/modeller/worlds/<world>` | differs | `LensBoardPage` exists with KPI tiles, the layers, the cast and *Save report*. Live adds a leftSection and a workbook tab; the header actions are *Board* · *spec.json* · *Edit* · *Save report* · *Reports* (board *Edit*); there is no *compute* layer; the cast reads all denied and runs 0 (board 11); the breadcrumb shows the world's UUID where it must resolve the name | — |
| `modeller.guardrails.edit` | MO-11 | `/modeller/guardrails` › a guardrail rule | differs | A guardrail is one property rule (*When a run touches* · *It may Read / Read in counts only / Never read* · *the result May leave / Stays in the Graph*) with impact before saving. Today a guardrail is a lens of kind guardrail holding layered rules (`LensEditor` · `RuleBuilder`), and airways seeds one | `RunLensWidget` |
| `modeller.guardrails.request` | MO-11 | `/modeller/guardrails/<guardrail>` with a request | missing | A request bar over the canvas (*Decline* · *Allow in a world*) and a guardrail inspector (Rule · Refusals · History). The engine records no refusal as a request. The board has no request to open, so its route is the guardrail's own page (the landing is the honest shot) | — |
| `modeller.requests` | MO-13 | `/modeller/requests` | missing | A Requests page — Open and Done groups, each row's *Decline* · *Allow in a world* · *Model it*, a rail badge. The engine has no request record; Studio shows a locked empty state | `RequestsViewPanel`'s locked empty state |
| `modeller.rules` | MO-12 | `/modeller/rules` | differs | A Rules page — scope and *Checked on* filters, rows with scope · checked on · when broken (block · warn · report) and counts, *New rule*. Today `RulesViewPanel` lists Graph invariants only, *offered and cited, never enforced*; the engine's install · Graph · project rules (`/api/v1/rules`) are never called | `RulesViewPanel`'s invariant-only list; the main area's one-line card |
| `modeller.rules.edit` | MO-12 | the same › a rule | missing | A rule dialog: statement · scope · checked on · when broken · *Because* · what it would have stopped in 30 days. `RuleBoardPage` reads an invariant; no editor writes a scoped rule. Shot: a rule opens in the leftSection with *reword* and *Stop offering it*, and the main area stays the Graph card | — |
| `modeller.settings` | MO-14 | `/modeller/settings` | differs | A page with tabs Basic · Database · Members (LLMs stay in Agents › LLMs): name, description, instructions, *Save*, Archive. Today the form is `SettingsViewPanel` in the leftSection and the main area is a Graph card | `SettingsViewPanel` in the leftSection; the main area's one-line card |
| `modeller.settings.database` | MO-14 | `/modeller/settings?tab=database` | differs | The board is a full page with an editable URI, User and Password and *Save* · *Test connection*. Live is a read-only summary in the 280px leftSection (truncated URI) with *Edit* · *Introspect*, no *Test connection*; keyed `?tab=graph` | — |
| `modeller.settings.members` | MO-14 | `/modeller/settings?tab=members` | differs | The board has four members, five roles, *Edit* on each row and no agent rows. Live renders in the leftSection with Members and Roles stacked, eight members, six roles (an extra `iam-admin`), no per-row *Edit* and *Add member* in the panel | — |

## Not building

| Item | Why |
|---|---|
| OSI (Open Semantic Interchange) | It standardises BI metrics, not graph models |
| Ontology reasoning and inference | Open-world reasoning does not fit Invana’s validation, which rejects what is not allowed |
| An ontology editor | Protégé and similar tools already do that; Invana imports |
| Semantic export | Later; source IRIs are kept so it is cheap to add |
| An import UI | CLI and API only |
| Standards authoring here | Datasets owns standards |
