---
name: design-redesign
status: running
branch: chore/specs-graph-data
scope: design-redesign
---

# Design — the Invana redesign on one canvas

Draw every surface the specs name on the one design canvas, *Invana design*, on a shared shell, so the whole
redesign plays as one clickable prototype at Full HD, every state and both lenses, ready for the build.

| | |
|---|---|
| Goal | Every board any story's `## Screens` names is drawn on *Invana design*, on its place's page, on the shared shell components, from the design-kit, with State and Lens switches, linked so the canvas plays end to end. `check.py` finds every cited board in the local mirror |
| Specs | Every story in `specs/os/**` and `specs/capabilities/**` that names a board — traced by board name, not by story (see *Rules*); `specs/design-language.md` §1–§8 (D1–D20) is the layout |
| Not in this project | Studio or engine code · story statuses (they stay where they are) · the earlier canvases in `.design/` (reference only) · design-kit or canvas repo code (a missing component is a recommendation) · the old per-product canvases |

Run it: `python3 .claude/skills/run-project/run.py design-redesign` (the project-lead does, with `--start`).

## Decisions

Settled with Ravi on 2026-11-15. No phase reopens them.

| # | Decision |
|---|---|
| D1 | One canvas: *Invana design* — `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. One page per place in the app, one board per place a feature lives (D11) |
| D2 | Pages, in this order: *Index* · *Components* · *Shell* · *Sign-in & Home* · *Explore* · *Model* · *Projects* · *Inbox* · *Records* · *Agents* · *Library* · *Settings · You & Invana* · *Settings · Connections* · *Settings · Operations* · *Settings · Access* · *Reference designs* |
| D3 | Boards are Full HD, 1920×1080; the leftSection is 260 px by default; the assistant is 420 px |
| D4 | The shell is components on the *Components* page — `ShellHeader` · `ShellRail` · `ShellLeftSection` · `ShellFooter` · `SheetFrame` · `AssistantPanel` — mounted by every board with `<dc-import>`; no board copies shell markup |
| D5 | The 8 boards on the canvas today (Workbench, 1 Welcome … 7 Access dropdown) move to *Reference designs* unchanged. `Main.dc.html` becomes the *Index* board; the Workbench keeps its content as `ref.workbench.dc.html` |
| D6 | The kit bundle is the one already in the mirror, `project/ds/invana-kit/` (design-kit release `1794604989-411c`); no phase refreshes it |
| D7 | Placements: memory (GP-F02 `graph.memory`) on *Explore*; outside agents (AG-F05) the *Outside* filter of `agents.agents`, on *Agents*; MCP server (`settings.mcp`) under Settings › Connections; `control.alerts` on *Settings · Operations*; `agents.skills` (skills, workflows, functions, templates) · `settings.plugins` · `settings.packs` · `settings.connectors` on *Library* |
| D8 | Whole app first: P01 and P03–P04b draw every board's List (has data · Admin) linked end to end; P05–P16 then draw every view, overlay, edit, create, state and lens, page by page. Each board is in exactly one List phase and exactly one state phase (*Boards by page*) |
| D9 | No phase waits for Ravi; every phase is approved on its gates; no QA review. Ravi reviews the published canvas after the last phase |
| D10 | Every create the specs name is a modal **state of its feature's board** (D11) — `<board> · New`, or the act's own word (`· Connect` · `· Upload` · `· Install` · `· Import` · `· Attach` · `· Add workers` …) — drawn over that board, never a board of its own. The wizard is `design-language.md` §3: one modal of numbered sections that open in order (1 Name · 2 the type as a grouped card grid · 3 its details) and one filled act. The step strip is only `settings.workers · Add workers`, whose worker joins after the person acts. Each create's State switch runs through every section, the validation error on its field, working and done, in both lenses. A board, a conversation and a dashboard from *Pin* are made on the click; roles are fixed and have no create; a kind and a relationship are made in the model's draft (`model.models · Draft`). Each place phase (P09–P16) draws the creates on its own boards |
| D11 | **One board per place, showing the whole feature** (`specs/design-language.md` §7). A board is a canvas page, a mode's view, a sheet's section, a header dropdown or a page outside the shell, named for its feature. It opens on the List; a View switch moves List · Detail; its modals (create, edit, confirm, *Sign in again*), peeks, menus, panels, the console and collapsed regions are its states; the Operator's locked reading is its Operator lens (`· Locked`), never a separate board. Each `## Screens` cell reads `<board> · <view or overlay> · <state>`. 56 boards cover all 235 stories (151 before) |
| D12 | Draw locally, publish once at the end. The mirror `.design/canvas-invana/project/` is seeded from the live canvas version `1794697037-3af0`; every phase draws in it. After P17 the project-lead publishes the whole mirror to `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`, merging anything newer on the live canvas first, then reports to Ravi. Why: headless runner sessions have no Artifact tool |

