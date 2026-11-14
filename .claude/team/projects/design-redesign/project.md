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
| D1 | One canvas: *Invana design* — `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. One page per place in the app, one board per named surface (`design-story` §3, §4b) |
| D2 | Pages, in this order: *Index* · *Components* · *Shell* · *Sign-in & Home* · *Explore* · *Model* · *Projects* · *Inbox* · *Records* · *Agents* · *Library* · *Settings · You & Invana* · *Settings · Connections* · *Settings · Operations* · *Settings · Access* · *Reference designs* |
| D3 | Boards are Full HD, 1920×1080; the leftSection is 260 px by default; the assistant is 420 px |
| D4 | The shell is components on the *Components* page — `ShellHeader` · `ShellRail` · `ShellLeftSection` · `ShellFooter` · `SheetFrame` · `AssistantPanel` — mounted by every board with `<dc-import>`; no board copies shell markup |
| D5 | The 8 boards on the canvas today (Workbench, 1 Welcome … 7 Access dropdown) move to *Reference designs* unchanged. `Main.dc.html` becomes the *Index* board; the Workbench keeps its content as `ref.workbench.dc.html` |
| D6 | The canvas's kit bundle (`project/ds/invana-kit/`) is refreshed from the design-kit artifact `https://claude.ai/artifact/PovTcmwPkgKDrxdrcA5TBD` in P01 |
| D7 | Placements: the memory graphs (GP-F02 `graph.memory.*`) on *Explore*; outside agents (AG-F05) a filter of the Agents list, on *Agents*; MCP server (AC-F11 `settings.mcp`) under Settings › Connections; `control.alerts*` on *Settings · Operations*; `agents.skills` · `agents.skill` · `settings.plugins*` on *Library* |
| D8 | Whole app first: P03–P04 draw the parent board of every row (has data · Admin) linked end to end; P05–P16 then draw every variant, state and lens, page by page |
| D9 | Only P01 waits for Ravi's review. Every other phase is approved on its gates; no QA review |

## Rules for every session

| Rule | Detail |
|---|---|
| Draw by `design-story` | The skill is the procedure: §2 kit mapping, §3 layout, §4 standards, §4b mechanics, §5 checks 1 and 3 |
| Stories at `idea` are drawn | Ravi approved drawing every story at `idea` for this project. Statuses are not moved. No `task.md` rows: boards trace to stories by name, and the sticky under each row names the stories that cite it |
| The local mirror | `.design/canvas-invana/project/` (flat). Before editing, `read` the live `canvas.json` and every file you will change into it; publish from it with `root` `.design/canvas-invana` and only the changed files; send `canvas.json` only when the layout changes, re-read right before. On a refused publish, re-read what it names and redo the edit |
| One publisher | Only the phase's lead publishes. Sub-agents write board files into the mirror, each its own files; the lead publishes once they are done |
| Never stop | Nobody answers questions. A gap the spec does not settle: draw the reading `specs/design-language.md` and the D-decisions support, write it in the hand-off notes, raise a recommendation (`recommend`), go on. A component the kit lacks: compose the nearest kit components, raise a `component` recommendation, go on |
| Kit only, tokens only | Components from `InvanaUI` in the canvas's bundle; tokens only; 13 px base, 12 px meta; budgets in tokens, never currency; runs show pinned exact model versions |
| Leave the rest alone | Never edit *Reference designs* boards after P01, another page's boards, or a component outside P01 — a component change a page needs is a hand-off note and a recommendation, applied by the next phase that owns *Components* (none after P01: raise it) |
| No screenshots | `design-story` §5 step 2 is skipped: the canvas renders only live. Checks are §5 steps 1 and 3 and the link check in *Gates* |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |

## Phases

### P01 · Foundation — reference page, kit, shell components, pages

| | |
|---|---|
| Agent | designer |
| Read | `.claude/skills/design-story/SKILL.md` · `specs/design-language.md` · `specs/glossary.md` · the canvas's `canvas.json` and its 8 boards · the design-kit artifact's README and file list |
| Stories | — |
| Done when | The 8 current boards sit on *Reference designs*, unchanged; the kit bundle is the design-kit artifact's current one; the six shell components are on *Components*, each with props for every D1–D20 variant (modes, counts, lenses, theme, open dropdown, sheet); the 16 pages exist; `Main.dc.html` is the *Index* (one card per page); `explore.board` is drawn on *Explore* on the components, has data and failed, Admin and Operator, as the proof that the shell works |
| Lands | The canvas: `canvas.json` (pages, boards, notes) · `ShellHeader` · `ShellRail` · `ShellLeftSection` · `ShellFooter` · `SheetFrame` · `AssistantPanel` · `Main.dc.html` · `ref.workbench.dc.html` · `explore.board.dc.html` · `project/ds/invana-kit/**` |
| Boards | explore.board |
| Review | |
| Approve | Ravi — reviews the shell components, the page layout and `explore.board` before anything else is drawn |
| Budget | |
| Steps | 1. Mirror the live canvas into `.design/canvas-invana/project/`. 2. Add the 16 pages; move the 8 boards to *Reference designs* (Workbench → `ref.workbench.dc.html`). 3. Refresh the kit bundle from the design-kit artifact (server copy of its published files). 4. Build the six components from the reference boards' chrome, as props. 5. Draw `explore.board` on them. 6. Draw the *Index*. 7. Publish; `check.py` |

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

