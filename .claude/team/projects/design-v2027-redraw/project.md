---
name: design-v2027-redraw
status: running
branch: design-redesign/P17-audit-every-board-drawn-every-link-resol
scope: design-v2027-redraw
artifact_publish: auto approve
---

# Design — redraw Invana v2027.11.0 in full, on the approved navigation

Redraw the *Invana v2027.11.0 design* canvas so every leftNav view of the four modes and every section of the large
modal has its board, on the new shell (flat labelled nav, mode in the wordmark, Agents · Access · Settings summoners,
one large modal), matching `specs/design-language.md` and the approved proposal canvas.

| | |
|---|---|
| Goal | One board per leftNav view (Explore · Model · Graph Data · Projects · Agents) and per large-modal section (Agents glance · Access · Settings · About), plus the header's switcher and dropdowns, Sign-in and Home — 61 boards on 12 pages, drawn on six shared shell components, every state its stories name, both lenses, linked end to end |
| Specs | `specs/design-language.md` §1–§8 · `specs/glossary.md` · every story whose `## Screens` cites a board below — traced by board name |
| Not in this project | Studio or engine code · story statuses · design-kit or canvas repo code (a missing component is a recommendation) · the proposal canvas and the Invana Products canvas (reference only, never edited) |

Run it: `python3 .claude/skills/run-project/run.py design-v2027-redraw` (the project-lead does, with `--start`).

## References

| What | Where | Use it for |
|---|---|---|
| The canvas | `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` — mirror `.design/canvas-invana/project/` (seeded from live version `1794727248-917f`, identical on 2026-11-16) | The deliverable |
| The review artifact | `https://claude.ai/artifact/VhXDTAAHV7z4hCRJuQEHHD` — holds the mirror after P01 (version 2). Never `PgtkC6KygGZz2u8fYq1LWX` | The one artifact a session may publish the mirror to, under the rule *Artifacts: read freely, publish only on Ravi's word* |
| The approved proposal | `https://claude.ai/artifact/Fjfg52oUYZQDryQanykk9m` v21 — generators `.design/canvas-nav-proposals/b_nav.py` (page B: nav, left content, large modal, dropdowns) · `c_iam.py` (page C: Access Policies, New policy, project access and team, New project wizard) · `d_modes.py` (page D: Agents mode, glance, tuning in the frame, Settings › Workers); every v21 board (pages A–D) synced into `.design/canvas-nav-proposals/project/` on 2026-11-16 — read boards there, never the live artifact | The shell, the nav and every board it already drew — port the markup, never re-invent it |
| The previous version | *Invana Products* `https://claude.ai/artifact/HcPfkMUYUtEbRaZFaYnHtg` (352 boards, 13 pages) — generators `.design/canvas-products/p_*.py`, boards in `.design/canvas-products/project/`, each board's page in that folder's `canvas.json`. Read only — never edited or published | Main-area content: Modeller → Model · Datasets → Graph Data · Agent Builder → Agents · Activity → Runs and Record · IAM → Access · Fleet → Settings › Fleet and Workers |

## Rules for every session

