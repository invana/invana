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
| 2 | **Everything else comes to you** | Records, agents, inbox, settings, history, connecting a graph database: an overlay over the work, closed with Esc |
| 3 | **Agents are helpers, not machinery** | The assistant is always one click away on the right. Agents are colleagues: they answer in threads, ask before acting, and show how they got there |
| 4 | **Say less** | A surface shows the next decision, not every fact. Detail is one click deeper (peek → sheet), never on the first screen |
| 5 | **Plain words** | Roles, limits and states are sentences. No internal nouns on screen (see §6) |
| 6 | **Three modes, not nine products** | The person never picks a product from a launcher. Explore, Model and Projects are modes of one Studio, named in the wordmark; everything else is summoned |
| 7 | **The agent proposes, the person decides** | Invana is built for decisions ([vision](vision.md)). An agent does the work from what the person says and comes back with a proposal or a choice with a recommendation; the person answers with a click. No blank forms where an agent could draft |
| 8 | **Traceable on demand** | Every answer, proposal and act can show how it got there — steps, sources, assumptions, who did what — through *Why?*, *How it got here* and the full run. Never on the first screen; always one click away |

## 2. The layout

The regions are the shell's (`AppLayoutV2`); only what fills them changes.

| Region | Holds | Rule |
|---|---|---|
| Header | Wordmark *Invana Explore · Model · Projects* (plain *Invana* on Home) · crumb · ⌘K *Do, open or ask anything* · bell · Assistant · avatar | The wordmark names the mode in main and changes with it; the crumb never repeats it. No launcher |
| leftNav | **Modes** above the line: Explore · Model · Projects. **Summoners** below: Records · Agents · Inbox. At the bottom: Settings · Help | A mode changes main; a summoner opens an overlay. Icons carry a label underneath. The leftNav never collapses |
| leftSection | What the current mode works on: boards and conversations · kinds and relationships · projects and my tasks | **Collapsible** (header toggle, ⌘B, or click the active mode). When collapsed, the toggle leads main's tab row |
| mainSection | The work: board tabs (the workbook), the canvas, a project | Never a list of settings |
| rightSection | The assistant: the thread, then the composer — its one occupant | Closable; reopened from the header. A record opened on a board is a card on the board, never a rightSection occupant, so it never takes the side from the conversation |
| bottomSection | The console under the canvas: Data · Queries — its one occupant | Opened from the footer's counts. No other board kind fills it |
| Footer | Connection · counts · the message line · readouts | One line, two zones |

### Regions at work

| Rule | Detail |
|---|---|
| Sizes | leftSection and rightSection open at 280 px (240–640); mainSection never goes under 300 px |
| Main gives, nothing widens | Opening rightSection takes its width from mainSection; leftSection never gives. bottomSection runs under mainSection only, and leftNav is always full height |
| When main narrows | A canvas pans to the selection and never refits · a table keeps its key columns and scrolls the rest · two columns stack under 720 px · a page head keeps the name, the reading switch and the primary act and folds the rest into `⋯` |
| The shell owns the layout | Every surface fills the shell's regions and builds no panel group of its own; a region the shell cannot hold is a gap in the shell, fixed there |
| The console spans main only | `AppLayoutV2`'s `bottomSpan` says what bottomSection runs under; Studio passes `main`, and landing the console includes passing it (table below) |
| Insets | A leftSection or rightSection body starts at the kit's row inset — `px-3`, 12 px; a selectable row is full-bleed and pads itself; depth uses the row indent token |
| A document is inset once | A document in a section is wrapped once at the row inset; nothing inside adds a second horizontal inset. The kit's `SectionHeader` and `PanelStatusBar` take the same `px-3`. A control's own padding is the control's, not this rule's |
| Chrome ranks by weight and case | A panel title is semibold at body size; a section header or Eyebrow is uppercase, semibold, tracked and muted, at most three words. A sentence goes in a normal-case line; a warning takes the warning tone |
| Why case, not size | Uppercase carries about 40% more visual height than mixed case at one size, so a section header ranks by case and tracking while the panel title outranks it at base size. The panel title is set once, in `ListPanelChrome`. In a breadcrumb `BreadcrumbList` carries the weight and `BreadcrumbPage` restates `font-semibold` (the kit draws it `font-normal`); trail and current page differ by colour, not weight |
| Panel titles hold nothing to click | A section header is its own collapse button |
| Panel toggles sit on the tab strip | The region toggles belong to what they open, so they are the strip's `headerActions`, never the `header`. `headerActions` is the strip's, not a page's: the shell joins the active page's acts with its region toggles |
| A status bar says where you are | A panel's status bar: `left` the crumb trail, `middle` a live count, `right` the one-line rule the panel keeps |
| A drill-in is the record | A drilled-in body shows the record and nothing else. A list's acts belong to the list; an act on the open record sits beside Back in its header. A drilled-in body draws no status bar |
| Tabs and routes are one thing | Selecting a tab pushes a route; the router never pushes a tab. The open set is session state, per person, and survives a reload the way open editors do |
| A tab switch is visibility | Switching tabs hides a page, never remounts it — each board keeps its camera, layout and selection |
| A hidden tab keeps its state, not its traffic | Its polling pauses and its live stream closes until it shows again |
| At most 8 canvas tabs open | Each holds a GPU context and browsers cap near 16; opening a ninth closes the least recently used. A page that draws no canvas costs nothing and has no ceiling; Home is never closed to make room |
| How a tab closes | A board tab closes from its inline `×` and has no caret menu; a canvas tab keeps *Rename · Close* on its caret while active; Home has neither |
| A tab whose subject is deleted closes | It routes to its neighbour; the last tab closed shows Home |
| One tooltip provider | The shell mounts the one `TooltipProvider`, at 300 ms; a screen never declares its own |
| Corners | One control radius from the kit; structure (regions, panels, tables) is square — never a pill |
| A container query stands alone | A property a container query sets is set only by container queries: `@max-3xl:hidden @3xl:flex`, never `hidden @3xl:flex`, which resolves to hidden at every width |

