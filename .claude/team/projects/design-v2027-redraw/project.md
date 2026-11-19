---
name: design-v2027-redraw
status: done
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
| The canvas | `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` ("Invana v2027.11.0 design") — mirror `.design/canvas-invana/project/` | The deliverable, and the one artifact a session publishes the mirror to, under the rule *Artifacts: read freely, publish only on Ravi's word* |
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
| The mirror is the deliverable | Sessions edit `.design/canvas-invana/project/` only. Sessions publish the mirror to the canvas `PgtkC6KygGZz2u8fYq1LWX` |
| Artifacts: read freely, publish only on Ravi's word | Any session may read an artifact (Artifact `read`). It may publish the mirror — to the canvas in References and no other — only when this file's header says `artifact_publish: approved` or `artifact_publish: auto approve`, set by Ravi. `off`, missing, or no canvas URL in References: never publish or update any artifact. Read the header each session; never change it |
| Who writes `canvas.json` | Only the phase's lead; change only `pages`, `boards`, `order` and `notes`, keep every other key |
| Board ids stay | Keep the ids the specs cite (`settings.people` stays though it is drawn under Access › Who); the board's title says where it lives |
| Never stop | A gap the spec does not settle: draw what `design-language.md` supports, write a hand-off note, raise a recommendation (`recommend`), go on. A component the kit lacks: compose the nearest kit components, raise a `component` recommendation, go on |
| Kit only, tokens only | `InvanaUI` from the mirror's bundle; tokens only; budgets in tokens, never currency; runs show exact model versions; results from different graph databases side by side, never joined |
| Leave the rest alone | Never edit another phase's boards or the components after P01 — a component change is a hand-off note and a recommendation |
| Render check | Before a phase is done, every board it touched renders with no page error: `cd .design/canvas-nav-proposals/harness && node shot.mjs ../../canvas-invana/project <out> <board>.dc.html` |
| Publish at phase end | After the render check and the gates pass, the phase's lead publishes the mirror to the canvas (under *Artifacts: read freely, publish only on Ravi's word*): 1. Artifact `read` of its URL first. 2. Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each board it removed. Never send `index.html`, `SKILL.md` or the artifact type's own files |

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
| Done when | A coverage table in the hand-off notes, both ways: every leftNav view of the four modes, every large-modal section and sub-section, every header dropdown → its board, and every board → a place; 0 missing, 0 orphans. Every board renders with no page error; the Index lists every board; every board in a story's `## Screens` exists in the mirror (`check.py` reports no "not drawn" warning). The phase's lead publishes the mirror to the canvas |
| Lands | Fixes in the mirror only |
| Boards | — |
| Review | |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. Coverage table. 2. Fix gaps. 3. Render every board. 4. Gates |

### P10 · Model — the Models tree by graph database, links on the canvas