| Rule | Detail |
|---|---|
| Draw by `design-story` | The skill is the procedure — §2 kit mapping, §3 layout, §4 standards incl. *Simple by default — never overdo it*, §4b mechanics, §5 checks 1 and 3 |
| One board per place | A board is one leftNav view, one large-modal section, a header dropdown or a page outside the shell. Its creates, edits, confirms, peeks, empty and error states are switches on it (View · State · Lens), never boards of their own; the Operator's reading is its Operator lens |
| Spec decides, references inform | `specs/` — `design-language.md`, `glossary.md`, each story's `## Screens` and criteria — settles every conflict. Then the proposal canvas (shell, nav, large modal, Access, Agents mode). Then *Invana Products*, a reference for main-area content and component choices only — never a decision. A conflict found is a hand-off note naming what the spec chose |
| Port, don't redraw | Port markup only from the proposal canvas and the current v2027.11.0 canvas — both already follow the spec — onto the new components, changing only what the specs changed. *Invana Products* is never ported |
| Look at Invana Products first | Before drawing a page, review the phase's pinned *Invana Products* pages for ideas — content worth showing, a layout, a state, an empty or error line, a component choice. Take an idea by redrawing it on the new shell, in the spec's words, cut to §4 *Simple by default*; never copy its markup or its retired patterns (Graphs as objects, roles, sheets, product pages) |
| Read the list, open only the closest boards | Read the Products page's board titles in `.design/canvas-products/project/canvas.json`, then open only the 3–5 boards nearest the board being drawn — never a whole page |
| Say what came from Products | Each phase writes hand-off notes: one line per Products idea taken (board → where it landed) and one per idea rejected because the spec differs |
| Stories at `idea` are drawn | Statuses are not moved; no `task.md` rows — boards trace to stories by name |
| The mirror is the deliverable | Sessions edit `.design/canvas-invana/project/` only. The live canvas `PgtkC6KygGZz2u8fYq1LWX` is never published by a session — Ravi publishes it after P09 |
| Artifacts: read freely, publish only on Ravi's word | Any session may read an artifact (Artifact `read`). It may publish the mirror — to the *review artifact* in References and no other — only when this file's header says `artifact_publish: approved` or `artifact_publish: auto approve`, set by Ravi. `off`, missing, or no review URL in References: never publish or update any artifact. Read the header each session; never change it |
| Who writes `canvas.json` | Only the phase's lead; change only `pages`, `boards`, `order` and `notes`, keep every other key |
| Board ids stay | Keep the ids the specs cite (`settings.people` stays though it is drawn under Access › Who); the board's title says where it lives |
| Never stop | A gap the spec does not settle: draw what `design-language.md` supports, write a hand-off note, raise a recommendation (`recommend`), go on. A component the kit lacks: compose the nearest kit components, raise a `component` recommendation, go on |
| Kit only, tokens only | `InvanaUI` from the mirror's bundle; tokens only; budgets in tokens, never currency; runs show exact model versions; results from different graph databases side by side, never joined |
| Leave the rest alone | Never edit another phase's boards or the components after P01 — a component change is a hand-off note and a recommendation |
| Render check | Before a phase is done, every board it touched renders with no page error: `cd .design/canvas-nav-proposals/harness && node shot.mjs ../../canvas-invana/project <out> <board>.dc.html` |
| Publish at phase end | After the render check and the gates pass, the phase's lead publishes the mirror to the *review artifact* (under *Artifacts: read freely, publish only on Ravi's word*): 1. Artifact `read` of its URL first. 2. Artifact `publish` with `url` = the review artifact, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each board it removed. Never send `index.html`, `SKILL.md` or the artifact type's own files |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 .design/canvas-invana/linkcheck.py` | `.` | all | |

## Phases

### P01 · Foundation — pages, shell components, Index

