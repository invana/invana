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
| ✅ Studio has it | 18 | Explorer, the answer surface, Model, Stitches, Datasets, Settings, the agents list · envelope · lifecycle, the plan canvas |
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
| 11 | `ModellerSessionHiFi` | generated by the Modeller agent | Explorer › Model | [1.4](modules/connect-and-model/features/model-editor.md) · [5.2](modules/agents/features/author-an-agent.md) | ✅ | ✅ | ❌ |
| 12 | `ModelEditBottomHiFi` | a type selected — the form spans main | Explorer › Model | [1.4](modules/connect-and-model/features/model-editor.md) | ✅ | ✅ | ❌ |
| 13 | `StitchHiFi` | Links and the global model | Explorer › Stitches | [1.6](modules/connect-and-model/features/stitch-models.md) | ✅ | ✅ | ❌ |
| 14 | `DatasetsHiFi` | what landed | Tasks › Runs › a run | [2.2](modules/bring-data-in/features/inspect-what-landed.md) | ✅ | ✅ | ❌ |
| 15 | `ImportRunHiFi` | the run is a run | Tasks › Runs › a run | [2.1](modules/bring-data-in/features/load-data.md) | ✅ | ✅ | ❌ |
| 16 | `SetupWizardHiFi` | Graph settings | Settings panel | [1.1](modules/connect-and-model/features/connect-a-database.md) · [5.1](modules/agents/features/providers-and-models.md) | ✅ | ✅ | ❌ |

**Batch 3 · Agents**

