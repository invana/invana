---
name: specs-m5
status: done
branch: chore/specs-m5
scope: specs-m5
---

# Specs M5 — every piece of the old docs' content lives, once, in a live spec

Seven QA fidelity audits read the old docs at git commit `0236fa8d2d04` against the live `specs/` and all returned
`RESULT: FAIL`: 441 numbered gaps (about 419 PARTIAL and 325 MISSING items), mostly engine design — wire contracts,
response shapes, defaults, error codes and the why of decisions — plus conflicts and repeated facts. This project
restores each gap into the one live file that owns it, decides the conflicts from the code, collapses every repeated
fact to one home, and proves it with a fresh re-audit that passes. Spec only. For everyone who specifies, draws,
builds and checks Invana.

| | |
|---|---|
| Goal | Every PARTIAL and MISSING item of the seven audits and of the remainder audit (P01) is restored in its live home, retired with its reason in a live spec, or decided · the eight conflicts are decided once, from the code, with the evidence · every repeated fact has one home and links · `.agent-reports/qa/specs-fidelity-reaudit.md` starts `RESULT: PASS` · `specs/migrations.md` holds the tracked M4 coverage table (old area → live home, counts, decisions) |
| Specs | `specs/os/**` (GR · AC · RT) · `specs/capabilities/**` (MO · DS · AG · EX · PJ · DA) · `specs/system-design/**` · `specs/design-language.md` · `specs/glossary.md` · `specs/personas.md` · `specs/journeys/**` (the board rename only) · `specs/migrations.md` · `specs/_stale/code.md` (two rows) · recommendations R119 · R120 · R158 · R163 · R194 |
| Not in this project | Any change to `engine/`, `studio/`, `integrations/`, `scripts/`, `demos/`, `docker/`, `docs/`, tests or changesets · boards and the canvas (`.design/`) · team files — `CLAUDE.md`, `.claude/**` but this file's Log and hand-off notes and `add.py` · moving any story to `specified` or above · the m3-code project's phases · writing history, plans or slice ids into a spec |

Run it: `python3 .claude/skills/run-project/run.py specs-m5` (the project-lead does, with `--start`). Start it on the
branch the checkout is on, with a clean tree: the runner cuts `chore/specs-m5` there and stacks each phase on its own
`specs-m5/<ID>-<slug>` branch. No phase pauses; Ravi reviews the stacked branches, the coverage files and the
*Ravi-reversible* hand-off notes at the end.

## Rules for every session

| Rule | Detail |
|---|---|
| Full auto | No phase waits for a person and no session sets its row `blocked` to ask. A question the rules and *Settled decisions* do not answer is decided by the option closest to `specs/vision.md`, `specs/system-design/architecture.md` and the code, and written as a hand-off note. Nothing in this file is an `Approve` |
| Spec only | A product-manager phase writes only the live files *Ownership* gives it, its coverage file `.agent-reports/product-manager/specs-m5-<ID>.md`, its hand-off notes and recommendations (`add.py`). A qa phase writes only the report its *Done when* names and recommendations, never this file — its report's last section is its hand-off, and the next phase reads it. Never code, tests, changesets, boards, `docs/` or team files |
| Each file once | P02–P17 restore: each edits only the files *Ownership* gives it, and no two of them share a file. An item whose content another phase's file should also mention is written once, in the owner's file; the other file's link is P19's. P18 to P23 come after every restore and may edit any live file, each for its own job only |
| The assignment governs | *Assignment* gives every numbered item of the seven reports to exactly one phase. P01's remainder items (`REM<n>`) carry their phase in the report. A phase disposes its own items and no other; an item it finds belongs elsewhere is a hand-off note naming the phase, never a second edit |
| The sources | The seven audits and P01's are in `.agent-reports/qa/` (git-ignored: they live only in the working tree — never clean or delete them). An item's old text is the report's quote; for more, `git show 0236fa8d2d04:<old path>`. `specs/_stale/` holds no old doc any more: no spec cites a `_stale` path |
| How an item is restored | In the live file the report names, in tables and bullets, present tense, no history, no decision ids, no slice ids · engine names follow `architecture.md` › *One name across layers* and *The rename map* (tables `<pkg>_<records>`, routes `/api/v1/u/{u}/{g}/<pkg>/<records>`, events `<pkg>.<records>.<verb>`) — a renamed name is not a loss · a value the old doc and the live spec disagree on is checked in the code: the code settles an engine fact (cite the path as a code span); a product choice follows the live spec, and the old rule is recorded as reversed in the Decisions table it governs · code paths are code spans, never links |
| Stories | Load `.claude/skills/product-spec/SKILL.md` and `format.md` before writing. A product rule an item restores is a Given/When/Then criterion on the story that owns it (next free number), or a row of the feature's Rules, Decisions, Not building or Open questions. No new story unless no story owns the act: then it is `idea` with all five parts, *Who can* Admin and Operator, every `## Screens` cell a board or `—`, and an empty `task.md`. Every story is `idea` or `later`, so a criterion change is not breaking — but no story moves status |
| Retired is said in a spec | An item disposed `retired` is closed only when a live spec says so — a *Not building* row, a Decisions row or a glossary *words not used* row — or when the report itself marks it history with no product content (slice ids, build plans, file moves). The coverage row names which |
| Coverage file | `.agent-reports/product-manager/specs-m5-<ID>.md`: a table `Item · Old (file and a short quote) · Disposition · Into · Evidence`. *Item* is the bare ID (`ST30`, `CDG13`, `REM4`, `RA2`). *Disposition* is one of `restored` · `retired — <why>` · `found — <where>` (the live spec already holds it) · `conflict → P18` · `no action — <why>` · `recommended — R<n>` (only for content whose home is a team file). *Into* links the live file and section. The word `conflict` appears in a restore phase's file only in that disposition. Then *Decisions taken* and *Ravi-reversible* |
| Conflicts go to P18 | An item that contradicts a live spec in a way neither the code nor a recorded decision settles is disposed `conflict → P18` and left for P18. The eight conflicts in *Conflicts* are P18's from the start |
| Settled decisions | *Settled decisions* below are rules. The phase each names writes it in its own files, and adds a hand-off note starting `Ravi-reversible:` that names the decision and where it is written |
| The index | `specs/README.md` is generated: any phase may run `python3 scripts/specs/check.py --index`; none edits it by hand |
| Recommendations | Content whose home is a team file (`CLAUDE.md`, a skill) and anything found outside the phase is raised with `python3 .claude/skills/recommend/add.py add --from <role> --raised-in "phase specs-m5/<ID>" …` — never fixed on the way. A phase closes the rows *Settled decisions* gives it with `add.py done <ID>` |
| Commands | One call, no pipes, no `rg` — search with `grep`. A file is deleted with `python3 -c` (pathlib `unlink`); `rm` and `git rm` are not allowed in a headless session |
| One commit per phase | The runner's closing `feat(specs-m5)` commit is the phase's commit. A session commits its `wip` only when it stops — at the end or at a hand-off |
| Budget | 300k a session. Past it, hand off with the coverage file's item-by-item progress — never cut scope |

## Settled decisions

| Decision | Phase · where it is written |
|---|---|
| Scale-out: keep the pool labels `cpu` · `llm` · `egress` · `gpu` · `code`, one queue per label and step class, the desired-workers figure clamped to the pool's min and max and to the Graph's worker-second quota, and a worker idle 5 minutes drained then stopped | P04 · a Decision on RT-F03 and the engine detail in `modules/runtime.md` |
| Scale-out: KEDA, Auto Scaling, multi-replica orchestrators and a per-mode deployment (laptop · compose · Kubernetes) are retired — they contradict *every group is scaled by hand* | P04 · RT-F03 *Not building* (PSD 8, 9, 11, 67) |
| Agent system: keep the goals *Trust* (every answer traced to the data it used) and *Privacy* (you can see what your AI models are given and what they produce), and *the gateway records each AI model call* — provider, model, tokens, the prompt as sent, the completion, which types, properties and records it was shown | P06 · `governance-and-lens.md` |
| Agent system: *only the gateway calls an AI model* and *only secrets holds keys* are import rules | P14 · `architecture.md` › *Inside a module* |
| Agent system: a value written from an AI model's output is marked `origin = llm`; every node and relationship Invana writes carries `written_by_run` · `written_at` · `origin` (`import` · `llm` · `user`) | P15 · `data-model.md` |
| Agent system retired: the router and specialist roster and its skill catalogue | P09 · `modules/agents.md` *Not building* |
| Agent system retired: OpenAPI and Airbyte adapters (Invana is a destination, no source connectors) | P08 · `specs/capabilities/datasets/product.md` *Not building* |
| Agent system retired: datasets as CSV files queried with DuckDB, with a size cap | P08 · `modules/datasets.md` *Not building* |
| Agent system retired: signed grants to remote workers and the action-vocabulary policy grammar | P03 · `modules/access.md` *Not building* |
| The default stance is retired | P09 · `modules/agents.md`; P16 · `glossary.md` words not used |
| The Data assistant is retired; the shipped agents are the live set | P09 · `modules/agents.md` › *Shipped agents* |
| A2A is version 1.0 | P09 · `modules/agents.md` (as `integrations.md` already says) |
| R158 — one kind of plugin: every tool plugin is an MCP server | P04 · RT-F02 and `modules/runtime.md`; P16 · `glossary.md`, then closes R158 |
| R163 — a link between models writes its relationships and withdraws them on removal | P06 · `governance-and-lens.md`; P16 · `glossary.md`, then closes R163 |
| R194 — rename the `start.*` and `shell.*` boards to their package names (`access.signin`, `access.locked`, `graphs.home`, `graphs.new_graph.*`, `graphs.graph_picker`, `graphs.command`, and the rest the same way) in every story's Screens, feature `boards:` key, journey and design file | P18 · every spec that names one; closes R194 and recommends the canvas rename to the designer |
| R119 — `web`, `mail` and `science` stay, as MCP servers | P04 · RT-F02 and `modules/runtime.md`; P23 · drops the two rows from `specs/_stale/code.md` › *Deleted*, then closes R119 |
| R120 — the generated admin is specified in `runtime.md` › *The generated admin* | P05 · confirms the section holds it, then closes R120 |

## Conflicts

P18's, decided from the code: read it, state the evidence (path and what it says) in `specs-m5-P18.md` and in the
Decisions table the conflict governs, and write the decided value once. A recorded product decision that the code has
not caught up with (a migration in `specs/migrations.md`) wins over the code; the lag is a recommendation.

| ID | Conflict | Items | Where it is stated today | Code to read |
|---|---|---|---|---|
| C1 | Username length (1–64 by the regex, 2–64 in AC-F01 and AC-02.5) and reserved words (*only `u`* against *a reserved list is not built*) | IP4 | `modules/access.md` · AC-F01 · AC-02 | the username validator in `engine/src/invana/apps/iam` and `core/auth` |
| C2 | Agents as a Graph's members or as principals that are not members | IP14 | GR-F04 · GR-13 · `glossary.md` | the members model and routes in `engine/src/invana/apps/graphs` and `apps/agents` |
| C3 | The Graph role `viewer` or `operator` | — (the identity audit's REDUNDANT table) | `modules/graphs.md` · `glossary.md` · `api-and-cli.md` | `GraphRole` in the engine, and `specs/migrations.md` M1 |
| C4 | When a publish approval's payload (the impact list) is frozen — at request or when the preview settles | CDG13 | MO-F02 · `modules/model.md` | the publish review in `engine/src/invana/apps/modeller` |
| C5 | Whether `generated_query` is always recorded and `executed_query` only when the lens rewrote it | CDG33 | `governance-and-lens.md` · `modules/model-lenses.md` | where the run step and the touch store query texts, under `engine/src/invana/runtime` |
| C6 | The board kind set — six kinds plus declared kinds, and which declared kinds | OWE79 | `modules/explore-boards.md` | the board kinds in `engine/src/invana/apps/boards` and Studio's board registry |
| C7 | The plans that apply and withdraw a link — AG-F06's `stitch-*` names against `link-commit@1` · `link-withdraw@1`, the `graph_data/stitch/…` address and `invana stitches` | — (the connect audit's naming conflict) | AG-F06 · `modules/model.md` · `governance-and-lens.md` · `api-and-cli.md` | `engine/src/invana/plugins/core/*/flows/*.toml` and `apps/modeller/links.py` |
| C8 | The glossary's *nine* board kinds against the explore design's six plus thirteen declared | AME32 | `glossary.md` · `modules/explore-boards.md` | as C6; one list in `explore-boards.md`, the glossary links it |

## Ownership

Which live files each restore phase edits. Paths are under `specs/`; `modules/` is `specs/system-design/modules/`.