| `bottomSpan` | bottomSection runs under | Who uses it |
|---|---|---|
| `main` | mainSection only | Studio — the console |
| `main-right` | mainSection and rightSection | `@invana/canvas`'s `GraphCanvasApp` default |
| `left-main` | leftSection and mainSection | The kit's default — easy to draw by mistake |
| `full` | leftSection, mainSection and rightSection | — |

### What the URL holds

One param per region, and its value is the occupant; absent is closed. Each region's param moves on its own — opening
one never changes another.

| Param | Holds | Rule |
|---|---|---|
| The path | The mode and the leftSection occupant | A stale path opens the mode's first occupant |
| `?right=` | `assistant` — rightSection's one occupant | A stale or hand-typed value reads as closed |
| `?console=` | The console's tab, type, page and query step ([EX-F01 › Mechanisms](capabilities/explore/features/EX-F01-the-board-and-its-canvas/feature.md#mechanisms)) | Absent is collapsed |
| `?page=` | The page in front of mainSection, `<kind>:<id>` | The one contract two hosts share: a page id is written the same everywhere it is read |
| `?tab=` | The tab of the page in front | Read only while that page is in front; dropped when the page changes |
| A drill-in key | The record a section drilled into, named for the record | Belongs to its section; dropped when the parent moves |

### Numbers and status

| Rule | Detail |
|---|---|
| A band with no record is absent, not zero | A tile or panel whose record nobody wrote does not render — never `0 of 0`, `{}` or an empty total |
| A count prints whole | A count of things is printed grouped and in full (*8,314*), never rounded; tokens alone print as `k` · `M` · `B` ([CP-49.10](os/control/features/CP-F10-runs-and-how-the-agents-are-doing/stories/CP-49-read-how-one-agent-is-doing/story.md)) |
| A badge is the engine's count | A nav badge (*Inbox*'s *Needs you*) shows the engine's count; zero draws no badge |
| Shape carries status | A row's status is a glyph, with no status word on the row; its shape carries the status for a reader who cannot tell the colours apart |
| A chart is plain | One series each, token colours, a recessive grid |

### Theme

| Rule | Detail |
|---|---|
| Two themes | Light and dark, each a set of the kit's tokens; a person picks one ([CP-F07](os/control/features/CP-F07-find-your-way/feature.md)). More palettes are later |
| Density is a token | Dense inspectors and airy forms are the same components at different sizes, never a second component |
| A switch mid-render redraws nothing | A canvas picks the new colours up on its next frame |
| A missing token falls back | A theme without a token takes the default theme's, never renders unstyled |

### Canvases

