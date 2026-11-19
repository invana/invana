---
name: platform-design-2
status: running
branch: feat/platform-design-2
scope: platform-design-2
artifact_publish: auto approve
---

# Platform design, part 2 — one final design, the specs closed and locked

Part 1 drew every place, flow and journey board in the v2027 canvas. Part 2 makes that canvas the single, final design artifact: every design in *Invana Products* is audited and what is wanted is ported in, the specs are closed and locked, and the build plan is written so building can start.

| | |
|---|---|
| Goal | v2027 holds every flow and detail · *Invana Products* and the proposal canvases are marked reference-only (never deleted) · the airy-for-forms, dense-for-tables density rule is set once and applied everywhere · every project view leads with the map and answers one question per screen · the create-project, connect-graph-database and add-workers flows are drawn at full detail · both project types are paper-tested · the system design and NFRs are locked · the threat model is written · the build plan exists |
| Specs | `specs/design-language.md` (density) · `specs/milestones.md` · `specs/system-design.md` and the NFRs · PJ-F01 · PJ-F07 · CP-F02 · CP-F05 · CP-F13 · IAM (`iam.*`) · fleet · graph settings · modeller · datasets · activity · builder · notifications · explorer — every story an audited board needs, by ID, written in P04 |
| Not in this project | Engine, Studio, connector or design-kit code (the build plan is the last phase; building is the next project) · story statuses beyond the gates · genomics · scientist-authored project types · a bundled MongoDB · any canvas but Pgtk · connector install in Studio (stays on the command line) |

Run it: `python3 .claude/skills/run-project/run.py platform-design-2` (the project-lead does, with `--start`).

## References

| What | Where | Use it for |
|---|---|---|
| The canvas | `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` ("Invana v2027.11.0 design") — mirror `.design/canvas-invana/project/` | The deliverable; the one artifact a session publishes to |
| *Invana Products* | `.design/canvas-products/project/` — 353 boards | Audited in P01, board by board; ported or redrawn to the kit and tokens where wanted; reference-only after P15 |
| The proposal and staging canvases | `https://claude.ai/artifact/Fjfg52oUYZQDryQanykk9m` (approved proposal, `.design/canvas-nav-proposals/project/`) · `https://claude.ai/artifact/8u9qeDPktzNyMwH82aQjSg` (staging) | Read only; marked reference-only after P15 |
| Part 1 | `.claude/team/projects/platform-design-1/project.md` — Rules, Hand-off notes, Log · `.agent-reports/product-manager/platform-design-1-gaps.md` | How the mirror is built, checked and published; what part 1 found by name only |
| The open recommendations | `.claude/team/agents-recommendations.md` R558–R570 | Spec edits for P03; R560 and R566 are tooling (a session without the Artifact tool), not spec work |

## Rules for every session