| | |
|---|---|
| Agent | designer |
| Read | `.claude/skills/design-story/SKILL.md` · `specs/design-language.md` §1–§3 · the mirror's `canvas.json` and its six components · `b_nav.py` and `d_modes.py` (nav, collapsed nav, large modal, dropdown anchors) |
| Stories | — |
| Done when | The mirror has the 12 pages in this order: Index · Components · Shell · Sign-in & Home · Explore · Model · Model · Graph Data · Projects · Agents · Large modal · Agents & Inbox · Large modal · Access · Large modal · Settings. *Reference designs* and its 8 boards are removed. Components: `ShellHeader` (☰ Invana {Mode} ▾, four modes) · `ShellNav` (replaces `ShellRail`: search, the mode's flat views with counts and groups, Agents · Access · Settings at the foot, collapsed state with dots) · `ShellLeftSection` (280 px) · `ShellFooter` · `AssistantPanel` · `LargeModal` (replaces `SheetFrame`: 64 px inset, 260 px grouped nav Agents · Access · Settings · About, path, one act, ✦, Esc), each with props for every variant. Every existing board's `dc-import` of `ShellRail`/`SheetFrame` is repointed so the mirror renders. `Main.dc.html` is the Index — one card per page, every board listed |
| Lands | The mirror: `canvas.json` · the six components · `Main.dc.html` · the `dc-import` lines of existing boards |
| Boards | — |
| Review | |
| Approve | Ravi — the shell decides every later board |
| Budget | |
| Steps | 1. Pages and the removal of *Reference designs*. 2. Port page B/D's nav, collapsed nav and large modal into the components. 3. Repoint every board's imports; links. 4. Index. 5. Render-check the components and three boards; gates |

### P02 · Shell, Sign-in & Home, Explore

| | |
|---|---|
| Agent | designer |
| Read | P01's hand-off notes · `design-story` · `b_nav.py` (switcher, dropdowns, Explore) · Products pages *Invana Explorer*, *In every product*, *Invana Home* · the stories citing each board |
| Stories | — |
| Done when | Each board below is drawn on the components with every state its stories' `## Screens` cells name, both lenses, linked: switcher to every mode and ⌘4, Operations to Agents › Runs and Settings › Workers, Access dropdown to Access › Now and Record, Inbox dropdown to the full Inbox, Explore's four views from the nav. `explore.board` shows answers from different graph databases side by side; the avatar menu shows the person's policies, no role |
| Lands | The mirror: 14 board files and `canvas.json` |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · shell.avatar.access · inbox.dropdown · access.signin · access.consent · start.home · explore.board · explore.conversations (new) · explore.dashboards · explore.queries (new) · graph.memory |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Shell. 2. Sign-in & Home. 3. Explore. 4. Render check; gates |

### P03 · Model and Graph Data

| | |
|---|---|
| Agent | designer |
| Read | P02's hand-off notes · `design-story` · `b_nav.py` (Model, Browse by kind, B16 expanded Model) · Products pages *Invana Modeller* and *Invana Datasets* · the stories citing each board |
| Stories | — |
| Done when | Model's seven views and Graph Data's four are drawn in the Model mode, each from its own leftSection, every state its stories name, both lenses. `model.models` holds the models tree with Kinds, Relationships and *Links between models* (within one graph database) and the model map; a kind and a relationship open in main as its states — `model.kinds` and `model.relationships` are removed and every link to them repointed. `model.health` shows query advice; `data.records` lists one graph database at a time with a Withheld state |
| Lands | The mirror: 11 board files, two removed, `canvas.json` |
| Boards | model.models · model.standards · model.health · model.rules · model.views · model.taxonomies · model.inference · data.records · data.loads · data.quality · data.annotations |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Model. 2. Graph Data (sheets become Model views). 3. Remove `model.kinds`/`model.relationships`, repoint links. 4. Render check; gates |

### P04 · Projects

| | |
|---|---|
| Agent | designer |
| Read | P03's hand-off notes · `design-story` · `c_iam.py` and its synced boards `c.project.wizard` · `c.project.access` · `c.project.team` · `c.project.ask` · `b.projects` · `b.expanded.projects` · Products page *Invana Projects (experimental)* · the stories citing each board |
| Stories | — |
| Done when | Projects' four views and its three project tabs are drawn with every state their stories name, both lenses. `projects.projects` carries the New project wizard (About · Goals · Access · Team · Review) and a Team tab with one Lead agent and no human roles; `projects.schedules` is the one Schedules list filtered to projects |
| Lands | The mirror: 7 board files and `canvas.json` |
| Boards | projects.projects · projects.tasks · projects.reviews (new) · projects.schedules (new) · projects.branches · projects.report · projects.alerts |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The four views. 2. The project tabs. 3. Render check; gates |

### P05 · The Agents mode, the Agents glance and the Inbox

| | |
|---|---|
| Agent | designer |
| Read | P04's hand-off notes · `design-story` · `d_modes.py` and its synced boards `d.mode.agent` · `d.mode.skills` · `d.glance` · `d.tune.agent` · `d.tune.skill` · `d.map` · Products pages *Agent Builder* and *Activity* · the stories citing each board |
| Stories | — |
| Done when | The Agents mode's four views, the Agents glance and the full Inbox are drawn with every state their stories name, both lenses. The Agents mode lists Agents · Skills · Runs · Schedules only; `agents.runs` has the *How they are doing* tab; `shell.agents` is the glance (Waits on you · Running · Workers, its worker link to Settings › Workers) with tuning an agent or a skill in the frame as its states; `inbox` opens in the large modal's frame |
| Lands | The mirror: 6 board files and `canvas.json` |
| Boards | agents.agents · agents.skills · agents.runs · agents.schedules · shell.agents (new) · inbox |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The Agents mode. 2. The glance and the Inbox in the large modal. 3. Render check; gates |

### P06 · Large modal — Access

| | |
|---|---|
| Agent | designer |
| Read | P05's hand-off notes · `design-story` · `specs/os/access/**` (AC-F02 permission catalogue, templates, one policy type, AC-49) · `c_iam.py` (page C) · Products pages *Invana IAM* and *Graph settings* · the stories citing each board |
| Stories | — |
| Done when | Every Access section is drawn in the large modal with every state its stories name, both lenses: Now · Who (users, teams, keys, connected clients — no service users) · What they may do (Access Policies with the permission catalogue, a policy's page, New policy: Start · What it allows · Who holds it · Review; each agent's ceiling) · Record (History · Usage · What left) · Keeping. No roles anywhere; `settings.roles` is removed and every link to it repointed |
| Lands | The mirror: 8 board files, one removed, `canvas.json` |
| Boards | settings.access_now (new) · settings.people · settings.policies · settings.agent_access · settings.history · access.usage · access.ledger · settings.keeping |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Now and Who. 2. Policies and agents' ceilings, ported from page C. 3. Record and Keeping. 4. Remove `settings.roles`. 5. Render check; gates |

### P07 · Large modal — Settings: General, You, Connections, Notifications, About

| | |
|---|---|
| Agent | designer |
| Read | P06's hand-off notes · `design-story` · `b_nav.py` (B9 settings rows) · Products pages *Settings* and *Graph onboarding* · the stories citing each board |
| Stories | — |
| Done when | Each board below is drawn in the large modal under Settings with every state its stories name, both lenses; Connections' five sections (Graph databases — many, reached by access · AI models · MCP server · Connectors · Team packs) and their creates as states |
| Lands | The mirror: 10 board files and `canvas.json` |
| Boards | settings.general · settings.appearance (new) · settings.me · settings.databases · settings.ai · settings.mcp · settings.connectors · settings.packs · settings.notifications · settings.about (new) |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. General · Appearance · You. 2. Connections. 3. Notifications · About. 4. Render check; gates |

### P08 · Large modal — Settings: Plugins, Fleet, Workers, Limits, Alerts

| | |
|---|---|
| Agent | designer |
| Read | P07's hand-off notes · `design-story` · `d_modes.py` (D6 Settings › Workers) · Products pages *Fleet* and *Settings* · CP-F02 · CP-F03 · CP-F04 · CP-F09 · CP-F11 |
| Stories | — |
| Done when | Each board below is drawn in the large modal under Settings with every state its stories name, both lenses. `settings.fleet` is Map · Workloads and replaces `settings.workloads` (removed, links repointed); `settings.workers` has slots, scale advice and *Add workers* as the one step strip; `settings.alerts` replaces `control.alerts` (removed, links repointed) |
| Lands | The mirror: 5 board files, two removed, `canvas.json` |
| Boards | settings.plugins · settings.fleet (new) · settings.workers · settings.limits · settings.alerts |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Plugins. 2. Fleet. 3. Workers, Limits, Alerts. 4. Render check; gates |

### P09 · Audit — every nav item and modal section drawn, every link resolves

| | |
|---|---|
| Agent | designer |
| Read | Every hand-off note · `specs/design-language.md` §2–§3 · the mirror's `canvas.json` |
| Stories | — |
| Done when | A coverage table in the hand-off notes, both ways: every leftNav view of the four modes, every large-modal section and sub-section, every header dropdown → its board, and every board → a place; 0 missing, 0 orphans. Every board renders with no page error; the Index lists every board; every board in a story's `## Screens` exists in the mirror (`check.py` reports no "not drawn" warning). The project-lead then asks Ravi's session to publish the mirror |
| Lands | Fixes in the mirror only |
| Boards | — |
| Review | |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. Coverage table. 2. Fix gaps. 3. Render every board. 4. Gates |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Foundation — pages, shell components, Index |  | done | 2026-11-16 | gates green · reviews passed |
| P02 | Shell, Sign-in & Home, Explore | P01 | done | 2026-11-16 | gates green · reviews passed |
| P03 | Model and Graph Data | P02 | done | 2026-11-16 | gates green · reviews passed |
| P04 | Projects | P03 | done | 2026-11-16 | gates green · reviews passed |
| P05 | The Agents mode, the Agents glance and the Inbox | P04 | done | 2026-11-16 | gates green · reviews passed |
| P06 | Large modal — Access | P05 | done | 2026-11-16 | gates green · reviews passed |
| P07 | Large modal — Settings: General, You, Connections, Notifications, About | P06 | pending |  |  |
| P08 | Large modal — Settings: Plugins, Fleet, Workers, Limits, Alerts | P07 | pending |  |  |
| P09 | Audit — every nav item and modal section drawn, every link resolves | P08 | pending |  |  |

## Hand-off notes

| ID | Note |
|---|---|

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
