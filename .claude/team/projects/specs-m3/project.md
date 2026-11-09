---
name: specs-m3
status: done
branch: chore/specs-m3
scope: specs-m3
---

# Specs M3 — the OS and the capabilities, one name across layers, portable standards

Restructures `specs/` into the operating system and the capabilities, moves stale material out of the way, writes the
one name each package takes from spec folder to Studio route, and pins the open standards Invana reads and writes. Spec
cleanup only: no code changes. For everyone who specifies, draws, builds and checks Invana.

| | |
|---|---|
| Goal | `specs/os/{graph GR, access AC, runtime RT}` and `specs/capabilities/{model MO, data DA, datasets DS, agents AG, explore EX, projects PJ}`, with SH · ST · IN re-cut into GR · AC · RT and IN-06 moved into AG-F03 · stale specs and docs under `specs/_stale/`, dead code listed in `specs/_stale/code.md` · the naming table — one name per package across engine module, tables, routes, actions, events, Studio package, Studio routes and boards — written once in `specs/system-design/architecture.md` · docs use the OS, capability and package names · skills, plugins, agents and connectors specified on open standards, pinned in `specs/system-design/integrations.md` |
| Specs | M3 in `specs/migrations.md` · every SH, ST and IN story (re-cut into GR-F01–F05 · AC-F01–F06 · RT-F01–F04) · AG-F03 (IN-06) · AG-F04 · AG-F08 Portable agents and skills (AG-39, AG-40 move in) · RT-F02 · RT-F06 Skill scripts |
| Not in this project | Any code change. The code deletes listed in `specs/_stale/code.md`, the nine package renames (graphs · access · runtime · model · agents · explore · data · datasets · projects) and the plugin → MCP and skill → `SKILL.md` conversions are a follow-up project, started from the P06 audit (`.agent-reports/qa/specs-m3-audit.md`) when Ravi asks · RT-F05 Graph database connectors (a recommendation, not scope) · the *changed* items P06 finds · the overlaps EX-F06/DA-F07, AC-F06/DA-F06, AG-17/GR-F05 (normal spec flow later) · drawing or renaming boards on the canvas · aliases or shims for any old name, path, route or table · edits to `CLAUDE.md` or `.claude/` (team area: Ravi's own edits at the P01 and P03 pauses) |

Run it: `python3 .claude/skills/run-project/run.py specs-m3` (the project-lead does, with `--start`).

## Rules for every session

| Rule | Detail |
|---|---|
| The map governs | The old→new ID map on the M3 row of `specs/migrations.md` (P01, approved by Ravi) says where every story goes and its new ID. A phase follows it; a row that turns out wrong is a hand-off note and a question, never a silent change |
| The naming table governs | From P03, `specs/system-design/architecture.md` › *One name across layers* is the only source for a package, table, route, action, event, Studio package or board name |
| No aliases | Rename and delete outright. No re-export, redirect, old route or old table kept. Capabilities and demo data keep working |
| `_stale/` is never read | No session reads, cites or links into `specs/_stale/` except P07, which fills it |
| No code changes | Phases change specs, docs and the check scripts only; code changes belong to the follow-up project |
| One commit per phase | The runner's per-phase commit. Never push |
| Team files are Ravi's | `CLAUDE.md` and `.claude/**` are edited by Ravi only. A phase that needs a team-file change writes the exact change into its report and a hand-off note |

## Environment

| Name | Value |
|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` |

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| no old spec paths | `sh -c '! grep -rIl -e specs/products/ -e specs/foundation/ --exclude-dir=node_modules --exclude-dir=_stale --exclude=migrations.md engine studio scripts specs docs integrations'` | `.` | P04, P07, P09 | |
| engine lint | `uv run ruff check .` | `engine` | P02, P04 | |
| engine tests | `uv run pytest` | `engine` | P04 | |
| studio lint | `pnpm lint` | `studio` | P04 | |
| studio types | `pnpm check-types` | `studio` | P04 | |
| studio tests | `pnpm test` | `studio` | P04 | |
| docs build | `make docs-build` | `.` | P07, P09 | |

## Phases

### P01 · Old→new ID map and the vision fixes

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/migrations.md` · `specs/vision.md` · `specs/README.md` · every SH, ST and IN `feature.md` and `story.md` · `.claude/skills/product-spec/format.md` |
| Stories | — |
| Done when | The M3 row of `specs/migrations.md` holds a table of every SH, ST and IN story and IN-06: old ID · old path · new ID · new feature · new path, matching the brief's re-cut map (GR-F01–F05 · AC-F01–F06 · RT-F01–F04 · IN-06 → AG-F03), OS stories numbered from 01 within each prefix · every one of SH ×13, ST ×30, IN ×6 appears exactly once · the capabilities' new paths (`specs/capabilities/<pkg>/`) are listed · `vision.md`: Runtime owns workers, the queue and limits; Agents owns reading runs and setting schedules; the Assistant is out of the OS table; the *Spec today* links point at the new paths (they go live in P03) |
| Lands | `specs/migrations.md` · `specs/vision.md` |
| Boards | — |
| Review | |
| Approve | Ravi — approves the map. At this pause Ravi also changes the `tasks` glob in `.claude/team/edit-rights.json` to `specs/*/*/features/*/stories/*/task.md` and regenerates TEAM.md §1 (`edit_rights.py --write`) |
| Budget | |
| Steps | 1. List every SH, ST and IN story from the tree. 2. Write the map table on the M3 row. 3. Fix `vision.md`. 4. Run the check. 5. Report the map and the edit-rights change for Ravi |

### P02 · check.py reads the new tree

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/check.py` · `scripts/specs/links.py` · `specs/migrations.md` M3 · `.claude/skills/product-spec/format.md` |
| Stories | — |
| Done when | `check.py` knows the areas `os` (Operating system) and `capabilities` (Capabilities) alongside today's two, so it passes before and after the move · it skips `specs/_stale/` · it fails on any link from a live spec or doc into `specs/_stale/` · the index groups the OS before the capabilities · the check passes on today's tree |
| Lands | `scripts/specs/check.py` and its tests |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Add the two areas and their order. 2. Skip `_stale/`; refuse a live link into it. 3. A positive and a negative test. 4. Run the check |

### P03 · Move the specs to os/ and capabilities/

| | |
|---|---|
| Agent | product-manager |
| Read | The approved map (`specs/migrations.md` M3) · `specs/system-design/architecture.md` · `.claude/skills/product-spec/SKILL.md` and `format.md` |
| Stories | Every SH, ST and IN story · IN-06 |
| Done when | `specs/products/` and `specs/foundation/` no longer exist · `specs/os/{graph,access,runtime}` hold GR, AC and RT with their `product.md`, features and stories (`story.md` + its `task.md`) under the new IDs, content carried over unchanged except IDs and links · IN-06 is a story of AG-F03 · each capability `product.md` records its pillar · `architecture.md` holds *One name across layers*: the naming rule, the package list, the shared packages and the settled clashes from the brief, as tables · every spec link and `boards:` entry resolves · the index is regenerated · the check and links pass · the report lists the exact `TEAM.md` and skill edits that name the old paths |
| Lands | `specs/**` |
| Boards | — |
| Review | |
| Approve | Ravi — reviews the moved tree. At this pause Ravi applies the `TEAM.md` and skill path edits from the report, and the rule that agents never read or cite `specs/_stale/` |
| Budget | 400k — one move touches every spec path; it cannot be split without a broken tree in between |
| Steps | 1. `git mv` the capabilities. 2. Build GR, AC, RT from the map: products, features, stories, renumbered. 3. Move IN-06 into AG-F03. 4. Repoint every link. 5. Pillars in each capability `product.md`. 6. The naming table in `architecture.md`. 7. Regenerate the index; run the check and links |

### P04 · Repoint code and drop the old areas

| | |
|---|---|
| Agent | coder |
| Read | The M3 map · `specs/system-design/architecture.md` › *One name across layers* |
| Stories | — |
| Done when | No file in `engine/`, `studio/`, `integrations/`, `scripts/` or `docs/` names `specs/products/` or `specs/foundation/` or an old SH, ST or IN ID (docstrings, comments, the golden files) · `check.py` no longer knows `products` or `foundation` · all gates green |
| Lands | Engine and Studio docstrings and comments · `engine/tests/golden/*` · `scripts/specs/check.py` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Grep and repoint. 2. Regenerate the golden files; revert any change that is not this phase's. 3. Drop the old areas from `check.py`. 4. Run the gates |

### P05 · Specify the standards

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/capabilities/agents/` AG-F02, AG-F04, AG-F05 · `specs/os/runtime/` · `specs/system-design/integrations.md` · the brief's *Standards* section (in this file's Hand-off notes) · `.claude/skills/product-spec/SKILL.md` |
| Stories | AG-F04 · AG-F08 (AG-39, AG-40 move in from AG-F02) · RT-F02 · RT-F06 |
| Done when | AG-F04: a skill is a `SKILL.md` folder, Invana fields under `metadata:`, a compiled plan is a cache, skills are guided or planned · AG-F08 Portable agents and skills holds AG-39 and AG-40 and states: agent = Claude-style `.md` with front matter; AGENTS.md, Codex TOML and Claude plugin bundles import-only · RT-F02: a tool plugin is an MCP server, built-ins use the same interface, function contracts are JSON Schema · RT-F06 Skill scripts: `scripts/*.py` run unchanged in a sandbox after one Admin approval · AG-33 says outside agents use A2A cards · simulator plugins stay Invana-native · connectors register via Python entry points · `integrations.md` holds a standards table with the pinned version of each · every story has its five parts, *Who can* for Admin and Operator, and its `## Screens` cells · check and links pass |
| Lands | `specs/capabilities/agents/**` · `specs/os/runtime/**` · `specs/system-design/integrations.md` |
| Boards | — |
| Review | |
| Approve | Ravi — reviews the specs |
| Budget | |
| Steps | 1. Read what exists. 2. Write AG-F08 and RT-F06 from the templates; move AG-39, AG-40. 3. Update AG-F04, RT-F02, AG-33. 4. The standards table. 5. Check and links |

### P06 · Audit: what each piece serves

| | |
|---|---|
| Agent | qa |
| Read | `specs/README.md` · `specs/system-design/architecture.md` › *One name across layers* · `engine/src/invana/**` · `studio/packages/**` · `docs/**` |
| Stories | — |
| Done when | `.agent-reports/qa/specs-m3-audit.md` lists every engine router and app module, every Studio package and every `docs/` page with: the story it serves (or none) · verdict keep · delete · rename (to which package) · change · the evidence · the target package for each of `apps/`, `server/`, `activity/`, `plugins/`, `runtime/`, `graph/` and each Studio package (`activity`, `assistant`, `canvases`, `explorer`, `iam`, `modeller`, `platform`, …) · the split of the engine's work package between agents and projects, story by story · connector entry points confirmed or not · whether AG-33 already means A2A · *changed* items are recommendations, not edits |
| Lands | `.agent-reports/qa/specs-m3-audit.md` |
| Boards | — |
| Review | |
| Approve | Ravi — approves the list. The delete rows are what P07 acts on; the rename rows feed the follow-up project |
| Budget | 400k — the whole engine, Studio and docs tree in one list |
| Steps | 1. Engine routers and modules. 2. Studio packages. 3. Docs pages. 4. Connectors and A2A. 5. The report |

### P07 · Stale docs to `_stale/`

| | |
|---|---|
| Agent | product-manager |
| Read | The approved P06 audit · `docs/products/` · `docs/for-developers/` · `docs/for-developers/README.md` |
| Stories | — |
| Done when | Every stale spec and doc the audit names (`docs/products/*`, old `for-developers` pages, `module-structure.md`) is at `specs/_stale/<original path>` · `specs/_stale/README.md` carries the banner: not live, never read or cited, deleted if nobody pulls it back within one release · `specs/_stale/code.md` lists each code path the audit deletes and why · no live doc or spec links into `_stale/` · check, links and docs build pass |
| Lands | `specs/_stale/**` · `docs/**` (moves out, link fixes) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. `git mv` each stale file. 2. README banner. 3. `code.md` from the audit. 4. Fix or drop live links to moved files. 5. Gates |

### P09 · Docs cleanup

| | |
|---|---|
| Agent | product-manager |
| Read | `docs/for-developers/terminology.md` · `docs/docs/index.md` · `specs/system-design/modules/` · `architecture.md` › *One name across layers* |
| Stories | — |
| Done when | `terminology.md`, the docs home and `system-design/modules/` use the OS, capabilities and package names only · the report lists the retired words and a grep for each returns nothing outside `_stale/` and `migrations.md` · docs build, check and links pass |
| Lands | `docs/**` · `specs/system-design/modules/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List the retired words. 2. Rewrite. 3. Grep each. 4. Gates |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Old→new ID map and the vision fixes |  | done | 2026-11-09 | gates green · reviews passed |
| P02 | check.py reads the new tree | P01 | done | 2026-11-09 | gates green · reviews passed |
| P03 | Move the specs to os/ and capabilities/ | P02 | done | 2026-11-09 | gates green · reviews passed |
| P04 | Repoint code and drop the old areas | P03 | done | 2026-11-09 | gates green · reviews passed |
| P05 | Specify the standards | P04 | done | 2026-11-09 | gates green · reviews passed |
| P06 | Audit: what each piece serves | P04 | done | 2026-11-09 | gates green · reviews passed |
| P07 | Stale docs to `_stale/` | P06 | done | 2026-11-09 | gates green · reviews passed |
| P09 | Docs cleanup | P07 | done | 2026-11-09 | gates green · reviews passed |

## Hand-off notes

| ID | Note |
|---|---|
| P02 | `check.py` knows four areas in index order `os` · `capabilities` · `products` · `foundation`; P04 drops the last two from `AREAS`. `specs/_stale/` is never checked (by `check.py` or `links.py`); any relative link into it from `specs/` or `docs/` fails the check — inline, angle-bracket (spaces and anchors included) and reference `[id]: path`; a backticked path is allowed. Tests: `python3 -m unittest discover -s scripts/specs` (10) — in no gate yet (R099/R103). `format.md` still names the two old areas (R100, Ravi at the P03 pause). Regenerating the index (P03) changes its intro to "the operating system, the capabilities" (R105) |
| P03 | The tree is `specs/os/{graph,access,runtime}` + `specs/capabilities/<pkg>/`. `specs/foundation/`, the Inbox product and IN-F02 are gone; AG-45 (was IN-06) is in AG-F03. P03 already repointed every link and every mapped old ID in `docs/` and `README.md`, so P04's grep is code, scripts and golden files only. Old doc IDs SH-11 … SH-23 have no M3 row and stay in docs P07 moves (R111). An old feature ID that split was resolved sentence by sentence (sign-in → AC-F01 · keys, groups, holders → AC-F03 · an agent's access, asks for more → AC-F04 · notifications and the Inbox → GR-F05 · asks → AC-F05 · limits → RT-F04). The access-model Decisions are `specs/os/access/product.md#decisions`, which features link as `../../product.md#decisions`. A capability's pillar is a body line under its summary, not front-matter. `architecture.md` › *One name across layers* adds a board form `<pkg>.<surface>.<variant>` and plural records, beyond the brief. The team-file edits for Ravi are in `.agent-reports/product-manager/specs-m3/P03-report.md`; until he makes them, `format.md` and the skills name the old areas (R100). `check.py` still knows `products` and `foundation` (P04 drops them) |
| P04 | Code, scripts and golden files cite only `specs/os/` and `specs/capabilities/`; `check.py` knows only those two areas. Choices the map did not settle (R112): ST-F06 split sentence by sentence — an agent's own bound → RT-F04 § Rules, workers, the pool and contention → RT-F03; ST-F02 token hash → AC-F03; Studio e2e SH-13 → AG-42, SH-14 → AC-17. `docs/` still cites retired SH-11…SH-23 IDs (R111) — the coder writes no docs; P07 moves those pages. Engine tests: 3 `tests/llm/` Ollama tests fail on a host whose Ollama holds no model — pull the test model or expect them red |
| P04 (fix 1) | The 3 engine failures were not spec-path related: the Ollama tests skipped only when Ollama was reachable, but the local Ollama has no models (404). `_ollama_up()` in `tests/llm/test_{client,propose,translate}.py` now also requires the dev model to be pulled. `tests/llm` run alone shows 4 `test_providers` errors (`standard_versions` FK) from model import order; the full suite is unaffected. |
| P05 | AG-39 and AG-40 now sit in AG-F08 Portable agents and skills (IDs kept); AG-F02 is *The agents catalogue — invite*, AG-35 only. New: RT-F06 Skill scripts (RT-15, RT-16); next free IDs AG-46, RT-17. Pins in `specs/system-design/integrations.md` › *Standards*: MCP `2026-07-28` · A2A `1.0` · JSON Schema 2020-12 · connectors under entry-point group `invana.connectors` · unversioned formats pinned by read date 2026-11-09. Choices the brief did not settle, for *Questions for Ravi* (report: `.agent-reports/product-manager/specs-m3/P05-report.md`): `AGENTS.md` → one draft agent, not graph rules · a planned skill that will not compile on import offers *Import as guided* · a new skill defaults to planned · only shipped *tool* plugins are MCP, core stays Invana-native like simulators · script approval keys on exact content, not skill version · sandbox: no network, secrets or graph, stdlib only (open question). Every story stays `idea`; S01/S02 need the spec review and boards first. Module specs `graph-connectors.md` (R114) and `skills.md` (R115) contradict the new specs until P09 or S02 updates them; docs pages still cite AG-F02 for AG-39/40 (R116) |
| P06 | Report `.agent-reports/qa/specs-m3-audit.md`. No engine or Studio source is dead by import (the 54 unreferenced engine modules are Alembic revisions and path-loaded plugin tasks), so the delete list is docs only; `plugins/tools/mail` and `science` serve no story and are left for Ravi (R119). Work package: every `apps/work` file serves Projects; only `spawn_agent`/`delegate` and `runtime/delegation.py` go to agents (R123). Connectors register no entry points (R125); AG-33 says A2A but no code exists (R126). Code serves `/api/v1/u/{u}/{g}/…` and one Studio route `u/:username/:graphSlug`, not the naming table's shapes: Ravi decides before R01. R03 collides with the old `runtime/` dir (R117); R07 has no source (R124) |
| P07 | 71 files moved to `specs/_stale/<original path>` — exactly the audit §8 doc rows (`docs/products/`, `docs/system-design*`, `docs/docs/studio/`, `rfcs.md`, the for-developers roots, `building-engine/`, 8 `building-studio/` pages, the module stubs and retired features); nothing else. `docs/mkdocs.yml` nav drops *Studio* and *RFCs*; four docs-site links to `studio/*` dropped. `specs/_stale/code.md` lists **no** code path to delete — `plugins/tools/{mail,science}` sit under *Not deleted — Ravi decides* (R119): P08 deletes nothing unless Ravi says yes there. 352 live links into moved files were unlinked, keeping their text (`docs/`); the docs still name moved files in plain text — P09 rewrites them. Choice for *Questions for Ravi*: the audit's delete list moves `orchestration.md`, `governance.md`, `architecture.svg` and `govern-and-agents-data-model.md` whole, though §5 says orchestration §§4–11 go to `specs/system-design/orchestration.md`; I followed §8 (the approved list) and removed the six spec sentences that said content was 'still in' them, rather than keeping those four live — R127 carries the content back within one release. Code, `engine/pyproject.toml` and `engine/CLAUDE.md` still cite `building-engine/*` and `docs/system-design.md` (R128): P08 step 3 |
| P09 | Report `.agent-reports/product-manager/specs-m3/P09-report.md` holds the retired words and their grep. The grep is clean on terminology, the docs site and `specs/system-design/modules/`. The residue is in `docs/for-developers` review and plan pages, which describe code that still uses the old names (R129), and in journeys and architecture layer 8 (R130). The glossary's *Not on screen* and design-language §8 keep the retired screen names on purpose. Module spec files keep their old slugs because about 100 engine docstrings cite them; each H1 now names its package (R131: rename them with the package renames). *Modeller* is a persona and *Shell* is the Studio frame, so neither is retired. SH-13 → AG-42 · SH-14 → AC-17 · SH-18 → AG-32 in for-developers. For *Questions for Ravi*: accept the grep scope? |
| — | The brief (Ravi, 2026-11-09) settles: packages graphs · access · runtime · model · data · datasets · agents · explore · projects; shared core · cli · server (engine) and core · ui · shell (Studio); GR's package is `graphs`; connectors → `runtime/connectors`; loaders → `datasets/loads`; AI models are `llms` in code; no `os` level in code; MO's package is `model`; the Assistant is a feature of explore; the work package splits between agents and projects by story |
| — | Standards (brief): skill = `SKILL.md` folder, Invana fields under `metadata:`, compiled plan is a cache, guided or planned, `scripts/*.py` sandboxed after one Admin approval, `skill.toml` + `instructions.md` retired · tool plugin = MCP server, built-ins too, contracts JSON Schema · agent = Claude-style `.md` with front matter; AGENTS.md, Codex TOML, Claude plugin bundles import-only · outside agents = A2A cards · simulator plugins Invana-native · connectors via Python entry points |
| — | The old→new ID map is deleted from `migrations.md` once the boards are renamed on the canvas — outside this project |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-09 | P01, P03 | `.claude/**` and `CLAUDE.md` are Ravi-only in `edit-rights.json`; no project agent can change edit rights, TEAM.md or skills. Who makes those edits? | Ravi at the P01 and P03 pauses, from the exact edits the reports list · grant product-manager the team area for this project | Ravi at the pauses — the edits are small and the team area stays yours | Approved as recommended |
| 2026-11-09 | R*, S* | The brief puts skills → SKILL.md and plugins → MCP inside the rename phases. They change behaviour, so they need `designed` stories and QA against criteria. Keep them in the renames or split them out? | Split into S01, S02 after the renames · inside R03 and R05 | Split. A rename stays a pure refactor that QA can check by "nothing changed"; the conversions get their own criteria | Approved as recommended |
| 2026-11-09 | P02, P03 | One "product-manager + coder" phase can't run; a phase has one agent. P02 → P03 → P04 is coder · PM · coder, so the tests are red between P03 and P04 (the golden files cite old paths). Accept that? | Accept, with tests gated at P04 · merge P03 and P04 under a Ravi session | Accept. Only the spec check and links gate P03 | Approved as recommended |
| 2026-11-09 | R05 | Agents is the largest slice (≈ 80 engine files across apps/server, 165 Studio files). Split it? | One phase that hands off in parts · R05a engine + API client, R05b Studio package and routes | One phase, in parts. Splitting the API from its Studio client leaves e2e red in between | Approved as recommended |
| 2026-11-09 | P03, P06 | 400k context budgets for P03 and P06 | Approve · split the phases | Approve | Approved |
| 2026-11-09 | P08, R*, S* | Keep the code phases (P08 deletes, R01–R09 renames, S01–S02 conversions) in specs-m3, or make it spec cleanup only? | Keep them · spec cleanup only; code becomes a follow-up project from the P06 audit | Spec cleanup only — the specs land now, the code work is planned on its own | Approved — P08, R01–R09 and S01–S02 removed; P09 needs P07 |