| Phase | Files |
|---|---|
| P02 graphs | `os/graph/**` · `modules/graphs.md` |
| P03 access | `os/access/**` · `modules/access.md` · `modules/access-events.md` |
| P04 runtime | `os/runtime/**` · `modules/runtime.md` · `modules/runtime-connectors.md` · `system-design/integrations.md` |
| P05 runtime and orchestration | `system-design/runtime.md` · `system-design/orchestration.md` · `system-design/observability.md` |
| P06 governance and lenses | `system-design/governance-and-lens.md` · `modules/model-lenses.md` |
| P07 model | `capabilities/model/**` · `modules/model.md` |
| P08 datasets | `capabilities/datasets/**` · `modules/datasets.md` · `modules/datasets-loads.md` |
| P09 agents and runs | `capabilities/agents/product.md` · AG-F01 · AG-F02 · AG-F03 · AG-F05 · AG-F08 (each feature's folder) · `modules/agents.md` |
| P10 skills, plans and schedules | AG-F04 · AG-F06 · AG-F07 (each feature's folder) · `modules/agents-skills.md` · `modules/agents-plans.md` |
| P11 explore — asking | `capabilities/explore/product.md` · EX-F03 · EX-F04 · EX-F05 · EX-F07 · `modules/explore-questions.md` · `modules/explore-memory.md` |
| P12 explore — the board | EX-F01 · EX-F02 · EX-F06 · `modules/explore-boards.md` |
| P13 projects and data | `capabilities/projects/**` · `capabilities/data/**` · `modules/projects.md` |
| P14 architecture | `system-design/architecture.md` |
| P15 data model, API and CLI | `system-design/data-model.md` · `system-design/api-and-cli.md` |
| P16 design language and glossary | `design-language.md` · `glossary.md` · `personas.md` |
| P17 Studio system design | `system-design/studio/**` |

No restore phase edits `vision.md`, `journeys/**`, `migrations.md` or `_stale/**`.

## Assignment

Every numbered item of the seven reports, by phase. An item is the report's numbered entry; its ID is the prefix and
the number (`ST30`). A phase is chosen by the first live file the item's *add to* names, read against *Ownership*;
an item with no live home (history, team-file content, a note) is P23's.

| Prefix | Report in `.agent-reports/qa/` |
|---|---|
| ST | `specs-fidelity-studio.md` |
| CDG | `specs-fidelity-connect-data-govern.md` |
| ASW | `specs-fidelity-agents-skills-workflows.md` |
| AME | `specs-fidelity-ask-memory-explore.md` |
| IP | `specs-fidelity-identity-platform.md` |
| OWE | `specs-fidelity-operate-work-engine.md` |
| PSD | `specs-fidelity-products-systemdesign.md` |
| REM | `specs-fidelity-remainder.md` (P01 writes it; each row names its phase) |
| RA | `specs-fidelity-reaudit-round1.md` (P20 writes it; P21 closes every row) |

| Phase | Items | Count |
|---|---|---|
| P02 | ST 41, 43–45, 52 · CDG 1–2 · ASW 14, 17 · AME 9 · IP 7–9, 11, 13, 69–72, 74 · OWE 5, 14, 86 · PSD 33 | 24 |
| P03 | IP 1–3, 5–6, 10, 15–24, 26, 46–47, 66 · OWE 1–4, 6–13, 15, 17–18, 40 · PSD 32, 44 | 38 |
| P04 | ASW 16, 24–25 · IP 39, 48–52, 54–65, 67–68 · OWE 16, 19 · PSD 4, 6–9, 11, 13–15, 25, 67 | 36 |
| P05 | ASW 37 · AME 24 · IP 38, 40, 42–45, 53, 73 · OWE 25, 29, 45–47, 55, 59, 64–65, 80 · PSD 12, 17, 57–58 | 24 |
| P06 | ST 72 · CDG 30–32, 34–40 · ASW 5 · OWE 61, 67–73 · PSD 36, 64 | 22 |
| P07 | ST 67–68, 70 · CDG 3–7, 9–11, 15–21, 23–29 · ASW 30 · PSD 27, 35 | 28 |
| P08 | CDG 41–42, 44–45, 47 · PSD 1–3, 40–41 | 10 |
| P09 | ST 53 · ASW 1–4, 6–13, 15, 18–23, 27–29 · AME 21 · OWE 21–24, 74 · PSD 10, 24, 43, 63 | 33 |
| P10 | ST 54–66, 69 · ASW 31–36, 38–39 · OWE 26, 48–54, 56–58, 87, 89 · PSD 16, 18–19, 22, 39 | 40 |
| P11 | ST 46, 71 · AME 1–8, 10–20, 23, 25–27 · PSD 26, 31 | 27 |
| P12 | AME 28–31, 33–48 · OWE 75–78 | 24 |
| P13 | OWE 31–35, 37–39, 41–43 | 11 |
| P14 | ST 1–12, 14–16, 18, 25–26, 29 · IP 33, 41 · OWE 62–63, 66, 82–85, 88 · PSD 37, 45, 49–50, 59, 65 | 35 |
| P15 | CDG 8, 12, 14, 22, 43, 46 · IP 12, 35, 37 · OWE 27 · PSD 21, 30, 34, 38, 42, 51 | 16 |
| P16 | ST 17, 27–28, 30–40, 42, 47–48, 50–51, 73 · ASW 26 · AME 22, 49 · IP 25, 34, 36 · OWE 20 · PSD 23, 46, 60 | 30 |
| P17 | ST 13, 19–24, 49 · IP 28–32 · PSD 62 | 14 |
| P18 | CDG 13, 33 · AME 32 · IP 4, 14 · OWE 79 — and C1–C8 | 6 |
| P23 | ST 74 · IP 27, 75 · OWE 28, 30, 36, 44, 60, 81 · PSD 5, 20, 28–29, 47–48, 52–56, 61, 66, 68 | 23 |
| **Total** | | **441** |

Where an item names two homes, the assignment picked one: ST 2–4, 9, 12, 14–16, 25–26, 29 (*Same home* — the new
*Inside a Studio package*) are P14 · ST 7 (component suffixes) is P14 · ST 55–63 (plan drawing) are AG-F06's, P10 —
the Gantt row of `design-kit-coverage.md` gets its link in P19 · ST 68 (rule offer counts) is `modules/model.md`, P07 ·
PSD 6 (pools and queues) is P04, with `runtime.md` › *Workers* linking it in P19.

## Environment

| Name | Value |
|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` |

## Gates

Spec only: no stack, no setup, no code gates. A phase's *items* gate checks that every item the *Assignment* gives
it, and every `REM` row P01 tagged with it, has a row with a disposition in its coverage file. A *restored* gate
checks a few distinctive tokens from the phase's gaps now stand in its files.

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| spec tooling tests | `python3 -m unittest discover -s scripts/specs` | `.` | all | |
| no live cite of stale | `! grep -rIl --exclude-dir=_stale --exclude=migrations.md -F _stale/ specs docs` | `.` | all | |
| spec only | `sh -c 'test -z "$(git diff --name-only chore/specs-m5 -- engine studio integrations scripts demos docker docs .github .changeset .design CLAUDE.md .claude/skills .claude/agents .claude/hooks .claude/team/TEAM.md)" && test -z "$(git status --porcelain -- engine studio integrations scripts demos docker docs .github .changeset .design CLAUDE.md .claude/skills .claude/agents .claude/hooks .claude/team/TEAM.md)"'` | `.` | all | |
| honest status | `python3 -c "import subprocess,pathlib,re,sys; g=lambda *a: subprocess.run(['git',*a],capture_output=True,text=True).stdout.split(); new=sorted(set(g('diff','--name-only','--diff-filter=A','chore/specs-m5','--','specs')+g('ls-files','--others','--exclude-standard','--','specs'))); s=[f for f in new if f.endswith('/story.md') and any(('status: '+w) in pathlib.Path(f).read_text() for w in ('specified','designed','built','verified'))]; t=[f for f in new if f.endswith('/task.md') and re.search('-T[0-9]+ ',pathlib.Path(f).read_text())]; print(len(new),'new spec files; stories above idea:',s,'task rows written:',t); sys.exit(1 if s+t else 0)"` | `.` | all | |
| remainder audit | `python3 -c "import pathlib,sys; P=chr(124); t=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md').read_text(); ok=set('P02 P03 P04 P05 P06 P07 P08 P09 P10 P11 P12 P13 P14 P15 P16 P17 P18 P23'.split()); rows=[c for c in (l.split(P) for l in t.splitlines()) if len(c)>3 and c[1].strip().startswith('REM')]; bad=[c[1].strip() for c in rows if c[2].strip() not in ok]; print(len(rows),'remainder gaps;',len(bad),'without a phase',bad[:20]); sys.exit(0 if t.lstrip().startswith('RESULT:') and not bad else 1)"` | `.` | P01 | |
| items · P02 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P02.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST41 ST43 ST44 ST45 ST52 CDG1 CDG2 ASW14 ASW17 AME9 IP7 IP8 IP9 IP11 IP13 IP69 IP70 IP71 IP72 IP74 OWE5 OWE14 OWE86 PSD33'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P02']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P02.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P02 | |
| items · P03 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P03.md'); t=f.read_text().splitlines() if f.exists() else []; ids='IP1 IP2 IP3 IP5 IP6 IP10 IP15 IP16 IP17 IP18 IP19 IP20 IP21 IP22 IP23 IP24 IP26 IP46 IP47 IP66 OWE1 OWE2 OWE3 OWE4 OWE6 OWE7 OWE8 OWE9 OWE10 OWE11 OWE12 OWE13 OWE15 OWE17 OWE18 OWE40 PSD32 PSD44'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P03']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P03.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P03 | |
| items · P04 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P04.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ASW16 ASW24 ASW25 IP39 IP48 IP49 IP50 IP51 IP52 IP54 IP55 IP56 IP57 IP58 IP59 IP60 IP61 IP62 IP63 IP64 IP65 IP67 IP68 OWE16 OWE19 PSD4 PSD6 PSD7 PSD8 PSD9 PSD11 PSD13 PSD14 PSD15 PSD25 PSD67'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P04']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P04.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P04 | |
| items · P05 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P05.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ASW37 AME24 IP38 IP40 IP42 IP43 IP44 IP45 IP53 IP73 OWE25 OWE29 OWE45 OWE46 OWE47 OWE55 OWE59 OWE64 OWE65 OWE80 PSD12 PSD17 PSD57 PSD58'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P05']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P05.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P05 | |
| items · P06 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P06.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST72 CDG30 CDG31 CDG32 CDG34 CDG35 CDG36 CDG37 CDG38 CDG39 CDG40 ASW5 OWE61 OWE67 OWE68 OWE69 OWE70 OWE71 OWE72 OWE73 PSD36 PSD64'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P06']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P06.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P06 | |
| items · P07 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P07.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST67 ST68 ST70 CDG3 CDG4 CDG5 CDG6 CDG7 CDG9 CDG10 CDG11 CDG15 CDG16 CDG17 CDG18 CDG19 CDG20 CDG21 CDG23 CDG24 CDG25 CDG26 CDG27 CDG28 CDG29 ASW30 PSD27 PSD35'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P07']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P07.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P07 | |
| items · P08 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P08.md'); t=f.read_text().splitlines() if f.exists() else []; ids='CDG41 CDG42 CDG44 CDG45 CDG47 PSD1 PSD2 PSD3 PSD40 PSD41'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P08']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P08.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P08 | |
| items · P09 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P09.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST53 ASW1 ASW2 ASW3 ASW4 ASW6 ASW7 ASW8 ASW9 ASW10 ASW11 ASW12 ASW13 ASW15 ASW18 ASW19 ASW20 ASW21 ASW22 ASW23 ASW27 ASW28 ASW29 AME21 OWE21 OWE22 OWE23 OWE24 OWE74 PSD10 PSD24 PSD43 PSD63'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P09']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P09.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P09 | |
| items · P10 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P10.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST54 ST55 ST56 ST57 ST58 ST59 ST60 ST61 ST62 ST63 ST64 ST65 ST66 ST69 ASW31 ASW32 ASW33 ASW34 ASW35 ASW36 ASW38 ASW39 OWE26 OWE48 OWE49 OWE50 OWE51 OWE52 OWE53 OWE54 OWE56 OWE57 OWE58 OWE87 OWE89 PSD16 PSD18 PSD19 PSD22 PSD39'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P10']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P10.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P10 | |
| items · P11 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P11.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST46 ST71 AME1 AME2 AME3 AME4 AME5 AME6 AME7 AME8 AME10 AME11 AME12 AME13 AME14 AME15 AME16 AME17 AME18 AME19 AME20 AME23 AME25 AME26 AME27 PSD26 PSD31'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P11']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P11.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P11 | |
| items · P12 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P12.md'); t=f.read_text().splitlines() if f.exists() else []; ids='AME28 AME29 AME30 AME31 AME33 AME34 AME35 AME36 AME37 AME38 AME39 AME40 AME41 AME42 AME43 AME44 AME45 AME46 AME47 AME48 OWE75 OWE76 OWE77 OWE78'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P12']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P12.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P12 | |
| items · P13 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P13.md'); t=f.read_text().splitlines() if f.exists() else []; ids='OWE31 OWE32 OWE33 OWE34 OWE35 OWE37 OWE38 OWE39 OWE41 OWE42 OWE43'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P13']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P13.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P13 | |
| items · P14 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P14.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST1 ST2 ST3 ST4 ST5 ST6 ST7 ST8 ST9 ST10 ST11 ST12 ST14 ST15 ST16 ST18 ST25 ST26 ST29 IP33 IP41 OWE62 OWE63 OWE66 OWE82 OWE83 OWE84 OWE85 OWE88 PSD37 PSD45 PSD49 PSD50 PSD59 PSD65'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P14']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P14.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P14 | |
| items · P15 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P15.md'); t=f.read_text().splitlines() if f.exists() else []; ids='CDG8 CDG12 CDG14 CDG22 CDG43 CDG46 IP12 IP35 IP37 OWE27 PSD21 PSD30 PSD34 PSD38 PSD42 PSD51'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P15']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P15.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P15 | |
| items · P16 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P16.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST17 ST27 ST28 ST30 ST31 ST32 ST33 ST34 ST35 ST36 ST37 ST38 ST39 ST40 ST42 ST47 ST48 ST50 ST51 ST73 ASW26 AME22 AME49 IP25 IP34 IP36 OWE20 PSD23 PSD46 PSD60'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P16']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P16.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P16 | |
| items · P17 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P17.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST13 ST19 ST20 ST21 ST22 ST23 ST24 ST49 IP28 IP29 IP30 IP31 IP32 PSD62'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P17']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P17.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P17 | |
| items · P23 | `python3 -c "import pathlib,re,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P23.md'); t=f.read_text().splitlines() if f.exists() else []; ids='ST74 IP27 IP75 OWE28 OWE30 OWE36 OWE44 OWE60 OWE81 PSD5 PSD20 PSD28 PSD29 PSD47 PSD48 PSD52 PSD53 PSD54 PSD55 PSD56 PSD61 PSD66 PSD68'.split(); r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P23']; W=('restored','retired','found','conflict','no action','recommended'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'items;',len(m),'without a disposition in .agent-reports/product-manager/specs-m5-P23.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P23 | |
| items · P18 | `python3 -c "import pathlib,re,sys; P=chr(124); R=pathlib.Path('.agent-reports/product-manager'); ids='AME32 CDG13 CDG33 IP4 IP14 OWE79 C1 C2 C3 C4 C5 C6 C7 C8'.split(); ids+=[m.group(0) for f in sorted(R.glob('specs-m5-P*.md')) if f.name<'specs-m5-P18.md' for l in f.read_text().splitlines() if 'conflict' in l for m in [re.search(r'\b[A-Z]{2,3}[0-9]+\b',l)] if m]; r=pathlib.Path('.agent-reports/qa/specs-fidelity-remainder.md'); ids+=[c[1].strip() for c in (l.split(P) for l in (r.read_text().splitlines() if r.exists() else [])) if len(c)>3 and c[1].strip().startswith('REM') and c[2].strip()=='P18']; f=R/'specs-m5-P18.md'; t=f.read_text().splitlines() if f.exists() else []; W=('decided','retired','restored','found'); m=[i for i in dict.fromkeys(ids) if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'conflicts and items;',len(m),'not decided in specs-m5-P18.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P18 | |
| re-audit gaps closed | `python3 -c "import pathlib,re,sys; P=chr(124); r=pathlib.Path('.agent-reports/qa/specs-fidelity-reaudit-round1.md'); ids=[c[1].strip() for c in (l.split(P) for l in r.read_text().splitlines()) if len(c)>3 and c[1].strip().startswith('RA')]; f=pathlib.Path('.agent-reports/product-manager/specs-m5-P21.md'); t=f.read_text().splitlines() if f.exists() else []; W=('restored','retired','decided','found'); m=[i for i in ids if not any(re.search(r'\b'+i+r'\b',l) and any(w in l for w in W) for l in t)]; print(len(ids),'re-audit gaps;',len(m),'not closed in specs-m5-P21.md',m[:40]); sys.exit(1 if m else 0)"` | `.` | P21 | |
| restored · P02 | `grep -qF skipped_at specs/system-design/modules/graphs.md && grep -qF notify_line specs/system-design/modules/graphs.md && grep -qF test_connection specs/system-design/modules/graphs.md` | `.` | P02 | |
| restored · P03 | `grep -qF reuse_detected specs/system-design/modules/access.md && grep -qF can_see specs/system-design/modules/access.md && grep -qF rows_failing specs/system-design/modules/access.md` | `.` | P03 | |
| restored · P04 | `grep -qF invana_wkr_ specs/system-design/modules/runtime.md && grep -qF tomllib specs/system-design/modules/runtime.md && grep -qF restart_required specs/system-design/modules/runtime.md && grep -qF egress specs/os/runtime/features/RT-F03-workers-and-the-queue/feature.md && grep -qF KEDA specs/os/runtime/features/RT-F03-workers-and-the-queue/feature.md` | `.` | P04 | |
| restored · P05 | `grep -qF worker_error specs/system-design/runtime.md && grep -qF write_graph specs/system-design/orchestration.md` | `.` | P05 | |
| restored · P06 | `grep -qF never_touched specs/system-design/governance-and-lens.md specs/system-design/modules/model-lenses.md && grep -qF rule_matched specs/system-design/governance-and-lens.md specs/system-design/modules/model-lenses.md && grep -qF Privacy specs/system-design/governance-and-lens.md` | `.` | P06 | |
| restored · P07 | `grep -qF model_name_taken specs/system-design/modules/model.md && grep -qF advice_unsupported_by_connector specs/system-design/modules/model.md && grep -qF rule_offer_counts specs/system-design/modules/model.md` | `.` | P07 | |
| restored · P08 | `grep -rqF Frictionless specs/capabilities/datasets specs/system-design/modules/datasets.md && grep -rqF DuckDB specs/capabilities/datasets specs/system-design/modules/datasets.md && grep -rqF Airbyte specs/capabilities/datasets` | `.` | P08 | |
| restored · P09 | `grep -qF eval_required specs/system-design/modules/agents.md && grep -qF check_traits specs/system-design/modules/agents.md && grep -qF version_not_offered specs/system-design/modules/agents.md && grep -qF effective_effort specs/system-design/modules/agents.md` | `.` | P09 | |
| restored · P10 | `grep -qF hit_limit specs/system-design/modules/agents-skills.md && grep -qF seam specs/capabilities/agents/features/AG-F06-plans-and-functions/feature.md && grep -qF loosen specs/system-design/modules/agents-plans.md` | `.` | P10 | |
| restored · P11 | `grep -qF fork_count specs/system-design/modules/explore-questions.md && grep -qF aggregate_and_chart specs/system-design/modules/explore-questions.md && grep -qF open_list specs/system-design/modules/explore-questions.md` | `.` | P11 | |
| restored · P12 | `grep -qF expand_queued specs/system-design/modules/explore-boards.md && grep -qF writes_unsupported specs/system-design/modules/explore-boards.md && grep -qF total_nodes specs/system-design/modules/explore-boards.md` | `.` | P12 | |
| restored · P13 | `grep -rqF needs_split specs/system-design/modules/projects.md specs/capabilities/projects && grep -qF created_by_name specs/system-design/modules/projects.md` | `.` | P13 | |
| restored · P14 | `grep -qF "Inside a Studio package" specs/system-design/architecture.md && grep -qF noRestrictedImports specs/system-design/architecture.md && grep -qF check-boundaries specs/system-design/architecture.md` | `.` | P14 | |
| restored · P15 | `grep -qF written_by_run specs/system-design/data-model.md && grep -qF -e --non-interactive specs/system-design/api-and-cli.md` | `.` | P15 | |
| restored · P16 | `grep -qF bottomSpan specs/design-language.md && grep -qF idPrefix specs/glossary.md && grep -qF "top bar" specs/glossary.md` | `.` | P16 | |
| restored · P17 | `grep -qF GraphCanvas specs/system-design/studio/graph-model-canvas.md && grep -qF FieldConfig specs/system-design/studio/components-todo.md` | `.` | P17 | |
| boards renamed | `! grep -rqF --exclude=migrations.md --exclude-dir=_stale -e start.home -e start.signin -e start.new_graph -e start.graph_picker -e shell.command -e shell.locked specs` | `.` | P18 | |
| one home | `python3 -c "import pathlib,sys; P=chr(124); f=pathlib.Path('.agent-reports/product-manager/specs-m5-P19.md'); rows=[l for l in (f.read_text().splitlines() if f.exists() else []) if l.startswith(P+' RD')]; bad=[l[:60] for l in rows if '](' not in l and 'kept split' not in l]; print(len(rows),'redundancy rows;',len(bad),'without a home link or a kept-split reason',bad[:20]); sys.exit(0 if len(rows)>=38 and not bad else 1)"` | `.` | P19 | |
| re-audit round 1 | `python3 -c "import pathlib,sys; sys.exit(0 if pathlib.Path('.agent-reports/qa/specs-fidelity-reaudit-round1.md').read_text().lstrip().startswith('RESULT:') else 1)"` | `.` | P20 | |
| re-audit passes | `python3 -c "import pathlib,sys; sys.exit(0 if pathlib.Path('.agent-reports/qa/specs-fidelity-reaudit.md').read_text().lstrip().startswith('RESULT: PASS') else 1)"` | `.` | P22 | |
| M4 coverage | `grep -qF "## M4" specs/migrations.md` | `.` | P23 | |
| mail and science kept | `! grep -qF -e plugins/tools/mail -e plugins/tools/science specs/_stale/code.md` | `.` | P23 | |
| recommendations closed | `python3 -c "import pathlib,sys; P=chr(124); rows={c[1].strip():c[2].strip() for c in (l.split(P) for l in pathlib.Path('.claude/team/agents-recommendations.md').read_text().splitlines()) if len(c)>3}; m=[r for r in ('R119','R120','R158','R163','R194') if rows.get(r)!='done']; print('not closed',m); sys.exit(1 if m else 0)"` | `.` | P23 | |

## Phases

### P01 · Audit the remainder

| | |
|---|---|
| Agent | qa |
| Read | This file (*Rules*, *Ownership*, *Assignment*) · the seven reports in `.agent-reports/qa/specs-fidelity-*.md` — their per-file tables, method and *Not audited in depth* (the operate, work and engine report) · `git ls-tree -r --name-only 0236fa8d2d04 specs/_stale` · the old files below with `git show 0236fa8d2d04:<path>` · the live `specs/` |
| Stories | — |
| Done when | `.agent-reports/qa/specs-fidelity-remainder.md` exists, line 1 `RESULT: PASS` or `RESULT: FAIL` (FAIL when any gap is found), in the seven reports' method: every item of what the first audit did not cover item by item — `building-engine/` beyond the design-decision level (every file, skipping items the operate, work and engine report already numbers), `migration-plan.md` §10–§17 and §19–§24, `task-model-migration.md` §2 column tables, §6.1–§6.3 and §7 slices, `building-engine/refactor-plan.md` §2–§6, and `modules/operate/features/see-what-ran.md` SR1–SR78 — read from commit `0236fa8d2d04` and checked against the live `specs/` · and every old file under `specs/_stale/` at that commit that no report's per-file table names, audited the same way · a per-file table (Items · FOUND · PARTIAL · MISSING · RETIRED) · a gap table `REM<n> · Phase · Old file § · Old quote · Status · Add to`, one row a PARTIAL or MISSING item, *Phase* from *Ownership* by the *add to* file (`P18` when it contradicts a live spec, `P23` when it has no live home) · a *Retired* table with live evidence · a *Redundant* table (fact · live files) for P19 · a closing *Hand-off* section · the remainder-audit gate passes · no spec changed |
| Lands | `.agent-reports/qa/specs-fidelity-remainder.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List the old files and which report covers each. 2. Read each uncovered part item by item. 3. Grep each item's distinctive words, numbers and names in `specs/`. 4. Write the tables and the gap rows with their phase. 5. Gates |

### P02 · graphs

| | |
|---|---|
| Agent | product-manager |
| Read | This file (*Rules*, *Settled decisions*, *Ownership*, *Assignment*) · P02's items in the reports and the `REM` rows tagged `P02` · `specs/os/graph/**` · `specs/system-design/modules/graphs.md` · `specs/system-design/architecture.md` › *One name across layers* and *The rename map* · the code each disputed value lives in (`engine/src/invana/apps/graphs`, `server`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The GR stories whose criteria it adds |
| Done when | Every P02 item has a row in `specs-m5-P02.md` with its disposition, and what it restores stands in the P02 files: the connection's request and response and the tested-before-saved run (`test_connection`), the area-to-route table under the grants' names with its narrower-prefix rule and the walk-every-route guard, set-up steps and `skipped_at`, alert rules with `notify_line` and their routes, webhook retries, the Info panel's *not there* list, the Graph page, Settings tabs, set-up as a timeline, the all-Graphs filters · every gate passes |
| Lands | `specs/os/graph/**` · `specs/system-design/modules/graphs.md` · `specs/README.md` (regenerated) · `.agent-reports/product-manager/specs-m5-P02.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read each item and its old text. 2. Check each disputed value in the code. 3. Write the items into the P02 files. 4. Coverage file. 5. `check.py --index`, links, gates. 6. Hand-off note: decisions taken, conflicts left for P18 |

### P03 · access

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P03's items and `REM` rows tagged `P03` · `specs/os/access/**` · `specs/system-design/modules/access.md` · `access-events.md` · `architecture.md` › *The rename map* · the code for disputed values (`engine/src/invana/apps/iam`, `core/auth`, `core/ledger`, `activity`, `server/{auth,iam,approvals,ledger,history,events}`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AC stories whose criteria it adds |
| Done when | Every P03 item has a row in `specs-m5-P03.md`, and the P03 files hold: the event verbs of accounts, sessions (`reuse_detected`), members, keys, access rules and groups · the auth routes and the refresh token's handling · the overview read's shape · the entry-act rule · key settings and their names · the asks' routes, payloads, `409 already_decided` detail, subject kinds and routing reasons · History's routes, filters, `layer` values, wire shapes (`rows_failing`, `can_see`), the change-log filter and the `why` on writes · the clock's 30 s default · the send gate's approval seams · LG18 preset chips in AC-F06 · *Settled decisions*: signed grants and the policy grammar retired in `modules/access.md` *Not building* · every gate passes |
| Lands | `specs/os/access/**` · `specs/system-design/modules/{access,access-events}.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P03.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for access. C1 (usernames) is P18's: leave IP4 alone |

### P04 · runtime

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P04's items and `REM` rows tagged `P04` · `specs/os/runtime/**` · `specs/system-design/modules/{runtime,runtime-connectors}.md` · `specs/system-design/integrations.md` · the code for disputed values (`engine/src/invana/apps/{llm_providers,mcp_server,workers}`, `plugins/`, `runtime/`, `graph/connectors`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The RT stories whose criteria it adds |
| Done when | Every P04 item has a row in `specs-m5-P04.md`, and the P04 files hold: the AI model columns and the editable rule · worker images and the `invana_wkr_` key prefix · limits in use · plugin manifests (`tomllib`, the core plugin's version, the engine range, the signature check at start-up), layout, extras, start-up, the simulator contract and the tool table · MCP servers (`restart_required`, transport, sessions) and this Graph's MCP server's tools and recent calls · *Settled decisions*: the scale-out Decision on RT-F03 and its retirements in *Not building* (KEDA, Auto Scaling, multi-replica orchestrators, per-mode deployment), the pool labels and queue per label and class in `modules/runtime.md`, R158 (every tool plugin is an MCP server) in RT-F02 and `modules/runtime.md`, R119 (`web`, `mail`, `science` kept as MCP servers) · every gate passes |
| Lands | `specs/os/runtime/**` · `specs/system-design/modules/{runtime,runtime-connectors}.md` · `specs/system-design/integrations.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P04.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for runtime, then the settled decisions with their `Ravi-reversible:` notes |

### P05 · runtime and orchestration

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P05's items and `REM` rows tagged `P05` · `specs/system-design/{runtime,orchestration,observability}.md` · RT-F03 as P04 left it · recommendation R120 · the code for disputed values (`engine/src/invana/runtime`, `apps/workers`, `server/admin`, `engine/benchmarks/executors`) |
| Stories | — |
| Done when | Every P05 item has a row in `specs-m5-P05.md`, and the P05 files hold: the executor choice with its benchmark pointer and rationale (procrastinate as the distributed executor), the SQLite refusal, the failure vocabulary (`worker_error`), wire forms, *every kind runs here*, the envelope table's secret rule and hardware routing, durable runs with no in-process run vars, the chat-ask and bulk-load worked examples, the declaration's `args`, the catalogue's write steps (`write_graph`), the telemetry spans the observability items name · `runtime.md` › *Workers* agrees with RT-F03's scale-out Decision and links it · R120 closed · every gate passes |
| Lands | `specs/system-design/{runtime,orchestration,observability}.md` · `.agent-reports/product-manager/specs-m5-P05.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for the runtime and orchestration design, then close R120 |

### P06 · governance and lenses

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P06's items and `REM` rows tagged `P06` · `specs/system-design/governance-and-lens.md` · `specs/system-design/modules/model-lenses.md` · MO-F05 · recommendation R163 · the code for disputed values (`engine/src/invana/apps/govern`, `runtime/governing*`, `runtime/managers`) |
| Stories | — |
| Done when | Every P06 item has a row in `specs-m5-P06.md`, and the P06 files hold: the refusal contract, allow and deny rules, *never touched* layers, `runs_30d` and who a view thinks with, `rule_matched`, the frozen key on a rename, record ids, the default cast, lens events, *a bound that is not composed is not a bound*, an undeclared valid-time axis refused naming the model · *Settled decisions*: the Trust and Privacy goals and the gateway's record of each AI model call, and R163's *a link writes its relationships* · every gate passes |
| Lands | `specs/system-design/governance-and-lens.md` · `specs/system-design/modules/model-lenses.md` · `.agent-reports/product-manager/specs-m5-P06.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for governance and lenses. C5 (query texts) is P18's: leave CDG33 alone |

### P07 · model

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P07's items and `REM` rows tagged `P07` · `specs/capabilities/model/**` · `specs/system-design/modules/model.md` · the code for disputed values (`engine/src/invana/apps/{modeller,semantic}`, `server/modeller`, `cli/commands`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The MO stories whose criteria it adds |
| Done when | Every P07 item has a row in `specs-m5-P07.md`, and the P07 files hold: ontology import (`model_name_taken`, the fresh package id, request defaults, status codes, the OWL, RDFS and XSD mapping tables, `source_iri`, the import event's details) · property constraints (one per property per type, inherited keys, copied and versioned with the model) · links (the refusal codes, preview codes, edge counts) · the draft (`staged_count`) · health advice (`advice_unsupported_by_connector`) · rule offer and citation counts (`rule_offer_counts`) and *what is not a rule* in MO-F06 · the starters memory and provenance · the seams ST70 names in MO-F05 · every gate passes |
| Lands | `specs/capabilities/model/**` · `specs/system-design/modules/model.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P07.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for model. C4 (payload freeze) is P18's: leave CDG13 alone |

### P08 · datasets

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P08's items and `REM` rows tagged `P08` · `specs/capabilities/datasets/**` · `specs/system-design/modules/{datasets,datasets-loads}.md` · the code for disputed values (`engine/src/invana/apps/datasets`, `graph/loaders`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The DS stories whose criteria it adds |
| Done when | Every P08 item has a row in `specs-m5-P08.md`, and the P08 files hold: the registry later (its four phases, what goes in it, the formats Frictionless Data Package, RO-Crate and DCAT) · the dataset items CDG 41–42, 44–45, 47 · *Settled decisions*: OpenAPI and Airbyte adapters retired in `datasets/product.md` *Not building*, datasets as CSV with DuckDB retired in `modules/datasets.md` *Not building* · every gate passes |
| Lands | `specs/capabilities/datasets/**` · `specs/system-design/modules/{datasets,datasets-loads}.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P08.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for datasets |

### P09 · agents and runs

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P09's items and `REM` rows tagged `P09` · `specs/capabilities/agents/product.md` · AG-F01, F02, F03, F05, F08 · `specs/system-design/modules/agents.md` · the code for disputed values (`engine/src/invana/apps/{agents,llm}`, `server/{agents,evals}`, `runtime/delegation*`, `runtime/managers/agent_*.py`, `evals.py`, `eval_checks.py`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AG stories whose criteria it adds |
| Done when | Every P09 item has a row in `specs-m5-P09.md`, and the P09 files hold: the voice in the prompt (`check_traits`, the default voice, which steps read the soul) · the skills-and-callables and meters reads with their shapes · effort and budget (`effective_effort`, `effective_budget`) · delegation and outside agents (`version_not_offered`, the agent card fields) · fleet reads and the percentile rule · eval publish gates and check kinds (`eval_required`) · run reads (`steps_done`, `steps_total`) · *make a helper* in order · the Layers detail bands on AG-F03 · *Settled decisions*: default stance retired, Data assistant retired, A2A 1.0, the router and specialist roster retired · every gate passes |
| Lands | `specs/capabilities/agents/product.md` · `specs/capabilities/agents/features/{AG-F01,AG-F02,AG-F03,AG-F05,AG-F08}-*/**` · `specs/system-design/modules/agents.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P09.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for agents and runs, then the settled decisions |

### P10 · skills, plans and schedules

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P10's items and `REM` rows tagged `P10` · AG-F04, AG-F06, AG-F07 · `specs/system-design/modules/{agents-skills,agents-plans}.md` · the code for disputed values (`engine/src/invana/apps/{skills,flows}`, `server/{skills,flows,schedules}`, `runtime/workflows.py`, `runtime/catalogue`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The AG stories whose criteria it adds (AG-18, AG-30 first) |
| Done when | Every P10 item has a row in `specs-m5-P10.md`, and the P10 files hold: the plan-drawing rules in AG-F06 Decisions (brackets and unrolling, lines, `back()`, the seam, verdict and approval edges, dashed envelope gates, bound labels) and their *Done when* as an AG-18 criterion · the skill page's tabs, a draft's empty bands, the version bar's breakdowns, step rows keyed by step · the Runs and Plans filters (ST53 is P09's half), skill and plan rows (prose against address) · skill engine detail (`hit_limit`, drafts, usage) · plan engine detail (manifest defaults a plan may tighten, never loosen; revisions kept as a count) · eval promotion of sensitive asks, pinned graph snapshots, uncited claims failing a case · schedule event triggers · every gate passes |
| Lands | `specs/capabilities/agents/features/{AG-F04,AG-F06,AG-F07}-*/**` · `specs/system-design/modules/{agents-skills,agents-plans}.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P10.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for skills, plans and schedules. C7 (link plan names) is P18's |

### P11 · explore — asking

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P11's items and `REM` rows tagged `P11` · `specs/capabilities/explore/product.md` · EX-F03, F04, F05, F07 · `specs/system-design/modules/{explore-questions,explore-memory}.md` · the code for disputed values (`engine/src/invana/apps/sessions`, `server/sessions`, `runtime/{emissions,stream,diagnosis}.py`, `apps/llm`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The EX stories whose criteria it adds (EX-03, EX-10 first) |
| Done when | Every P11 item has a row in `specs-m5-P11.md`, and the P11 files hold: approach events and `verify`, the typed-query refusal, what the model is told by graph state, session history rows, forks (`fork_count`), the shipped templates (`aggregate_and_chart`, `open_list`), answer and trace rows, the memory items, the world chip stored on the session, opening a session's cases on EX-10, the composer's skill chip and the trace's datasets in EX-F04 Open questions, the header switches · every gate passes |
| Lands | `specs/capabilities/explore/product.md` · `specs/capabilities/explore/features/{EX-F03,EX-F04,EX-F05,EX-F07}-*/**` · `specs/system-design/modules/{explore-questions,explore-memory}.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P11.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for asking |

### P12 · explore — the board

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P12's items and `REM` rows tagged `P12` · EX-F01, F02, F06 · `specs/system-design/modules/explore-boards.md` · the code for disputed values (`engine/src/invana/apps/{explorer,boards,annotations}`, `server/{explorer,boards,annotations,data_edits}`, `runtime/{canvas,projections}.py`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The EX stories whose criteria it adds |
| Done when | Every P12 item has a row in `specs-m5-P12.md`, and the P12 files hold: expand (`409 expand_queued`, a turn written before the run), data-edit refusals (`writes_unsupported` and the rest), board counts (`total_nodes`, `total_edges`), the snapshot document, the walkthrough's narration, the boards-migration rules (a report is a frozen board version; page ids; three lifetimes) · every gate passes |
| Lands | `specs/capabilities/explore/features/{EX-F01,EX-F02,EX-F06}-*/**` · `specs/system-design/modules/explore-boards.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P12.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for the board. C6 and C8 (board kinds) are P18's: leave AME32 and OWE79 alone |

### P13 · projects and data

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P13's items and `REM` rows tagged `P13` · `specs/capabilities/{projects,data}/**` · `specs/system-design/modules/projects.md` · the code for disputed values (`engine/src/invana/apps/work`, `server/work`) · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The PJ stories whose criteria it adds |
| Done when | Every P13 item has a row in `specs-m5-P13.md`, and the P13 files hold: the rule-block refusal text, objectives and criteria routes and events, old prose as one criterion (`needs_split`), per-criterion outcomes on accept, `created_by_name`, recurring tasks as an open question or *Not building* with their seams, the review read and verdict path, the genomic simulator's spec fields, `SimulationRead`'s times, the 2 s poll in PJ-F04 · every gate passes |
| Lands | `specs/capabilities/{projects,data}/**` · `specs/system-design/modules/projects.md` · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P13.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for projects |

### P14 · architecture

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P14's items and `REM` rows tagged `P14` · `specs/system-design/architecture.md` · Studio's shape as it is: `studio/packages/*` (`package.json`, `turbo.json` tags), `studio/scripts/`, `studio/vitest.config.ts`, `biome.json`, `knip` config, `vite.config.ts` · the engine's import contracts, if any |
| Stories | — |
| Done when | Every P14 item has a row in `specs-m5-P14.md`, and `architecture.md` holds a new section **Inside a Studio package**, the twin of *Inside a module*, restating the old rules under today's `@invana-studio/<pkg>` names: `index.ts` is the border, a package owns its API, private components, one direction, no `utils/`, no package imports the shell, a renderer two packages draw is a canvas, sub-folders are features, symbol naming, the path alias, the component suffix table, how the code is written, the testing subset and `tsc -b --noEmit`, and a **Guardrails** table (`noRestrictedImports`, Biome's recommended set, knip, `check-boundaries` with the allowed-import matrix and package tags, the names check as it exists today, the 400-line warning) — each guard stated as it exists in the repo now, a missing one a recommendation · plus the engine items: event verb tense, engine modules, metrics percentiles, the parts with services and ports, the backend zones that stay · *Settled decisions*: *only the gateway calls an AI model* and *only secrets holds keys* as import rules · every gate passes |
| Lands | `specs/system-design/architecture.md` · `.agent-reports/product-manager/specs-m5-P14.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read the items. 2. Read Studio's packages, scripts and configs for what holds today. 3. Write *Inside a Studio package* and its *Guardrails*. 4. The engine items. 5. Coverage file. 6. Gates. 7. Hand-off note |

### P15 · data model, API and CLI

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P15's items and `REM` rows tagged `P15` · `specs/system-design/{data-model,api-and-cli}.md` · `engine/tests/golden/schema.models.sql` · `engine/tests/golden/openapi.json` (paths only) · `engine/src/invana/cli` |
| Stories | — |
| Done when | Every P15 item has a row in `specs-m5-P15.md`, and the P15 files hold: the missing CLI flags and commands (`models import` flags, `datasets refresh --source`, `datasets pack · unpack` as later, `invana agents show · history · pause · retire`, `invana performance`, `invana lineage` as the live spec has it, `--non-interactive`, *nothing migrates on boot*), each marked *not built* where the code lacks it · the data-model items, and the old migration plan's tables retired with their reason · *Settled decisions*: `origin = llm`, `written_by_run`, `written_at` on what Invana writes · every gate passes |
| Lands | `specs/system-design/{data-model,api-and-cli}.md` · `.agent-reports/product-manager/specs-m5-P15.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for the data model, the API and the CLI |

