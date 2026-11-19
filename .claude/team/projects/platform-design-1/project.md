---
name: platform-design-1
status: running
branch: design-v2027-redraw/P19-health-visuals-and-publish-check
scope: platform-design-1
artifact_publish: auto approve
---

# Platform design, part 1 — every view, flow and journey drawn, MVP marked

Ravi reviews the whole platform from its boards: every place board at full fidelity, every create, connect and install
act as a flow board, every journey as a journey board, each carrying its milestone badge.

| | |
|---|---|
| Goal | Every story's `## Screens` cell is drawn on its place board, both lenses · the missing specs (connectors and credentials, plugins and packs, data stores, the project type manifest) are written · every act is a `flow.<act>` board and every journey a `journey.jNN` board, framing live place-board states · every board shows its milestone badge (*MVP?* until Ravi confirms) |
| Specs | `specs/design-language.md` §7 (place, flow and journey boards, the milestone badge) · `specs/milestones.md` · `specs/glossary.md` · every story whose `## Screens` cites a board · `specs/journeys/` J01–J14 · new stories from P03–P05 |
| Not in this project | Engine, Studio, connector or design-kit code · story statuses · the full product review, paper-test project types, the system design lock and the threat model (part 2) · genomics · scientist-authored project types · a bundled MongoDB · the *Invana Products* and proposal canvases (reference only) · any canvas but Pgtk |

Run it: `python3 .claude/skills/run-project/run.py platform-design-1` (the project-lead does, with `--start`).

## References

| What | Where | Use it for |
|---|---|---|
| The canvas | `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` ("Invana v2027.11.0 design") — mirror `.design/canvas-invana/project/` | The deliverable; the one artifact a session publishes to |
| The staging canvas | `https://claude.ai/artifact/8u9qeDPktzNyMwH82aQjSg` — 13 boards: project graph, connectors, code hosts | Read only; its boards are ported into Pgtk by the phase that owns their place, then it is retired |
| The approved proposal | `https://claude.ai/artifact/Fjfg52oUYZQDryQanykk9m` v21 — synced boards in `.design/canvas-nav-proposals/project/` | Shell, nav, large modal — port markup, never re-invent |
| *Invana Products* | `.design/canvas-products/project/` | Ideas for main-area content only; never ported |
| The previous project | `.claude/team/projects/design-v2027-redraw/project.md` — its Rules, Hand-off notes and Log | How the mirror is built, published and checked; P03 there folded `model.kinds` and `model.relationships` into `model.models` |

## Rules for every session

| Rule | Detail |
|---|---|
| Draw by `design-story` | The skill is the procedure; `specs/design-language.md` §7 names boards, flows, journeys and the badge |
| Spec decides | `specs/` settles every conflict, then the proposal canvas, then *Invana Products* for ideas only. No board for a flow or state the specs do not name — a gap is a hand-off note and a recommendation |
| Place boards hold the markup | A flow or journey board draws nothing of its own: each step is a frame of a place board opened from its URL (view · state · lens), with arrows, a caption and the criteria IDs it meets |
| Badges are derived | A board's, flow's or frame's milestone badge is read from the `milestone:` of the stories it cites; never typed. *MVP?* until `specs/milestones.md` lists the MVP journeys as confirmed |
| MVP first | Inside a phase, draw what the proposed MVP journeys (P01) need before the rest, so a stopped run still leaves the MVP drawn |
| Kit only, tokens only | `InvanaUI` from the mirror's bundle; tokens only; budgets in tokens, never currency; exact model versions on runs; results from different graph databases side by side, never joined |
| Board ids stay | Keep the ids the specs cite; a removed or merged board is repointed in the specs by the product-manager, never left dangling |
| Leave the rest alone | Never edit another phase's boards or the shared shell components; a needed change is a hand-off note and a recommendation |
| Re-check before writing | `git status` on `specs/` and `.design/canvas-invana/` before writing — a peer session may hold them |
| Render check | Before a designer phase is done, every board it touched renders with no page error: `cd .design/canvas-nav-proposals/harness && node shot.mjs <absolute path to .design/canvas-invana/project> <out> <board>.dc.html` |
| Who writes `canvas.json` | Only the phase's lead; change only `pages`, `boards`, `order` and `notes` |
| Artifacts: read freely, publish only on Ravi's word | Publish the mirror only to the canvas in References, and only while this header says `artifact_publish: approved` or `auto approve`. Read the header each session; never change it |
| Publish at phase end | After the render check and gates pass: 1. Artifact `read` of the canvas URL. 2. Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each removed board. Never send `index.html`, `SKILL.md` or the type's own files |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 .design/canvas-invana/linkcheck.py` | `.` | P06, P07, P08, P09, P10, P11, P12, P13, P14 | |

