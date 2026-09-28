# Module structure — names follow modules

**Status: decided; R0 written, R1–R6 not started.** Branch `chore/names-follow-features`. The rules are in
[terminology.md § How a module is named](terminology.md#how-a-module-is-named) and
[building-studio/code-shape.md](building-studio/code-shape.md) §4; the module map is in the [README](README.md#the-modules).
Nothing beyond `RunsList` (§4) has moved.

The product's words moved — Todo · TaskPlan · Task · TaskRun ([orchestration.md § 0](orchestration.md#0-the-records)),
**Runs**, **Library**, **Projects** — and the folders did not. One thing carries a different name in the
docs module, the Studio folder and the engine package. This file sets one module structure, one name
per module across all three layers, one component-naming convention, and the order the moves are made in.

## 1. Naming rule

> **A module is a plural noun for the records it holds, and it has the same name in docs, Studio and
> the engine.** It stays singular only for one surface or a mass noun — `explorer`, `assistant`,
> `memory`, `setup`, `runtime`, `tooling`, `design`. Groups sit above modules; they order the docs and hold no code.
> A module keeps a qualifier the product's words require: `graph-connectors`, because *connector*
> alone is never ours ([terminology.md §8](terminology.md#8-words-we-do-not-use)).

| Level | Named for | Examples | Change |
|---|---|---|---|
| Group | a product area | Data · Exploration · Answers · Work · Orchestration · Governance · Platform | new |
| Module | the records it holds, plural | `models` · `agents` · `runs` · `lenses` | replaces verb phrases: `bring-data-in`, `connect-and-model`, `operate`, `ask`, `work`, `workflows` |
| Feature | what a person does — a verb phrase | *Author an agent* · *Promote a plan* | unchanged — [terminology.md § How a feature is named](terminology.md#how-a-feature-is-named) holds |
| Component | the occupant and its role ([§5](#5-component-names--one-meaning-per-suffix)) | `RunsViewPanel` · `TodosSection` · `RunDetail` | one meaning per suffix |

**What this overturns, for module folders only:**

| Rule today | Where | Becomes |
|---|---|---|
| "A path follows only when the word goes" | [terminology.md](terminology.md#how-a-feature-is-named) | still true for **feature** files; a **module** folder takes the §1 name |
| "The folder is the module, never a feature of it" — kept `features/ask/` over `features/assistant/` | [code-shape.md §4.1b](building-studio/code-shape.md) | the folder is the §2 module name |
| "`leftNav` — one icon per feature module" vs G2 "a module with several surfaces contributes several icons" | [terminology.md](terminology.md), [the-shell.md](building-studio/the-shell.md), [graph-detail-page.md](building-studio/graph-detail-page.md) | the §2 table is the map. A module may have several icons (`graphs`: Info · Settings) and an icon may host several modules (Library: `plans` · `projections`) |

## 2. Modules

Seven groups, 26 modules. Every feature file keeps its filename and its number; only its folder moves
([§2.1](#21-feature-numbers)).

```mermaid
flowchart LR
  subgraph Data
    graphs; models; imports; graph-connectors
  end
  subgraph Exploration
    explorer; queries; boards
  end
  subgraph Answers
    assistant; projections; memory
  end
  subgraph Work
    projects
  end
  subgraph Orchestration
    agents; llms; skills; rules; plans; reviews; runs; schedules
  end
  subgraph Governance
    lenses; events
  end
  subgraph Platform
    accounts; setup; runtime; tooling; design
  end
  Data --> Exploration --> Answers --> Work --> Orchestration --> Governance
  Platform -.-> Data
```

| Group | Module | Features (existing files) | Studio surface | From |
|---|---|---|---|---|
| **Data** | `graphs` | connect-a-database — the Graph, its connection, its members | `leftNav` Info · Settings | connect-and-model |
| | `models` | introspect-a-database · domain-models · model-editor · share-a-model · starter-models · stitch-models · the-model-page | `leftNav` Model | connect-and-model |
| | `imports` | load-data · load-a-bundle · inspect-what-landed | none — CLI, and a Runs filter | bring-data-in |
| | `graph-connectors` | the-connector-contract · languages · capabilities · vector-search | none (engine) | graph-connectors |
| **Exploration** | `explorer` | graph-canvas · selection-and-the-panel | `leftNav` Explorer · Inspector | explore |
| | `queries` | write-queries · the-console | `bottomSection` Console | ask · explore |
| | `boards` | boards | `mainSection` | explore |
| **Answers** | `assistant` | the-assistant · ask-in-natural-language · the-answer-surface · the-answer-in-words · streaming-and-the-workflow · clarifying-questions · reasoning-trace · when-it-cannot-answer · beyond-the-graph · act-as | `rightSection` Assistant | ask |
| | `projections` | projections | Library › Templates | ask |
| | `memory` | evidence · recall-by-query · proposals · consolidation | page opened from Skills | memory |
| **Work** | `projects` | projects-and-tasks · objectives-and-criteria · recurring-tasks-and-conditions | `leftNav` Projects | work |
| **Orchestration** | `agents` | author-an-agent · envelope-and-budget · delegation · lifecycle · lineage · concurrency-and-contention · soul | `leftNav` Agents | agents |
| | `llms` | providers-and-models | Agents › LLMs · Settings › LLMs | agents |
| | `skills` | authoring-a-skill · bindings · usage | `leftNav` Skills | skills |
| | `rules` | rules | Skills › Rules | skills |
| | `plans` | the-library · plan-selection · envelope-validation · promote-a-plan · draft-a-plan · run-a-workflow · the-catalogue | `leftNav` Library | workflows |
| | `reviews` | review | the Review queue | work |
| | `runs` | see-what-ran · observability | `leftNav` Runs | operate |
| | `schedules` | schedules | none yet | operate |
| **Governance** | `lenses` | worlds · guardrails | `leftNav` Govern | govern |
| | `events` | audit-and-activity | `leftNav` Events | operate |
| **Platform** | `accounts` | accounts · usernames · sessions · membership · personal-access-tokens · external-agent-api | user menu | identity-and-access · operate |
| | `setup` | setup | onboarding wizard · Info | platform |
| | `runtime` | runtime · runtime-and-adapters | none | platform · ask |
| | `tooling` | command-line · logging · telemetry · admin-and-health | CLI | platform |
| | `design` | design-system · theming | everywhere | platform |

### 2.1 Feature numbers

**A feature's number is permanent.** `5.1` is providers-and-models wherever its file lives, so every
citation — commit messages, code comments, canvas page names, memory notes, other branches — keeps
pointing at the right feature. The README sections are ordered by group, so the numbers read out of
order; nothing depends on them being sequential, and everything depends on them not changing.

| Rule | Detail |
|---|---|
| A moved feature keeps its number | `5.1` providers-and-models moves to `orchestration/llms/` and stays `5.1` |
| A new feature takes the next free number in its module's series | a series is the number its first feature carries: `llms` → 5.x, `rules` → 6.x, `projects` → 9.x, `lenses` → 14.x |
| A number is never reused | a retired feature's number stays retired, as a decision ID does |

## 3. One name, three layers

| Layer | Shape | Why |
|---|---|---|
| Docs | `modules/<group>/<module>/{spec.md, features/}` | the README reads by group |
| Studio | `pages/graphs-detail/features/<module>/`, flat | `leftNav` is flat; a group level adds only import churn |
| Engine | `apps/<module>/` where the module owns tables; `server/<module>/` for its routes — flat | a package owns tables; `imports`, `queries` and `design` own none and get no package |

**Studio and the engine use the same module name, always.** Every Studio `features/<m>/` has an engine
folder called `<m>`: `apps/<m>/` when the module owns tables, and `server/<m>/` when it has routes of its own
(`setup` has none — it is served through `server/graphs/`). Where a module's records live in a band rather than an app — `runs` in `runtime/`, `events` in
`core/events/` — the band keeps its name ([migration-plan.md](building-engine/migration-plan.md) §2) and
`server/<m>/` carries the module's name.

| Module | Studio `features/` | Engine `apps/` | Engine `server/` |
|---|---|---|---|
| `agents` | `agents/` | `agents/` | `agents/` |
| `assistant` | `assistant/` ← ask | `assistant/` ← sessions | `assistant/` ← sessions |
| `boards` | `boards/` | `boards/` | `boards/` |
| `events` | `events/` ← operate | — (records in `core/events`, tree in `activity`) | `events/` ← routes/events.py |
| `explorer` | `explorer/` | `explorer/` | `explorer/` |
| `graphs` | `graphs/` ← graph-settings | `graphs/` | `graphs/` |
| `lenses` | `lenses/` ← govern | `lenses/` ← govern | `lenses/` ← govern |
| `llms` | `llms/` ← agents/Llms* | `llms/` ← llm_providers + llm (provider half) | `llms/` ← llm_providers |
| `models` | `models/` ← connect-and-model | `models/` ← modeller | `models/` ← modeller + routes/{models,model_links,schemas} |
| `plans` | `plans/` ← workflows | `plans/` ← task_plans | `plans/` ← task_plans + runtime/catalogue.py |
| `projections` | `projections/` ← ask/projections | — (records in `runtime`) | `projections/` ← runtime/templates.py |
| `projects` | `projects/` ← work | `projects/` ← work | `projects/` ← work |
| `rules` | `rules/` ← skills/Rule* | `rules/` ← skills (rules, rule_versions) | `rules/` |
| `runs` | `runs/` ← operate | — (records in `runtime`) | `runs/` ← runtime/runs.py |
| `setup` | `setup/` | `setup/` | — (served through `graphs/`) |
| `skills` | `skills/` | `skills/` | `skills/` |

```text
docs/for-developers/modules/
├── data/            graphs/ · models/ · imports/ · graph-connectors/
├── exploration/     explorer/ · queries/ · boards/
├── answers/         assistant/ · projections/ · memory/
├── work/            projects/
├── orchestration/   agents/ · llms/ · skills/ · rules/ · plans/ · reviews/ · runs/ · schedules/
├── governance/      lenses/ · events/
└── platform/        accounts/ · setup/ · runtime/ · tooling/ · design/
```

The Studio and engine trees, file by file, are [§12](#12-target-code-structure).

## 4. Studio — folders and files

### Folder moves

**Status: done.** Every row below is moved; `features/` holds `agents · assistant · boards · events · explorer · graphs · lenses · llms · models · plans · projections · projects · rules · runs · setup · skills`.

| Today | Target | Files | Action |
|---|---|---|---|
| `connect-and-model/` | `models/` | 40 | rename |
| `ask/assistant/`, `ask/answer-surface/` | `assistant/` (the assistant files at its root, `answer-surface/` a sub-folder) | 23 | rename |
| `ask/projections/` | `projections/` | 2 | move |
| `operate/` | `runs/` + `events/` | 22 | split |
| `work/` | `projects/`; the board canvases leave (below) | 8 | rename |
| `workflows/` | `plans/` | 13 | rename |
| `govern/` | `lenses/` | 22 | rename |
| `graph-settings/` | `graphs/` | 6 | rename |
| `bring-data-in/` | — | 1 | remove; `ProvenanceBlock` → `explorer/` |
| `bring-data-in/ImportsPanel.tsx` (`ImportsJournalBody`) | `operate/RunsList.tsx` (`RunsList`) → `runs/` in R2 | 1 | **done** |

### Files in the wrong folder

**Status: done**, except `usd` → `lib/format` (still in `agents/agentDraft.ts`). `WorkCanvas.tsx` is split: `projects/PlanCanvas.tsx`, `agents/EnvelopeCanvas.tsx`, `agents/LineageCanvas.tsx`.

Evidence is the import graph: each file below is imported only from the folder it moves to.

| File | Used by | Goes to |
|---|---|---|
| `bring-data-in/ProvenanceBlock.tsx` | explorer only | `explorer/` |
| `work/WorkGraphCanvas.tsx` | the plan, envelope and lineage boards | `src/canvases/layered/` — a renderer, beside `model/` and `taskflow/` |
| `work/WorkCanvas.tsx` → `PlanCanvas` · `EnvelopeCanvas` · `LineageCanvas` | boards | `projects/` · `agents/` · `agents/` |
| `skills/taskFlowFromPlan.ts` | skills, workflows | `src/canvases/taskflow/` |
| `operate/dashboards/TaskFlowPanel.tsx`, `dashboards/shared.ts` | operate, workflows, `shared/dashboardPanels` | `shared/dashboards/` |
| `work/StepRules.tsx` | assistant `TraceDialog`, work | `shared/` |
| `skills/ProjectRulesSection.tsx`, `RuleParts`, `RulesDrawer` | projects, skills | `rules/` |
| `agents/PoolsTable.tsx` | graph-settings only | `graphs/` |
| `agents/LlmsDrawer.tsx`, `ProviderForm`, `ProviderDetail` | the Agents stack | `llms/` |
| `operate/EventsSection`, `eventStatus`, `eventSearch`, `eventCatalog`, `EventTypeFilter` | the Events tab, `pages/platform/PlatformEventsPage` | `events/` |
| `agents/agentDraft.ts` → `usd` | also `RunsJournalPage` | `usd` → `lib/format` |

### Kit substitutions — before any rename

A Studio component the kit already ships is deleted against the kit import, not renamed
([code-shape.md](building-studio/code-shape.md) §2.2). These go first (phase K), so R3 never renames
a file that is about to be deleted.

| Studio today | Kit | Verdict |
|---|---|---|
| `explorer/LayersPanel.tsx` | canvas-ui `LayersViewPanel` (0.0.14) | **Replace.** A fork of the kit panel. First move `visibility.ts` onto the store's hide API (`setNodeHidden`), because `ExplorerTypesPanel` shares that hidden state |
| `explorer/StylingPanel.tsx` | canvas-ui `StylingViewPanel` (0.0.14) | **Replace.** Map `CanvasStyling.labelProperty` → the kit's `labelKey` dot path (`name` → `data.name`) in `types/board.ts`; drop Studio's own painting in `ExplorerCanvas` |
| `explorer/InspectorPanel.tsx` | canvas-ui `ElementInspectorViewPanel` | **Replace after extending the kit**: add `isMissing(id)` and `propertyFilter` props. Studio keeps a short `InspectorViewPanel` host that passes `renderExtra={ProvenanceBlock}` |
| `explorer/ExpandFineTunePanel.tsx` | none — the kit panels filter what is drawn; this fetches neighbours from the engine | **Keep**, as `ExpandNeighboursDialog`. Its form moves to canvas-ui only when `GraphExpandEditorPanel` (B9) is built |
| `shared/ListPanel.tsx` → `ListRow` | `@invana/ui` `Item size="xs"` | **Replace** (hover-only actions via an `ItemActions` option) |
| `shared/ListPanel.tsx` → `ListPanelChrome` · `ListFilterMenu` | `PanelContent` | **Replace after extending the kit**: a searchable header and a header dropdown action on `PanelContent` |

A kit extension is built in `~/Projects/invana/design-kit` or `~/Projects/invana/canvas` with a story,
before Studio uses it.

### Unused code

**Status: done**, except `skills/SkillsSection.tsx`: `SettingsViewPanel` still imports and renders it in a switch branch, so removing it is a code change, not a deletion. `PropertyKeyFormDialog.tsx` was deleted with them — its only importer was `PropertyKeyTable`.

| File | Evidence | Action |
|---|---|---|
| `shell/useTasksPanel.ts` | zero importers; the Tasks stack is retired (G31 · G41) | delete |
| `skills/SkillsSection.tsx` | unreachable — `skills` is in `PAGE_OWNED_SECTIONS` | delete |
| `connect-and-model/CompatibilityBanner.tsx` | zero importers | delete |
| `model/components/DetailPanel.tsx` + `ModelOverview`, `NoSelectionPlaceholder`, `PropertyKeyTable` | no importers; the three are `@deprecated` and used only by `DetailPanel` | delete |

## 5. Component names — one meaning per suffix

**Status: done** for every file and component row below, and for the shell hooks and shared builders. Still open: `LayersPanel` · `StylingPanel` · `ListPanel` (replaced by the kit in phase K), and the `?drawer=` value types `ProjectsDrawer` · `LibraryDrawer` · `GovernDrawer`, which rename with the `?drawer=` → `?section=` key.

The suffixes are the kit's words. `@invana/ui` builds a stacked panel from `PanelStack` and its
`PanelStackSection`s; canvas-ui names every region occupant `*ViewPanel` (`LayersViewPanel`,
`SchemaViewPanel`, `BoardPagesViewPanel`). Studio has no drawers — nothing slides over anything — so
*drawer* is retired, and a plain `*Panel` would read as a kit primitive (`PanelStack`, `PanelContent`,
`TabbedPanel`).

| Suffix | Is | Renames |
|---|---|---|
| `XViewPanel` | what fills a region — `leftSection` · `rightSection` · `bottomSection` — named for the occupant | `AgentsStackPanel` → `AgentsViewPanel` · `GovernStackPanel` → `LensesViewPanel` · `LibraryStackPanel` → `LibraryViewPanel` · `ProjectsStackPanel` → `ProjectsViewPanel` · `RunsPanel` → `RunsViewPanel` · `SkillsPanel` → `SkillsViewPanel` · `ModelPanel` → `ModelViewPanel` · `SettingsPanel` → `SettingsViewPanel` · `ExplorerTypesPanel` → `ExplorerViewPanel` · `AssistantPanel` → `AssistantViewPanel` · `InspectorPanel` → `InspectorViewPanel` |
| `XSection` + `xSection()` | one `PanelStackSection` of a view panel — collapsible, resizable, its own header | `AgentsDrawer` → `AgentsSection` · `LlmsDrawer` → `LlmsSection` · `WorldsDrawer` → `WorldsSection` · `GuardrailsDrawer` → `GuardrailsSection` · `PlansDrawer` → `PlansSection` · `CatalogueDrawer` → `CatalogueSection` · `TemplatesDrawer` → `TemplatesSection` · `RulesDrawer` → `RulesSection` · `ProjectsPanel` → `ProjectsSection` · `TasksPanel` → `TodosSection`; factories `agentsDrawerSection()` → `agentsSection()` |
| `XSectionBody` | a section's `content`, when it is its own component | `TodosDrawerBody` → `TodosSectionBody` · `PlansDrawerBody` (`TaskPlansPanel`) → `PlansSectionBody` · `TemplatesPanel` → `TemplatesSectionBody` |
| `XList` | the rows of a list section | `RunsList` (done) |
| `XDetail` | a drill-in that replaces a section's body | `RunDetailDrawer` → `RunDetail` |
| `XBoardPage` | anything in `mainSection` | `PlanDashboardPage` · `RunDashboardPage` · `RuleDashboardPage` · `UsageDashboardPage` → `*BoardPage` · `RunsJournalPage` → `RunsBoardPage` · `ComparePage` → `CompareBoardPage` |
| `XCard` | floats over the canvas | `DeclareStitchPanel` → `DeclareStitchCard`. `LayersPanel` and `StylingPanel` are replaced by the kit in phase K; `ExpandFineTunePanel` → `ExpandNeighboursDialog` |
| `XWidget` | one tile on a board | `TaskFlowPanel` · `SkillFlowPanel` · `RunLensPanel` · `StepTouchPanel` · `BoardHistoryPanel` → `*Widget`; `shared/dashboardPanels.ts` → `dashboardWidgets.ts` |
| `XTab` | a tab body, settings or detail | `EventsSection` → `EventsTab` · `GraphSettingsSection` → `GraphTab` · `GraphInfoPanel` → `InfoTab` |
| `xRows.ts` | row builders, not components | `databaseTab` · `growthTab` · `performanceTab` · `usageTab` → `*Rows` |
| shared builders | the section factory and its UI state | `shared/TaskDrawer.tsx` (`taskDrawerSection`, `useTaskDrawerUi`) → `shared/StackSection.tsx` (`stackSection`, `useStackSectionUi`) · `shell/useDrawerStack.ts` → `useStackSections.ts` |
| shell hooks | a view panel's URL state | `useAgentsPanel` · `useLibraryPanel` · `useProjectsPanel` · `useRunsPanel` · `useGovernPanel` → `use<Module>ViewPanel` |

`XSection` now means one thing: a `PanelStackSection`. A tab body that was named `*Section` becomes
`XTab`. The regions keep the kit's camelCase prop names (`leftSection`), so a component and a region
never share a spelling.

## 5b. Comments

Every file a phase touches leaves its model and column comments trimmed. Module, class and method
docstrings stay full — they are how a reader learns to use the code.

| Rule | Detail |
|---|---|
| Inline comments | Say what is not obvious from the code — a constraint, a trap, a reason. Never what the next line does |
| Standalone | Code documentation reads without the docs: never cite a decision id (`GV3`, `TE14`) in code or tests |
| Models and columns | A column gets a comment only when its name cannot carry its meaning — a unit, an enum's source, a nullable's meaning |
| Classes and methods | A docstring on usage and design — what it is for, how to call it, what it guarantees |
| Components | A docblock on usage when the name and props are not enough |
| No history | Never "used to be", "was renamed from", "no longer". Git holds history |
| Module docstring | What the module does and how it is used; a design note and what it emits when that helps — `core/telemetry/middleware.py` is the model |

## 6. Retired words still in Studio

**Status: file and component names done** — `TodoActivityTree`, `TodoRunsBlock`, `LayeredCanvas*`, `RecordRow`, `PlanTrendWidget`, `taskFlowFromTaskPlan`, `SkillPlaybookEditor`, `AgentEffortTab`, `useLeftSection` · `LeftNavKey`. Still open: the type, hook and API names in `types/*`, `hooks/queries/*` and `services/api/*` (`Task*` → `Todo*`, `Thinking` → `TaskRun`, `SkillPlan*`, `useWork` split, `railItem`), which move with R6.

| Word | Where | Becomes |
|---|---|---|
| Task, meaning Todo | `types/work.ts` (`Task`, `TaskStatus`, `TaskCreate`, `PlanTask`, `TaskActivity`) · `useTasksQuery` · `useTaskMutations` · `TaskActivityTree` · `tasksApi` | `Todo*` · `useTodosQuery` · `TodoActivityTree` · `todosApi` |
| Work | `WorkCanvas*` · `WorkGraphCanvas` · `WorkNode` · `WorkTone` · `WorkRow` · `WorkTrendPanel` · `useWork.ts` · `types/work.ts` · `services/api/work.ts` | `LayeredCanvas*` · `RecordRow` · `PlanTrendWidget` · split by record: `useTodos` / `useProjects` / `useTaskPlans` / `useAgents` |
| Workflow, meaning TaskPlan | `useWorkflowsQuery` · `usePromoteWorkflowMutation` · `taskFlowFromWorkflow` · `workflowsApi` | `useTaskPlansQuery` · `usePromoteTaskPlanMutation` · `taskFlowFromTaskPlan` · `taskPlansApi` |
| Thinking / Thought | `services/api/runs.ts` (`Thinking`, `ApiThinking`, `ThinkingStreamHandle`) · `ThinkingState` · `LIVE_THINKING_STATUSES` · `ThoughtBlock` · `useTaskThinkingsQuery` · `byThinking` | `TaskRun` · `RunStreamHandle` · `RunState` · `LIVE_RUN_STATUSES` · `TodoRunsBlock` · `useTodoRunsQuery` |
| SkillPlan | `types/skills.ts` (`SkillPlanRead`, …) · `useSkillPlanQuery` · `SkillPlanEditor` | `SkillPlaybook*` |
| Journal | `useRunsJournalQuery` · `JournalRow`; `useWork.useRunsQuery` is a second run-list hook | one file, `useRuns.ts`: `useRunsQuery`, `RunListRow`, `usePlanRunsQuery` |
| Thinking, on the agent tab | `AgentThinkingTab` | `AgentEffortTab` |
| Settings, meaning any `leftNav` key | `useSettingsPanel` · `SettingsSection` · `openWorkPanel` | `useLeftSection` · `LeftNavKey` · `openLeftPanel` |
| Rail | `railItem`, and comments in `useGraphLeftNav.tsx` | `navItem` |

## 6b. One vocabulary

Docs, Studio and the engine use the words in [terminology.md](terminology.md) and only those. A retired
word (§8 there) is fixed wherever it appears — prose, UI copy, identifiers, comments, API field names —
except a stored name, which waits for its migration (§7 Stored renames).

**Measured today** (raw matches; some are legitimate — see *allowed*):

| Retired word | Say | Allowed where | docs | studio | engine |
|---|---|---|---|---|---|
| thinking · thought | TaskRun · run | — | 142 | 27 | 76 |
| workflow | TaskPlan · plan | a **reusable** TaskPlan, and the `workflow` board kind | 513 | 199 | 191 |
| dataset | model · records | — | 356 | 37 | 179 |
| ingest · ingestion | import | — | 52 | 5 | 19 |
| job | TaskRun | — | 91 | 6 | 17 |
| pipeline | workflow · step | — | 19 | 4 | 7 |
| drawer | section · `rightSection` | the `?drawer=` alias for one release | 399 | 366 | 31 |
| rail · sidebar | `leftNav` · `leftSection` | — | 100 | 76 | 1 |
| mission · atlas · workspace | Graph | — | 20 | 4 | 2 |
| scope (for a lens) | lens | `rules.scope`, and `lenses.scope` until its migration | 116 | 209 | 109 |
| connector, unqualified | graph connector | inside `graph/connectors/` and `invana-<db>` packages | 334 | 69 | 558 |
| subgraph (for a narrowing) | lens · world | the subgraph **emission** | 74 | 19 | 13 |

| Rule | Detail |
|---|---|
| One source | `terminology.md` §8 is the list. `scripts/check-names` reads its table — word, replacement, allowed contexts — so adding a row to §8 adds a check; nothing is listed twice |
| Every layer | docs prose · Studio identifiers and UI copy · engine identifiers, docstrings, log messages, error messages · API field names (new ones only; stored ones wait for their migration) |
| Fixed where you are | each R-phase commit fixes the words in the files it touches; phase W sweeps the rest |
| A new word needs a row | a term that is not in terminology.md is added there, in the same commit, before it is used |

## 7. Engine

The tables are already migrated (`todos`, `task_plans`, `tasks`, `task_runs`, `lenses`). What still
carries the old words is package names, Python names and a few stored strings.

### Packages

| Today | Target | Note |
|---|---|---|
| `apps/work` | `apps/projects` | owns `projects`, `todos`, `todo_dependencies` |
| `apps/modeller` + `server/routes/{models,model_links,schemas}.py` | `apps/models`, `server/models/` | the loose route files join a server package |
| `apps/task_plans` | `apps/plans` | [task-model-migration.md](building-engine/task-model-migration.md) §2.2 · §5 and [the-runtime-package.md](building-engine/the-runtime-package.md) say `apps/workflows/`; fixed in the same commit |
| `apps/sessions` | `apps/assistant` | Studio and engine share the module name (§3); owns `sessions`, `session_messages` |
| `apps/govern` | `apps/lenses` | owns `lenses`, `run_touches` |
| `apps/llm_providers` + the provider half of `apps/llm` | `apps/llms` | **records only**: providers, models, the client, the provider adapters, pricing. The reasoning callers leave — see below |
| `apps/llm/{planner,translate,intent,clarify,draft,grounding}.py` | `runtime/planner/` | only `runtime/catalogue` imports them — [migration-plan.md](building-engine/migration-plan.md) §2.2 already names `runtime/planner/` |
| `apps/llm/voice.py` · `propose.py` | `apps/agents/` · `apps/assistant/` | `voice` is the soul's (5.8), imported by `apps/agents`; `propose` is imported by `apps/sessions`. An app may not import `runtime`, so these stay in band 2 with their owner |
| `activity` | keep | band 4 ([migration-plan.md](building-engine/migration-plan.md) §2). Renaming it `events` would sit beside `core/events` — two packages, one word |
| `apps/skills` (rules half) | `apps/rules` | owns `rules`, `rule_versions`; `server/rules/` already exists |
| `server/runtime/{runs,catalogue,templates}.py` | `server/runs/` · `server/plans/` · `server/projections/` | the records stay in the `runtime` band; the routes carry the module name |
| `server/routes/{auth,events,telemetry}.py` | `server/auth/` · `server/events/` · `server/telemetry/` | no loose route files |
| `runtime`, `core`, `graph`, `cli`, `apps/{agents,boards,explorer,graphs,setup,skills}` | keep | — |

### Python-only renames — no migration

| Where | Today | Becomes |
|---|---|---|
| `apps/work/models.py` · `schemas.py` | `Task`, `TaskDependency`, `TaskCreate` … `TaskActivityResponse`, `PlanTaskRead` | `Todo*`, `PlanTodoRead` |
| `managers/task.py` · `querysets/task.py` · `activity/managers/task_read.py` | `TaskManager` · `TaskQuerySet` · `TaskReadManager` | `todo.py`, `Todo*` |
| `server/work/routes.py` · `views.py` | `tasks_router`, `create_task`, `accept_task` … | `todos_router`, `*_todo` |
| `core/events/actions.py` | `THINKING_*`, `TARGET_THINKING` — the values are already `run.*` | `RUN_*`, `TARGET_RUN` |
| `server/task_plans/views.py`, querysets | `list_workflows`, `workflows_qs` | `list_task_plans`, `task_plans_qs` |
| `server/agents/routes.py` | `atlas_agent_router` | `default_agent_router` |
| `runtime/catalogue/{ingest,bundle,stitching}.py`, `cli/commands/{records,loader}.py` | `ingest`, `DatasetResult`, `check_dataset`, `source_dataset` | `records_check`, `rows` — [task-model-migration.md](building-engine/task-model-migration.md) §6.7 |
| `core/errors.py` | `dataset_not_found` | delete |

### `graph/loaders/` stays in band 1

`graph/loaders/csv.py` writes a `nodes/` + `relationships/` folder through `connector.bulk` and knows
nothing of models, Graphs or runs — the graph engine, by [migration-plan.md](building-engine/migration-plan.md)
§2's definition. It serves the `imports` module, called by `runtime/catalogue/graph_write.py`
(`bulk_write`) and `cli/commands/loader.py` (`invana loader`). Only its docstrings change (R5):
"CSV ingestion" → "import", `<dataset>/` → a records folder.

`imports` has no app of its own; its code is three bands:

| Band | Path | Role |
|---|---|---|
| 1 | `graph/loaders/` | write rows to the database |
| 3 | `runtime/catalogue/{records,records_check,bundle,stitching,graph_write}.py` | the import steps |
| 5 | `cli/commands/{records,loader}.py` | `invana records import` · `invana loader` |

### Tests mirror the modules

| Today | Becomes |
|---|---|
| `tests/ask/` · `tests/sessions/` | `tests/assistant/` |
| `tests/govern/` | `tests/lenses/` |
| `tests/ingest/` | `tests/imports/` |
| `tests/llm/` | `tests/llms/` |
| `tests/modeller/` | `tests/models/` |
| `tests/work/` | `tests/projects/` |
| `tests/{agents,auth,boards,cli,explorer,golden,graph,graphs,runtime,skills,telemetry}/` | unchanged |

### Stored renames — not in this refactor

These need migrations and go into the task-model-migration slices.

| Kind | Today | Becomes | Home |
|---|---|---|---|
| Route | `…/tasks` | `…/todos` | M4 — already planned |
| Column | `todo_dependencies.task_id` · `events.task_id` | `todo_id` | M4 — to add |
| Column | `agents.workflow_spec` · `task_runs.workflow_key` | envelope · retired | §2.5 · M12 |
| Event strings | `task.*` (15) · `workflow.promote` · `dataset.import` | `todo.*` · `task_plan.promote` · removed | new slice; old rows are rewritten |
| Step keys | `translate_thought` · `plan_workflow` · `create_task` | `translate_ask` · `draft_plan` · merged into delegation | §6.1 · §6.3 |
| Catalogue bound · setup key | `Bound.ingest` · `"datasets"` | `records_write` · `records` | new — both break [terminology.md §8](terminology.md#8-words-we-do-not-use) today |
| Column | `lenses.scope` | `pinned_on` | [govern/spec.md](modules/govern/spec.md) names it `scope`; terminology forbids the word |

## 8. Docs

### Inbound links to rewrite

Counted with `grep -r "modules/<m>/"` across `docs`, `studio`, `engine` and `integrations`.

| Module path | Links | Target |
|---|---|---|
| `modules/ask/` | 311 | `answers/assistant/`, `answers/projections/`, `exploration/queries/`, `platform/runtime/` |
| `modules/govern/` | 303 | `governance/lenses/` |
| `modules/agents/` | 297 | `orchestration/agents/`, `orchestration/llms/` |
| `modules/skills/` | 293 | `orchestration/skills/`, `orchestration/rules/` |
| `modules/operate/` | 253 | `orchestration/runs/`, `orchestration/schedules/`, `governance/events/`, `platform/accounts/` |
| `modules/explore/` | 202 | `exploration/explorer/`, `exploration/queries/`, `exploration/boards/` |
| `modules/workflows/` | 171 | `orchestration/plans/` |
| `modules/platform/` | 154 | `platform/{setup,runtime,tooling,design}/` |
| `modules/work/` | 95 | `work/projects/`, `orchestration/reviews/` |
| `modules/connect-and-model/` | 87 | `data/models/`, `data/graphs/` |
| `modules/graph-connectors/` | 84 | `data/graph-connectors/` |
| `modules/identity-and-access/` | 65 | `platform/accounts/` |
| `modules/bring-data-in/` | 32 | `data/imports/` |
| `modules/memory/` | 8 | `answers/memory/` |

About 2,350 links. The rewrite is mechanical and per file (old path → new path). A link check runs
before and after, and the count of broken links does not go up.

### Artboard names

An artboard is named `module.feature.surface.variant`, and that one string is the artboard file, its
frame title, its row in [the-screens.md](the-screens.md) and a Surfaces row in the feature file. The
prefix follows the module.

| Prefix today | Artboards (in the-screens.md) | Becomes |
|---|---|---|
| `library.*` | 33 | `plans.*` · `projections.*` (Templates) |
| `operate.*` | 25 | `runs.*` · `events.*` |
| `connect_and_model.*` | 19 | `models.*` · `graphs.*` |
| `ask.*` | 14 | `assistant.*` |
| `explore.*` | 3 | `explorer.*` · `boards.*` |
| `agents.*` · `skills.*` · `settings.*` | 11 · 1 · 2 | unchanged · unchanged · `graphs.*` |

Renamed in R1 in three places at once: `the-screens.md`, the feature files' Surfaces rows, and the
`.design/canvas-*/` generators (the canvases are rebuilt from them, never hand-edited), then
republished to their pinned artifact URLs.

### Stale text found along the way

| File | Says | Should say |
|---|---|---|
| `bring-data-in/features/inspect-what-landed.md` | "the Tasks stack's first drawer" | a filter of Runs (SR7) |
| `workflows/features/the-library.md`, `the-catalogue.md` | "second drawer of the Tasks stack" · `leftNav › Tasks › Catalogue` | Library (G41) |
| `ask/features/the-assistant.md` C1 | "Explorer, Model, Projects, Tasks, Agents, Workflows" | the 11 `leftNav` items |
| `building-studio/graph-detail-page.md` | "ten feature modules / ten icons"; G2 contradicts "one icon per feature module" | the §2 table |
| `building-engine/migration-plan.md` §2.2 | `apps/canvases`, `apps/datasets`, `apps/workflows`, `apps/projects` | the §7 target |
| `building-studio/refactor-plan.md` step 4 | module `task_plans` | `plans` |
| Decision prefixes | `PT` is used by both work and identity-and-access; `CC` by both agents and graph-connectors | unchanged — IDs are anchors and never move |

## 8c. The public docs site

`docs/docs/` (MkDocs) is for people who **use** and **extend** Invana; `docs/for-developers/` stays the
spec for people who build it. The site follows the same groups and modules, so a module has one name
on the site, in Studio's `leftNav` and in the code.

| Section | For | Contents |
|---|---|---|
| Get started | everyone | install (Docker · pip) · quickstart: connect a database → import a model → load records → ask · configuration |
| Use Invana | people using Studio, the CLI or the API | one page per module, grouped as §2; each page: what it is for · in Studio · CLI · API |
| Extend Invana | people building on it | add a graph connector · write a skill · author a plan (`manifest.yml`) · the API and the external-agent API · tracing |
| Contribute | people changing Invana | architecture (bands, the module map, §12) · dev setup on any OS · conventions (names, suffixes, comments, the design kit) · how `docs/for-developers/` is used |
| Reference | everyone | OpenAPI · CLI · settings · glossary (from [terminology.md](terminology.md)) |

Pages describing what the [feature index](README.md) does not list — simulations, algorithms,
ontology — are removed, not rewritten.

## 8b. Keeping the names

A check in CI, so the structure cannot drift again. `scripts/check-names` (Python, no dependencies,
runs on every OS), added in R2 and tightened as each phase lands.

| Fails when | Scope |
|---|---|
| a Studio `features/<m>/` has no engine `server/<m>/`, or the reverse (bands, `auth` · `telemetry` · `admin`, and a module with no routes of its own — `setup` — excepted) | Studio · engine |
| a docs module folder is not in the §2 table | docs |
| a `.tsx` file under `features/` ends in a suffix outside §5 — `Drawer`, `StackPanel`, `DashboardPage`, or a bare `Panel` | Studio |
| a retired word from [terminology.md](terminology.md) §8 appears outside its allowed contexts (§6b) — identifiers, UI copy, docstrings, docs prose. For `Task`: only its Todo sense is flagged (`TaskStatus`, `TaskCreate`, `TaskActivity`, `useTasksQuery`, `tasksApi`, `TaskManager` …); `Task` the TaskPlan node is correct | docs · Studio · engine |
| a feature link's number differs from the README row it links to | docs |

An allow-list in the script names each deliberate exception with the reason, so an exception is a
reviewed line, not a silence.

## 9. Phases

One commit per step. Each leaves types, lint, the engine guards, the link check and — from R2 — the
names check green before the next starts.

| # | Phase | What | Guard |
|---|---|---|---|
| R0 | Decisions into the docs | §1 → [terminology.md](terminology.md); §2–§5 → [code-shape.md](building-studio/code-shape.md) §4; the module map in the [README](README.md#the-modules); `graph/loaders` recorded (§7) | docs only |
| R1 | Move the docs modules | `git mv` into `modules/<group>/<module>/`, split `spec.md` where a module splits, rewrite ~2,350 links **by full old file path → full new file path** (never by module prefix: `modules/work/` is a prefix of `modules/work/projects/`), from a generated mapping that refuses to run on a tree already moved; rename artboard prefixes (§8) in the-screens.md, Surfaces rows and the `.design` generators, and design-canvas page names (*Govern › Worlds — 14.1* → *Lenses › Worlds — 14.1*) with the example in CLAUDE.md; fix the §8 stale text. Feature numbers do not change | link check · no old module path left |
| R1b | Split docs by role | `docs/for-developers/architecture/` (standing, present tense: module map, engine, studio, telemetry, design kit, screens) and `plans/` (in flight; a plan is deleted when its last phase lands, its decisions already in feature files or `architecture/`). `module-structure.md` splits into `architecture/module-map.md` (§1–§3, §5, §5b, §6b, §12) and `plans/module-refactor.md` (the rest). Delete `docs/system-design.md` and the root `HANDOFF.md`. Links by the R1 full-path mapping | link check |
| R1c | Retire the concluded RFCs | move what is current in `orchestration.md` (§0) into the `runs` · `plans` · `projects` specs and `architecture/`, and `governance.md` into `lenses/spec.md`; then delete both. One file per commit, each reviewed | link check |
| K | Kit substitutions | the §4 table: delete against the kit import what the kit already ships | `tsc -b`, Biome, Vitest |
| R2–R4 | Studio, **one module per commit** | for each module, in order `models` · `runs` + `events` · `projects` · `plans` + `projections` · `lenses` · `agents` + `llms` · `skills` + `rules` · `assistant` · `explorer` · `boards` · `graphs`: its §4 folder move, §5 suffixes, §6 retired words and §5b comment trim together. `scripts/check-names` lands with the first; the `?drawer=` URL key becomes `?section=` (reading `?drawer=` as an alias for one release) with the first stacked view panel | `tsc -b`, Biome, Vitest, names check |
| R5 | Engine packages and Python names — **after M4** | the §7 package and Python-only renames to the §12.2 tree; tests move to mirror the modules (§7); the §5b comment trim on every file moved; `graph/loaders` docstrings. Routes, tables and event strings unchanged | ruff, the import rule, unit tests, names check |
| R6 | Studio modules own their API | `services/api/*`, `hooks/queries/*` and `types/*` move into each module's `api.ts` · `queries.ts` · `types.ts` (§12.1), one module per commit | `tsc -b`, Biome, Vitest |
| D | The public docs site | restructure `docs/docs/` and `mkdocs.yml` per §8c; one page per module; remove pages for what is not built. After R1, which fixes the module folders the site links into | `mkdocs build --strict` |
| W | One vocabulary sweep | what the R-phases did not touch: every §6b word in docs, Studio and engine outside its allowed context; the names check turns on for words across the whole tree | names check green on the whole tree |
| — | Stored renames | into the task-model-migration M-slices | — |

Per-module commits keep each diff reviewable as one subject and let a peer session keep working in a
module that is not being moved. R5 waits for task-model-migration M4: M4 rewrites `apps/work` (Task → Todo,
`/tasks` → `/todos`), and moving the package underneath it mid-slice makes both diffs unmergeable.

## 10. Decisions

| # | Question | Proposed | Alternative |
|---|---|---|---|
| 1 | Groups as a folder level — docs only, or all three layers? | **Decided: docs only.** Studio and the engine stay flat and share one module name (§3) | — |
| 2 | Feature numbers (`5.1`, `13.8`) are cited everywhere | **Decided: keep them** — a number is a permanent ID ([§2.1](#21-feature-numbers)). Renumbering would have made every citation outside the docs (commits, comments, canvases, other branches) point at a different feature, silently | — |
| 3 | The Ask module's name | **Decided: `assistant`** — the surface's name; a singular exception. Its group is **Answers** | — |
| 4 | Singular exceptions | **Decided: accept** — `explorer` · `assistant` · `memory` · `setup` · `runtime` · `tooling` · `design`. Plural for a module that holds records of a kind; singular for one surface or a mass noun | — |
| 5 | One-feature modules | **Decided: keep separate** — `rules` · `reviews` · `schedules` · `projections` · `llms` · `boards`; each is its own record and keeps its one name in Studio and the engine | — |
| 6 | Engine `apps/sessions` | **Decided by #1: `apps/assistant`** — Studio and the engine share the module name | — |
| 7 | The Govern `leftNav` label | **Decided: keep "Govern"** — the label says what a person does, the module names what it holds, as Model ↔ `models` | — |

## 11. Not doing

| Not doing | Why |
|---|---|
| Renaming feature files or decision IDs | features stay verb phrases; IDs and feature numbers are anchors (§2.1) |
| Changing UI copy or `leftNav` labels | this is code and doc structure; the words a person sees are already right |
| Stored renames — routes, tables, event strings, step keys | they need migrations; they belong to the M-slices |
| Moving components into `@invana/design-kit` or canvas | a separate question — which of these belongs in the kit |
| Behaviour changes | every phase is a move or a rename |

## 12. Target code structure

The end state after R2–R6. `←` names the file today; a file with no arrow keeps its name and moves
with its folder. Suffixes follow [§5](#5-component-names--one-meaning-per-suffix).

### At a glance

The end state, ordered by group. The group is a comment here: Studio and the engine stay flat
(§3). §12.1 and §12.2 below give every file, with `←` naming its path today.

**One name across the layers**

| Group | Module | Docs `modules/` | Studio `features/` | Engine `apps/` | Engine `server/` |
|---|---|---|---|---|---|
| Data | graphs | `data/graphs/` | `graphs/` | `graphs/` | `graphs/` |
| | models | `data/models/` | `models/` | `models/` | `models/` |
| | imports | `data/imports/` | — | — (`graph/loaders` · `runtime/catalogue`) | — (CLI) |
| | graph-connectors | `data/graph-connectors/` | — | — (`graph/` band) | — |
| Exploration | explorer | `exploration/explorer/` | `explorer/` | `explorer/` | `explorer/` |
| | queries | `exploration/queries/` | — until the console (4.4) ships | — | — |
| | boards | `exploration/boards/` | `boards/` | `boards/` | `boards/` |
| Answers | assistant | `answers/assistant/` | `assistant/` | `assistant/` | `assistant/` |
| | projections | `answers/projections/` | `projections/` | — (runtime) | `projections/` |
| | memory | `answers/memory/` | — | — | — |
| Work | projects | `work/projects/` | `projects/` | `projects/` | `projects/` |
| Orchestration | agents · llms · skills · rules · plans | `orchestration/<m>/` | `<m>/` | `<m>/` | `<m>/` |
| | runs | `orchestration/runs/` | `runs/` | — (runtime) | `runs/` |
| | reviews · schedules | `orchestration/<m>/` | — | — | — |
| Governance | lenses | `governance/lenses/` | `lenses/` | `lenses/` | `lenses/` |
| | events | `governance/events/` | `events/` | — (`core/events`) | `events/` |
| Platform | setup | `platform/setup/` | `setup/` | `setup/` | — |
| | accounts · runtime · tooling · design | `platform/<m>/` | — | — (core · runtime) | `auth/` · `telemetry/` |

A `—` means that layer has no surface or tables for the module yet. When one arrives, it takes the
module's name.

**Studio**

```text
studio/src/
├── App.tsx  main.tsx  router.tsx  index.css
├── canvases/                      renderers shared by modules
│   ├── layered/                   plan · envelope · lineage boards
│   ├── model/                     GraphModelCanvas
│   ├── taskflow/                  TaskFlowCanvas · taskFlowFromPlan
│   └── theme.ts
├── components/                    app chrome — header, theme, dialogs
├── hooks/  lib/  stores/          app-wide
├── services/api/client.ts         the HTTP client only
├── ui/                            what the kit cannot own
└── pages/
    ├── auth/  graphs/  platform/  settings/        not graph-scoped (accounts live here)
    └── graphs-detail/
        ├── GraphDetailPage.tsx
        ├── shell/                 leftNav · regions · use<Module>ViewPanel hooks · useLeftSection
        ├── shared/                StackSection · RecordRow · StepRules · dashboards/
        └── features/              one folder per module — each: index.ts · api.ts · queries.ts · types.ts
            │  ── Data
            ├── graphs/            SettingsViewPanel · InfoTab · GraphTab · ConnectionFields · PoolsTable
            ├── models/            model-editor/ · model-page/ · stitch/
            │  ── Exploration
            ├── explorer/          ExplorerCanvas · InspectorViewPanel · ExpandNeighboursDialog · ProvenanceBlock
            ├── boards/            DataBoardPage · FrozenBoardPage · BoardHistoryWidget
            │  ── Answers
            ├── assistant/         AssistantViewPanel · Session* · answer-surface/
            ├── projections/       TemplatesSection
            │  ── Work
            ├── projects/          ProjectsViewPanel · ProjectsSection · TodosSection · TodoActivityTree · PlanCanvas
            │  ── Orchestration
            ├── agents/            AgentsViewPanel · AgentsSection · AgentDetail · Agent*Tab · EnvelopeCanvas · LineageCanvas
            ├── llms/              LlmsSection · ProviderForm · ProviderDetail
            ├── skills/            SkillsViewPanel · SkillDetail · SkillPlaybookEditor · boards/
            ├── rules/             RulesSection · RuleParts · ProjectRules · boards/
            ├── plans/             LibraryViewPanel · PlansSection · CatalogueSection · PromoteDialog · boards/
            ├── runs/              RunsViewPanel · RunsList · RunDetail · RunsBoardPage · boards/
            │  ── Governance
            ├── lenses/            LensesViewPanel · WorldsSection · GuardrailsSection · Lens* · boards/
            ├── events/            EventsTab · EventTypeFilter · event*
            │  ── Platform
            └── setup/             SetupBoard · SetupStepper · OnboardingWizard
```

**Engine**

```text
engine/src/invana/
├── core/                          band 0 — auth · events · logging · telemetry · migrations
├── graph/                         band 1 — connectors (graph-connectors) · loaders (imports) · types — unchanged
├── apps/                          band 2 — each: models.py · schemas.py · querysets/ · managers/
│   │  ── Data
│   ├── graphs/                    the Graph · members · connections
│   ├── models/
│   │  ── Exploration
│   ├── explorer/
│   ├── boards/
│   │  ── Answers
│   ├── assistant/                 sessions · messages
│   │  ── Work
│   ├── projects/                  projects · todos · dependencies
│   │  ── Orchestration
│   ├── agents/
│   ├── llms/                      providers · models · client · pricing
│   ├── skills/
│   ├── rules/
│   ├── plans/                     task_plans · tasks
│   │  ── Governance
│   ├── lenses/                    lenses · touches
│   │  ── Platform
│   └── setup/
├── runtime/                       band 3 — task_runs · stream · catalogue · interpreter · projections
├── activity/                      band 4 — the tree
├── server/                        band 5 — each: routes.py · views.py · admin.py
│   ├── graphs/  models/
│   ├── explorer/  boards/
│   ├── assistant/  projections/
│   ├── projects/
│   ├── agents/  llms/  skills/  rules/  plans/  runs/
│   ├── lenses/  events/
│   └── auth/  telemetry/  admin/  app.py  middleware.py  health.py
└── cli/                           band 5
```

### 12.1 Studio

```text
studio/src/
├── App.tsx  main.tsx  router.tsx  index.css
├── canvases/                       renderers more than one module draws — data in by props
│   ├── theme.ts
│   ├── model/                      GraphModelCanvas
│   ├── taskflow/                   TaskFlowCanvas · taskFlowFromPlan.ts ← skills/
│   └── layered/                    LayeredCanvas.tsx ← work/WorkGraphCanvas.tsx
│                                   LayeredCanvasChrome.tsx ← work/WorkCanvasChrome.tsx
├── components/                     app chrome — header, theme, ConfirmDialog (unchanged)
├── ui/                             only what the kit cannot own (DS2) (unchanged)
├── hooks/                          non-query hooks — useAuth · useEventStream · useSessionResume · useTicker
├── lib/                            format.ts (+ usd ← agents/agentDraft.ts) · time.ts
├── services/api/client.ts          the HTTP client only; every resource moves into its module (R6)
├── stores/                         appearance · auth · run.store.ts (ThinkingState → RunState)
└── pages/
    ├── auth/  graphs/  settings/   not graph-scoped (unchanged)
    ├── platform/                   PlatformEventsPage — imports features/events
    └── graphs-detail/
        ├── GraphDetailPage.tsx     openWorkPanel → openLeftPanel
        ├── shell/
        │   ├── GraphDetail.tsx  GraphHomePage.tsx  ConnectionStatusBar.tsx
        │   ├── useGraphLeftNav.tsx          railItem → navItem
        │   ├── useLeftSection.ts            ← useSettingsPanel.ts (SettingsSection → LeftNavKey)
        │   ├── useStackSections.ts  useRightSection.ts  useBoardPage.ts  useOpenSessionRequest.ts   ← useDrawerStack
        │   ├── useAgentsViewPanel.ts  useLibraryViewPanel.ts  useProjectsViewPanel.ts  useRunsViewPanel.ts   ← useAgentsPanel · useLibraryPanel · useProjectsPanel · useRunsPanel
        │   ├── useLensesViewPanel.ts            ← useGovernPanel.ts
        │   └── (useTasksPanel.ts deleted)
        ├── shared/
        │   ├── StackSection.tsx              ← TaskDrawer.tsx
        │   ├── RecordRow.tsx                ← WorkRow.tsx
        │   ├── StepRules.tsx                ← features/work/
        │   ├── DetailRows.tsx  ListPanel.tsx  SectionTitle.tsx  statusTone.ts
        │   ├── dashboardIcons.ts  dashboardWidgets.ts  dashboardSpec.ts   ← dashboardPanels.ts
        │   └── dashboards/                  TaskFlowWidget.tsx ← operate/dashboards/TaskFlowPanel.tsx
        │                                    shared.ts ← operate/dashboards/shared.ts
        └── features/
            ├── agents/
            │   ├── index.ts  api.ts  queries.ts  types.ts
            │   ├── AgentsViewPanel.tsx          ← AgentsStackPanel.tsx
            │   ├── AgentsSection.tsx  AgentDetail.tsx  AgentBoardPage.tsx   ← AgentsDrawer
            │   ├── AgentOverviewTab.tsx  AgentSkillsTab.tsx  AgentSoulTab.tsx  AgentActivityTab.tsx
            │   ├── AgentEffortTab.tsx       ← AgentThinkingTab.tsx
            │   ├── EnvelopeCanvas.tsx  LineageCanvas.tsx   ← work/WorkCanvas.tsx
            │   └── LifecycleDialog.tsx  CeilingsTable.tsx  agentDraft.ts
            ├── llms/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← services/api/llm.ts · useLLMProviders.ts · types/llm.ts
            │   └── LlmsSection.tsx  ProviderForm.tsx  ProviderDetail.tsx   ← agents/
            ├── assistant/                   ← ask/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← sessions.ts · session.ts · emission.ts
            │   ├── AssistantViewPanel.tsx  Session*.tsx  WorldPicker.tsx  CastRefusal.tsx   ← ask/assistant/
            │   ├── SessionStepsTimeline.tsx ← SessionTasksView.tsx
            │   └── answer-surface/          AnswerEmission · EmissionBodies · emissions.ts · NotAnAnswer
            │                                ResultBlock · ResultsTable · TraceDialog
            ├── boards/                      (unchanged) BoardHistoryWidget.tsx ← BoardHistoryPanel.tsx
            │                                api.ts · queries.ts ← boards.ts · boardVersions.ts · boardReports.ts
            ├── events/                      ← operate/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← services/api/events.ts · useEvents.ts
            │   ├── EventsTab.tsx            ← EventsSection.tsx
            │   └── EventTypeFilter.tsx  eventCatalog.ts  eventSearch.ts  eventStatus.tsx
            ├── explorer/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← explorer.ts · useTypeCounts.ts · traversal.ts
            │   ├── ExplorerCanvas.tsx  ExplorerViewPanel.tsx  InspectorViewPanel.tsx   ← InspectorPanel · ExplorerTypesPanel
            │   ├── ExpandNeighboursDialog.tsx   ← ExpandFineTunePanel · (LayersPanel, StylingPanel → canvas-ui in K)
            │   ├── ProvenanceBlock.tsx      ← bring-data-in/
            │   └── typeColor.ts  visibility.ts  useExpandNode.ts
            ├── lenses/                      ← govern/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← govern.ts · useGovern.ts · types/govern.ts
            │   ├── LensesViewPanel.tsx          ← GovernStackPanel.tsx
            │   ├── WorldsSection.tsx  GuardrailsSection.tsx  GuardrailsStrip.tsx   ← WorldsDrawer · GuardrailsDrawer
            │   ├── LensList.tsx  LensDetail.tsx  LensEditor.tsx  LensActions.tsx  RuleBuilder.tsx
            │   ├── CompareDialog.tsx  CompareBoardPage.tsx ← ComparePage.tsx  ImpactDialog.tsx
            │   ├── RunLensWidget.tsx  StepTouchWidget.tsx   ← RunLensPanel · StepTouchPanel
            │   ├── addressing.ts  narrowing.ts  runLens.ts  runLayers.ts
            │   └── boards/                  LensBoardPage.tsx · lensBoardSpec.ts   ← dashboards/
            ├── models/                      ← connect-and-model/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← models.ts · schemas.ts · useModels · useSchema
            │   ├── model-editor/            ← model/ — ModelViewPanel · ModelCanvas · propertyTypes · types
            │   │   └── components/          NodeType* · EdgeType* · PropertyKey* · Constraint/Index tables · dialogs
            │   │                            (DetailPanel · ModelOverview · NoSelectionPlaceholder · PropertyKeyTable deleted)
            │   ├── model-page/              ← models/ — ModelsPage · ModelsDialogs · useModelsView · modelsPageSpec
            │   │                            insightParts · overviewParts
            │   │                            databaseRows · growthRows · performanceRows · usageRows ← *Tab.ts(x)
            │   └── stitch/                  AllModelsCanvas · UnionList · allModels · useAllModels
            │                                useStitchesSection.tsx — a PanelStackSection, so the name holds
            │                                components/ DeclareStitchCard ← DeclareStitchPanel · DeclareStitchDialog · RemoveStitchDialog
            ├── plans/                       ← workflows/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← work.ts (taskPlansApi) · useWork (useTaskPlans*)
            │   ├── LibraryViewPanel.tsx         ← LibraryStackPanel.tsx
            │   ├── PlansSection.tsx          + PlansSectionBody ← TaskPlansPanel.tsx
            │   ├── CatalogueSection.tsx  PromoteDialog.tsx  PlanFlowCanvas.tsx  planLayers.ts   ← CatalogueDrawer
            │   ├── taskFlowFromTaskPlan.ts  ← taskFlowFromWorkflow.ts
            │   └── boards/                  ← dashboards/ — PlanBoardPage ← PlanDashboardPage
            │                                PlanChartWidgets ← PlanChartPanels (PlanTrendWidget ← WorkTrendPanel)
            │                                planBoardSpec ← planDashboardSpec · planRecordSpecs · PlanRecordPages
            ├── projections/                 ← ask/projections/
            │   └── TemplatesSection.tsx      + TemplatesSectionBody ← TemplatesPanel.tsx
            ├── projects/                    ← work/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← work.ts (todosApi, projectsApi) · types/work.ts (Todo*)
            │   ├── ProjectsViewPanel.tsx        ← ProjectsStackPanel.tsx
            │   ├── ProjectsSection.tsx       ← ProjectsPanel.tsx
            │   ├── TodosSection.tsx          ← TasksPanel.tsx (TodoRunsBlock ← ThoughtBlock)
            │   ├── TodoActivityTree.tsx     ← TaskActivityTree.tsx
            │   └── PlanCanvas.tsx           ← work/WorkCanvas.tsx
            ├── rules/                       ← skills/
            │   ├── RulesSection.tsx  RuleParts.tsx   ← RulesDrawer
            │   ├── ProjectRules.tsx         ← ProjectRulesSection.tsx
            │   └── boards/                  RuleBoardPage ← RuleDashboardPage · ruleBoardSpec
            ├── runs/                        ← operate/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← runs.ts (Thinking → TaskRun) · useRuns · types/run.ts
            │   ├── RunsViewPanel.tsx  RunsList.tsx  RunsFilterBar.tsx  useRunsFilters.ts  runSummary.ts   ← RunsPanel
            │   ├── RunDetail.tsx            ← RunDetailDrawer.tsx
            │   ├── RunsBoardPage.tsx        ← RunsJournalPage.tsx
            │   └── boards/                  ← dashboards/ — RunBoardPage ← RunDashboardPage
            │                                runBoardSpec · stepBoardSpec · taskFlowFromRun · useRunStep · useRunTrace · icons
            ├── graphs/                      ← graph-settings/
            │   ├── index.ts  api.ts  queries.ts  types.ts   ← graphs.ts · health.ts · useGraphs
            │   ├── SettingsViewPanel.tsx   ← SettingsPanel
            │   ├── InfoTab.tsx              ← GraphInfoPanel.tsx
            │   ├── GraphTab.tsx             ← GraphSettingsSection.tsx
            │   └── ConnectionFields.tsx  ConcurrencyFields.tsx  PoolsTable.tsx ← agents/  RecentSessions.tsx
            ├── setup/                       (unchanged)
            └── skills/
                ├── index.ts  api.ts  queries.ts  types.ts   ← skills.ts (SkillPlan* → SkillPlaybook*)
                ├── SkillsViewPanel.tsx  SkillDetail.tsx  SkillBoardPage.tsx   ← SkillsPanel
                ├── SkillPlaybookTab.tsx  SkillFlowTab.tsx
                ├── SkillPlaybookEditor.tsx  ← SkillPlanEditor.tsx
                └── boards/                  ← dashboards/ — SkillFlowWidget ← SkillFlowPanel
                                             UsageBoardPage ← UsageDashboardPage · usageBoardSpec · shared
```

| Rule | Detail |
|---|---|
| A module's border is `index.ts` | another module imports only from it — [code-shape.md §4.1](building-studio/code-shape.md) |
| A module owns its API | `api.ts` · `queries.ts` · `types.ts` in the folder. `services/api/work.ts`, `hooks/queries/useWork.ts` and `types/work.ts` stop existing; they held five modules |
| A sub-folder is a feature | `assistant/answer-surface/`, `models/model-editor/`, `models/model-page/` — named after the feature file, never a shape word. `boards/` inside a module holds its `*BoardPage`s and their specs (was `dashboards/`) |
| A renderer two modules draw is a canvas | `src/canvases/layered/` joins `model/` and `taskflow/`; the module keeps only the adapter (`PlanCanvas`, `EnvelopeCanvas`, `LineageCanvas`) |
| No folder for a module with no Studio surface | `imports`, `graph-connectors`, `queries` (until the console, 4.4, ships), `memory`, `reviews`, `schedules`, `runtime`, `tooling`, `design`, `accounts` (it stays in `pages/settings/`) |

### 12.2 Engine

Bands and the inside-a-package shape are unchanged ([migration-plan.md](building-engine/migration-plan.md) §2 · §4).
What changes is package names, and the loose `server/routes/*.py` joining their module.

```text
engine/src/invana/
├── core/                            band 0 (unchanged) — auth · events · logging · telemetry · migrations
├── graph/                           band 1 (unchanged) — connectors · loaders · types
├── apps/                            band 2 — every app: models.py · schemas.py · querysets/ · managers/
│   ├── agents/                      envelope · registry · managers/{agent,soul} · voice.py ← apps/llm/
│   ├── boards/                      (unchanged)
│   ├── explorer/                    (unchanged)
│   ├── graphs/                      (unchanged) the Graph · members · connections
│   ├── lenses/                      ← govern/ — addressing · cast · catalogue · impact · query_lens · rules · validate
│   │                                managers/{endpoint,lens,touch} · querysets/{catalogue,lens,touch}
│   ├── llms/                        ← llm_providers/ + llm/{client,pricing,defaults,errors,schemas,providers/}
│   │                                endpoint · ping · managers/provider · querysets/{llm_model,llm_provider}
│   ├── models/                      ← modeller/ (every file keeps its name)
│   ├── plans/                       ← task_plans/ — args · dag · diff · yaml_export
│   │                                managers/task_plan · querysets/task_plan
│   ├── projects/                    ← work/ — plan.py (PlanTask → PlanTodo)
│   │                                managers/{todo ← task, project, dependency, plan, staffing}
│   │                                querysets/{todo ← task, project, dependency, assignment}
│   ├── assistant/                   ← sessions/ — reconcile · transcript · propose.py ← apps/llm/ · managers/session · querysets/{session,message}
│   ├── rules/                       ← skills/ — the rules half: managers/rule · querysets/rule
│   ├── setup/                       (unchanged)
│   └── skills/                      managers/{skill,binding} · querysets/{skill,skill_version,skill_binding,clarification}
├── runtime/                         band 3
│   ├── planner/                     ← apps/llm/{planner,translate,intent,clarify,draft,grounding}.py
│   ├── catalogue/                   records_check.py ← ingest.py · bundle · stitching (dataset → rows)
│   │                                work_write.py → per task-model-migration §6.3
│   ├── managers/                    task_plan_runs.py (workflows_qs → task_plans_qs)
│   └── workflows.py                 deleted — already planned (the-runtime-package)
├── activity/                        band 4 (unchanged) — managers/todo_read.py ← task_read.py · tree.py
├── server/                          band 5 — server/<module>/{routes,views,admin,deps}.py
│   ├── admin/  app.py  middleware.py  health.py  schemas.py
│   ├── agents/                      atlas_agent_router → default_agent_router
│   ├── auth/                        + routes.py ← routes/auth.py
│   ├── assistant/                   ← sessions/
│   ├── boards/  explorer/  graphs/  rules/  skills/
│   ├── runs/                        ← runtime/runs.py + runtime/admin.py
│   ├── projections/                 ← runtime/templates.py
│   ├── events/                      + routes.py ← routes/events.py
│   ├── lenses/                      ← govern/
│   ├── llms/                        ← llm_providers/
│   ├── models/                      ← modeller/ + routes/{models,model_links,schemas}.py
│   ├── plans/                       ← task_plans/ + runtime/catalogue.py (list_workflows → list_task_plans)
│   ├── projects/                    ← work/ (tasks_router → todos_router; the path stays /tasks until M4)
│   ├── telemetry/                   ← routes/telemetry.py
│   └── (routes/ deleted — every route file lives with its module)
└── cli/                             band 5 (unchanged)
```

| Rule | Detail |
|---|---|
| An app is named for its module | every `apps/<m>/` is a §2 module name, the same as Studio's `features/<m>/` |
| A band keeps its name | `runtime/`, `activity/`, `core/` — a module whose records live there gets only `server/<m>/` |
| `server/<m>/` mirrors `features/<m>/` | one edge folder per module, plus `auth/` and `telemetry/` for what `core` owns. No `server/routes/`, no `server/runtime/` |
| Bands are not renamed | `activity/` stays: `events/` would sit beside `core/events/` |
| A URL path moves only with a migration | the Python name changes in R5; `/tasks` → `/todos` waits for M4 |