### P03 · Prototype I — Shell, Sign-in & Home, Explore, Model, Projects

| | |
|---|---|
| Agent | designer |
| Read | P01's and P02's hand-off notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | On each of the five pages, the parent board of every row (has data · Admin) is drawn on the components and linked: the header's switcher, dropdowns and modes, Home → Explore → Model → Projects, and every row's parent to the boards it opens. Variants and other states are not required yet |
| Lands | The canvas: about 20 board files and `canvas.json` |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · inbox.dropdown · access.signin · start.home · explore.ask · explore.share · model.board · model.new · model.meaning · model.rules · model.taxonomies · model.inference · model.health · projects.list · projects.project · projects.task · projects.report · and the P02 boards for these pages |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Shell and Home first (every other page links from them). 2. Explore, Model, Projects. 3. Link check. 4. Publish; `check.py` |

### P04 · Prototype II — Inbox, Records, Agents, Library, Settings

| | |
|---|---|
| Agent | designer |
| Read | P03's hand-off notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | The parent board of every row on *Inbox*, *Records*, *Agents*, *Library* and the four *Settings* pages is drawn (has data · Admin), in its sheet frame, linked from the rail summoners and the *Index*; the whole canvas plays from *Index* to every page and back |
| Lands | The canvas: about 25 board files and `canvas.json` |
| Boards | inbox · data.records · data.record · data.quality · data.annotations · agents.agent · agents.runs · agents.run · agents.schedules · agents.skills · settings.plugins · settings.me · settings.notifications · settings.databases · settings.ai · settings.mcp · settings.workers · settings.workloads · control.alerts · settings.people · settings.roles · settings.access · and the P02 boards for these pages |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The sheets in rail order. 2. Settings, group by group. 3. Link the *Index*. 4. Link check. 5. Publish; `check.py` |

### P05 · Shell — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · CP-68 · CP-30 · CP-69 · CP-36 · CP-70 · AC-48 |
| Stories | — |
| Done when | Every board below has every state its stories name, both lenses, its overlays on its row; the components are untouched |
| Lands | The canvas: *Shell* page |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · shell.avatar.access · inbox.dropdown · inbox.dropdown.confirm |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Each row in turn: parent states, then variants and overlays. 2. Row stickies. 3. Publish; `check.py` |

