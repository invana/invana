# Invana Modeller — give it meaning

The source of truth humans and agents reason over. Prototype page: *Invana Modeller › Give it meaning*.

System design: [api-and-cli.md](../../specs/system-design/api-and-cli.md) — the CLI. This file keeps the CLI's build status.

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

MO-F01–F06 are specified in [specs/products/model](../../specs/products/model/product.md); the rows below wait for their phase.

| ID | Feature | Status | Stories |
|---|---|---|---|
| MO-F15 | Constraints from **SHACL**; schema from **GQL graph types** (ISO/IEC 39075) | Later | — |

## CLI — build status

What each command does, and the conventions, are in [api-and-cli.md](../../specs/system-design/api-and-cli.md). This keeps where each stands.

| Command | Status |
|---|---|
| `invana models list` · `starters` · `export` · `import` · `upgrade` | ✅ exists |
| `invana models export --with-records` · `import --file <bundle> [--with-records \| --restore]` | New |
| `invana models import --ontology <file\|url> [--types A,B]` | ✅ B12 |
| `invana models diff --name <m> v1 v2` · `history --name <m>` | New · P-09 |
| `invana models publish --name <m> [--dry-run]` | ✅ B10 |
| `invana stitches apply` · `list` · `resolve` · `commit` · `discard` | ✅ exists |
| `invana govern apply` · `list` · `show` | ✅ exists |
| `invana rules list` · `apply --file` · `show` | New · P-12 |
| `invana requests list` · `resolve <id> --allow\|--decline\|--model` | New |

## Decisions

