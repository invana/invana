# for-developers — what stayed, for review

Every product, feature, story, journey and the system design now live in [`specs/`](../../specs/README.md). This
folder holds only what did not move. Each row below says what stayed, why, and where it would go — for Ravi to keep,
move or delete. Nothing here governs a product decision; where a file here and `specs/` disagree, `specs/` is right.

| Why it stayed | Means | The review |
|---|---|---|
| engine detail | Code layout, tables, routes, shapes, engine-only decision rows | Keep for the coder, or move into `specs/system-design/` once the shape settles |
| plan | A build order, a migration, build status, a test practice | Keep until the work lands, then delete |
| debate | An open question or an RFC still argued | Settle it; the answer goes to the feature it governs |
| retired | Contradicts the live model (`specs/design-language.md`, `specs/system-design/orchestration.md`) | Delete |
| not true yet | Planned but not decided | Specify it, or delete |
| moved, not cut | Its content is in `specs/`; the source was never cut | Delete |

## The pattern every module file follows

| File | What stays | Why | Where it would go |
|---|---|---|---|
| `modules/<module>/features/*.md` | *Surfaces* (components, params, regions) · *Engine* (tables, routes, events, shapes) · the Decisions rows that are mechanism only · *Where the code lives* — under a *Product spec:* or *System design:* line naming where the rest went | engine detail | `specs/system-design/modules/<module>.md` |
| `modules/<module>/spec.md` | *Vocabulary* — the domain terms code keeps (screen words are in `specs/glossary.md`) · *What this module owns* (tables) · the cross-feature decisions that are mechanism only | engine detail | `specs/system-design/modules/<module>.md` |
| Pointer stubs | `modules/graph-connectors/` (spec and four features) · `platform/features/admin-and-health.md` · `command-line.md` · `logging.md` | fully moved — one *System design:* line each | Delete once nothing links to them |

The tables per module below list only what differs from that pattern: retired, debated, planned or unplaced rows.
Where a feature moved is each product's *Features* table in `specs/capabilities/*/product.md`.

