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
| 2 | **Everything else comes to you** | A glance at the agents, access, settings, the Inbox, what runs and who acts: a modal, a peek or a header dropdown over the work, closed with Esc — enough to stay in Explore, Model or Projects while the work goes on |
| 3 | **Agents are helpers, not machinery** | The assistant is always one click away on the right. Agents are colleagues: they answer in threads, ask before acting, and show how they got there |
| 4 | **Say less** | A surface shows the next decision, not every fact. Detail is one click deeper (peek → modal), never on the first screen |
| 5 | **Plain words** | Permissions, limits and states are sentences. No internal nouns on screen (see §6) |
| 6 | **Four modes, not nine products** | The person never picks a product from a launcher. Explore, Model, Projects and Agents are modes of one Studio, named in the wordmark — *Invana Explore*, *Invana Model*, *Invana Projects*, *Invana Agents* — so the person always sees which mode they are in, and switched from the switcher; everything else is summoned. Agents is the place to build and run agents, and shows only to those who may ([Agents is for those who build and run agents](#views-and-their-leftsection)) |
| 7 | **The agent proposes, the person decides** | Invana is built for decisions ([vision](vision.md)). An agent does the work from what the person says and comes back with a proposal or a choice with a recommendation; the person answers with a click. No blank forms where an agent could draft |
| 8 | **Traceable on demand** | Every answer, proposal and act can show how it got there — steps, sources, assumptions, who did what — through *Why?*, *How it got here* and the full run. Never on the first screen; always one click away |
| 9 | **Everyone sees, the policy decides** | Every mode, view and act shows to everyone. An act a person's Access Policies do not allow is disabled, naming the permission and who can grant it; data a policy hides does not exist for the person — absent from a picker, no column, no count, no hint; only a person who reads Access Policies sees what is hidden; the engine refuses whatever the screen shows ([AC-F02 › Rules](os/access/features/AC-F02-access-policies/feature.md#rules)). Nothing is hidden by who a person is |

## 2. The layout

The regions are the shell's (`AppLayoutV2`); only what fills them changes.

| Region | Holds | Rule |
|---|---|---|
| Header | 40 px. `header.left`: one control, *☰ Invana {Mode} ▾* — the wordmark names the mode (*Invana Model*; plain *Invana* on Home) — then the crumb *view › item* (*Invana Model / Models › Airways model › Airport*). `header.right`, in order: ⌘K · *● n running* · *Access* · *Inbox* and its badge · *Assistant ✦* · avatar ([The header](#the-header)) | The mode sits in the wordmark, never in the crumb; the whole *☰ Invana {Mode} ▾* control opens the switcher. No bell, no launcher, no graph picker and no graph name — Graph Data is never picked: each person reads the graph databases their access allows |
| leftNav | A flat labelled nav, 220 px: a search titled for the mode (*Search Model*), then the current mode's **views**, each icon · label · count ([Views and their leftSection](#views-and-their-leftsection)). **Summoners** at the foot, fixed: Agents · Access · Settings, then the avatar and the collapse toggle | A view opens its own leftSection; a summoner opens [the large modal](#the-large-modal) at its own section. Views are flat — group labels allowed, never a sub-tree. Expanded by default; `⌘\` or the toggle at its foot collapses it to icons only — collapsed, a dot stands in for a count that needs you and hover shows the label. No mode switch: the header's switcher is the only one. Home has no views |
| leftSection | What the view in front lists, as a tree ([Views and their leftSection](#views-and-their-leftsection)) — picking a row opens it in main | **Collapsible** (header toggle, ⌘B, or click the active view). It stays open when the leftNav collapses. When collapsed, the toggle leads main's tab row |
| mainSection | The work: board tabs (the workbook), the canvas, a project | Never a list of settings |
| rightSection | The assistant: the thread, then the composer — its one occupant | Closable; reopened from the header. A record opened on a board is a card on the board, never a rightSection occupant, so it never takes the side from the conversation |
| bottomSection | The console under the canvas: Data · Queries — its one occupant | Opened from the footer's counts. No other board kind fills it |
| Footer | `footer.left`: graph database health (*3 graph databases · all healthy*) · the console's counts · the message line. `footer.right`: *● n running* · theme | One line, two zones. *● n running* opens the Operations dropdown, as the header's does |

### The header

| Item | Shows | Opens | Who |
|---|---|---|---|
| ☰ Invana {Mode} ▾ | One control: the wordmark with the current mode — *Invana Explore* · *Invana Model* · *Invana Projects* · *Invana Agents*; plain *Invana* on Home | The switcher | Everyone |
| The crumb | *view › item* after the wordmark, never the mode: *Models › Airways model › Airport* · *Records › Airways › Airport* · *Boards › Hub routes* · *Projects › Winter delays review › Tasks*; each level links one level up | That level | Everyone |
| ⌘K | *Do, open or ask anything* — the shortcut layer for everything not in the leftNav, Help included ([CP-F07](os/control/features/CP-F07-find-your-way/feature.md)) | ⌘K | Everyone |
| *● n running* | Runs going now; *Idle* with a grey dot when nothing runs — it keeps its place | The Operations dropdown ([CP-F09](os/control/features/CP-F09-overview/feature.md)) | Everyone; a person without Read on Runs reads their own |
| *Access* | A lock; a count only when an act was blocked today | The Access dropdown ([AC-F06](os/access/features/AC-F06-history/feature.md)) | Everyone; what a person may not read is withheld, each row's acts disabled with who can grant them |
| *Inbox* | Its badge: the Needs you count; a dot when only Updates are unread; nothing when nothing waits | The Inbox dropdown ([CP-F08](os/control/features/CP-F08-the-inbox/feature.md)) | Everyone |
| *Assistant ✦* | — | rightSection | A person who may use the Assistant |
| Avatar | The person | Profile · Your access (Access Policies, delegations) · Your theme (Settings › You) · Help · Shortcuts · What's new · Sign out | Everyone |

### The switcher

A header dropdown of about 1180 px, from the *☰ Invana {Mode} ▾* control ([CP-68](os/control/features/CP-F07-find-your-way/stories/CP-68-switch-mode-and-pick-up-where-i-left-off/story.md)).

| Side | Holds |
|---|---|
| Left — Go to | Home · Explore ⌘1 · Model ⌘2 · Projects ⌘3 · Agents ⌘4 — for everyone |
| Left — New | Conversation · Board · Project. Connecting a graph database is not here: it lives in Settings › Connections › Graph databases and on Home before set-up |
| Right — Recent | The person's own, kept by the engine: search · kind tabs (All · Conversations · Boards · Projects · Models · Queries · Runs) · a **Pinned** row (any item starred) · three *Continue where you left off* cards (the last conversation with a snippet, the last board with a preview, the last project with its progress) · grouped lists with state dots |
| Never | Settings, Help, a graph switcher |

### Views and their leftSection

| Mode | Views (the leftNav's items) |
|---|---|
| Home | — |
| Explore | Boards · Conversations · Dashboards · Queries |
| Model | Models · Standards · Health · **Rules and meaning**: Rules · Taxonomies · Inference · **Graph Data**: Records · Loads · Quality · Annotations |
| Projects | Projects · My tasks · Reviews · Schedules |
| Agents | Agents · Skills · Runs · Schedules |

| View | Its leftSection |
|---|---|
| Boards | Mine · Shared with me · Archived |
| Models | Every model, grouped by graph database (one folder each), a tree of its Kinds and Relationships, then *Links between models* with their count — Kinds and Relationships are not views of their own; links between models are declared here and on the model map ([SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md)) |
| Rules | Everywhere · each project · Requests, its open count beside it ([SE-F07](capabilities/semantics/features/SE-F07-rules/feature.md)) |
| Taxonomies | Per model: its broader kinds and value hierarchies ([SE-F04](capabilities/semantics/features/SE-F04-taxonomies/feature.md)) |
| Inference | The derivations, grouped by rule ([SE-F08](capabilities/semantics/features/SE-F08-inference/feature.md)) |
| Records | The kinds, grouped by model |
| Projects | Active · Draft · Done |
| Agents (view) | Every agent, grouped Built in · Team pack · Custom · Outside — outside agents a group, never a view ([AG-F02](capabilities/agents/features/AG-F02-the-agents-catalogue/feature.md)); an agent opens as its page in main |
| Skills | Skills · Workflows (Built in · Approved, by what each touches) · Functions (*Tools they call*) · Approaches · Projection templates; a skill, a workflow and a function each open as their page in main ([AG-F04](capabilities/agents/features/AG-F04-skills/feature.md) · [AG-F06](capabilities/agents/features/AG-F06-plans-and-workflows/feature.md)) |
| Runs | Needs attention · Running · Failed · All runs, and the tab *How they are doing* — each agent, skill, plan and model version against its own baseline; a run opens as its page in main ([CP-F10](os/control/features/CP-F10-runs-and-how-the-agents-are-doing/feature.md)) |
| Schedules (Agents) | On · Paused ([AG-F07](capabilities/agents/features/AG-F07-schedules/feature.md)) |
| Any other view | The list it names, grouped where it has groups |

| Rule | Detail |
|---|---|
| One view, one leftSection | Each view opens its own leftSection, a tree of what it lists; picking a row opens it in main. The nav itself never holds a tree |
| Views swap, summoners overlay | A view changes leftSection and main; a summoner (Agents · Access · Settings) opens the large modal at its section and never changes the mode |
| Agents is a mode for everyone | The Agents mode — in the switcher, ⌘4 and every *Open in Agents* — shows to everyone; building, publishing and running respond to the person's Access Policies, each act they lack disabled with who can grant it. The Agents summoner is the glance ([Its sections](#its-sections)) |
| Infrastructure is Settings | Plugins and Workers (with Limits and Usage) are sections of Settings in the large modal, not views of the Agents mode; they show to everyone and the policy decides (rule 9). The Agents mode is for building and running agents — Agents · Skills · Runs · Schedules. An agent's tool picker stays on the agent's page; installing a plugin and switching it on or off is Settings › Plugins |
| The Agents summoner is a glance; the Agents mode is the workspace | Building, testing and reading runs happen in the Agents mode, running workers in Settings › Workers; the summoner shows only enough to stay on the work in front, and every deeper act is *Open in Agents*, which closes the modal and switches mode — a worker act is *Open in Settings*, at Settings › Workers |
| The switcher is the one mode switch | The leftNav holds no mode switch; the *☰ Invana {Mode} ▾* control opens [the switcher](#the-switcher) |
| Collapsed, it still says what needs you | Icons only: the lit view stays lit, a view whose count needs you carries a dot, hover shows its label; leftSection is unchanged |
| Rules and meaning is a group of Model | Rules · Taxonomies · Inference are views of Model like any other — each its own leftSection, a rule, a taxonomy or a derivation opening in main; none opens in the large modal |
| Graph Data is a group of Model | Records lists the kinds grouped by model, from the graph databases the person's default agent may read; Loads · Quality · Annotations follow. A record and a load open in main with a breadcrumb ([Records](capabilities/records/product.md)) |
| A mode's Schedules is a filter | Projects › Schedules is the one Schedules list filtered to that mode's kind, and every schedule while there is one kind ([AG-F07](capabilities/agents/features/AG-F07-schedules/feature.md)) |
| Before set-up | Mode switches are disabled until set-up starts; Home is the only place ([CP-22](os/control/features/CP-F05-graph-databases/stories/CP-22-start-a-fresh-deployment-from-a-question/story.md)) |

### Counts

| Rule | Detail |
|---|---|
| One source | Every count — Needs you, running, waiting, open alerts, blocked acts — comes from one engine read and one live subscription ([CP-F08 › Engine](os/control/features/CP-F08-the-inbox/feature.md#engine)); the header badge, *n running*, the footer, the dropdowns and the browser title *(n) Invana* all read it |
| Needs you | Asks waiting on the reader + runs waiting on the reader's answer + open alerts sent to the reader; unread Updates are a dot, never a number |
| Studio never counts | It formats what the engine sends; a count it has not been sent is absent, not zero |

### Regions at work

| Rule | Detail |
|---|---|
| Sizes | leftNav is 220 px expanded and icon-wide collapsed; leftSection and rightSection open at 280 px (240–640); mainSection never goes under 300 px |
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
| A badge is the engine's count | The header Inbox badge shows the engine's *Needs you* count; zero draws no badge, and a dot when only Updates are unread ([Counts](#counts)) |
| Shape carries status | A row's status is a glyph, with no status word on the row; its shape carries the status for a reader who cannot tell the colours apart |
| A chart is plain | One series each, token colours, a recessive grid |

### Theme

| Rule | Detail |
|---|---|
| Two themes | Light and dark, each a set of the kit's tokens; a person picks one ([CP-F07](os/control/features/CP-F07-find-your-way/feature.md)). More palettes are later |
| A switch mid-render redraws nothing | A canvas picks the new colours up on its next frame |
| A missing token falls back | A theme without a token takes the default theme's, never renders unstyled |

### Density

Two densities, **airy** and **dense**, set through the kit's density token. They are the same components at different
sizes, never a second component. A board, story or component never sets spacing of its own; it takes the density its
surface kind names below.

| Density | Surfaces | Why |
|---|---|---|
| **Airy** | Forms and preference rows · flows and their steps — create, connect and add-workers steps, the large modal's detail forms · task modals · the map-led project page and project settings (its five tabs) · empty states | A person reads, chooses and types here; room lowers mistakes |
| **Dense** | Tables · inspectors and element panels · lists and trees, leftNav and leftSection · the header dropdowns' rows · the console · Explorer chrome — toolbar, minimap, layout and tool panels | A person scans many rows or works the canvas; the work stays in view |

| Rule | Detail |
|---|---|
| The surface sets it, not the page | A page that holds both takes each region's own density: a table inside an airy form page stays dense, a form in an inspector stays airy |
| Explorer chrome stays compact | The Explorer's chrome is dense even where it holds a form; the airy density is for forms, flows and pages |
| Set once, never per board | Spacing comes from the token on the shared shell components; a board that needs a different spacing is a gap in the token, raised, never overridden |
| Both lenses and every state | Admin and Operator, and every state of a surface, draw at the surface's density |

### Breadcrumbs

| Rule | Detail |
|---|---|
| A deep trail folds | When the crumb is wider than its room, the middle levels fold into one *…* control; it opens a menu of the levels it hides, each linking to its level. The first level and the last two always show |

### Canvases

Every graph drawing in Studio is an `@invana/canvas` board. What one feature's board draws is its feature's
([SE-F06](capabilities/semantics/features/SE-F06-links-and-mappings/feature.md#decisions) the model map,
[AG-F06](capabilities/agents/features/AG-F06-plans-and-workflows/feature.md#decisions) the flow); these rules hold for
every one.

| Rule | Detail |
|---|---|
| A shared canvas lives in `@invana-studio/canvases` | A canvas two or more modules render lives in `studio/packages/canvases/`, owned by neither. It takes data, config and seams as props and knows none of its callers — no page import, no query hook, no engine type; each caller adapts its own record |
| A host adds nothing to the canvas | No children, toolbar items or camera hooks from a page. What a page needs beyond the drawing — a draft bar, a form — sits around the canvas in the page's layout, or the layout floats the toolbar, bars and right panel over the canvas. Selection is the one channel in and out, plus a gesture the board itself offers |
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
| **Dropdown** | A live summary with its acts in place: the switcher, Operations, Access, the Inbox | Anchored to its header button, up to about 1200 px wide; no scrim, the work stays usable | Nothing moves; outside click or Esc closes it |
| **Modal** | One task or one decision: add data, approve, invite, publish, new agent, a create | Centred over a scrim, 640–1040 px, a footer holding the acts | The work behind it |
| **Large modal** | The summoners' places — the Agents glance, Access and Settings, and what opens in them, an Access Policy — and the full Inbox, a report, a run | Inset 64 px from every window edge over a backdrop that dims the whole app, leftNav and header included; its own nav ([The large modal](#the-large-modal)) | The work behind it |

| Rule | Detail |
|---|---|
| A dropdown is its own tier | A peek holds one fact at ≤ 360 px; a dropdown holds a summary of many and acts in place, so it is a tier, not a wide peek |
| Peek, then modal | Overlays deepen peek → modal; there is no third, heavier tier. A large modal is a modal at its largest, never a page |
| One level | A task modal may open over the large modal — *Invite*, *Assign*, a confirm; nothing opens over a task modal. A drill-in **replaces** the overlay's content and its path grows; Back steps up. A dropdown's act that needs a modal closes the dropdown and opens it |
| Every overlay has a URL | A modal — the large modal at its section and item — and a peek survive a reload and can be shared; an old page route becomes a deep link that opens the overlay over the last workspace. A dropdown has no URL — it is a glance |
| Esc always returns | Close (Esc) is drawn in every modal's header; in the large modal, Esc closes the modal from any section |
| The section lights | While the large modal is open, its nav lights the section in front and the summoner that opened it stays lit under the backdrop; while a dropdown is open, its header button is outlined |
| Creates choose a type on one page | A create that chooses a type — a graph database, an agent, an AI model, a connector — is one modal of numbered sections: **1 Name** (optional) · **2** the type, as a grouped card grid · **3** its details, appearing once a type is picked — and one filled act |
| Simple creates happen at once | A board or a conversation is made on the click, with no modal |
| A step strip for what happens over time, or three or more separate decisions | A step strip, one step in front, *Back* and *Next*, is for a create whose result arrives after the person acts — Add workers, a 720 px modal: Where · Group · Join key · Run it · Joined ([CP-10](os/control/features/CP-F03-workers-and-the-queue/stories/CP-10-add-workers-on-my-own-machines-with-one-command/story.md)) — or that asks three or more separate decisions — New project: About · Goals · Graph databases · Team · Review ([PJ-02](capabilities/projects/features/PJ-F01-projects-and-tasks/stories/PJ-02-start-a-project-of-its-type/story.md)). Its last step reviews every answer, each with *Edit*, before the one filled act. Never on screen as a *wizard* |

### The large modal

One modal holds every place the leftNav's summoners open. Each summoner opens it at its own section; moving between
sections never closes it.

| Part | Holds |
|---|---|
| Frame | Inset 64 px from every window edge; a backdrop dims the whole app, leftNav and header included |
| Left | A 260 px nav: search (*Search Agents, Access, Settings…*) · the sections as groups ([below](#its-sections)) · *About Invana* at the foot |
| Top bar | The path, `/`-separated (*Access / Who / Users*) · at most one action for what is in front (*Restore defaults*, *Invite*, *Open in Agents*) · ✦ · Close (Esc). ✦ opens the Assistant as the modal's right column, scoped to the section in front |
| Body, by type | **A glance** — bands of live rows, each with at most one act in place · **Preference rows** — a setting a line · **A table** with live counts and drill-in · **A detail page** — a header, one act, tabs and a metadata column |
| Elsewhere | The full Inbox, a project's report and a run opened from a glance open in the same frame with a nav of their own; they are not sections of the summoners' modal |

### Its sections

| Section | Nav | Rule |
|---|---|---|
| Agents | — (one glance) | Three bands: **Waits on you** — each agent's ask of the reader, answered in place · **Running** — each agent at work, what it is doing now and its next ask, with *Pause* and *Stop* in place · **Workers** — keeping up or not, runs at once free, scale advice. *Assign* gives an agent a task from here. Every deeper act — build, test, read a run, — is *Open in Agents*; adding or draining workers and changing a limit is *Open in Settings*, at Settings › Workers ([CP-72](os/control/features/CP-F10-runs-and-how-the-agents-are-doing/stories/CP-72-glance-at-the-agents-without-leaving-my-work/story.md)) |
| Access | Who · What they may do · Record | *Who* — users, teams, keys · *What they may do* — Access Policies · Agents, each agent's delegations in force on its detail · *Record* — History, with *Refused · Today* for what was blocked today; who acts now is the header's Access dropdown ([Access Plane](os/access/product.md)) |
| Settings | General · You · Connections · Plugins · Workers · Alerts and notifications | *General* — the deployment's name and default theme · *You* — your account, your theme, where asks reach you, keys · *Connections* — Graph databases (with Data stores, [CP-F13](os/control/features/CP-F13-data-stores/feature.md)) · AI models · Connectors, each connector's credentials made, tested, rotated and removed on its detail, and Trackers ([CP-F12](os/control/features/CP-F12-issue-trackers/feature.md)) · MCP server · Team packs. Preference rows and tables · *Plugins* — Core · Tool · Outside servers · Runtimes, each reading on or off and *Used by n agents*; an outside server keeps only its own sign-in; a plugin opens as its detail page ([CP-F02](os/control/features/CP-F02-plugins-and-outside-tools/feature.md)) · *Workers* — Groups · All workers · Join keys · Queue · Limits: runs at once free, scale advice on Groups and Queue; Limits holds Usage — runs and tokens by team, user and agent, running · waiting · failed, against each limit; a worker group or a worker opens as its detail page ([CP-F03](os/control/features/CP-F03-workers-and-the-queue/feature.md) · [CP-F04](os/control/features/CP-F04-limits/feature.md)) · *Alerts and notifications* — Alerts · Thresholds · Rules (a History row is one trigger) · Channels ([CP-F11](os/control/features/CP-F11-ops-alerting/feature.md) · [CP-F08](os/control/features/CP-F08-the-inbox/feature.md)) |
| About | — | The version, what's new and Help |

| Rule | Detail |
|---|---|
| Read before act | A section an act needs a permission for reads in full; the act reads *Ask {Admin}* |
| A glance, not the workspace | The Agents section shows only enough to stay in Explore, Model or Projects while agents work: what waits on the reader, what runs, whether the workers keep up. A person without Read on Runs sees their own runs and asks in it; *Open in Agents* is there for everyone |
| The Inbox is its own | The full Inbox — Needs you · Running · Updates · Done — opens in the large modal's frame from the Inbox dropdown's *Open the Inbox*; an Admin also filters *All open alerts* ([CP-F08](os/control/features/CP-F08-the-inbox/feature.md)) |

### The header dropdowns

| Dropdown | Width | Holds | Who |
|---|---|---|---|
| Switcher | ~1180 px | [The switcher](#the-switcher) | Everyone |
| Inbox | 640 px | Needs you · Running · Updates; each ask a card with enough to decide in place and its acts; only what needs *you* ([CP-69](os/control/features/CP-F08-the-inbox/stories/CP-69-decide-what-needs-me-from-the-header/story.md)) | Everyone |
| Operations | ~720 px | Four tiles — Running (and queued) · Queue (waiting, oldest) · Workers (busy of total, lost) · Tokens this month against the budget — then *Running now*, each run with its step progress and *Stop*; links to Agents › Runs in the Agents mode and Settings › Workers in the large modal ([CP-70](os/control/features/CP-F09-overview/stories/CP-70-see-what-the-deployment-is-doing-from-the-header/story.md)) | Everyone; an Operator's holds their own runs |
| Access | ~1100 px | Four tiles — People signed in · Agents acting now · Requests waiting · Blocked today — then the timeline *What each one is touching · last hour* — a row per person or agent, a bar per layer touched, a blocked act struck through — drawn with the kit's Gantt in its *Layer access* reading; links to Access › Record ([AC-48](os/access/features/AC-F06-history/stories/AC-48-see-who-is-acting-and-what-was-blocked-from-the-header/story.md)) | Admin only |

| Rule | Detail |
|---|---|
| A dropdown is a quick overview | It reads at a glance and links on; every deeper act happens where it links — add workers, change a limit, tune an alert, drain in Settings › Workers; edit a policy in the large modal at Access |
| Low-risk acts in place | *Acknowledge*, *Send back*, *Allow tokens* answer inside the Inbox dropdown; *Stop* a run is Operations' one act in place; Access has none |
| A write confirms | An *Accept* that writes Graph Data or the model opens a confirm modal listing what changes |
| Hidden is not the guard | An act a person may not take reads *Ask {Admin}*, and the engine refuses it too |
| Links, not more summoners | Operations links to Agents › Runs and Settings › Workers, for everyone — what a person may not read there is withheld; Access links into Access › Record — neither dropdown is a summoner |
| The depth is elsewhere | Agents against their budgets and workers by group are read in Settings › Workers; alerts in Settings › Alerts and notifications; AI models and graph databases in Settings › Connections; delegations in force on the agent's page in Access › What they may do; what was blocked and recent changes in Access › Record — none in a dropdown |

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
| Before set-up | Home asks *What are you trying to decide?* and offers *Connect a graph database* — or, without Create on Settings, *Ask {who can grant}* — and *Try it on demo data*; then set-up *n of 4*; then the first answer. Mode switches are disabled until set-up starts |
| Empty | A one-line reason and the next act (*Ask your first question*), never a blank region |
| Loading / running | The footer's message line, *● n running* and the Inbox's *Running*. The work stays usable |
| Idle | *● n running* reads *Idle* with a grey dot and keeps its place |
| Needs you | The Inbox badge's count, the act inside the card |
| Cannot answer / refused | The assistant says why and who can help, in a sentence, with the act that asks them |
| No access | The surface is visible; the act is replaced by *Ask Priya (Admin)*, naming the permission or the approver it needs — never a dead end. The act gated is the one that enters an area ([Access Plane](os/access/product.md)) |
| Draft | A floating bar over the canvas: *Draft · 3 changes not published* · Discard · Review and publish |

## 6. Words

| Not on screen | Say instead |
|---|---|
| Product names as places (Agent Builder, IAM, Activity) · *Fleet* | Agents · Operations · Workers · Access · Inbox |
| Policy statement · effect | A rule of an Access Policy · Allow, Ask or Deny |
| Roles of any kind (viewer · contributor · builder · modeller · owner · iam-admin) | The Access Policy — *Explore*, *Shape the model*, *Run the deployment* — or the permission an act needs |
| World · view of the graph | An **Access Policy** rule — what may be seen is never a named view; a lens is parked |
| Guardrail · invariant | A rule (*must always hold*) |
| Envelope · bound | *What it may do* |
| Ledger | History (*what people and agents did*) |
| Pool · lane · worker-seconds | Workers · *runs at once* |
| Stitch | Link between models |
| Task plan · frontier · step envelope | Its steps |
| *Graph* as a thing you open, pick, switch or list | *Graph Data* — everything the deployment's graph databases hold, read in place, each reached as far as access allows; never an object |

Every renamed word — *Records*, *Load*, *Undone*, *Meaning*, *Broader kind*, *Derivation*, *Derived* — and the words they replace are defined once in [glossary.md](glossary.md). Code, docs and the CLI keep the domain terms in [the glossary's domain terms](glossary.md#domain-terms); this table governs only what a person reads in Studio.

## 7. Naming boards

`area.feature`, lower snake — `agents.runs`, `model.models`. The areas are
`start · explore · model · data · agents · inbox · settings · projects · shell`. One canvas page per area, one row per name prefix.

| Rule | Detail |
|---|---|
| One board per place | A board is one place a feature lives: a canvas page, a mode's view, a section of the large modal, a header dropdown or a page outside the shell. It is named for that place's feature — `model.models`, `agents.runs`, `settings.people` |
| The board shows the whole feature | It opens on the list; a **View** switch moves List · Detail; a modal it opens — a create, an edit, a confirm, Sign in again — is a state of the board, drawn over it; a peek, a menu, a panel, the console and a collapsed region are states too. **State** and **Access** switches carry the rest |
| A cell names board and state | A story's `## Screens` cell reads `<board> · <view or overlay> · <state>` — `model.models · Kind · Edit`, `agents.runs · Detail · Content withheld`. A cell with no view is the List |
| The Operator access is the board's | The read-only access is the same board, each act a person lacks disabled with *Ask {who can grant}* — `<board> · Locked` names that state; there is no separate locked board. The exception is a board whose reading needs a permission the Operator lacks — Access Policies (`settings.policies`, `settings.agent_access`): the Operator state is `<board> · No access`, with no policy content shown |
| A refusal names the resource, not its address | Copy reads *Needs {Action} on {Resource name} — ask {who can grant}*. The resource name is the *Resource* column of [the permission catalogue](os/access/features/AC-F02-access-policies/feature.md#the-permission-catalogue) — Graph Data, Models, Projects, Agents, Skills, Memory, Access, Settings — or, when the refusal is about one item, the item's name: *Needs Edit on the Airways model*, *Needs Create on Models*. It never shows the address (`model/*`, `project/<project>`, `data/<graph database>/…`); addresses appear only on policy, API and History surfaces — the policy editor, the permission catalogue, History rows, API errors. *{who can grant}* is the people who can grant it, by name — *ask Priya or Lee* — written the same way everywhere. A refusal never names a policy or a rule, for anyone |
| A modal many boards share is drawn once | *Sign in again* is `access.signin · Sign in again`; every story that asks for the password again cites it there |
| Flow boards | One per act — create an agent, create a skill, create a project, connect a graph database, install a connector and add its credential. Named `flow.<act>` (`flow.create_agent`, `flow.connect_graph_database`), on the canvas page `flows`. They show the steps left to right, each step a live frame of `<board> · <view> · <state>` with its lens, plus arrows, a caption and the criteria IDs. Every one is end to end ([below](#every-design-is-end-to-end)) |
| Journey boards | One per journey J01–J14, chaining flow boards across places. Named `journey.jNN` (`journey.j01`), on the canvas page `journeys` |
| Flow and journey boards draw nothing of their own | They only frame place-board states, which open from the URL (view, state, lens) |
| Milestone badge | Every board, flow and frame carries a badge for the [milestone](milestones.md) of the stories it cites — derived, never hand-typed. It reads *MVP?* while the milestone is proposed and unconfirmed |
| A new board only for a new place | Two features in one place share its board; a feature in two places has a board in each |

### Every design is end to end

A state that exists is not enough: a person clicks from where an act starts to where it ends. Flow boards above frame this click path.

| Scope — every act | Includes |
|---|---|
| Create · edit · delete | Delete means remove, retire or revoke |
| Connect · install · grant | Including each credential and test |
| Run · stop · retry | Including a run that fails or is partial |
| Every list and detail | Any list or detail that leads into one of the above |

| An end-to-end board | Rule |
|---|---|
| a. Starts where a person is | The flow's first state opens from its place's List or Detail |
| b. Every step is a state | Each step in a step strip (modal, wizard, sheet) has its own named state |
| c. Every button leads on | A step's primary button leads to the next state; Back and Cancel or Close lead to a named state |
| d. Every failure has a way out | Each failure or edge the act can reach has a state and an exit: failed test, expired or taken, nothing found, refused for access (Operator), empty, loading, partial success |
| e. The result shows where it lands | The List row, the Detail or the Inbox item that the act changed |
| f. Both lenses | Admin and Operator wherever *Who can* differs, the refused state included |
| g. Delete and retire | Names what happens to dependants (open work, agents, links); has a confirm and either an undo state or a *cannot be undone* state |
| h. Edit | Shows the current value, the change, and the saved or the refused result |

| Naming | Rule |
|---|---|
| One name per node | A state is named `Step · Substate`, one name per click-path node; a story's `## Screens` lists every node |
| Framed by URL | A `flow.<act>` board frames the nodes by `?view=…&st=…&lens=…` |
| The flow board | Frames the same click path, in order, every frame resolving, no step skipped |

| Done check | Rule |
|---|---|
| Click-through | A board is done when a click-through of each flow — start to result, and each failure path — reaches every state with no dead end |
| Who checks | The designer's render check and QA's design pass |
| Not enough | That a state exists; every state is reached from the one before it |
| A fuller flow in Invana Products than the spec | The product-manager changes the spec first; the designer never draws a step the spec lacks |

## 8. Where every capability and operating-system part went

| Was | Now | Tier |
|---|---|---|
| Home · Graphs · Onboarding | **Home** — *What are you trying to decide?*, the set-up steps until the deployment is ready (*n of 4*), then the first answer | page |
| Explorer | **Explore** mode — Boards · Conversations · Dashboards · Queries; the memory graphs open as board tabs ([GP-F02](os/graph/features/GP-F02-memory/feature.md#decisions)); tools on right-click | mode |
| Modeller | **Model** mode — the Semantics capability: Models (a tree of each model's Kinds and Relationships, and the links between models) · Standards · Health · Rules and meaning (Rules · Taxonomies · Inference) · Graph Data | mode |
| Datasets · Imports | **Graph Data** — a group of Model: Records (kinds grouped by model, from the graph databases the person may read) · Loads · Quality · Annotations; a record and a load open in main | mode |
| Agent Builder · Fleet · Skills · Plugins | **Agents** mode — Agents · Skills (with its Workflows) · Runs (with *How they are doing*) · Schedules; an agent, a skill, a workflow and a run open in main. Its glance is the Agents summoner. Plugins and Workers are Settings | mode · modal |
| Team packs | **Settings › Connections › Team packs**, each with *Used by n agents* | modal |
| Fleet dashboard · Overview | **Operations** — the header's *● n running* and the footer's; the depth is Agents › Runs and Settings › Workers | dropdown |
| Activity · Notifications | **Inbox** — the header's dropdown (Needs you · Running · Updates), then the large modal (Needs you · Running · Updates · Done) | dropdown · modal |
| Fleet workers · limits · ops alerts | **Settings › Workers** — Groups · All workers · Join keys · Queue · Limits (with Usage: runs and tokens by team, user and agent); ops alerts are **Settings › Alerts and notifications** — Alerts · Thresholds · Rules · Channels; whether workers keep up shows in the Agents glance and *● n running* | modal |
| IAM · IAM activity | **Access** — Who · What they may do · Record; *Record* is History; no *Now* — acting now is the header's Access dropdown, blocked today is History · Refused · Today, a delegation is revoked on the agent's page; the header's lock is its glance, for everyone. No *Keeping* tab, no Usage, no What left — their stories are `later` (AC-F08 · AC-30 · AC-F12) | modal · dropdown |
| Graph settings · Settings · Connectors · Profile | **Settings** — General · You · Connections · Plugins · Workers · Alerts and notifications, *About Invana* at the foot. *General* — the deployment's name and default theme. *You* — profile, username, password, sessions, default agent, your theme, where asks reach you, keys; no Connections, Connected clients or Owners — their stories are `later` (CP-43 · CP-63 · AC-F11 · AC-24 · AC-43) | modal |
| Help | The avatar menu and ⌘K | menu |
| Projects | **Projects** mode — Projects · My tasks · Reviews · Schedules; a project is a repository, tasks are issues | mode |