Every graph drawing in Studio is an `@invana/canvas` board. What one feature's board draws is its feature's
([SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#decisions) the model map,
[AG-F06](capabilities/agents/features/AG-F06-plans-and-workflows/feature.md#decisions) the flow); these rules hold for
every one.

| Rule | Detail |
|---|---|
| A shared canvas lives in `@invana-studio/canvases` | A canvas two or more modules render lives in `studio/packages/canvases/`, owned by neither. It takes data, config and seams as props and knows none of its callers — no page import, no query hook, no engine type; each caller adapts its own record |
| A host adds nothing to the canvas | No children, toolbar items or camera hooks from a page. What a page needs beyond the drawing — a draft bar, a form — sits around the canvas in the page's layout. Selection is the one channel in and out, plus a gesture the board itself offers |
| Detail is a config patch | A Detail switch applies its patch, then re-runs the layout, since a new node size needs new positions |
| Every run fits the camera | Each layout the board starts — new data, a Detail switch — fits the camera as the nodes move, and never past 100%, so a small drawing is not framed at 2× on a wide page. A narrowing region pans, never refits (above) |
| The theme is Studio's | No theme toggle on a canvas. `CanvasThemeSync source="tokens"` hands the canvas one theme whose palette is the live tokens — backdrop, cards, text, hairlines, rings and the categorical ramp `--color-data-N` — on every theme change; the canvas library's own palette is not used |
| Canvas config is not Studio CSS | A board's numeric colour lookups in its settings and templates are canvas config, which `@invana/canvas` reads as numbers; the tokens-only rule covers the chrome around the canvas |
| The header is the kit's 30 px bar | The height of the kit's tab strip, not canvas-ui's 40 px |
| The board takes its tab's full height | A canvas tab is a `fill` row, so the canvas is the tab edge to edge and a fit frames what is on screen |
| One render backend per page | A canvas starts on the page's backend, the one Explore draws on, so a person who pins WebGL gets it everywhere; the backend is fixed at start, so a change remounts the canvas |
| A missing WebGPU falls back and says so | The page's `RendererCapabilityBanner` is silent on WebGPU, a dismissible notice on the WebGL fallback and a permanent alert when neither can draw; a canvas shows no banner of its own |
| Every canvas roots on `<GraphCanvas>` | A child calling `useGraphCanvas()` under a plain `<Canvas>` throws at render, and `tsc` does not catch it; canvas-ui's boards provide the root |

## 3. Overlays — three tiers

| Tier | Use it for | Shape | Closes to |
|---|---|---|---|
| **Peek** | One fact: why an answer says this, a record, a finding, a run's status | A popover anchored to what was clicked, ≤ 360 px | Nothing moves |
| **Modal** | One task or one decision: add data, approve, invite, publish, new agent, settings | Centred over a scrim, 640–1040 px, a footer holding the acts | The work behind it |
| **Sheet** | Heavy authoring or reading: a skill, an agent, a run, a load, an Access Policy, a report | Nearly full screen, its own crumb, tabs if needed | The work behind it |

| Rule | Detail |
|---|---|
| One level | Never a modal on a modal. A drill-in **replaces** the overlay's content and its crumb grows; Back steps up |
| Every overlay has a URL | It survives a reload and can be shared. An old page route becomes a deep link that opens the overlay over the last workspace |
| Esc always returns | The Esc chip is drawn in every overlay's header |
| The summoner lights | While an overlay is open, its leftNav icon is outlined |
| Steps, not pages | A flow with steps (Connect a graph database, New agent) stays in one modal with a step strip |

## 4. The assistant and agents

| Pattern | What it looks like |
|---|---|
| Answer → act | Every answer ends with chips: *Pin to dashboard* · *Make a task* · *Share* |
| Citations | Numbered marks in an answer. Clicking one opens the *Why* peek: words → query → records → load |
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
| No access | The surface is visible; the act is replaced by *Ask Priya (Admin)*, naming the role or the approver it needs — never a dead end. The act gated is the one that enters an area ([Access Plane](os/access/product.md)) |
| Draft | A floating bar over the canvas: *Draft · 3 changes not published* · Discard · Review and publish |

## 6. Words

| Not on screen | Say instead |
|---|---|
| Product names as places (Agent Builder, Fleet, IAM, Activity) | Agents · Settings › Workers · Settings › People and access · Inbox |
| Policy statement · effect | A rule of an Access Policy · Allow, Ask or Deny |
| Roles other than the three (viewer · contributor · builder · owner · iam-admin) | *Operator* · *Modeller* · *Admin* |
| World | An Access Policy rule on data · a sensitive property |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope · bound | *What it may do* |
| Ledger | *What left the platform* · *Access usage* · History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Task plan · frontier · step envelope | Its steps |

Every renamed word — *Records*, *Load*, *Undone*, *Meaning*, *Broader kind*, *Derivation*, *Derived* — and the words they replace are defined once in [glossary.md](glossary.md). Code, docs and the CLI keep the domain terms in [the glossary's domain terms](glossary.md#domain-terms); this table governs only what a person reads in Studio.

## 7. Naming boards

`area.feature.surface.variant`, lower snake, dots for depth — `agents.runs`, `projects.task.thinking`. The areas are
`start · explore · model · data · agents · inbox · settings · projects · shell`. One canvas page per area, one row per name prefix.

## 8. Where every capability and operating-system part went

| Was | Now | Tier |
|---|---|---|
| Home · Graphs · Onboarding | **Home** — the setup steps until the deployment is ready (a graph database connected, the model shaped from it), then the first answer | page |
| Explorer | **Explore** mode — boards, conversations, dashboards; tools on right-click | mode |
| Modeller | **Model** mode — the Semantics capability: the map, a kind with its Meaning, Standards, Health, History; rules as a sheet | mode · sheet |
| Datasets · Imports | **Records** — Records · Loads · Quality · Annotations; a record and a load as sheets | modal · sheet |
| Agent Builder · Fleet dashboard | **Agents** — Agents · Runs · Skills · Schedules; an agent, a skill, a run as sheets | modal · sheet |
| Activity · Notifications | **Inbox** — Needs you · Running · History | modal |
| Graph settings · IAM · Settings · Fleet workers · Profile | **Settings** — Invana · You; Access Policies as a sheet | modal · sheet |
| Projects | **Projects** mode — a project is a repository, tasks are issues | mode |