## Boards by page

This table is the project's coverage list: every board the canvas must hold, on its D2 page, with the views, creates
and edits the phases name. Each board is drawn by one List phase and one state phase; every other state its stories'
`## Screens` cells name comes with its board's state phase. P17 audits the canvas against it. `· Locked` is each
board's Operator lens (D11); creates and edits are modal states of their board (D10).

| Page | Boards (views · creates · edits) | Phase that draws them | Count |
|---|---|---|---|
| Index | `Main.dc.html` — one card per page (not a board) | P01 | 0 |
| Components | `ShellHeader` · `ShellRail` · `ShellLeftSection` · `ShellFooter` · `SheetFrame` · `AssistantPanel` (components, not boards) | P01 | 0 |
| Shell | `shell.switcher` · `shell.command` · `shell.operations` · `shell.access` (edit · Revoke) · `shell.avatar.access` · `inbox.dropdown` (· Confirm) | P03 List · P05 every state | 6 |
| Sign-in & Home | `access.signin` (· Sign in again · Locked) · `access.consent` · `start.home` (· Set-up) | P03 List · P06 every state | 3 |
| Explore | `explore.board` (· Boards · Conversations · Queries · Ask · Left closed · Menu · Why · Chart · Cannot · Share · Save derived · Annotate · Console · Present; edits · Edit · New conversation · Fork from here · Add to a project · Share · Export) · `explore.dashboards` (· Detail; edit · Detail · Pin · New dashboard) · `graph.memory` (· Thinking · Lineage · Project map · Org knowledge) | P01 List of `explore.board` · P03 List of the other two · P07 `explore.board` · P08 `explore.dashboards`, `graph.memory` | 3 |
| Model | `model.models` (map · Detail; create · New; edits · Draft · Publish · Export · Import) · `model.kinds` (· Detail: Properties · Meaning · Standards; edit · Detail · Edit) · `model.relationships` (· Detail) · `model.standards` (· Detail; create · New; edit · Write a standard) · `model.taxonomies` · `model.rules` (· Detail; create · New) · `model.views` (· Detail; create · New; edit · Detail · Edit) · `model.inference` (· Detail; create · New) · `model.health` (· Usage) | P03b List · P09 every state, create and edit | 9 |
| Projects | `projects.projects` (· Detail tabs · Assistant; creates · New · Ask for help) · `projects.tasks` (My tasks · Reviews · Detail · How it got here; create · New) · `projects.branches` (tree · Finding; create · Finding · New; edits · Fork · Merge · Decide) · `projects.report` (edit · Edit) · `projects.alerts` | P03b List · P10 every state, create and edit | 5 |
| Inbox | `inbox` | P04 List · P11 every state | 1 |
| Records | `data.records` (· Detail; edits · Fix · Merge) · `data.loads` (creates · Upload · Add by hand) · `data.quality` (· Checks) · `data.annotations` | P04 List · P11 every state, create and edit | 4 |
| Agents | `agents.agents` (· Detail · Outside; creates · New · Outside · Add; edits · Draft · Detail · Export) · `agents.runs` (· Detail: Answer · Thinking · Sessions · Compare) · `agents.schedules` (create · New) | P04 List · P12 every state, create and edit | 3 |
| Library | `agents.skills` (· Detail · Workflow; creates · New · Import · Add a library; edits · Author template · Detail · Draft · Detail · New draft · Detail · Add functions · Detail · Publish · Detail · Export) · `settings.plugins` (· Servers · Runtimes; creates · Servers · Add · Servers · Connect · Runtimes · Install) · `settings.packs` (create · Install) · `settings.connectors` | P04 List · P13 every state, create and edit | 4 |
| Settings · You & Invana | `settings.me` (· Connections · Owners; creates · New key · Connections · Connect) · `settings.notifications` (creates · New channel · New rule) · `settings.general` (· Appearance) | P04b List · P14 every state and create | 3 |
| Settings · Connections | `settings.databases` (· Detail; create · Connect · Shape · Files · Ready) · `settings.ai` (· Locked; create · New) · `settings.mcp` | P04b List · P14 every state and create | 3 |
| Settings · Operations | `settings.workers` (create · Add workers, the only step strip; edit · Edit rate limit) · `settings.workloads` · `settings.limits` (· Usage; edit · Edit limits) · `control.alerts` (· Detail · Settings; create · Settings · New) | P04b List · P15 every state, create and edit | 4 |
| Settings · Access | `settings.people` (People · Service users · Teams · Locked; creates · New person · New service user · Teams · New · Teams · Grant; edits · Deactivate · Export their data) · `settings.roles` · `settings.policies` (· Locked; creates · New · Attach; edit · Draft) · `settings.agent_access` (· Locked) · `access.usage` (· Locked) · `access.ledger` (· Locked; edit · Export) · `settings.history` (edit · Export) · `settings.keeping` (· Forget · Locked) | P04b List · P16 every state, create and edit | 8 |
| Reference designs | The 8 boards on the canvas before this project, unchanged (the Workbench as `ref.workbench.dc.html`) — reference, not coverage | P01 | 0 |
| **Total** | | | **56** |

