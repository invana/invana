# The screens — what the hi-fi draws, and whether it is built

**Sibling to [README.md](README.md).** That file is the authoritative index of *features* — what the
product does. This is the authoritative index of *screens* — what it looks like, and whether the
drawing has been built. A feature and its screen come apart the moment a screen is built ahead of
its engine ([DS14](modules/platform/features/design-system.md)), which is why they are two indexes
and not one overloaded column.

The first 42 are in `.design/hi-fi-finance/` (a
[design-pull](../../scripts/design-pull.py) cache, not in git — the canvas is the source). Every one
of them is listed below exactly once.

## How to read a row

| Column | Asks | Values |
|---|---|---|
| **API** | Does the engine behind this screen exist? | ✅ · 🟡 · 🔵 · — · taken from the feature's row in [README.md](README.md) |
| **Studio** | Does the screen exist at all? | ✅ built · 🟡 partly · 🖼 built but wired to nothing ([DS15](modules/platform/features/design-system.md)) · 🔵 not started |
| **Shell** | Does it drive `AppLayoutV2`'s region props, and compose only from `@invana/*`? | ✅ · ❌ |

A screen is **done** when all three are ✅.

**`Shell ❌` does not mean "not using the kit".** Studio imports `@invana/ui` in 92 files and
`@invana/forms` in 21 — the components are already the kit's almost everywhere. It means three
specific things, each of them checkable:

| What `❌` is counting | Where it stands |
|---|---|
| The screen fills `AppLayoutV2`'s `leftSection` · `mainSection` · `rightSection` · `bottomSection` · `footer` ([DS12](modules/platform/features/design-system.md)) | ✅ **Done.** `App.tsx` for the four non-graph routes, and `GraphDetail` for the 36 graph-scoped ones — its hand-built `ResizablePanelGroup` is gone. Verified in the browser: a panel toggle holds the canvas's camera, which is the property the workaround existed to protect |
| Nothing on the screen is a Studio component that shadows a kit one ([DS17](modules/platform/features/design-system.md)) | 8 files still do: `PanelChrome` · `WorkRow` · `EmissionCard` · `NotAnAnswer` · `TraceDialog` · `EventsSection` · `PlatformEventsPage` · `WorkGraphCanvas` |
| Canvas chrome comes from `@invana/canvas-ui` rather than being re-grown | 3 files import it, and only for what moved there in the 0.0.12 bump. `LayersViewPanel`, `BoardPagesViewPanel`, `InspectorPanel` and `PropertiesEditor` are all still hand-written in Studio |

Two kit packages are not installed at all: `@invana/tables` (`DataTable`, which batches 3–7 are
mostly made of) and `@invana/editor` (`MarkdownEditorBlock`, `CodeBlock`).

So the honest reading of a `Shell ❌` row is *"this screen is built from kit components, but it is
not composed the way the shell contract says, and some of its parts are Studio's own copies."*

## Where the 42 stand

| | Screens | |
|---|---|---|
| ✅ Studio has it | 18 | Explorer, the answer surface, Model, Stitches, Datasets, Settings, the agent roster · envelope · lifecycle, the plan canvas |
| 🟡 Partly | 7 | Projects, Tasks, Skills, Workflows — the list is there, the detail is not |
| 🔵 Not started | 11 | Review, proposals, task review, schedules, recurring tasks, rules, agent stats, the journal |
| — Not a screen | 6 | the CLI transcript, four annotated mocks, the board index |
| **On the shell** | **0** | every screen predates the shell contract — see below for what that does and does not mean |

The 🔵 rows are where 🖼 appears next: the screen is built ahead of its engine, renders an
`EmptyState` naming what unlocks it, and flips to ✅ when its slice wires it (DS14 · DS15).

## Keeping it true

| When | Do |
|---|---|
| A screen ships | Flip its `Studio` cell here, and its module's column in [README.md](README.md) if the feature is now done |
| A screen moves onto the shell | Flip its `Shell` cell — all three conditions above, not just the first |
| An artboard is added or retired | Add or remove its row. An artboard with no row is a drawing nobody agreed to build |
| A feature's engine lands | Its `API` cell follows [README.md](README.md) — that file stays the source for it |

The shell every one of them fills is
[building-studio/the-shell.md](building-studio/the-shell.md). The build order these rows are worked in is
[building-studio/refactor-plan.md](building-studio/refactor-plan.md); what each screen can be
composed from is [building-studio/design-kit-coverage.md](building-studio/design-kit-coverage.md).