| Rule | Detail |
|---|---|
| Draw by `design-story` | The skill is the procedure; `specs/design-language.md` §7 names boards, flows, journeys and the badge |
| Spec decides | `specs/` settles every conflict, then the proposal canvas, then *Invana Products*. **No board without a story**: a board worth porting whose story is missing is written by the product-manager first (P04) — a designer phase never draws it, it raises a hand-off note and a recommendation |
| Audit by content, not name | Compare what a board shows and does, never only its id: part 1's audit was by name and missed what *Invana Products* draws under other names. Each audited board gets exactly one verdict — port · redraw to the kit and tokens · skip — and its backing story |
| Consolidate, never duplicate | A board that exists in v2027 is extended, not redrawn beside itself; `projects.graph` sits with the branch tree, not apart from it |
| Place boards hold the markup | A flow or journey board draws nothing of its own: each step is a frame of a place board opened from its URL (view · state · lens) |
| Badges are derived | A board's milestone badge is read from the `milestone:` of the stories it cites; never typed |
| MVP first | MVP journeys J07 · J01 · J02 · J03 · J06 first inside every phase, so a stopped run still leaves the MVP drawn |
| Kit only, tokens only | `InvanaUI` from the mirror's bundle; tokens only, density by its token; graph rendering is `@invana/canvas` — the folder-grouped stitch is already built there, so draw it, never rebuild it; budgets in tokens, never currency; exact model versions on runs |
| Density | Airy for forms and flows, dense for tables and inspectors — set once in `specs/design-language.md` (P05) through the density token, applied in one designer pass (P06), then never set per board |
| Project views | The map leads each project page; one question per screen with a one-line "where it stands" header; detail through peeks on the map, not new pages; everything that can be visualised is canvas-driven |
| Board ids stay | Keep the ids the specs cite; a removed or merged board is repointed in the specs by the product-manager, never left dangling |
| Leave the rest alone | A designer phase edits only its own boards; the shared shell components change only in P06 |
| Re-check before writing | `git status` on `specs/` and `.design/canvas-invana/` before writing — a peer session may hold them |
| Render check | Before a designer phase is done, every board it touched renders with no page error: `cd .design/canvas-nav-proposals/harness && node shot.mjs <absolute path to .design/canvas-invana/project> <out> <board>.dc.html`, both lenses |
| Who writes `canvas.json` | Only the phase's lead; change only `pages`, `boards`, `order` and `notes` |
| Artifacts: read freely, publish only on Ravi's word | Publish the mirror only to the canvas in References, and only while this header says `artifact_publish: approved` or `auto approve`. Read the header each session; never change it |
| Publish at phase end | After the render check and gates pass: 1. Artifact `read` of the canvas URL. 2. Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each removed board. Never send `index.html`, `SKILL.md` or the type's own files |
| No code | No phase changes engine, Studio, connector or design-kit code |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 .design/canvas-invana/linkcheck.py` | `.` | P06, P07, P08, P09, P10, P11, P12, P13, P14, P15 | |

## Phases

### P01 · Audit — Invana Products against v2027, by content

| | |
|---|---|
| Agent | product-manager |
| Read | `.design/canvas-products/project/` (its `canvas.json` and every board's state list and content) · the mirror's `canvas.json` and boards · part 1's gaps report · `specs/` stories and `## Screens` · `specs/design-language.md` |
| Stories | — |
| Done when | A report at `.agent-reports/product-manager/platform-design-2-audit.md`: all 353 boards, each with one verdict (port · redraw to the kit and tokens · skip), the v2027 board it lands on, and the story that backs it (or *none — P04 writes it*). Known missing are covered: `fleet.*` (13) · `graph.settings.*` (9) and `settings.graph_limits` · `modeller.global_model.*` (stitch, diff, dark) · `modeller.models.overview` (+ empty) · `iam.*` · all 18 `projects.*` · likely gaps in datasets (provenance, versions, standards), activity (run step, compare), builder (agent soul, flow), notifications, explorer (answer, board, layout, presenting, tools). A questions batch for Ravi, recommendation first |
| Lands | The report |
| Boards | — |
| Review | |
| Approve | Ravi — the report decides every later phase |
| Budget | |
| Steps | 1. List and group the 353 boards by product. 2. Compare by content against the mirror, group by group. 3. Verdict and backing story per board. 4. Gaps without a story. 5. Questions |

### P01b · Visual re-audit — Invana Products against v2027, side by side

| | |
|---|---|
| Agent | product-manager |
| Read | P01's report (`.agent-reports/product-manager/platform-design-2-audit.md`) · `.design/canvas-products/project/` and the mirror `.design/canvas-invana/project/` · `specs/design-language.md` · the render harness (`.design/canvas-nav-proposals/harness`, `shot.mjs`) · Ravi's decisions in *Hand-off notes* |
| Stories | — |
| Done when | A report at `.agent-reports/product-manager/platform-design-2-reaudit.md` that **replaces the verdict column** of P01's report for every board P01 marked `skip · landed`. Each such board is rendered (both lenses) next to its v2027 board and compared on fidelity (the states, fields, actions and detail it shows) and layout (spacing against the airy-for-forms, dense-for-tables rule), and gets one verdict — port · redraw to the kit and tokens · skip (equal detail, with the evidence: the two renders and what matched) — and its backing story or *none — P04 writes it*. Order: 1. `fleet.*` and `settings.workers` — add-workers and fleet detail are reported missing, so *redraw* unless the comparison shows equal detail · 2. `iam.*` and the policy boards (draft, test, impact, limits, denied, `iam.agent.effective`) · 3. `graph.settings.*` and `settings.graph_limits` (their content becomes *project settings*, see Hand-off notes) · 4. builder agent, skill and function boards — verified visually, never assumed `skip` · 5. every other board P01 marked `skip · landed`. A name match alone is never a verdict. Anything that conflicts with the specs is a questions batch for Ravi, recommendation first |
| Lands | The re-audit report |
| Boards | — |
| Review | |
| Approve | Ravi — the re-audit report decides P04 and every designer phase |
| Budget | |
| Steps | 1. Render the two boards of each pair, both lenses. 2. Compare in the order above: fleet and workers, IAM and policy, graph settings, builder, the rest. 3. Verdict, evidence and backing story per board. 4. Gaps without a story. 5. Questions |

