---
name: spec-cleanup
status: done
branch: spec-site/P06-review
scope: spec-cleanup
---

# Spec cleanup

Dissolve `specs/system-design/**` into the features and stories that own each fact, conclude one `specs/system-design.md`
(the high-level design and the NFRs), remove the folder, prove nothing was lost, and leave the spec site reading cleanly.

| | |
|---|---|
| Goal | Every fact now in `specs/system-design/**` lives in its owner: a feature's `## Engine` (records · routes · events · refusals · CLI · mechanisms), a story's criteria, or a feature's Decisions / Not building. `specs/system-design.md` holds only the HLD and NFRs with numbers, linking to each feature's `## Engine`. The folder is gone. The spec site shows titles, parses every diagram, builds clean |
| Specs | Every feature in `specs/os/**` and `specs/capabilities/**` (their `## Engine` and `## System impact`), the stories whose refusals become criteria, `specs/system-design.md` |
| Not in this project | Engine, Studio and integrations code (frozen until the specs pass — migration M5, R258, R263) · boards (R257, R262 — the designer) · the canvas and design-kit repos (R267, R269) · `.claude/**` (R261 is done) · the genomic simulator's method (R260 — its plugin README) |

Run it: `python3 .claude/skills/run-project/run.py spec-cleanup` (the project-lead does, with `--start`).

## Rules for every session

| Rule | Detail |
|---|---|
| One home per fact | A record, route, event or refusal has one owning feature; every other feature links to it. `system-design.md` states conventions and links; it never restates a table or a payload (CLAUDE.md rule 15) |
| One row per fact | Engine tables, no prose. Never restate a feature's Rules in its Engine; a *Reads* table is links only |
| The current specs win | The old `system-design/` text predates the Semantics · Records restructure (commit `af96a092`): datasets are loads, Model is Semantics, Data is Records, project types relabel only in Studio. Where old text contradicts a current feature rule, write the current rule and list the conflict in the report |
| Generic | No domain examples in stories or Engine — no genetics, crosses, traits, fraud specifics. A plugin's own method stays in its plugin |
| Refusals are criteria | Every refusal a person can meet is also a criterion in the story where they meet it; an API-only refusal says why in its Engine row |
| The old text stays until P12a | No phase deletes or edits a `specs/system-design/**` file except a link repoint; P13 audits old against new from git |
| Write only your role's files | product-manager: `specs/**`, `docs/docs/**`; coder: `scripts/specs/**`; qa: its report and `recommend` rows |
| Present tense, no history | No decision ids, no "was", no renames in specs; a change not yet made is a row in `specs/migrations.md` |
| Engine tables are parseable | Every `## Engine` uses the subsections and first columns of `.claude/skills/system-design/SKILL.md` §3 (*Records* · *Reads* · *Routes* · *Events* · *Refusals* · *CLI* · *Mechanisms*), one entity per row with its name in the first column in backticks, so P19 parses them into the knowledge graph without guessing |

## Environment

| Name | Value |
|---|---|

## Setup

| Step | Command | In | Phases |
|---|---|---|---|

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| spec tooling tests | `python3 -m unittest discover -s scripts/specs` | `.` | P12b, P14, P16, P17, P18, P19 | |
| graph parses | `python3 scripts/specs/check.py --graph --out /tmp/specs-graph.json` | `.` | P12b, P14, P16, P17, P18, P19 | |
| site builds | `uv run --project scripts/specs/site mkdocs build -f scripts/specs/site/mkdocs.yml` | `.` | P12a, P12b, P14, P15, P16, P17, P18, P19 | |
| graph app lint | `pnpm --dir scripts/specs/site/graph exec biome check .` | `.` | P12b, P14, P16, P17, P18, P19 | |
| graph app types | `pnpm --dir scripts/specs/site/graph exec tsc -b --noEmit` | `.` | P12b, P14, P16, P17, P18, P19 | |
| graph app tests | `pnpm --dir scripts/specs/site/graph exec vitest run` | `.` | P12b, P14, P16, P17, P18, P19 | |
| graph app build | `pnpm --dir scripts/specs/site/graph build` | `.` | P12b, P14, P16, P17, P18, P19 | |

