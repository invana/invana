---
name: specs-m4
status: done
branch: chore/specs-m4
scope: specs-m4
---

# Specs M4 — every feature in the code and every stale requirement in a live spec

Makes the documentation complete before any more code work: every feature the code has today is a story, and every
requirement, decision and piece of engine design still sitting in `specs/_stale/` is written into the live spec that
owns it — `specs/os/<part>`, `specs/capabilities/<pkg>`, `specs/journeys` or `specs/system-design` — or is retired or
kept with its reason. Spec only. For everyone who specifies, draws, builds and checks Invana.

| | |
|---|---|
| Goal | Every engine app and router, every Studio package and every integration has a story ID in a coverage table · every file under `specs/_stale/` is disposed — merged into a live spec, retired with its reason, or kept with its reason in `specs/_stale/README.md` or `code.md` · `_stale/` holds only the kept files · stale decisions sit in the owning `feature.md` or `product.md` › Decisions and stale engine design in `specs/system-design/**` under the package names · journeys string the stories the code serves · `.agent-reports/product-manager/specs-m4-coverage.md` is the final report |
| Specs | Every product in `specs/os/` (graph GR · access AC · runtime RT) and `specs/capabilities/` (model MO · data DA · datasets DS · agents AG · explore EX · projects PJ) · `specs/journeys/` · `specs/system-design/**` · `specs/_stale/**` · recommendations R116 · R127 · R130 |
| Not in this project | Any change to `engine/`, `studio/`, `integrations/`, `scripts/`, `demos/`, `docker/`, tests or changesets · boards and the canvas · moving any story to `specified` or above (Ravi's spec review, after the run) · changing a criterion of a story at `designed` or above (a flag only) · m3-code's own doc phases — the citation map (D04), glossary fixes (D05), Studio specs renamed (D06), `docs/` in package names (D03) · `docs/**` · team files — `CLAUDE.md`, `.claude/**` · Ask, Memory, Workflows or Operate as spec modules or products |

Run it: `python3 .claude/skills/run-project/run.py specs-m4` (the project-lead does, with `--start`). Start it on the
branch the checkout is on: the runner cuts `chore/specs-m4` there and stacks each phase on its own
`specs-m4/<ID>-<slug>` branch. No phase pauses; Ravi reviews the stacked branches and the coverage reports at the end.

## Rules for every session

| Rule | Detail |
|---|---|
| Full auto | No phase waits for a person and no session sets its row `blocked` to ask. Every question is settled in *Questions for Ravi* (all approved as recommended). A point they do not settle is decided by the option closest to `specs/vision.md`, `specs/system-design/architecture.md` and these rules, and written as a hand-off note |
| Spec only | A phase writes `specs/**` (but `specs/_stale/` until P13), its own `.agent-reports/product-manager/specs-m4-*.md`, its hand-off notes and recommendations (`add.py`). Never code, tests, changesets, boards, `docs/` or team files |
| `_stale` is a source, never a citation | `specs/_stale/` is read only, by the phase the register assigns each file to, to extract what it holds. No live spec links to, cites or names a `_stale` path — not even in a code span. Only P13 edits or deletes in `_stale/` |
| The register governs | From P01, `.agent-reports/product-manager/specs-m4-plan.md` › *Register* assigns every stale file and every code unit to exactly one phase and its coverage file. A phase disposes its own rows; a row that belongs elsewhere is a hand-off note naming the phase that takes it, never a second disposal |
| The recipe governs | From P02, the plan file's *Recipe* and *Coverage format* are the method. P02 may change them, with a hand-off note; later phases follow them as written |
| The product-spec skill, unattended | Load `.claude/skills/product-spec/SKILL.md` and `format.md` before writing. No interview and no spec review: decide each question with the option you would recommend and record it in the Decisions table it governs, and in the coverage file's *Flags* when Ravi should see it. Areas are `specs/os/<part>/` and `specs/capabilities/<pkg>/` (where `format.md` says `products/` and `foundation/`, follow the tree) |
| Honest status | A story written for a feature the code has but no spec names is `idea`, with all five parts — *As / I want / so that* · *Who can* with an Admin and an Operator row · a mermaid *Flow* · Given/When/Then criteria with a refusal row for the Operator · `## Screens` with every cell a board (`<pkg>.<surface>.<variant>`) or `—` — and an empty `task.md` from the template. Never `specified` or above. It joins the feature that owns it; a new feature only when none does. A feature whose status falls with it is listed in the hand-off note |
| Breaking changes are flags | A criterion of a story at `designed` or above that the code or a stale file contradicts is not changed: it is a row in the coverage file's *Flags* and a line in the phase's hand-off note. Reversing or narrowing a recorded decision, retiring or merging a story, moving a feature between products, changing a glossary word — the same |
| Retired concepts stay retired | Ask, Memory, Workflows and Operate are not modules or products. What their code does belongs to its owner today: `apps/flows` and `runtime/workflows.py` — the plan and flow library — to agents (AG-F06) · `activity/managers/ask_gate.py` and `activity/querysets/asks.py` — the approval and ask gate — to access (AC-F05) and agents (AG-F05) · memory only as a model starter (MO-F01) and what EX-F07 already says · Operate's parts to access (ledger, history, approvals), graphs (notifications), agents (runs, schedules, outside agents) and `specs/system-design/observability.md` |
| Package names | Engine design goes into `specs/system-design/**` under the names in `architecture.md` › *One name across layers* and *The rename map*: tables `<pkg>_<records>`, routes `/api/v1/u/{u}/{g}/<pkg>/<records>`, actions and events `<pkg>.<records>.<verb>`. The coverage file names code by its path today, with its new name beside it |
| Decisions | Present tense, no history, no decision IDs, in the Decisions table of the `feature.md` or `product.md` they govern. A decision a live spec already holds is not written twice |
| Specs never link into code | Code paths are code spans, never markdown links |
| Close the recommendations | P09b closes R116, P12b R127, P11 R130 with `python3 .claude/skills/recommend/add.py done <ID>` once the work is in. Anything found outside the phase is raised with `add.py`, never fixed on the way |
| Deleting files | P13 deletes with `python3 -c` (pathlib `unlink`, one call per batch) — neither `rm` nor `git rm` is an allowed command in a headless session |
| No pipes, no `rg` | A shell command is one call with no `&&`, `;`, pipe or `$(…)`; search with `grep` |
| Team files are Ravi's | `CLAUDE.md` and `.claude/**` (but this file's Log and hand-off notes, and `add.py`) are never edited and never block a phase. A team-file change a phase needs is a hand-off note and a recommendation |
| One commit per phase | The runner's closing `feat(specs-m4)` commit is the phase's commit. A session commits its `wip` only when it stops — at the end or at a hand-off — never per step |
| Budget | 300k a session. Past it, hand off with the plan file's row-by-row progress — never cut scope |

## Assignment

Which phase owns which stale file. P01 expands it into the register, one row a file; a code unit goes to the phase of
its package in `architecture.md` › *The rename map* (target name, not the m3-code phase). Stale paths are under
`specs/_stale/docs/`.

| Phase | Coverage file | Stale files | Code |
|---|---|---|---|
| P02 projects | `specs-m4-projects.md` | `for-developers/modules/work/**` · `products/projects.md` · `docs/studio/simulation-board.md` | `projects` |
| P03 graphs | `specs-m4-graphs.md` | `products/onboarding.md` · `products/shell.md` · `products/platform.md` · `for-developers/modules/platform/features/{search,setup}.md` · `for-developers/modules/operate/features/notifications.md` | `graphs` · `studio/packages/shell` |
| P04 access | `specs-m4-access.md` | `for-developers/modules/identity-and-access/**` · `products/iam.md` · `for-developers/modules/operate/features/{audit-and-activity,the-ledger,approvals,change-log}.md` | `access` · `studio/packages/activity` |
| P05 runtime | `specs-m4-runtime.md` | `for-developers/modules/graph-connectors/**` · `for-developers/modules/platform/features/{plugins,tool-plugins,mcp-plugins,this-graphs-mcp-server,distributed-execution}.md` · `products/{plugins,scale-out}.md` · `for-developers/modules/agents/features/{providers-and-models,workers,concurrency-and-contention}.md` | `runtime` · `plugins` · `integrations/*` |
| P06 model | `specs-m4-model.md` | `for-developers/modules/connect-and-model/**` · `for-developers/modules/govern/**` · `products/modeller.md` · `docs/studio/modelling.md` | `model` |
| P07 datasets | `specs-m4-datasets.md` | `for-developers/modules/bring-data-in/**` · `products/datasets.md` | `datasets` |
| P08a agents · agents and runs | `specs-m4-agents-a.md` | `for-developers/modules/agents/**` (but the three P05 files) · `products/{agents,agent-builder,agent-fabric}.md` · `for-developers/modules/operate/features/{see-what-ran,external-agent-api}.md` | `agents` — agents, runs, evals, delegation, fleet, the AI model client |
| P08b agents · skills, plans and schedules | `specs-m4-agents-b.md` | `for-developers/modules/skills/**` · `for-developers/modules/workflows/**` · `for-developers/modules/operate/features/schedules.md` | `agents` — skills, plans and flows, schedules |
| P09a explore · the board | `specs-m4-explore-a.md` | `for-developers/modules/explore/**` · `products/explorer.md` · `docs/studio/{query-workspace,visualization}.md` | `explore` — explorer, boards, annotations, data edits, canvas |
| P09b explore · the Assistant | `specs-m4-explore-b.md` | `for-developers/modules/ask/**` · `for-developers/modules/memory/**` | `explore` — sessions, questions, emissions, projections, streams · `studio/packages/assistant` |
| P10 data | `specs-m4-data.md` | — | — (`data` is specs only; P10 maps its stories to the code `explore` and `model` own) |
| P11 journeys | `specs-m4-journeys.md` | `for-developers/the-sequence.md` · `products/README.md` | — |
| P12a system design · architecture, data model, API and CLI | `specs-m4-system-design-a.md` | `system-design.md` · `system-design/**` · `for-developers/{README.md,architecture.svg,module-structure.md,governance.md}` · `for-developers/building-engine/**` · `for-developers/modules/platform/spec.md` · `for-developers/modules/platform/features/{command-line,list-contract}.md` · `products/migration-plan.md` · `docs/development/rfcs.md` | shared — `core` · `cli` · `server` (app, middleware, schemas) · Studio `core` · `ui` |
| P12b system design · runtime, observability, Studio | `specs-m4-system-design-b.md` | `for-developers/{orchestration.md,the-screens.md}` · `for-developers/building-studio/**` · `for-developers/modules/operate/spec.md` · `for-developers/modules/operate/features/observability.md` · `for-developers/modules/platform/features/{runtime,telemetry,telemetry-cleanup,logging,metrics-are-stored,design-system,theming,admin-and-health}.md` · `docs/studio/overview.md` | — |
| P13 reconcile | `specs-m4-coverage.md` | `specs/_stale/README.md` · `specs/_stale/code.md` | — |