Coverage diff (2026-11-15), every board in a story's `## Screens` or a `boards:` key against the phases' Boards lists, both ways: 56 boards · List phases 0 uncovered, 0 duplicated · state phases 0 uncovered, 0 duplicated · every create and edit a `## Screens` cell names in exactly one phase · 0 phase names absent from the specs.

## Rules for every session

| Rule | Detail |
|---|---|
| Draw by `design-story` | The skill is the procedure: §2 kit mapping, §3 layout, §4 standards, §4b mechanics, §5 checks 1 and 3 |
| Stories at `idea` are drawn | Ravi approved drawing every story at `idea` for this project. Statuses are not moved. No `task.md` rows: boards trace to stories by name, and the sticky under each row names the stories that cite it |
| The mirror is the canvas | `.design/canvas-invana/project/` (flat) is the working copy and the deliverable (D12). No session publishes to or reads the live artifact; sessions edit the mirror's files directly. This overrides `design-story` §4b and §6 (publish, live read; R396) |
| Who writes what | In `canvas.json` change only `pages`, boards, order and notes; keep every other key as it is. Sub-agents write their own board files; only the phase's lead edits `canvas.json` |
| Checks, on the mirror | `design-story` §5 step 1 · `python3 scripts/specs/check.py` · the link check: every `href` and `dc-import` in the mirror resolves to a file in the mirror, except `./support.js` (the artifact supplies it at publish; no session creates it) — done with `grep` or `python3` |
| Never stop | Nobody answers questions. A gap the spec does not settle: draw the reading `specs/design-language.md` and the D-decisions support, write it in the hand-off notes, raise a recommendation (`recommend`), go on. A component the kit lacks: compose the nearest kit components, raise a `component` recommendation, go on |
| Kit only, tokens only | Components from `InvanaUI` in the canvas's bundle; tokens only; 13 px base, 12 px meta; budgets in tokens, never currency; runs show pinned exact model versions |
| Leave the rest alone | Never edit *Reference designs* boards after P01, another page's boards, or a component outside P01 — a component change a page needs is a hand-off note and a recommendation, applied by the next phase that owns *Components* (none after P01: raise it). |
| No screenshots | `design-story` §5 step 2 is skipped: the canvas renders only live. Checks are *Checks, on the mirror* |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |

## Phases

### P01 · Foundation — reference page, kit, shell components, pages