## Phases

### P01 · Finish the Projects pilot

| | |
|---|---|
| Agent | product-manager |
| Read | `.claude/skills/system-design/SKILL.md` · `.claude/skills/product-spec/format.md` · PJ-F01–F06 and their stories · `specs/system-design/modules/projects.md` · this project's Rules |
| Stories | — |
| Done when | PJ-F01–F05 `## Engine` follow the Rules (one row per fact, no restated Rules, *Reads* as links) and carry Ravi's decisions: `review` is a reserved project key (PJ-02.17 too); pick-up is the agent function `projects.tasks.claim` checking the pick-up rules, with events `projects.tasks.claimed` and `projects.tasks.claim_lapsed`; `GET /api/v1/projects/types` lists types (built-in and from Domain packs); Needs you lists agents' open proposals; *prose saved as one `needs_split` criterion* is removed. `specs/glossary.md` says **capability** is the level under a pillar (prose and docs), with *product* its synonym in tooling (`product.md`, `product:`) — files keep their names. Every fact of `modules/projects.md` has a home or a listed reason. The report records the line count before and after the trim |
| Lands | `specs/capabilities/projects/**` · `specs/migrations.md` · `specs/glossary.md` (one row) |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Apply the five decisions. 2. Trim every Engine table to one row per fact; cut restated Rules. 3. Re-check each refusal has its criterion. 4. Resolve the Open questions the decisions answered. 5. Gates green |