## Phases

### P01 · Gap report — every board, flow and journey against the specs

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/design-language.md` §7 · `specs/milestones.md` · every story's `## Screens` and `## Flow` · `specs/journeys/` · the mirror's `canvas.json` and boards (open each board's state list, not its markup) · the staging canvas's 13 boards |
| Stories | — |
| Done when | A report at `.agent-reports/product-manager/platform-design-1-gaps.md` with: (1) per place board, the `## Screens` cells it does not draw, checked by state list, not text match; (2) the cited-but-undrawn boards (`model.kinds`, `model.relationships`, `projects.graph`) — each either to draw or to repoint in the specs; (3) the list of flows `flow.<act>` (every create, edit, connect, install, grant, run and review act a story names) with their steps as `board · view · state` and lens; (4) each journey J01–J14 as its chain of flows; (5) spec gaps, split into what P03, P04 and P05 cover and anything else; (6) the proposed MVP journeys with one line of reason each; (7) a questions batch for Ravi, recommendation first |
| Lands | The report · `specs/milestones.md` MVP journeys as *proposed* · the Questions table |
| Boards | — |
| Review | |
| Approve | Ravi — the report decides every later phase |
| Budget | |
| Steps | 1. Boards vs Screens. 2. Flows. 3. Journeys. 4. Spec gaps. 5. MVP proposal. 6. Questions |

### P02 · `check.py` validates milestones, flows and journeys

| | |
|---|---|
| Agent | coder |
| Read | Recommendation R557 in `.claude/team/agents-recommendations.md` · `specs/milestones.md` · `specs/design-language.md` §7 · `scripts/specs/check.py` |
| Stories | — |
| Done when | `check.py` fails on a `milestone:` not in `milestones.md`, on a `later` story with a milestone, on a confirmed milestone journey whose stories are not all in it, and on a flow or journey board id that breaks §7; `--index` emits the `milestones.md` link in `specs/README.md`; R557 closed |
| Lands | `scripts/specs/check.py` and its tests |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Milestone checks. 2. Board id checks. 3. README link. 4. Tests; gates |

### P03 · Specs — connectors, credentials, plugins and packs

| | |
|---|---|
| Agent | product-manager |
| Read | P01's report and Ravi's answers · `/product-spec` · CP-F02 (CP-20, CP-77) · CP-F05 · CP-F12 · AC-F02 · the connector-secrets and work-connection rules (M15) |
| Stories | — |
| Done when | Stories exist, with Flow, criteria and `## Screens`, for: install a connector · add a credential (work and personal connections) and connect it · test, rotate and remove a credential · install, update and remove a plugin and a pack. `check.py` 0 errors |
| Lands | `specs/os/control/` features and stories |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Read P01's gaps for this area. 2. Write stories. 3. Screens cells on existing place boards. 4. Check |

### P04 · Specs — data stores