| | |
|---|---|
| Agent | designer |
| Read | `.claude/skills/design-story/SKILL.md` · `specs/design-language.md` · `specs/glossary.md` · the mirror's `canvas.json`, its 8 reference boards and `ds/invana-kit/` |
| Stories | — |
| Done when | The mirror holds the 16 pages; the 8 reference boards sit on *Reference designs* (page `ref`), unchanged, the Workbench as `ref.workbench.dc.html` with its boards entry on `ref` and every order and link to it updated; the six shell components are on *Components*, each with props for every D1–D20 variant (modes, counts, lenses, theme, open dropdown, sheet); `Main.dc.html` is the new *Index* (one card per page), first in order; `explore.board` is drawn on *Explore* on the components, has data and failed, Admin and Operator, as the proof that the shell works; the link check and `check.py` pass |
| Lands | The mirror: `canvas.json` (pages, boards, order, notes) · `ShellHeader` · `ShellRail` · `ShellLeftSection` · `ShellFooter` · `SheetFrame` · `AssistantPanel` · `Main.dc.html` · `ref.workbench.dc.html` · `explore.board.dc.html` |
| Boards | explore.board |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Verify the mirror: `canvas.json`, the 16 pages, the 8 reference boards on `ref`, `ds/invana-kit/`. 2. Rename `Main.dc.html` (the Workbench) to `ref.workbench.dc.html`; keep its boards entry on `ref`; fix order and links. 3. Build the six components from the reference boards' chrome, as props. 4. Draw `explore.board` on them. 5. Write the new *Index* as `Main.dc.html`, first in order. 6. Link check; `check.py` |

### P02 · Name the missing boards

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/design-language.md` §2–§3, §8 · R394 in `.claude/team/agents-recommendations.md` · the features below |
| Stories | — |
| Done when | Every place `design-language.md` names has a board named in a story's `## Screens`: Explore › Boards list · Conversations · Dashboards · Queries; Model › Models · Kinds · Relationships · Standards (SE-F05) · Lenses (SE-F09, `explore.compare`); Projects › My tasks · Reviews; Library › Connectors (CP-F05) · Packs (AG-F08); Records › Loads (RC-F02); Settings › Invana General · Appearance · Limits (CP-F04) · Policies (AC-F02) · an agent's access (AC-F04) · History (AC-F06) · Personal connections (CP-F02). D7's placements are written where they govern (AG-F05 outside agents a filter of Agents; GP-F02 memory opens in Explore; AC-F11 under Connections). R394 done. `check.py` 0 errors |
| Lands | `specs/**` story `## Screens` tables and feature Decisions; `design-language.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. For each place, find the story that owns it; add its board to `## Screens` (`design-language.md` §7 naming). 2. A place with no owning story gets one at `idea`. 3. Write D7's placements. 4. Take up R394 and close it. 5. `check.py` |

### P03 · Prototype I — Shell, Sign-in & Home, Explore

| | |
|---|---|
| Agent | designer |
| Read | P01's and P02's hand-off notes · `design-story` · D11 · `specs/design-language.md` §7 · the stories citing each board |
| Stories | — |
| Done when | On the *Shell*, *Sign-in & Home* and *Explore* pages, every board below is drawn on the components in its List (has data · Admin), with its View, State and Lens switches present, and linked: the header's switcher, dropdowns and modes, Home → Explore (P01's `explore.board`), Explore's views on the leftNav, and every List to its Detail. Other states are not required yet |
| Lands | The mirror: 11 board files and `canvas.json` |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · shell.avatar.access · inbox.dropdown · access.signin · access.consent · start.home · explore.dashboards · graph.memory |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Shell and Home first (every other page links from them). 2. Explore. 3. Link check; `check.py` |

### P03b · Prototype I — Model, Projects

| | |
|---|---|
| Agent | designer |
| Read | P03's hand-off notes · `design-story` · D11 · `specs/design-language.md` §7 · the stories citing each board |
| Stories | — |
| Done when | On the *Model* and *Projects* pages, every board below is drawn on the components in its List (has data · Admin), with its View, State and Lens switches present, and linked: Explore → Model → Projects through the header's modes, each mode's views on the leftNav, and every List to its Detail. Other states are not required yet |
| Lands | The mirror: 14 board files and `canvas.json` |
| Boards | model.models · model.kinds · model.relationships · model.standards · model.taxonomies · model.rules · model.views · model.inference · model.health · projects.projects · projects.tasks · projects.branches · projects.report · projects.alerts |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Model. 2. Projects. 3. Link check; `check.py` |