| Decision | Detail |
|---|---|
| Imports | Moved to Datasets |
| Model in the settings modal | Read-only; editing hands off to the canvas |
| Rail → path | Global model `/modeller/global-model` · Models `/models` · Stitches `/stitches` · Requests `/requests` │ Worlds `/worlds[/:world]` · Guardrails `/guardrails[/:guardrail]` · Rules `/rules` │ Graph settings `/settings` (`?tab=`). Moving along the rail never remounts the page |
| Three boards, one leftSection | Each of Global model, Models and Stitches brings its own board forward as a Workbook tab: `global_model` (a full-bleed canvas), `models` (the dashboards) and `stitches` (a list). None has a leftSection, except one model's page, which has the model's outline there — Node types · Edge types · Stitches. There is no models list in the leftSection: a model is picked from the models board's rows, the global canvas or a breadcrumb |
| Stitch counts | `model_links.edges` is how many edges the stitch holds in the graph, re-counted after every solve that writes — a commit and every import's stitch step — and `null` before the first. A MERGE re-matches what it already wrote, so the number is counted, never summed |
| The Modeller's status bar | The footer on every Modeller page: the model with a draft — `<model> · vN active · vM draft · N staged` — and whether the draft validates, then on the right `N types across M models` from the global model's counts. No draft: the models count alone. Which model has a draft is the models list's `draft_version`, so the bar asks nothing per model |
| Graph settings tabs | A page with Basic · Database · Members (`?tab=basic\|database\|members`). LLMs are Agents › LLMs and the Graph's concurrency is Agents › Settings ([ST-F01](../../specs/foundation/settings/features/ST-F01-this-graph/feature.md)) |
| A rail move keeps the regions | A rail click carries `right`, `console` and `page`, so the docked chat, the Console and the Workbook's page stay open; the panel's own keys are dropped |
| No ✕ on a rail panel | Graph settings has no close control: its path is the panel, and closing it would leave the Modeller |
| Guardrails leads on its rail item | The Govern stack puts Guardrails first on `/guardrails`, Worlds first on `/worlds` |
| Main area with no board | Requests, Rules and Graph settings each say in one line what their main area is for, in Modeller words |
| Connect a database | The connection is the *Database* step of New Graph ([shell.md](shell.md) › *New Graph is a wizard*). When the database holds records, the *Draft a model from what is there* start reads it into an authored draft and Studio lands on that draft's canvas with the assistant docked ([SH-F02](../../specs/foundation/shell/features/SH-F02-create-a-graph/feature.md)) |

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
| `modeller.model.type.constraint` | MO-08 | the same › Constraints › a property (`&type_tab=constraints`, a row's *Edit constraint*) | built | The Constraints tab: *Properties and their constraints* (property · type · constraint · from, a pencil per row while a draft is open) over *Database constraints* (*Add constraint*, delete); the constraint dialog — *Range* min `to` max unit, *Or use a standard* with its hint, *When a record breaks it* Reject · Flag for review, the engine's *Today N records break it* naming up to five, *Remove constraint* when the property has one ([MO-F02](../../specs/products/model/features/MO-F02-change-and-publish-a-model/feature.md)). Left: the shot is AirRoutes › airport · `runways`, which has no constraints yet, where the board draws Chickpea › Variety with five; the unit is an input where the board prints it; the title and subtitle stack (kit `DialogHeader`); records are named by id, not a display name | — |
| `modeller.draft` | MO-04 | `/modeller/models?model=<id>&model_open=1&models_view=schema` on a draft | built | A full-bleed canvas — schema cards, toolbar, minimap — each changed type chipped and an added one dashed, the floating `N staged · Discard · Publish vN` bar, the crumb `<model> vN · draft`. The board tints the changed property *inside* its card (a `@invana/canvas` schema-card change); the Lens strip is M05's; the workbook tab reads the model's name | — |
| `modeller.draft.publish` | MO-05 | the same › *Publish* | built | *Publish* on a non-breaking draft lists the changes, *What it asks Neo4j to hold*, *Who reads* (the stitches and bound datasets — the engine has no reader record for agents, schedules or saved views) and *None of them break*. Hand-driven: the reproducible shot has no staged change, so no confirm opens | — |
| `modeller.draft.migration` | MO-05 | the same › *Publish* on a breaking draft | built | *Publish* on a breaking draft (a removed property): the *breaking* banner, the migration table counted after the request, *Why* and *Request approval*, as decided. Hand-driven: the reproducible shot has no staged change, so no confirm opens | — |
| `modeller.models.new` | MO-06 | `/modeller/models` › *New model* | built | One dialog — name, description, *Describe it* · *A file* · *A starter* — each landing on the new model's draft canvas | — |
| `modeller.models.new.ontology` | MO-15 | `/modeller/models` › `⋯` › *From an ontology* | differs | The dialog has no *Pulls in* column, and its footer reads *3 picked · types they depend on come with them* with no counts (board *3 picked · 4 pulled in · 7 types in the draft*) | — |
| `modeller.models.new.ontology.preview` | MO-15 | the same › *Preview* | built | The board draws the preview as a page; Studio keeps it in the one dialog (OI13). Skipped types read as prose lines, not rows, and there is an extra *Call it* field | — |
| `modeller.models.overview` | MO-07 | `/modeller/models?models_tab=overview` | built | *Models* · the scope picker · `N published` · `N stitches` · *Save report* · *New model* · *Import*, *Reports* behind `⋯`, five tabs, no leftSection; Needs attention with heads, six rows and `+N more in Usage ›`; a model's signal three and `+N` (MP50 · MP51). Table column heads are the kit's lowercase | — |
| `modeller.models.database` | MO-07 | `?models_tab=database` | built | The board's body under the models head; a relationship type several stitches share reads `N stitches`. The window stays drawn, greyed, where the board omits it (MP3) | — |
| `modeller.models.usage` | MO-07 | `?models_tab=usage` | built | Four tiles in a row (*Unused types* warns), model rows counting their signals, *Stitches crossed* the five most crossed under `N active · N crossed` (MP51). *View as table* on Each model is not built | — |
| `modeller.models.performance` | MO-07 | `?models_tab=performance` | built | Six tiles with *Advice · N missing indexes*, p95 a day, query shapes. The kit's tile has no info tone, so *Advice* reads muted where the board tints it | — |
| `modeller.models.growth` | MO-07 | `?models_tab=growth` | built | Four tiles in a row, records stacked by model, Each model. The chart's model colours follow the kit's series order, not the global model's hues | — |
| `modeller.models.report` | MO-07 | the same › *Save report* › a saved report | built | The open tab frozen: the banner `Saved report · <label> · kept by <user> on <date> · it will not change` with *Back to live*, the `saved report` chip, `Reports · N`, no tab strip; a link to a report lands on it (MP52). The banner sits above the head where the board draws it below | — |
| `modeller.model.history` | MO-09 | `?model=<id>&models_tab=history` | built | Effect after reads runs and tokens while published; the board reads the dataset effect (*1 dataset now warns · 6 rows*). The page chrome differs as on `modeller.model.airroutes` | — |
| `modeller.worlds` | MO-10 | `/modeller/worlds/<world>` | built | The lens canvas over the global model with the Lens strip, the world picker and the world inspector (Sees · Answers go · Used by), the Govern panel in the leftSection. `GlobalModelBoard` cannot dim a type or shield a property, so a hidden, sliced or guarded type wears a chip; a `*.*` guardrail is named once on the strip, not chipped on every type | — |
| `modeller.worlds.board` | MO-10 | `/modeller/worlds/<world>?page=world:<world>` | built | No leftSection; the head is the breadcrumb `Worlds › <name>`, the chips and *Edit* alone (it opens the world editor as a modal). Five tiles — Rules · Closed layers (a count) · In force · Runs over 30 days · Last used — the five layers with no *compute* (WO24) and the cast from `usage.by_agent`. *In force* names the Graph by its slug | `RunLensWidget` |
| `modeller.guardrails.edit` | MO-11 | `/modeller/guardrails` › *New rule* | built | The rule dialog: *When a run touches* · *It may Read / Read in counts only / Never read* · *the result May leave / Stays in the Graph*, impact counted before saving, a refusal shown in the dialog. The target picker is a plain select — the kit has no searchable combobox | a Graph guardrail as a lens (`LensEditor` keeps worlds) · the govern `ImpactDialog` · promote |
| `modeller.guardrails.request` | MO-11 | `/modeller/guardrails/<guardrail>?request=<request>` | built | The guardrail inspector (Rule · Refusals · History) beside the canvas, and the request bar with *Decline* · *Allow in a world*. The bar is a band above the canvas, not floating over it | — |
| `modeller.requests` | MO-13 | `/modeller/requests` | built | Open and Done, each row's *Decline* · *Allow in a world* (a guardrail's refusal) · *Model it* (anything else), the open count on the head and the rail badge | `RequestsViewPanel` |
| `modeller.rules` | MO-12 | `/modeller/rules` | built | One page, no leftSection: the purpose line, *Scope* and *Checked on* filters applied by the engine, every rule in force in assembly order (install · Graph · project), each row scope · checked on · mode · broken in 30 days with the mode as a badge, *New rule*. The rows sit in a folding *Rules N* group; the count chip has no *rules* word | `RulesViewPanel`'s invariant-only list; the main area's one-line card |
| `modeller.rules.edit` | MO-12 | `/modeller/rules/<rule>` · `?new=1` | built | A modal: Statement · Scope (fixed once saved, *Install* an install Admin's) · Check and its params · *Checked on* drawn from the check · When broken · *Because* · the 30-day impact read as the check changes. The board's *Finding* and *Record write* acts are not checked acts (rules.md Not building). *Open board* is offered on Graph and project rules only — an install rule has no Graph board | — |
| `modeller.settings` | MO-14 | `/modeller/settings` | built | A page with tabs Basic · Database · Members ([ST-F01](../../specs/foundation/settings/features/ST-F01-this-graph/feature.md)); the board's LLMs tab stays in Agents › LLMs. Basic leads with the setup timeline while setup is unfinished (the Info panel is gone) | `SettingsViewPanel`, `GraphTab`, `InfoTab`, the main area's one-line card |
| `modeller.settings.database` | MO-14 | `/modeller/settings?tab=database` | built | The summary card and editable URI, User and Password with *Save* · *Test connection*. Live keeps what the board omits: Database, Server version, Read-only, *Introspect* and a collapsed Capabilities row (GS8) | `ConnectionFields`, the shell's `GraphForm` |
| `modeller.settings.members` | MO-14 | `/modeller/settings?tab=members` | built | Members and Roles side by side, *Edit* · *Remove* per row, *Add member* in the page head. Live lists the engine's six roles: `owner` and `iam-admin` split the board's `owner` powers (members are `iam-admin`'s) | — |

## Not building

| Item | Why |
|---|---|
| An import UI | CLI and API only |
