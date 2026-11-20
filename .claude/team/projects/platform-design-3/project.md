---
name: platform-design-3
status: running
branch: feat/platform-design-3
scope: platform-design-3
artifact_publish: auto approve
---

# Platform design, part 3 — every flow a click-through

Part 2 made the v2027 canvas the one final design. Part 3 makes every flow in it end to end — a person clicks from where an act starts to where it lands, through every step, failure and lens — and settles what Settings keeps.

| | |
|---|---|
| Goal | Every flow in the v2027 canvas is a click-through by `specs/design-language.md` §7 *Every design is end to end*: its start reachable from a List or Detail, every step a state, every button leading on, every failure wired with a way out, the result where it lands, Admin and Operator — played on the place boards themselves (no flow or journey boards), proven by the click-through gate on the runtime the published canvas renders with, plus a dead-button sweep, not a static scan · `settings.*` reconsidered (connected clients, access policies end to end, Record and Keeping, *your connections*, owners) and the deferrals applied as `later` stories · the 70 rows of the gap report (E2E-001…070) each closed by one phase · the artifact `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` stays the single final design, mirroring `.design/canvas-invana/project/` |
| Specs | `specs/design-language.md` §7 and §8 · CP-10 · CP-84 · CP-82 · CP-83 · CP-25 · CP-64 · CP-20 · AC-04 · PJ-02 · AG-42 · AG-64 · SE-13 · AC-06 · AG-38 · RC-13 (gap report §4) · the settings deferrals: AC-24 · AC-25 · AC-28 · AC-29 · AC-30 · AC-35 · AC-36 · AC-43 · AC-44 · AC-45 · AC-46 · CP-03 · CP-43 · CP-63 · every story an E2E row cites, by ID in its phase |
| Not in this project | Engine, Studio, connector or design-kit code — the one exception is `scripts/specs/check.py` (P03c, R605) · the reference-only marks on *Invana Products* and the proposal canvases · story statuses beyond `later` for the deferrals · drawing any story set to `later` · any canvas but Pgtk · the `.claude/` skill edits R603 and R604 (team rules — Ravi's own session) |

Run it: `INVANA_RUNNER_LEAD_MODEL=opus python3 .claude/skills/run-project/run.py platform-design-3 --start` (the project-lead does; `INVANA_RUNNER_CHEAP_MODEL` stays its default `sonnet`). The runner reads both at start, so they are set on the command line, not in *Environment*.

## References

| What | Where | Use it for |
|---|---|---|
| The gap report | `.agent-reports/project-lead/platform-design-3-e2e-gaps.md` — §2 rows E2E-001…070 · §3 flows already end to end · §4 spec gaps · §5 unverified | The spine: each phase closes the rows it names, every state the row lists |
| The standard | `specs/design-language.md` §7 › *Every design is end to end* | What end to end means, the naming of states, the done check |
| The settings review | `.agent-reports/product-manager/platform-design-3-settings-review.md` | What P01 applies |
| The canvas | `https://claude.ai/artifact/PgtkC6KygGZz2u8fYq1LWX` ("Invana v2027.11.0 design", version 53 at part 2's end) — mirror `.design/canvas-invana/project/` | The deliverable; the one artifact a session publishes to |
| *Invana Products* | `.design/canvas-products/project/` | The fuller flows the gap report's *Invana Products* column names (`fleet.add.*`, `shell.graph.new.*`, `iam.*`, `settings.*.add`, `modeller.models.*`) — read only |
| The render harness | `.design/canvas-nav-proposals/harness/shot.mjs` | What the click-through harness (P03b) is built on |
| Part 2 | `.claude/team/projects/platform-design-2/project.md` — Rules, Hand-off notes, Questions | How the mirror is built, checked and published |
| Open recommendations | R603 (design-story skill) · R604 (design-qa skill) · R605 (check.py) | R605 is phase P03c; R603 and R604 edit `.claude/` — Ravi's own session (Questions) |

## Rules for every session

| Rule | Detail |
|---|---|
| End to end, by §7 | Every board a phase touches meets `specs/design-language.md` §7 *Every design is end to end* a–h for each act on it. Link it, never restate it. A state that exists is not done until a click reaches it and a click leaves it |
| Close the whole row | A phase closes every state its E2E rows list, in that row's words. A row's *card row*, *wait row* and *failure row* parts apply P03's mechanisms to that board; nothing is wired by URL alone |
| Spec decides — Invana Products wins only through the spec | `specs/` settles every conflict. Where *Invana Products* draws a fuller flow than the spec (CP-10 *Join key* as its own step 3), the spec changes first — P02 sweeps the rows; a designer phase never draws a step the spec lacks, it raises a recommendation and a hand-off note |
| `later` is not drawn | A story set to `later` (P01) keeps its boards as drawn, unwired; no phase draws or wires its states, and no `flows.json` path runs them |
| No flow or journey boards | A flow is played on its place boards; its click path is its `flows.json` entry, a journey an ordered list of flows there (`specs/design-language.md` §7). No phase draws, frames or fixes a `flow.*` or `journey.*` board; P10 deletes them |
| One mechanism each | Choice cards' `go`, the Outcome control on wait states, failure exits and the Sign in again hub are built once in P03 in the shared components; later phases use them, never a per-board copy. Only P03 edits the shared shell components |
| The manifest is the flow list | `.design/canvas-invana/clickthrough/flows.json` (P03b, re-keyed by P04c) holds each flow's start, steps, failures and lenses and the phase that owns it; a place phase encodes its own flows' paths from its stories' `## Screens` as it wires them |
| Board ids stay | Keep the ids the specs cite; a renamed state is renamed in the spec in the same phase only by the product-manager — a designer phase raises it |
| MVP first | J07 · J01 · J02 · J03 · J06 rows first inside every phase |
| Kit only, tokens only | `InvanaUI` from the mirror's bundle; tokens only; density by its token; graph rendering is `@invana/canvas` |
| Four stops for Ravi | The run pauses only after P01c (the CRUD matrix and the slimmed Settings: scope), P03 (the board engine every board rests on), P08b (the MVP places drawn) and P11b. Elsewhere a question only Ravi can answer goes to *Questions for Ravi* with the recommendation, and the session applies the recommendation and goes on; every change Ravi asks for afterwards goes through the product-manager |
| What changed, with links | Every phase ends its report (`.agent-reports/<agent>/platform-design-3-<ID>.md`) with `## Review links` by `.claude/team/TEAM.md` §3 *Links*: each board it added or changed and each flow it encoded, its deep link, and the View · State · Lens to set for each new or wired state; spec phases link each story and row they changed. The project-lead's update links each phase report first |
| Settings merges | A board P01c merged away moves its states into the board that keeps it, in the place phase that owns the keeper; its file is removed, every link and `flows.json` step repointed, and the canvas publish sends `null` for it |
| CRUD matrix rows | A place phase also closes the P01b matrix rows Ravi kept for the boards it owns — the create, edit and delete/archive acts with their confirm, result and failure states — and records them in `flows.json` |
| Re-check before writing | `git status` on `specs/` and `.design/canvas-invana/` before writing — a peer session may hold them |
| Render and click-through check | Before a designer phase is done: every board it touched renders with no page error in both lenses (`node .design/canvas-nav-proposals/harness/shot.mjs <abs path to .design/canvas-invana/project> <out> <board>.dc.html`, then with `--props '{"lens":"Operator"}'`), and `node .design/canvas-invana/clickthrough/run.mjs --through <its ID>` exits 0 — its paths and, from P04c, the dead-button sweep of every board owned up to that phase |
| Who writes `canvas.json` | Only the phase's lead; change only `pages`, `boards`, `order` and `notes` |
| Artifacts: read freely, publish only on Ravi's word | Publish the mirror only to the canvas in References, and only while this header says `artifact_publish: approved` or `auto approve`. Read the header each session; never change it |
| Publish at phase end | After the render check and gates pass: 1. Artifact `read` of the canvas URL. 2. Artifact `publish` with `url` = the canvas, `root` = the absolute path of `.design/canvas-invana`, `file_path` = `project/canvas.json`, `files` = only the `project/` files the phase changed, `null` for each removed board. Never send `index.html`, `SKILL.md`, the type's own files or `clickthrough/` |
| No code | No phase changes engine, Studio, connector or design-kit code; P03c changes `scripts/specs/` only |

## Environment

Set for the runner, so every gate and session inherits it.

| Name | Value |
|---|---|

## Setup

None — the canvas and the harness need no stack.

| Step | Command | In | Phases |
|---|---|---|---|

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| specs | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 .design/canvas-invana/linkcheck.py` | `.` | P03, P03b, P04, P04b, P04c, P05, P05b, P05c, P06, P06b, P07, P07b, P07c, P08, P08b, P09, P09b, P09c, P10, P11b | |
| spec tests | `python3 -m unittest discover -s scripts/specs` | `.` | P03c | |
| click-through P03b | `node .design/canvas-invana/clickthrough/run.mjs --through P03b` | `.` | P03b | |
| click-through P04 | `node .design/canvas-invana/clickthrough/run.mjs --through P04` | `.` | P04 | |
| click-through P04b | `node .design/canvas-invana/clickthrough/run.mjs --through P04b` | `.` | P04b | |
| click-through P04c | `node .design/canvas-invana/clickthrough/run.mjs --through P04c` | `.` | P04c | |
| click-through P05 | `node .design/canvas-invana/clickthrough/run.mjs --through P05` | `.` | P05 | |
| click-through P05b | `node .design/canvas-invana/clickthrough/run.mjs --through P05b` | `.` | P05b | |
| click-through P05c | `node .design/canvas-invana/clickthrough/run.mjs --through P05c` | `.` | P05c | |
| click-through P06 | `node .design/canvas-invana/clickthrough/run.mjs --through P06` | `.` | P06 | |
| click-through P06b | `node .design/canvas-invana/clickthrough/run.mjs --through P06b` | `.` | P06b | |
| click-through P07 | `node .design/canvas-invana/clickthrough/run.mjs --through P07` | `.` | P07 | |
| click-through P07b | `node .design/canvas-invana/clickthrough/run.mjs --through P07b` | `.` | P07b | |
| click-through P07c | `node .design/canvas-invana/clickthrough/run.mjs --through P07c` | `.` | P07c | |
| click-through P08 | `node .design/canvas-invana/clickthrough/run.mjs --through P08` | `.` | P08 | |
| click-through P08b | `node .design/canvas-invana/clickthrough/run.mjs --through P08b` | `.` | P08b | |
| click-through P09 | `node .design/canvas-invana/clickthrough/run.mjs --through P09` | `.` | P09 | |
| click-through P09b | `node .design/canvas-invana/clickthrough/run.mjs --through P09b` | `.` | P09b | |
| click-through P09c | `node .design/canvas-invana/clickthrough/run.mjs --through P09c` | `.` | P09c | |
| click-through P10 | `node .design/canvas-invana/clickthrough/run.mjs --through P10` | `.` | P10 | |
| click-through all | `node .design/canvas-invana/clickthrough/run.mjs --all` | `.` | P11b | |
| flow paths | `python3 scripts/specs/check.py --flows` | `.` | P11b | |

## Phases

### P01 · Settings decisions

| | |
|---|---|
| Agent | product-manager |
| Read | `.agent-reports/product-manager/platform-design-3-settings-review.md` · `/product-spec` · AC-F02 · AC-F06 · AC-F07 · AC-F08 · AC-F09 · AC-F11 · AC-F12 · CP-F02 · J09 · J12 · `specs/design-language.md` §8 |
| Stories | AC-24 · AC-25 · AC-28 · AC-29 · AC-30 · AC-31 · AC-35 · AC-36 · AC-42 · AC-43 · AC-44 · AC-45 · AC-46 · AC-47 · AC-23 · CP-03 · CP-43 · CP-63 |
| Done when | The review's *defer* and *simplify* rows are in the specs: AC-24 · AC-28 · AC-29 · AC-30 · AC-35 · AC-36 · AC-43 · AC-44 · AC-45 · AC-46 · CP-43 · CP-63 are `later` with no milestone; CP-03 names the key path on `settings.mcp`; AC-25's Screens sit on the built-in's own detail (`agents.agents` · `agents.skills` · `settings.policies`); AC-31 and AC-42 drop their `access.ledger` cells; AC-23 · AC-47 read without *Waiting on a hold* and *Took over*, a departed person's personal agents retire; AC-F11 is off J07; the features' flows and Decisions, J09 and J12, and `specs/design-language.md` §8 (Record is History, no Keeping tab; `settings.me` without Connections, Connected clients and Owners) agree; E2E-045 and E2E-055 are recorded closed by deferral in a hand-off note; AC-49 carries `milestone: MVP` (Ravi, 2026-11-20); `check.py --index` run; `check.py` 0 errors |
| Lands | The stories, features and journeys above · `specs/design-language.md` §8 · `specs/README.md` index · a hand-off note |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Set the twelve stories `later`. 2. CP-03 and AC-25 simplified. 3. Dependants (AC-23 · AC-31 · AC-42 · AC-47, CP-F02's flow). 4. Features, journeys, §8. 5. Index; check; hand-off note |

### P01b · CRUD matrix

| | |
|---|---|
| Agent | product-manager |
| Read | P01's hand-off note · `specs/glossary.md` (the nouns) · every feature's `## Engine` tables and routes · every story's Flow and `## Screens` · the gap report · `specs/milestones.md` |
| Stories | — |
| Done when | A report at `.agent-reports/product-manager/platform-design-3-crud.md`: one row per entity a person or an agent creates (project · milestone · task · branch · finding · agent · skill · workflow · schedule · model · kind · rule · standard · graph database · data store · connector · credential · plugin · pack · AI model · tracker · outside server · outside agent · person · team · policy · key · worker group · join key · alert · notification rule · dashboard · saved query · annotation · record …) × **Create · Read · Update · Delete or archive**, each cell the story and criterion, the place board · state and the `flow.<act>` that carry it, or *missing*; and per entity and per feature two more columns — **Needed for MVP?** (which MVP journey needs it, or no) and **Verdict** (keep · merge into … · cut · defer), flagging any feature whose screens, tabs or options go beyond what its stories need. Each missing cell has a recommendation — add (the story it joins), defer (`later`), or not needed (why) — with the MVP rows first, as a questions batch in *Questions for Ravi*. `## Review links` links each board and flow named |
| Lands | The report · *Questions for Ravi* |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Entities from the glossary and the engine tables. 2. Each cell from stories, Screens and flows. 3. A recommendation per gap. 4. Questions |

### P01c · Settings, slimmed

| | |
|---|---|
| Agent | product-manager |
| Read | P01's hand-off note · the P01b matrix · `.agent-reports/product-manager/platform-design-3-settings-review.md` · `specs/design-language.md` §3 and §8 · every story citing a `settings.*`, `access.*` or `shell.access` board · the mirror's Settings boards (their tabs and sections) |
| Stories | — |
| Done when | A report at `.agent-reports/product-manager/platform-design-3-settings-slim.md`: every Settings board, tab, section and field — keep · merge into … · cut · defer, with the MVP journey (J07 · J01 · J02 · J03 · J06) that needs it or none. It weighs at least: `settings.fleet` with `settings.workers`; `settings.alerts` with `settings.notifications`; `settings.policies` · `settings.agent_access` · `settings.access_now`; `settings.general` · `settings.appearance` · `settings.about`; `settings.connectors` · `settings.plugins` · `settings.packs` · `settings.mcp`; `settings.limits`. It ends with the proposed Settings — its nav, its boards, each board's tabs — as one table, and the stories each merge or cut moves or sets `later`. Questions for Ravi, recommendation first, with P01b's. `## Review links` links every board weighed |
| Lands | The report · *Questions for Ravi* |
| Boards | — |
| Review | |
| Approve | Ravi — the matrix (P01b) and the slimmed Settings, together |
| Budget | |
| Steps | 1. Inventory every Settings board, tab and section. 2. Each against the MVP journeys and its stories. 3. Merges and cuts. 4. The proposed Settings. 5. Questions |

### P02 · Spec gaps

| | |
|---|---|
| Agent | product-manager |
| Read | The gap report §2 *Story* and *Spec change* columns and §4 · P01's hand-off note · the P01b matrix, the P01c report and Ravi's answers · `/product-spec` · `/system-design` · `specs/design-language.md` §7 · *Invana Products* boards in the report's *Invana Products* column |
| Stories | CP-10 · CP-84 · CP-82 · CP-83 · CP-25 · CP-64 · CP-20 · AC-04 · AC-06 · PJ-02 · AG-42 · AG-64 · AG-38 · SE-13 · RC-13 · and every story an E2E row cites |
| Done when | §4 is in the specs: CP-10 splits *3 Join key* (Set · Expired · Used up) from one *4 Run it* row per platform and lists the five join failures under *5 Joined*; CP-84 names the form per connector and its failures, *Ready · Read + write* and *A data store*; CP-82 and CP-83 name Updated · Still old version · Removed · Applying · Upgraded and the plugin Install states; CP-25 · CP-64 · CP-20 name *Ready · Mode*, *Only Invana's runtime*, *Manifest refused*; AC-04 says Sign in again names the act it confirms and the state it returns to; PJ-02 renames *Start · Loading types*, adds *Data · found · ok · Could not connect* and *Team · Add*, and retires the legacy New modal on `projects.projects`; AG-42 names the inbox state of a schedule's result; AG-64 its Export states; SE-13 *Already resolved*; AC-06 *What would break · Per agent*; AG-38 a function's calls ×3; RC-13 *Someone else's* (E2E-007: each of the 13 states drawn, renamed or retired). Then every E2E row of a non-`later` story is swept: each state the row adds is a `Step · Substate` node in its story's `## Screens`, every result state (Saved · Attached · Revoked · Removed …) included, and each act with no flow board (CP-84 · CP-81 · CP-82 · CP-41 · CP-83 · PJ-22 · CP-03) names its `flow.<act>` board in `boards:`; wherever *Invana Products* draws a fuller flow, the spec takes it. Every P01b gap Ravi kept is written: its create, edit or delete/archive act in its story (or a new story with `/product-spec`), with its confirm, result and failure states in `## Screens` and its `flow.<act>` board in `boards:`; the gaps he deferred are `later`. Every P01c merge, cut and deferral Ravi kept is written: the stories move their `## Screens` to the board that keeps them or go `later`, and `specs/design-language.md` §8 shows the slimmed Settings. `check.py` 0 errors |
| Lands | The stories and features above · `specs/README.md` index |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. §4, MVP stories first (CP-10 · CP-25 · CP-84 · AC-04 · AC-06 · PJ-02). 2. The other §4 rows. 3. Sweep every E2E row's states into Screens, MVP journeys first. 4. Flow boards for the seven acts. 5. Index; check |

### P02b · Security criteria — the five highs

| | |
|---|---|
| Agent | product-manager |
| Read | `.agent-reports/security/platform-design-2-threat-model.md` (Step 1 findings 1–5, *Proposed criteria and NFRs*, *Open decisions*) · R587–R591 in `.claude/team/agents-recommendations.md` · `/product-spec` · `/system-design` · CP-F02 · CP-F03 · CP-F12 · CP-78 · AC-F05 · NFR-SEC-14 · NFR-SEC-15 |
| Stories | Every story the five findings name, and the MVP ones first (CP-F03 sessions · CP-09/CP-10 workers · AC-F05 asks) |
| Done when | Each high is a criterion on its feature and story, with the states it adds in `## Screens`: **R587** no connection credential in a sandbox — outside calls through the engine, branch uploads by the worker's trusted process, a per-session proxy token for the model, no code host in `net/` (NFR-SEC-17) · **R588** a worker unseals a secret or reports an outcome only under its lease — single-use grants, refused, recorded and alerted outside one; join key 1 h, joins once, never on the command line · **R589** an ask carries the hash of the exact act and expires after 15 minutes; a forced update is pinned to the approved commit; the ask and its *Expired* and *Changed since you approved* states named (NFR-SEC-18) · **R590** branch upload from a fresh bare repository, hooks off, an engine-built `<sha>:refs/heads/<ref>`, a `[a-z0-9-]` slug, checks over the whole range · **R591** every outside text is tainted (tool and A2A results, record text, loads, imports, Memory from a tainted run), taint sticks through lineage and recall, every outward act asks while any is in context, red-team cases named. Ravi's decisions written: **D1** first-party connectors only in the engine process until out-of-process connectors exist · **D2** the refresh token in an HttpOnly cookie on the refresh route only. NFR-SEC-15 widened, NFR-SEC-17 and NFR-SEC-18 in `specs/system-design.md` §3 (only this phase edits §3 in this project). R587–R591, R595 and R597 taken. `check.py` 0 errors. `## Review links` names each story and the board each new state lands on |
| Lands | The features and stories above · `specs/system-design.md` §3 · the recommendation rows |
| Deliverable | `.agent-reports/product-manager/platform-design-3-P02b.md` · `specs/os/access/features/AC-F01-sign-in-account-and-sessions/feature.md` (D2) |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. MVP findings (R589 · R588 · R587 · R591). 2. R590. 3. NFRs. 4. D1 · D2. 5. Check |

### P03 · Board engine

| | |
|---|---|
| Agent | designer |
| Read | The gap report §1 *Measured* and rows E2E-001…004 · E2E-021 · P02's AC-04 · `specs/design-language.md` §7 · `design-story` · the mirror's shared components (`LargeModal.dc.html`, the Shell*, the board runtime) and `canvas.json` |
| Stories | AC-04 · CP-11 · CP-34 |
| Done when | In the shared components, once: **a.** every choice card and radio carries a `go` to its picked state and a file drop moves to the next step (E2E-001) · **b.** a wait state carries the Outcome control (Works · Fails · Refused, or auto-advance) leading to its success or named failure (E2E-002) · **c.** a failure state holds Cancel and Retry or Back to the step that holds the cause (E2E-003) · **d.** the Sign in again hub: one state per act on `access.signin`, keyed by the act, naming it and what it will do, its button leading to that act's result state, *Wrong password* returning to the same act; every act that asks for the password again links to its own hub state, never the fixed page (E2E-004; a result state not drawn yet links to the act's List until its phase draws it) · **e.** a Lens toggle on flow boards that P10 uses (E2E-006's mechanism). Pilot: `settings.limits` end to end — Edit limits → Saving → Saved or Could not save; Clear → confirm → Cleared (E2E-021). Every board renders in both lenses; links green |
| Lands | The mirror: shared components · `access.signin` · `settings.limits` · the boards whose password-again links move · `canvas.json` |
| Boards | `access.signin` · `settings.limits` · the shared shell components |
| Review | |
| Approve | Ravi — review the phase's *Review links* before the run goes on |
| Budget | |
| Steps | 1. Card `go` and file drop. 2. The Outcome control and failure exits. 3. The Sign in again hub and its 35 links. 4. The lens toggle. 5. The `settings.limits` pilot. 6. Render check; gates; publish |

### P03b · Click-through harness

| | |
|---|---|
| Agent | designer |
| Read | P03's notes · `.design/canvas-nav-proposals/harness/shot.mjs` (its runtime and props) · the gap report §3 and §5 · every `flow.*` board · `specs/design-language.md` §7 *Done check* |
| Stories | — |
| Done when | `.design/canvas-invana/clickthrough/`: **`flows.json`** lists every `flow.<act>` board and each act P02 gave a new flow board, each with its owning phase (this project's IDs, in order P03b · P04 · P04b · P05 · P05b · P05c · P06 · P06b · P07 · P07b · P07c · P08 · P08b · P09 · P09b · P09c · P10), its start (board · view · state · lens, opened from a List or Detail), its happy path as clicks by visible label with the state each reaches, each failure and cancel path, and the Operator path where *Who can* differs; flows of `later` stories are listed `later` and skipped · **`run.mjs`** opens each board through the shot runtime, clicks live (never reads the board data), asserts every state reached, writes per-step PNGs and a JSON result to `clickthrough/out/`, and exits non-zero on a dead end, an unreached state or a page error; `--through <ID>` runs the flows of every phase up to that ID, `--flows a,b` and `--all` too · the 14 flows of §3 and P03's pilot are encoded and pass; `--through P03b` exits 0 |
| Lands | `.design/canvas-invana/clickthrough/` (`flows.json` · `run.mjs` · a README of its flags) |
| Deliverable | `.agent-reports/designer/platform-design-3-P03b.md` · `.design/canvas-invana/clickthrough/flows.json` · `.design/canvas-invana/clickthrough/run.mjs` |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. The manifest's shape and every flow listed with its phase. 2. `run.mjs` on the shot runtime. 3. Encode §3's flows and the pilot. 4. Gates |

### P03c · Spec check flags unlinked flow states (R605)

| | |
|---|---|
| Agent | coder |
| Read | R605 · `scripts/specs/check.py` · `scripts/specs/test_check.py` · `specs/design-language.md` §7 *Naming* · `.design/canvas-invana/clickthrough/flows.json` |
| Stories | — |
| Done when | `check.py` reports, for each `flow.<act>` board: a frame whose `Step · Substate` is in no `## Screens` of the stories it cites, and a `## Screens` node of those stories that no frame and no `flows.json` path reaches. Warnings by default — `check.py` stays 0 errors on today's tree; `--flows` makes them errors. A positive and a negative test in `test_check.py`; `python3 -m unittest discover -s scripts/specs` green |
| Lands | `scripts/specs/check.py` · `scripts/specs/test_check.py` |
| Deliverable | `.agent-reports/coder/platform-design-3-P03c.md` · `scripts/specs/check.py` · `scripts/specs/test_check.py` |
| Boards | — |
| Review | qa — pass 1 |
| Approve | — |
| Budget | |
| Steps | 1. Parse frames and Screens nodes. 2. The two warnings and `--flows`. 3. Tests. 4. Gates |

### P04 · Workers

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-008 · 009 · 010 · P02's CP-10 · `fleet.add.*` and `fleet.tokens` in *Invana Products* · `design-story` |
| Stories | CP-10 · CP-09 |
| Done when | E2E-008 · 009 · 010 closed on `settings.workers`: Where picked per platform; New group filled with Mint enabled; *Join key* its own step (expires in, joins at most, region) leading to one Run it per platform, Back to Join key; Join key · Expired and · Used up; Waiting to join with Cancel and its five failures; Joined with Done and Add more; Revoke → confirm → Revoked. `flow.add_workers` frames that path, both lenses |
| Lands | The mirror: `settings.workers` · `flow.add_workers` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P04.md` |
| Boards | `settings.workers` · `flow.add_workers` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Add workers steps and Join key. 2. Joining and its failures. 3. Revoke. 4. Flow board. 5. Render and click-through check; gates; publish |

### P04b · Graph databases and data stores

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-011 · 012 · 013 · 015 · 016 · P02's CP-25 and CP-84 · `shell.graph.new.*` and `settings.connections` in *Invana Products* · `design-story` |
| Stories | CP-25 · CP-26 · CP-27 · CP-35 · CP-17 · CP-38 · CP-39 · CP-41 · CP-84 |
| Done when | E2E-011 · 012 · 013 · 015 · 016 closed on `settings.databases` (and `settings.connectors` where named): a form per connector family; Test failed, Unreachable, Name taken, No connector installed, Connector failed wired; Shape Reading → Drafting → Ready; the from-files branch; Discard confirm; mode change through Sign in again to *Detail · Read + write*; Turn off, Test failed, Make practice; Connect a data store per connector with every failure, Ready · Read + write, A data store, Failing, Remove → Removed. `flow.connect_graph_database` and `flow.set_database_mode` reframed, both lenses |
| Lands | The mirror: `settings.databases` · `settings.connectors` · those two flow boards · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P04b.md` |
| Boards | `settings.databases` · `settings.connectors` · `flow.connect_graph_database` · `flow.set_database_mode` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Connect a graph database. 2. Mode, off, practice. 3. Data stores. 4. Flow boards. 5. Render and click-through check; gates; publish |

### P04c · Click-through harness, without flow boards

| | |
|---|---|
| Agent | designer |
| Read | `specs/design-language.md` §7 (*A flow is played on its place boards*, *Every design is end to end*) · `.design/canvas-invana/clickthrough/` (README · `run.mjs` · `runtime.js` · `find.mjs` · `lib.mjs` · `flows.json`) · `.design/canvas-invana/linkcheck.py` · R619 · R622 · `.design/canvas-invana/pd3p03/hub.py` (`AGAIN_BLOCK`) · P04b's report · the `## Screens` of the stories P03–P04b own · `design-story` |
| Stories | — |
| Done when | **a. The real runtime** — `run.mjs` and `find.mjs` render each board with the runtime the published canvas renders with (the canvas type's own, read from the canvas with Artifact `read`, kept under `clickthrough/`, never published) and `runtime.js` is gone; if that runtime cannot run headless, `run.mjs --published` plays the same paths on the published canvas and rule *Publish at phase end* runs it after every publish — the report says which, and why · **b. No flow boards** — every `flows.json` id is `act.<act>` and P04c is in its `phases`; `seeded`, `"board": "not drawn"` and every field taken from a flow board are gone; no step has `"click": null` — each path of a phase up to P04b encoded from its stories' `## Screens`, a later phase's flow keeps its id, act, owner, stories, rows and start, its seeded paths dropped for its owner to encode; `find.mjs --frames` removed; `linkcheck.py` no longer reads `flow.*` or `journey.*` boards · **c. The dead-button sweep** — `flows.json` maps each board to the phase that owns it; `run.mjs --through <ID>` also opens every state of every board owned up to `<ID>`, in both lenses, clicks each enabled control and fails on one that lands nowhere (no state, view, overlay or board change); `--all` sweeps every board not `later`; `--no-sweep` skips it · **d. R619 · R622** — the `access.signin` Sign in again hub's Outcome controls no longer submit its form; each lands on its act's result state, *Wrong password* on the same act · `run.mjs --through P04c` exits 0 on the real runtime with the sweep green for `access.signin` · `settings.limits` · `settings.workers` · `settings.databases` · `settings.connectors` and the shared shell components · the README states the flags, the manifest's fields and how a place phase encodes its paths · every touched board renders in both lenses; links green |
| Lands | `.design/canvas-invana/clickthrough/` (README · `run.mjs` · `find.mjs` · `lib.mjs` · `flows.json`; `runtime.js` removed) · `.design/canvas-invana/linkcheck.py` · the mirror: `access.signin` and the shared component that holds the hub · `canvas.json` (only if a board changed) |
| Deliverable | `.agent-reports/designer/platform-design-3-P04c.md` |
| Boards | `access.signin` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. The real runtime under `run.mjs` and `find.mjs` (or `--published`). 2. Re-key `flows.json` to `act.<act>`, drop the flow-board fields, encode P03–P04b's paths from their Screens. 3. `linkcheck.py` without flow and journey boards. 4. The dead-button sweep and its board map. 5. R619 · R622 on the hub. 6. README. 7. Render and click-through check; gates; publish if a board changed |

### P05 · Connectors, credentials and plugins

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-014 · 017 · 018 · 019 · 054 · P01's note (no personal connections) · P02's CP-82 and CP-64 · `settings.plugin` and `settings.connections` in *Invana Products* · `design-story` |
| Stories | CP-79 · CP-17 · CP-77 · CP-80 · CP-62 · CP-42 · CP-81 · CP-82 · CP-64 · CP-65 |
| Done when | E2E-014 · 017 · 018 · 019 · 054 closed on `settings.connectors` and `settings.plugins`: Install · Command → Checking → listed or Not found yet; a credential's Connect with Name taken, the Manage refusal, Testing and Connecting exits, Attach to agents landing in the attach modal; Test · Rotate · Remove of a work connection with results (the *Personal* part is `later`); plugin Install, Update and Remove each Checking → result; runtime Install → Installed, off → Codex installed, the Workers link carrying its state. The acts' `flows.json` paths (install a connector, add · test · rotate · remove a credential, install · update · remove a plugin, install a runtime) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: these boards · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P05.md` |
| Boards | `settings.connectors` · `settings.plugins` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Install a connector. 2. Credentials. 3. Plugins. 4. Runtimes. 5. Render and click-through check; gates; publish |

### P05b · AI models, trackers and outside servers

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-020 · 042 · 043 · `settings.llms.add` · `settings.mcp.add` · `settings.plugin` in *Invana Products* · `design-story` |
| Stories | CP-01 · CP-61 · CP-73 · CP-74 · CP-02 · CP-44 · CP-42 |
| Done when | E2E-020 · 042 · 043 closed: New AI endpoint Kind picked → Save and ping → Pinging → Proven or Ping failed → Locality → Sign in again → Local; tracker Add → Testing → Failed or Reach, the project and task tracker states reached; outside MCP server Add with None · A token · OAuth hand-off, Name taken, Listing → Tools listed → Added. The acts' `flows.json` paths (add an AI model, connect a tracker, add an outside server) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `settings.ai` · `settings.plugins` · `projects.projects` · `projects.tasks` (tracker states only) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P05b.md` |
| Boards | `settings.ai` · `settings.plugins` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. AI models. 2. Trackers. 3. Outside servers. 4. Render and click-through check; gates; publish |

### P05c · Team packs and alerts

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-053 · 058 · P02's CP-83 and CP-20 · `builder.templates` · `shell.notifications.rule*` in *Invana Products* · `design-story` |
| Stories | CP-20 · CP-83 · CP-60 · CP-59 · CP-37 · CP-45 · CP-67 |
| Done when | E2E-053 · 058 closed: pack Install → What it brings → Installing → Installed, off, with Pack clashes and Manifest refused; Upgrade → Applying → Upgraded; Remove → Removing → Removed; alert New → Filled → Saving → History alert, Out of range; notification rule and channel with Channel ready, Rule refused, Channel test failed, Refused. The acts' `flows.json` paths (install · upgrade · remove a pack, tune an alert, write a notification rule) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `settings.packs` · `settings.alerts` · `settings.notifications` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P05c.md` |
| Boards | `settings.packs` · `settings.alerts` · `settings.notifications` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Packs. 2. Alerts and notifications. 3. Render and click-through check; gates; publish |

### P06 · Access — people, teams and policies

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-022 · 023 · 024 · 025 · 026 · 027 · the settings review (*Access policies end to end*) · P02's AC-04 and AC-06 · `iam.*` in *Invana Products* · `design-story` |
| Stories | AC-18 · AC-09 · AC-39 · AC-26 · AG-35 · AC-04 · AC-06 · AC-49 · AC-11 · AC-22 · AC-12 · AC-13 · AC-08 |
| Done when | E2E-022 · 023 · 024 · 025 · 026 · 027 closed: New person and New team with Taken and the Operator refusal; agent grants Preview → Sign in again → Agent grants, Change default agent, Could not save; the policy path New · Start → What it allows → Who holds it → Review (Who it changes · What would break · Per agent) → Sign in again (Wrong password returns) → Saved, or Waiting for a second Admin when the setting is on; Attach with Pick a holder wired → Who it changes → Sign in again → Attached, Could not attach; Check from *What it may touch* → Why → Refused by a rule → Ask for more. The acts' `flows.json` paths (create an account, create a team, grant an agent, write a policy, attach a policy, check access) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `settings.people` · `settings.policies` · `settings.agent_access` · `agents.agents` (grant and default states) · `agents.runs` (refused-by-a-rule state) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P06.md` |
| Boards | `settings.people` · `settings.policies` · `settings.agent_access` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Accounts and teams. 2. Grants. 3. Write a policy. 4. Attach. 5. Check. 6. Render and click-through check; gates; publish |

### P06b · Access — asks, keys, History and leaving

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-028 · 046 · 056 · 057 · P01's note (no Keeping, no Owners, no Connected clients) · `shell.notifications.tray.*` · `iam.tokens.new` in *Invana Products* · `design-story` |
| Stories | AC-15 · AC-14 · CP-36 · CP-69 · AC-10 · AC-16 · AC-17 · AC-23 · AC-45 · AC-47 |
| Done when | E2E-028 · 046 · 056 · 057 closed: an ask's See all → Back, Send it → Sent, Not this time → Declined, Send failed, Already decided, the dropdown row opening the same ask; New key Name taken, Only you as owner, Your password · Wrong password, Copy → Copied → Done → Keys; History's verify act raising Chain broken; Export → Sign in again → Exporting → Exported, Deactivate → Sign in again → Deactivated, Export first and Could not save (the hold and *Took over* parts are `later`). The acts' `flows.json` paths (decide an ask, mint a key, read and verify History, deactivate a person) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `inbox` · `inbox.dropdown` · `settings.me` · `settings.history` · `settings.people` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P06b.md` |
| Boards | `inbox` · `inbox.dropdown` · `settings.me` · `settings.history` · `settings.people` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Asks. 2. Keys. 3. History. 4. Leaving. 5. Render and click-through check; gates; publish |

### P07 · Sign in and start

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-005 · 029 · 030 · P01's note (`access.consent` is `later`) · `shell.login` · `shell.first_run` · `shell.onboarding.*` in *Invana Products* · `design-story` |
| Stories | AC-01 · AC-34 · CP-22 · CP-24 · CP-30 · CP-68 · CP-70 · CP-72 |
| Done when | E2E-005 · 029 · 030 closed: Sign in → Signing in → `start.home`, or Could not sign in · Locked · Too many requests · No account; Session ended → Sign in again; `start.home` First use → Demo data → Set-up → Set-up · Two of four → Continue set-up → `settings.databases · Connect`, the typed question → Drafting below, Ask an Admin for the Operator; the switcher, the palette, Operations, the Agents glance and the Inbox dropdown each open their target in the state its story's `## Screens` names. The acts' `flows.json` paths (sign in, first run, the command palette and the shell glances) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `access.signin` · `start.home` · `shell.*` boards · `inbox.dropdown` (links only) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P07.md` |
| Boards | `access.signin` · `start.home` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Sign in. 2. First run. 3. Shell glances. 4. Render and click-through check; gates; publish |

### P07b · Draft, publish and load a model

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-031 · 032 · 033 · `modeller.models.new*` · `modeller.draft*` · `datasets.upload*` in *Invana Products* · `design-story` |
| Stories | SE-04 · SE-06 · SE-15 · SE-05 · SE-08 · SE-20 · RC-08 · RC-09 · RC-10 |
| Done when | E2E-031 · 032 · 033 closed: Connect · Shape → Draft · Arriving across boards; How to start with each choice its own branch; Arriving and Reading exits; Discard → confirm → Discarded; Publish · Checking → Publish or Breaking → Published, Waiting on approval → the Inbox ask → Approve → Published, Refused and Review failed; Upload Drop → File chosen → Preview → Load → Loading → Started → the load's run, with Not rows · Cannot read · Licence missing · Refused rows · Unchanged. The acts' `flows.json` paths (draft a model, publish a model, upload a file) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `model.models` · `data.loads` · `inbox` (publish approval) · `agents.runs` (load detail) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P07b.md` |
| Boards | `model.models` · `data.loads` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Draft. 2. Publish. 3. Upload. 4. Render and click-through check; gates; publish |

### P07c · Ask, share, query and annotate

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-034 · 035 · 064 · 065 · P02's RC-13 · `explorer.answer*` · `explorer.board.annotate.*` in *Invana Products* · `design-story` |
| Stories | EX-01 · EX-02 · EX-03 · EX-04 · EX-05 · EX-06 · EX-23 · EX-25 · EX-15 · EX-12 · EX-17 · RC-13 · RC-07 · EX-08 · GP-05 |
| Done when | E2E-034 · 035 · 064 · 065 closed: Ask → Working → Answered, ask back, not held or refused; Answered → Why → the run's Answer; Share → Export and its four failures resolving to drawn states; Add to a project → Adding → added → the branch's Finding; Annotate → Saving → `data.annotations`, *Someone else's* named once; Console → Rows → `explore.queries`. The acts' `flows.json` paths (ask, share an answer, annotate, write a query) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `explore.board` · `explore.queries` · `data.annotations` · `agents.runs` (answer) · `projects.branches` (finding) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P07c.md` |
| Boards | `explore.board` · `explore.queries` · `data.annotations` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Ask. 2. Share and add to a project. 3. Annotate and the console. 4. Render and click-through check; gates; publish |

### P08 · Create a project and its settings

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-038 · 039 · 040 · P02's PJ-02 · `shell.graph.new.*` and `projects.project` in *Invana Products* · `design-story` |
| Stories | PJ-02 · PJ-23 · PJ-34 · PJ-22 · PJ-33 · PJ-35 · PJ-36 |
| Done when | E2E-038 · 039 · 040 closed: `projects.new` Start (grid, From a project, Type needs a connector with Next off) → About (Slug taken, Drafting, Filled) → Data (Loading, Could not load, Testing → holds data · empty · Could not connect) → Team (Add, New policy) → Review (Refused) → Create → `projects.projects · Detail · Just created`, and Discard confirm; the legacy New modal retired; project settings' every state reached from the act that raises it, the Operator's Not on the team and Withheld. The acts' `flows.json` paths (create a project, the project settings) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `projects.new` · `projects.projects` · `projects.settings` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P08.md` |
| Boards | `projects.new` · `projects.projects` · `projects.settings` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Start and About. 2. Data. 3. Team and Review. 4. Retire the legacy modal. 5. Project settings. 6. Render and click-through check; gates; publish |

### P08b · Tasks, branches and the project's work

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-036 · 037 · 066 · 067 · 068 · `projects.todo*` · `projects.branch.*` · `projects.finding` in *Invana Products* · `design-story` |
| Stories | PJ-12 · PJ-15 · PJ-18 · PJ-25 · PJ-04 · PJ-05 · PJ-06 · PJ-07 · PJ-08 · PJ-21 · PJ-24 · PJ-26 · CP-78 |
| Done when | E2E-036 · 037 · 066 · 067 · 068 closed: New task Pick a kind → Assign → Saving → the task → Claimed → In review → the Inbox result → Accept → Done, Agent not granted; Finding New → Filled → added; Fork → the new branch; Finding → Decide → Recording → decided; Merging exit; the assistant thread → Proposals → the Inbox proposal; Ask for help Loading; Milestones · Ready to accept; Pull request → the Inbox push → Review comment → Merged. The acts' `flows.json` paths (write a task, fork and decide, ideate a project, make a milestone, fix through a pull request) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `projects.tasks` · `projects.branches` · `projects.projects` · `projects.graph` · `inbox` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P08b.md` |
| Boards | `projects.tasks` · `projects.branches` · `projects.graph` |
| Review | |
| Approve | Ravi — review the phase's *Review links* before the run goes on |
| Budget | |
| Steps | 1. Tasks. 2. Branches and findings. 3. Assistant, milestones, pull requests. 4. Render and click-through check; gates; publish |

### P09 · Agents — create, publish, skills, import

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-044 · 047 · 048 · 049 · 052 · P02's AG-64 and AG-38 · `builder.*` · `settings.remote_agents.add` in *Invana Products* · `design-story` |
| Stories | AG-33 · AG-21 · AG-26 · AG-29 · AG-61 · AG-36 · AG-19 · AG-37 · AG-40 · AG-38 · AG-64 · AG-39 · AG-63 · AC-25 |
| Done when | E2E-044 · 047 · 048 · 049 · 052 closed: Outside → Add → Reading the card → Card read · unreadable · version refused → Added, off, with Wrong password retry; New agent Type → Details → Saving → Created → Unchecked draft, Proposal and Runs with reached, Name taken; Versions → Draft → Run the evals → Published, Rolled back, Publish refused; skill template sections and Rubric open, Model version framed; Import → Reading → Mapping → Confirm → Installed, off → Waiting to apply; Export Writing · Disabled · Refused; a built-in's *Copy to change it* on its own detail (AC-25 after P01). The acts' `flows.json` paths (add an outside agent, create an agent, publish an agent, create a skill, import agents) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `agents.agents` · `agents.skills` · `settings.packs` (import landing) · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P09.md` |
| Boards | `agents.agents` · `agents.skills` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Create and publish an agent. 2. Skills. 3. Outside agents. 4. Import and export. 5. Render and click-through check; gates; publish |

### P09b · Agents — schedules, runs, adopt, stop

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-050 · 051 · 069 · 070 · P02's AG-42 · `shell.schedule.*` · `builder.skill.test` · `activity.run.*` in *Invana Products* · `design-story` |
| Stories | AG-42 · AG-44 · AG-20 · CP-56 · AG-51 · AG-52 · CP-58 |
| Done when | E2E-050 · 051 · 069 · 070 closed: New schedule Ask first or Allow → Saving → A schedule, the result's Inbox state; Workflow Run → checking → Started by name → Asks first; Step failed → From a run → Request a change; Suggested change → Evidence → History; Stop run → Stopping → Stopped → the Inbox's Run stopped. The acts' `flows.json` paths (schedule work, run a workflow, adopt into a skill, decide a suggested change, stop a run) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `agents.schedules` · `agents.skills` · `agents.runs` · `inbox` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P09b.md` |
| Boards | `agents.schedules` · `agents.runs` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Schedules. 2. Workflows. 3. Adopt and suggested changes. 4. Stop. 5. Render and click-through check; gates; publish |

### P09c · Model rules and Graph Data

| | |
|---|---|
| Agent | designer |
| Read | Rows E2E-041 · 059 · 060 · 061 · 062 · 063 · P02's SE-13 · `modeller.rules.*` · `modeller.models.import*` · `datasets.*` in *Invana Products* · `design-story` |
| Stories | RC-11 · SE-12 · SE-13 · SE-22 · SE-03 · SE-16 · SE-17 · SE-18 · SE-19 · RC-02 · RC-12 · RC-03 · RC-04 |
| Done when | E2E-041 · 059 · 060 · 061 · 062 · 063 closed: Add by hand Kind → Saving → Saved, Records refused · Key missing · Too many; rule New → Counting → Impact → Save → Never offered, Requests → Resolve → Already resolved; Link joins → counting · loading · refused → staged; Export → Exporting → Redacted or failed; Restore → Reading → Preview → Draft · Restored; Import a standard → No terms yet → Hold to a standard; Checks → Fix → Fixing → Fixed, Fix refused, Changed meanwhile; Fix many → Building preview → Running → Written · Partly written · Refused; Merge → Merging → Merged. The acts' `flows.json` paths (add records, write a rule, link models, export and import a model, import a standard, decide quality, fix records) encoded from their stories' `## Screens`, both lenses |
| Lands | The mirror: `model.rules` · `model.inference` · `model.models` · `model.standards` · `data.loads` · `data.quality` · `data.records` · `flows.json` entries · `canvas.json` |
| Deliverable | `.agent-reports/designer/platform-design-3-P09c.md` |
| Boards | `model.rules` · `model.standards` · `data.quality` · `data.records` |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Records by hand and fixes. 2. Rules. 3. Links, export, restore. 4. Standards and quality. 5. Render and click-through check; gates; publish |

### P10 · Operator paths, journeys in the manifest, flow and journey boards deleted

| | |
|---|---|
| Agent | designer |
| Read | Row E2E-006 · P04c–P09c's notes · `specs/design-language.md` §7 · `specs/journeys/` · `flows.json` · R626 |
| Stories | — |
| Done when | E2E-006 closed: every flow whose stories have Operator rows has its `kind: "operator"` path in `flows.json` (the refused or disabled state), MVP flows first; each act P02 named (CP-84 · CP-81 · CP-82 · CP-41 · CP-83 · PJ-22 · CP-03) has its flow; every journey J01–J14 is an ordered list of its flows in `flows.json`, matching its `specs/journeys/` diagram, and `run.mjs --journeys` plays each in order; flows of `later` stories listed `later`. Then every `flow.*` and `journey.*` board is deleted — removed from the mirror, `canvas.json` and `Main.dc.html`, the publish sending `null` for each — once no spec cites one (R626, the product-manager, first); links and `check.py` green; `--through P10` exits 0 |
| Lands | The mirror: `Main.dc.html` · `canvas.json` · the `flow.*` and `journey.*` files removed · `flows.json` entries · `clickthrough/` (`--journeys`) |
| Deliverable | `.agent-reports/designer/platform-design-3-P10.md` |
| Boards | — (deletes `flow.*` · `journey.*`) |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. Operator paths, MVP first. 2. The seven acts' flows. 3. Journeys in the manifest and `--journeys`. 4. Delete the flow and journey boards and their Index entries. 5. Render and click-through check; gates; publish with `null` for each deleted board |

### P11 · End-to-end QA

| | |
|---|---|
| Agent | qa |
| Read | `specs/design-language.md` §7 · the gap report (every row and §5) · every phase's hand-off notes · `flows.json` · `design-qa` |
| Stories | — |
| Done when | A report at `.agent-reports/qa/platform-design-3-clickthrough.md`, line 1 `RESULT: PASS` or `FAIL`: `run.mjs --all` (every path and the dead-button sweep) and `run.mjs --journeys` run and their results; by hand, each flow of §5 *Unverified* and each MVP flow clicked start to result and through each failure, both lenses; each E2E-001…070 checked closed (or closed by deferral); every `## Screens` node of a non-`later` story reached; `later` boards untouched. Each finding names the flow, the board, the state and the fix, for P11b |
| Lands | The report · recommendations |
| Deliverable | `.agent-reports/qa/platform-design-3-clickthrough.md` |
| Boards | — |
| Review | |
| Approve | — |
| Budget | |
| Steps | 1. The harness, all flows. 2. §5 and MVP flows by hand. 3. E2E rows and Screens coverage. 4. Findings |

### P11b · Close the findings and publish

| | |
|---|---|
| Agent | designer |
| Read | P11's report · `design-story` · `flows.json` |
| Stories | — |
| Done when | Every P11 finding closed, or raised as a recommendation with why not; `run.mjs --all` and `check.py --flows` exit 0; every board renders in both lenses; the final mirror published to the canvas; the package for Ravi at `.agent-reports/designer/platform-design-3-package.md` — the canvas URL and version, each journey, the flows per phase, the deferrals, open questions |
| Lands | The mirror · the package report |
| Deliverable | `.agent-reports/designer/platform-design-3-P11b.md` |
| Boards | every board |
| Review | |
| Approve | Ravi — review the phase's *Review links* before the run goes on |
| Budget | |
| Steps | 1. Findings, MVP first. 2. Full gates. 3. Publish. 4. Package |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Settings decisions |  | done | 2026-11-20 | gates green · reviews passed |
| P01b | CRUD matrix | P01 | done | 2026-11-20 | gates green · reviews passed |
| P01c | Settings, slimmed | P01b | done | 2026-11-20 | gates green · reviews passed |
| P02 | Spec gaps | P01c | done | 2026-11-20 | gates green · reviews passed |
| P02b | Security criteria — the five highs | P02 | done | 2026-11-20 | gates green · reviews passed |
| P03 | Board engine | P02b | done | 2026-11-20 | gates green · reviews passed |
| P03b | Click-through harness | P03 | done | 2026-11-20 | gates green · reviews passed |
| P03c | Spec check flags unlinked flow states (R605) | P03b | done | 2026-11-20 | gates green · reviews passed |
| P04 | Workers | P03b | done | 2026-11-20 | gates green · reviews passed |
| P04b | Graph databases and data stores | P04 | done | 2026-11-20 | gates green · reviews passed |
| P04c | Click-through harness, without flow boards | P04b | pending |  | R619 · R622 |
| P05 | Connectors, credentials and plugins | P04c | pending |  | E2E-014 · 017 · 018 · 019 · 054 |
| P05b | AI models, trackers and outside servers | P05 | pending |  | E2E-020 · 042 · 043 |
| P05c | Team packs and alerts | P05b | pending |  | E2E-053 · 058 |
| P06 | Access — people, teams and policies | P05c | pending |  | E2E-022 · 023 · 024 · 025 · 026 · 027 |
| P06b | Access — asks, keys, History and leaving | P06 | pending |  | E2E-028 · 046 · 056 · 057 |
| P07 | Sign in and start | P06b | pending |  | E2E-005 · 029 · 030 |
| P07b | Draft, publish and load a model | P07 | pending |  | E2E-031 · 032 · 033 |
| P07c | Ask, share, query and annotate | P07b | pending |  | E2E-034 · 035 · 064 · 065 |
| P08 | Create a project and its settings | P07c | pending |  | E2E-038 · 039 · 040 |
| P08b | Tasks, branches and the project's work | P08 | pending |  | E2E-036 · 037 · 066 · 067 · 068 |
| P09 | Agents — create, publish, skills, import | P08b | pending |  | E2E-044 · 047 · 048 · 049 · 052 |
| P09b | Agents — schedules, runs, adopt, stop | P09 | pending |  | E2E-050 · 051 · 069 · 070 |
| P09c | Model rules and Graph Data | P09b | pending |  | E2E-041 · 059 · 060 · 061 · 062 · 063 |
| P10 | Operator paths, journeys in the manifest, flow and journey boards deleted | P09c, P03c | pending |  | E2E-006 |
| P11 | End-to-end QA | P10 | pending |  |  |
| P11b | Close the findings and publish | P11 | pending |  |  |

## Hand-off notes

What a later phase must know that the code does not say. One row per note, newest last.

| ID | Note |
|---|---|
| — | Part 2 ended with the canvas at version 53, every flow drawn but none strictly end to end (gap report §1): 113 choice states with no click, 78 wait states with no exit, 107 failure states with no inbound, 35 password-again links to one fixed page, 41 flows with no Operator frame |
| — | Each E2E row is closed by exactly one phase (the Log's Notes). E2E-001…003 are P03's mechanism; the *card row*, *wait row* and *failure row* parts of a per-act row are closed by that row's phase with P03's mechanism |
| — | The settings deferrals (the settings review) are applied by P01 with the recommendation, before Ravi has answered; they are reversible — a `later` story goes back to `idea` and its boards are wired in a later project |
| — | Models: the run starts with `INVANA_RUNNER_LEAD_MODEL=opus` — every build session (product-manager, designer, the P03c coder and the P11 QA build) runs on Opus; fix rounds and QA review passes on Sonnet (`INVANA_RUNNER_CHEAP_MODEL`). The runner has no per-phase model (Questions) |
| — | The project branch `feat/platform-design-3` is made off the tip of `platform-design-2/P19-build-plan` before `--start`; the runner forks phase branches from it, never merges or pushes |
| — | The run stops for Ravi after P01c, P03, P08b and P11b (rule *Four stops for Ravi*). At P01c he kept every recommendation: S1–S6 and Q1–Q11 all (a), Q10 — non-MVP features stay drawn. After P08b's review the MVP stories move to `designed` and the build plan is written; P09–P11b run later |
| P01b | The matrix is [platform-design-3-crud](../../../../.agent-reports/product-manager/platform-design-3-crud.md): 88 entities, 24 *missing* cells, 25 MVP gaps (G-A·· and G-B··, checked against the specs). No spec changed. Q1–Q11 (P01b rows) wait for Ravi at P01c's stop; P02 writes what he keeps, by gap ID. P01c folds G-A25 (boards drawn for `later` stories) and the *Beyond its stories?* column of §1 *Features* into its Settings weighing. G-A28 (which story reads the run on J06's `agents.runs`) is unverified — P02 settles it. The session could not write project.md (sensitive path refused unattended) — these rows came from the report |
| P01c | Proposal only — nothing changed in specs or the mirror. Ravi decides S1–S6 with P01b's Q1–Q11. For each move he keeps: P02 rewrites the stories (CP-47 → CP-34 · CP-60.8–.12 → CP-37 · AC-48 Screens · CP-71 Screens · CP-73 · CP-74 · CP-80 · CP-81 Screens), J07 step 6, `design-language.md` §3 and §8; P03 changes the large-modal nav (Settings: General · You · Connections · Plugins · Workers · Alerts and notifications; Access: Who · What they may do · Record — the *Keeping* item goes whatever he answers, P01 parked it); the owning place phase moves the states and removes `settings.fleet` · `settings.appearance` · `settings.access_now` (project rule *Settings merges*, `null` on publish). If he keeps none, every board stays and only *Keeping* leaves the nav. P01's and P01b's notes are in their reports (*Hand-off note* · *For the project file*) |
| P02b | **Resume at step 4, D2:** the refresh token in an HttpOnly cookie on the refresh route (R597) — Ravi's D2 (a). Steps 1–3 and D1 are done (commit `64cc31dbf`); `grep -rl HttpOnly specs` finds nothing yet. Report: [platform-design-3-P02b](../../../../.agent-reports/product-manager/platform-design-3-P02b.md) |
| P03 | Done, canvas v55. The engine is `.design/canvas-invana/pd3p03/` — which script a later phase runs again, and what is not repointed on purpose: the report's *Hand-off note*, [platform-design-3-P03](../../../../.agent-reports/designer/platform-design-3-P03.md) |
| P04b | Resume from the hand-off note in [platform-design-3-P04b.md](../../../../.agent-reports/designer/platform-design-3-P04b.md). |

## Questions for Ravi

The project-lead's, batched. Answered rows stay until the phase they unblock is done.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-20 | P01 | Connected clients (AC-35 · AC-36) | (a) defer OAuth clients; a client connects with a key (CP-03 · AC-10) · (b) keep | (a) | Ravi: (a) — applied by P01 |
| 2026-11-20 | P01 | Record in Access (History · Usage · What left) | (a) History only; defer Usage (AC-28 · AC-29) and What left (AC-30) · (b) keep all three · (c) defer History too | (a) | Ravi: (a) — applied by P01 |
| 2026-11-20 | P01 | Keeping (AC-44 · AC-45 · AC-46) | (a) defer; everything is kept; AC-47 export stays · (b) keep · (c) cut | (a) | Ravi: (a) — applied by P01 |
| 2026-11-20 | P01 | Your connections (CP-43 · CP-63) | (a) defer; work connections carry every outside call · (b) keep | (a) | Ravi: (a) — applied by P01 |
| 2026-11-20 | P01 | Owners (AC-24 · AC-25 · AC-43) | (a) defer the Owners tab and adoption; Copy on the built-in's detail; the ownership rule stays · (b) keep · (c) cut AC-F07 | (a) | Ravi: (a) — applied by P01 |
| 2026-11-20 | P01 | AC-49 (*New policy* from a template) starts the MVP policy path but has no milestone | (a) `milestone: MVP` · (b) leave unplanned | (a) | Ravi: (a) — P01 adds `milestone: MVP` |
| 2026-11-20 | Start | R603 (design-story) and R604 (design-qa) edit `.claude/skills/` — team rules no agent may edit | (a) Ravi applies both in a short session before `--start` · (b) after the run; the project's rules and P11 already hold the end-to-end rule | (b) — the run does not depend on them | Ravi: (b) — 2026-11-20 |
| 2026-11-20 | P11 | The runner runs every build session on `INVANA_RUNNER_LEAD_MODEL`, so P11's QA build runs on Opus, not Sonnet | (a) accept · (b) run P11 alone with `--only P11` and the lead model `sonnet` (pauses the run) · (c) a per-phase *Model* row in the runner first (R055, a `.claude/` edit) | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q1 · MVP journeys use stories with no `milestone: MVP`: CP-61 (J07 step 4) · PJ-02 (J03) · EX-07 (J01 J02) · PJ-05 (J03) · SE-02 (J01) · RC-01 (J02) · EX-10 reopen (J02) — [CRUD report](../../../../.agent-reports/product-manager/platform-design-3-crud.md) *MVP gaps* | (a) tag all seven MVP in P02 · (b) restate the needed act in the MVP story instead · (c) leave | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q2 · AC-22.4 lets an Admin attach a policy to a person; AC-11.9 (and AC-09.8) say there is no such act | (a) policies attach to agents only: AC-22 drops its attach act, `flow.attach_policy` agents only · (b) allow it: AC-11.9 and AC-09.8 change | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q3 · MVP acts with criteria and no flow frame: CP-81 · CP-82 · CP-41 · worker drain, join-key revoke (CP-09) · policy delete (AC-04.8 · AC-06.10) · team delete (AC-09.9) | (a) P02 names a `flow.<act>` per act; P04 · P04b · P05 · P06 frame it · (b) defer the acts | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q4 · Four MVP criteria or states missing: task edit (PJ-12) · kind and property rename (SE-05.2) · archive confirm and Archived (PJ-01.9) · Stop sharing (EX-15.14) | (a) add in P02 · (b) defer | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q5 · J01's refusal of a sensitive property to an outside AI needs a sensitivity level; only SE-20 (not MVP) sets one | (a) pull SE-20's sensitivity criteria into MVP · (b) drop the branch from J01 | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q6 · J02's node *Ask a Modeller* has no criterion that creates a model request (SE-13 not MVP) | (a) drop the node · (b) add an EX-05 criterion opening an SE-13 request | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q7 · Two stories for one act: CP-17 / CP-79 · CP-62 / CP-80 · PJ-35 / PJ-37 | (a) merge into CP-79 · CP-80 · PJ-37 in P02 · (b) keep apart | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q8 · J07's *agents reach outside* branch (CP-04 · CP-79 · CP-80 · CP-81 · CP-82) serves no other MVP journey | (a) keep in MVP · (b) move out of J07 | (a) — J07 is confirmed; the branch allows *not yet* | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q9 · 24 non-MVP gaps (report *Not MVP — one batch*) | (a) as the report lists: defer, or not needed with the reason; P02 rewords *archived or deleted* (PJ-19.3 · AC-F10) · (b) add them now | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q10 · Whole features with no MVP journey (report *Features* tables) | (a) record only — they stay `idea`, unplanned · (b) set them `later` (not drawn) | (a) — `later` would cut drawing the project's goal carries | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01b | Q11 · Tabs beyond their stories: `projects.projects` Details and Task kinds duplicate `projects.settings · General`; the `explore.board` Export rail has no story found | (a) merge the duplicate into `projects.settings` (P08); P02 names a story for Export or retires it · (b) keep both | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S1 · Fleet repeats Limits › Usage (CP-47 vs CP-34) and draws a Map no story asks for — [report](../../../../.agent-reports/product-manager/platform-design-3-settings-slim.md) | (a) Workloads into Limits › Usage, CP-47 into CP-34, Map cut, Fleet leaves the nav · (b) keep · (c) keep Map, merge Workloads | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S2 · History alerts (CP-60.8) and notification rules (CP-37) are both "when X, tell Y"; Alerts sit under Workers | (a) History alerts become a rule trigger; one section *Alerts and notifications* · (b) fold History alerts only · (c) keep apart | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S3 · Access › Now (AC-48) repeats the header's Access dropdown and History | (a) remove it: acting now → `shell.access`, blocked today → History · Refused · Today, revoke a delegation → the agent's page · (b) keep | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S4 · General · Appearance · About are three places for CP-71 | (a) Appearance goes: default theme → General, your theme → You; About stays the nav foot · (b) one General page · (c) keep three | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S5 · Trackers sit under Plugins though a tracker is a connected code host (CP-77) | (a) move to Connections › Connectors · (b) keep | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P01c | S6 · A connector's credential is made on Connectors and managed on Plugins (J07 step 6) | (a) one home, the connector's Detail · (b) as drawn | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P02b | D1 · third-party connectors in the engine process (R595) | (a) first-party only until out-of-process connectors exist · (b) allow, hash-approved | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P02b | D2 · where the refresh token lives (R597) | (a) HttpOnly cookie on the refresh route · (b) keep in local storage | (a) | Ravi: (a) — 2026-11-20 |
| 2026-11-20 | P02b | R587–R591 · the five high threat findings | (a) write each as criteria and NFRs before the board phases · (b) after P08b | (a) | Ravi: (a) — 2026-11-20 |