### P04 · Prototype II — Inbox, Records, Agents, Library

| | |
|---|---|
| Agent | designer |
| Read | P03b's hand-off notes · `design-story` · D11 · the stories citing each board |
| Stories | — |
| Done when | Every board below is drawn in its sheet frame in its List (has data · Admin), with its View, State and Lens switches present, linked from the rail summoners, the sheet nav and the *Index* |
| Lands | The mirror: 12 board files and `canvas.json` |
| Boards | inbox · data.records · data.loads · data.quality · data.annotations · agents.agents · agents.runs · agents.schedules · agents.skills · settings.plugins · settings.packs · settings.connectors |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The sheets in rail order. 2. Link the *Index*. 3. Link check; `check.py` |

### P04b · Prototype II — Settings

| | |
|---|---|
| Agent | designer |
| Read | P04's hand-off notes · `design-story` · D11 · the stories citing each board |
| Stories | — |
| Done when | Every board below is drawn in its sheet frame in its List (has data · Admin), with its View, State and Lens switches present, linked from the avatar's Settings, the sheet nav and the *Index*; the whole canvas plays from *Index* to every page and back |
| Lands | The mirror: 18 board files and `canvas.json` |
| Boards | settings.me · settings.notifications · settings.general · settings.databases · settings.ai · settings.mcp · settings.workers · settings.workloads · settings.limits · control.alerts · settings.people · settings.roles · settings.policies · settings.agent_access · access.usage · access.ledger · settings.history · settings.keeping |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Settings, group by group: You & Invana · Connections · Operations · Access. 2. Link the *Index*. 3. Link check; `check.py` |

### P05 · Shell — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · D11 · CP-68 · CP-30 · CP-69 · CP-36 · CP-70 · AC-48 |
| Stories | — |
| Done when | Every board below has every view, overlay and state its stories' `## Screens` cells name, in both lenses; the components are untouched |
| Lands | The mirror: *Shell* page |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · shell.avatar.access · inbox.dropdown (with `· Confirm`) · and the edits: shell.access · Revoke |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Each board in turn: List states, then Detail, then overlays. 2. Row stickies. 3. Link check; `check.py` |