## Root files

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| [README.md](README.md) | This index · the old index's build status, open calls, retiring code, delivery slices and build rules (*Kept from the old index* below) | plan · debate (Open calls) | Open calls → the feature each governs, once settled; the rest is deleted as it lands |
| orchestration.md | §1–§15 — the earlier two-noun model (Task · TaskRun), worked examples, bounds, what is built · *Not building* rows *a plugin-registerable catalogue* and *distributed workers* | retired (§1–§3 and both rows contradict [the live model](../../specs/system-design/orchestration.md)) · plan (§12) · engine detail | Delete §1–§3 and both rows; the rest → `specs/system-design/orchestration.md` where still true |
| governance.md | The RFC: §1 the loop · §4 sub-worlds · §8 cost · §9–§11 the run and step drawings · §12–§14 where each decision lands and D1–D22 | debate (§9–§11, §13 drawing rows, D5 · D6 · D13–D16 · D20–D22) · retired (§0 *the agent binds the provider*, §3 Worlds' place and the settings tabs, D18) · plan (the dispersal paragraph) | Drawing decisions → AG-F03 and MO-F05; delete the retired rows; the file once dispersed |
| [terminology.md](terminology.md) | §1–§8, all — the domain terms code and docs keep | engine detail — screen words are in [`specs/glossary.md`](../../specs/glossary.md); its SU1 · SU7 citations now point at GR-F02 | `specs/system-design/` beside the glossary |
| the-screens.md | The 42 hi-fi artboards and every later canvas, one row each — built? on the kit? | plan — screen build status | Delete as each story's `## Screens` and the audits take it over |
| the-sequence.md | The build order of everything open, block by block, with what gates what | plan | Delete once its blocks land |
| architecture.svg | The services, Studio's packages and the engine's bands | engine detail | [`specs/system-design/architecture.md`](../../specs/system-design/architecture.md) |

## building-engine/

Every file is a **plan** — a pass, a migration or a code-shape target. None holds a product rule.

| File | What it plans | Where it would go |
|---|---|---|
| migration-plan.md | The engine's bands, the import rule, package shape, and the measured distance to it | `specs/system-design/architecture.md` for the rules; delete the plan once done |
| refactor-plan.md | How migration-plan's moves are made safely, per commit | Delete once done |
| task-model-migration.md | Eight tables → Todo · Flow · Task · TaskRun, column by column, slices M1–M8 | Delete once done; the target is `specs/system-design/orchestration.md` |
| the-runtime-package.md | One package walks every plan; the file-by-file move | Delete once done; the target is `specs/system-design/runtime.md` |
| lens-migration.md | Slice S16's build order, P0–P6 | Delete once done |
| govern-and-agents-data-model.md | `lenses`, `run_touches` and the agent changes; four signed-off decisions | Settled shapes → `specs/system-design/modules/govern.md` · `agents.md` |
| boards-migration.md | `canvases` → `boards` with a declared kind | Settled shapes → `specs/system-design/modules/explore.md` |
| graph-ops-as-tasks.md | Every graph read and write as a catalogue callable | Delete once done |
| skills-pass.md · skills-draw-as-plans.md · a-skill-uses-a-plan.md | The three Skills passes | Delete — the first is closed; the other two once built |
| workers-and-orchestration.md | The executor options and the benchmark that chose one | Delete — the choice is in `specs/system-design/runtime.md` |

## building-studio/

Every file is a **plan** or a build rule for Studio's code. None holds a product rule; the boards and the design
language do.

| File | What it plans | Where it would go |
|---|---|---|
| code-shape.md · refactor-plan.md · cleanup.md | Today's Studio → feature modules on the kit, and how each move is made | Delete once done |
| [design-kit-coverage.md](building-studio/design-kit-coverage.md) · [canvas-ui-coverage.md](building-studio/canvas-ui-coverage.md) · [components-todo.md](building-studio/components-todo.md) | What each screen composes from, and what the kits still lack | Keep while the kits grow; component requests go to the designer's queue |
| the-shell.md · graph-detail-page.md | The shell's regions and the one graph page | retired where [`specs/design-language.md`](../../specs/design-language.md) §2 replaces the regions; delete then |
| govern-and-agents-panels.md · skills-boards.md · drawing-repetition-and-gates.md | Panels and boards for Govern, Agents, Skills and the plan canvas | retired where the Agent-version boards replace them; delete then |
| [graph-model-canvas.md](building-studio/graph-model-canvas.md) · [task-flow-canvas.md](building-studio/task-flow-canvas.md) | Two canvas components and their callers | engine detail — keep for the coder |

## modules/

### agents

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 5 Surfaces · 5a The drawn states | retired — the Agent Builder, Fleet and Activity surfaces, an older canvas | — |
| `spec.md` | 3a — `envelope` *stored as workflow_spec today* | not true yet — build status | — |
| `features/the-agents-shell.md` | The whole file | retired — the rail-and-workbook shell, launcher groups, Fleet, Activity; the design language replaces them | — |
| `features/author-an-agent.md` | Decisions AG12 · AG23 · AG34 · AG36–AG38 · Not building *Cross-Graph agents* | retired — the drawer and the eleven-tab page; an agent is a sheet and install-wide (AG-F02) | — |
| `features/author-an-agent.md` | Decisions AG5 | not placed — *work that names no view runs in Everything* | MO-F05 Rules |
| `features/soul.md` | Decisions SO7 | retired — a Soul tab; the voice sits on Setup | — |
| `features/pinned-model-versions.md` | Decisions PV1 · PV5 · PV7–PV10 · PV12–PV15 | plan — re-running on recorded versions belongs to a run | AG-F03 |
| `features/pinned-model-versions.md` | Decisions PV16 | retired — *Settings › LLM providers* and the Agent Builder as places | — |
| `features/the-agent-page.md` | Decisions AP1 · AP7 · AP30 · Not building *Soul's How it speaks* · *Deploy's resource → pool mapping* · *An event trigger and pool labels* · *At 02:00 forecast* | retired — the eleven-tab page · engine detail — pools are RT-F03's | RT-F03 |
| `features/the-agent-page.md` | Not building *Assistant proposals marked on the builder* · *Effort as low · medium · high* | debate — AG-26 specifies the proposals; the boards draw effort (AG-F01 › Open questions) | AG-F01 once settled |
| `features/install-wide-agents-and-skills.md` | Preamble · Two places · Journeys *Moving between the two places* · Seams *A platform product opened from a Graph* · Decisions WD13 · WD18 · Not building *An Agents product in a Graph* | retired — the platform / Graph split and product names as places | — |
| `features/install-wide-agents-and-skills.md` | Capabilities C9 · C11 · Seams *A Graph near its monthly tokens* · Journeys *A run goes badly* · Decisions WD14 · WD16 · WD19 · Not building *Workers owned by a Graph* · *Rendering as a skill* | plan — each graph's limits, models and workers; versions across graphs | RT-F01 · RT-F04 · AG-F03 · AG-F04 |
| `features/install-wide-agents-and-skills.md` | The core agents · Decisions WD3 | debate — the shipped assistants are named after retired products | AG-F02 Rules once named |
| `features/install-wide-agents-and-skills.md` | Decisions WD6 · Not building *Per-agent budgets* · *Building without an install Admin* | debate — only an Admin builds and spend is per graph, against *Can build agents* and each agent's budget (AG-F01 · AG-F02 › Open questions) | AG-F01 · AG-F02 once settled |
| `features/fleet-performance.md` | Capabilities C9 · Surfaces (LLMs) · Decisions FP12 · FP16 | plan — who pins a model | RT-F01 |
| `features/fleet-performance.md` | Decisions FP13 · FP15 · FP17 | retired — the Agent Builder's pages and rail | — |
| `features/providers-and-models.md` · `concurrency-and-contention.md` · `workers.md` | Decisions PM6–PM8 · the ceiling in Graph settings · Fleet and Agents › Workers | retired — Settings › AI and connections and Settings › Workers replace them | — |

### ask

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 5 What this module owns · 7 Cross-feature decisions · 7a The drawn states · 7b A session executes through plans · 8 Deliberately absent | engine detail — kept by choice beside the [system design](../../specs/system-design/modules/ask.md); the product halves are in the Explore product | `specs/system-design/modules/ask.md` |
| `spec.md` | 6 *Not one dispatch per step* · *Step granularity is reported* · *No external infrastructure* · *One runtime exists* | retired — steps travel as envelopes to in-process or remote workers | — |
| `features/the-assistant.md` | Decisions AD14 *The panel is called Ask Assistant* | retired — the header reads *Assistant* (EX-F03) | — |
| `features/the-answer-surface.md` | The half-built re-run note | plan — the re-run gap, cited to EX-02.9 | — |
| `features/clarifying-questions.md` · `streaming-and-the-workflow.md` · `reasoning-trace.md` | The ⚠ orchestration banner | plan — the task-model migration note | — |
| `features/runtime-and-adapters.md` | *Today* · *Retired* (queues, brokers, backfills, fair-share) | plan · retired — pools are fair-share; procrastinate is the queue | — |
| `features/act-as.md` · `beyond-the-graph.md` · `fork-a-session.md` · `when-it-cannot-answer.md` | Every section | moved, not cut — the stories are EX-24 · EX-26 · EX-27 · EX-05 · EX-06 in EX-F05; *Engine* is engine detail | Cut all but *Engine* |

### bring-data-in

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 2 *Studio does not write* · 4 What this module owns · 5 the *Studio* row · 7 BD6 · BD9 · 7a The drawn states · 8 *Import from Studio* | retired — Upload in the browser mints versions (DS-16); datasets are install-wide; old artboards | — |
| `features/datasets.md` | Decisions DT17 | not placed — drafts pushed by a narrowed token | AC-F02 |
| `features/retract-and-refresh.md` | Decisions DR3 | plan — flags on findings and Inbox items land later | — |
| `features/bind-a-dataset.md` | Decisions BV3 | retired — any member binds; DS-F03 says *Can shape the model* | — |
| `features/load-data.md` | Decisions LD5 · Not building *Import from Studio* | retired — Data › Upload (DS-16) | — |
| `features/load-a-bundle.md` | *The problem this closes* · *It is a workflow, not a new concept* | plan — the defect the bundle closes (DS-18's *so that*) | — |
| `features/inspect-what-landed.md` | Decisions IW7 · Not building *A journal across Graphs* | retired — imports live in Data › Upload | — |
| `features/inspect-what-landed.md` | Not building *A data browser over the whole graph* | not placed — Explore's job | EX-F01 Not building |
| `features/standards.md` | Not building *Validation queue items from violations* | retired — the queue exists (DS-07) | — |

### connect-and-model

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 1 Vocabulary · 3 What this module owns · 6 CM7–CM11 · 6a The drawn states | engine detail · retired (CM11 the Models page layout · 6a old wireframes) | `specs/system-design/modules/connect-and-model.md` · — |
| `features/model-editor.md` | Decisions ME6 · ME8 · ME10 · ME13–ME19 · ME21 · *Deprecated surfaces* | retired — the old panel, form and banner; the kind peek and draft bar replace them | — |
| `features/stitch-models.md` | Decisions ST9 · ST12 · ST22 · ST24 | retired — rail items and the Stitches drawer and page | — |
| `features/the-model-page.md` | Decisions MP4–MP6 · MP18 · MP24 · MP42 · MP45–MP48 · MP50 | retired — the Models board and panel layout; binary membership | — |
| `features/connect-a-database.md` | Capabilities C9 · Journey · Surfaces `/graphs/new` · Decisions CD11–CD13 | plan — the create-a-graph flow | GR-F02 |
| `features/connect-a-database.md` · `graph-settings.md` | Surfaces (the Graph settings product and its boards) · Decisions CD8 · CD10 · GS1 · GS3 · GS4 · GS10 | retired — Settings › This graph replaces it · engine detail | — |

### explore

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | Preamble · 6 E5 · 6a The drawn states | retired — *one rail*; the assistant is Explore's (EX-F03); old wireframes | — |
| `features/graph-canvas.md` | Not building *Editing data from the canvas* | retired — data edits are EX-F06 | — |
| `features/boards.md` | Decisions CV6 · Not building *Sharing a board with a link* · *A row for every board opened* | retired — toolbar cards; a live link exists (EX-15) | — |
| `features/selection-and-the-panel.md` | *What the panel shows, per kind* | not placed — the `model · plan · workflow · envelope · lineage` rows | MO-F02 · PJ-F01 · AG-F06 · AG-F05 |
| `features/selection-and-the-panel.md` | Surfaces (the Explorer panel) · Decisions SP2 · SP6–SP12 · Not building *Context menus* · *Editing data rows from the panel* | retired — the rail's Legend, right-click menus and Edit mode exist | — |
| `features/share-an-answer.md` | Not building *Export from the CLI* | engine detail — CLI | `specs/system-design/api-and-cli.md` |
| `features/walkthrough.md` | Surfaces · Decisions WT1 · WT7 | retired — Present is a mode, not a toolbar button | — |

### govern

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 4 Decisions GV17 · GV18 · GV25 · GV37 | retired — the Govern leftNav item, its drawers and the locked strip; `model.rules` replaces them | — |
| `features/worlds.md` | Decisions WO8 · WO15 · WO16 · WO25 | retired — the drawer drill-in and drawer-versus-board split | — |
| `features/guardrails.md` | Decisions GR22 | plan — migrating layered Graph guardrails to rules on properties | — |

### identity-and-access

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `features/accounts.md` | Surfaces (`/profile`) · Decision AC6 | retired — Settings › You replaces the profile page | — |
| `features/tokens.md` · `policies.md` | Surfaces (Profile › Access tokens, `iam.*` pages) · Not building *Worker-seconds and pools enforced* | retired Studio surfaces · plan | AC-F02 · RT-F03 |
| `features/policies.md` | Not building *The assistant's proposal card in the conversation* | retired — the draft is drawn in the access sheet | — |
| `features/roles.md` | Decision RO17 | plan — the members surface | GR-F04 |
| `features/roles.md` | Not building *Request access on a read-only surface* | debate — the board links *Ask the owner* to the Inbox (AC-F02 › Open questions) | AC-F02 once settled |
| `features/roles.md` | Not building *Agents in the Members table* | retired — agents are members | — |
| `features/effective-access.md` | Not building *An access ask raised by a refusal* · *The token layer at dispatch* · *Projects as resources* | plan | AC-F02 · PJ-F01 |
| `features/the-iam-product.md` | Surfaces (`/iam/*`) · Decisions IP1–IP4 · IP6 | retired — IAM is *Settings › People and access*, a sheet | — |
| `features/membership.md` | Decision MB5 | retired — agents are members | — |

### memory

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 1 Vocabulary · 5 What this module owns · 6 Flows · 7 Cross-feature decisions · 8 Deliberately absent | engine detail — kept by choice beside the [system design](../../specs/system-design/modules/memory.md); 6 is moved, not cut (EX-F07's journey) | Cut 6 |
| `features/evidence.md` · `recall-by-query.md` · `proposals.md` · `consolidation.md` | Every section | moved, not cut — the stories are EX-29–EX-32 in EX-F07; *Engine*, *Shape* and proposals' *Open* are engine detail and debate | Cut all but *Engine*, *Shape* and *Open* |

### operate

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 7 O9 (the Activity page and its seven tabs) | retired — the Inbox modal and Agents › Runs replace it | — |
| `features/observability.md` | Capabilities C1 · C2 · Decisions OB4 | debate — latency by step kind is not specified; spend contradicts *tokens, never currency* | AG-F03, if wanted |
| `features/approvals.md` · `notifications.md` | Surfaces (pages, the bell, tray, toast, Activity tabs) · Decisions NT11 · NT12 · Not building *A plan node's approval gate* | retired — the Inbox answers in the row | — |
| `features/approvals.md` | Decision AP13 (*For you · All · Answered*) | debate — whether answered asks stay in the Inbox (AC-F05 › Open questions) | AC-F05 once settled |
| `features/the-ledger.md` | Decisions LG17 · LG18 (preset chips) | plan — chips the History board does not draw | — |
| `features/external-agent-api.md` | Capabilities C6–C8 · Seams · Decisions EA6 | plan — key limits and revocation · retired (tokens in Settings › Graph) | AC-F03 |

### platform

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 2 Studio builds from the kit · 2a The drawn states · 6a Studio end-to-end tests | plan — build rules and test practice the build skills own | — |
| `spec.md` | 2b The app shell · 3 radius and density rows · 6 *decorated service methods* | retired — the work-panel shell; telemetry dropped the decorators | — |
| `features/design-system.md` · `telemetry-cleanup.md` | The whole files | plan — a build rule and a clean-up list | — |
| `features/setup.md` | 5 Surfaces (the island, the cap, the band) · Decisions SU5 · SU7 · SU8 · SU10 · SU16 · SU18–SU21 · SU27 · Not building | retired — Create a graph is a modal; the setup timeline sits in Settings › This graph | — |
| `features/setup.md` | Decisions SU23 · SU25 · Not building *A watch it step* · the index lineage | debate · plan | `specs/system-design/modules/platform.md` |
| `features/runtime.md` | 3.1 every kind · 21 How this lands · the *Today* columns | plan — build status | — |
| `features/runtime.md` | *Retired* — kind on the todo · membership as permission · approval columns · `run_logs` · `idem_key` on todos · *does not distribute* | retired — superseded by the live task model | — |
| `features/distributed-execution.md` | The benchmark · Engine paths · Plan | plan — the results that chose the executor | — |
| `features/tool-plugins.md` · `this-graphs-mcp-server.md` | Decisions TP18 · Surfaces `agents.connections` | retired — Settings › AI and connections replaces them | — |
| `features/telemetry.md` · `list-contract.md` · `metrics-are-stored.md` | *Stayed* · *Not building — plan* · *Phases* | plan | — |

### skills

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 3 the `rules` · `rule_versions` rows · 5a The drawn states · Decisions S2 · S4–S7 · Not building *Rules that execute* · *Cross-Graph skill sharing* | retired — MO-F06's three scopes and checked rules; skills are built once for the install | — |
| `features/authoring-a-skill.md` | Journey *The skill's page* · Surfaces · *Surfaces, as drawn* · Decisions SK4 · SK16 · SK27 · SK36 · SK37 | retired — the drawer, five-tab page and left-to-right Flow | — |
| `features/authoring-a-skill.md` | Decisions SK12 (a redraw shown as a diff) | debate — the skill sheet draws no diff | AG-19, once Ravi settles it |
| `features/evals.md` | Decisions EL15 · EL7 | debate (evals as a mode of Instructions) · plan (an eval set on a schedule) | AG-F04 · AG-F07 |
| `features/instructions-publish-rollback.md` | Surfaces *Agent page › Instructions* · *History* · *Revisions in runs* · *Library › Plans* | plan — AG-36 and AG-F06 hold them | — |
| `features/the-skill-page.md` | Not building *Records of which handler fired* · *Ask an owner on a locked skill* · *A skill that writes needs a Graph owner* | debate (AG-F04 › Open questions) · plan | AG-F04 · AC-F02 |
| `features/usage.md` | Surfaces *Evidence page* · *The Usage board* · *The migration* | plan (Evidence is EX-29) · retired (the Usage board) | EX-F07 |

### work

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 3 the retired status machine | retired — status is derived from the latest run | — |
| `features/recurring-tasks-and-conditions.md` | *Not moved — recurring task templates* | debate — contradicts AG-F07's one kind of schedule (PJ-F01 › Open questions) | AG-F07, if wanted |
| `features/objectives-and-criteria.md` | *Constraints this puts on the engine* · Open Q3 | engine detail · debate (rule priority) | MO-F06 |
| `features/review.md` | *Approvals in the queue* C4c (amend the gated call) | debate — AC-F05 decides an ask as shown (AC-F05 › Open questions) | AC-F05, if wanted |
| `features/projects-and-tasks.md` | The ⚠ rewrite banner | plan — the task-model migration note | — |

### workflows

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| `spec.md` | 3 *There are no plan versions* · Decisions F3 · F6 · Not building *Cross-Graph workflow sharing* | debate — AG-F06 reads versions; plans per graph against agents built once for the install (AG-F06 › Open questions) | AG-F06 once settled |
| `features/the-catalogue.md` | Decisions CA4 · CA9 | retired — the catalogue drawer of the Tasks stack | — |
| `features/the-library.md` | Decisions LB37 · LB39 | engine detail — how the plan page is drawn | AG-18 |

## docs/products/

The product plan Studio was redesigned from. Its stories, boards and decisions now live in `specs/capabilities/`; what is
left is the superseded plan, build status and engine notes.

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| README.md | Header · The products · Two places · Prerequisites P-01–P-22 · Terms · Conflicts · Open registry · Not building | retired (products as places, the launcher, the five-product ceiling) · plan (prerequisites, the registry phases) · not placed (*Author chain* · *Constraint*) | *Author chain* → DS-F01 · *Constraint* → MO-F02; delete the rest |
| explorer.md | Header · CLI build status · *Drawn, not built yet* · Not building | retired (*no product rail*) · plan | Delete; the gaps are designer and coder work on EX-F01–EX-F06 |
| modeller.md | Header · CLI · Decisions (the rail, its pages, *Graph settings tabs*) · *Studio today, mapped* · Not building | retired — the rail and its pages; Settings › This graph replaces Graph settings · plan · engine detail (stitch counts) | Delete |
| datasets.md | Header · CLI build status · Decisions *Paths carry the publisher* · *Imports tiles are the engine's* · *Launcher position* | plan · engine detail · retired (the launcher) · not true yet (`datasets pack · unpack`) | `specs/system-design/modules/bring-data-in.md` · api-and-cli.md |
| projects.md | CLI · Decisions (the rail-and-stack layout, *Staffing people*, *Assignees*) | retired · debate — Studio cannot staff others yet (PJ-F01 › Open questions) | PJ-F01 once settled |
| shell.md | Header · Layout · Activity · CLI · Decisions (the tray, page heads, schedules naming a plan, Activity) | retired — `specs/design-language.md` §2 holds the live frame · engine detail (one host, the CLI) | `specs/system-design/architecture.md` · api-and-cli.md |
| agent-builder.md · platform.md · iam.md | Header · decisions on runs, skills, install settings, Fleet, the IAM rail | retired — the Agent Builder, Fleet and IAM as places · plan — owned by AG-F03 · AG-F04 · AC-F02 · RT-F03 | Delete |
| agents.md · agent-fabric.md | The superseded Agents product and Agent Fabric: features, stories, decisions, the function library | retired — superseded twice (the two places, then the design language) · plan — each subsection with its feature | Delete once AG-F01–AG-F07 and RT-F02–RT-F03 are reviewed |
| plugins.md | Words · the manifests · how a flow runs across workers · where it is administered | debate · engine detail · retired surface | `specs/system-design/modules/` (platform) |
| scale-out.md | The proposal: durable runs, envelopes, leases, queues, pools, scale-down | engine detail · debate — *Pools* by policy and KEDA contradict Settings › Workers, scaled by hand | `specs/system-design/runtime.md` once settled |
| migration-plan.md | Studio's move to products in two places, phases and session rules | plan — superseded by the design language | Delete |
| onboarding.md | A pointer to GR-F02 | fully moved | Delete once nothing links to it |

## docs/system-design.md and docs/system-design/

| File | What stayed | Why | Where it would go |
|---|---|---|---|
| system-design.md | §1 the *Bounded* row and the in-process runtime · §1.1 · §1.2 the simulation sentence · §2 the retired terms · §5 five behaviours | retired — binary membership, the Thought/Thinking model, *derived, never stored*, in-process only | Delete; §5's true half → `specs/system-design/architecture.md` once restated |
| system-design.md | §4.1 Bootstrap · 4.2 Sign in · 4.4 Author a model · 4.7 Ask · 4.8 How a run assembles · 4.13 Serving the Graph to an external agent | engine detail | `specs/system-design/api-and-cli.md` · runtime.md · orchestration.md · `modules/connect-and-model.md` |
| system-design/system-design.md | An earlier whole-system design: goals, layers, entities, access, connectors, evaluation, personas, conflicts, open questions | debate — nothing in it is marked built; `specs/system-design/` is the current shape | Delete once reviewed against `specs/system-design/` |
| system-design/migration-plan.md | How the engine's code would move to that design | plan — nothing has moved | Delete with it |

## Kept from the old index

Build status, open calls, retiring code and the delivery slices, as the old index left them. **plan** — each part
is deleted as its work lands; an open call, once settled, becomes a decision in the feature it governs.

### 5 · Agents — build status

**Reopened by S16.** An agent binds no provider: it carries an envelope, a budget and a **lens**,
and the lens's cast names the model ([A1](modules/agents/spec.md) · PM1).
That drops `agents.llm_config_id` and `llm_providers.is_default`, splits `llm_providers` into a
provider row and its models, and reopens four rows below. The shapes:
building-engine/govern-and-agents-data-model.md.

### 14 · Govern — build status

**What a run may *see*, *use* and *send*.** [Operate](modules/operate/spec.md) answers *what
happened*; this answers *what was allowed to happen*. One `Lens` record, five governed layers, and a
touch record that makes the declaration checkable. Decisions: governance.md.

**A lens is authored, enforced, and recorded — and the record is checkable.**
`lenses` and `run_touches` exist, the rule grammar and its three laws are enforced, the ladder and
both authoring refusals work, and the routes serve. Past that, a lens now **runs**: the interpreter
checks an address before dispatch and refuses in place
([`plugins/sdk/context.py`](../../engine/src/invana/plugins/sdk/context.py) `engage` · `engaged`),
writes the touch after the call (`touched`) and decides egress per crossing (`egress_for`); the
openCypher connector composes the predicate and rewrites the projection
([`connectors/cypher/lens.py`](../../engine/src/invana/graph/connectors/cypher/lens.py)), refusing
before the wire at [`base/connector.py`](../../engine/src/invana/graph/connectors/base/connector.py),
and Gremlin **declares itself unsupported** rather than reporting a lens it does not enforce
(CC12). It is covered live, against a
real database, by `tests/govern/` and `tests/graph/connectors/opencypher/test_lens_live.py`.

**What the record says is now what the features promise.** The four calls that stood between these
rows and ✅ are settled and built: the touch carries the compiled slice and the exclusions **per
type** ([WO17](modules/govern/features/worlds.md)), compare diffs `applied` on the addresses both
runs reached ([WO18](modules/govern/features/worlds.md)), `rows_available` is retired rather than
paid for — one unsliced execution on every governed read was the price, and *what narrowed this* is
the actionable half anyway ([WO19](modules/govern/features/worlds.md)) — and a **closed-layer
refusal names the world and the layer**, since no rule fired and `rule_matched` has nothing to hold
([GR15](modules/govern/features/guardrails.md)). The CLI stays 🟡: `invana govern` has `apply`,
`list` and `show`, and nothing else.

Sixteen artboards across both features and the run they produce
(the-screens § Govern and Agents). The schema is
building-engine/govern-and-agents-data-model.md;
the components and the build order are
building-studio/govern-and-agents-panels.md. S16 also
reopens §5 above, because a lens on an agent is what replaces the provider on it.

### Where the work sits

| | ✅ | 🟡 | 🔵 | — |
|---|---|---|---|---|
| API | 63 | 19 | 15 | 6 |
| CLI | 23 | 10 | 4 | 66 |
| Studio | 55 | 20 | 19 | 9 |

A hundred and three features. **These counts are the tables above, counted** — if a cell is flipped, they
are recounted in the same edit, because a summary that disagrees with what it summarises is worse
than no summary.

- Modules 3 · 4 are closed: **Ask · Explore** — Explore grew **4.5**, sharing an answer, drawn in Studio by C09 over routes it already had. **Connect and model reopened at 1.9 and grew 1.10** — the publish review (B10) and the ontology import (B12) ship API and CLI; Studio draws 1.9 (C04) and 1.10 (C08). **Agents reopened at 5.1 · 5.2 · 5.3 · 5.7** — S16 moves the model off the agent and onto the lens. What is left is 2.3, 5's four rows, and 6–14.
- **Bring data in reopened at 2.3 and grew 2.4–2.8**, the dataset record above Graphs (B03), the standards it is scored against (B04) and the SKOS import that makes one (B12, drawn in Studio by C08). **Rules (6.4) reopened in Studio**: B04 added install scope and checked rules, which Studio does not draw yet. Its two shipped features are done; the bundle load is new scope, and it is the flow the runtime's deferred frontier, lanes and `uses` were waiting for ([13.8 §21](modules/platform/features/runtime.md)).
- Studio is no longer the lagging side for the closed four; the remaining 🟡 and 🔵 sit in Skills, Workflows, Memory, Work and Operate.

### Shipped

What has actually landed, newest first. A slice is here only when it runs from a clean checkout.

| Slice | Landed | What |
|---|---|---|
| S9 · S14 (Boards) | 2026-09-21 | **A kept reading is findable, and a step board knows its own run.** `Reports` sits beside `Save report` on a declared board's **own** header — a canvas' History is a strip control only because a canvas has no header to hang one on, so the strip's `data`-only gate never grew (B21) · one card behind two bindings, `boardVersions` by `board_id` and `boardReports` by `(kind, subject_id)` · a report row **opens**, it does not restore, because the live board is always there and there is nothing to fork into (B22) · `TaskRunRead.parent_run_id`, so a step board opened cold reads its own row for the run whose trace it is in, rather than carrying it in the address ([SR44](modules/operate/features/see-what-ran.md)) · a rule's statement in the trace dialog closes the trace and opens that rule's board ([RU13](modules/skills/features/rules.md)). Drawn as *Explore › Boards — 4.2* on the Govern, Agents and Skills canvas, rows 34u–34x |
| S5 · S12b · S12c (Skills) | 2026-09-19 | **Skills, all but one check.** A skill is its versions — `skill_versions` with publish-on-edit, the previous one still resolving, and the prose diff · a step records the **version** it was offered, so *offered 40, applied 31* is a claim about one text and v4 starts its own count · a binding is a row (`skill_bindings`, owned by Skills) with `POST`/`DELETE …/agents/{id}/skills/{skill_id}` and its two events, replacing the JSON array nobody could refuse one skill from · `rules` · `rule_versions` end to end: one statement, two scopes off one column, offered as discrete numbered lines in a fixed order and cited back per step, deactivated rather than deleted · usage by version, by agent and by outcome, with `enough_to_read` instead of a percentage. **[BN5](modules/skills/features/bindings.md)'s bind-time check is not in it** — the envelope half needs a skill's plan (M8) and the lens half needs an agent's lens (lens-migration), and a bind is never refused on grounds it did not check |
| S12e | 2026-09-09 | **Agents, closed.** The Graph's ceiling: `max_concurrent_task_runs` and a policy (`queue` · `refuse`), a slot per run with delegated children counted, a person served before a schedule, a queue with a readable position, a refusal that names the bound, and `GET …/contention` behind the counts in the settings form. The **Coordinator** is seeded as the one agent that may delegate — bounded at depth 2 and three children — so the path is reachable at last, and a child's trace nests under the step that spawned it |
| S12 (Explore) | 2026-09-09 | **Explore, closed.** The assistant: the Sessions panel moved to the right side as the `assistant` occupant of `?right=`, the canvas selection riding above the composer as a named, removable chip, and the trigger in the header's panel controls. Node expand and the canvas version-history timeline were already built; the index said otherwise |
| S9b–S9f | 2026-09-09 | **Ask, closed.** `emissions` — an answer is a record now, so it survives a reload · five result templates shipped, `accepts` checked before render, the switcher on the emission header offering what else fits and why the rest cannot · `projection_templates` and `task_prompts` with authoring · `task_runs.outcome` (`answered · cannot_answer · failed · cancelled`) · `GET …/task_runs/{id}/trace` and the trace opening from an emission's own citation · the cannot-answer card and the diagnosis drawn as different things |
| S6 | 2026-09-09 | **Bring data in, closed.** `--model` is required and names an authored model — nothing is derived from the data · per-record validation with the report grouped by reason · edges whose endpoints resolve nowhere rejected naming both · provenance (`dataset · file · record · job`) stamped on every element and read back both ways · the run is a run (`dataset-import@1`, four steps) so its trace is the step card an answer uses · Studio's read-only Datasets panel and the node inspector's provenance line |
| S7 | 2026-09-09 | **Connect and model, closed.** Portable model identity (`package_id` + `content_hash`) with export · import · upgrade on both the CLI and the API · `memory` and `provenance` starters as ordinary artefacts · `model_links` with the resolve preview and the derived global model · the staged set with discard-one, discard-all and a one-action commit · Studio's Model panel (authoring, not a browser), the Links panel, and the connection as a group inside the settings form |
| S12d | 2026-09-06 | Delegation: `spawn_agent · delegate · await_delegations · create_task` as envelope-gated steps, bounds enforced by the interpreter. **Not yet exercised end to end against a live provider** — no seeded agent allows them |
| S12c | 2026-09-06 | Agents with lineage and bounds · agents, lineage and activity routes · pause / resume / retire with the open-task preview · the Graph default · skill usage · the workflow library with promote and YAML export |
| S12b | 2026-09-06 | `projects · project_assignments · tasks · todo_dependencies` · the status machine · cycle rejection naming the loop · the derived plan (waves · blocked_by · critical path) · one run per assignment · the activity tree |
| S12a | 2026-09-06 | Principals: `actor_kind` plus the causal columns · an agent event without `on_behalf_of` is refused · skills offered and applied recorded per step |
| S9d | 2026-09-06 | `understand · plan · verify` steps · the plan on the run · dispatch-time validation of plan ⊆ envelope |
| S9c | 2026-09-06 | Agents table and seeded rows · sessions and task_runs carry the agent and its version. **The external-scheduler adapter designed for this slice was never built** — the inline runtime is the only one |
| S9b | 2026-09-03 | `runs · task_runs · task_runs · task_stream` · the runtime protocol with the bundled inline adapter · todo and run API with SSE · the deterministic seeded workflow · the coarse failure classifier |
| S5 · S5.5 | earlier | Skills · LLM providers · the append-only event record with its live tail |
| S2 · S3 | earlier | Connection with test-before-save and introspection · model authoring and the canvas |
| S1 | earlier | Accounts · usernames · sessions · binary membership |

### Partly built

Where a 🟡 stops, so nobody re-derives it from the code.

| # | Feature | Built | Missing |
|---|---|---|---|
| 7.1 | The library | Library list and detail | Served rate, match counts, and the diff view |
| 9.1 | Projects and tasks | Tables, status machine, derived plan, activity tree | The live step list on a task; `needs_input` rendering; cross-project dependencies |
| 11.1 · 11.3 | Accounts · Sessions | Users, bcrypt, JWT access and refresh, superuser-provisioned register, `invana users create --superuser` | Account self-service edge cases — sole superuser and owns-a-Graph refusals; the profile tabs |
| 13.1 | Design system | Themes, the kit at `0.0.20`, the shared panel skeleton, the emission card with its six bodies, the projection picker, and the cannot-answer and diagnosis cards | The surfaces modules 6–13 still need — see each feature's own row |
| 10.5 | See what ran | The Runs panel and its filters, the run board and the step board, reports kept and reopened | Keyset paging and the paced live tail; how a retention-purged run renders; the CLI verb |
| 13.3 | Command line | `invana users` | `start · migrate · version` as documented |
| 13.7 | Setup | The six derived steps, the three gates as route dependencies, the provider's remembered ping, the board on the graph page, the Info panel's timeline, and the Assistant's lock | Locks on the other gated surfaces (Explorer, Model, Imports), and the four artboards |


### Open calls

Not features, and not tasks. Each is a **decision somebody has to make** before the code around it
can be finished, and each has two defensible answers — which is why none of them has been taken
quietly. They live here because the notes that used to carry them were session files nobody was
told to read; a record kept where it is not read is not a record.

When one is settled, it leaves this table and becomes a numbered decision in the feature or module
it governs ([Rules § 1](../../CLAUDE.md)).

| # | Open | The call | Whose |
|---|---|---|---|
| 1 | The **executed** query's text is nowhere — only its digest. The step board prints a count beside a query that returns something else if you run it | record `executed` beside the digest, or say the citation is the **generated** query and the digests are the proof | [14 Govern](modules/govern/spec.md) · [10.5](modules/operate/features/see-what-ran.md) |
| 2 | `capabilities` ranks are **seeded, never maintained** — a model added through the API gets `{}`, so the cast treats it as neither cheap nor capable and it silently never wins a role | default the ranks on add from the shipped price list, or make the LLMs drawer ask for them, or state that an unranked model is deliberately never auto-cast | 5.1 |
| 3 | Migration `53`'s **down path has never been run** and is documented as lossy | round-trip it in the scratch-DB harness, or state that the down path is documentation and not a supported operation | building-engine |
| 4 | **Deleting an endpoint asks nothing**, though it takes every model with it — a rename is refused and one model's removal is refused, and the delete between them is unguarded | inherit the same refusal, or say why a delete is the one act a world does not bound | 5.1 |
| 5 | **A republish orphans its stitches** — re-declaring leaves the old rows `active`, and the airways walkthrough performs that repair without saying so | make a republish restitch or retire, or say in the walkthrough that `apply` **is** the repair | [1.6](modules/connect-and-model/features/stitch-models.md) |
| 6 | **A retire offers no reassignment in Studio.** `RetireRequest.reassign_to_*` has been in the engine since the beginning and no surface sends it, so *reassign offered for each* is a promise nothing keeps | build the surface, or drop the promise from the Seams table | [5.5](modules/agents/features/lifecycle.md) |
| 7 | **Nothing in the engine says `purged`.** [O6](modules/operate/spec.md) and [SR59](modules/operate/features/see-what-ran.md#decisions) both draw a retention-purged run as *purged, never empty* — and a purged row is indistinguishable from one that recorded nothing | record it (`purged_at` on `task_runs`, and the three documents answer `purged: true`), or drop the state from the drawing and say a purge deletes the row outright | [10.5](modules/operate/features/see-what-ran.md) · [Operate](modules/operate/spec.md) |
| 8 | **`TaskArtifact` is a record the engine does not have.** [SR58](modules/operate/features/see-what-ran.md#decisions) addresses a step's files by digest and cites the record; what exists is the `artifacts` key inside `result.json`, with no table, no route and no bytes to `Open` or `Download` | build the record and a route that serves the bytes, or restate SR58 as a reading of `result.json` and drop the two actions from the band | [10.5](modules/operate/features/see-what-ran.md) · orchestration §0 |

**Not an open call, and previously mis-filed as one:** `cost_usd` being `null` on every LLM touch is
[OB4](modules/operate/features/observability.md) working. The demo provider holds an OAuth token — a
**subscription**, neither metered per token nor free — so neither number is true and there is none.

**Do not scaffold** `third_party` · `cache` · `human` · `heavy`. They are governed layers with no
call site, and each lands with whatever first engages it.


### Retiring

Shipped code that is on its way out. Listed so nobody mistakes it for scope, or deletes it before its
replacement lands.

| What | Replaced by | Goes when |
|---|---|---|
| `/modeller` as its own route | [1.4 Model editor](modules/connect-and-model/features/model-editor.md) as a board kind | The next major. The canvas is reachable from the one page now, so the route is three lines of redirect kept for bookmarks — a 404 would be a worse answer than the panel the bookmark meant |
| `pages/graphs/modeller/ModellerPage.tsx` | The Model panel and the model canvas | Nothing imports it. Its *components* stay — the panel and canvas compose them |
| `?drawer=` in a graph page URL | `?section=` (G35) | The next minor release. Until then it is read as `?section=`, so a link from before the rename still opens its section; nothing writes it |


### Not building

The settled items are [`specs/vision.md` › Not building](../../specs/vision.md#not-building). What is left waits for review:

- Roles beyond membership · invitations

### Delivery

| Slice | Lands | Done when |
|---|---|---|
| S1 | 11.1–11.4 | An account signs in and reaches a Graph it belongs to |
| S2 | 1.1 · 1.2 | A Graph binds to a database and shows its schema |
| S3 | 1.3 · 1.4 | A model is authored, staged and committed from the canvas |
| S5 · S5.5 | 5.8 · 6.2 | Skills and rules ground a call; every write emits an event |
| S6 | 2.1 · 2.2 | A dataset imports against its model and is inspectable |
| S7 | 1.5 · 1.6 | Two domain models stitch and answer as one |
| S9a–S9f | 3.1–3.7 · 4.1 · 4.2 | A question runs as a run, streams, traces and fails honestly |
| S9.5 | 6.1 | A question on a cron, with a diffable timeline |
| S10 · S11 | 6.3 · 6.4 | External retrieval with provenance; metrics and cost |
| S12a–S12e | 4.3 · 4.4 · 5.1–5.7 | An agent works a task and a human accepts it against criteria |
| S12f | 4.4 | The records and the query behind a drawing are readable under it, and the Explorer drives the shell's own regions |
| S13 | 13.7 | A new Graph opens on its Setup page, four derived steps close it, and the first answer needs nothing that was not named |
| S14 | 10.5 · 2.1 · 2.2 | Every run in the Graph reads from one journal, delegated children nest under their parent, and Imports is a filter of it rather than a second implementation — `import_jobs` is gone, and a load is dispatched by the interpreter like every other run ([BD12](modules/bring-data-in/spec.md)) |
| S15 | 13.8 · 2.3 · 7.5 | A plan is a graph, the cursor is a frontier, a step fans out into lanes, a pool stops one workflow starving the rest, and a person is asked before a gated step runs — proven by a bundle load that branches, fans out and inlines the single-dataset plan, and startable from the library without phrasing a question |
| S16 | 14.1 · 14.2 · 10.5 | **The lens governs five layers, and the run proves it.** A world narrows what a run may see, use and send; a guardrail refuses before dispatch; and the touch record shows which participants were read, called, refused and sent to. Done when the same question, run in two worlds, gives two answers whose difference is readable as a diff of what each touched — and when narrowing `Deal.revenue` out of a world means no query can return it, no aggregate can reveal it and no prompt can carry it |
| F01 | 13.15 · 13.14 · 13.1 | Each Agents list is searched, filtered and paged through one helper; a filtered URL reloads to the same rows and chips |
| F02 | terminology · 7.x · 13.9 | A clean checkout migrates from one baseline, loads airways, and no `TaskPlan` or old task-type key is left in engine, API or Studio |
| F03 | 5.1 · 5.7 · 5.10 · 6.x · 13.9 · 13.13 | Every surface the Agents product had is reachable from the new rail with no leftSection, and the code it replaced is deleted |
| F04 | 5.2 · 5.3 · 5.5 · 5.8 · 5.9 · 6.x | An agent is built on its page from a drafted skill, its Flow matches its instructions, and publishing passes the eval gate |
| F05 | 5.14 · 10.9 · 10.8 · 5.4 · 3.15 | The assistant opens Runs with filters it set, and every act in a run has a ledger row |
| I01 | 11.4–11.10 | A skill need no policy covers is refused naming the policy; a narrowed token can push a draft dataset and nothing else |
| I02 | 13.16 · 10.4 · 11.5 | Claude Code, with a narrowed token, pushes a draft dataset version over this Graph's MCP server and a person publishes it |
| F06 | 5.15 · 13.11 | A worker on a second machine joins with a service-account token and runs a tool step |

F01–F06 and I01–I02 build the Agents design (agent-fabric) and then IAM (iam) on one branch, one commit a phase, run as the agents-build project.

##### S16 is ordered inside itself, and two of its steps are not in Govern

The Lens is a Studio surface over engine work that lives in **other modules' shipped features**.
Those come first, in this order:

| # | Lands in | What |
|---|---|---|
| 1 | [domain-models](modules/connect-and-model/features/domain-models.md) — 1.3 | a published model version declares its `time`, `geo` and `dims` axes. **Only declared axes are selectable** ([GV14](modules/govern/spec.md)) — without this a selector has nothing legal to name |
| 2 | the-connector-contract — 12.1 | `run_query` composes the effective predicate into its dialect, and rewrites a whole-node return into the permitted projection ([D3](modules/govern/spec.md)). **This is the whole enforcement story** — until it lands, a lens is a display filter |
| 3 | [govern](modules/govern/spec.md) — 14.1 · 14.2 | the `Lens` record, resolution and freezing, the two panels |
| 4 | [see-what-ran](modules/operate/features/see-what-ran.md) — 10.5 | the touch record, the layer strip, `Retune` |

**Step 2 is the one to schedule first and the one most likely to slip.** It is a change to every
connector, it is dialect-specific, and nothing above it can be honestly demonstrated without it — a
world that narrows but does not enforce is the exact failure
§4 calls *a display filter
wearing a bound's name*.

#### Sequencing rules

- Don't start a slice until the previous one is reproducible from a clean checkout.
- Build Engine and Studio together — a feature is not done on one side.
- A feature not listed here is out of scope; change this file before building it.
- **No backward compatibility.** Invana has no production users: rename records, keys, routes and tables outright, delete the old path in the same change, and let a migration drop and recreate. No aliases, shims or deprecated fields — but every capability and the demo data keep working.
- **Every Studio surface is built now, ahead of its slice** — see [The screen-first pass](#the-screen-first-pass).
  A screen whose engine has not landed is marked 🖼 and renders an `EmptyState` naming what unlocks it
  ([DS15](modules/platform/features/design-system.md)). The slice still owns the *wiring*: 🖼 → ✅ is the
  slice's work, and a feature ships only when every column it needs is ✅.

#### How a module gets built

A slice is still the ship gate — the order above does not change. A **module pass** is how the work
inside one is done: one module at a time, its whole hi-fi reconciled into its documents before any
code.

| Step | Output | Gate |
|---|---|---|
| 1 · Pull | the module's artboards, extracted locally | `python scripts/design-pull.py --only <Artboard>` |
| 2 · Reconcile | the module's `spec.md` gains **The drawn states** — artboard · feature · what it shows; each feature file's journeys and Decisions match the drawing | no code before this lands |
| 3 · Engine | every `API` column the module needs | tests pass, coverage holds |
| 4 · Studio | the surfaces, composed from the kit, against the artboard | the screen matches the drawing |
| 5 · Close | index columns flipped, changeset written, the module's **Partly built** rows deleted | reproducible from a clean checkout |

| Rule | Detail |
|---|---|
| The drawing does not reach the code directly | Mock → document → code. What the hi-fi shows is written into the feature file first; the file is what the code is built from |
| Every artboard is cited | A module spec names the artboards that draw it, the way [Ask §7a](modules/ask/spec.md) does. An artboard nothing cites is a decision nobody made |
| A drawing that contradicts a decision | The document wins or the document changes — in the same turn, before the screen is built |
| The kit comes first | [13.1](modules/platform/features/design-system.md) blocks most Studio columns; a module pass that needs a missing component adds it upstream, it does not work around it |

#### The screen-first pass

The forty-two artboards are the Studio backlog, built together rather than one per slice
([DS14](modules/platform/features/design-system.md)). The reason the old rule flipped: `@invana/design-kit`
`0.0.23` closed the component gap that made a screen expensive, so the screen is now the cheap half —
and building them one slice at a time is what lets forty-two screens grow forty-two shells.

The artboard → route → feature map, the order, and what each screen still needs live in
building-studio/refactor-plan.md; what each screen composes from is
[building-studio/design-kit-coverage.md](building-studio/design-kit-coverage.md); what every **canvas**
surface composes from is [building-studio/canvas-ui-coverage.md](building-studio/canvas-ui-coverage.md);
and every screen's own status is the-screens.md. What the code cleanup still owes is
building-studio/cleanup.md.

| Rule | Detail |
|---|---|
| One shell, then screens | [DS16](modules/platform/features/design-system.md) — `Themes/AppV2 › ExplorerShell` is the contract. No screen is built until the Explorer drives the shell's regions, or every later screen inherits a workaround |
| Delete before you multiply | [DS17](modules/platform/features/design-system.md) — the five Studio-local shell components and the Studio-local answer surface go first. Building forty-two screens on a parallel component layer makes that layer permanent |
| canvas-ui first | [canvas-ui-coverage.md](building-studio/canvas-ui-coverage.md) CU1 — a canvas panel, toolbar or card is `@invana/canvas-ui`'s. Read the map before writing one; a surface listed there is consumed, never reimplemented |
| Mock → document → code still holds | The artboard is written into the feature file before the screen is built. What changes is *when*, not the order |
| 🖼 is not ✅ | A screen wired to nothing renders `EmptyState` naming its endpoint. It fabricates no rows, counts or timings ([DS15](modules/platform/features/design-system.md)) |
| The risk, named | A screen built against an unwritten API encodes a guess about its shape. The guess is cheap to correct while the screen is `EmptyState` + layout, and expensive once it has forms and tables bound to it — so a 🖼 screen stops at the layout and the empty state, and the data-shaped parts of it wait for the engine |

#### The hi-fi

| | |
|---|---|
| Canvas | *Agents at Work Wireframes* — `claude.ai/code/artifact/58f2e380-ef59-41cd-8c96-d3dc7ddd06e4` |
| Pages | **Hi-fi · finance** (42 artboards, 1440×900) · Wireframes · Features · index · Considered · not building |
| In the repo | Nothing. `scripts/design-pull.py` extracts artboards into `.design/`, which is gitignored — the canvas is the source, `.design/` is a cache |
| Not drawn | **30 of the 65 features have no artboard** — they ship from their feature files alone. Whole modules: [11 Identity and access](modules/identity-and-access/spec.md) · 12 Graph connectors. Plus 1.2 · 1.5 · 1.7 · 3.1 · 3.5 · 3.7 · 3.9 · 4.5 · 5.7 · 6.2 · 7.3 · 7.4 · 8.1 · 8.2 · 10.2 · 10.4 · 13.1 · 13.2 · 13.4 · 13.5 · 13.6. The list this line used to carry named four; the full reckoning, and which artboard draws each of the other 35, is in the-screens.md |
| Screen status | Every artboard's own status — does the screen exist, is it on the kit — is the-screens.md, the screen index beside this one. `Studio` here answers "does the feature work"; that file answers "does the drawing exist yet" |