---

## The 42, by build batch

**Batch 1 · Explorer and the answer surface**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 1 | `ExplorerHiFi` | an Observation selected — read on the right | `/…/explorer` | [4.1](modules/explore/features/graph-canvas.md) · [4.3](modules/explore/features/selection-and-the-panel.md) | ✅ | ✅ | ❌ |
| 2 | `SessionHiFi` | answers, in full | Explorer › Sessions | [3.10](modules/ask/features/the-assistant.md) · [3.3](modules/ask/features/the-answer-surface.md) | ✅ | ✅ | ❌ |
| 3 | `ExplorerAsksHiFi` | two more asks | Explorer › Sessions | [3.2](modules/ask/features/ask-in-natural-language.md) | ✅ | ✅ | ❌ |
| 4 | `AssistantHistoryHiFi` | finding past work | Explorer › Sessions | [3.10](modules/ask/features/the-assistant.md) | ✅ | ✅ | ❌ |
| 5 | `CanvasLayersHiFi` | Layers, open from the canvas tab bar | Explorer › canvas strip | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 6 | `AnswerSurfaceHiFi` | one answer, five kinds | Explorer › thread | [3.3](modules/ask/features/the-answer-surface.md) | ✅ | ✅ | ❌ |
| 7 | `ProjectionSwitchHiFi` | the same records, another projection | Explorer › thread | [3.4](modules/ask/features/projections.md) | ✅ | ✅ | ❌ |
| 8 | `ClarifyHiFi` | Understand asks back | Explorer › thread | [3.6](modules/ask/features/clarifying-questions.md) | ✅ | ✅ | ❌ |
| 9 | `RunOutcomesHiFi` | four ways a run ends | Explorer › thread | [3.8](modules/ask/features/when-it-cannot-answer.md) | ✅ | ✅ | ❌ |

**Batch 2 · Model, data and settings**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 10 | `ModellerHiFi` | Observations v2 draft | Explorer › Model | [1.3](modules/connect-and-model/features/domain-models.md) · [1.4](modules/connect-and-model/features/model-editor.md) | ✅ | ✅ | ❌ |
| 11 | `ModellerSessionHiFi` | generated by the Modeller agent | Explorer › Model | [1.4](modules/connect-and-model/features/model-editor.md) · [5.2](modules/agents/features/the-roster.md) | ✅ | ✅ | ❌ |
| 12 | `ModelEditBottomHiFi` | a type selected — the form spans main | Explorer › Model | [1.4](modules/connect-and-model/features/model-editor.md) | ✅ | ✅ | ❌ |
| 13 | `StitchHiFi` | Links and the global model | Explorer › Stitches | [1.6](modules/connect-and-model/features/stitch-models.md) | ✅ | ✅ | ❌ |
| 14 | `DatasetsHiFi` | what landed | Tasks › Runs › a run | [2.2](modules/bring-data-in/features/inspect-what-landed.md) | ✅ | ✅ | ❌ |
| 15 | `ImportRunHiFi` | the run is a run | Tasks › Runs › a run | [2.1](modules/bring-data-in/features/load-data.md) | ✅ | ✅ | ❌ |
| 16 | `SetupWizardHiFi` | Graph settings | Settings panel | [1.1](modules/connect-and-model/features/connect-a-database.md) · [5.1](modules/agents/features/providers-and-models.md) | ✅ | ✅ | ❌ |

**Batch 3 · Agents**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 17 | `AgentsHiFi` | the roster | `work/AgentsPanel` | [5.2](modules/agents/features/the-roster.md) | ✅ | ✅ | ❌ |
| 18 | `AgentHiFi` | Intraday Analyst envelope | `work/AgentDetail` | [5.3](modules/agents/features/envelope-and-budget.md) | ✅ | ✅ | ❌ |
| 19 | `AgentsLineageHiFi` | a delegation selected | Agents › lineage | [5.6](modules/agents/features/lineage.md) · [5.4](modules/agents/features/delegation.md) | ✅ | ✅ | ❌ |
| 20 | `AgentPausedHiFi` | pausing on an event day | Agents › lifecycle | [5.5](modules/agents/features/lifecycle.md) | ✅ | ✅ | ❌ |
| 21 | `AgentStatsHiFi` | the month in numbers | Agent › stats | [10.3](modules/operate/features/observability.md) | 🔵 | 🔵 | ❌ |