### P06 · Sign-in & Home — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · D11 · AC-F01 · AC-F11 · CP-22 · CP-24 · every story citing `access.signin · Sign in again` |
| Stories | — |
| Done when | As P05, for the boards below; `access.signin · Sign in again` is drawn once, over a dimmed generic sheet, with every state its citing stories name (checking, wrong password, SSO) |
| Lands | The mirror: *Sign-in & Home* page |
| Boards | access.signin · access.consent · start.home (with `· Set-up`) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P07 · Explore I — the board

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · D11 · EX-F01 – EX-F06 · GP-F01 · RC-13 · SE-10 · AG-50 and their stories |
| Stories | — |
| Done when | As P05, for `explore.board`: its leftSection views (`· Boards` · `· Conversations` · `· Queries`), `· Ask`, `· Left closed`, the overlays (`· Menu` · `· Why` · `· Chart` · `· Cannot` · `· Share` · `· Save derived`), the panels (`· Annotate` · `· Edit`), `· Console` and `· Present` |
| Lands | The mirror: *Explore* page |
| Boards | explore.board · and the edits: explore.board · Edit · explore.board · New conversation · explore.board · Fork from here · explore.board · Add to a project · explore.board · Share · Export |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P08 · Explore II — dashboards and memory

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · D11 · EX-34 · GP-F02 and its stories · AG-55 |
| Stories | — |
| Done when | As P05, for the boards below; `graph.memory` has the views Thinking · Lineage · Project map · Org knowledge |
| Lands | The mirror: *Explore* page |
| Boards | explore.dashboards · graph.memory · and the edits: explore.dashboards · Detail · Pin · New dashboard |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P09 · Model — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · SE-F01 – SE-F10 and their stories · the creates' stories: SE-F01 (SE-04 · SE-06 · SE-15) · SE-F05 (SE-17 · SE-18) · SE-F07 (SE-11 · SE-12) · SE-F08 (SE-22) · SE-F09 (SE-10) |
| Stories | — |
| Done when | As P05, for the boards below; `model.models` carries the map, `· Detail` (one model, its links, Comparing), `· Draft`, `· Publish`, `· Export` and `· Import`; `model.kinds · Detail` carries Properties · Meaning · Standards and `· Edit`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens |
| Lands | The mirror: *Model* page |
| Boards | model.models · model.kinds · model.relationships · model.standards · model.taxonomies · model.rules · model.views · model.inference · model.health · and the creates: model.models · New · model.standards · New · model.rules · New · model.views · New · model.inference · New · and the edits: model.models · Draft · model.models · Publish · model.models · Export · model.models · Import · model.kinds · Detail · Edit · model.views · Detail · Edit · model.standards · Write a standard |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P10 · Projects — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · PJ-F01 · PJ-F03 · PJ-F05 · PJ-F06 and their stories · the creates' stories: PJ-02 · PJ-12 · PJ-20 · PJ-23 · PJ-24 · PJ-06 |
| Stories | — |
| Done when | As P05, for the boards below; `projects.projects · Detail` carries the project's tabs and `· Assistant`; `projects.tasks` carries My tasks, `· Reviews` and a task's `· Detail · How it got here`; `projects.branches` carries the tree, `· Finding` and `· Decide`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens |
| Lands | The mirror: *Projects* page |
| Boards | projects.projects · projects.tasks · projects.branches · projects.report · projects.alerts · and the creates: projects.projects · New · projects.projects · Ask for help · projects.tasks · New · projects.branches · Finding · New · and the edits: projects.report · Edit · projects.branches · Fork · projects.branches · Merge · projects.branches · Decide |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P11 · Inbox and Records — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · CP-F08 · AC-F05 · RC-F01 – RC-F07 and their stories · the creates' stories: RC-08 · RC-11 |
| Stories | — |
| Done when | As P05, for the boards below; `data.records` carries a record's `· Detail`, `· Fix` and `· Merge`; `data.quality` carries `· Checks`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens |
| Lands | The mirror: *Inbox* and *Records* pages |
| Boards | inbox · data.records · data.loads · data.quality · data.annotations · and the creates: data.loads · Upload · data.loads · Add by hand · and the edits: data.records · Fix · data.records · Merge |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P12 · Agents — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · AG-F01 · AG-F02 · AG-F05 · AG-F07 · AG-F10 · CP-F10 and their stories · the creates' stories: AG-21 · AG-26 · AG-33 · AG-42 |
| Stories | — |
| Done when | As P05, for the boards below; outside agents are the `· Outside` filter of `agents.agents` (D7); `agents.runs · Detail` carries `· Answer`, `· Thinking`, Sessions and `· Compare`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens; `agents.agents · New` carries the assistant's draft (AG-26); `agents.schedules · New` shows *Confirm Allow* as a section, never a second modal |
| Lands | The mirror: *Agents* page |
| Boards | agents.agents · agents.runs · agents.schedules · and the creates: agents.agents · New · agents.agents · Outside · Add · agents.schedules · New · and the edits: agents.agents · Draft · agents.agents · Detail · Export |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P13 · Library — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · AG-F04 · AG-F06 · AG-F08 · AG-F09 · CP-F02 · CP-F05 · CP-F06 and their stories · the creates' stories: AG-37 · AG-39 · AG-40 · AG-63 · CP-02 · CP-20 · CP-62 · CP-64 |
| Stories | — |
| Done when | As P05, for the boards below; every item shows *Used by n agents*; `agents.skills` carries skills, workflows (`· Workflow`), functions and answer templates; `settings.plugins` carries `· Servers` and `· Runtimes`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens; `agents.skills · Import` lists what came in before *Import n* |
| Lands | The mirror: *Library* page |
| Boards | agents.skills · settings.plugins · settings.packs · settings.connectors · and the creates: agents.skills · New · agents.skills · Import · agents.skills · Add a library · settings.plugins · Servers · Add · settings.plugins · Servers · Connect · settings.plugins · Runtimes · Install · settings.packs · Install · and the edits: agents.skills · Author template · agents.skills · Detail · Draft · agents.skills · Detail · New draft · agents.skills · Detail · Add functions · agents.skills · Detail · Publish · agents.skills · Detail · Export |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P14 · Settings — You, Invana and Connections

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · AC-F01 · AC-F07 · AC-F10 · AC-F11 · CP-F01 · CP-F02 · CP-F05 · CP-F07 · CP-F08 and their stories · the creates' stories: CP-17 · CP-22 · CP-25 · CP-26 · CP-27 · CP-01 · AC-10 · CP-43 · CP-37 · CP-45 |
| Stories | — |
| Done when | As P05, for the boards below; `settings.me` carries `· Connections` and `· Owners`; `settings.general` carries `· Appearance`; `settings.databases` carries `· Detail`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens; a key's secret shows once in the same modal |
| Lands | The mirror: *Settings · You & Invana* and *Settings · Connections* pages |
| Boards | settings.me · settings.notifications · settings.general · settings.databases · settings.ai · settings.mcp · and the creates: settings.databases · Connect (· Shape · Files · Ready) · settings.ai · New · settings.me · New key · settings.me · Connections · Connect · settings.notifications · New channel · settings.notifications · New rule |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P15 · Settings — Operations

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · CP-F03 · CP-F04 · CP-F09 · CP-F11 and their stories · the creates' stories: CP-10 · CP-60 |
| Stories | — |
| Done when | As P05, for the boards below; `settings.limits` carries `· Usage`; `control.alerts` carries `· Detail` and `· Settings`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens; `settings.workers · Add workers` is the 720 px step-strip modal — Where · Group · Join key · Run it · Joined — and the only step strip on the canvas (D10) |
| Lands | The mirror: *Settings · Operations* page |
| Boards | settings.workers · settings.workloads · settings.limits · control.alerts · and the creates: settings.workers · Add workers · control.alerts · Settings · New · and the edits: settings.workers · Edit rate limit · settings.limits · Edit limits |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P16 · Settings — Access

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · `specs/design-language.md` §3 *Overlays* · D10 · D11 · AC-F02 – AC-F12 and their stories · the creates' stories: AC-18 · AC-04 · AC-06 · AC-11 · AC-09 · AC-33 · AC-39 |
| Stories | — |
| Done when | As P05, for the boards below; every Operator reading the stories name is the board's Operator lens (`· Locked`); `settings.people` carries People, Service users, `· Teams` and `· Export their data`; `settings.keeping` carries `· Forget`. Its creates (D10) are modal states drawn over their board — numbered sections that open in order and one filled act; each create's State switch runs through every section and state its stories' `## Screens` name — each section reached, the validation error on its field, working (testing · reading · counting), done — in both lenses, the Operator's as its *Who can* row says; the board's create act links to the modal and done links to what opens; a create that changes access shows who it changes before Save, then `access.signin · Sign in again`, then saved or *Waiting for a second Admin* where its story names it |
| Lands | The mirror: *Settings · Access* page |
| Boards | settings.people · settings.roles · settings.policies · settings.agent_access · access.usage · access.ledger · settings.history · settings.keeping · and the creates: settings.people · New person · settings.people · New service user · settings.people · Teams · New · settings.people · Teams · Grant · settings.policies · New · settings.policies · Attach · and the edits: settings.policies · Draft · settings.people · Deactivate · settings.people · Export their data · access.ledger · Export · settings.history · Export |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P17 · Audit — every board drawn, every link resolves