### P06 · Sign-in & Home — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · AC-F01 · AC-F11 · CP-22 · CP-24 · the stories citing `access.locked` and `access.sign_in_again` |
| Stories | — |
| Done when | As P05, for the boards below; `access.locked` and `access.sign_in_again` show the refusal and re-authentication every citing story names, as one board each with a variant switch |
| Lands | The canvas: *Sign-in & Home* page |
| Boards | access.signin · access.locked · access.sign_in_again · access.consent · start.setup · start.home |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P07 · Explore I — ask and the board

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · EX-F01 – EX-F06 and their stories |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Explore* page |
| Boards | explore.ask · explore.board · explore.board.annotate · explore.board.cannot · explore.board.chart · explore.board.console · explore.board.edit · explore.board.left_closed · explore.board.menu · explore.board.present · explore.board.save_derived · explore.board.why · explore.share |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P08 · Explore II — views, compare and memory

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · GP-F02 and its stories · SE-F09 · the stories P02 named for Explore's views |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Explore* page |
| Boards | graph.memory.lineage · graph.memory.org_knowledge · graph.memory.project_map · explore.compare · and P02's Explore boards (Boards list · Conversations · Dashboards · Queries) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P09 · Model — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · SE-F01 – SE-F10 and their stories |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Model* page |
| Boards | model.board · model.board.kind · model.board.draft · model.board.draft.publish · model.new · model.meaning · model.rules · model.taxonomies · model.inference · model.health · and P02's Model boards (Models · Kinds · Relationships · Standards · Lenses) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P10 · Projects — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · PJ-F01 · PJ-F03 · PJ-F05 · PJ-F06 and their stories |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Projects* page |
| Boards | projects.list · projects.new · projects.project · projects.task · projects.task.thinking · projects.decide · projects.finding · projects.options · projects.report · projects.alerts · projects.asks.create · projects.ask_help · projects.assistant · and P02's Projects boards (My tasks · Reviews) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P11 · Inbox and Records — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · CP-F08 · AC-F06 · RC-F01 – RC-F07 and their stories |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Inbox* and *Records* pages |
| Boards | inbox · inbox.history · data.records · data.record · data.upload · data.collect · data.checks · data.quality · data.fix · data.merge · data.annotations · and P02's Records board (Loads) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P12 · Agents — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · AG-F01 · AG-F05 – AG-F07 · AG-F09 · AG-F10 · CP-F10 and their stories |
| Stories | — |
| Done when | As P05, for the boards below; outside agents are a filter of the Agents list (D7) |
| Lands | The canvas: *Agents* page |
| Boards | agents.agent · agents.new · agents.runs · agents.run · agents.run.answer · agents.run.thinking · agents.schedules · agents.workflow · agents.external · agents.thinking |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P13 · Library — every state and lens

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · AG-F04 · AG-F08 · CP-F02 · CP-F05 · CP-F06 and their stories |
| Stories | — |
| Done when | As P05, for the boards below; every item shows *Used by n agents* |
| Lands | The canvas: *Library* page |
| Boards | agents.skills · agents.skill · settings.plugins · settings.plugins.server · and P02's Library boards (Connectors · Packs) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P14 · Settings — You, Invana and Connections

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · AC-F01 · CP-F01 · CP-F02 · CP-F05 · CP-F08 · AC-F11 and their stories |
| Stories | — |
| Done when | As P05, for the boards below; create flows are one-page modals with numbered sections (D17) |
| Lands | The canvas: *Settings · You & Invana* and *Settings · Connections* pages |
| Boards | settings.me · settings.notifications · settings.ai · settings.mcp · settings.databases · settings.databases.database · settings.databases.connect · settings.databases.connect.shape · settings.databases.connect.files · settings.databases.connect.ready · and P02's boards (General · Appearance · Personal connections) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P15 · Settings — Operations

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · CP-F03 · CP-F04 · CP-F09 · CP-F11 and their stories |
| Stories | — |
| Done when | As P05, for the boards below; Add workers is the 720 px step-strip modal (D17) |
| Lands | The canvas: *Settings · Operations* page |
| Boards | settings.workers · settings.workloads · settings.usage · control.alerts · control.alerts.alert · control.alerts.settings · and P02's board (Limits) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P16 · Settings — Access

| | |
|---|---|
| Agent | designer |
| Read | `design-story` · AC-F02 – AC-F12 and their stories |
| Stories | — |
| Done when | As P05, for the boards below |
| Lands | The canvas: *Settings · Access* page |
| Boards | settings.people · settings.roles · settings.access · settings.keeping · access.ledger · access.owners · access.forget · access.subject_export · access.usage · and P02's boards (Policies · an agent's access · History) |
| Review | |
| Approve | |
| Budget | |
| Steps | As P05 |

### P17 · Audit — every board drawn, every link resolves

| | |
|---|---|
| Agent | qa |
| Read | This file · `design-story` §3–§5 · the local mirror `.design/canvas-invana/project/` |
| Stories | — |
| Done when | A report `.agent-reports/qa/design-redesign-P17.md` lists: every board a story names and whether it is in the mirror; every `href` and `dc-import` that does not resolve; every board that copies shell markup instead of the components; every board missing a State or Lens switch; hex colours or non-kit look-alikes. Each gap is a recommendation |
| Lands | The report and recommendations |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List cited boards from every `## Screens`. 2. Compare with the mirror. 3. Scan links, imports, switches, tokens. 4. Report; recommendations |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Foundation — reference page, kit, shell components, pages |  | in progress | 2026-11-15 |  |
| P02 | Name the missing boards | P01 | pending |  |  |
| P03 | Prototype I — Shell, Sign-in & Home, Explore, Model, Projects | P02 | pending |  |  |
| P04 | Prototype II — Inbox, Records, Agents, Library, Settings | P03 | pending |  |  |
| P05 | Shell — every state and lens | P04 | pending |  |  |
| P06 | Sign-in & Home — every state and lens | P05 | pending |  |  |
| P07 | Explore I — ask and the board | P06 | pending |  |  |
| P08 | Explore II — views, compare and memory | P07 | pending |  |  |
| P09 | Model — every state and lens | P08 | pending |  |  |
| P10 | Projects — every state and lens | P09 | pending |  |  |
| P11 | Inbox and Records — every state and lens | P10 | pending |  |  |
| P12 | Agents — every state and lens | P11 | pending |  |  |
| P13 | Library — every state and lens | P12 | pending |  |  |
| P14 | Settings — You, Invana and Connections | P13 | pending |  |  |
| P15 | Settings — Operations | P14 | pending |  |  |
| P16 | Settings — Access | P15 | pending |  |  |
| P17 | Audit — every board drawn, every link resolves | P16 | pending |  |  |

## Hand-off notes

What a later phase must know that the canvas does not say. One row per note, newest last.

| ID | Note |
|---|---|

## Questions for Ravi

The project-lead's, batched. Answered rows stay until the phase they unblock is done.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