### P16 · design language and glossary

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P16's items and `REM` rows tagged `P16` · `specs/design-language.md` · `specs/glossary.md` · `specs/personas.md` · recommendations R158 · R163 · RT-F02 and `governance-and-lens.md` as P04 and P06 left them |
| Stories | — |
| Done when | Every P16 item has a row in `specs-m5-P16.md`, and the P16 files hold: in `design-language.md` › *Regions at work* the `bottomSpan` table, the URL state table, panel toggles on the strip's `headerActions`, the section inset, the chrome type ladder's why, tabs and routes, the canvas tab ceiling, the board-tab close rule, status bar and drill-in rules, the `bottomSection` and `rightSection` occupants, a tab switch is visibility, one tooltip provider, the container-query rule, charts · in `glossary.md` the `leftNav` sub-slots, region and occupant, the DOM id form (`idPrefix`), the retired words *top bar* and *console as a place*, *the engine never names a region*, the review guard, a Template term, the words-not-used rows of *Settled decisions* (default stance) · `personas.md` checked against the old set · R158 and R163 written in the glossary and both closed · every gate passes |
| Lands | `specs/{design-language,glossary,personas}.md` · `.agent-reports/product-manager/specs-m5-P16.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for the design language and the glossary, then close R158 and R163 |

### P17 · Studio system design

| | |
|---|---|
| Agent | product-manager |
| Read | This file · P17's items and `REM` rows tagged `P17` · `specs/system-design/studio/*.md` · the canvas and kit as Studio uses them (`studio/package.json`, `vite.config.ts`) |
| Stories | — |
| Done when | Every P17 item has a row in `specs-m5-P17.md`, and the P17 files hold: the dependency notes (the PixiJS pin, CodeMirror only in `@invana/editor`, `canvas-react`'s static imports), *not duplication, keep them*, the substitution order, the form gaps (`FieldConfig` validation) as kit work, `<GraphCanvas>` as the root, the canvas-ownership rules, canvas controls one at a time, § 6d's rows (IP 28–32), the plan and run drawing decisions in `task-flow-canvas.md` · every gate passes |
| Lands | `specs/system-design/studio/**` · `.agent-reports/product-manager/specs-m5-P17.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | As P02, for the Studio design files |

### P18 · Conflicts and the board rename

| | |
|---|---|
| Agent | product-manager |
| Read | This file (*Conflicts*, *Settled decisions*) · every `specs-m5-P*.md` coverage file's `conflict → P18` rows and the `REM` rows tagged `P18` · the live files each conflict names · the code each conflict names · `specs/migrations.md` M1 · recommendation R194 · `scripts/specs/check.py` (how boards are checked) |
| Stories | — |
| Done when | `specs-m5-P18.md` has a row for C1–C8, for each of their items and for every item a restore phase disposed `conflict → P18`, each `decided` with the value, the evidence (code path and what it says, or the recorded decision) and the one file that now states it · every other live file that stated the old value now agrees or links · R194: every `start.*` and `shell.*` board is renamed under its package in every spec that names it, the rename table is in the coverage file, R194 is closed, and a recommendation asks the designer to rename the boards on the canvas · every gate passes |
| Lands | Any live spec a conflict or the rename touches · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P18.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Collect every conflict. 2. Read the code for each and decide. 3. Write each value once; make the rest agree. 4. The board rename. 5. Coverage file. 6. Close R194. 7. Gates. 8. Hand-off note: every decision, as `Ravi-reversible:` |

### P19 · One home for every fact

| | |
|---|---|
| Agent | product-manager |
| Read | This file · the *REDUNDANT* or *Redundancy* section of each of the seven reports and P01's *Redundant* table · the *Assignment* note on items with two homes · the live files they name |
| Stories | — |
| Done when | `specs-m5-P19.md` has a row `RD<n>` for every repeated fact the reports and P01 list (at least 38): the fact, its one home, and what the other files now hold — a link to the home, or `kept split — <why>` where the reports judged a product rule and its engine mechanism an acceptable split · each repeated fact is stated in full only in its home · the cross-links the *Assignment* note names are in place · every gate passes |
| Lands | Any live spec that repeats a fact · `.agent-reports/product-manager/specs-m5-P19.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List every repeated fact. 2. Pick its home (the reports' suggestion, else the file that owns the decision). 3. Trim the copies to a link. 4. Coverage file. 5. Gates |

### P20 · Re-audit, round 1

| | |
|---|---|
| Agent | qa |
| Read | This file · the seven reports and `specs-fidelity-remainder.md` · every `specs-m5-P*.md` coverage file (as claims to check, not as evidence) · the live `specs/` · the old docs at commit `0236fa8d2d04` |
| Stories | — |
| Done when | `.agent-reports/qa/specs-fidelity-reaudit-round1.md` exists, line 1 `RESULT: PASS` or `RESULT: FAIL`: the seven audits and the remainder rerun on the live specs as they now stand — every numbered item and `REM` row re-checked FOUND · PARTIAL · MISSING · RETIRED (retired counts only when a live spec says so, or the item is history with no product content) · each conflict C1–C8 stated once · each redundancy row with one home · and, per old file, a sample of ten items the first audits called FOUND, to catch what P18 and P19 broke · a gap table `RA<n> · Item · Status · What is missing · Add to`, one row for every item not closed · a closing *Hand-off* section · PASS only with no gap row |
| Lands | `.agent-reports/qa/specs-fidelity-reaudit-round1.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Re-check each item by its distinctive words, values and names. 2. Conflicts and redundancy. 3. The FOUND sample. 4. Write the report. 5. Gates |

### P21 · Close the re-audit's gaps

| | |
|---|---|
| Agent | product-manager |
| Read | This file · `.agent-reports/qa/specs-fidelity-reaudit-round1.md` · the coverage files of the items it reopens · the live files its rows name |
| Stories | — |
| Done when | Every `RA` row of round 1 has a row in `specs-m5-P21.md` — `restored`, `retired — <why>` (said in a live spec), `decided` or `found — <where>` — and the content stands in the file the row names · nothing restored twice: a fact already held elsewhere is linked · every gate passes |
| Lands | Any live spec an `RA` row names · `specs/README.md` · `.agent-reports/product-manager/specs-m5-P21.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read each `RA` row. 2. Restore, retire or decide it in its home. 3. Coverage file. 4. Gates |

### P22 · Final re-audit

| | |
|---|---|
| Agent | qa |
| Read | This file · `.agent-reports/qa/specs-fidelity-reaudit-round1.md` · `specs-m5-P21.md` · the seven reports and the remainder · the live `specs/` · the old docs at commit `0236fa8d2d04` |
| Stories | — |
| Done when | `.agent-reports/qa/specs-fidelity-reaudit.md` exists and line 1 is `RESULT: PASS`: every `RA` row of round 1 re-checked closed, a fresh sample of twenty items per report (and of the remainder) re-checked, every conflict stated once, no repeated fact stated in full in two files · a per-report table (items · closed · open) · the re-audit gate passes |
| Lands | `.agent-reports/qa/specs-fidelity-reaudit.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Re-check the round-1 rows. 2. The fresh sample. 3. Conflicts and redundancy. 4. Write the report. 5. Gates |

### P23 · Coverage, tracked

| | |
|---|---|
| Agent | product-manager |
| Read | This file (*Hand-off notes*) · every `specs-m5-P*.md` coverage file · the seven reports, the remainder and both re-audits · P23's items and `REM` rows tagged `P23` · `specs/migrations.md` · `specs/_stale/code.md` · recommendations R119 · R120 · R158 · R163 · R194 |
| Stories | — |
| Done when | `specs/migrations.md` has an M4 row (*Restore what the old docs held into the live specs* · Done) and a section `## M4 — the old docs and their live homes`: a table `Old area · Old files · Live home · Items · Restored · Retired · Found · Decided`, one row per old area of the seven audits and the remainder, live homes as links, totals summing to every item; and a table of the decisions this project took — C1–C8, the settled decisions, the board rename map — each with the file that states it · `specs/_stale/code.md` no longer lists `plugins/tools/mail` or `plugins/tools/science` (R119), with a recommendation telling m3-code C02 · R119 closed, and R120 · R158 · R163 · R194 confirmed closed · `specs-m5-P23.md` disposes P23's items and lists every `Ravi-reversible:` note for Ravi's review · every gate passes |
| Lands | `specs/migrations.md` · `specs/_stale/code.md` · `.agent-reports/product-manager/specs-m5-P23.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Collect every disposition and count by old area. 2. The M4 row and section. 3. `code.md` and R119. 4. P23's items. 5. The Ravi-reversible list. 6. Gates |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Audit the remainder | — | done | 2026-11-10 | gates green · reviews passed |
| P02 | graphs | P01 | done | 2026-11-10 | gates green · reviews passed |
| P03 | access | P01 | done | 2026-11-10 | gates green · reviews passed |
| P04 | runtime | P01 | done | 2026-11-10 | gates green · reviews passed |
| P05 | runtime and orchestration | P04 | done | 2026-11-10 | gates green · reviews passed |
| P06 | governance and lenses | P01 | done | 2026-11-10 | gates green · reviews passed |
| P07 | model | P01 | done | 2026-11-10 | gates green · reviews passed |
| P08 | datasets | P01 | done | 2026-11-10 | gates green · reviews passed |
| P09 | agents and runs | P01 | done | 2026-11-10 | gates green · reviews passed |
| P10 | skills, plans and schedules | P09 | done | 2026-11-10 | gates green · reviews passed |
| P11 | explore — asking | P01 | done | 2026-11-10 | gates green · reviews passed |
| P12 | explore — the board | P11 | done | 2026-11-10 | gates green · reviews passed |
| P13 | projects and data | P01 | done | 2026-11-10 | gates green · reviews passed |
| P14 | architecture | P01 | done | 2026-11-10 | gates green · reviews passed |
| P15 | data model, API and CLI | P01 | done | 2026-11-10 | gates green · reviews passed |
| P16 | design language and glossary | P04, P06 | done | 2026-11-10 | gates green · reviews passed |
| P17 | Studio system design | P01 | done | 2026-11-10 | gates green · reviews passed |
| P18 | Conflicts and the board rename | P02, P03, P05, P07, P08, P10, P12, P13, P14, P15, P16, P17 | done | 2026-11-10 | gates green · reviews passed |
| P19 | One home for every fact | P18 | done | 2026-11-10 | gates green · reviews passed |
| P20 | Re-audit, round 1 | P19 | done | 2026-11-10 | gates green · reviews passed |
| P21 | Close the re-audit's gaps | P20 | done | 2026-11-10 | gates green · reviews passed |
| P22 | Final re-audit | P21 | done | 2026-11-10 | gates green · reviews passed |
| P23 | Coverage, tracked | P22 | done | 2026-11-10 | gates green · reviews passed |

## Hand-off notes

What a later phase must know that the specs do not say. One row per note, newest last. A qa phase writes none: its
report's *Hand-off* section is its note.

| ID | Note |
|---|---|
| P01 | The remainder report gives each phase its `REM` rows (P05 4 · P09 6 · P10 2 · P14 5 · P15 1 · P16 2 · P17 2 · P23 2 · P18 0); its *Hand-off* section has the per-phase notes. REM7 has a disputed value (`snapshot_model` bound) that P05 settles from the code; `cost_usd` (SR40) is retired by *tokens, never currency* and must not be restored; REM20 is a live defect (decision ids `SR32` · `SR52` in `studio/task-flow-canvas.md`) for P17 |
| P02 | All 24 items restored, none left for P18 (`specs-m5-P02.md`). For P04: ASW14's routes — each Graph's limits read by members and set by the install Admin (`GET·PUT` per Graph, and an install-wide read of every Graph's limits and spend) — belong in `modules/runtime.md`; `graphs.md` now says the limits are the runtime's routes, so `runtime.md`'s line "sit on the Graph ([graphs.md])" needs its route rows. R204 raised: the code lets an owner `PATCH` `max_concurrent_runs` and checks introspect as `modeller`. For P19: `graphs.md` › *Who may write what* is now the one area table — `access.md`'s iam/ask rows should link it. GR-F02 still says *a schedule is done when it has fired* while set-up has no schedule step (code: six steps) — P19/P21 may fold it. Ravi-reversible: Home gets the all-Graphs filters (GR-01.11 · .12, a new `start.home · No match` state) · set-up is six steps, links/plans/agents/schedules are offers (`graphs.md` › Set-up) · failed deliveries keep no backoff and no auto-disable (`graphs.md` › The Inbox) |
| P03 | All 38 items disposed (31 restored · 7 retired), none for P18 (`specs-m5-P03.md`); IP4 untouched for C1. `modules/access.md` now holds the auth, rules, people/groups/keys, effective, approvals, ledger and change-log wire shapes, the event verbs, the send gate and a *Not building* section. For P04: MS10 (the Graph MCP server's two data functions are bound `none`) and MS11 (each call an inline run under the Graph's ceiling) are `modules/runtime.md`'s — access.md holds only the per-call action/resource mapping. For P15: `api-and-cli.md`'s approvals and ledger rows should link access.md's route tables, not restate them (P19). For P16: the entry-act rule is in access.md › *Who may write what*; `design-language.md` §5 *Ask <name>* may link it. R205 raised: the code records no `reuse_detected`, routes asks only as `agent owner` / the run's actor, and the CLI approve does not resume the run. Ravi-reversible: no per-key ceiling and no refusal of a key line that matches nothing (AC-F03 *Not building*) · no `metrics/*` routes derived on read (`access-events.md` › Observability) · ask routing per AC-15.4 over the code (`access.md` › *Designed, not built*) · AC-05.2 *used now* is the 30-day p95 |
| P04 | All 36 items disposed (30 restored · 4 retired · 2 found), none for P18 (`specs-m5-P04.md`). `modules/runtime.md` now holds the plugin and manifest contract (the code's nine bounds and function names — `science.pubmed.search`, `web.download_file` — replace the old live ones), the simulator contract, MCP servers' routes/seams/`restart_required`, this Graph's MCP server's protocol, tools and admin reads, workers' `stopped`/CLI/`invana_wkr_`, the contention read and each Graph's limits routes (`/runtime/limits`, designed — ASW14 from P02). For P05: `system-design/runtime.md` › *Workers* should link `modules/runtime.md` › *Workers* › *Scale-out, designed* for pools and queues (PSD6, via P19); `worker_unavailable`/`worker_error` stay P05's. For P16: glossary *Tool plugin* / *MCP plugin* must follow RT-F02 › Decisions (*Every tool plugin is an MCP server*) before closing R158; *bound* now has nine values in `modules/runtime.md` › Plugins. For P23: R119's decision is written (RT-F02 › Decisions · `modules/runtime.md` › Decisions). R206 (MCP protocol version lags the pin) and R207 (re-run on a changed MCP tool's previous version) raised. Ravi-reversible: scale-out keeps its pools, not an autoscaler (RT-F03 › Decisions; KEDA, Auto Scaling, coordinator replicas and per-mode deployment in RT-F03 › Not building) · every tool plugin is an MCP server and `web`/`mail`/`science` stay (RT-F02 › Decisions, `modules/runtime.md` › Decisions) · a changed MCP tool keeps its previous version for re-runs (RT-F02 › Decisions), over the old *refused as unknown* |
| P05 | All 28 items restored (24 + REM6–9), none for P18 (`specs-m5-P05.md`). `orchestration.md` › *The catalogue* now holds the code's 33 core keys (`namespace.verb`) with bound · args → outputs · requires, a *Designed, not built* table for the old names no manifest declares, the bound → layer map, *Why an entry is one entry*, the catalogue's tests and `result.json`; `runtime.md` holds the kinds table, wire forms and failure vocabulary (`worker_error` · `worker_unavailable`), executor settings and the `workers` extra, the requirements, the benchmark and the rejected executors. Code-settled: `data.snapshot` spends `ingest` (REM7); `plan.draft` spends `llm` and `plan_write` has no built entry; `nl.understand`'s outputs are the code's; kinds add `canvas` · `data_edit`, `enrich` not built. For P19/P21: the rest of `orchestration.md` (*Where a plan comes from*, *A skill drawn as a plan*, *Granularity*, the older worked examples) and `agents-plans.md` still say `draft_plan` · `check_bundle` · `diff_models` · `understand`; they should follow the catalogue's keys, or name the *Designed, not built* entries. `runtime.md` › *Executor and workers* links `modules/runtime.md` › *Workers* and RT-F03 › Decisions (PSD6 done). For P15: `data-model.md` › Migrations should say `invana migrate` applies procrastinate's schema on Postgres (IP44's TP7 — written in `runtime.md` › *Settings and the extra*). `observability.md` lists `ui.plans.promote`, which no `startAction` in `studio/packages` opens — not an item here; P17/P21 may check it. R120 closed. Ravi-reversible: the catalogue follows the code's keys and bounds — `data.snapshot` under `ingest`, `plan.draft` under `llm` (`orchestration.md` › *Entries by the bound they spend*) |
| P06 | All 22 items disposed (19 restored · 2 found), CDG33 left for P18 as C5 (`specs-m5-P06.md`). `governance-and-lens.md` now holds *Its goals* (Trust · Privacy), *a bound that is not composed is not a bound*, the grounding version and bindable authored models, `cast_refused`, the gateway's record of each AI model call, `closed_layers` ∪ in Composition, `rule_matched`, and the code's seven egress classes with `sent {to, classes, cut}`; `model-lenses.md` holds the read shapes (lens, usage, view, touches, guardrails, requests), constraints and indexes, the event payloads, *The default cast* and *Not building*. For P16: the glossary's *Stitch* must follow G&L › *`stitch` means two things* (a link writes its relationships) before closing R163; *grounding version* is now defined in G&L › graph data — the glossary may link it. For P18 (C5): the touch already stores both digests (`run_touches.query`), the texts are on the step. For P15/P19: the lens fields table still lists lens-level `cache` · `human` that the code holds as rule `options`, and `select.time` is `between · since · at` in the spec but `from · to` in `apps/govern/rules.py` (R208). For P21: `cost_usd` survives on `run_touches` and `TouchRead` in code — retired by tokens, never currency; not restored. R208 raised. Ravi-reversible: a crossing with no `may_send` on its matching rules is unbounded, the lens-level `[]` default designed, not built (G&L › Egress, ML › Designed, not built) · the Trust and Privacy goals and the gateway's record (G&L › Its goals, › llm) · R163's a link writes its relationships (G&L › graph data) |
| P07 | All 28 items disposed (27 restored · 1 found), none left for P18; CDG13 untouched for C4 (`specs-m5-P07.md`). `modules/model.md` now holds the ontology import contract (defaults, `201`/`200`, `model_name_taken`, the RDFS/OWL and XSD/schema.org tables from `apps/semantic/ontology.py`, the import event's details), the constraint shapes and the one-per-property/inherited/versioned rules, the link refusal codes, preview/commit/withdraw runs, marks, touches, `edges` semantics, the link read and `staged_count`/`mirror_label_count`, the health caller rule, shapes, advice, drift matching and a *Read* table of the insights shapes, and the rule check params, scopes, citations read (`rule_offer_counts`), impact, `RuleRead` extras and `model.rules.check`. For C7 (P18): the preview run is named by its catalogue key `graph.stitch.preview`; the code's plans are `stitch-commit@1`/`stitch-withdraw@1` against the spec's `link-commit@1`/`link-withdraw@1`. For P09: ST70's run-page seams — a layer a run touched nothing in renders its band dark, not hidden; *queued behind a schedule* shows position and *a person is waiting* — belong in AG-F03. For P21: ST70's *a model no cast names — named by nothing, safe to remove* belongs in RT-F01 (AI models), beside RT-01.6. For P19: CDG20's one line — a row-sourced link's relationships carry both the link's marks and the record stamps — should be linked from `datasets-loads.md` › *A load is governed* (Stitch row); ST68's `agents-skills.md` mention should link `model.md` › Rules. Ravi-reversible: a connector that cannot explain shows no advice (`explains = false`) instead of the old `advice_unsupported_by_connector` refusal — code-settled (`model.md` › Health) · a cast naming a denied AI model refuses the run with *Use the view's cast* · *Pick another view* (MO-F05 › Rules) |
| P08 | All 10 items disposed (8 restored · 2 retired), none for P18 (`specs-m5-P08.md`). `datasets/product.md` now has *The open registry, later* (phases 0–4 with `invana pack`/`unpack`/`publish`/`pull`, what goes in it, Frictionless · RO-Crate · DCAT); DS-F01 *Not building* links it. `modules/datasets.md` holds the create defaults, a version's effect (`basis = bound`, tokens 0), `lowest_score`, the SKOS result shape and `201`/`200`, and a *Not building*; `datasets-loads.md` › *A bundle* holds the manifest example, `uses` expanding before envelope validation and the bundle CLI. For P15: CDG44's SKOS CLI flags (`--publisher --name --format --lang --why --user`) and PSD1's `datasets pack · unpack · Later` row belong in `api-and-cli.md` (CDG43 · CDG46 are already P15's). For P19: `access.md`'s `ChangeEffect` is the shape's home — `datasets.md` links it. Ravi-reversible: OpenAPI and Airbyte adapters retired, and with them Postgres/Snowflake readers and a worker SDK (`datasets/product.md` › Not building) · datasets as CSV queried with DuckDB under a 100k-row / 50 MB cap retired (`modules/datasets.md` › Not building) |
| P09 | All 39 items disposed (37 restored · 2 retired), none for P18 (`specs-m5-P09.md`). `modules/agents.md` now holds the voice in the prompt (`check_traits`, `DEFAULT_VOICE`, which steps read it), effort and limits with what each enforces (`effective_effort`, `effective_budget`; code settles `max_steps` 24), the lifecycle preview and 409 guards, *Make a helper, in order*, outside agents (designed; `kind = remote`, `/agents/remote`, A2A 1.0), run reads (list, stats, run, overview, agents, stages, assets, touched, trace; `steps_done`/`steps_total`; `tasks/{task_key}` and `chain` designed), re-run (`version_not_offered`), the eval gate (`eval_required` …), a run of the set, check kinds, judge and starter, the `invana evals` flags, fleet shapes and subject rules, agent reads (`functions`, `meters`, `overview`), shipped-agent rules and a *Not building*. AG-F03 has the Runs filters and the step-detail bands (with P07's ST70 seams); AG-21.31 and AG-23.31–32 are new. For P10: ST53's Plans filters (origin · kind · has a skill) belong in AG-F06; `skill_ids` read-only on `AgentRead` is left to ASW32 in `agents-skills.md`. For P14: the percentile rule (engine, not SQL) belongs in `architecture.md` › *Metrics are stored*. For P15: `api-and-cli.md` should take the eval 409 codes, `GET …/sessions?agent_id=` (the caller's own sessions), the `invana agents remote …` and `import · export` rows, and link `modules/agents.md` › Run reads rather than restate filters. For P16: glossary words-not-used should add *stance* (on an agent) and *Data assistant*. For P19: `modules/agents.md` › Run reads' trace row may link `orchestration.md` › *Run results*. R209 raised (runs origin `Todo`). Ravi-reversible: default stance retired (`modules/agents.md` › Not building, AG-F01 › Not building) · Data assistant retired, the four shipped agents are the live set (`modules/agents.md` › Shipped agents) · A2A 1.0 (`modules/agents.md` › Outside agents) · router and specialist roster retired (`modules/agents.md` › Not building) · *Where it runs* reads what the next trigger takes (AG-21.31) |
| P10 | All 42 items disposed (36 restored · 4 found · ST55 no action · OWE89 recommended R210), none for P18 (`specs-m5-P10.md`). AG-F06 › Decisions now holds the plan-drawing rules (two tenses, brackets, lines, `back()`, the seam, verdict/approval edges, dashed envelope gates, bound labels, the 1,800 worst case, the loop-back) and AG-18.23 is their *Done when*; AG-18.2 adds *has a skill* (ST53's Plans half). `agents-skills.md` holds the draft/handler/unmapped rules, copied-key prefixing, the bind refusal's `409` shape and never-refused cases, usage/exceptions/tests and draft/diff read shapes, a new *Ambiguity stops and asks* (the options query) and a *Not building*; `agents-plans.md` holds argument defaults, `uses`, `nl-single@2`, `wide`/`rare`, `layers`, export `args`, revision count, manifest tighten-never-loosen and bodies-not-functions. Code-settled: copied keys take the library plan's key (`nl_single_…`), not the caller's row; a run keeps the latest `plan_snapshot` and a `plan_revision` count (the live *a replan appends a revision* was wrong); no `/stats` route — step p50/p95 are `/performance`; selection/generation are not events (stream `plan.proposed` · `plan.revised`); the options query is lens-governed. For P16: ST55 — glossary should define *template* (Ask's versioned, person-authored answer template) as distinct from a Studio `projections/` folder. For P14: R210 (golden guards) may be linked from `architecture.md` › *Engine modules* once the skill holds it. For P19: `orchestration.md` › *Ambiguity stops and asks* still says `draft_plan`; `agents-skills.md` links it. For P15: `api-and-cli.md`'s skills/plans rows should link the read-shape tables in `agents-skills.md` › Routes and events and `agents-plans.md` › What the library reads. Ravi-reversible: schedules fire on time or on a write, one feature with two trigger kinds, notifications apart (AG-F07 › Decisions, event triggers designed) · a plan's page is a report, Versions/Arguments/Export are records (AG-F06 › Decisions) · the Plans list filters by *has a skill* (AG-F06 › Decisions, AG-18.2) · evals pin a graph snapshot (designed) and an uncited claim fails a case (AG-F04 › Decisions) |
| P11 | All 27 items restored, none left for P18, no `REM` rows (`specs-m5-P11.md`). `explore-questions.md` now holds the grounding block by graph state (the code's two sentences and headers), the link lines, the history cut for a question asked back and Gremlin labels, the typed-query `422` (code: any Explore ask through an agent whose *What it may do* lacks `graph.read.query`; the seeded Modeller's; a stored default that cannot answer is passed over), the options read as a touch and the `clarification.requested` frame, the fork read fields and `fork_count`, `prefer` → surface, kind leanings, the specificity weights and the constant schema, result surfaces and surface → kind, the words part and `optional`, `open_list` / `board.open` shapes, approach steps and events, `Source` with `excerpt`, provider kinds. `explore-memory.md` has the target × change × detector table, detectors on a schedule and the recall step. EX-10.19–.22 (opening a conversation's board), EX-03.17–.18 (template usage and the author form) are new; EX-F04 › Open questions has three rows. Code-settled: the Answer step (`answer_in_words`) and the `html` surface are not in the code — written *not built*; the user menu's two per-browser switches are *Assistant* and *Tools always shown* (`studio/packages/shell/src/preferences.ts`), not the theme. For P12: EX-10's new state `explore.board · Board not loaded` and EX-03's `agents.skills · Author template` are named, not drawn. For P15: `api-and-cli.md`'s explore rows should link `explore-questions.md` › Routes and events (fork fields, approach events) rather than restate them (P19). For P16: glossary *stitch* — the grounding block's header still says *Stitches* to the model (code), the spec says *link*; the approach event names replace *stance*. R211 raised (`max_cost_usd_run` still stored on sessions). Ravi-reversible: `pick-from-graph` options refresh on a re-ask · the composer's skill chip dropped · trace *Datasets behind the records* built with EX-04 (all EX-F04 › Open questions, recommended) · approach events `explore.approaches.apply · drop_assumption` (`explore-questions.md` › Approaches) |
| P12 | All 24 items disposed (23 restored · AME31 retired in EX-F01 › Not building), none for P18; AME32 and OWE79 untouched for C8/C6 — the declared-kinds table in `explore-boards.md` is unchanged (`specs-m5-P12.md`). `explore-boards.md` now holds the three lifetimes, `pinned`/`archived`, cause `report`, `0` keeps all, the 409s (one board per conversation, per subject) and the `session_id` lookup, a live declared board has no row (create-or-get route), a report is a frozen merged version, page ids `kind:id` / `kind:id@version`, the walkthrough step's fields, a *panel states* column, the kind registry (engine `kinds.py` + Studio `boardKinds.ts`), the read rules (no agent performs a read, the turn first, `409 expand_queued` · `count_queued` · `outside_lens` · `*_failed`), the `type-counts` shape, the data-edit refusal table, the annotation contract, the `?console=` values and a *Snapshots* section. Code-settled: `read_only_graph` is `403` (old `409`); `not_found` and `stale_type` join the refusals; annotation text is required on `note`/`value` only, highlight and group take nodes only. For P15: `api-and-cli.md`'s boards, annotations and data-edit rows should link `explore-boards.md` › Routes and events · Saving edits · Annotations rather than restate them (P19). For P17: the `?console=` param and *regions move independently* (`useConsoleParam.ts`) now live in `explore-boards.md` › The console; AME22's region-param rule is P11's/P16's, not written here. For P18 (C6): Studio's `boardKinds.ts` says `writesFromGesture` is true for exactly `model` and `plan`, while the spec's kinds table also writes from `data` in Edit mode. Ravi-reversible: Network's force settings, size by connections on by default (8–28 px) and the edge fade √(200/n) ≥ 0.15 are restored from the old doc, not checked against the canvas repo (EX-F01 › Rules, Decisions) |
| P13 | All 11 items restored, none for P18, no `REM` rows (`specs-m5-P13.md`). `modules/projects.md` now holds the code's rule-block refusal (`blocked by rule — "<statement>" (because …): <reason>`, lines joined by `; `, nothing written), `needs_split` on criteria and old prose as one `check = person` criterion, per-criterion outcomes on accept, `created_by_name` (one query per list), the genomic spec table, the simulator's data refusals (`missing_parent` · `missing_trait` · `bad_value` · `inputs_disagree`), ties by cross name, the seed on the step, `SimulationRead`'s times and `duration_ms`, `SimulatorListResponse`, and *Designed, not built* rows for the objectives/criteria/outcomes routes and `projects.objectives.*` · `projects.criteria.*` · `.evaluated` events and for the review read (`/projects/review?kind=`) and the verdict (`/agents/runs/{id}/steps/{step_id}/verdict`) — names per *The rename map*. PJ-F04 › Decisions has the 2 s poll; PJ-F01 › Open questions has the recurring-task seams (still Ravi's question) and *Not building* has complex calendars. For P15: `api-and-cli.md`'s projects rows should link `modules/projects.md` › Routes and events and › Simulations rather than restate them (P19). For P19: AG-F07 › Not building *Calendar-aware scheduling* and PJ-F01's *Complex calendars* say the same thing — one may link the other. Code-settled: the genomic simulator caps crosses at 100 (`run.py` `MAX_CROSSES`), not in the old doc. Ravi-reversible: PJ-F02 › Open questions recommends rules keep `order` and get no priority (`Rule.order` in `apps/skills/models.py`) · recurring task templates stay an open question, not retired |
| P14 | All 40 items disposed (39 restored · PSD49 retired as finished-migration build practice), none for P18 (`specs-m5-P14.md`). `architecture.md` now holds *Services and ports* (from `docker-compose.yml`) and *The backend's zones* under The parts; event verb tense, *a name in data or on the wire is public* and *a package name anchors* in One name across layers; `canvases`, `assistant` and the app in The shared packages; Inside a module's added rules (all queries in querysets and their exemptions, view docstring is the API description, `PermissionDeniedError`, `EventManager`, cross-package writes, cross-band reads, the AI-model and secrets import rules, runtime protocols designed) and *Engine guardrails* (today's three `import-linter` contracts, the six code-shape checks); the new *Inside a Studio package* with naming, suffixes, how code is written, *Allowed imports* (the tag matrix), *Testing* (Vitest subset, `tsc -b --noEmit`, the Playwright rules) and *Guardrails*; Metrics are stored has the percentile rule and a table linking every module-owned number. For P16: the suffix table (`XViewPanel` …) now lives in AR › How a symbol is named — glossary's *View panel* row may link it rather than add a table. For P17: `studio/graph-model-canvas.md` is linked from *A renderer two packages draw is a canvas*; ST19's dependency notes stay P17's. For P19: `access.md` › `ChangeCompare` lacks `tokens_per_run_change` (code: `activity/schemas.py`) — AR's metrics table points at access.md › History for it; `runtime.md`'s queue, worker-pull and artifact rows are linked from *The backend's zones*, not restated. R212–R215 raised (gateway/secrets contracts and the `ping.py` breach · `check-names.mjs` scans only the app · no 400-line warning · guards cite deleted docs). Ravi-reversible: *only the AI model client calls an AI model* and *only secrets holds keys* are import rules, `core/secrets` designed (AR › Inside a module) · a product package may import the shell — code-settled from `check-boundaries.mjs` over the old *no module imports the shell* (AR › Inside a Studio package) · `invana.graph` moves with `runtime/connectors` and its stored `connector_class` is rewritten, over the old freeze (AR › One name across layers) · the e2e suite runs nightly, not per change (AR › Testing) |
| P15 | All 17 items disposed (16 restored · IP37 found), none for P18 (`specs-m5-P15.md`). `api-and-cli.md` now holds the code's CLI flags for `models import --ontology` / `publish`, `standards attach <ds> --standard --mode --map` · `detach` · `check <ds>[@v]` (code over the live `--dataset`), the SKOS import flags (P08's CDG44), `datasets refresh --source`, `invana pack · unpack` (later), the members refusals, `users create --non-interactive`, three link-binding rows and the skipped-rule exit, *A refusal code becomes a sentence*, *Nothing migrates on boot*, and *not built* rows for `agents show · history · pause · retire`, `agents remote …` (P09), `invana performance`, `runs list/show` flags (no imports list) and `invana lineage --decision`. `data-model.md` has *What Invana writes into a graph* (the settled stamps mapped to today's `_inv_run_id` · `_inv_at` · `_inv_origin`), *A claim names its origin*, the migrate/procrastinate and drop-what-it-cannot-rewrite rules, and a *Not building* for the old plan's tables. Code-settled: `invana start` migrates nothing — the live *applied … at `invana start`* is corrected and the pending-migration seam is *not built* (R216 raised). For P18 (C3): `cli/commands/members.py`'s `--role` help still says `viewer`; the spec row keeps `operator`. For P19/P21: `runtime.md` names an `agents_run_artifacts` table that `data-model.md` › The tables and the golden schema do not hold — list it (designed) or drop it; P09/P10/P11/P12/P13's asks that `api-and-cli.md` link module route tables instead of restating them were not done here — they are P19's one-home work. Ravi-reversible: every element Invana writes carries `written_by_run` · `written_at` · `origin` (`import` · `llm` · `user`), designed (`data-model.md` › What Invana writes into a graph) · nothing migrates on boot, code-settled (`data-model.md` › Migrations) |
| P16 | All 32 items disposed (30 restored · ST50 and ST51 retired, code-settled), none for P18 (`specs-m5-P16.md`). `design-language.md` › *Regions at work* now holds the shell-owns-the-layout rule, `bottomSpan` and its table, the `px-3` inset and documents inset once, the type ladder's why, panel toggles on the strip's `headerActions`, status-bar and drill-in rules, tabs as routes and visibility, the canvas-tab ceiling's exemptions, how a tab closes, one `TooltipProvider`, the container-query rule; new *What the URL holds* (the code's params: path · `?right=` · `?console=` · `?page=` · `?tab=` · drill-in keys), *Numbers and status* (absent not zero, counts whole, engine badges, shape carries status, charts) and *Theme*. `glossary.md` has the `leftNav` sub-slots, region/occupant, `idPrefix`, *the engine never names a region*, the review guard and *a new word gets its row*, Template, Chain, Design kit, Theme, a credential table, and words not used (top bar, console as a place, stance, Data assistant, MCP plugin, Graph token, projection template). `personas.md` maps the old seven names. Code-settled: rightSection's one occupant is the assistant (`useRightSection.ts`) — the glossary's *the Inspector, or the Assistant* is corrected; bottomSection's is the console. R158 and R163 closed; R217 raised (plugin kinds `tool`/`mcp` still split in code). For P17: REM19's `?read=` and the run page's `?step=` belong in `system-design/studio/`; `design-language.md` › *What the URL holds* may link them. For P19: the glossary still has *Links (as a surface name) → Stitches* in words not used while *Not on screen* says *Stitch → Link between models*; *Todo* is defined twice in Domain terms; GR-F03's *Ask Priya* and `access.md`'s entry-act rule may link `design-language.md` §5. Ravi-reversible: rightSection holds only the assistant and bottomSection only the console, retiring the Inspector fallback and a parameters occupant (`design-language.md` › The layout) · *Graph token* is a word not used, the live form a Key bound to a Graph (`glossary.md`) · theme variants beyond light and dark are later (`design-language.md` › Theme) |
| P17 | All 16 items disposed (15 restored · ST13 found in `architecture.md`, P14's), none for P18 (`specs-m5-P17.md`). `design-kit-coverage.md` › 6d now holds the hatch facts from `vite.config.ts` (nine kit, twelve canvas packages, the `@source` rewrite, `EISDIR`, `tsconfig.app.json` pins), *Dependency notes*, *Not duplication*, the substitution order, domain types, a story per state, pinned behind the kit, Tables' why, *Page head*, Panels' tab-strip and field-block rules and a *Not building*; a new › 7.8 *The run page's address* (REM19); `components-todo.md` › 4 *Forms — the kit's gaps* (F1 open · F2 shipped · F3 partial, from the pinned `@invana/forms`); GM15/TF10 `<GraphCanvas>` root; CU10–CU14; five plan/run drawing rows in `task-flow-canvas.md`. REM20: `SR32`/`SR52` gone. For P19/P21: the studio files still cite many old ids (`SR7`…`SR69`, `D20`–`D22`, `LB28`, `O6`, `DS17`, `CV6`, `code-shape.md`, `canvases.md`) — REM20 named only two; and `task-flow-canvas.md` / `graph-model-canvas.md` describe stale paths and roots (`studio/src/canvases/taskflow/`, `GraphCanvasApp`, `GraphModelCanvas.tsx`) where the code has `packages/canvases/src/{taskflow,model}`, `LayeredDagBoard`, `GlobalModelBoard.tsx`; `graph-model-canvas.md` has two `GM14` rows. For P16's ask: `design-language.md` › What the URL holds may link 7.8 for `&step=`. R218 raised (CodeMirror in the composer, `useForm` from `react-hook-form`, stale `vite.config.ts` comments). Ravi-reversible: a run page opens on its structure and the layer strip is the second reading, reversing the old *layer strip is the default* (`task-flow-canvas.md` › How a plan and a run read) · the run reading rides `?tab=`, not `?read=` — code-settled (`design-kit-coverage.md` › 7.8) |
| P18 | C1–C8 and their six items decided from the code, plus OWE19 (`found`, P04's), no `REM` rows (`specs-m5-P18.md`). Written once: usernames in `access.md` › Accounts (AC-F01 › Decisions); an agent's membership in GR-F04 › Decisions (glossary *Team* agrees, `graphs.md` `graphs_members` is people only); `operator` in `graphs.md` › Who may write what (every spec says `operator`; the glossary's *Not on screen* row and `design-language.md`'s twin keep `viewer` — `check.py` bans every word listed there); the publish impact frozen at preview settle in `model.md` › Publishing; query texts in `model-lenses.md` › What a crossing records; the eighteen board kinds in `explore-boards.md` › Six kinds (glossary *Board* links it) plus a new *Not building*; the `stitch` engine names in `model.md` › Links between models. R194 closed: 40 files renamed `start.*`/`shell.*` → `access.signin` · `access.locked` · `graphs.home` · `graphs.new_graph.*` · `graphs.graph_picker` · `graphs.setup` · `graphs.command` · `graphs.launcher.*` (table in the coverage file). Raised: R219 (designer — rename the artboards; until then `check.py` warns the new names are undrawn), R220 (M1 in code), R221 (Studio `boardKinds.ts` vs the spec), R222 (service-account usernames skip the rule). For P19: the glossary still says *Links (as a surface name) → Stitches* (words not used) against *Stitch → Link between models* (Not on screen) and *Link between models* (screen word) — one must go; `graphs.setup` is now both a board and an event prefix. Ravi-reversible: usernames 2–64, only `u` reserved (AC-F01 › Decisions) · an agent is a member with no Graph role, reversing *agents are principals, not members* (GR-F04 › Decisions) · `operator` written everywhere, code lags M1 (`graphs.md`) · impact frozen when the preview settles (`model.md` › Publishing) · query texts only when rewritten, on the step (`model-lenses.md`) · eighteen board kinds, no `agent` kind (`explore-boards.md`) · `stitch` kept as the engine's word, `link-*` rejected (`model.md` › Links between models) · the board rename (R194) |
| P20 | Round 1 is `RESULT: FAIL` with seven gap rows RA1–RA7 (`specs-fidelity-reaudit-round1.md`), all hygiene, none a lost engine fact: decision ids and stale paths still in the studio specs (`design-kit-coverage.md` · `components-todo.md` · `task-flow-canvas.md` · `graph-model-canvas.md`, the two `GM14` rows), build-log prose and struck-through rows, and four verbatim repeats (two studio pairs, `runtime.md` 30 s sweep, ledger paths and `agents_skills*` lists). Every other coverage row (504) and C1–C8 held in the live files; the 14 identifiers not found live are documented renames. Limits: the check was a token and line match plus about 190 hand reads, and the FOUND sample is 34 values over 12 areas, not ten per old file — P22 should draw its own. No decision taken; nothing Ravi-reversible. |
| P19 | 54 repeated facts each have one home (`specs-m5-P19.md`, RD1–RD54): 43 from the seven audits and P01, the rest from the hand-off notes and the *Assignment* note; kept split only where the audits judged a product rule and its engine mechanism acceptable (RD25 · RD27 · RD29 · RD41) or a story criterion restates a rule to test it. Code-settled: an agent at `max_concurrent_runs` is refused, never queued (`runtime/interpreter/loop.py`) — `agents.md` said *waits queued*; `ChangeCompare` gains `plan` · `schema_diff` · `tokens_per_run_change` (`activity/schemas.py`); no `agents_run_artifacts` table exists, so `runtime.md` no longer names one. `orchestration.md` now uses the catalogue's keys (`plan.draft` · `nl.understand` · `data.bundle.check`). R223 raised (the generated admin's events view deletes). For P20/P21, not one-home work and left as found: `graphs.setup` is a board and an event prefix (different namespaces, no repeated fact); `graph-model-canvas.md` has two different `GM14` rows; the studio files' old ids (`SR7`…, `D20`–`D22`, `K11`, `Q9`) and stale paths (`studio/src/canvases/taskflow/`, `GraphCanvasApp`) remain, P17's note; `design-kit-coverage.md` still carries build-log prose and struck-through questions. Ravi-reversible: the glossary's *Links (as a surface name) → Stitches* words-not-used row is removed — *Link between models* stays the screen word (`glossary.md` › Data and models) · `design-kit-coverage.md`'s second, stale type-ladder section is one paragraph linking 1.2 Density |
| P21 | RA1–RA7 all restored, none retired or decided (`specs-m5-P21.md`). For P22: the five studio files hold no id that points at a retired document (`DS` · `SR` · `LB` · `AD` · `AG` · `CV` · `ME` · `MP` · `O6` · `K1`–`K11` · `D14`/`D20`–`D22` · `G34`/`G35`); a file's own row ids stay — `GM`/`TF`/`CU`, components-todo's `C`/`U`/`D`/`N`/`X`/`F`, and design-kit-coverage's §4 `D1`–`D7` and open `G3`–`G12` · `Q3`/`Q4`/`Q8`–`Q10` rows (BSD `grep \b` false-matches `CU6` lines; check with Python). The run-page components' one home is design-kit-coverage › 7.1–7.3 (components-todo links it; `ParticipantRow` moved there); the `<GraphCanvas>` rule's is GM15 (TF10 links it); the second `GM14` is `GM16`. The 90-character verbatim scan finds no studio pair now; four non-studio pairs remain (api-and-cli/architecture module links, GR/RT product token line, AC-F02–F04 and DA-F01/F02 state cells, MO-04/MO-06 criteria) — story/feature state boilerplate, not a P20 row. R224 raised: `graph-model-canvas.md`'s props table lags `GlobalModelBoardProps`, and `studio/src/ui/*` paths and `the-screens.md` mentions remain. Nothing Ravi-reversible |
| P22 | `specs-fidelity-reaudit.md` is `RESULT: PASS`: RA1–RA7 closed; a seeded 20-per-report draw (ST · CDG · ASW · AME · IP · OWE · PSD · REM) plus C, RD and RA rows held — the 18 rows with an identifier absent live are renames, code-settled values or shapes stated in words. Per-report table = 504 coverage rows, all closed, for P23's M4 table (REM23 · REM24 are R202 · R203). The four non-studio verbatim clusters stay (nav link rows, the one-line *Tokens, never currency* in GR and RT product, template state cells, MO-04.12/MO-06.14); not facts stated twice. Method limit: identifier and link based plus hand reads, not a full reread. Nothing Ravi-reversible; no recommendations raised |
| P23 | M4 is tracked: `specs/migrations.md` › M4 row (Done) and *M4 — the old docs and their live homes* — 465 items (441 numbered + 24 `REM`) over eight old areas: 407 restored · 25 retired · 20 found · 6 decided · 7 elsewhere (a ninth column, *Elsewhere*, holds the `recommended` and `no action` items: ST55 · ST74 · OWE89 · PSD61 · PSD66 · REM23 · REM24), then *What M4 decided* (C1–C8, the settled decisions) and *The board rename*. P23's 25 items: 6 retired · 14 found · 3 recommended (R226 new for ST74, R202, R203) · 2 no action (`specs-m5-P23.md`, which also lists all 54 Ravi-reversible notes, P02–P23). `specs/_stale/code.md` › Deleted now deletes nothing and links RT-F02 › Decisions — so m3-code C02 (*Dead plugins*) has no work left as written: R225 asks to rewrite or retire it before it runs. R119 closed; R120 · R158 · R163 · R194 were already `done`. Open from this project: R202 · R203 · R219 (canvas rename, designer) · R224 · R225 · R226. Ravi-reversible: `code.md` deletes nothing, `mail` and `science` stay (R119; `specs/_stale/code.md`, RT-F02 › Decisions) |

## Questions for Ravi

None: the rules, *Settled decisions* and *Conflicts* settle every question in advance. A decision a phase takes on its
own is a `Ravi-reversible:` hand-off note, collected by P23 for Ravi's review.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