### P02 · Part 1's review changes and the MVP badges

| | |
|---|---|
| Agent | product-manager |
| Read | Ravi's part-1 review notes (see Questions) · `specs/milestones.md` · `specs/journeys/` |
| Stories | — |
| Done when | Every change Ravi asked for in the part-1 design review is made in the spec it belongs to, or routed as a row for the designer phase that owns the board; `specs/milestones.md` lists J07 · J01 · J02 · J03 · J06 as the confirmed MVP journeys so the *MVP?* badges become real. `check.py` 0 errors |
| Lands | `specs/milestones.md` · the specs the changes touch |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read Ravi's changes. 2. Spec edits and routed rows. 3. Confirm the MVP journeys. 4. Check |

### P03 · Take up the open part-1 recommendations that are spec edits

| | |
|---|---|
| Agent | product-manager |
| Read | `.claude/team/agents-recommendations.md` R558–R570 · `recommend` skill |
| Stories | — |
| Done when | R558, R559, R561, R563, R564, R568 and R569 are made in their specs (journey links to CP-79–CP-82, the PJ-28.15 refusal in CP-20 and CP-F02, `model.kinds` and `model.relationships` repointed to `model.models` states, the RC-08 and RC-11 access wording, SE-13's refusal, CP-76's dropdown board, AG-64's Import and Export states); R562, R565, R567 and R570 are read into this project's Hand-off notes; each row closed or declined with a reason. R560 and R566 (tooling) are not taken here. `check.py` 0 errors |
| Lands | The specs the rows name · the recommendations file (via `add.py`) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Prioritise and take up each row. 2. Spec edits. 3. Hand-off notes. 4. Close rows; check |

### P04 · Spec the gaps

| | |
|---|---|
| Agent | product-manager |
| Read | P01's report, **P01b's re-audit (its verdicts win)** and Ravi's answers · P02 and P03's notes · `/product-spec` · `/system-design` · PJ-F01 · PJ-F07 · CP-F02 · CP-F05 · CP-F13 · IAM · `graph.settings.*` (the source of the project settings) · `builder.agents` |
| Stories | — |
| Done when | Every audited board with verdict *port* or *redraw* has a story with Flow, criteria and `## Screens`. Written at least: **project access at create** — the create-project flow follows the create-graph flow (`shell.graph.new.*`): *start* (choose a type, or start from an existing project, PJ-23) · *about* (name, question, objective, slug with a taken state) · *data* (subject model and sources; General has none) · *team* (people, teams and agents who get access, each with an access policy, drawn from IAM policies, groups, people and `iam.agent.effective`, so a person sees the effect of access before creating) · *review* (type, data, who gets what, what its agents may do, then create); PJ-02 stays *start a project of its type* — the old question, objective and first branch fold into *about*, people and rules into *team*; **connect a graph database** (connector picked, credential, test, connected, shape, ready, mode) and **add workers** (where picked, new or existing group, run command per docker, k8s and python, token, joined, region tag from CP-F13) in detail; the inquiry tree (forks, merges, parked, dropped — PJ-F03) with `projects.graph` on the branch tree; the map-led project page and its peeks; **project settings** — a place with five tabs, drawn from `graph.settings.*`: *General* (name, description, question, objective), *Data* (the connections the project uses, test, read-only), *Team* (people, teams and agents in one list, access per row, pause and remove, invite from the agent catalogue — the create-project *team* step is its first form and the same tab edits it afterwards), *An agent in this project* (version, what it may touch, its runs as a filter on `agents.runs`), *Usage* (the project's share of the deployment, team, user and agent limits, read-only — limits are never set per project, CP-11); PJ-22 (set the project team and its lead agent) is extended, not duplicated; **Agents in this project** — a view on the project page, drawn from `builder.agents`; anything else the audits found without a story. `check.py` 0 errors |
| Lands | The features and stories the gaps belong to · `specs/README.md` index |
| Boards | — |
| Review | |
| Approve | Ravi — the spec review (journey, Access, boards to draw, open questions) before any designer phase |
| Budget | |
| Steps | 1. Group the story-less boards by feature. 2. Create-project, connect and workers. 3. Projects (map-led, inquiry tree). 4. Fleet, project settings, modeller, IAM. 5. Datasets, activity, builder, notifications, explorer. 6. Check; the spec review |

### P05 · Density rule in the design language

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/design-language.md` (the density token) · P01's and P01b's notes on spacing · Ravi's decision: airy for forms and flows, dense for tables and inspectors |
| Stories | — |
| Done when | `specs/design-language.md` states the rule once through the density token: which surfaces are airy (forms, flows, create and connect steps, the map-led project page) and which dense (tables, inspectors, lists); no other file restates it. `check.py` 0 errors |
| Lands | `specs/design-language.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Write the rule. 2. Check |

### P06 · Density pass — one pass over every board

| | |
|---|---|
| Agent | designer |
| Read | P05's rule · `design-story` · `build-studio` density · the mirror's shared shell components and `canvas.json` |
| Stories | — |
| Done when | The density token carries the rule: forms and flow steps airy, tables and inspectors dense, on every existing board in both lenses; set in one pass, never per board; every board renders; links green. Only this phase edits the shared shell components in this project |
| Lands | The mirror: shared shell components, every board file that sets spacing, `canvas.json` |
| Boards | every board in the mirror |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The token and shared components. 2. Each place's forms and tables. 3. Render check on every board; gates; publish |

### P07 · Fleet and workers

| | |
|---|---|
| Agent | designer |
| Read | P01's report and P01b's re-audit (the fleet rows) · P04's stories · P06's notes · `design-story` · the stories citing each board · `fleet.*` in *Invana Products* |
| Stories | — |
| Done when | The 13 `fleet.*` ports exist on the fleet and workers boards: add with docker, k8s and python run steps, token, pool, joined, capacity, pools, tokens, worker; both lenses, MVP rows first; every `## Screens` cell citing them drawn |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | settings.fleet · settings.workers · fleet.* |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P08 · Access (IAM)

| | |
|---|---|
| Agent | designer |
| Read | P01's report and P01b's re-audit · P04's stories · P07's notes · `design-story` · the stories citing each board · `iam.*` in *Invana Products* |
| Stories | — |
| Done when | Drawn: `iam.*` (policies, groups, people, `iam.agent.effective`) and the policy boards P01b names (draft, test, impact, limits, denied); every cell citing them, both lenses, MVP rows first. The Graph is retired: `graph.settings.*` and `settings.graph_limits` are drawn as project settings in P10, not here |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | iam.* · settings.policies · settings.people · settings.agent_access |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P09 · Modeller — the global model (stitch) and overview

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P04's stories · P08's notes · `design-story` · `modeller.*` in *Invana Products* · the stitch story in `@invana/canvas` |
| Stories | — |
| Done when | `modeller.global_model.*` drawn on the canvas — the folder-grouped stitch, its diff and its dark state — using what `@invana/canvas` already builds (draw it, never rebuild it); `modeller.models.overview` and its empty state on `model.models`; every cell citing them drawn, both lenses |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | model.models · modeller.global_model.* · modeller.models.overview |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The stitch. 2. Diff and dark. 3. Overview and empty. 4. Render check; gates; publish |

### P10 · Projects — the map-led views and project settings

| | |
|---|---|
| Agent | designer |
| Read | P01's report and P01b's re-audit · P04's stories (project settings, Agents in this project) · P09's notes · `design-story` · the 18 `projects.*` boards and `graph.settings.*` in *Invana Products* · `builder.agents` · the staging canvas's project-graph boards |
| Stories | — |
| Done when | All 18 `projects.*` ports drawn on the v2027 project boards: list and list.empty · project · branches · branch with decide, fork and merge · finding · decisions · impact · lineage · simulate and its result · todo · todos · report; the inquiry tree (forks, merges, parked, dropped — PJ-F03) with `projects.graph` on the branch tree; the map leads each project page, a one-line "where it stands" header, detail through peeks; the **project settings place** with its five tabs — General · Data · Team · An agent in this project (its runs a filter on `agents.runs`) · Usage (read-only) — in the airy form density; the **Agents in this project** view on the project page, drawn from `builder.agents`; both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | projects.projects · projects.graph · projects.branches · projects.* · project settings (from graph.settings.* and settings.graph_limits) |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The map-led project page. 2. MVP cells. 3. Branches and the inquiry tree. 4. Project settings and Agents in this project. 5. The rest. 6. Render check; gates; publish |

### P11 · Create a project

| | |
|---|---|
| Agent | designer |
| Read | P04's create-project stories · P08's notes (IAM boards) · P10's notes (the project settings *Team* tab) · `design-story` · `shell.graph.new.*` in the mirror · `projects.new` in *Invana Products* |
| Stories | — |
| Done when | The create-project boards follow `shell.graph.new.*`: start (choose type or start from an existing project) · about (name, question, objective, slug, slug taken) · data (subject model and sources; General has none) · team (the first form of P10's project settings *Team* tab, reused not redrawn: people, teams and agents, each with an access policy, showing the effect of access from IAM) · review (type, data, who gets what, what its agents may do, create); both lenses, every state |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | projects.new (start · about · data · team · review) |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Start and about. 2. Data. 3. Team and the access effect. 4. Review. 5. Render check; gates; publish |

### P12 · Datasets, activity and builder

| | |
|---|---|
| Agent | designer |
| Read | P01's report and P01b's re-audit · P04's stories · P11's notes · `design-story` · the datasets, activity and builder boards of *Invana Products* |
| Stories | — |
| Done when | Every audited port drawn: datasets (provenance, versions, standards) · activity (run step, compare) · builder (agent soul, flow, and the agent, skill and function boards P01b verified); every cell citing them, both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | the boards P01 names for datasets, activity and builder |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. Datasets. 3. Activity. 4. Builder. 5. Render check; gates; publish |

### P13 · Shell, notifications and explorer

| | |
|---|---|
| Agent | designer |
| Read | P01's report and P01b's re-audit · P04's stories · P12's notes · `design-story` · the shell, notification and explorer boards of *Invana Products* |
| Stories | — |
| Done when | Every audited port drawn: notifications · explorer (answer, board, layout, presenting, tools) · the shell pieces P01 names; every cell citing them, both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | the boards P01 names for shell, notifications and explorer |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. Explorer. 3. Notifications and shell. 4. Render check; gates; publish |

### P14 · Redo the flow and journey boards that changed

| | |
|---|---|
| Agent | designer |
| Read | P07–P13's notes · P04's flow specs · `design-language.md` §7 · the flow and journey boards of the mirror |
| Stories | — |
| Done when | `flow.create_project` drawn from P11's frames; `flow.connect_graph_database` (connector picked, credential, test, connected, shape, ready, mode) and `flow.add_workers` (where picked, new or existing group, run command per docker, k8s and python, token, joined, region tag) redrawn at full detail from the fleet and connection boards; every other flow and journey board whose frames moved or were added is repointed; every frame resolves; badges derived |
| Lands | The mirror: `flow.*` · `journey.*` boards, `Main.dc.html`, `canvas.json` |
| Boards | flow.create_project · flow.connect_graph_database · flow.add_workers · the others that changed |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The three flows. 2. The rest that changed. 3. Journeys. 4. Render check; gates; publish |

### P15 · Final design review and the reference-only marks

| | |
|---|---|
| Agent | designer |
| Read | P14's notes · `specs/journeys/` · `specs/milestones.md` · P01's report and P01b's re-audit (its verdicts replace P01's) |
| Stories | — |
| Done when | The Index lists every page and board; the audits' every *port* and *redraw* board (P01b's verdicts win) is in v2027 and every *skip* has its reason; *Invana Products* and the proposal canvases carry a visible reference-only mark (never deleted); every board renders and every link resolves; the package for Ravi is assembled (canvas, each journey, open questions) |
| Lands | The mirror: `Main.dc.html`, `canvas.json` · the reference marks in the reference canvases' own `canvas.json` notes |
| Boards | every board · the Index |
| Review | |
| Approve | Ravi — the full design review; his changes are routed to the phase that owns them before P16 |
| Budget | |
| Steps | 1. Index and completeness against P01. 2. Reference-only marks. 3. Render check on every board; gates; publish |

### P16 · Paper-test the two project types

| | |
|---|---|
| Agent | product-manager |
| Read | PJ-F07 (the type manifest) · `specs/packs/software-delivery.md` · `specs/packs/market-research.md` · the drawn create-project and project boards |
| Stories | — |
| Done when | Each type is walked end to end on paper against the manifest and the drawn boards — subject model, sources, milestones, tags, checks as workflows, labels, suggested agents, parsers as connectors, the create-project team step and its access policies — and every mismatch is fixed in the spec or raised to Ravi. `check.py` 0 errors |
| Lands | The two packs · PJ-F07 · a paper-test note in the Hand-off notes |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Software delivery. 2. Market research. 3. Fix or raise. 4. Check |

### P17 · System design and NFR lock

| | |
|---|---|
| Agent | product-manager |
| Read | `/system-design` · `specs/system-design.md` · every feature's `## Engine` and `## System impact` · P04 and P16's notes |
| Stories | — |
| Done when | `specs/system-design.md` and the NFRs are final for the data stores, residency and code structure; every feature's `## Engine` and `## System impact` agree with it; no table, route or refusal is left for the coder to invent. `check.py` 0 errors |
| Lands | `specs/system-design.md` · the NFRs · the features' Engine and System impact |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Data stores and residency. 2. Code structure. 3. Features agree. 4. Check |

### P18 · Threat model

| | |
|---|---|
| Agent | security |
| Read | `security-audit` skill · the locked system design (P17) · the specs that touch access, data, agents or outside systems |
| Stories | — |
| Done when | A threat model at `.agent-reports/security/platform-design-2-threat-model.md`, STRIDE over every act and data flow, covering access, data, agents and outside systems — connector credentials, outside MCP servers and PR pushes first; each finding has a recommended fix as a row in `.claude/team/agents-recommendations.md` |
| Lands | The report · recommendations |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Connector credentials, outside MCP servers, PR pushes. 2. The rest of access, data and agents. 3. Findings and fixes |

### P19 · Build plan

| | |
|---|---|
| Agent | product-manager |
| Read | The locked specs · P18's findings · `specs/milestones.md` · `.claude/skills/run-project/project-template.md` · `create-project` skill |
| Stories | — |
| Done when | A draft project (`status: draft`) for the engine and Studio build at `.claude/team/projects/<name>/project.md`: milestone phases in dependency order from the locked design, MVP journeys first, each phase's stories designed, gates and budgets set; P18's accepted fixes included. Presented to Ravi |
| Lands | The new project file |
| Boards | — |
| Review | |
| Approve | Ravi — the project that lets building start |
| Budget | |
| Steps | 1. Dependency order from the system design. 2. Phases and gates. 3. Present |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Audit — Invana Products against v2027, by content |  | done | 2026-11-19 | gates green · reviews passed |
| P01b | Visual re-audit — Invana Products against v2027, side by side | P01 | done | 2026-11-19 | gates green · reviews passed |
| P02 | Part 1's review changes and the MVP badges |  | pending |  |  |
| P03 | Take up the open part-1 recommendations that are spec edits |  | pending |  |  |
| P04 | Spec the gaps | P01, P01b, P02, P03 | pending |  |  |
| P05 | Density rule in the design language | P01, P01b | pending |  |  |
| P06 | Density pass — one pass over every board | P05 | pending |  |  |
| P07 | Fleet and workers | P06, P04 | pending |  |  |
| P08 | Access (IAM) | P07 | pending |  |  |
| P09 | Modeller — the global model (stitch) and overview | P08 | pending |  |  |
| P10 | Projects — the map-led views and project settings | P09 | pending |  |  |
| P11 | Create a project | P10, P08 | pending |  |  |
| P12 | Datasets, activity and builder | P11 | pending |  |  |
| P13 | Shell, notifications and explorer | P12 | pending |  |  |
| P14 | Redo the flow and journey boards that changed | P13 | pending |  |  |
| P15 | Final design review and the reference-only marks | P14 | pending |  |  |
| P16 | Paper-test the two project types | P15 | pending |  |  |
| P17 | System design and NFR lock | P16 | pending |  |  |
| P18 | Threat model | P17 | pending |  |  |
| P19 | Build plan | P18 | pending |  |  |

## Hand-off notes

What a later phase must know that the code does not say. One row per note, newest last.

| ID | Note |
|---|---|
| — | Part 1's audit was by board name only; part 2 audits by content (P01) |
| — | PJ-02 was rewritten in part 1 P05 as *start a project of its type* (type manifest, General with no subject model); *Invana Products*' `projects.new` (question, objective, first branch, people, rules) predates it — its people and rules steps survive under the type-first flow as the *team* step |
| — | `model.kinds` and `model.relationships` are states of `model.models` (part 1 Q4) |
| — | Connector install stays on the command line, not offered in Studio (part 1 Q3) |
| — | Ravi has not approved P01's report: it marked 334 of 352 boards `skip · landed` by state-name match, without comparing fidelity or layout. P01b's re-audit replaces its verdicts for those boards; until Ravi approves P01b, no later phase relies on a P01 `skip · landed` |
| — | The Graph stays retired and the project takes its place: `graph.settings.*` and `settings.graph_limits` are not out of spec — their content becomes project settings (General · Data · Team · An agent in this project · Usage). Limits are never set per project (CP-11): the Usage tab only shows the project's share. The create-project *team* step is the first form of the Team tab. P04 writes the stories, P10 draws the place, P11 reuses the Team tab |

## Questions for Ravi

The project-lead's, batched. Answered rows stay until the phase they unblock is done.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-19 | P01b | Datasets (audit Q2) | keep retired · bring back · cherry-pick | keep retired | answered — keep retired; P01b checks provenance, versions and standards for gaps only |
| 2026-11-19 | P01b | projects.simulate (audit Q3) | leave out · specify and draw | leave out | answered — **specify and draw it**: P04 writes the story, P10 draws it on projects.branches |
| 2026-11-19 | P05 | Airy density on Explorer chrome | forms, flows and pages only · chrome too | forms, flows and pages only | answered — forms, flows and pages only; Explorer chrome stays compact |
| 2026-11-19 | P01b | Explorer visual comparison scope | answer and board families first · all 105 · name only | families first | answered — answer, board, layout and presenting first; the rest by state name |
| 2026-11-19 | P01 | Audit Q1: the specs have no Graph above a graph database, Invana Products draws one — skip the 21 Graph boards, or restore Graphs | (a) keep the specs, skip the Graph boards · (b) restore Graphs | (a) | Answered: yes — the Graph stays retired and the project takes its place; `graph.settings.*` and `settings.graph_limits` become project settings (P04 · P10 · P11) |
| 2026-11-19 | P01 | Audit Q2 (Datasets retired) · Q3 (`projects.simulate`) · Q4 (accept the 334 `skip` rows) | see the audit §7 | Q4 no — verdicts are redone | Q4: not accepted, re-audited in P01b. Q2 and Q3 stay open until P01b reissues the verdicts |
| 2026-11-19 | P02 | Part 1's design-review changes: none were handed over. What did the part-1 review change? | (a) paste or dictate them before P02 starts · (b) none — P02 only confirms the MVP journeys | (a) | |
| 2026-11-19 | Start | Project branch: part 1's header names a stale phase branch (`design-v2027-redraw/P19-…`); the run-project rule is `feat/<name>` made by Ravi off an up-to-date `main`. Part 2 must start from part 1's drawn boards, which are on `platform-design-1/P14-journey-boards-and-the-design-review` and not on `main` | (a) `feat/platform-design-2` off the tip of `platform-design-1/P14-…` · (b) merge part 1 to `main` first, then `feat/platform-design-2` off `main` | (b) | |
| 2026-11-19 | P06 | Density pass before the ports (P06) or after all of them | (a) first, so every later phase draws on the final density · (b) last, one pass over everything at once | (a) — a token set once, ports drawn on it, no rework | |
| 2026-11-19 | P11 | Create-project: the project-lead's own *team* step grants access before the project exists. Does an agent in the team step get an access policy by default? | (a) no — an agent gets nothing until a policy is chosen · (b) a default read-only policy | (a) | |