**Batch 4 · Work**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 22 | `ProjectsHiFi` | Intraday | `work/ProjectsPanel` | [9.1](modules/work/features/projects-and-tasks.md) | 🟡 | 🟡 | ❌ |
| 23 | `SwingProjectHiFi` | Swing | `work/ProjectsPanel` | [9.1](modules/work/features/projects-and-tasks.md) | 🟡 | 🟡 | ❌ |
| 24 | `ProjectPlanHiFi` | the plan — waves, blocked_by, critical path | Projects › Plan canvas | [9.1](modules/work/features/projects-and-tasks.md) | 🟡 | ✅ | ❌ |
| 25 | `NewTaskHiFi` | new task | Projects › Todos | [9.1](modules/work/features/projects-and-tasks.md) | 🟡 | 🟡 | ❌ |
| 26 | `TaskHiFi` | Setup check BPCL | Projects › a Todo | [9.1](modules/work/features/projects-and-tasks.md) | 🟡 | 🟡 | ❌ |
| 27 | `JournalTaskHiFi` | Post-mortem week 36 | Projects › a Todo › journal | [9.2](modules/work/features/objectives-and-criteria.md) | 🔵 | 🔵 | ❌ |

**Batch 5 · Review and memory**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 28 | `ReviewHiFi` | what is waiting for you | Review queue | [9.3](modules/work/features/review.md) | 🔵 | 🔵 | ❌ |
| 29 | `ReviewProposalHiFi` | a proposal open | Review › proposal | [8.3](modules/memory/features/proposals.md) · [8.4](modules/memory/features/consolidation.md) | 🔵 | 🔵 | ❌ |
| 30 | `TaskReviewHiFi` | the review | Task › review | [9.3](modules/work/features/review.md) | 🔵 | 🔵 | ❌ |
| 30a | `VerdictReviewHiFi` | judging a pass — the output, iteration 2 of 5, spend so far, accept · revise with a note | Review › verdict | [9.3](modules/work/features/review.md) · [13.8 §10](modules/platform/features/runtime.md) | 🔵 | 🔵 | ❌ |