| | |
|---|---|
| Agent | designer |
| Read | P09's hand-off notes · `design-story` · `specs/capabilities/semantics/features/SE-F06-links-and-mappings/feature.md` (*The left section is the Models tree*) · SE-01 · SE-02 · SE-03 · `specs/design-language.md` (Models view, *Views and their leftSection*) · `specs/glossary.md` (*Link between models*, never *stitch*) · Products page *Invana Modeller*: read its board titles in `.design/canvas-products/project/canvas.json`, open only the 3–5 nearest — `modeller.global_model` · `.global_model.dark` · `.global_model.stitch` (MO-03 — *A stitch selected — its two ends, what it joins, whether queries cross it*, generator `.design/canvas-products/p_*.py`: the visual reference, redrawn on the new shell, never its markup or retired patterns) · `.stitches` · `.global_model.diff` · the mirror's `model.models.dc.html` · `@invana/canvas` graph rendering (the Explore boards' graph, the mirror's bundle) |
| Stories | SE-01 · SE-02 · SE-03 |
| Done when | (1) `model.models` opens by default showing the Models tree — each model's Kinds and Relationships, then a visible *Links between models* entry with its count (SE-F06 *The left section is the Models tree*) — and the *Links between models* section in main, not only behind the State switch. (2) The Models tree is grouped by graph database — each graph database a folder holding the models bound to it (SE-F06 *The left section is the Models tree*, SE-01.14); a link stays inside one folder (SE-F06 *One graph database*) and different graph databases sit side by side, never joined. A folder is a graph database, not a new group: no group act, nesting or rule is drawn. (3) The model map is drawn on `@invana/canvas` as a graph — a model's kinds as nodes inside its tinted frame, relationships solid inside the frame, links between models as drawn edges across frames: dashed (SE-01.2); a selected active link thick, dashed, green, the others dim (SE-03.14). Drawn by default on `model.models` (not behind a State switch): a toolbar and a bar with *Show: all n models · Lens · Detail* (SE-01.3 · .4 · .13), a minimap with zoom % and *Fit* at the bottom left (SE-01.13). A selected link opens a right panel: *Ends* (the two kinds, colour-keyed to their models) · *Joins on* (match, joined) · *Crossed by queries* (n in 30 days) · declared by and when · *Open in…* (SE-03.14). A footer status line: version active · draft · staged count · valid — SE-01.6 words the footer `n models · n kinds · n links between models` and SE-03 does not word the rest, so draw the board's line with design-language footer rules and note it as unspecified in the hand-off. Staged and active links are told apart only as SE-03 words them (staged until *Commit*, SE-03.10). No hand-drawn boxes or lines stand in for the graph (Design rules). (4) Every SE-01, SE-02 and SE-03 state still reachable as a View · State · Lens switch on this one board, both lenses, linked — the Link, Link card, Link counting and Link joins states among them. `model.kinds` and `model.relationships` stay removed, no link to them. (5) Render check on `model.models` with no page error; gates `specs` and `links` green. (6) **Last step: the mirror is published to the canvas — see Steps 7**; P02–P09 sessions did not publish and the project-lead had to, so this phase is not done until the publish result is in the hand-off notes |
| Lands | The mirror: `model.models.dc.html` and `canvas.json` (and any board file a repointed link touches) |
| Boards | `model.models` — View · State · Lens: Tree · Links between models · Map (light and dark) · Link · Link card · Link counting · Link joins · every other SE-01 · SE-02 · SE-03 state it already has |
| Review | none |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. List what `model.models` already draws against SE-01, SE-02, SE-03 and the Models-tree rule. 2. Make the tree (graph-database folders) and *Links between models* the default view. 3. Redraw the map on `@invana/canvas` after MO-03, links as edges, toolbar, minimap, selected-link panel, footer line. 4. Note in the hand-off what the spec does not word. 5. Keep every state a switch; repoint links. 6. Render check; gates `specs` and `links`. 7. **PUBLISH — the last step, never skipped.** (a) Artifact `read` of `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. (b) Artifact `publish` with `url` = `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each board removed; never `index.html` or `SKILL.md`. This header carries `artifact_publish: auto approve` (checked 2026-11-17, unchanged), so the session publishes itself and writes the new version in its hand-off note. Only if the header says otherwise: note it and stop, never publish |

### P11 · Model — the full canvas