### P02 · Semantics — models and views

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/model.md` · `modules/model-lenses.md` · `specs/capabilities/semantics/**` · PJ-F01's `## Engine` as the worked example · this project's Rules |
| Stories | — |
| Done when | Every fact of `model.md` and `model-lenses.md` has a home in SE-F01, F02, F06, F09, F10 (and F03–F05 where it fits) or a listed reason; refusals people meet are criteria |
| Lands | `specs/capabilities/semantics/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory each file: fact → owner. 2. Write each feature's Engine. 3. Add missing criteria. 4. System impact. 5. Gates green |

### P03 · Semantics — rules and governance

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/governance-and-lens.md` · SE-F07, SE-F08, SE-F09 · AC-F02, AC-F04, AC-F05 · this project's Rules |
| Stories | — |
| Done when | Every fact of `governance-and-lens.md` has a home — rule kinds (constraints · derivations · act rules · alert triggers) in SE-F07, inference in SE-F08, views in SE-F09, enforcement links to Access — or a listed reason |
| Lands | `specs/capabilities/semantics/**` · `specs/os/access/**` (links and criteria only) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Engine. 3. Criteria. 4. System impact. 5. Gates green |

### P04 · Records — loads

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/datasets.md` · `modules/datasets-loads.md` · `specs/capabilities/records/**` · R270 · this project's Rules |
| Stories | — |
| Done when | The facts that survive the Datasets retirement (loads, provenance, checks on load) live in RC-F02, RC-F03, RC-F06; every retired fact is listed with the Not building row that retires it; R270 (a load's source for saved derived records) is answered in RC-F02 |
| Lands | `specs/capabilities/records/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory: survives or retires. 2. Engine. 3. Criteria. 4. Gates green |

### P05 · Explore

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/explore-boards.md` · `modules/explore-questions.md` · `modules/explore-memory.md` · `specs/capabilities/explore/**` · this project's Rules |
| Stories | — |
| Done when | Every fact has a home in EX-F01–F07 or a listed reason; EX-F07's semantic-model suggestions link SE |
| Lands | `specs/capabilities/explore/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Engine. 3. Criteria. 4. System impact. 5. Gates green |

### P06 · Agents — agents and skills

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/agents.md` · `modules/agents-skills.md` · `specs/capabilities/agents/**` · this project's Rules |
| Stories | — |
| Done when | Every fact has a home in AG-F01, F02, F04, F05, F08 or a listed reason |
| Lands | `specs/capabilities/agents/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Engine. 3. Criteria. 4. System impact. 5. Gates green |

### P07 · Agents — runs, plans and orchestration

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/agents-plans.md` · `specs/system-design/orchestration.md` · AG-F03, AG-F06, AG-F07 · RT-F03 · PJ-F01's Engine · this project's Rules |
| Stories | — |
| Done when | Every fact of both files has a home — runs, steps, plans, the catalogue, budgets, replan in AG-F03/F06/F07; the queue and workers linked to RT-F03 — or a listed reason. `orchestration.md` is the densest file: split into two sessions if needed |
| Lands | `specs/capabilities/agents/**` · `specs/os/runtime/**` (links only) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory both files. 2. Engine per feature. 3. Criteria. 4. System impact. 5. Gates green |

### P08 · Access and Graph

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/access.md` · `modules/access-events.md` · `modules/graphs.md` · `specs/os/access/**` · `specs/os/graph/**` · this project's Rules |
| Stories | — |
| Done when | Every fact has a home in AC-F01–F06 and GR-F01–F05 or a listed reason; the event store is AC-F06's and every other feature links it |
| Lands | `specs/os/access/**` · `specs/os/graph/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Engine. 3. Criteria. 4. System impact. 5. Gates green |

### P09 · Runtime

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/modules/runtime.md` · `modules/runtime-connectors.md` · `specs/system-design/runtime.md` · `specs/system-design/integrations.md` · `specs/os/runtime/**` · R271 · this project's Rules |
| Stories | — |
| Done when | Every fact has a home in RT-F01–F06 or a listed reason; R271 (sub-task depth and count limits) answered in RT-F04; Domain packs' `pack` plugin kind has its Engine in RT-F02 |
| Lands | `specs/os/runtime/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Engine. 3. Criteria. 4. System impact. 5. Gates green |

### P10 · Studio files

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/studio/*` · `specs/design-language.md` · this project's Rules |
| Stories | — |
| Done when | `graph-model-canvas.md` and `task-flow-canvas.md` facts live in their features (SE, AG) or `design-language.md`; the coverage inventories (`design-kit-coverage.md`, `canvas-ui-coverage.md`, `components-todo.md`) leave the specs through one `recommend` row each to move them to the design-kit and canvas repos' docs; nothing of them is restated in specs |
| Lands | `specs/capabilities/**` · `specs/design-language.md` · `recommend` rows |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory. 2. Move the two canvas designs. 3. Raise the coverage rows. 4. Gates green |

### P11 · The system design

| | |
|---|---|
| Agent | product-manager |
| Read | `.claude/skills/system-design/SKILL.md` and `template.md` · `specs/system-design/architecture.md` · `data-model.md` · `api-and-cli.md` · `observability.md` · every feature's `## Engine` and `## System impact` · `specs/vision.md` · R266 · this project's Rules |
| Stories | — |
| Done when | `specs/system-design.md` §§ 1–15 hold no placeholder: context, functional requirements by link, NFRs each with a number, how it is measured and what enforces it (`review` plus a `recommend` row where nothing enforces it yet), constraints, capacity, stores and owners, components, the naming and API conventions, distributed execution, agents, failure modes and the outside boundary, qualities, delivery, evaluation, decisions and risks. Every detail links to a feature's `## Engine`. Features name their NFRs in `nfrs:` (R254, R266) |
| Lands | `specs/system-design.md` · `nfrs:` front-matter in features |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Inventory the four cross-cutting files. 2. Write §§ 1–15 from the template. 3. NFRs. 4. `nfrs:` in features. 5. Gates green |

### P12a · Remove the folder — specs and docs

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/**` · every inbound link to it in `specs/` and `docs/` · this project's Rules |
| Stories | — |
| Done when | `specs/system-design/` is deleted; no file in `specs/` or `docs/` links to it — every link points at the fact's new home |
| Lands | `specs/system-design/**` (deleted) · link repoints in `specs/**` and `docs/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List every inbound link. 2. Repoint each to its new home. 3. Delete the folder. 4. Gates green |

### P12b · Remove the folder — the spec tooling

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/graph.py` · `check.py` · `links.py` · `scripts/specs/site/**` · this project's Rules |
| Stories | — |
| Done when | No file in `scripts/specs/` names `specs/system-design/`; `graph.py` no longer emits `Doc` nodes for it and its docstring says so; checks, tests and the site are green |
| Lands | `scripts/specs/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Find every reference. 2. Update the parser, check and tests. 3. Gates green |

### P13 · Re-audit

| | |
|---|---|
| Agent | qa |
| Read | `git show spec-cleanup/start:specs/system-design/<file>` — the tag on the commit the project starts from (the old text) · every feature's `## Engine` · `specs/system-design.md` · this project's Rules |
| Stories | — |
| Done when | `.agent-reports/qa/spec-cleanup-reaudit.md` starts `RESULT: PASS`: every fact of the old folder is found in its new home, or in a phase report's listed reasons (retired, plugin README, current spec wins); every gap is a `recommend` row |
| Lands | The report · `recommend` rows |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. List every old file's facts. 2. Find each new home. 3. Write the verdict |

### P14 · Spec site — titles in the tree

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/site/**` · R256 · this project's Rules |
| Stories | — |
| Done when | The site's nav reads section and page titles from each index page's front-matter (never folder slugs like "Os" or "AC F04…"); a story folder is one entry, its `story.md`; e2e green |
| Lands | `scripts/specs/site/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Titles from front-matter. 2. Fold story folders. 3. A test. 4. Gates green |

### P15 · Spec site — diagrams parse (specs)

| | |
|---|---|
| Agent | product-manager |
| Read | R252 · the site build's mermaid errors · this project's Rules |
| Stories | — |
| Done when | Every mermaid diagram in `specs/` parses on the site; no meaning changes |
| Lands | `specs/**` (diagram syntax only) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List the failing diagrams. 2. Fix the syntax. 3. Gates green |

### P16 · Spec site — a test that every diagram parses

| | |
|---|---|
| Agent | coder |
| Read | R253 · `scripts/specs/site/**` · this project's Rules |
| Stories | — |
| Done when | A test fails when any mermaid diagram in `specs/` does not parse, and passes on the tree |
| Lands | `scripts/specs/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. The test. 2. Prove it fails on a broken fixture. 3. Gates green |

### P17 · Spec site — build hygiene and tests

| | |
|---|---|
| Agent | coder |
| Read | R250 · R251 · R255 · `scripts/specs/site/**` · this project's Rules |
| Stories | — |
| Done when | The sitemap is not empty; the unused maplibre dependency and the stale layout chip are gone; the telemetry test proves spans reach a collector that is up; the thinking e2e asserts what is drawn, not only that nothing errors |
| Lands | `scripts/specs/site/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. R255. 2. R250. 3. R251. 4. Gates green |

### P18 · Journeys — group by capability, feature, persona or journey

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/site/graph/src/{JourneysView.tsx,journeys.ts}` · `@invana/graph-layer-bubble-sets` (already a site dependency) · `specs-graph.json` (`PART_OF`, `SERVES`) · this project's Rules |
| Stories | — |
| Done when | The Journeys view header has *Group by: none · capability · feature · persona · journey* (default none, kept in the address); *journey* wraps every story a journey reaches, including shared stories that sit in an earlier journey's lane, so a journey's reach across lanes is visible. Each choice draws a soft hull around the stories of each group, coloured like its legend entry, labelled with the group's title; a story in several groups (a persona's stories, a story serving two personas) sits inside each of its hulls. Hulls follow the filter tree (a hidden story leaves its hull) and the lanes stay as they are. The in-canvas legend lists the groups. A unit test for the grouping and one e2e that switching *Group by* draws hulls. A missing canvas feature is a `recommend` row for the canvas repo, not code in the site |
| Lands | `scripts/specs/site/graph/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Group membership from `PART_OF` (feature, capability), `SERVES` (persona) and `NEXT` (journey). 2. Bubble-sets layer per group. 3. The header control and the address. 4. Legend. 5. Tests. 6. Gates green |

### P19 · Knowledge graph — engine entities, criteria and descriptions

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/graph.py` (its docstring is the JSON schema) · every feature's `## Engine` · the stories' acceptance criteria · `specs/ontology.md` · this project's Rules |
| Stories | — |
| Done when | `specs-graph.json` also holds, each read from a spec and never guessed: **Record**, **Route**, **Event**, **Refusal** nodes from `## Engine` rows; **Criterion** nodes from every story's criteria table; a `description` field on every capability, feature, story, journey and persona (its summary line or row). New edges: Feature `OWNS` Record · Feature `READS` Record (from *Reads*) · Record `REFERENCES` Record (from `_id` columns naming another record) · Feature `SERVES_ROUTE` Route · Route `EMITS` Event · Route `REFUSES` Refusal · Refusal `PROVEN_BY` Criterion · Criterion `PART_OF` Story. A row the parser cannot read is listed in `analysis.dangling`, not dropped. The spec view hides the new kinds on load and offers them in Filters. Docstring tables updated; a few positive and negative tests on fixture trees; output deterministic. The report says whether the `platform-map` skill is still needed now that `specs-graph.json` holds this (R273) — retire it, or point it at `specs-graph.json` |
| Lands | `scripts/specs/**` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Engine row parsing. 2. Criteria. 3. Descriptions. 4. Edges. 5. Spec view filters. 6. Tests. 7. Gates green |

### P20 · Knowledge graph — the ontology

| | |
|---|---|
| Agent | product-manager |
| Read | `scripts/specs/graph.py` docstring after P19 · `specs-graph.json` · `specs/ontology.md` · this project's Rules |
| Stories | — |
| Done when | `specs/ontology.md` is no longer a placeholder: every node kind with its meaning, fields and the spec structure it is read from; every edge type with its direction and source; the questions the graph answers (what a story depends on, which criterion proves a refusal, which features read a record, what a journey reaches); a mermaid schema diagram. It names the later code layer (Module · Class · Method, `IMPLEMENTED_IN`) as not built yet |
| Lands | `specs/ontology.md` |
| Boards | — |
| Review | |
| Approve | Ravi |
| Budget | |
| Steps | 1. Read the parse. 2. Write the schema. 3. The questions. 4. Gates green |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Finish the Projects pilot |  | done | 2026-11-12 | gates green · reviews passed |
| P02 | Semantics — models and views | P01 | done | 2026-11-12 | gates green · reviews passed |
| P03 | Semantics — rules and governance | P02 | done | 2026-11-12 | gates green · reviews passed |
| P04 | Records — loads | P01 | done | 2026-11-12 | gates green · reviews passed |
| P05 | Explore | P01 | done | 2026-11-12 | gates green · reviews passed |
| P06 | Agents — agents and skills | P01 | done | 2026-11-12 | gates green · reviews passed |
| P07 | Agents — runs, plans and orchestration | P06 | done | 2026-11-12 | gates green · reviews passed |
| P08 | Access and Graph | P01 | done | 2026-11-12 | gates green · reviews passed |
| P09 | Runtime | P01 | done | 2026-11-12 | gates green · reviews passed |
| P10 | Studio files | P02, P03, P04, P05, P06, P07, P08, P09 | done | 2026-11-12 | gates green · reviews passed |
| P11 | The system design | P10 | done | 2026-11-12 | gates green · reviews passed |
| P12a | Remove the folder — specs and docs | P11 | done | 2026-11-12 | gates green · reviews passed |
| P12b | Remove the folder — the spec tooling | P12a | done | 2026-11-12 | gates green · reviews passed |
| P13 | Re-audit | P12b | done | 2026-11-12 | gates green · reviews passed |
| P14 | Spec site — titles in the tree | P12b | done | 2026-11-12 | gates green · reviews passed |
| P15 | Spec site — diagrams parse (specs) | P12b | done | 2026-11-12 | gates green · reviews passed |
| P16 | Spec site — a test that every diagram parses | P15 | done | 2026-11-12 | gates green · reviews passed |
| P17 | Spec site — build hygiene and tests | P14 | done | 2026-11-12 | gates green · reviews passed |
| P18 | Journeys — group by capability, feature, persona or journey | P14 | done | 2026-11-12 | gates green · reviews passed |
| P19 | Knowledge graph — engine entities, criteria and descriptions | P12b | done | 2026-11-12 | gates green · reviews passed |
| P20 | Knowledge graph — the ontology | P19 | done | 2026-11-12 | gates green · reviews passed |