**Batch 6 · Skills, rules, workflows**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 31 | `SkillsHiFi` | gap-playbook | `work/SkillsPanel` | [6.1](modules/skills/features/authoring-a-skill.md) · [6.3](modules/skills/features/usage.md) | ✅ | 🟡 | ❌ |
| 32 | `RulesHiFi` | Settings › Rules | Settings › Rules | [6.4](modules/skills/features/rules.md) | 🔵 | 🔵 | ❌ |
| 33 | `WorkflowsHiFi` | the library | Tasks › Plans | [7.1](modules/workflows/features/the-library.md) | 🟡 | 🟡 | ❌ |
| 34 | `WorkflowStepHiFi` | a step selected | Tasks › Plans › step | [7.2](modules/workflows/features/plan-selection.md) | 🟡 | 🟡 | ❌ |
| 34a | `RunWorkflowHiFi` | the run dialog — arguments, step preview, projected cost | Tasks › Plans › run | [7.5](modules/workflows/features/run-a-workflow.md) | 🔵 | 🔵 | ❌ |
| 34b | `PlanDetail` | a published version, its flow on the canvas | Tasks › Plans › a plan | [7.1](modules/workflows/features/the-library.md) | 🟡 | 🔵 | ❌ |
| 34c | `PlanDraftCanvas` | drafting on the canvas — a refused drop, the bound named | Tasks › Plans › draft | [7.7](modules/workflows/features/draft-a-plan.md) | 🔵 | 🔵 | ❌ |
| 34d | `PlanDraftYaml` | the same draft as `manifest.yml` | Tasks › Plans › draft | [7.7](modules/workflows/features/draft-a-plan.md) | 🔵 | 🔵 | ❌ |
| 34e | `PlanRetire` | retiring a version — what stops, what keeps reading | Tasks › Plans › retire | [7.7](modules/workflows/features/draft-a-plan.md) | 🔵 | 🔵 | ❌ |
| 34f | `CatalogueDetail` | an entry as a page — **considered, not built** ([CA6](modules/workflows/features/the-catalogue.md)); the detail is the drawer body and the contract card | Tasks › Catalogue | 🟡 | ⛔ | ❌ |
| 34g | `RunDetail` | the light drawer — info, the Gantt, a line of log per task — beside the flow | Tasks › Runs › a run | [10.5](modules/operate/features/see-what-ran.md) | 🔵 | 🔵 | ❌ |
| 34h | `RunDashboard` | what `More` opens — a declared board, `kind = run` | Tasks › Runs › dashboard | [10.5](modules/operate/features/see-what-ran.md) · [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34i | `DrawerRunsList` | version C — the list, a running row live, a child indented | Tasks › Runs | [10.5](modules/operate/features/see-what-ran.md) | 🔵 | ✅ | ❌ |
| 34i.1 | `DrawerRunsFiltered` | the list with `kind = import · bulk` | Tasks › Runs | [2.2](modules/bring-data-in/features/inspect-what-landed.md) | 🔵 | 🔵 | ❌ |
| 34i.2 | `DrawerRunLive` | a run in flight — now line, climbing stats, tailing log, Cancel | Tasks › Runs › a run | [10.5](modules/operate/features/see-what-ran.md) | 🔵 | 🟡 | ❌ |
| 34i.3 | `DrawerRunAll` | a run that finished — stats, the Gantt and the log, all in `leftContent` | Tasks › Runs › a run | [10.5](modules/operate/features/see-what-ran.md) | 🔵 | ✅ | ❌ |
| 34j | `DrawerRunDebug` | the log filtered to one Task, Performance collapsed | Tasks › Runs › a run | [10.5](modules/operate/features/see-what-ran.md) | 🔵 | ✅ | ❌ |
| 34k | `RunDash` | the run dashboard — the flow with status, the Gantt, what opened the run | Tasks › Runs › dashboard | [10.5](modules/operate/features/see-what-ran.md) · [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34l | `StepImport` | a step dashboard — output is graph data written | Tasks › Runs › a task | [10.5](modules/operate/features/see-what-ran.md) | ✅ | ✅ | ❌ |
| 34m | `StepQuery` | the same shell — output is rows | Tasks › Runs › a task | [10.5](modules/operate/features/see-what-ran.md) | ✅ | ✅ | ❌ |
| 34n | `StepLlm` | the same shell — output is the prompt and completion | Tasks › Runs › a task | [10.5](modules/operate/features/see-what-ran.md) | ✅ | ✅ | ❌ |
| 34o | `PlanDash` | the plan dashboard — the flow with per-task medians, arguments, its runs | Tasks › Plans › a plan | [7.1](modules/workflows/features/the-library.md) | 🔵 | 🔵 | ❌ |
| 34p | `PlanStepParams` | a task's parameters, generated from its catalogue contract | Tasks › Plans › draft › a task | [7.7](modules/workflows/features/draft-a-plan.md) | 🔵 | 🔵 | ❌ |
| 34q | `CatalogueList` | 25 entries grouped by bound, each row carrying how many plans name it | Tasks › Catalogue | [7.6](modules/workflows/features/the-catalogue.md) | 🟡 | 🔵 | ❌ |

**34k · 34n are `✅`: the runtime now writes the records their bands were waiting for, and no composer
changed.** `task_runs.result` is written by the interpreter when a row settles
([SR38](modules/operate/features/see-what-ran.md)), and the run's own is the roll-up
([SR39](modules/operate/features/see-what-ran.md)) — so the `result.json` bands and the Artifacts
list draw. `task_runs.cost_usd` is derived at settle from the model's rate
([SR40](modules/operate/features/see-what-ran.md)), and the trace carries the agent's ceiling beside
it ([SR41](modules/operate/features/see-what-ran.md)), so the Cost tile reads `$0.04 of $2.00` with a
meter. `StepLlm`'s Output is the `exchange` panel, because an LLM step records its prompt and
completion on `output` ([SR42](modules/operate/features/see-what-ran.md)).

A band still draws **nothing** where its record is genuinely absent, which is
[SR34](modules/operate/features/see-what-ran.md) working rather than a gap: a task that listed no
artifacts has no Artifacts panel, and a model with no published rate — a local subscription among
them — has no Cost tile at all rather than `$0.00`
([OB4](modules/operate/features/observability.md)).

Rows 34b–34q (and 34i.1–34i.3) are drawn on the [*The Tasks Panel* canvas](https://claude.ai/artifact/9sAby5rPvkjMLb9BcdCom4),
not on the finance hi-fi canvas — they are the stacked Tasks panel and what it drills into
([graph-detail-page §3a](building-studio/graph-detail-page.md)).

**Batch 7 · Operate**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 35 | `SchedulesHiFi` | Settings › Schedules | Settings › Schedules | [10.1](modules/operate/features/schedules.md) | 🔵 | 🔵 | ❌ |
| 36 | `RecurringTaskHiFi` | a recurring task | Schedules › recurring | [9.4](modules/work/features/recurring-tasks-and-conditions.md) | 🔵 | 🔵 | ❌ |

**Not Studio screens** — six artboards that are not routes.

| # | Artboard | What it draws | Why not |
|---|---|---|---|
| 37 | `CliHiFi` | the hand-off | A terminal transcript, not a route — [13.3](modules/platform/features/command-line.md). Lives on the board as a `Terminal` artboard |
| 38 | `AssistantShell` | the shell | Annotated mock frame. Documents a decision already shipped — board or retire (Q3) |
| 39 | `AssistantList` | the list | Annotated mock frame — Q3 |
| 40 | `AssistantThread` | open thread | Annotated mock frame — Q3 |
| 41 | `AssistantInspector` | selection as context | Annotated mock frame — Q3 |
| 42 | `StoryIndexHiFi` | every story, the screen that shows it | The board's own index page (§5.2), rebuilt there as a live tracker |

**Where the forty-two stand**

| | Screens | |
|---|---|---|
| ✅ Studio has it | 20 | Explorer, the answer surface, Model, Stitches, Datasets, Settings, the agent roster and envelope, the plan canvas |
| 🟡 Partly | 7 | Projects, Tasks, Skills, Workflows — the list is there, the detail is not |
| 🔵 Not started | 9 | Review, proposals, schedules, rules, recurring tasks, agent stats, the journal, agent pause |
| — Not a screen | 6 | the CLI transcript, four annotated mocks, the board index |
| **On the kit** | **0** | every screen above predates the shell. That is Phases 2–7, not a backlog item |

The 🔵 rows are where 🖼 will appear: the screen gets built ahead of its engine, renders an
`EmptyState` naming what unlocks it, and flips to ✅ when its slice wires it (DS14 · DS15).

---

## Beyond the 42 · All models

Thirteen artboards on a second canvas — *Modeller and Stitching*
(`claude.ai/code/artifact/db0a313c-1401-49ad-965f-0727364020fa`) — drawn to settle how the modeller
and stitching share one surface. **Option A** was chosen and ships as *All models*; page 1 draws it in
full, one artboard per capability and per seam. Page 2 keeps the option that lost, so the choice can
be re-read.

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| T1 | `Main` | every model, one canvas | Explorer › All models | [1.6](modules/connect-and-model/features/stitch-models.md) ST14 · ST17 · ST18 · ST22 | ✅ | ✅ | ❌ |
| T2 | `Constellation` | every frame closed — the altitude | Explorer › All models | ST15 · ST20 · ST23 | ✅ | ✅ | ❌ |
| T3 | `InsideAModel` | one open, the rest closed — a port | Explorer › All models | ST15 | ✅ | ✅ | ❌ |
| T4 | `GlobalModel` | the union, stated not drawn | Explorer › Global model | ST3 · ST6 · ST16 | ✅ | ✅ | ❌ |
| T5 | `Declare` | drag a type onto another frame | Explorer › All models | C1 · C2 · C3 · C7 · ST11 · ST19 · ST26 · ST34 · ST35 | ✅ | ✅ | ❌ |
| T6 | `Refused` | a rule matching nothing, a pair already stitched | Explorer › All models | seams · ST1 · ST36 | ✅ | ✅ | ❌ |
| T7 | `Staged` | declared, not yet in the union | Explorer › All models | C8 · ST21 | ✅ | ✅ | ❌ |
| T8 | `Remove` | what the union stops spanning | Explorer › All models | C4 · ST2 | ✅ | ✅ | ❌ |
| T9 | `RelationshipKey` | an edge found by a key on each side | Explorer › All models | W2 · C2 · ST26 · ST27 | ✅ | ✅ | ❌ |
| T10 | `RelationshipDataset` | an edge whose records arrive in a dataset | Explorer › All models | W3 · C2 · ST4 · ST27 | ✅ | ✅ | ❌ |

Every one of the ten is built. The schema carries `source_property` and `target_property`
([ST26](modules/connect-and-model/features/stitch-models.md#decisions)), so `T5`'s per-side key
pickers, the `Match` control and `T9`/`T10`'s `Endpoints` choice — *These keys* or *A dataset*
([ST27](modules/connect-and-model/features/stitch-models.md#decisions)) — are real controls over a
real payload rather than drawings ahead of it. The declare card is one card for both kinds with the
kind inside it (ST11), it stages rather than declares (ST21), and the resolve count fires as soon as
both keys are named (ST35). `T6`'s duplicate-pair refusal now comes back naming the rule the existing
stitch carries and renders as its own card (ST36).

One thing the artboards draw and the screen does not: the toolbar's **remove-a-stitch** tool.
`@invana/canvas` emits `input:node:click` and no edge equivalent, so a crossing cannot be picked;
removing is the Stitches row's own control, which is where `T8`'s dialog opens from.

`OptionB` and `OptionBModel` are the road not taken — [ST14](modules/connect-and-model/features/stitch-models.md)
records what was chosen; they are kept only so the choice can be re-read, never built.

---

## Beyond the 42 · Setup

Four artboards the canvas does not hold yet. They draw [13.7 Setup](modules/platform/features/setup.md)
— the sequence a Graph walks from created to answering — and they are the **Studio backlog for S13**,
drawn before the screen is built the way every other module pass runs (README § *How a module gets
built*).

`SetupWizardHiFi` (#16 above) is **not** one of them: despite its name it draws Graph settings, and
setup owns no forms of its own (SU2). The name is the canvas's, and it stays.

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| U1 | `SetupPageHiFi` | mid-setup — the island, the four-group stepper, and *Bring data in*'s lesson with its concept card and terminal line ([5](modules/platform/features/setup.md#5-surfaces)) | the graph page | [13.7](modules/platform/features/setup.md) SU3 · SU6 · SU7 · SU16 · SU17 · SU22 | ✅ | ✅ | ❌ |
| U2 | `SetupBlockedHiFi` | *Bring data in* blocked by *Author a model*, and a provider pinging red | the graph page | SU12 · the `broken` state | ✅ | ✅ | ❌ |
| U3 | `SetupReadyHiFi` | every gate open, **What next** carrying the offers, the cap still in `header.right` | the graph page | SU4 · SU15 · SU19 | ✅ | ✅ | ❌ |
| U4 | `SetupLocksHiFi` | the Assistant, with the gate that opens it | every gated surface | SU13 · `EmptyState locks` | ✅ | 🟡 | ❌ |

**The screens are built; the artboards are not.** Studio ships `SetupBoard`, `SetupTimeline` and
`SetupLock` composed from the kit — the drawings above are still owed, and are what a board pass
reconciles against. `U4` is 🟡 because only the Assistant carries a lock so far: Explorer, the Model
panel and Imports still render their own empty states.

The Info panel's setup band is **already built** and needs no artboard of its own — it is the
compact rendering of U1, and `GraphInfoPanel` draws it today (G20 · G21).

---

## Beyond the 42 · Governance

Seven artboards on a third canvas — *Governance · the lens in the UI*
(`claude.ai/artifact/8591piJHezfLsUoSZXn3z8`) — drawing [14 · Govern](modules/govern/spec.md).
Three more on it keep the D1 option comparison and are not screens.

| Artboard | Draws | API | Studio | Shell |
|---|---|---|---|---|
| `RunLens` | the run dashboard — six layer bands, the touch record, `This run's lens` ([D16](modules/govern/spec.md)) | 🔵 | 🔵 | ✅ |
| `GovWorlds` | Govern › Worlds — the drawer and the world chip | 🔵 | 🔵 | ✅ |
| `GovWorld` | a world — five layer sections, the slice box | 🔵 | 🔵 | ✅ |
| `GovGuardrails` | Govern › Guardrails, and what a save would cost ([GR2](modules/govern/features/guardrails.md)) | 🔵 | 🔵 | ✅ |
| `AgentsRoster` | Agents › the roster — an agent carries a lens, not a provider ([D2](modules/govern/spec.md)) | 🟡 | 🟡 | ✅ |
| `AgentsLlms` | Agents › LLMs — no default, the cast picks ([D19](modules/govern/spec.md)) | ✅ | 🟡 | ✅ |
| `GovCompare` | Compare — one question, two worlds, the touch diff | 🔵 | 🔵 | ✅ |
| `Main` · `OneSurface` · `TwoRecords` | — the D1 option comparison, kept as the record. **Not screens** | — | — | — |

## Beyond the 42 · Skills and the left rail

Six artboards on a fourth canvas — *Skills · and the left rail*
(`claude.ai/artifact/7c565h2z9irbFBwu1S1ebH`) — drawing [6 · Skills](modules/skills/spec.md), the
**Library** panel ([G41](building-studio/graph-detail-page.md)) and the rail itself.

| Artboard | Draws | API | Studio | Shell |
|---|---|---|---|---|
| `Main` (SkillsPanel) | Skills › Skills · Rules, and the skill/rule line | 🟡 | 🟡 | ✅ |
| `SkillFlow` | a skill's **Flow** tab — the plan canvas, every step naming its sentence | 🟡 | 🔵 | ✅ |
| `SkillAuthor` | authoring — the clarification that pauses instead of guessing ([§0.8](orchestration.md#08-a-skill-drawn-as-a-flow)) | 🔵 | 🔵 | ✅ |
| `SkillBindings` | agent · skill · plan, and the bind-time refusal | 🟡 | 🔵 | ✅ |
| `Library` | Library › Plans · Catalogue · Templates ([G41](building-studio/graph-detail-page.md)) | 🟡 | ✅ | ✅ |
| `RailMap` | the rail itself — eight top, three bottom. **A map, not a screen** | — | — | — |

**`Shell ✅` on every row above, and it means something different here.** These were composed on the
shell contract from the first line — `leftNav`, a 420px `leftSection`, stacked drawers, `mainSection`
as pages, tokens only. They are the first screens in the product for which that is true, which is
also why none of them can be compared to the 42's `Shell ❌` rows: those were drawn before the
contract existed.

## The other direction — every feature, and the screen that draws it

So a feature file can be opened next to the drawing that shows it.

| # | Feature | API | Studio | Slice | Artboard | Screen |
|---|---|---|---|---|---|---|
| 1.1 | Connect a database | ✅ | ✅ | S2 | `SetupWizardHiFi` | ✅ |
| 1.3 | Domain models | ✅ | ✅ | S3 | `ModellerHiFi` | ✅ |
| 1.4 | Model editor | ✅ | ✅ | S3 | `ModellerHiFi` · `ModellerSessionHiFi` · `ModelEditBottomHiFi` | ✅ |
| 1.6 | Stitch models | ✅ | ✅ | S7 | `StitchHiFi` | ✅ |
| 2.1 | Load data | ✅ | ✅ | S6 | `ImportRunHiFi` | ✅ |
| 2.2 | Inspect what landed | ✅ | ✅ | S6 | `DatasetsHiFi` | ✅ |
| 3.2 | Ask in natural language | ✅ | ✅ | S9b | `ExplorerAsksHiFi` | ✅ |
| 3.3 | The answer surface | ✅ | ✅ | S9b | `SessionHiFi` · `AnswerSurfaceHiFi` | ✅ |
| 3.4 | Projections | ✅ | ✅ | S9b→S9d | `ProjectionSwitchHiFi` | ✅ |
| 3.6 | Clarifying questions | ✅ | ✅ | S9c | `ClarifyHiFi` | ✅ |
| 3.8 | When it cannot answer | ✅ | ✅ | S9b→S9f | `RunOutcomesHiFi` | ✅ |
| 4.1 | Graph canvas | ✅ | ✅ | S9b | `ExplorerHiFi` | ✅ |
| 4.2 | Canvases | ✅ | ✅ | S9 | `CanvasLayersHiFi` | ✅ |
| 4.3 | Selection and the panel | ✅ | ✅ | S12 | `ExplorerHiFi` | ✅ |
| 3.10 | The assistant | ✅ | ✅ | S12 | `SessionHiFi` · `AssistantHistoryHiFi` | ✅ |
| 5.1 | Providers and models | ✅ | ✅ | S5 | `SetupWizardHiFi` | ✅ |
| 5.2 | The roster | ✅ | ✅ | S12c | `ModellerSessionHiFi` · `AgentsHiFi` | ✅ |
| 5.3 | Envelope and budget | ✅ | ✅ | S12c | `AgentHiFi` | ✅ |
| 5.4 | Delegation | ✅ | ✅ | S12d | `AgentsLineageHiFi` | ✅ |
| 5.5 | Lifecycle | ✅ | ✅ | S12c | `AgentPausedHiFi` | 🔵 |
| 5.6 | Lineage | ✅ | ✅ | S12c | `AgentsLineageHiFi` | ✅ |
| 6.1 | Authoring a skill | ✅ | 🟡 | S5 | `SkillsHiFi` | 🟡 |
| 6.3 | Usage | ✅ | 🟡 | S12c | `SkillsHiFi` | 🟡 |
| 6.4 | Rules | 🔵 | 🔵 | S12b | `RulesHiFi` | 🔵 |
| 7.1 | The library | 🟡 | 🟡 | S12c | `WorkflowsHiFi` | 🟡 |
| 7.2 | Plan selection | 🟡 | 🟡 | S9d | `WorkflowStepHiFi` | 🟡 |
| 7.5 | Run a workflow | 🔵 | 🔵 | S15 | `RunWorkflowHiFi` | 🔵 |
| 8.3 | Proposals | 🔵 | 🔵 | S12c | `ReviewProposalHiFi` | 🔵 |
| 8.4 | Consolidation | 🔵 | 🔵 | S12c | `ReviewProposalHiFi` | 🔵 |
| 9.1 | Projects and tasks | 🟡 | 🟡 | S12b | `ProjectsHiFi` · `SwingProjectHiFi` · `ProjectPlanHiFi` · `NewTaskHiFi` · `TaskHiFi` | ✅ · 🟡 |
| 9.2 | Objectives and criteria | 🔵 | 🔵 | S12b | `JournalTaskHiFi` | 🔵 |
| 9.3 | Review | 🔵 | 🔵 | S12b | `ReviewHiFi` · `TaskReviewHiFi` | 🔵 |
| 9.4 | Recurring tasks and conditions | 🔵 | 🔵 | S12e | `RecurringTaskHiFi` | 🔵 |
| 10.1 | Schedules | 🔵 | 🔵 | S9.5 | `SchedulesHiFi` | 🔵 |
| 10.3 | Observability | 🔵 | 🔵 | S11 | `AgentStatsHiFi` | 🔵 |
| 13.3 | Command line | — | — | — | `CliHiFi` | — |
| 13.7 | Setup | ✅ | 🟡 | S13 | `SetupPageHiFi` · `SetupBlockedHiFi` · `SetupReadyHiFi` · `SetupLocksHiFi` | 🟡 |

**Not drawn — 32 features with no artboard.** They ship from their feature files alone. The index's
own *Not drawn* line named four of these; it was short by 25.

| # | Feature | API | Studio |
|---|---|---|---|
| 1.2 | Introspect a database | ✅ | ✅ |
| 1.5 | Share a model | ✅ | ✅ |
| 1.7 | Starter models | ✅ | ✅ |
| 3.1 | Write queries | ✅ | ✅ |
| 3.5 | Streaming and the workflow | ✅ | ✅ |
| 3.7 | Reasoning trace | ✅ | ✅ |
| 3.9 | The runtime | ✅ | — |
| 4.5 | The console | ✅ | 🔵 |
| 5.7 | Concurrency and contention | ✅ | ✅ |
| 6.2 | Bindings | ✅ | 🟡 |
| 7.3 | Envelope validation | 🟡 | 🔵 |
| 7.4 | Promote a plan | 🟡 | 🟡 |
| 8.1 | Evidence | 🔵 | 🔵 |
| 8.2 | Recall by query | 🔵 | 🔵 |
| 10.2 | Audit and activity | 🟡 | 🟡 |
| 10.4 | External-agent API | 🔵 | 🔵 |
| 10.5 | See what ran | 🔵 | 🔵 |
| 11.1 | Accounts | 🟡 | 🟡 |
| 11.2 | Usernames | ✅ | ✅ |
| 11.3 | Sessions | ✅ | 🟡 |
| 11.4 | Membership | ✅ | ✅ |
| 11.5 | Personal access tokens | ✅ | ✅ |
| 12.1 | The connector contract | ✅ | — |
| 12.2 | Languages | ✅ | 🟡 |
| 12.3 | Capabilities | 🟡 | 🔵 |
| 12.4 | Vector search | 🔵 | 🔵 |
| 13.1 | Design system | — | 🟡 |
| 13.2 | Theming | — | ✅ |
| 13.4 | Logging | ✅ | — |
| 13.5 | Telemetry | ✅ | — |
| 13.6 | Admin and health | ✅ | — |
| 13.8 | The runtime | 🟡 | — |