| | |
|---|---|
| Agent | product-manager |
| Read | P03's notes · `/product-spec` · `/system-design` · CP-F02 · CP-F05 · Semantics (SE) · Records (RC) · `specs/system-design.md` §6 |
| Stories | — |
| Done when | Written: connector kinds `data store` and `compute`; the TimescaleDB connector (its own instance, never Invana's application database) for time series and tables, and the S3 connector (RustFS bundled) for files; MongoDB as a connector to an existing install only; a model kind declares where its rows live; the graph points to rows and series and never copies bulk data; a region tag on connections and workers with a residency rule (designed, built after MVP); the evidence grade observed · derived · predicted · claimed. Stories for connecting a data store and for a kind stored in a table, with `## Screens`. `check.py` 0 errors |
| Lands | CP-F02 · CP-F05 or a new feature · SE and RC features · `specs/system-design.md` §6 (only this phase edits it in this project) |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Decisions into the features. 2. System design §6. 3. Stories. 4. Check |

### P05 · Specs — the project type manifest

| | |
|---|---|
| Agent | product-manager |
| Read | P04's notes · `/product-spec` · PJ-F01 · PJ-F07 · `specs/packs/software-delivery.md` · `specs/packs/market-research.md` |
| Stories | — |
| Done when | PJ-F07 holds the type manifest's schema (subject model, sources, milestones, tags, checks as workflows, labels, suggested agents, parsers as connectors); the create-project story's Flow and Screens follow from it (choosing a type, General with no subject model); both packs conform. `check.py` 0 errors |
| Lands | PJ-F07 · PJ-F01 stories · the two packs |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Schema. 2. Create-project flow. 3. Packs conform. 4. Check |

### P06 · Boards open from the URL, and the undrawn boards

| | |
|---|---|
| Agent | designer |
| Read | P01's report · `design-story` · `design-language.md` §7 · the mirror's generators and `linkcheck.py` |
| Stories | — |
| Done when | Every board opens on the view, state and lens its URL names (`?view=…&st=…&lens=…`), and on its default with none; the cited-but-undrawn boards are drawn or, where P01 chose repointing, left for the product-manager's repoint (a hand-off note). Every board renders; links green |
| Lands | The mirror: every board file, `canvas.json` |
| Boards | every board in the mirror · `projects.graph` |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The URL reader in the shared board script. 2. Every board. 3. Undrawn boards. 4. Render check on every board; gates; publish |

### P07 · Full fidelity — Shell, Start and Explore

| | |
|---|---|
| Agent | designer |
| Read | P01's report (this area's rows) · P06's notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | shell.switcher · shell.command · shell.operations · shell.access · shell.avatar.access · shell.agents · inbox.dropdown · access.signin · access.consent · start.home · explore.board · explore.conversations · explore.dashboards · explore.queries · graph.memory |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P08 · Full fidelity — Model and Graph Data

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P04's stories · P07's notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first — the data-store stories of P04 included |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | model.models · model.standards · model.health · model.rules · model.taxonomies · model.inference · data.records · data.loads · data.quality · data.annotations |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P09 · Full fidelity — Projects

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P05's stories · P08's notes · the staging canvas's project-graph and code-host boards · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first; the staging canvas's Projects boards ported |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | projects.projects · projects.graph · projects.tasks · projects.reviews · projects.schedules · projects.branches · projects.report · projects.alerts |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Port the staging boards. 2. MVP cells. 3. The rest. 4. Render check; gates; publish |

### P10 · Full fidelity — Agents and Inbox

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P09's notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | agents.agents · agents.skills · agents.runs · agents.schedules · inbox |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P11 · Full fidelity — Access

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P10's notes · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | settings.access_now · settings.policies · settings.agent_access · settings.people · settings.history · access.ledger · access.usage |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MVP cells. 2. The rest. 3. Render check; gates; publish |

### P12 · Full fidelity — Settings

| | |
|---|---|
| Agent | designer |
| Read | P01's report · P03's and P04's stories · P11's notes · the staging canvas's connector boards · `design-story` · the stories citing each board |
| Stories | — |
| Done when | Every `## Screens` cell citing these boards is drawn, both lenses, MVP rows first — connectors, credentials, plugins, packs and data stores included; the staging canvas's connector boards ported |
| Lands | The mirror: these boards and `canvas.json` |
| Boards | settings.general · settings.me · settings.appearance · settings.notifications · settings.about · settings.ai · settings.databases · settings.connectors · settings.plugins · settings.packs · settings.mcp · settings.fleet · settings.workers · settings.limits · settings.alerts · settings.keeping |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Port the staging boards. 2. MVP cells. 3. The rest. 4. Render check; gates; publish |

### P13 · Flow boards