| # | Artboard | What it draws | Surface | Feature | API | Studio | Shell |
|---|---|---|---|---|---|---|---|
| 17 | `AgentsHiFi` | the agents | `work/AgentsPanel` | [5.2](modules/agents/features/author-an-agent.md) | ✅ | ✅ | ❌ |
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
| 31 | `SkillsHiFi` | gap-playbook | ⛔ `work/SkillsPanel` — **a path that no longer exists** | [6.1](modules/skills/features/authoring-a-skill.md) · [6.3](modules/skills/features/usage.md) | ✅ | — | ❌ |
| 32 | `RulesHiFi` | Settings › Rules | Settings › Rules | [6.4](modules/skills/features/rules.md) | 🔵 | 🔵 | ❌ |
| 33 | `WorkflowsHiFi` | the library | Tasks › Plans | [7.1](modules/workflows/features/the-library.md) | 🟡 | 🟡 | ❌ |
| 34 | `WorkflowStepHiFi` | a step selected | Tasks › Plans › step | [7.2](modules/workflows/features/plan-selection.md) | 🟡 | 🟡 | ❌ |
| 34a | `RunWorkflowHiFi` | the run dialog — arguments, step preview, projected cost | Tasks › Plans › run | [7.5](modules/workflows/features/run-a-workflow.md) | 🔵 | 🔵 | ❌ |
| 34b | `PlanDetail` | a published version, its flow on the canvas | Tasks › Plans › a plan | [7.1](modules/workflows/features/the-library.md) | ✅ | 🟡 | ❌ |
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
| 34q | `CatalogueList` | 25 entries grouped by bound, each row carrying how many plans name it | Tasks › Catalogue | [7.6](modules/workflows/features/the-catalogue.md) | ✅ | ✅ | ❌ |
| 34r | `SkillDash` | the skill dashboard — the trigger, the playbook, the flow mounted from the Flow tab, and the tab strip that proves the drawer kept its place | Skills › a skill › `More` | [6.1](modules/skills/features/authoring-a-skill.md) · [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34r.1 | `SkillDashDraft` | the same board on a **draft** — no tiles, and three bands that say *nothing published yet* rather than reporting a fault ([SD10](building-studio/skills-dashboards.md)) | Skills › a draft › `More` | [6.1](modules/skills/features/authoring-a-skill.md) | ✅ | ✅ | ❌ |
| 34s | `UsageDash` | the usage dashboard — per version, by agent, by outcome, and the bounded step **list**, whose row is a step and not a run ([SD11](building-studio/skills-dashboards.md)) | Skills › a skill › Usage › `More` | [6.3](modules/skills/features/usage.md) | ✅ | ✅ | ❌ |
| 34s.1 | `UsageDashStates` | the gap as `—` twice — *no data yet* and *too few to read* — the draft's sentence in place of an empty grid, and what the surface never draws | Skills › a skill with no data › Usage | [6.3](modules/skills/features/usage.md) | ✅ | ✅ | ❌ |
| 34t | `RuleDash` | the rule dashboard — the statement, offered · cited · **never cited**, the row's derived words, the versions with their own counts, and where each was cited | Skills › Rules › a rule › `More` | [6.4](modules/skills/features/rules.md) | ✅ | ✅ | ❌ |
| 34u | `BoardActs` | the two acts on a declared board's **own** header — `Save report` and `Reports` — and the strip's `data`-only gate, unchanged ([B21](building-engine/boards-migration.md)) | any declared board | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34u.1 | `BoardStrip` | which control belongs to the strip and which to the header, and the one card behind two bindings | — (the argument) | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34v | `BoardReports` | the `Reports` card — every reading kept of one board, newest first, a row that **opens** rather than restores ([B22](building-engine/boards-migration.md)) | a declared board › `Reports` | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34v.1 | `BoardHistoryTwin` | the same card on a canvas — a banner thumbnail, and a row that forks | Explorer › a canvas › History | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34w | `BoardFrozen` | a report opened — the page says which reading it is, names the way back, and drops the acts a report cannot carry ([B19](building-engine/boards-migration.md)) | `kind:{id}@{version}` | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34w.1 | `BoardEmpty` | nothing kept — the empty line names the act that would fill it, and an empty list is not a 404 ([B9](building-engine/boards-migration.md)) | a board nobody saved | [4.2](modules/explore/features/boards.md) | ✅ | ✅ | ❌ |
| 34x | `BoardSeams` | the five states, a step board's address and the two readings it did not take ([SR44](modules/operate/features/see-what-ran.md)), and what a declared board does not offer | — (the seams) | [4.2](modules/explore/features/boards.md) · [10.5](modules/operate/features/see-what-ran.md) | ✅ | ✅ | ❌ |

**Row 31 is superseded, and its Studio cell is `—` rather than 🟡.** `SkillsHiFi` drew one screen for
two features at once, and its Surface cell named `work/SkillsPanel`, a path that no longer exists —
so every 🟡 that traced to it was reporting a gap that had already been filled somewhere else. The
live drawings are the *Govern, Agents and Skills* canvas's `SkillsPanel` · `SkillAuthor` ·
`SkillFlow` · `SkillUsesPlan` · `SkillVersions`, and rows 34r · 34r.1 · 34s · 34s.1 for the boards
they open.

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
| ✅ Studio has it | 20 | Explorer, the answer surface, Model, Stitches, Datasets, Settings, the agents list and envelope, the plan canvas |
| 🟡 Partly | 7 | Projects, Tasks, Skills, Workflows — the list is there, the detail is not |
| 🔵 Not started | 9 | Review, proposals, schedules, rules, recurring tasks, agent stats, the journal, agent pause |
| — Not a screen | 6 | the CLI transcript, four annotated mocks, the board index |
| **On the kit** | **0** | every screen above predates the shell. That is Phases 2–7, not a backlog item |

The 🔵 rows are where 🖼 will appear: the screen gets built ahead of its engine, renders an
`EmptyState` naming what unlocks it, and flips to ✅ when its slice wires it (DS14 · DS15).

---

## The design canvases

**A canvas is organised one page per feature**, and a feature reaches Studio as a **stacked panel** —
so in practice one page per panel. Every flow and variation of that feature lives on its own page:
the primary journey, each drawer state, each drill-in, the authoring act, every refusal with the bound
it names, the empty and unsupported states, and the seams. A reviewer reads one page and has seen the
whole feature; a feature drawn only on its happy path is not drawn. The rules are in
[CLAUDE.md § Design rules](../../CLAUDE.md); this is the list.

| Canvas | Draws | Pages | State |
|---|---|---|---|
| [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc) | [14 Govern](modules/govern/spec.md) · [5 Agents](modules/agents/spec.md) · [6 Skills](modules/skills/spec.md) · [7 Workflows](modules/workflows/spec.md) · [10.5 Runs](modules/operate/features/see-what-ran.md) · [4.2 Boards](modules/explore/features/boards.md) — 90 artboards | Worlds · Guardrails · the run · the agents · LLMs · Skills · Bindings · Usage · Rules · Plans · Boards · **Runs** | **current.** Supersedes the governance canvas, and the skills canvas for 6.1–6.4 |
| [The Undrawn Features](https://claude.ai/artifact/26QSEwgdJh6xiHr3xJJ4Wn) | the nine features nothing else drew — 11 artboards | D · F · G · J · A, by [sequence](the-sequence.md) block | current. **Its pages are blocks, not features** — the one canvas that predates the rule, and the next pass on any of its features re-pages it |
| *Governance · the lens in the UI* (`8591piJHezfLsUoSZXn3z8`) | Govern, first pass — 7 artboards | one | **superseded.** Kept so the D1 option comparison can be re-read |
| *Skills · and the left rail* (`7c565h2z9irbFBwu1S1ebH`) | [6 Skills](modules/skills/spec.md), the Library panel and the rail — 6 artboards | one | **superseded for 6.1–6.4.** Its `Library` and `RailMap` artboards are still the reference for [7.1](modules/workflows/features/the-library.md) and the rail itself |
| *The Tasks Panel* (`9sAby5rPvkjMLb9BcdCom4`) | the Tasks panel and what it drills into — rows 34b–34q above | four | current |
| *Modeller and Stitching* (`db0a313c-1401-49ad-965f-0727364020fa`) | [1.6 Stitch models](modules/connect-and-model/features/stitch-models.md) — 13 artboards | two | current |
| *Agents at Work Wireframes* (`58f2e380-ef59-41cd-8c96-d3dc7ddd06e4`) | the 42 hi-fi artboards | six | current, and the oldest — it predates the shell contract |

**Owed: one page.** How a plan's strip draws **nested repetition** and **approval gates** is not drawn yet — the brief is [building-studio/drawing-repetition-and-gates.md](building-studio/drawing-repetition-and-gates.md).

**Where the generators live.** `.design/canvas-<name>/` — Python over the shared kit, never hand-written
artboard HTML. `.design/` is gitignored: the canvas is the source and the generator is the build, so a
canvas is rebuilt by re-running its scripts, never by editing a `.dc.html` by hand.

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

## Beyond the 42 · Govern, Agents and Skills

**Ninety artboards on [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc)**,
thirteen pages — one per stacked panel, each carrying that panel's whole feature. It **supersedes**
the first governance canvas (`8591piJHezfLsUoSZXn3z8`), whose seven artboards are rebuilt here; that
one is kept only so the D1 option comparison can be re-read. Generators:
`.design/canvas-govern-agents/`.

The eleven pages below are the ones with rows here. **One more page is owed rows** — `Canvas
designs` (5). It belongs to [7 Workflows](modules/workflows/spec.md), not to this pass, and a
canvas page nothing cites is a decision nobody made. `redesignd — NL query, planned and run` is
**retired as a page**: it argued that rows are the steps and time is the axis worth having, that
argument is settled into [SR46–SR53](modules/operate/features/see-what-ran.md#decisions), and its
five boards — four of which were essays with annotation cards rather than screens — are replaced
by `Operate › Runs — 10.5` below. `Library › repetition and gates` is **retired
as a page**: its four artboards are now variants of the flow canvas
(`library.plans.detail.flow_canvas.complex_variant1–3` and `library.plans.detail.ceilings`), on the
page that cites them ([LB20 · LB21 · LB28 · LB29 · LB30](modules/workflows/features/the-library.md#decisions)).
All four are generated by `.design/canvas-govern-agents/rg.py`, on the same layer strip every other
plan surface draws — time across, the participants it spends down.


### `Operate › Runs` — the 16 artboards

One journal, one run read four ways, and a step read three — with the address in the crumb, what it touched and the files it left ([SR54–SR58](modules/operate/features/see-what-ran.md#decisions)). **The description here is the artboard's frame
title, character for character** — the canvas and this table are one string, not two.

| Artboard | What it draws | Feature |
|---|---|---|
| `operate.runs.list` | One journal for everything that ran: an ask, a load, a stitch and an enrichment, newest first, with children under their parent | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.list.states` | Nothing has run, the list filtered to imports, the interactive runs it hides by default, and what a member without write sees | [10.5](modules/operate/features/see-what-ran.md) |
| | | |
| `operate.runs.detail.in_order` | The run in the order it happened: a row is a step, the layer it spent is a column on the row, and the loop contains its own rounds | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.detail.in_order.card` | A step picked: the card carries its attempts, what it recorded and its last line, and the row stays a row | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.detail.in_order.states` | In flight, answered-but-empty, failed on a spent bound, parked at a gate, delegating and cancelled: six readings of the same list | [10.5](modules/operate/features/see-what-ran.md) |
| | | |
| `operate.runs.detail.layers` | The run on its own clock: the participant a step spent is the row, its bound is a bracket and the gate is a rule across every band | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.detail.layers.forecast` | The plan’s p50 on the run’s own axis: every compute step lands inside p95, and the one part nothing can forecast says so | [10.5](modules/operate/features/see-what-ran.md) |
| | | |
| `operate.runs.detail.flow` | The plan that ran with status on it: the round that went back, the attempt that stuck, the branch this run never took | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.detail.flow.step` | A task picked on the flow: what it spent, what it returned and the gate it waited on, with its own page one click away | [10.5](modules/operate/features/see-what-ran.md) |
| | | |
| `operate.runs.detail.lens` | Allowed, touched, never touched and refused: the gap between what the world permits and what the run actually did | [10.5](modules/operate/features/see-what-ran.md) |
| | | |
| `operate.runs.step` | One step’s own page: what it was asked after binding, what it returned, what it cost and the clock it ran on, attempt by attempt | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.step.touched` | What the step read, what it wrote, what it was refused and the files it left, each counted per participant | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.step.touched.write` | The same reading on a step that creates: nodes and edges per model, created apart from updated, and the rejected records kept as a file | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.step.log` | The step’s own slice of the stream, full height, with the attempt boundaries marked and the levels filterable | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.step.states` | In flight, failed on a spent bound, cancelled, recorded nothing, purged by retention and read-only: six readings of the same step shell | [10.5](modules/operate/features/see-what-ran.md) |
| `operate.runs.step.exchange` | The same step shell when a person was asked: the question, the options, who chose and what the run did next | [10.5](modules/operate/features/see-what-ran.md) |

**What the kit still owes these 16.** Eleven components, five extensions, seven `@invana/dashboard` panel kinds and three canvas items — listed with their build order in [building-studio/design-kit-coverage.md § 7](building-studio/design-kit-coverage.md#7-operate--runs--what-the-16-artboards-need),
queued with their status in [building-studio/components-todo.md](building-studio/components-todo.md).

**What it supersedes.** `redesignd` drew the argument; this page draws the product. `In order` keeps
RD1's reading — a row is a step, the layer is a column on the row — and the other three readings
absorb what RD2–RD5 were arguing: the time axis is `Layers` on the run's clock
([SR49](modules/operate/features/see-what-ran.md#decisions)), the forecast is
`layers.forecast` ([SR51](modules/operate/features/see-what-ran.md#decisions)), and the exchange a
person had with the run is the `Output` panel of that step's own page
([SR31](modules/operate/features/see-what-ran.md#decisions) · `operate.runs.step.exchange`). The
annotation cards do not come across: an artboard draws only what a user sees, and the reasoning
lives in the feature file.

### `Library › Plans` — the 22 artboards

One row per name prefix, parent leftmost. **The description here is the artboard’s frame
title, character for character** — the canvas and this table are one string, not two
([LB25](modules/workflows/features/the-library.md#decisions)).

| Artboard | What it draws | Feature |
|---|---|---|
| `library.plans.list` | Every plan the library can select, with its origin, the bands it engages and what has selected it | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.list.states` | The four states a row can be in: retired, in flight, never selected, and cannot run | [7.1](modules/workflows/features/the-library.md) |
| | | |
| `library.plans.detail.overview` | The six layers a plan will touch, time across and participants down, and what it has cost so far | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.overview.folded` | Collapse all: six lines, every task still placed in time, and a hover card gives the participant back | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.versions` | Every version, what changed between two immutable ones, and how each of them fared | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.arguments` | The arguments a plan declares, and the callers that tune them without forking it | [7.1](modules/workflows/features/the-library.md) |
| | | |
| `library.plans.detail.flow_canvas` | The published plan as a canvas, read-only, carrying medians rather than statuses | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.flow_canvas.complex_variant1` | A plan that repeats: three bounds on one flow, and only two of them get a bracket | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.flow_canvas.complex_variant2` | A plan with an approval: a gate is a seam the bands are crossed by, never a task on one of them | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.flow_canvas.complex_variant3` | A plan with a verdict: a seam on the far edge of the pass, with the bracket it sends back hanging off it | [7.1](modules/workflows/features/the-library.md) |
| | | |
| `library.plans.detail.flow_canvas.edit` | Drafting with the Assistant shut: the catalogue is the palette, the whole flow is in view, the editor is two columns | [7.7](modules/workflows/features/draft-a-plan.md) |
| `library.plans.detail.flow_canvas.edit.states` | The three refused tasks and one file error that hold a publish, each naming its bound | [7.7](modules/workflows/features/draft-a-plan.md) |
| `library.plans.detail.flow_canvas.edit.assistant` | The same draft with the Assistant open: mainSection gives up 360px, the canvas pans to the selection and the editor stacks | [7.7](modules/workflows/features/draft-a-plan.md) |
| `library.plans.detail.manifest` | The same document as YAML, with the refused line marked in the gutter | [7.7](modules/workflows/features/draft-a-plan.md) |
| | | |
| `library.plans.detail.retire` | What retiring stops, what keeps running regardless, and who loses their plan | [7.7](modules/workflows/features/draft-a-plan.md) |
| `library.plans.detail.export` | A published version as YAML, for reading in a pull request rather than editing | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.readonly` | A member without write: the plan reads in full, and the acts they lack are absent | [7.1](modules/workflows/features/the-library.md) |
| `library.plans.detail.ceilings` | Every ceiling a plan carries, and the three above one that are worth a pixel on the drawing | [7.1](modules/workflows/features/the-library.md) |
| | | |
| `library.plans.create` | A new plan starts as an empty draft, and the empty canvas says what to drag onto it | [7.7](modules/workflows/features/draft-a-plan.md) |
| | | |
| `library.catalogue.list` | Every callable, grouped by the bound it spends, and how many plans name each one | [7.6](modules/workflows/features/the-catalogue.md) |
| `library.catalogue.detail` | A task's contract read in the drawer, beside the plan that sent you to it | [7.6](modules/workflows/features/the-catalogue.md) |
| `library.catalogue.list.states` | Unused, ungranted, per-lane only, and a name this engine does not have | [7.6](modules/workflows/features/the-catalogue.md) |
| Page | Feature | Artboards |
|---|---|---|
| Govern › Worlds | [14.1](modules/govern/features/worlds.md) | `Main` (the drawer, and what a world did to the question) · `GovWorld` (five layer sections, the slice, the cast) · `WorldEdit` (authoring, and the two refusals) · `WorldLadder` (naming publishes, promoting binds, the six seams) |
| Govern › Guardrails | [14.2](modules/govern/features/guardrails.md) | `GovGuardrails` (the sibling drawer, what a save would cost, what an auditor is handed) · `GuardrailEdit` (an address, allow or deny, egress per destination) |
| Govern › what a world did | [10.5](modules/operate/features/see-what-ran.md) · [14.1](modules/govern/features/worlds.md) | `RunLens` (six bands, what each step touched, refusals struck, *This run's lens* + Retune) · `RunLensStep` (generated vs executed, and what egress cut) · `GovCompare` (the one participant that differed) · `Cast` (innermost wins, then it is checked) |
| Agents › Agents | [5.2](modules/agents/features/author-an-agent.md)–[5.7](modules/agents/features/concurrency-and-contention.md) | `AgentsList` · `AgentEnvelope` · `AgentLineage` · `AgentLifecycle` · `AgentConcurrency` |
| Agents › LLMs | [5.1](modules/agents/features/providers-and-models.md) | `AgentsLlms` |
| Library › Plans | [7.1](modules/workflows/features/the-library.md) · [7.6](modules/workflows/features/the-catalogue.md) · [7.7](modules/workflows/features/draft-a-plan.md) | **22 artboards** — named `module.feature.surface.variant`, one row per name prefix, no annotation cards. Listed one by one in [the table below](#library--plans--the-22-artboards) |
| Skills › Skills | [6.1](modules/skills/features/authoring-a-skill.md) | `SkillsPanel` (the panel, and the skill/rule line) · `SkillAuthor` (four fields, and the sentence `draft_plan` stops and asks about) · `SkillFlow` (**the plan in its six layers** — the only flow view, [SK16](modules/skills/features/authoring-a-skill.md)) · `SkillUsesPlan` (inlining a library plan with `uses`, and tuning what it declares — built on `SkillPlanEditor`'s rows) · `SkillVersions` (seven versions, immutable, the v4→v5 diff, a hand-edit flipping `origin`) |
| Skills › Bindings | [6.2](modules/skills/features/bindings.md) | `SkillBindings` (bound, refused, and the world that changes which model decides) · `BindRefusals` (both halves run; the plan's declared bands with the shut one struck, and the three readings that shut one [BN13](modules/skills/features/bindings.md)) · `BindFromAgent` (the agent's side — it binds as you click, the refusal under the chip, the draft chip, and what the bindings cost in characters [BN11](modules/skills/features/bindings.md) · [BN14](modules/skills/features/bindings.md) · [BN15](modules/skills/features/bindings.md)) · `SkillOffer` (the fixed assembly order, discrete items with ids, what the record holds after) · `BindSeams` (a draft · unbound · in flight · refused · read-only) · `BindStanding` (the row's world as context, and the writer it does not have yet [BN12](modules/skills/features/bindings.md)) |
| Skills › Usage | [6.3](modules/skills/features/usage.md) | `SkillUsage` (per version, by agent, by run outcome) · `UsageVersions` (every version with `enough_to_read`, and the v1 migration) · `UsageReadings` (four readings, and the move each names) · `UsageSeams` (too few · none yet · purged · self-reported) |
| Skills › Rules | [6.4](modules/skills/features/rules.md) | `RulesPanel` (one statement, cited by 214 steps — and the four statements that are **not** rules) · `RuleAuthor` (the scope choice, and the nudge that it is two rules) · `RuleCited` (offered against cited, and what deactivating keeps) · `RulesProject` (a Project's working rules, the invariants read-only above) |
| Operate › Runs | [10.5](modules/operate/features/see-what-ran.md) | **16 artboards** — the journal, one run in four readings, and a step in three readings, its two other kinds and its six states. Listed one by one in [the table above](#operate--runs--the-16-artboards). Supersedes the `redesignd` page, and `Govern › what a world did` keeps only what is about the *world* |

Every row above is `Shell ✅` and `API` follows its feature's row in [README.md](README.md).

### Govern and Agents — the sixteen, and what each one needs

The state of the two panels this pass designed for. The eleven kit components are built and storied;
**Every Govern board is built** — W1 · W2 · W3 · W4 · G1 · G2 · R1 · R2 · R3 · R4 — against a
seeded Graph, with their seams and their refusals. The Agents boards are drawn only.

**R1 · R2 · R3 read real touches now.** Build-order step 5a landed: the interpreter checks an
address before it dispatches, the connector is handed a `QueryLens` built from the frozen snapshot,
the prompt is cut to what egress permits, and every engagement writes a `touch` frame with one
`run_touches` row projected from it ([GV28–GV32](modules/govern/spec.md)). The three boards render
their *nothing recorded* state only for a run that engaged nothing, and 14.1 · 14.2 are `API ✅`.
**What is still 🟡 is the CLI**: `govern apply | list | show` author and read a lens, and nothing
reads a run's ledger from a terminal.

| # | Artboard | Panel view | Needs, in the engine | Needs, in the kit | API | Studio |
|---|---|---|---|---|---|---|
| W1 | `Main` | Govern › Worlds — the drawer | `lenses` · `lens_id` on runs · usage read | `LensRow` · `LensChip` · `LayerChip` | ✅ | ✅ |
| W2 | `GovWorld` | a world, read as one object | `rules[]` · `cast` · `as_of` | `LayerSection` · `RuleRow` · `SliceSummary` · `CastTable` | ✅ | ✅ the drill-in, and a page kind `world:<id>` named for the world ([WO15](modules/govern/features/worlds.md)) |
| W3 | `WorldEdit` | authoring, and two refusals | participant catalogue · `graph_versions.axes` · validate | `MatchPreview` · `SliceSummary` | ✅ | ✅ |
| W4 | `WorldLadder` | naming publishes, promoting binds | `key` + `name` · `promote` · `duplicate` · `delete` | `AlertDialog` · `CannotAnswerCard` | ✅ | ✅ |
| G1 | `GovGuardrails` | Govern › Guardrails | `scope` · `can_edit_guardrails` · impact | `LayerSection` · `RuleRow` · `EgressList` · `DiffList` | ✅ | ✅ the drill-in, and a page kind `guardrail:<id>` ([GR14](modules/govern/features/guardrails.md)) |
| G2 | `GuardrailEdit` | the rule builder | catalogue match resolution | `MatchPreview` · `AddressChip` | ✅ | ✅ |
| R1 | `RunLens` | the run in six bands | `run_touches`, written by the interpreter | `LayerStrip` · `AddressChip` | ✅ | ✅ |
| R2 | `RunLensStep` | one step, generated vs executed | `run_touches.query` from the connector · `sent` from the cut | `EgressList` · `SliceSummary` | ✅ | ✅ |
| R3 | `GovCompare` | two runs, one question | compare over `run_touches` | `DiffList` · `RecordHeader` | ✅ | ✅ a page kind, `compare:<a>:<b>` |
| R4 | `Cast` | innermost wins, then checked | `LensRead.cast_resolved` | `CastTable` · `CannotAnswerCard` | ✅ | ✅ |
| A1 | `AgentsList` | Agents › Agents | `agents.lens_id` read **and** written, and composed at run open · `llm_config_id` gone · `spend_this_month` | `LensChip` · `CastTable` · `MetricTile` | ✅ | ✅ the lens chip, the spend line, and *nothing priced* where a subscription answers |
| A2 | `AgentEnvelope` | the envelope | all ten `budget` keys | `BoundChip` (exists) · `DataTable` | ✅ | ✅ the ceilings are a table with an **Enforced** column (EB7) |
| A3 | `AgentLineage` | delegation and lineage | — | `TreeView` (exists) | ✅ | ✅ |
| A4 | `AgentLifecycle` | pause, resume, retire | one preview, two acts — the same open work, the effects differ ([LC8](modules/agents/features/lifecycle.md)) | `AlertDialog` · `DataTable` | ✅ | ✅ |
| A5 | `AgentConcurrency` | the ceiling belongs to the Graph | `graphs.pools` · `GET …/contention` | `DataTable` (exists) | ✅ | ✅ in Settings › Agents, where the ceiling is set (C8) |
| A6 | `AgentsLlms` | Agents › LLMs | `llm_models` · `is_default` gone · ranks derived at add (PM17) | `AddressChip` | ✅ | ✅ a drawer of the Agents stack; an endpoint is a group over its models |

**Where the work is written down.** The engine column of every row is
[building-engine/govern-and-agents-data-model.md](building-engine/govern-and-agents-data-model.md);
the kit column is
[building-studio/govern-and-agents-panels.md](building-studio/govern-and-agents-panels.md). Between
them they carry the ER diagrams, the migration order, the component list and the build order — and
neither ships until the other is agreed, because a component with no engine shape is a drawing and
an engine shape with no component is a table.

### The first pass, superseded

Seven artboards on *Governance · the lens in the UI*
(`claude.ai/artifact/8591piJHezfLsUoSZXn3z8`) — drawing [14 · Govern](modules/govern/spec.md).
Three more on it keep the D1 option comparison and are not screens.

| Artboard | Draws | API | Studio | Shell |
|---|---|---|---|---|
| `RunLens` | the run dashboard — six layer bands, the touch record, `This run's lens` ([D16](modules/govern/spec.md)) | 🔵 | 🔵 | ✅ |
| `GovWorlds` | Govern › Worlds — the drawer and the world chip | 🔵 | 🔵 | ✅ |
| `GovWorld` | a world — five layer sections, the slice box | 🔵 | 🔵 | ✅ |
| `GovGuardrails` | Govern › Guardrails, and what a save would cost ([GR2](modules/govern/features/guardrails.md)) | 🔵 | 🔵 | ✅ |
| `AgentsList` | Agents › Agents — an agent carries a lens, not a provider ([D2](modules/govern/spec.md)) | 🟡 | 🟡 | ✅ |
| `AgentsLlms` | Agents › LLMs — no default, the cast picks ([D19](modules/govern/spec.md)) | ✅ | 🟡 | ✅ |
| `GovCompare` | Compare — one question, two worlds, the touch diff | 🔵 | 🔵 | ✅ |
| `Main` · `OneSurface` · `TwoRecords` | — the D1 option comparison, kept as the record. **Not screens** | — | — | — |

## Beyond the 42 · Skills and the left rail

> **Superseded for 6.1–6.4** by the Skills pages of
> [Govern, Agents and Skills](https://claude.ai/artifact/VrdrR5iKGfqsjhCouQDTbc). `Library` and `RailMap` below are still
> the reference for [7.1](modules/workflows/features/the-library.md) and for the rail itself.

Six artboards on a fourth canvas — *Skills · and the left rail*
(`claude.ai/artifact/7c565h2z9irbFBwu1S1ebH`) — drawing [6 · Skills](modules/skills/spec.md), the
**Library** panel ([G41](building-studio/graph-detail-page.md)) and the rail itself.

| Artboard | Draws | API | Studio | Shell |
|---|---|---|---|---|
| `Main` (SkillsPanel) | Skills › Skills · Rules, and the skill/rule line | 🟡 | 🟡 | ✅ |
| `SkillFlow` | a skill's **Flow** tab — the plan canvas, every step naming its sentence | 🟡 | 🔵 | ✅ |
| `SkillAuthor` | authoring — the clarification that pauses instead of guessing ([§0.8](orchestration.md#08-a-skill-drawn-as-a-flow)) | 🔵 | 🔵 | ✅ |
| `SkillBindings` | agent · skill · plan, and the bind-time refusal | ✅ | ✅ | ✅ |
| `Library` | Library › Plans · Catalogue · Templates ([G41](building-studio/graph-detail-page.md)) | 🟡 | ✅ | ✅ |
| `RailMap` | the rail itself — eight top, three bottom. **A map, not a screen** | — | — | — |

**`Shell ✅` on every row above, and it means something different here.** These were composed on the
shell contract from the first line — `leftNav`, a 420px `leftSection`, stacked drawers, `mainSection`
as pages, tokens only. They are the first screens in the product for which that is true, which is
also why none of them can be compared to the 42's `Shell ❌` rows: those were drawn before the
contract existed.

## Beyond the 42 · The undrawn features

Eleven artboards on a fifth canvas — *The Undrawn Features*
(`https://claude.ai/artifact/26QSEwgdJh6xiHr3xJJ4Wn`) — drawing the features [the-sequence.md](the-sequence.md) still has to
build and **nothing drew**. Generated from `.design/canvas-features/`, composed on the same kit as the
governance and skills canvases, so `Shell ✅` means what it means there.

| Artboard | Block | Draws | API | Studio | Shell |
|---|---|---|---|---|---|
| `Main` (BundleLoad) | D | a bundle as **one run** — `check → load` (3 lanes) `→ stitch → report`, and `triage` branching on failure | 🔵 | 🔵 | ✅ |
| `Lanes` | D | a fan-out meeting a pool — 200 lanes, 20 slots, fair share across runs, a queued lane holding nothing | 🟡 | 🔵 | ✅ |
| `Approval` | D | the budget ceiling **pausing** the run, naming the spend, the bound and the next task's estimate | 🟡 | 🔵 | ✅ |
| `Events` | F | every write by principal — `on_behalf_of` as its own field, the causal chain, before and after, a purged window | 🟡 | 🟡 | ✅ |
| `Tokens` | F | a scoped read-only token as a **principal** — the secret shown once, an out-of-scope refusal naming the scope, what it read | 🔵 | 🔵 | ✅ |
| `Evidence` | G | counts ranked by gap over a stated window, *12 runs — too few to read*, and the proposal that already cites them | 🔵 | 🔵 | ✅ |
| `Recall` | G | recall as a **planned step**: the query in the trace, 14 read and 4 cited, and *no prior records* as a stated outcome | 🔵 | 🔵 | ✅ |
| `Console` | J | `bottomSection` under the canvas only — Records · Query, the context bar as its last row | ✅ | 🔵 | ✅ |
| `Capabilities` | J | a property type **refused where the author is typing**, and the banner when the database downgrades under two models | 🟡 | 🔵 | ✅ |
| `Vector` | J | nodes with scores as records, and *unsupported* declared by vendor before anything runs | 🔵 | 🔵 | ✅ |
| `RowShapes` | A | **G40** — a skill row (prose over sans) against a plan row (key over mono), and why they may not look alike | 🟡 | 🟡 | ✅ |

**Two decisions were made in the drawing, and they are recorded in their feature files, not here:**
Tokens is a **group inside Settings › Graph** rather than a fourth settings tab
([10.4 EA9](modules/operate/features/external-agent-api.md)), and Evidence is a **page reached from
the Skills drawer**, not a rail item of its own ([8.1 EV6](modules/memory/features/evidence.md)).

---

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
| 5.2 | Author an agent | ✅ | ✅ | S12c | `ModellerSessionHiFi` · `AgentsHiFi` | ✅ |
| 5.3 | Envelope and budget | ✅ | ✅ | S12c | `AgentHiFi` | ✅ |
| 5.4 | Delegation | ✅ | ✅ | S12d | `AgentsLineageHiFi` | ✅ |
| 5.5 | Lifecycle | ✅ | ✅ | S12c | `AgentPausedHiFi` | 🔵 |
| 5.6 | Lineage | ✅ | ✅ | S12c | `AgentsLineageHiFi` | ✅ |
| 6.1 | Authoring a skill | ✅ | ✅ | S5 | `SkillsPanel` · `SkillAuthor` · `SkillFlow` · `SkillUsesPlan` · `SkillVersions` · `SkillDash` · `SkillDashDraft` (superseding `SkillsHiFi`) | ✅ |
| 6.2 | Bindings | ✅ | ✅ | S12c | `SkillBindings` · `BindRefusals` · `BindFromAgent` · `SkillOffer` · `BindSeams` · `BindStanding` | ✅ |
| 6.3 | Usage | ✅ | ✅ | S12c | `SkillUsage` · `UsageVersions` · `UsageDash` · `UsageDashStates` (superseding `SkillsHiFi`) | ✅ |
| 6.4 | Rules | ✅ | ✅ | S12b | `RulesPanel` · `RuleAuthor` · `RuleCited` · `RulesProject` (superseding `RulesHiFi`) | ✅ |
| 7.1 | The library | 🟡 | 🟡 | S12c | `WorkflowsHiFi` | 🟡 |
| 7.2 | Plan selection | 🟡 | 🟡 | S9d | `WorkflowStepHiFi` | 🟡 |
| 7.5 | Run a workflow | 🔵 | 🔵 | S15 | `RunWorkflowHiFi` | 🔵 |
| 7.6 | The catalogue | 🟡 | 🔵 | S12c | `CatalogueList` · `CatalogueDetail` (⛔ considered, not built) | 🔵 |
| 7.7 | Draft a plan | 🔵 | 🔵 | S15 | `PlanDraftCanvas` · `PlanDraftYaml` · `PlanRetire` · `PlanStepParams` | 🔵 |
| 8.3 | Proposals | 🔵 | 🔵 | S12c | `ReviewProposalHiFi` | 🔵 |
| 8.4 | Consolidation | 🔵 | 🔵 | S12c | `ReviewProposalHiFi` | 🔵 |
| 9.1 | Projects and tasks | 🟡 | 🟡 | S12b | `ProjectsHiFi` · `SwingProjectHiFi` · `ProjectPlanHiFi` · `NewTaskHiFi` · `TaskHiFi` | ✅ · 🟡 |
| 9.2 | Objectives and criteria | 🔵 | 🔵 | S12b | `JournalTaskHiFi` | 🔵 |
| 9.3 | Review | 🔵 | 🔵 | S12b | `ReviewHiFi` · `TaskReviewHiFi` | 🔵 |
| 9.4 | Recurring tasks and conditions | 🔵 | 🔵 | S12e | `RecurringTaskHiFi` | 🔵 |
| 10.1 | Schedules | 🔵 | 🔵 | S9.5 | `SchedulesHiFi` | 🔵 |
| 10.3 | Observability | 🔵 | 🔵 | S11 | `AgentStatsHiFi` | 🔵 |
| 10.5 | See what ran | 🔵 | 🔵 | S14 | `RunDetail` · `DrawerRunsList` · `DrawerRunLive` · `DrawerRunAll` · `DrawerRunDebug` · `RunDash` · `StepImport` · `StepQuery` · `StepLlm` · `RunLens` | 🔵 · ✅ |
| 13.3 | Command line | — | — | — | `CliHiFi` | — |
| 13.7 | Setup | ✅ | 🟡 | S13 | `SetupPageHiFi` · `SetupBlockedHiFi` · `SetupReadyHiFi` · `SetupLocksHiFi` | 🟡 |
| 14.1 | Worlds | 🔵 | 🔵 | S16 | `GovWorlds` · `GovWorld` · `GovCompare` | 🔵 |
| 14.2 | Guardrails | 🔵 | 🔵 | S16 | `GovGuardrails` | 🔵 |
| 2.3 | Load a bundle | 🔵 | 🔵 | S15 | `Main` (BundleLoad) | 🔵 |
| 4.4 | The console | ✅ | 🔵 | S12f | `Console` | 🔵 |
| 8.1 | Evidence | 🔵 | 🔵 | S12c | `Evidence` | 🔵 |
| 8.2 | Recall by query | 🔵 | 🔵 | S9d | `Recall` | 🔵 |
| 10.2 | Audit and activity | 🟡 | 🟡 | S5.5 · S12a | `Events` | 🟡 |
| 10.4 | External-agent API | 🔵 | 🔵 | S10 | `Tokens` | 🔵 |
| 12.3 | Capabilities | 🟡 | 🔵 | S3 | `Capabilities` | 🔵 |
| 12.4 | Vector search | 🔵 | 🔵 | S7 | `Vector` | 🔵 |
| 13.8 | The runtime | 🟡 | — | S15 | `Lanes` · `Approval` · `VerdictReviewHiFi` | 🔵 |

**Not drawn — 23 features with no artboard.** They ship from their feature files alone.

| # | Feature | API | Studio |
|---|---|---|---|
| 1.2 | Introspect a database | ✅ | ✅ |
| 1.5 | Share a model | ✅ | ✅ |
| 1.7 | Starter models | ✅ | ✅ |
| 3.1 | Write queries | ✅ | ✅ |
| 3.5 | Streaming and the workflow | ✅ | ✅ |
| 3.11 | Act as | 🔵 | 🔵 |
| 3.7 | Reasoning trace | ✅ | ✅ |
| 3.9 | The runtime | ✅ | — |
| 5.7 | Concurrency and contention | ✅ | ✅ |
| 7.3 | Envelope validation | 🟡 | 🔵 |
| 7.4 | Promote a plan | 🟡 | 🟡 |
| 11.1 | Accounts | 🟡 | 🟡 |
| 11.2 | Usernames | ✅ | ✅ |
| 11.3 | Sessions | ✅ | 🟡 |
| 11.4 | Membership | ✅ | ✅ |
| 11.5 | Personal access tokens | ✅ | ✅ |
| 12.1 | The connector contract | ✅ | — |
| 12.2 | Languages | ✅ | 🟡 |
| 13.1 | Design system | — | 🟡 |
| 13.2 | Theming | — | ✅ |
| 13.4 | Logging | ✅ | — |
| 13.5 | Telemetry | ✅ | — |
| 13.6 | Admin and health | ✅ | — |