| | |
|---|---|
| Agent | qa |
| Read | This file · D11 · `design-story` §3–§5 · `specs/design-language.md` §7 · the local mirror `.design/canvas-invana/project/` |
| Stories | — |
| Done when | A report `.agent-reports/qa/design-redesign-P17.md` lists: every board a story names and whether it is in the mirror; every view, overlay and state a `## Screens` cell names (`<board> · <view> · <state>`) that its board's switches cannot reach; every `href` and `dc-import` that does not resolve; every board that copies shell markup instead of the components; every board missing a View, State or Lens switch; every create (D10) whose State switch misses a section, its validation error or done, or whose board's act does not link to it; hex colours or non-kit look-alikes. Each gap is a recommendation |
| Lands | The report and recommendations |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List cited boards and states from every `## Screens`. 2. Compare with the mirror. 3. Scan links, imports, switches, tokens. 4. Report; recommendations. 5. Link check; `check.py` |

## After the audit

Not a runner phase (D12). Once P17 is done, the project-lead publishes the whole mirror `.design/canvas-invana/project/`
to `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`, merging anything newer on the live canvas than `1794697037-3af0`
first, then reports to Ravi, who reviews the published canvas.

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Foundation — reference page, kit, shell components, pages |  | done | 2026-11-15 | gates green · reviews passed |
| P02 | Name the missing boards | P01 | done | 2026-11-15 | gates green · reviews passed |
| P03 | Prototype I — Shell, Sign-in & Home, Explore | P02 | done | 2026-11-15 | gates green · reviews passed |
| P03b | Prototype I — Model, Projects | P03 | done | 2026-11-15 | gates green · reviews passed |
| P04 | Prototype II — Inbox, Records, Agents, Library | P03b | done | 2026-11-15 | gates green · reviews passed |
| P04b | Prototype II — Settings | P04 | done | 2026-11-15 | gates green · reviews passed |
| P05 | Shell — every state and lens | P04b | done | 2026-11-15 | gates green · reviews passed |
| P06 | Sign-in & Home — every state and lens | P05 | done | 2026-11-15 | gates green · reviews passed |
| P07 | Explore I — the board | P06 | done | 2026-11-15 | gates green · reviews passed |
| P08 | Explore II — dashboards and memory | P07 | done | 2026-11-15 | gates green · reviews passed |
| P09 | Model — every state and lens | P08 | done | 2026-11-15 | gates green · reviews passed |
| P10 | Projects — every state and lens | P09 | done | 2026-11-15 | gates green · reviews passed |
| P11 | Inbox and Records — every state and lens | P10 | done | 2026-11-15 | gates green · reviews passed |
| P12 | Agents — every state and lens | P11 | done | 2026-11-15 | gates green · reviews passed |
| P13 | Library — every state and lens | P12 | pending |  |  |
| P14 | Settings — You, Invana and Connections | P13 | pending |  |  |
| P15 | Settings — Operations | P14 | pending |  |  |
| P16 | Settings — Access | P15 | pending |  |  |
| P17 | Audit — every board drawn, every link resolves | P16 | pending |  |  |