## Environment

| Name | Value |
|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` |

## Gates

Spec only: no stack, no setup, no code gates. The register gates read `.agent-reports/product-manager/specs-m4-plan.md`,
which P01 writes; a coverage file is checked once it exists.

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| spec tooling tests | `python3 -m unittest discover -s scripts/specs` | `.` | all | |
| no live cite of stale | `! grep -rIl --exclude-dir=_stale --exclude=migrations.md -F _stale/ specs docs` | `.` | all | |
| spec only | `sh -c 'test -z "$(git diff --name-only chore/specs-m4 -- engine studio integrations scripts demos docker .github .changeset CLAUDE.md .claude/skills .claude/agents .claude/hooks .claude/team/TEAM.md)" && test -z "$(git status --porcelain -- engine studio integrations scripts demos docker .github .changeset CLAUDE.md .claude/skills .claude/agents .claude/hooks .claude/team/TEAM.md)"'` | `.` | all | |
| honest status | `python3 -c "import subprocess,pathlib,re,sys; g=lambda *a: subprocess.run(['git',*a],capture_output=True,text=True).stdout.split(); new=sorted(set(g('diff','--name-only','--diff-filter=A','chore/specs-m4','--','specs')+g('ls-files','--others','--exclude-standard','--','specs'))); s=[f for f in new if f.endswith('/story.md') and any(('status: '+w) in pathlib.Path(f).read_text() for w in ('designed','built','verified'))]; t=[f for f in new if f.endswith('/task.md') and re.search('-T[0-9]+ ',pathlib.Path(f).read_text())]; print(len(new),'new spec files; stories above specified:',s,'task rows written:',t); sys.exit(1 if s+t else 0)"` | `.` | all | |
| register · stale | `python3 -c "import pathlib,sys; t=pathlib.Path('.agent-reports/product-manager/specs-m4-plan.md').read_text(); m=[str(f) for f in sorted(pathlib.Path('specs/_stale').rglob('*')) if f.is_file() and str(f)+' ' not in t]; print(len(m),'stale files not in the register',m[:20]); sys.exit(1 if m else 0)"` | `.` | all | |
| register · code | `python3 -c "import pathlib,sys; t=pathlib.Path('.agent-reports/product-manager/specs-m4-plan.md').read_text(); E=pathlib.Path('engine/src/invana'); u=[d for d in sorted(E.glob('apps/*'))+sorted(E.glob('server/*')) if (d/'__init__.py').exists()]+[E/'server/health.py']+[d for d in sorted(pathlib.Path('studio/packages').glob('*')) if (d/'package.json').exists()]+[d for d in sorted(pathlib.Path('integrations').glob('invana-*')) if d.is_dir()]; m=[str(d) for d in u if str(d)+' ' not in t]; print(len(u),'code units;',len(m),'not in the register',m); sys.exit(1 if m else 0)"` | `.` | all | |
| register · disposed | `python3 -c "import pathlib,re,sys; R=pathlib.Path('.agent-reports/product-manager'); P=chr(124); rows=[[c.strip() for c in l.strip().strip(P).split(P)] for l in (R/'specs-m4-plan.md').read_text().splitlines() if l.startswith(P+' ')]; rows=[r for r in rows if len(r)>2 and r[2].startswith('specs-m4-') and (R/r[2]).exists()]; good=lambda r,l: r[0] in l and (any(w in l for w in ('merged into','retired','kept')) if r[0].startswith('specs/') else bool(re.search('[A-Z]{2}-[0-9]{2,3}',l)) or 'shared' in l); bad=[r[0] for r in rows if not any(good(r,l) for l in (R/r[2]).read_text().splitlines())]; print(len(rows),'register rows with a coverage file;',len(bad),'not disposed',bad[:30]); sys.exit(1 if bad else 0)"` | `.` | all | |
| coverage links | `python3 scripts/specs/links.py .agent-reports/product-manager/specs-m4-plan.md .agent-reports/product-manager/specs-m4-projects.md .agent-reports/product-manager/specs-m4-graphs.md .agent-reports/product-manager/specs-m4-access.md .agent-reports/product-manager/specs-m4-runtime.md .agent-reports/product-manager/specs-m4-model.md .agent-reports/product-manager/specs-m4-datasets.md .agent-reports/product-manager/specs-m4-agents-a.md .agent-reports/product-manager/specs-m4-agents-b.md .agent-reports/product-manager/specs-m4-explore-a.md .agent-reports/product-manager/specs-m4-explore-b.md .agent-reports/product-manager/specs-m4-data.md .agent-reports/product-manager/specs-m4-journeys.md .agent-reports/product-manager/specs-m4-system-design-a.md .agent-reports/product-manager/specs-m4-system-design-b.md .agent-reports/product-manager/specs-m4-coverage.md` | `.` | all | |
| coverage · projects | `test -f .agent-reports/product-manager/specs-m4-projects.md` | `.` | P02 | |
| coverage · graphs | `test -f .agent-reports/product-manager/specs-m4-graphs.md` | `.` | P03 | |
| coverage · access | `test -f .agent-reports/product-manager/specs-m4-access.md` | `.` | P04 | |
| coverage · runtime | `test -f .agent-reports/product-manager/specs-m4-runtime.md` | `.` | P05 | |
| RT-F05 written | `sh -c 'grep -q "^boards: \[\]" specs/os/runtime/features/RT-F05-*/feature.md'` | `.` | P05 | |
| coverage · model | `test -f .agent-reports/product-manager/specs-m4-model.md` | `.` | P06 | |
| coverage · datasets | `test -f .agent-reports/product-manager/specs-m4-datasets.md` | `.` | P07 | |
| coverage · agents a | `test -f .agent-reports/product-manager/specs-m4-agents-a.md` | `.` | P08a | |
| coverage · agents b | `test -f .agent-reports/product-manager/specs-m4-agents-b.md` | `.` | P08b | |
| coverage · explore a | `test -f .agent-reports/product-manager/specs-m4-explore-a.md` | `.` | P09a | |
| coverage · explore b | `test -f .agent-reports/product-manager/specs-m4-explore-b.md` | `.` | P09b | |
| coverage · data | `test -f .agent-reports/product-manager/specs-m4-data.md` | `.` | P10 | |
| coverage · journeys | `test -f .agent-reports/product-manager/specs-m4-journeys.md` | `.` | P11 | |
| coverage · system design a | `test -f .agent-reports/product-manager/specs-m4-system-design-a.md` | `.` | P12a | |
| coverage · system design b | `test -f .agent-reports/product-manager/specs-m4-system-design-b.md` | `.` | P12b | |
| coverage · final | `test -f .agent-reports/product-manager/specs-m4-coverage.md` | `.` | P13 | |
| stale left only when kept | `python3 -c "import pathlib,sys; R=pathlib.Path('.agent-reports/product-manager'); P=chr(124); rows=[[c.strip() for c in l.strip().strip(P).split(P)] for l in (R/'specs-m4-plan.md').read_text().splitlines() if l.startswith(P+' specs/_stale/')]; lines=lambda r: [l for l in (R/r[2]).read_text().splitlines() if r[0] in l] if (R/r[2]).exists() else []; left=[r[0] for r in rows if pathlib.Path(r[0]).exists() and not any('kept' in l for l in lines(r))]; print(len(left),'stale files left without a kept row',left[:30]); sys.exit(1 if left else 0)"` | `.` | P13 | |
| kept have a reason | `python3 -c "import pathlib,sys; S=pathlib.Path('specs/_stale'); t=(S/'README.md').read_text()+(S/'code.md').read_text(); k=[str(f.relative_to(S)) for f in sorted(S.rglob('*')) if f.is_file() and str(f.relative_to(S)) not in ('README.md','code.md')]; m=[f for f in k if f not in t]; print(len(k),'files kept in _stale;',len(m),'without a reason line',m[:30]); sys.exit(1 if m else 0)"` | `.` | P13 | |

## Phases

### P01 · Register and recipe

| | |
|---|---|
| Agent | product-manager |
| Read | This file (*Rules*, *Assignment*, *Questions for Ravi*) · `.agent-reports/qa/specs-m3-audit.md` §1–§4, §6, §9 · `specs/system-design/architecture.md` › *One name across layers* and *The rename map* · `specs/README.md` · `.claude/skills/product-spec/SKILL.md` · `format.md` · the file list of `specs/_stale/` (names only — no stale file is read in P01) · `engine/src/invana/{apps,server,runtime,activity,graph,plugins,cli}` and `studio/packages/*`, `studio/apps/studio/src/router.tsx`, `integrations/*` (names, docstrings and router prefixes only) |
| Stories | — |
| Done when | `.agent-reports/product-manager/specs-m4-plan.md` holds: *Register* — a table `Path · Phase · Coverage file · Note`, one row for every file under `specs/_stale/` and every code unit — each `apps/*` and `server/*` package, `server/health.py`, each `studio/packages/*`, each `integrations/invana-*`, and at module level `runtime/*`, `activity/managers/*`, `activity/querysets/*`, `graph/*`, `plugins/*`, `cli/commands/*` and the Studio route groups in `router.tsx` — the path bare (no backticks), the phase and coverage file from *Assignment*, a split unit noting the other phases that cover its parts · *Recipe* — the per-phase method below, made concrete · *Coverage format* — the tables below · a row count per phase, with a hand-off note for any phase above ~40 stale files and code units together · the register gates pass · no spec, no stale file and no code changed |
| Lands | `.agent-reports/product-manager/specs-m4-plan.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List every stale file and every code unit. 2. Assign each from *Assignment*, the rename map and the audit. 3. Write the recipe: (a) inventory the phase's code — routers and their endpoints, tables, managers, Studio routes and pages — as one line per act a person or an agent can do · (b) map each act to a live story by reading the owning feature's stories; none is a gap · (c) read each of the phase's stale files and sort what it holds: requirement, decision, engine design, plan or history, retired · (d) write the gaps and the stale requirements no story holds as stories at `idea`, or as criteria on an `idea` or `specified` story; decisions into Decisions; engine design into `specs/system-design/modules/<pkg>*.md` and the cross-cutting `specs/system-design/*.md` · (e) write the coverage file · (f) `check.py`, `check.py --index`, links and every gate. 4. Write the coverage format: *Code* `Code path · New name · Does · Story IDs · Note` (Story IDs, or `shared — <why>` for a shared unit) · *Stale* `Stale file · Disposition · Into · Note`, Disposition one of `merged into` · `retired — <why>` · `kept — <why no one-to-one live home>`, Into a markdown link to each live spec, stale and code paths as code spans · *Stories written* `ID · Feature · Status · From` · *Decisions and design merged* `What · Into` · *Flags* `Breaking change or contradiction · Where · Recommend`. 5. Gates |

### P02 · projects — the method pilot

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (*Register* rows for P02, *Recipe*, *Coverage format*) · `specs/capabilities/projects/**` · `specs/system-design/modules/projects.md` · `specs/system-design/orchestration.md` · the audit §3 · the P02 stale files · `engine/src/invana/apps/work` · `engine/src/invana/server/work` · `studio/packages/projects` and its routes · `.claude/skills/product-spec/SKILL.md` · `format.md` · `templates/` |
| Stories | The PJ stories this phase writes |
| Done when | The package done-when, for projects: `.agent-reports/product-manager/specs-m4-projects.md` in the coverage format disposes every P02 register row (code → story ID; stale → merged into · retired · kept, each with its reason) · every act the inventory found has a PJ story; the new ones are `idea`, in the owning PJ feature, with five parts, *Who can* Admin and Operator, every `## Screens` cell a board or `—`, an empty `task.md` · stale decisions sit in the PJ `feature.md` or `product.md` › Decisions · stale engine design sits in `specs/system-design/modules/projects.md` and the cross-cutting `specs/system-design/*.md` under package names (records `tasks`, table `projects_tasks`) · the plan file's *Recipe* and *Coverage format* hold whatever the pilot changed, with a hand-off note saying what · every gate passes |
| Lands | `specs/capabilities/projects/**` · `specs/system-design/modules/projects.md` · `specs/system-design/*.md` · `specs/README.md` (regenerated) · `.agent-reports/product-manager/specs-m4-projects.md` · the plan file |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory the code. 2. Map acts to PJ stories. 3. Read and sort the stale files. 4. Write stories, decisions and design. 5. Coverage file. 6. Fix the recipe and format where the pilot showed a gap. 7. Index and gates |

### P03 · graphs

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (*Register* rows for P03, *Recipe*, *Coverage format*) · `specs/os/graph/**` · `specs/system-design/architecture.md` › *The rename map* · the audit §1, §4 · the P03 stale files · the P03 code units · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The GR stories this phase writes |
| Done when | The package done-when (P02), for graphs, in `specs-m4-graphs.md`: Graphs, members, set-up steps, search (⌘K), notifications, alerts, the inbox, the shell frame and the generated admin each have a GR story or a disposition · every gate passes |
| Lands | `specs/os/graph/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-graphs.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P04 · access

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P04 rows, *Recipe*, *Coverage format*) · `specs/os/access/**` · `specs/system-design/modules/access.md` · `access-events.md` · `specs/system-design/governance-and-lens.md` · the audit §1, §4 · the P04 stale files · the P04 code units (`apps/iam`, `core/auth`, `server/{auth,iam,approvals,ledger,history,events}`, `activity/managers/{approvals,ask_gate,agent_acts,ledger,changes}.py`, `activity/querysets/asks.py`, `studio/packages/{iam,activity}`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AC stories this phase writes |
| Done when | The package done-when (P02), for access, in `specs-m4-access.md`: accounts, sessions and refresh, personal access tokens, usernames, groups, access rules and their versions, effective access, the ask gate and approvals, the ledger, history and events each have an AC story or a disposition · every gate passes |
| Lands | `specs/os/access/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-access.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P05 · runtime

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P05 rows, *Recipe*, *Coverage format*) · `specs/os/runtime/**` · `specs/system-design/modules/runtime-connectors.md` · `specs/system-design/{integrations,runtime}.md` · the m3-code D02 entry in `.claude/team/projects/m3-code/project.md` (read only) · recommendations R114 · R125 · the audit §1, §4, §6 · the P05 stale files · the P05 code units (`apps/{llm_providers,mcp_server,workers}`, `server/{llm_providers,mcp_server,plugins,workers,runtime}`, `plugins/`, `graph/connectors`, `integrations/*`, `studio/packages/platform`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The RT stories this phase writes, RT-F05's among them |
| Done when | The package done-when (P02), for runtime, in `specs-m4-runtime.md`: AI providers and models, plugins and MCP, this Graph's MCP server, workers, the queue, contention, distributed execution and the graph database connectors each have an RT story or a disposition · RT-F05 *Graph database connectors* exists as m3-code D02's Done when says — `specs/os/runtime/features/RT-F05-*/feature.md`, stories in folders with five parts and an empty `task.md`, connectors in `runtime/connectors` registered under the `invana.connectors` entry-point group and loaded by name, `boards: []`, every `## Screens` cell `—` — with its stories `idea` (Q5), and `runtime-connectors.md`'s registration section names the entry-point group · every gate passes |
| Lands | `specs/os/runtime/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-runtime.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f); RT-F05 in step (d) |

### P06 · model

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P06 rows, *Recipe*, *Coverage format*) · `specs/capabilities/model/**` · `specs/system-design/modules/{model,model-lenses}.md` · `specs/system-design/{data-model,governance-and-lens}.md` · the audit §1, §4 · the P06 stale files · the P06 code units (`apps/{modeller,semantic,govern}`, `server/{modeller,govern,requests,rules}`, `server/routes/{models,model_links,schemas}.py`, `activity/managers/publish_reviews.py`, `studio/packages/modeller`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The MO stories this phase writes |
| Done when | The package done-when (P02), for model, in `specs-m4-model.md`: connect and introspect, the model editor and page, publish and its review, starter, domain and stitched models, ontology import, property constraints, sharing, lenses, guardrails, requests, rules and the query log (`model_query_log`, Q2) each have an MO story or a disposition · every gate passes |
| Lands | `specs/capabilities/model/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-model.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P07 · datasets

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P07 rows, *Recipe*, *Coverage format*) · `specs/capabilities/datasets/**` · `specs/system-design/modules/datasets-loads.md` · the audit §1, §4 · the P07 stale files · the P07 code units (`apps/{datasets,standards}`, `server/{datasets,standards}`, `runtime/managers/dataset_bind.py`, `graph/loaders`, `plugins/core/{ingest,datasets}`, `cli/commands/{loader,datasets}.py`, `studio/packages/datasets`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The DS stories this phase writes |
| Done when | The package done-when (P02), for datasets, in `specs-m4-datasets.md`: datasets and versions, loads and bundles, inspect, retract and refresh, binding into a Graph, standards, SKOS import and conformance each have a DS story or a disposition · every gate passes |
| Lands | `specs/capabilities/datasets/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-datasets.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P08a · agents — agents and runs

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P08a rows, *Recipe*, *Coverage format*) · `specs/capabilities/agents/**` (AG-F01, F02, F03, F05, F08 first) · `specs/system-design/modules/agents.md` · `specs/system-design/{runtime,orchestration}.md` · the audit §1, §4, §7 · the P08a stale files · the P08a code units (`apps/{agents,llm}`, `server/{agents,evals}`, `runtime/{delegation,executor,planning,interpreter,governing,callers}*`, `runtime/managers/agent_*.py`, `evals.py`, `eval_checks.py`, `studio/packages/agents` — fleet, runs, settings) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AG stories this phase writes |
| Done when | The package done-when (P02), for agents and runs, in `specs-m4-agents-a.md`: authoring, the agent page, soul, lifecycle, pinned model versions, envelope and budget, the run page, fleet performance, delegation and lineage, remote and outside agents, import and export, install-wide agents and evals each have an AG story or a disposition · every gate passes |
| Lands | `specs/capabilities/agents/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-agents-a.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P08b · agents — skills, plans and schedules

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P08b rows, *Recipe*, *Coverage format*) · `specs/capabilities/agents/**` (AG-F04, F06, F07 first) · `specs/system-design/modules/{agents-skills,agents-plans}.md` · `specs/system-design/orchestration.md` · recommendation R116 · the P08b stale files · the P08b code units (`apps/{skills,flows}`, `server/{skills,flows,schedules}`, `server/runtime/catalogue.py`, `runtime/workflows.py`, `runtime/catalogue`, `runtime/managers/{skill_*,flow_runs,plan_performance,catalogue}.py`, `studio/packages/agents` — plans, skills, schedules) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AG stories this phase writes |
| Done when | The package done-when (P02), for skills, plans and schedules, in `specs-m4-agents-b.md`: authoring a skill, the skill page, bindings, usage, instructions publish and rollback, skill evals, the plan and flow library, plan selection, the catalogue, running and promoting a plan, envelope validation and schedules each have an AG story or a disposition — rules go to MO-F06 · R116 closed · every gate passes |
| Lands | `specs/capabilities/agents/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-agents-b.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f); then close R116 |

### P09a · explore — the board

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P09a rows, *Recipe*, *Coverage format*) · `specs/capabilities/explore/**` (EX-F01, F02, F06 first) · `specs/system-design/modules/explore-boards.md` · `specs/system-design/studio/graph-model-canvas.md` · the audit §1, §4 · the P09a stale files · the P09a code units (`apps/{explorer,boards,annotations}`, `server/{explorer,boards,annotations,data_edits}`, `runtime/{canvas,projections}.py`, `runtime/managers/board_open.py`, `studio/packages/{explorer,canvases}`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The EX stories this phase writes |
| Done when | The package done-when (P02), for the board, in `specs-m4-explore-a.md`: the graph canvas, boards and their versions, selection and the element panel, the console, annotations, the walkthrough, sharing an answer and editing the graph's data each have an EX story or a disposition · every gate passes |
| Lands | `specs/capabilities/explore/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-explore-a.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P09b · explore — the Assistant

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P09b rows, *Recipe*, *Coverage format*) · `specs/capabilities/explore/**` (EX-F03, F04, F05, F07 first) · `specs/system-design/modules/{explore-questions,explore-memory}.md` · `specs/design-language.md` (the assistant) · the audit §1, §4 · the P09b stale files · the P09b code units (`apps/sessions`, `server/sessions`, `runtime/{emissions,stream,diagnosis}.py`, `studio/packages/assistant`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The EX stories this phase writes |
| Done when | The package done-when (P02), for the Assistant, in `specs-m4-explore-b.md`: asking in words, clarifying questions, the answer and its surface, the reasoning trace, when it cannot answer, beyond the graph, act-as, forking a session, projections, write queries, streaming and what past runs teach each have an EX story or a disposition — memory only as EX-F07 and the model starter say (Q6) · every gate passes |
| Lands | `specs/capabilities/explore/**` · `specs/system-design/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-explore-b.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | The recipe, (a)–(f) |

### P10 · data

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (*Recipe*, *Coverage format*) · `specs/capabilities/data/**` · the coverage files of P04, P06, P09a and P09b · the code they name for records, quality, bulk edits, merges, lineage, history and annotations · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The DA stories this phase writes |
| Done when | `specs-m4-data.md`: every DA story → the code that serves it today (path and owning package), or *not built* · every act of that code a person meets in Data and no DA, EX, MO or AC story holds is a DA story at `idea` · the overlaps DA-F06/AC-F06 and DA-F07/EX-F06 named in *Flags* with a recommendation, not merged · no engine module or Studio package proposed for `data` (Q1) · every gate passes |
| Lands | `specs/capabilities/data/**` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-data.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List the DA stories. 2. Find the code serving each from the coverage files. 3. Gaps as stories. 4. Flags. 5. Gates |

### P11 · journeys

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/journeys/*.md` · `specs/README.md` · `specs/personas.md` · every package coverage file's *Stories written* · the P11 stale files · recommendation R130 · `.claude/skills/product-spec/templates/journey.md` · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | — (journeys only) |
| Done when | `specs-m4-journeys.md` disposes the P11 rows · every journey names only live story IDs and package names (no Shell product, no Operate module — R130 closed) · every story written in P02–P10 that starts or continues a person's path across products sits on a journey, or the coverage file says why not · a new journey only for a path no journey draws, with every branch in mermaid · every feature's `journeys:` key agrees · every gate passes |
| Lands | `specs/journeys/**` · `feature.md` front-matter `journeys:` · `specs/README.md` · `.agent-reports/product-manager/specs-m4-journeys.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read the journeys against the new stories. 2. Repoint and extend. 3. New journeys where needed. 4. Close R130. 5. Gates |

### P12a · system design — architecture, data model, API and CLI

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P12a rows, *Recipe*, *Coverage format*) · `specs/system-design/{architecture,data-model,api-and-cli,integrations,governance-and-lens}.md` · `specs/system-design/modules/*.md` · `engine/tests/golden/schema.models.sql` · `engine/tests/golden/openapi.json` (paths only) · `engine/src/invana/cli` · the P12a stale files |
| Stories | — |
| Done when | `specs-m4-system-design-a.md` disposes the P12a rows: architecture, module layout, governance, the data model (every app-DB table today, under its `<pkg>_<records>` name), the API (every route group under `/api/v1/u/{u}/{g}/<pkg>/<records>`, Q3), the list contract and the CLI sit in `specs/system-design/*.md` · build plans and migration plans `retired` with their reason, any still-open item a recommendation · the shared units (`core`, `cli`, `server`, Studio `core`, `ui`) marked `shared` with what they hold · every gate passes |
| Lands | `specs/system-design/**` · `.agent-reports/product-manager/specs-m4-system-design-a.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read and sort the stale files. 2. Data model from the golden schema. 3. API and CLI. 4. Architecture and governance. 5. Coverage file. 6. Gates |

### P12b · system design — runtime, observability, Studio

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file (P12b rows, *Recipe*, *Coverage format*) · `specs/system-design/{runtime,orchestration,observability}.md` · `specs/system-design/studio/*.md` · `specs/design-language.md` · recommendation R127 · the P12b stale files |
| Stories | — |
| Done when | `specs-m4-system-design-b.md` disposes the P12b rows: orchestration, the runtime and its kinds, health and the generated admin, telemetry, logging, metrics stored at settle time, the design system, theming and the screen map sit in `specs/system-design/**` or `specs/design-language.md` · the still-live parts of the four moved docs are back (R127 closed) · Studio build plans `retired` with their reason · every gate passes |
| Lands | `specs/system-design/**` · `specs/design-language.md` · `.agent-reports/product-manager/specs-m4-system-design-b.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read and sort the stale files. 2. Runtime and orchestration. 3. Observability. 4. Studio and design. 5. Close R127. 6. Coverage file. 7. Gates |

### P13 · Reconcile and final coverage

| | |
|---|---|
| Agent | product-manager |
| Read | The plan file · every `specs-m4-*.md` coverage file · `specs/_stale/README.md` · `specs/_stale/code.md` · `specs/migrations.md` · this file's *Hand-off notes* |
| Stories | — |
| Done when | Every stale file disposed `merged into` or `retired` is deleted from `specs/_stale/` · each file left has a `kept — <why>` row and a reason line in `_stale/README.md` (docs) or `code.md` (code) · `specs/migrations.md` M2 says what `_stale/` still holds · `.agent-reports/product-manager/specs-m4-coverage.md` holds: totals per phase (code units → stories, stale files merged · retired · kept), every story written with its status, every flag and breaking change for Ravi's spec review, the features whose status fell, the recommendations raised and closed · every gate passes |
| Lands | `specs/_stale/**` (deletes, `README.md`, `code.md`) · `specs/migrations.md` · `.agent-reports/product-manager/specs-m4-coverage.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Collect every disposition. 2. Delete the merged and retired files. 3. Reason lines for the kept. 4. M2 row. 5. Final coverage report. 6. Gates |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Register and recipe | — | done | 2026-11-09 | gates green · reviews passed |
| P02 | projects — the method pilot | P01 | done | 2026-11-09 | gates green · reviews passed |
| P03 | graphs | P02 | done | 2026-11-09 | gates green · reviews passed |
| P04 | access | P02 | done | 2026-11-09 | gates green · reviews passed |
| P05 | runtime | P02 | done | 2026-11-09 | gates green · reviews passed |
| P06 | model | P02 | done | 2026-11-09 | gates green · reviews passed |
| P07 | datasets | P02 | done | 2026-11-09 | gates green · reviews passed |
| P08a | agents — agents and runs | P02 | done | 2026-11-09 | gates green · reviews passed |
| P08b | agents — skills, plans and schedules | P08a | done | 2026-11-09 | gates green · reviews passed |
| P09a | explore — the board | P02 | done | 2026-11-09 | gates green · reviews passed |
| P09b | explore — the Assistant | P09a | done | 2026-11-09 | gates green · reviews passed |
| P10 | data | P04, P06, P09a, P09b | done | 2026-11-09 | gates green · reviews passed |
| P11 | journeys | P03, P04, P05, P06, P07, P08b, P09b, P10 | done | 2026-11-09 | gates green · reviews passed |
| P12a | system design — architecture, data model, API and CLI | P03, P04, P05, P06, P07, P08b, P09b, P10 | done | 2026-11-09 | gates green · reviews passed |
| P12b | system design — runtime, observability, Studio | P12a | done | 2026-11-09 | gates green · reviews passed |
| P13 | Reconcile and final coverage | P11, P12b | done | 2026-11-09 | gates green · reviews passed |

## Hand-off notes

What a later phase must know that the specs do not say. One row per note, newest last.

| ID | Note |
|---|---|
| P01 | The register, recipe and coverage format are in `.agent-reports/product-manager/specs-m4-plan.md`. `.agent-reports/` is git-ignored, so the file lives only in the working tree and no phase commit carries it. Do not clean or delete it. 197 stale files and 259 code units; every register gate passes |
| P01 | Over ~40 rows: P04 has 51, P05 54, P06 43, P08a 56 and P12a 52. These are module-level rows, mostly a router, its manager and its queryset in one slice, so inventory each slice as one unit. Past the budget, hand off with the register's row-by-row progress and never cut scope |
| P01 | How the register works. Directories are listed one module per row. A *Split* note names the phase that takes each part of a split unit: that phase writes a row for the same path in its own coverage file. Studio route groups appear as `route <path>` rows, and the coverage file quotes the path exactly as written |
| P01 | Assignments the docs do not settle. These are for *Questions for Ravi*, each with the option I rejected. `server/admin` → P03, because P03's *Done when* names "the generated admin" (not P12a as shared). `server/health.py` and `server/routes/telemetry.py` → P12a shared, because the rename map says "Kept in `server`" (not P12b, which owns no code). `runtime/projections.py` → P09a, because P09a's *Read* lists it, while `server/runtime/templates.py` → P09b, because P09b's *Done when* names projections (I rejected putting both in one phase). `plugins/core/llm` → P08a, because *Settled clashes* says "the client every run calls is `agents/llms`" (not P05). `core/policy.py` → P04, as the access-rule evaluator (not P12a shared). `cli/commands/{records,stitches}.py` → P07, because their docstrings cite load-data (not P06). `activity/models.py` and `schemas.py` → P04 with a split note. Studio `/login`, `/profile` and `/platform/events` → P04. `/settings` → P03, from audit §4 (GR-15) |
| P01 | `plugins/tools/mail` and `plugins/tools/science` → P05. The specs-m3 audit found no story for them (its R-rec 3). P05 maps each to a story or raises a *Flag*, and never proposes deleting either |
| P02 | The recipe changed. The plan file's *Recipe* gains six rules: *Code lags the spec* (a recommendation and a Flag, not a gap) · *An act the spec excludes* (a Flag, never a story) · *A criterion is the usual gap* (add criteria to an `idea` story before writing a new one; *Stories written* lists `<ID> (<criteria>)`) · *Words in an `idea` story* (fix a never-shown word in place) · *Designed, not built* (system-design tables marked so) · *A stale file's part for another phase* (a Note and a hand-off note). *Coverage format* › *Stories written* takes criterion rows. The projects specs were mature: no new story, only PJ-12.23–PJ-12.26 and no feature status fell |
| P02 | Decisions the docs did not settle, for *Questions for Ravi*. (1) PJ-12 and PJ-F01 now say *Send back*, not *Reject*, for a task's result. Support: `specs/glossary.md` › *Accept · Send back*, which lists *reject* as never shown. Rejected: keeping *Reject*. (2) `specs/system-design/api-and-cli.md` no longer lists `invana lineage`. Support: PJ-F03 › Not building, *Lineage from the command line*. Rejected: keeping the row. (3) `invana todos` is now `invana tasks`, marked not built. Support: the glossary's *Task* and the code, which has no such command. Rejected: deleting the row |
| P02 | For later phases. **P03:** `engine/src/invana/server/work/admin.py` is starlette-admin, the generated admin; P03 maps it to its own story. **P04:** AC-F05 does not record amending an approval's arguments. The approval would show the step, its resolved arguments, what it reads and writes, and its projected cost, and a person could amend the arguments, which are then re-checked against the envelope. Decide whether it is a criterion or stays in *Not building*. **P05:** the simulator plugin contract (kind `simulator`, declared fields, `read_inputs`) is RT-F02's; `projects.md` defers to it. **P06:** MO-F06 owns two points: rules go to the context as separate items with ids, so a run can cite one, and the open question *do rules need a priority, or is order enough?* **P08a:** `apps/work` `start_agent_work` and `work.spawn_agent` / `work.delegate` are P08a's. `projects.md` names the agent-raised task function `projects.tasks.create`; the code today is `work.create_task` (PJ-12.25). **P12a/P12b:** `specs/system-design/orchestration.md` still says *Todo* and `todos` about 30 times. Rename them under the package names: a task is `projects_tasks`, a plan step `agents_plan_steps`, a run `agents_runs` |
| P02 | Raised: R138 (projects writes skip the *Can work on projects* check — security, high) · R139 (`DELETE` project and task hard-delete what the spec keeps) · R140 (a task stores `status`, `acceptance` and `blocked_reason`, and dependencies are `finish_to_start` only) · R141 (Studio says *My todos*). For Ravi, in `specs-m4-projects.md` › *Flags*: drop the delete routes · the lineage CLI row · PJ-F03's *staffing from Studio not yet* row against PJ-F01 and the code · PJ-17.7 *open again* against PJ-12.15 *Assigned* |
| P03 | Done as the recipe says; no recipe change. The graph specs were mature: no new story, only GR-15.17–GR-15.23, GR-10.13 and GR-17.17, and no feature status fell. The engine shape is a new `specs/system-design/modules/graphs.md`, and it is now the home of the Inbox's tables: `access-events.md` points there and keeps only the clock. Coverage is `specs-m4-graphs.md` |
| P03 | Decisions the docs did not settle, for *Questions for Ravi*. (1) Deleting a Graph is a GR-15 criterion (Owner, types the name, the database untouched), beside archiving. Support: the recipe's *only an act the code has and no criterion holds is a gap*, and no GR *Not building* row excludes it. Rejected: treating it as excluded, as P02 did for projects, whose product says *archiving covers deletes*. (2) *Reconnect* is every member's. Support: `apps/graphs/roles.py` maps `connection/ping` to `ask`, and it changes nothing the Graph holds. Rejected: making it the Owner's. (3) `server/admin` is disposed `shared` with no story. Support: `architecture.md` › *The rename map* says "Kept in `server`", and R120 already waits on Ravi. Rejected: writing a GR story for a superuser's table browser that bypasses access rules and History |
| P03 | For later phases. **P04:** `activity/querysets/alerts.py` `WaitingQuerySet` and `activity/querysets/notifications.py` `ApprovalQuerySet` are AC-15's, and `shell/src/activity/{inbox/ApprovalDialog,events,changes}` are AC-15 · AC-16 · AC-17. **P05:** `apps/graphs/pool.py` and `compatibility.py` are the connector pool and capabilities, already in `runtime-connectors.md`; `graphs.max_concurrent_runs` · `concurrency_policy` · `pools` are RT-F04's. **P08a/P08b:** `shell/src/activity/runs` is AG-23 · AG-32, `shell/src/activity/schedules` is AG-42. **P09a:** `shell/src/boards` is EX-07. **P09b:** `apps/graphs/query_service.py` runs a conversation's query. **P12b:** writes the design of `server/admin` (R120) |
| P03 | Raised: R142 (set-up has three gates and stores a `complete` stamp) · R143 (*Read types again* checks `modeller`, not Owner — security, low) · R144 (`DELETE …/connection` leaves a Graph with no database) · R145 (Studio's shell still draws the launcher, Graphs page, connect page, set-up page, tray and a saturation slider). For Ravi, in `specs-m4-graphs.md` › *Flags*: delete a Graph · the connection delete route · reconnect for every member · the generated admin |
| P04 | Done as the recipe says; no recipe change. The access specs were mature. One new story, AC-18 *Give a person an account* (`idea`, AC-F01, no Studio surface, `boards: []`), plus the criteria AC-03.12 (list and show rules from the command line) and AC-15.29 (`invana approvals`). No feature status fell. The engine shape is now the full `specs/system-design/modules/access.md` under the package names, with a *Designed, not built* table. `access-events.md` points its `access_approvals` row there. Coverage is `specs-m4-access.md` |
| P04 | Decisions the docs did not settle, for *Questions for Ravi*. (1) Making an account is a new story, not criteria on AC-01. Support: the recipe's *one story per decision a person makes*, and the install Admin is a different decider from the person signing in. Rejected: AC-01 criteria. (2) AC-03.12 does not name `invana iam`, because `check.py` refuses *IAM* in a criterion. The command lives in `access.md`. (3) P02's approval-amend point is not a criterion. Support: AC-F05 › Not building and *An ask is decided as shown*; the code has no amend. Rejected: adding a criterion. It is a *Flag* asking Ravi to close AC-F05's open question. (4) Single sign-on in AC-01 is flagged, not edited. Support: Access and AC-F01 › Not building. Rejected: dropping AC-01.4 unasked |
| P04 | For later phases. **P08a:** `activity/managers/agent_acts.py` is AG-29 (AG-29.16). The agent side of `activity/managers/ask_gate.py` and `activity/querysets/asks.py` is AG-F05's. **P12a:** the event store `core/events` holds event scopes (a join table of event, scope kind and scope) and trace and span ids on each event; write them in the event store's design. Settle which record History reads — `access_ledger_rows`, which `core/ledger` writes for every event a person or an agent causes, or `events` (*Flags* row 4). `graphs.md` names the event store `access_events`, but `architecture.md` keeps `events` in `core`: reconcile them. **P12b:** `server/auth` and `server/events` are admin views of the generated admin (R120); the events view can delete (R150) |
| P04 | Raised: R146 (allow-only rules; the one access model is not built — high) · R147 (no *Sign out everywhere*) · R148 (Studio draws IAM as a product and `/profile` as a page) · R149 (the install-wide events page and `/api/v1/events` serve no story) · R150 (the admin can delete events — security, medium). For Ravi, in `specs-m4-access.md` › *Flags*: single sign-on in AC-01 · *Answered* asks · amending an ask · History's two records · the install-wide events |
| P05 | Done as the recipe says; no recipe change. New feature RT-F05 *Graph database connectors* — RT-17 install a connector and see it offered · RT-18 read and write in the database's own language · RT-19 vector search — all `idea`, `boards: []`, every Screens cell `—` (Q5; m3-code D02 only checks it). Criteria added: RT-01.18–21, RT-04.18–19, RT-09.11–13, RT-10.12–13. No feature status fell; Runtime stays `idea`. The package's engine shape is a new `specs/system-design/modules/runtime.md` (AI models, plugins, MCP servers, this Graph's MCP server, workers, limits, routes, events); `runtime-connectors.md` › *The connector contract* now registers connectors under `invana.connectors`, loaded by name, and `graphs.md` names the column `connector` (R114 closed). Coverage is `specs-m4-runtime.md` |
| P05 | Decisions the docs did not settle, for *Questions for Ravi*. (1) RT-F05 has three stories, not one per connector or one for a connector author. Support: the recipe's *one story per decision a person makes*; the connect step is GR-05 · GR-15's. Rejected: a story per vendor. (2) The engine design is one `modules/runtime.md` beside `runtime-connectors.md`, as P03 and P04 wrote `graphs.md` and `access.md`. Support: CLAUDE.md rule 15 (fewer files). Rejected: four files (llms, plugins, mcp-server, workers). (3) A connector is offered only once its package registers one, so ArcadeDB, TinkerGraph and Neptune are not offered until built — RT-F05 › Open questions. Rejected: listing them as supported in Studio. (4) `mail` and `science` map to RT-04 (RT-04.1 · .8 · .17); R119 can close. Rejected: a new story |
| P05 | For later phases. **P08a:** `runtime/models.py`, `studio/packages/agents` and `route /u/:username/:graphSlug/agents` carry P05 rows for their runtime parts (the three tables; `llms`, `plugins`, `connections`). The AI model client stays `agents/llms`. **P09b:** `plugins/tools/web` serves EX-26. **P12a:** the rename map scopes `/runtime/llms` to each Graph, but RT-F01 makes AI models the install's — move it install-wide (*Flags* row 3, R151); list `modules/runtime.md` wherever module specs are indexed. **P12b:** `specs/system-design/runtime.md` needs the agent ceiling reconciled (`max_concurrent_runs` 3 in the old docs vs `max_concurrent_steps`), the coordinator lease (5 s renew, 15 s lease, `LISTEN/NOTIFY`, glossary *Coordinator*), the events `refused_ceiling` and `waiting_on_provider`, and *a pool slot is held per crossing, taken after the lens, swept at settle*. `runtime-connectors.md` says a raw Gremlin query goes as a script, while *The lens at execution* says the base Gremlin connector has no raw-script path — reconcile. **Ravi (spec review):** *Flags* rows 1–4 — tool steps with no worker, the glossary's two plugin kinds (R158), the AI model routes, GR-F02's *default AI model* |
| P05 | Raised: R151 (AI models per Graph, any member writes them — security, high) · R152 (serving over this Graph's MCP server needs no *Can build agents* — security, medium) · R153 (no History for plugin, MCP and worker acts) · R154 (no per-revision read-only confirmation or mode per Graph for MCP tools — security, medium) · R155 (shipped tools are Python, not MCP servers) · R156 (Studio's connect step hard-codes connector paths) · R157 (Fleet, Pools, Join tokens, Capacity, Token, Side effect; worker logs in one process) · R158 (glossary's plugin kinds). Already open and cited: R016 (empty connector packages), R125 (no entry points) |
| P06 | Done as the recipe says; no recipe change. The model specs were mature, so there is no new story. Twenty criteria were added to ten `idea` stories: MO-01.12 · MO-02.8 · MO-05.23–26 · MO-07.20–22 · MO-10.17–18 · MO-11.15 · MO-12.17 · MO-13.15 · MO-15.15 · MO-16.13–14. Nine decisions went to MO-F02 to MO-F06. No feature status fell; Model stays `idea`. `specs/system-design/modules/model.md` is now the package's full engine shape (tables `model_*`, the draft, publishing, constraints, semantic imports, links, portability, health with `model_query_log` (Q2), rules). `model-lenses.md` now uses `model_lenses` · `model_run_touches` · `model_requests` under `/model/…`, and gains *A rule on a property*, *Requests* and *What a crossing records*. Coverage is `specs-m4-model.md` |
| P06 | Decisions the docs did not settle, for *Questions for Ravi*. (1) P02's open question, priority or order for rules, is settled as *Order is the priority* in MO-F06. Support: MO-F06 › Rules *Inherited, in order* and the `order` column. Rejected: a priority field. (2) A model's name and description change outside the draft (*A name is not a version*, MO-02.8). Support: product.md *A published version never changes* governs the model's content, and the code's `PATCH /models/{id}`. Rejected: staging a rename. (3) Command-line acts are criteria on the story they serve (MO-05.26, MO-10.18, MO-12.17, MO-13.15, MO-16.14), as P04 did with AC-03.12. Rejected: one CLI story. (4) MO-F02's *parent or abstract flag* breaking row contradicts MO-F01's *no inheritance*. It is flagged, not edited (*Flags* row 6). Rejected: dropping it unasked. (5) `runtime/managers/property_constraints.py` is mapped to MO-08 (a constraint, MO-F02), though the rename map files it under `model/rules`. Rejected: MO-F06 |
| P06 | For later phases. **P07:** `apps/semantic/skos.py` (SKOS to a standard's terms) is DS-15's. **P08a:** the agent-member routes of a Graph (`…/agents`, `PATCH/DELETE …/agents/{agent}`, `POST …/agents/{agent}/update`) are not yet in `agents.md`. `apps/govern/managers/endpoint.py` (AI model endpoints) is read by runtime and agents. **P09a:** `apps/modeller/managers/data_edit.py` serves board edits (EX-20). **P12a:** in `api-and-cli.md`, the CLI's link rules (`stitches apply` stages and `--commit` commits; folders resolve to models by package id then name; applying twice is not a failure; `resolve` re-counts) and *a CLI refusal names the next command*; `graphs.md` needs `auth_username` read back and the limits and usage routes (GR-14); `runtime-connectors.md` needs `counts_only` beside `excluded` in `QueryLens`; `governance-and-lens.md` needs the egress cut by prompt part (`property_names`, `sent.cut`) and the query texts, now in `model-lenses.md` › *What a crossing records*, plus *properties and select are legal on graph data only* and *a closed layer refuses naming the view and the layer*. **P12b:** `server/modeller` and `server/govern/admin.py` are generated admin views (R120). **P13:** GR-F04 Access and GR-15 give *Read types again* to the Owner, while MO-F01 gives *Read the database* to *Can shape the model* (*Flags* row 5, R143). The stale connect page and derived Graph name are retired against GR-05 · GR-06 |
| P06 | Raised: R159 (the model CLI checks no membership or role — security, high) · R160 (Studio's Modeller product, Worlds, Guardrails, Stitches and the other words) · R161 (three publish paths) · R162 (reads sent as POST need `modeller`) · R163 (the glossary and governance-and-lens say links write nothing, and list layered Graph guardrails) · R164 (GR-15 Capabilities row). For Ravi, in `specs-m4-model.md` › *Flags*: rows 1–6 and 12 |
| P07 | Done as the recipe says; no recipe change. The dataset specs were mature, so there is no new story. Fourteen criteria were added to five `later` stories: DS-01.9 · DS-02.9–11 · DS-03.10–12 (draft versions) · DS-08.9–11 · DS-09.14–15. Two decisions were added: drafts (DS-F01, plus an Access row) and the unlisted bulk load (DS-F02). No feature status changed; Datasets stays `later`. A new `specs/system-design/modules/datasets.md` is the package's engine shape. `datasets-loads.md` is rewritten in the runtime's words: no *Todo*, the plan `model-import@1`, steps under their function keys, and a *Designed, not built* table. `model.md` › *Not owned* links both. Coverage is `specs-m4-datasets.md` |
| P07 | Decisions the docs did not settle, for *Questions for Ravi*. (1) Criteria added to a `later` story stay `later`, so Ravi's *Parked* decision (Datasets › Decisions) stands. Q4's `idea` is for new stories, and P07 wrote none. Rejected: lifting DS stories to `idea`. (2) The load plan is `model-import@1`. Support: the glossary's *Packaged flow* example and `plugins/core/ingest/flows/model-import.toml`. Rejected: `dataset-import`, which `agents-plans.md` uses. (3) A dataset record's page and change log are DS-02 criteria. Support: DS-F01 › *A record's change log is read from versions*. Rejected: DA-06, which reads a Graph's records. (4) A standard's `origin` is `pack · authored`, and a SKOS import is `authored`. Support: the code, and DS-08.2 *a shipped pack or written here*. Rejected: a third `skos` origin |
| P07 | For later phases. **P08b:** in `agents-plans.md` › *The product's own plans*, rename `dataset-import` to `model-import` (the `ref: task:…` example too). `bundle-import` is designed, not built. **P12a:** `api-and-cli.md` needs these fixes. `datasets share --visibility` is `private\|install`, not `lab\|install`. `observe`, `collect`, `export` and `validation list/resolve` are not built. `standards attach --mode` has no `report` in code. Add `datasets refresh --now`, `standards apply --file` and `check` exiting non-zero. List `modules/datasets.md` wherever module specs are indexed. **P12b:** the generated admin can delete datasets, versions, records, adds, claims and standards (R120). **P09a:** a node's provenance peek (DS-13.15) reads the `_inv_*` stamps in `datasets-loads.md`. **P11:** J01 already strings DS-16 → DS-11 → DS-13 |
| P07 | Raised: R165 (the load, add and link commands check no Graph membership or role — security, high) · R166 (Studio draws Datasets as its own product, says Bind, Conformance, Validation and Observations, and has no Upload) · R167 (no `report` mode, no scheduled refresh, no export; `dataset.import` is never emitted). Already open and cited: R023 (the add needs only membership), R120 (the generated admin). For Ravi, in `specs-m4-datasets.md` › *Flags*: rows 5–8 |
| P08a | Done as the recipe says; no recipe change. The agents specs were mature, so there is no new story. Twenty-two criteria were added to six `idea` stories: AG-21.29–30 · AG-23.23–30 · AG-24.19–20 · AG-29.22–24 · AG-35.15–16 · AG-36.15–17. Screens rows were added to AG-24, AG-35 and AG-36, as states of boards they already name. Twelve decisions went to AG-F01, AG-F02 and AG-F05. AG-F03 › Access now names the person a run is on behalf of for *Stop* and *Re-run*. No feature status fell; Agents stays `idea`. `specs/system-design/modules/agents.md` is rewritten as the package's engine shape under the package names. It covers agents, `agents_members` (not built), runs, evals, fleet, delegation and escrow, outside agents (not built), the model a step calls, lifecycle, `agents/llms`, shipped agents, routes, events and commands, plus a *Designed, not built* table. Coverage is `specs-m4-agents-a.md` |
| P08a | Decisions the docs did not settle, for *Questions for Ravi*. (1) An agent's tests are an eval set like a skill's (AG-36.15, AG-F01 *Tests are evals*). Support: the code's `eval_sets.subject_kind` `skill · agent`, and AG-36.2 *its tests*. Rejected: a separate test record. (2) A run a schedule, a task or an agent started is stopped or re-run by the person it runs on behalf of, or an Admin (AG-23.30). Support: AG-F03 Access *the person who started it*, and `on_behalf_of_user_id`. Rejected: any member, as the code does (R169). (3) A pause takes no reason, and a run already queued still starts (AG-29.22). Support: AG-F01 *Pause asks, Resume does not* and *Pausing kills nothing*. Rejected: the stale pause reason. (4) The model order is the person's pick, then the skill version's pin, then the agent's pin, then the view of the graph (AG-29.23). Support: product.md *the model version is its pin or the view's*. Rejected: the agent's pin over the skill's. (5) The fleet map is kept, as AG-35.16. Support: the recipe's *an act the code has and no criterion holds is a gap*. Rejected: dropping it under AG-F05's *An org chart of agents*. (6) Event names follow the rename map literally, so `agent.create` becomes `agents.create`. Rejected: `agents.agents.create`. (7) The AC-10 gaps (a key's token ceiling, an empty scope refused at mint) are a Flag, not criteria. Support: P08a's *Lands* excludes `specs/os` |
| P08a | For later phases. **P08b:** *Flags* row 1: AG-42.6 says a retired agent's schedule stays on, but AG-29.16 and the code pause it. Align AG-42.6. A skill version's model pin (from `pinned-model-versions.md`) is AG-F04's criterion; `agents.md` › *The model a step calls* already names it as step 2. **P12a:** `api-and-cli.md` needs the agents routes and commands under package names, as `agents.md` › *Routes and events* lists them: `invana agents push · pin` and the per-run reads are missing; import and export are not built. The run record in `orchestration.md` lacks `number`, `exit_reason`, `escrow_tokens`, `escrow_returned`, `model_version` and `rerun_of_run_id`. *Flags* row 2: `GET /api/v1/runs/stats` is install-wide, for the Datasets imports page. **P12b:** the catalogue in `orchestration.md` needs `await_children` and `work.delegate_remote` (not built). `runtime.md` needs the agent's own `max_concurrent_runs` (3) beside the Graph's ceiling. **P09b:** `apps/llm` understand, translate and clarify are mapped to EX-01 · EX-23; refine them there. `emissions` and `projection_templates` stay P09b's. **P13:** *Flags* row 9 (AC-10) and rows 3–4 (re-run scope, who builds) go to Ravi |
| P08a | Raised: R168 (`invana agents` and `invana evals` check no role — security, high) · R169 (any member can stop or re-run a run with no conversation — security, medium) · R170 (the eval budget takes *Can build agents*, not the Owner — security, low) · R171 (Studio draws Agent Builder, Fleet and an eleven-tab agent page) · R172 (`cost_usd` and dollar pricing) · R173 (the run sheet lacks attempts, bounds reached, created vs updated and a step link) · R174 (the delete refusal text is broken). Already open and cited: R120 (the generated admin can delete agents and runs). For Ravi, in `specs-m4-agents-a.md` › *Flags*: rows 1–4 |
| P08b | Done as the recipe says; no recipe change. Split across two parts (skills · plans, functions and schedules). No new story: criteria AG-19.24–26 · AG-37.17–19 · AG-18.21–22 · AG-42.22–23, and AG-42.6 now follows AG-29.16 (a retired agent pauses its schedules), which settles P08a *Flags* row 1. No feature status fell. Engine shape: `agents-skills.md` (skills) and `agents-plans.md` (plans, functions, and schedules as its last section; `dataset-import` is `model-import` there). Rules were already in MO-12, nothing added. R116 is closed: the glossary's *Skill* (planned · guided, the plan a cache) and RT-F03's library pointer (AG-F02 → AG-F08). Coverage is `specs-m4-agents-b.md` |
| P08b | Decisions the docs did not settle, for *Questions for Ravi*. (1) The glossary *Skill* definition was changed to close R116. Support: AG-F04's summary (*planned* or *guided*) and R116. Rejected: leaving it as a flag, which would keep R116 open. (2) *Delete* is offered only for a skill that never published (AG-37.18 · .19). Support: product.md *Nothing that ran is deleted*. Rejected: the code's delete of any skill that did not ship. (3) Plans, a plan and a function are a row in Agents › Surfaces on `agents.skills`. Support: AG-F06 *Plans live under Agents › Skills*. Rejected: a separate `agents.plans` board. For Ravi, in `specs-m4-agents-b.md` › *Flags*: row 1 (narrow *One skill, one plan* for guided skills, a recorded decision, so not edited) and row 3 (plans per Graph or install-wide) |
| P08b | For later phases. **P12a:** `orchestration.md` › the catalogue says `step_key: run_query` and `ref: task:nightly-load`; use `graph.read.query`, `task:model-import` and `/api/v1/u/{u}/{g}/agents/functions`. `api-and-cli.md` needs `invana skills · plans · schedules` as `agents-skills.md` and `agents-plans.md` list them; `plans run` is not built. **P12b:** `orchestration.md` run record `plan_origin` is `template:<key>@<v>` · `generated` (not `authored · generated · reused`); *a Flow needs no version table* becomes *a plan's versions are its rows `key@n`*. `activity/clock.py` is shared: its tick also runs graphs' notifications, access asks and the ledger check. **P05:** Settings › AI models could list the skill versions pinned to each model version (RT-F01), if it does not already |
| P08b | Raised: R175 (deleting a skill deletes its published versions) · R176 (skill, plan and schedule writes and their CLIs skip their grants — security, high) · R177 (the skill catalogue lags AG-F04) · R178 (skill usage counted on read) · R179 (retire, run and promote acts of AG-F06 not built) · R180 (plan performance in dollars) · R181 (plans as code constants in `runtime/workflows.py`) · R182 (a schedule's outward Allow records no setter — security, high) · R183 (Studio puts plans under Functions). Closed: R116 |
| P09a | Done as the recipe says; no recipe change. No new story: 31 criteria on nine `idea` stories (EX-07, EX-09, EX-14, EX-15, EX-16, EX-18, EX-19, EX-20, EX-21); no feature status fell. Engine design is `specs/system-design/modules/explore-boards.md` under the package names (`explore/boards`, `explore/reads`, `explore/edits`, `explore/annotations`) |
| P09a | Decisions the docs did not settle, for *Questions for Ravi*. (1) A board outlives its maker (EX-F01 › Decisions). Support: EX-F01 › Access, where any member keeps and changes any board. Rejected: following the code's cascade on user delete. (2) Restoring a version makes a new version on the same board (EX-09.8 kept). Support: EX-F01 › Decisions on versions. Rejected: writing Studio's *Open as new canvas* as the restore. (3) Saving edits and annotations stay under *Can work on projects*, as both features' open questions recommend. Rejected: *Can shape the model*. (4) The first-use tutorial is not written as a criterion. Support: EX-18.8. Rejected: a GR-F02 lesson |
| P09a | For later phases. **P09b:** parameterised and favourite queries (EX-08), the composer's skill chip (EX-01) and *who kept it and when* on a third-party node (EX-26) — a criterion or a *Not building* row each; `route …/explorer/:session` is EX-10. **P10:** data's management of annotations (DA-07) and the overlap of board edits with DA-03. **P12b:** the renderer fallback belongs in `graph-model-canvas.md`; the generated admin of `server/{boards,annotations}` (R120) |
| P09a | Raised: R184 (removing a person deletes their boards — bug, high) · R185 (Studio's board lags EX-F01, F02, F06, and its words) · R186 (edits save edit by edit on Cypher) · R187 (restore opens a new board) · R188 (the assistant cannot write annotations) · R189 (Explore's engine names, unused board flags, refusals naming *Projects and tasks*) |
| P09b | Fix round 1: the coverage file `specs-m4-explore-b.md` still held its Summary, Code and Stories placeholders. Wrote its Code table (eight rows, each with EX story IDs), the summary and the stories, decisions, flags and rounds sections. The `register · disposed` gate and the links check pass |
| P10 | Done as the recipe says; no recipe change. Every DA story is mapped to the code that serves it today in `specs-m4-data.md` › *Stories to code*, a section added for P10's mapping before *Code*. DA-01 to DA-04 are not built. DA-05 is partly built (only the load and link stamps), DA-06 partly (`/ledger/record`, AC-16.11) and DA-07 partly (`/annotations`). No new story and no new criterion: every act a person meets is held by EX-19 · EX-20 · EX-21.14 · DS-13.15 · MO-03.16 · AC-16.11 · DA-07. No feature status fell. Specs changed: Data › Depends on gains Access, and three open questions are added (DA-F03, DA-F06, DA-F07) |
| P10 | Decisions the docs did not settle, for *Questions for Ravi*. (1) The three overlaps are flagged and left unmerged (*Flags* 1–3). DA-06 stays the member's view of AC-16's rows. The annotation split stays *Explore creates, Data keeps*, and an Admin delete with a reason is recommended into EX-F06. EX-F06's *bulk changes are an upload in Data* is recommended to read *a fix in Data (DA-F03)*. Support: DA-F07 › Decisions and EX-F06 › Decisions *Explore creates, Data keeps*. Rejected: merging DA-F06 into AC-F06, and DA-F07 into EX-F06. (2) DA-05.2 is flagged, not edited (*Flags* 4). A bulk load stamps nothing, so *present before Invana* would be a guess. Rejected: rewording an `idea` criterion unasked |
| P10 | For later phases. **P11:** DA stories sit on no journey yet, and every DA feature has `journeys: []`. J01's load path could continue to DA-05 (lineage) and DA-06 (History). **P12a:** `architecture.md` › *Settled clashes* says `data` is served by `explore` and `model`; add `access` (DA-06 reads `access/ledger`, *Flags* 7). **P13:** *Flags* 1–4 go to Ravi. Raised: R192 (a board's save stamps no run) · R193 (the Element panel guesses *invana loader*) |
| P11 | Done as the steps say. New journey J07 *Ready an install for its Graphs*: the install Admin's path AC-18 → RT-17 → RT-01 → RT-04 → RT-10 → RT-09 → RT-11 → GR-14, ending at J01. J01 gains AC-18 (step 0) and RT-17 (an uninstalled connector). J02 gains DA-05 · DA-06 (a cited record's lineage and history) and EX-26 (facts from beyond the Graph). J05 starts at AC-09 *Priya adds Tom* with an AC-18 branch. J03, J04 and J06 name GR-16 at their Inbox step. *Shell ·* and *Inbox ·* in journey tables are now *Graph ·* or *Access ·*. Nine features' `journeys:` keys and their *Journeys this feature is a step of* lines changed (AC-F01, RT-F01–F05, GR-F04, DA-F05, DA-F06). Coverage is `specs-m4-journeys.md`, with a table of every P02–P10 story and its journey or why not. R130 closed |
| P11 | Decisions the docs did not settle, for *Questions for Ravi*. (1) A new journey J07 for the install Admin, not branches on J01. Support: `specs/personas.md` gives the install admin *Run the install: AI models, workers, plugins, each Graph's limits* and no journey drew it, and P11's *Done when* allows a journey for a path no journey draws. Rejected: folding RT-01 · RT-04 · RT-10 · RT-11 into J01's branches. (2) J05 no longer says *invitation*. Support: AC-09.4 *there is no invitation*. Rejected: keeping the word and flagging it. (3) To close R130, P11 renamed `architecture.md` layer 8 from *Operate* to *History and asks* (access · graphs · agents), though architecture is P12a's file. Support: R130's own description and *Close the recommendations* (P11 closes R130). Rejected: leaving it to P12a with R130 open. (4) AC-F01 drops J02 from `journeys:` because J02 has no AC story. GR-F05 keeps J03 · J04 · J06, and GR-16 is added to their Inbox step. Rejected: dropping the Inbox feature from journeys that wait in it |
| P11 | For later phases. **P12a:** `architecture.md` layer 5 is still named *Ask*, a retired module name (coverage *Flags* row 3). J07 is the path the runtime's engine design serves; keep its step words when `modules/runtime.md` is reconciled. **P13:** *Flags* rows 1–3 go to Ravi. RT-18 · RT-19, EX-27 · EX-28, the DA curator path and AG-35's *staff a Graph with agents* are deliberately on no journey, for the reasons in the coverage table. Raised: R194 (board names `start.*` · `shell.*` are not package names) |
| P12a | Done as the steps say, split as the lead plus two read-only analysts (build plans · design docs); the lead wrote every spec. `data-model.md` now holds every app-database table (95, from the golden schema) under its package name with its module file, *The event store* and *Migrations*. `api-and-cli.md` gains *Route groups* (Q3), its lists under package routes, and every command by package with *not built* marked. `architecture.md` gains *Inside a module* (the engine standard from the stale migration plan), the shared packages' contents, and an *Engine design* column indexing every module spec. Also edited: `governance-and-lens.md`, `modules/{graphs,access,access-events,runtime,runtime-connectors}.md`, `orchestration.md` (run record fields and catalogue only). Coverage is `specs-m4-system-design-a.md`: 7 stale files merged, 18 retired, 27 code rows `shared`; no story, no status change |
| P12a | Decisions the docs did not settle, for *Questions for Ravi*. (1) History's rows are `access_ledger_rows`; `events` is the bus beneath (change list, live tail, notification rules, traces). Support: P04 *Flags* row 4's pick and AC-F06 *History is one place*. Rejected: History reading `events`. (2) The rename map's `/llm` row now targets `/api/v1/runtime/llms`, install-wide. Support: RT-F01 and `runtime.md` *AI models are the install's*. Rejected: keeping it per Graph. (3) Layer 5 is named *Explore*, and *memory* leaves layer 6. Support: the retired-concepts rule. Rejected: *Answers*. (4) OpenAPI and Airbyte adapters and a connector gateway from the old system design are retired, not merged. Support: `integrations.md` reaches outside systems through tool plugins and MCP servers. Rejected: writing them as designed, which would be new scope (*Flags* row 3). (5) An event's scopes stay columns; there is no scope table. Support: the golden schema. Rejected: designing the join table P04 described |
| P12a | For later phases. **P12b:** `orchestration.md` still says Todo, Flow, Task and TaskRun throughout (P02 note). P12a changed only its run record fields and the catalogue keys. `plan_origin` and *a Flow needs no version table* are P08b's notes. From the stale `governance.md`, the plan and run drawing rules go into `studio/task-flow-canvas.md`: time on x and a row per participant; `graph data` and `llm` bands open; a replan is a divider; plan colour is category and run colour is status; observed figures are a layer that is off by default. From the stale system design, remote workers reach customer sources directly and keep artifacts in their own network, holding only a digest in the engine (`runtime.md`). The *Metrics are stored* table in `architecture.md` still says `task_runs` and `TaskRun`. **P13:** *Flags* rows 1–3 go to Ravi. R128 (code and `engine/CLAUDE.md` cite the stale migration plan) should now point at `architecture.md` › *Inside a module*. Raised: R195 (CLI nouns `iam`, `govern`, `stitches`) |
| P12b | Done as the steps say, as the lead plus two read-only analysts (the Studio docs, and orchestration). The lead wrote every spec. The 21 stale files are 7 merged and 14 retired, including every Studio build plan; there is no story and no status change. `orchestration.md` and `runtime.md` now say task, plan, step and run under their package tables (`todo_id` stays the column's name). They gained the grammar, bindings, fan-out outputs, converging readiness, the ceilings, the coordinator lease, the new events and six worked examples, so R127 is closed. New sections: `runtime.md` › *The generated admin*, `design-language.md` › *Regions at work*, `design-kit-coverage.md` § 6d (with D7 and § 1.2 now three rungs), `task-flow-canvas.md` › *How a plan and a run read*, and `graph-model-canvas.md` GM14. Also edited: `architecture.md` › *Metrics are stored* (`agents_runs`, PJ-10's reach), `observability.md` (no currency metric), `modules/agents-plans.md` (Todo → task) and `modules/runtime-connectors.md` (the raw Gremlin path, from the P05 note). Coverage is `specs-m4-system-design-b.md` |
| P12b | Decisions the docs did not settle, for *Questions for Ravi*. (1) The generated admin deletes only what the product deletes, and append-only records are read-only there. Support: `runtime.md` *Admin writes are events like any product write* and AC-F06 *History is never edited or deleted*. Rejected: a free table editor (R120 asked keep or specify). (2) The agent's own ceiling is `max_concurrent_runs` (3, refused), and the Graph's is `max_concurrent_runs` (4). `max_concurrent_steps` and per-plan concurrency are marked not built. Support: the code and `modules/graphs.md`. Rejected: renaming the Graph's ceiling to `max_concurrent_steps`, as the P05 note implied. (3) `invana.llms.cost` and the LLMs dashboard's cost tile leave the design. Support: tokens, never currency. Rejected: keeping a currency metric for operators. (4) The screen map is the features' `boards:` keys, `architecture.md` › *Studio routes* and `design-language.md` § 8. There is no new `screen-map.md`. Support: CLAUDE.md rule 15. Rejected: a generated screen-map file. (5) The Studio build plans are `retired`, not `merged`, even where a rule moved into `design-language.md`, because *Done when* says so |
| P12b | For later phases. **P13:** `design-kit-coverage.md` still holds `TaskRun`, `Flow` and `text-meta` in its history rows (§§ 2.7–3.8, and the shipped phases). Its rules (D7, § 1.2) are fixed, so delete or keep those rows as history. The *Flow* tab name in `task-flow-canvas.md` is the screen's word for a skill's or a run's drawing, not the retired record. Raised: R196 (admin writes emit no event and delete kept records — security, medium) · R197 (`/health` liveness and readiness) · R198 (a kit control-height token and `FieldConfig` validation) · R199 (Studio guard scripts). Closed: R127 |
| P13 | Done as the steps say, alone (one surface, five files). All 195 stale files were disposed `merged into` (144) or `retired` (51), none `kept`, and all are deleted. `specs/_stale/` holds only `README.md` and `code.md`, both `kept` as the kept-lists, each with an empty *Kept* table. `code.md` › *Deleted* is unchanged, because m3-code C02 reads it. M2 in `migrations.md` says what `_stale/` holds. The final report is `specs-m4-coverage.md`: totals per phase (259 code units, 224 mapped and 35 `shared`), every *Stories written* row and every *Flags* row (108 from P02–P12b, plus 4 from P13), and the recommendations. No feature status fell. The old stale text now lives only in git history at `chore/specs-m4` |
| P13 | Decisions the docs did not settle, for *Questions for Ravi*. (1) The for-developers files were deleted although m3-code D04 (pending) reads them. Support: P13 *Done when* (*every stale file disposed `merged into` or `retired` is deleted*), and the coverage files map each old path to its live home. Rejected: keeping them until D04 runs. Raised as R200 (repoint D04's *Read*). (2) `code.md` keeps the mail and science deletion, which Ravi approved (m3-code Q3), although P05 mapped both to RT-04. Support: *Breaking changes are flags*. Rejected: dropping the rows. This is the coverage *Flags* P13 row 1, and R119 stays open until C02 runs. (3) The `design-kit-coverage.md` history rows (P12b note) sit outside P13's *Lands*. Raised as R201. **For Ravi's spec review:** every row of `specs-m4-coverage.md` › *Flags*; the security-high recommendations R138 · R151 · R159 · R165 · R168 · R176 · R182; and R128, whose target is now `architecture.md` › *Inside a module* |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-09 | P10 | Q1 · Is `data` a package of specs only? | Specs only · an engine module | Specs only — its stories are served by `explore` and `model`, as `architecture.md` › *Settled clashes* says | Approved as recommended |
| 2026-11-09 | P06, P12a | Q2 · Where does `graph_query_log` go? | `model` · `explore` | `model`, as `model_query_log` | Approved as recommended |
| 2026-11-09 | P12a, all | Q3 · Keep the `/api/v1/u/{u}/{g}` route scope? | Keep · Change | Keep; only the `<pkg>/<records>` tail follows the package | Approved as recommended |
| 2026-11-09 | P02–P10 | Q4 · Status of a story for a feature the code has but no spec names | `idea` · `specified` | `idea` with all five parts — `specified` needs Ravi's spec review, which follows the run | Approved as recommended |
| 2026-11-09 | P05 | Q5 · RT-F05 is m3-code D02's; who writes it? | P05, to D02's Done when · leave it to m3-code | P05 writes it, stories `idea`; m3-code resumes on this project's last branch, so D02 only checks it | Approved as recommended |
| 2026-11-09 | all | Q6 · Where do the retired concepts' code go? | To their owners today · back as modules | Owners today: plan and flow library → agents AG-F06 · ask gate → access AC-F05 and agents AG-F05 · memory → the model starter and EX-F07 · Operate → access, graphs, agents and `observability.md` | Approved as recommended |
| 2026-11-09 | all | Q7 · Pause for Ravi between phases? | No pauses · at set points | No pauses; Ravi reviews the stacked branches and `specs-m4-coverage.md` at the end, as the spec review | Approved as recommended |
| 2026-11-09 | all | Q8 · Branch | Stacked phase branches · one branch | `chore/specs-m4` cut from the branch the checkout is on; the runner stacks `specs-m4/<ID>-<slug>` | Approved as recommended |
| 2026-11-09 | P02–P10 | Q9 · Where does a new story go? | The owning feature · a new feature | The owning feature; a new one only when none owns it. A feature whose status falls is listed in the hand-off note | Approved as recommended |
| 2026-11-09 | all | Q10 · A designed story the code or a stale file contradicts | Flag · change it | Flag in the coverage file and a hand-off note; never change it in this run | Approved as recommended |