| | |
|---|---|
| Agent | designer |
| Read | P10's hand-off notes · `design-story` · `specs/design-language.md` (*The board takes its tab's full height*, *A host adds nothing to the canvas*) · SE-F06 (*The left section is the Models tree*) · SE-01 · SE-02 · SE-03 (SE-03.14) · `specs/glossary.md` (*Link between models*, never *stitch*) · Products board `modeller.global_model.stitch` (MO-03, the layout reference: map edge to edge, floating toolbar top-left, floating *Global model · n nodes · n edge types · n links · Show · Lens · Detail* bar, minimap and zoom bottom-left, right panel only on a selection, thin footer line) in `.design/canvas-products/project/` · the mirror's `model.models.dc.html`, `model.taxonomies.dc.html`, `model.inference.dc.html` |
| Stories | SE-01 · SE-02 · SE-03 |
| Done when | (1) On `model.models`, Models view, the main area is ONE full-bleed canvas: no boxed card, no strip of tabs or header above it beyond what the shell itself draws. (2) Over the canvas, floating: the toolbar (top-left); the *Show · Lens · Detail* bar with the counts (SE-01.3 · .4 · .13); the minimap, zoom % and *Fit* (bottom-left, SE-01.13); the staged-links bar (staged count · *Commit* · *Discard*, SE-03.10), no longer a bar above the map. (3) A selected link or kind opens in a RIGHT panel, never on first view: for a link *Ends* · *Joins on* · *Crossed by queries* · *History*, with *Open in a draft* and *Remove link* (SE-03.14; Admin and Modeller only, the Operator reads and sees *Needs the Modeller role — ask an Admin*); for a kind its SE-02 summary. (4) Tables — *Links between models* and the other row lists — sit in a bottom drawer under the canvas that opens and collapses; the canvas keeps the full height when it is collapsed. (5) The Models tree by graph database stays in the left section (SE-F06). (6) Every existing state stays a View · State · Lens switch on the one board, both lenses; no state becomes a board. (7) Other Model views: `model.taxonomies` and `model.inference` draw no graph in main today (hierarchies and derivations by rule) and stay tables and boards, unchanged; `model.standards`, `model.rules`, `model.views`, `model.health` likewise. If a view the spec words as a graph is found, it takes the same treatment and the hand-off says so. (8) Look: the shell keeps Studio's dark/light switching; only the layout and visuals come from the light Products board, and the page works in both themes (*The theme is Studio's*). (9) The canvas is inline SVG at full bleed, since the mirror's kit bundle cannot mount `@invana/canvas`'s SchemaBoard (R518); the hand-off notes it, and that the live Studio uses `@invana/canvas`. (10) Hand-off notes: the floating bars and the panel are laid over the canvas by the page's layout, not added into it (*A host adds nothing to the canvas*), and the spec does not word *Open in a draft* beside *Remove link* for the Operator beyond SE-03.14 — draw what it words. (11) Render check on `model.models`, `model.taxonomies`, `model.inference` with no page error; gates `specs` and `links` green. (12) **Last step: the mirror is published to the canvas — see Steps 6** |
| Lands | The mirror: `model.models.dc.html` and `canvas.json` (and any board file a repointed link touches) |
| Boards | `model.models` — View · State · Lens: Tree · Links between models · Map (light and dark) · Link · Link card · Link counting · Link joins · every other SE-01 · SE-02 · SE-03 state it already has |
| Review | none |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. List what `model.models` draws now (boxed card, staged bar, Links table) against Done when. 2. Make the map the whole main area; float the toolbar, the *Show · Lens · Detail* bar, minimap, zoom and *Fit*, and the staged-links bar. 3. Move the selected link or kind to the right panel. 4. Move the tables to the bottom drawer. 5. Check taxonomies and inference and note which stay boards; render check; gates `specs` and `links`. 6. **PUBLISH — the last step.** (a) Artifact `read` of `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. (b) Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed; never `index.html` or `SKILL.md`; this header carries `artifact_publish: auto approve`, so the session publishes itself and writes the version in its hand-off note; only if the header says otherwise: note it and stop. |

### P18 · Model map, kind tabs and the draft from the data

| | |
|---|---|
| Agent | designer |
| Read | P11's hand-off notes · `design-story` · `specs/capabilities/semantics/features/SE-F06-links-and-mappings/feature.md` · SE-F02 · SE-F01 · `specs/glossary.md` (*Link between models*, never *stitch*) · the previous version's boards `.design/canvas-products/project/modeller.global_model.dc.html` · `.model.type` · `.model.type.constraint` · `.draft` (read-only references) · the mirror's `model.models.dc.html` |
| Stories | SE-02 · SE-04 · SE-05 · SE-08 |
| Done when | The map, toolbar, minimap, tinted frames, selected link and Comparing are not part of this phase (P10 and P11 drew them); the `model.models` Models view stays one full-bleed canvas with floating bars, the right panel and the bottom drawer, and this phase changes none of that layout. On `model.models`: (1) a kind opens as a state of `model.models` (in the right panel or main, as P03 and P11 place it) with Properties · Indexes · Constraints · Mappings and a property table with Index and Constraint columns, including *+ staged* (SE-02.14 · .15; reference MO-02); (2) the constraint dialog — range and unit or a standard's values, Reject or Flag for review, *Today n records break it* (SE-08; reference MO-08); (3) a model drafted from the data — the model staged, the assistant docked on the right naming what it read and each choice with its evidence, *Review and publish* (SE-04.13; reference MO-04) (SE-04 · SE-05 as the Boards list). Every cell of those stories' `## Screens` exists in the mirror; the words are glossary words; `check.py` reports no "not drawn" warning for them. Every board works in the shell's dark and light themes. No Operator lens differs except *Needs the Modeller role — ask an Admin* on every change act |
| Lands | The mirror only — `model.models` page; no new board file, every place keeps one board and every state is a switch |
| Boards | `model.models` — View · State · Lens: Kind detail · Kind detail · Indexes · Kind detail · Edit · Draft · Assistant docked · Draft · Constraint · Draft · Constraint counting · Draft · Constraint breaks today (the previous version's MO-02 · MO-04 · MO-08); no board `model.kinds` or `model.relationships` |
| Review | |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. List what the mirror's `model.models` already draws against these criteria. 2. Draw the kind's tabs and property table, Indexes tab included. 3. Draw the constraint dialog states. 4. Draw the draft from the data with the assistant docked. 5. Gates `specs` and `links`; render check. 6. **PUBLISH — the last step.** (a) Artifact `read` of `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. (b) Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed; never `index.html` or `SKILL.md`; this header carries `artifact_publish: auto approve`, so the session publishes itself and writes the version in its hand-off note; only if the header says otherwise: note it and stop. |

### P19 · Health visuals and publish check

| | |
|---|---|
| Agent | designer |
| Read | P18's hand-off notes · `specs/capabilities/semantics/features/SE-F10-health-and-history/feature.md` · SE-F02 · the previous version's boards `.design/canvas-products/project/modeller.models.usage.dc.html` · `.models.overview.empty` · `.draft.publish` · `.draft.migration` (read-only references) · the mirror's `model.health.dc.html` and `model.models.dc.html` |
| Stories | SE-07 · SE-05 |
| Done when | On `model.health`: (1) the Usage tab draws queries per kind as bars grouped by model, each kind marked Unused or Hot, with the links between models no query crossed beside them and *View as table* for the same rows (SE-07.26); (2) the Overview with no published model says so with *From an ontology* and *New model* (SE-07.14); (3) Usage on a graph database that cannot explain queries reads *not available on <database>* for the slow signal only (SE-07.27). On `model.models`: the Publish and Breaking publish states are checked against SE-05.11 and SE-05.12 (what changes, who reads it, the migration previewed, approval requested) and a gap is drawn only if one is found — a note in the hand-off says what was already drawn. The Overview, Database, Performance, Growth, History and saved-report states are left as they are. `check.py` reports no "not drawn" warning for these stories. The `model.models` layout is unchanged: no layout change in this phase; every board works in the shell's dark and light themes |
| Lands | The mirror only — `model.models` and `model.health` pages; no new board file, every place keeps one board and every state is a switch |
| Boards | `model.health · Usage` · `model.health · Usage · Not available` · `model.health · No model yet` · `model.models · Publish` · `model.models · Publish · Breaking` (the previous version's MO-07 · MO-05) |
| Review | |
| Approve | Ravi — reviews the canvas once published |
| Budget | |
| Steps | 1. Check the mirror's Publish and Breaking states against SE-05.11 and SE-05.12. 2. Draw the Usage bars and the not-available state. 3. Check the Overview empty state. 4. Fix any publish gap. 5. Gates `specs` and `links`; render check. 6. **PUBLISH — the last step.** (a) Artifact `read` of `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX`. (b) Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed; never `index.html` or `SKILL.md`; this header carries `artifact_publish: auto approve`, so the session publishes itself and writes the version in its hand-off note; only if the header says otherwise: note it and stop. |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Foundation — pages, shell components, Index |  | done | 2026-11-16 | gates green · reviews passed |
| P02 | Shell, Sign-in & Home, Explore | P01 | done | 2026-11-16 | gates green · reviews passed |
| P03 | Model and Graph Data | P02 | done | 2026-11-16 | gates green · reviews passed |
| P04 | Projects | P03 | done | 2026-11-16 | gates green · reviews passed |
| P05 | The Agents mode, the Agents glance and the Inbox | P04 | done | 2026-11-16 | gates green · reviews passed |
| P06 | Large modal — Access | P05 | done | 2026-11-16 | gates green · reviews passed |
| P07 | Large modal — Settings: General, You, Connections, Notifications, About | P06 | done | 2026-11-16 | gates green · reviews passed |
| P08 | Large modal — Settings: Plugins, Fleet, Workers, Limits, Alerts | P07 | done | 2026-11-16 | gates green · reviews passed |
| P09 | Audit — every nav item and modal section drawn, every link resolves | P08 | done | 2026-11-16 | gates green · reviews passed |
| P10 | Model — the Models tree by graph database, links on the canvas | P09 | done | 2026-11-17 | gates green · reviews passed |
| P11 | Model — the full canvas | P10 | done | 2026-11-17 | gates green · canvas v12 published |
| P18 | Model map, kind tabs and the draft from the data | P11 | done | 2026-11-17 | gates green · reviews passed |
| P19 | Health visuals and publish check | P18 | done | 2026-11-17 | gates green · reviews passed |

## Hand-off notes

| ID | Note |
| P11 | The canvas is inline SVG, not `@invana/canvas`: the mirror's kit bundle cannot mount SchemaBoard (R518); live Studio uses `@invana/canvas`. The floating bars and the panel are laid over the canvas by the page layout, never added into it (*A host adds nothing to the canvas*) |
| P11 | Spec gaps, drew what is worded: (a) SE-03.14 words no *Open in a draft* for a link, only *Remove link* (SE-03.15), so none is drawn; (b) the phase text says *Needs the Modeller role*, the board keeps *Needs Shape the model — ask Priya Shah (Admin)* since the spec has no roles; (c) the phase text names a *Lens* in the bar, SE-01.3/.4/.13 word only *Show* and *Detail*, so no Lens is drawn; (d) the bar's counts follow SE-01.6 |
| P11 | `shot.mjs` needs an absolute project path (a relative one gives invalid asset URLs and a blank board) |
| P11 | Products ideas taken: `modeller.global_model.stitch` → floating toolbar, counts bar, minimap, right panel layout. Rejected: its light shell (the switch is Studio's) and the word *stitch* (glossary: *link between models*). Publish: the canvas at version 12 (R519: the designer could not write this file) |
|---|---|

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-17 | P10 | Models in groups shown as folders: no spec says models are grouped or filed in folders (SE-F06 lists a model's Kinds and Relationships; design-language groups views and kinds *by model*; SE-F09 declines folders for views). What does a group of models mean? | A. Draw only what the spec has — each model a collapsible tree node, Browse by kind grouped by model, no folders of models. B. Spec it first (group name, who makes one, nesting, access), then draw folders. C. Draw folders as an idea, flagged unspecified | A, then B only if Ravi wants groups — a spec change, not a drawing choice  Ravi, 2026-11-17: a folder is a graph database (an existing concept), not a new group. No group spec. Options B and C are moot; spec words the grouping (SE-F06, SE-01.14). Closed |
| 2026-11-17 | P11 | You want every page to have a canvas or boards as its main content; P11 does Model only. Which other places get a full-canvas main, and which stay table lists? Candidates: Explore (the graph board is already full canvas); Graph Data › Browse by kind; Agents map and Fleet map; Projects hypotheses tree; Access policies matrix. Also: do you mean the shell to turn light like the Products board? P11 keeps the shell's dark theme. | A. Canvas where the content is a graph or a map (Explore, Agents map, Fleet map, Projects hypotheses tree); tables stay lists (Browse by kind, Access policies matrix). B. A plus Browse by kind as a graph of kinds. C. Model only, the rest unchanged. Theme: keep dark, or draw light | A; keep the shell's dark theme. A policies matrix and a record list read best as tables with a bottom drawer for detail, not a canvas | Ravi, 2026-11-17: picks taken. Canvas for graphs and maps (Explore, Agents map, Fleet map, Projects hypotheses tree); tables with a bottom drawer for Browse by kind and the Access matrix; those are later phases, outside this run (P18, P19 unchanged); `model.taxonomies` and `model.inference` stay tables and boards. Theme: the shell keeps Studio's dark/light switching, only layout and visuals come from the light Products board; P11 works in both themes. Spec: floating bars and the right panel are laid over the canvas by the page layout. Closed |