## Hand-off notes

What a later phase must know that the canvas does not say. One row per note, newest last.

| ID | Note |
|---|---|
| H1 | The creates in P09–P16 (D10, product-manager 2026-11-15): each create board's states are named in its stories' `## Screens`, step rows reading `<create> · <n> <section>`. A create board mounts a dimmed copy of its parent, drawn by the place phase, and never edits it. P03 drew `model.new` (has data · Admin) as a parent; P17 owns its every state. If `InvanaUI` has no step strip or numbered-section component, compose the nearest kit parts and raise a `component` recommendation |
| H2 | D11 (product-manager 2026-11-15): 151 boards became 56. Every retired name now reads `<board> · <view or overlay> · <state>` in the stories' `## Screens`. H1's create boards are states of their feature's board (D10), drawn by the place phase that owns the board (P09–P16); the create phases are gone and the audit is P17 |

## Questions for Ravi

The project-lead's, batched. Answered rows stay until the phase they unblock is done.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-15 | P01, P03–P06 | Designer sessions cannot reach the canvas (no `Artifact` tool in headless runs); P01, P03–P05 were logged done with nothing drawn. How do we unblock? | (a) grant runner designer sessions Artifact read/list/publish (R395) · (b) draw interactively in a session you start, then run the rest · (c) park the project | (a), then reset P01 and P03–P06 to pending and restart | (a) — Ravi, 2026-11-15; waits on the run.py edit (R403) |
| 2026-11-15 | P09–P16 | What shape is a "wizard"? | (a) one-page modal with numbered sections, step strip only for Add workers · (b) step strip everywhere · (c) step strip for 4+ sections | (a) | (a) — Ravi, 2026-11-15 |
| 2026-11-15 | P16 | New person in Studio (AC-18) | (a) Admin sets a first password, no email · (b) invite by email · (c) drop | (a) | (a) — Ravi, 2026-11-15 |
| 2026-11-15 | P13 | New skill is a modal (AG-37) | (a) keep the modal · (b) revert | (a) | (a) — Ravi, 2026-11-15 |
