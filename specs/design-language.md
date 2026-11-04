# Design language — the agent version

**You keep working; everything else comes to you.** Invana should feel like an agentic tool, not an admin console. The person
stays on what they are doing — asking, modelling, deciding — while data, agents, activity and settings come to them on top of
that work and go away again.

| | |
|---|---|
| Prototype | [Invana Products — Agent version](https://claude.ai/artifact/62dw45AeR5LjZdBm9rvw4y) — 65 boards cover all 133 stories (Invana Products draws them on 352) |
| Staging round | *Invana Focus* (<https://claude.ai/artifact/GUCRv8uJiQenfFx5FvgVg2>) |
| Generators | `.design/canvas-agent-version/av.py` (pages in `p_*.py`) over the kit `.design/canvas-focus/fc.py` |
| Backend | Unchanged. This is a UI language: every board draws a capability the engine has or already plans |
| Components | `@invana/design-kit` and `@invana/canvas` as today — rearranged, not rebuilt |

## 1. Principles

| # | Principle | In practice |
|---|---|---|
| 1 | **The work stays in main** | Main holds only the thing being worked on: a board, a model, a project. It never turns into a settings page |
| 2 | **Everything else comes to you** | Data, agents, inbox, settings, history, creating a Graph: an overlay over the work, closed with Esc |
| 3 | **Agents are helpers, not machinery** | The assistant is always one click away on the right. Agents are colleagues: they answer in threads, ask before acting, and show how they got there |
| 4 | **Say less** | A surface shows the next decision, not every fact. Detail is one click deeper (peek → sheet), never on the first screen |
| 5 | **Plain words** | Roles, limits and states are sentences. No internal nouns on screen (see §6) |
| 6 | **Three modes, not nine products** | The person never picks a product from a launcher. Explore, Model and Projects are modes of one workspace, named in the wordmark; everything else is summoned |
| 7 | **The agent proposes, the person decides** | Invana is built for decisions ([vision](vision.md)). An agent does the work from what the person says and comes back with a proposal or a choice with a recommendation; the person answers with a click. No blank forms where an agent could draft |
| 8 | **Traceable on demand** | Every answer, proposal and act can show how it got there — steps, sources, assumptions, who did what — through *Why?*, *How it got here* and the full run. Never on the first screen; always one click away |

## 2. The layout

The regions are the shell's (`AppLayoutV2`); only what fills them changes.

| Region | Holds | Rule |
|---|---|---|
| Header | Wordmark *Invana Explore · Model · Projects* (plain *Invana* with no Graph open) · Graph picker › crumb · ⌘K *Do, open or ask anything* · bell · Assistant · avatar | The wordmark names the mode in main and changes with it; the crumb never repeats it. No launcher |
| leftNav | **Modes** above the line: Explore · Model · Projects. **Summoners** below: Data · Agents · Inbox. At the bottom: Settings · Help | A mode changes main; a summoner opens an overlay. Icons carry a label underneath. The leftNav never collapses |
| leftSection | What the current mode works on: boards and conversations · kinds and relationships · projects and my tasks | **Collapsible** (header toggle, ⌘B, or click the active mode). When collapsed, the toggle leads main's tab row |
| mainSection | The work: board tabs (the workbook), the canvas, a project | Never a list of settings |
| rightSection | The assistant: the thread, then the composer | Closable; reopened from the header |
| bottomSection | The console under the canvas: Data · Queries | Opened from the footer's counts |
| Footer | Connection · counts · the message line · readouts | One line, two zones |

## 3. Overlays — three tiers

| Tier | Use it for | Shape | Closes to |
|---|---|---|---|
| **Peek** | One fact: why an answer says this, a record, a finding, a run's status | A popover anchored to what was clicked, ≤ 360 px | Nothing moves |
| **Modal** | One task or one decision: add data, approve, invite, publish, new agent, settings | Centred over a scrim, 640–1040 px, a footer holding the acts | The work behind it |
| **Sheet** | Heavy authoring or reading: a skill, an agent, a run, a dataset, access rules, a report | Nearly full screen, its own crumb, tabs if needed | The work behind it |

| Rule | Detail |
|---|---|
| One level | Never a modal on a modal. A drill-in **replaces** the overlay's content and its crumb grows; Back steps up |
| Every overlay has a URL | It survives a reload and can be shared. An old page route becomes a deep link that opens the overlay over the last workspace |
| Esc always returns | The Esc chip is drawn in every overlay's header |
| The summoner lights | While an overlay is open, its leftNav icon is outlined |
| Steps, not pages | A flow with steps (Create a graph, New agent) stays in one modal with a step strip |

## 4. The assistant and agents

| Pattern | What it looks like |
|---|---|
| Answer → act | Every answer ends with chips: *Pin to dashboard* · *Make a task* · *Share* |
| Citations | Numbered marks in an answer. Clicking one opens the *Why* peek: words → query → records → dataset |
| How it got here | Under any agent answer, in a thread or a task: its steps inline, **assumptions marked _Challenge this_**, and the full run one click further |
| Asks first | An agent that wants to send, change or spend asks in the Inbox and shows exactly what it will do; you answer in place |
| Agents in threads | A task is an issue thread: people ask, agents answer, and @ an agent gives it work. Who worked on it is the thread |
| Budget in sight | An agent shows tokens today and this month as meters. A run shows time and tokens. Numbers come from the engine |

## 5. States

| State | Drawn as |
|---|---|
| Empty | A one-line reason and the next act (*Ask your first question*), never a blank region |
| Loading / running | The footer's message line and the Inbox's *Running*. The work stays usable |
| Needs you | A count on Inbox, the act inside the row |
| Cannot answer / refused | The assistant says why and who can help, in a sentence, with the act that asks them |
| No access | The surface is visible; the act is replaced by *Ask Priya (owner)* — never a dead end |
| Draft | A floating bar over the canvas: *Draft · 3 changes not published* · Discard · Review and publish |

## 6. Words

| Not on screen | Say instead |
|---|---|
| Product names as places (Modeller, Agent Builder, Fleet, IAM, Activity) | Model · Agents · Settings › Workers · Settings › People and access · Inbox |
| Policy · statement · effect | Access rule · *Can ask*, *Can change data* |
| Roles (viewer · contributor · builder · modeller · owner · iam-admin) | *Operator* (can look and ask) · *Can work on projects* · *Can build agents* · *Can shape the model* · *Owner* · *Can manage people*; at install level, *Admin* |
| World | A view of the graph (*what agents may see*) |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope · bound | *What it may do* |
| Ledger | History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Binding a dataset version | *Add to this graph* |
| Task plan · frontier · step envelope | Its steps |

Code, docs and the CLI keep the domain terms in `for-developers/terminology.md`; this table governs only what a person reads in Studio.

## 7. Naming boards

`area.feature.surface.variant`, lower snake, dots for depth — `agents.runs`, `projects.task.thinking`. The areas are
`start · explore · model · data · agents · inbox · settings · projects · shell`. One canvas page per area, one row per name prefix.

## 8. Where every product went

| Was | Now | Tier |
|---|---|---|
| Home · Graphs · Onboarding | `start.home` (no Graph open) · the Graph picker · *Create a graph* (5 steps, the model shaped in step 3) | page · modal |
| Explorer | **Explore** mode — boards, conversations, dashboards; tools on right-click | mode |
| Modeller | **Model** mode — the map, Health, History; rules and views as a sheet | mode · sheet |
| Datasets · Imports | **Data** — Catalogue · Upload · Checks · Collect; a dataset as a sheet | modal · sheet |
| Agent Builder · Fleet dashboard | **Agents** — Agents · Runs · Skills · Schedules; an agent, a skill, a run as sheets | modal · sheet |
| Activity · Notifications | **Inbox** — Needs you · Running · History | modal |
| Graph settings · IAM · Settings · Fleet workers · Profile | **Settings** — This graph · Invana · You; access rules as a sheet | modal · sheet |
| Projects | **Projects** mode — a project is a repository, tasks are issues | mode |