| | |
|---|---|
| Agent | designer |
| Read | P01's report (the flow list) · P07–P12's notes · `design-language.md` §7 |
| Stories | — |
| Done when | Every flow in P01's list is a `flow.<act>` board on the `flows` page: steps left to right, each a live frame of `board · view · state` and lens, with arrows, a caption and its criteria IDs, and its milestone badge; MVP flows first; every frame resolves |
| Lands | The mirror: `flow.*` boards and `canvas.json` |
| Boards | flow.* |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. The frame and arrow pattern on one flow. 2. MVP flows. 3. The rest. 4. Render check; gates; publish |

### P14 · Journey boards and the design review

| | |
|---|---|
| Agent | designer |
| Read | P01's report (journeys as chains of flows) · P13's notes · `specs/journeys/` · `specs/milestones.md` |
| Stories | — |
| Done when | Fourteen `journey.jNN` boards on the `journeys` page, each chaining its flow boards across places with its milestone badge; the Index lists every page; every board renders and every link resolves |
| Lands | The mirror: `journey.*` boards, `Main.dc.html`, `canvas.json` |
| Boards | journey.* |
| Review | |
| Approve | Ravi — the full design review; his changes feed part 2 |
| Budget | |
| Steps | 1. Journeys. 2. Index. 3. Render check on every board; gates; publish |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Gap report — every board, flow and journey against the specs |  | done | 2026-11-19 | gates green · reviews passed |
| P02 | `check.py` validates milestones, flows and journeys |  | done | 2026-11-19 | gates green · reviews passed |
| P03 | Specs — connectors, credentials, plugins and packs | P01 | done | 2026-11-19 | gates green · reviews passed |
| P04 | Specs — data stores | P03 | done | 2026-11-19 | gates green · reviews passed |
| P05 | Specs — the project type manifest | P04 | done | 2026-11-19 | gates green · reviews passed |
| P06 | Boards open from the URL, and the undrawn boards | P01 | done | 2026-11-19 | gates green · reviews passed |
| P07 | Full fidelity — Shell, Start and Explore | P06 | done | 2026-11-19 | gates green · reviews passed |
| P08 | Full fidelity — Model and Graph Data | P07, P04 | done | 2026-11-19 | gates green · reviews passed |
| P09 | Full fidelity — Projects | P08, P05 | done | 2026-11-19 | gates green · reviews passed |
| P10 | Full fidelity — Agents and Inbox | P09 | done | 2026-11-19 | gates green · reviews passed |
| P11 | Full fidelity — Access | P10 | done | 2026-11-19 | gates green · reviews passed |
| P12 | Full fidelity — Settings | P11, P03, P04 | done | 2026-11-19 | gates green · reviews passed |
| P13 | Flow boards | P12, P02 | in progress | 2026-11-19 |  |
| P14 | Journey boards and the design review | P13 | pending |  |  |

## Hand-off notes

| ID | Note |
|---|---|
| — | The previous project's P03 folded `model.kinds` and `model.relationships` into `model.models` as states, yet stories still cite both ids; P01 decides draw or repoint |
| — | `specs/README.md` is generated: its `milestones.md` link is lost on the next `--index` until P02 lands |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-19 | P01 | MVP journeys (gaps §7 Q1) | (a) J07·J01·J02·J03·J06 · (b) + J05 · (c) J07·J01·J02 | (a) | approved — (a) |
| 2026-11-19 | P01 | J01 lists parked CP-27 (Q2) | (a) drop CP-27 from J01 · (b) un-park · (c) leave J01 out | (a) | approved — (a) |
| 2026-11-19 | P01 | Install a connector, CP-17.9 (Q3, breaking) | (a) command line · (b) in Studio · (c) curated list | (a) | approved — (a) |
| 2026-11-19 | P01 | model.kinds · model.relationships (Q4) | (a) repoint · (b) draw | (a) | approved — (a) |
| 2026-11-19 | P01 | projects.graph (Q5) | (a) draw · (b) fold | (a) | approved — (a) |
| 2026-11-19 | P01 | AG-64 state names (Q6) | (a) align story · (b) redraw | (a) | approved — (a) |
| 2026-11-19 | P01 | Badges (Q7) | (a) derived *MVP?* · (b) on every board | (a) | approved — (a) |
