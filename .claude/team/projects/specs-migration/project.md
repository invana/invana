---
name: specs-migration
status: done
branch: feat/specs-migration
scope: specs-migration
---

# Specs migration — for-developers into specs/

Moves what is true in `docs/for-developers/` (and `docs/products/`, `docs/system-design.md`) into `specs/` in the
standard format, for everyone who specifies, draws, builds and checks Invana; whatever is not true yet stays behind for
Ravi to review.

| | |
|---|---|
| Goal | `specs/` holds every product, feature and story Invana has or plans, plus `vision` · `personas` · `glossary` · `system-design/` · `journeys/`, all passing the spec check · every moved section is cut from its source · `docs/for-developers/README.md` is a review index of what stayed and why · no code cites a cut section |
| Specs | Products EX · MO · DA · AG · PJ · IN · ST · SH; features EX-F01–F07 · MO-F01–F06 · DS-F01–F04 · AG-F01–F07 · PJ-F01–F05 · IN-F01–F03 · ST-F01–F06 · SH-F01–F03 (tentative — P01's mapping fixes them); journeys J01–J05 |
| Not in this project | Drawing boards (Screens cells name existing Agent-version boards or `—`; missing boards become designer work later) · changing product code beyond citation paths (P21) · deleting anything that was not moved · `.changeset/` text · editing `.claude/` or `CLAUDE.md` (their citations go to a recommendation for Ravi) |

Run it: `python3 .claude/skills/run-project/run.py specs-migration` (the project-lead does, with `--start`).

## Rules for every session

| Rule | Detail |
|---|---|
| Procedure | The product-manager follows `/product-spec` §6 *Migrate* and `format.md`, from the templates — never a blank page |
| The mapping governs | `.agent-reports/product-manager/specs-migration/mapping.md` (written in P01) says where every source section goes. A phase moves only its own rows; a row that turns out wrong is fixed in the mapping first, with a hand-off note |
| Move, then cut | A section is cut from its source only once its content is in `specs/` and the check passes. Nothing that was not moved is deleted — not true yet, retired, RFC debate, build plans and engine detail not yet settled all **stay** |
| Log what stayed | Every phase appends to the mapping's *Stayed* table: file · section · why (not true yet · retired · debate · plan · engine detail) · where it would go |
| Not true yet vs not built | A capability the docs plan but code lacks (❌ in the audit) is still a story, status `specified`. Content that contradicts the live model or is superseded stays |
| The live model | Orchestration is `docs/for-developers/orchestration.md` §0; on-screen words are `specs/glossary.md` and `specs/design-language.md` §6 — never the old product names or role names (Operator, not viewer) |
| Status | Migrated stories are `specified` once the phase is approved; an empty `task.md` beside each. Built-ness lives in the audit reports, never as invented tasks |
| IDs | Story IDs on the canvas and in `docs/products/` are kept; new ones take the next free number; never reused |
| A step | One feature, or one system-design file: the unit each `wip` commit holds |

## Environment

| Name | Value |
|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` |

## Setup

None — docs phases need no stack.

| Step | Command | In | Phases |
|---|---|---|---|

## Gates

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| engine lint | `uv run ruff check .` | `engine` | P21 | |
| studio lint | `pnpm lint` | `studio` | P21 | |
| studio types | `pnpm check-types` | `studio` | P21 | |
| studio tests | `pnpm test` | `studio` | P21 | |

## Phases

### P01 · Inventory and mapping

| | |
|---|---|
| Agent | product-manager |
| Read | all of `docs/for-developers/` · `docs/products/` · `docs/system-design.md` · `specs/design-language.md` · `.claude/skills/product-spec/format.md` |
| Stories | — |
| Done when | `.agent-reports/product-manager/specs-migration/mapping.md` has one row per source section (file · section · destination — product/feature/story, system-design, glossary, vision, journey, or *stays* · story ID · reason) and an empty *Stayed* table · old story IDs reconciled with `docs/products/` and the Agent-version canvas · the module → product mapping and the feature list are final · every later phase's entry is checked against it and split where it would read or write more than ~40 files · the four broken links in `docs/for-developers/building-studio/` fixed so the links gate starts green |
| Lands | the mapping · this file's later entries (only if a split is needed) · two link fixes |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Inventory every file and `##` section with its line count. 2. Map each to a destination or *stays*, with the reason. 3. Reconcile IDs. 4. Fix the feature list and re-size phases P06–P20. 5. Fix the four links. |

### P02 · Foundations

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping · `docs/for-developers/README.md` · `terminology.md` · `docs/products/README.md` · `docs/system-design.md` · `specs/design-language.md` |
| Stories | — |
| Done when | `specs/vision.md` · `personas.md` · `glossary.md` · eight `products/<area>/product.md` (features table from the mapping, *Not building*) · `system-design/architecture.md` · `data-model.md` · `integrations.md` exist; the check passes; their source sections are cut; *Stayed* logged |
| Lands | `specs/vision.md` · `personas.md` · `glossary.md` · `specs/products/*/product.md` · `specs/system-design/` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. vision · personas · glossary. 2. The eight `product.md`. 3. system-design skeleton files. 4. Cut, log, check, index. |

### P03 · Is it built? EX · MO · DA

| | |
|---|---|
| Agent | qa |
| Read | the mapping rows for EX · MO · DA · each source feature file · the code it names |
| Stories | — |
| Done when | `reviews/P03-audit.md` marks every capability of the explore, ask, memory, connect-and-model, govern, rules and bring-data-in features ✅ · 🟡 · ❌, each with evidence (file:line, route or test) |
| Lands | `reviews/P03-audit.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One section per source feature file. 2. Evidence per capability. 3. Recommendations for gaps. |

### P04 · Is it built? AG · PJ

| | |
|---|---|
| Agent | qa |
| Read | the mapping rows for AG · PJ · each source feature file · the code it names |
| Stories | — |
| Done when | `reviews/P04-audit.md` marks every capability of the agents, skills, workflows, schedules and work features ✅ · 🟡 · ❌ with evidence |
| Lands | `reviews/P04-audit.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One section per source feature file. 2. Evidence per capability. 3. Recommendations for gaps. |

### P05 · Is it built? ST · IN · SH

| | |
|---|---|
| Agent | qa |
| Read | the mapping rows for ST · IN · SH · each source feature file · the code it names |
| Stories | — |
| Done when | `reviews/P05-audit.md` marks every capability of the identity-and-access, platform, operate and graph-connectors features ✅ · 🟡 · ❌ with evidence |
| Lands | `reviews/P05-audit.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One section per source feature file. 2. Evidence per capability. 3. Recommendations for gaps. |

### P06 · EX · explore

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for `modules/explore/` · those files · `reviews/P03-audit.md` · `specs/products/explore/product.md` |
| Stories | EX-F01 · EX-F02 · EX-F06 (story IDs per the mapping) |
| Done when | Each feature has `feature.md` (user journey mermaid, stories, access, states, rules, decisions, not building) and each story its folder with a five-part `story.md` and an empty `task.md` · check and links pass · `specs/README.md` regenerated · moved sections cut · *Stayed* logged. This phase sets the pattern the rest follow |
| Lands | `specs/products/explore/features/EX-F01-*` · `EX-F02-*` · `EX-F06-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. EX-F01. 2. EX-F02. 3. EX-F06. 4. Cut, log, check, index. |

### P07 · EX · ask, first half

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for EX-F03 · EX-F04 · their `modules/ask/` files · `reviews/P03-audit.md` · P06's features as the pattern |
| Stories | EX-F03 · EX-F04 |
| Done when | as P06 for these features |
| Lands | `specs/products/explore/features/EX-F03-*` · `EX-F04-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. EX-F03. 2. EX-F04. 3. Cut, log, check, index. |

### P08 · EX · ask rest and memory

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for EX-F05 · EX-F07 · their `modules/ask/` and `modules/memory/` files · `reviews/P03-audit.md` |
| Stories | EX-F05 · EX-F07 |
| Done when | as P06 for these features; `modules/ask/spec.md` and `modules/memory/spec.md` cross-feature decisions placed |
| Lands | `specs/products/explore/features/EX-F05-*` · `EX-F07-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. EX-F05. 2. EX-F07. 3. Module spec decisions. 4. Cut, log, check, index. |

### P09 · MO · connect and model

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for MO-F01–F04 · `modules/connect-and-model/` · `reviews/P03-audit.md` · `docs/products/modeller.md` |
| Stories | MO-F01 · MO-F02 · MO-F03 · MO-F04 |
| Done when | as P06 for these features |
| Lands | `specs/products/model/features/MO-F01-*` … `MO-F04-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One feature per step. 2. Cut, log, check, index. |

### P10 · MO · govern and rules

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for MO-F05 · MO-F06 · `modules/govern/` · `modules/skills/features/rules.md` · `reviews/P03-audit.md` |
| Stories | MO-F05 · MO-F06 |
| Done when | as P06 for these features; govern's settled cross-feature rules placed per the mapping, its open debate stays |
| Lands | `specs/products/model/features/MO-F05-*` · `MO-F06-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. MO-F05. 2. MO-F06. 3. Cut, log, check, index. |

### P11 · DA · bring data in

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for DA · `modules/bring-data-in/` · `reviews/P03-audit.md` · `docs/products/datasets.md` |
| Stories | DS-F01 · DS-F02 · DS-F03 · DS-F04 |
| Done when | as P06 for these features |
| Lands | `specs/products/datasets/features/DS-F01-*` … `DS-F04-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One feature per step. 2. Cut, log, check, index. |

### P12 · AG · agents, first half

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for AG-F01 · AG-F02 · their `modules/agents/` files · `reviews/P04-audit.md` · `docs/products/agent-builder.md` · `agent-fabric.md` |
| Stories | AG-F01 · AG-F02 |
| Done when | as P06 for these features |
| Lands | `specs/products/agents/features/AG-F01-*` · `AG-F02-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AG-F01. 2. AG-F02. 3. Cut, log, check, index. |

### P13 · AG · agents, rest

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for AG-F03 · AG-F05 · their `modules/agents/` files · `reviews/P04-audit.md` |
| Stories | AG-F03 · AG-F05 |
| Done when | as P06 for these features; `modules/agents/spec.md` decisions placed |
| Lands | `specs/products/agents/features/AG-F03-*` · `AG-F05-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AG-F03. 2. AG-F05. 3. Module spec decisions. 4. Cut, log, check, index. |

### P14 · AG · skills and workflows

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for AG-F04 · AG-F06 · AG-F07 · `modules/skills/` · `modules/workflows/` · `operate/features/schedules.md` · `reviews/P04-audit.md` |
| Stories | AG-F04 · AG-F06 · AG-F07 |
| Done when | as P06 for these features |
| Lands | `specs/products/agents/features/AG-F04-*` · `AG-F06-*` · `AG-F07-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. AG-F04. 2. AG-F06. 3. AG-F07. 4. Cut, log, check, index. |

### P15 · PJ · work

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for PJ · `modules/work/` · `reviews/P04-audit.md` · `docs/products/projects.md` |
| Stories | PJ-F01 · PJ-F02 · PJ-F03 · PJ-F04 · PJ-F05 |
| Done when | as P06 for these features |
| Lands | `specs/products/projects/features/PJ-F01-*` … `PJ-F05-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One or two features per step. 2. Cut, log, check, index. |

### P16 · IN · operate

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for IN · `modules/operate/` (not schedules) · `reviews/P05-audit.md` |
| Stories | IN-F01 · IN-F02 · IN-F03 |
| Done when | as P06 for these features |
| Lands | `specs/foundation/inbox/features/IN-F01-*` … `IN-F03-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One feature per step. 2. Cut, log, check, index. |

### P17 · ST · identity and access

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for ST-F02 · ST-F03 · `modules/identity-and-access/` · `reviews/P05-audit.md` · `docs/products/iam.md` |
| Stories | ST-F02 · ST-F03 |
| Done when | as P06 for these features |
| Lands | `specs/foundation/settings/features/ST-F02-*` · `ST-F03-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. ST-F02. 2. ST-F03. 3. Cut, log, check, index. |

### P18 · ST · platform settings

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for ST-F01 · ST-F04–F06 · `modules/platform/` · `connect-and-model/features/{connect-a-database,graph-settings}.md` · `agents/features/{providers-and-models,workers}.md` · `reviews/P05-audit.md` · `docs/products/platform.md` · `plugins.md` |
| Stories | ST-F01 · ST-F04 · ST-F05 · ST-F06 |
| Done when | as P06 for these features |
| Lands | `specs/foundation/settings/features/ST-F01-*` · `ST-F04-*` … `ST-F06-*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. One feature per step. 2. Cut, log, check, index. |

### P19 · SH · shell and journeys

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for SH and journeys · `docs/products/shell.md` · `onboarding.md` · `platform/features/{search,design-system}.md` · every `feature.md` written so far |
| Stories | SH-F01 · SH-F02 · SH-F03 · journeys J01–J05 |
| Done when | as P06 for these features · each journey draws one person's path across products in mermaid with every branch, and each feature it crosses links into it |
| Lands | `specs/foundation/shell/features/SH-F01-*` … `SH-F03-*` · `specs/journeys/` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. SH features. 2. Journeys. 3. Cut, log, check, index. |

### P20 · System design

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping rows for `system-design/` · `orchestration.md` · `governance.md` · `module-structure.md` · `the-sequence.md` · `modules/*/spec.md` engine sections · `modules/graph-connectors/` · the platform runtime, telemetry and CLI files |
| Stories | — |
| Done when | `specs/system-design/` holds orchestration (§0 only) · governance-and-lens (settled rules only) · runtime · observability · api-and-cli · `modules/<module>.md` engine shapes per the mapping · retired sections, RFC debate and plans stay · check and links pass · moved sections cut · *Stayed* logged |
| Lands | `specs/system-design/*` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. orchestration · governance. 2. runtime · observability · api-and-cli. 3. `modules/` files. 4. Cut, log, check. |

### P21 · Repoint citations

| | |
|---|---|
| Agent | coder |
| Read | the mapping (moved rows only) · `git grep -n for-developers -- engine studio integrations` |
| Stories | — |
| Done when | No file in `engine/` · `studio/` · `integrations/` cites a path or anchor that was cut; each moved citation points at its `specs/` home; citations into sections that stayed are unchanged · lint, types and Studio tests green |
| Lands | comments and docstrings only, across engine · studio · integrations |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Script the rewrite from the mapping. 2. Review the diff by hand per package. 3. Gates. A commit per package. |

### P22 · Review index

| | |
|---|---|
| Agent | product-manager |
| Read | the mapping's *Stayed* table · what is left in `docs/for-developers/` · `docs/products/` · `specs/migrations.md` |
| Stories | — |
| Done when | `docs/for-developers/README.md` is the review index — every leftover file or section, why it stayed, where it would go · citations in `docs/products/` repoint to `specs/` · migration M2 updated · one recommendation lists every `.claude/` and `CLAUDE.md` citation of a cut path for Ravi · check and links pass |
| Lands | `docs/for-developers/README.md` · `docs/products/*` · `specs/migrations.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Review index. 2. `docs/products` citations. 3. M2. 4. The `.claude` recommendation. |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | Inventory and mapping |  | done | 2026-11-02 | gates green · reviews passed |
| P02 | Foundations | P01 | done | 2026-11-02 | gates green · reviews passed |
| P03 | Is it built? EX · MO · DA | P01 | done | 2026-11-02 | gates green · reviews passed |
| P04 | Is it built? AG · PJ | P01 | done | 2026-11-02 | gates green · reviews passed |
| P05 | Is it built? ST · IN · SH | P01 | done | 2026-11-02 | gates green · reviews passed |
| P06 | EX · explore | P02, P03 | done | 2026-11-02 | gates green · reviews passed |
| P07 | EX · ask, first half | P06 | done | 2026-11-02 | gates green · reviews passed |
| P08 | EX · ask rest and memory | P07 | done | 2026-11-02 | gates green · reviews passed |
| P09 | MO · connect and model | P06 | done | 2026-11-02 | gates green · reviews passed |
| P10 | MO · govern and rules | P09 | done | 2026-11-02 | gates green · reviews passed |
| P11 | DA · bring data in | P06 | done | 2026-11-02 | gates green · reviews passed |
| P12 | AG · agents, first half | P06, P04 | done | 2026-11-02 | gates green · reviews passed |
| P13 | AG · agents, rest | P12 | done | 2026-11-02 | gates green · reviews passed |
| P14 | AG · skills and workflows | P13 | done | 2026-11-02 | gates green · reviews passed |
| P15 | PJ · work | P06, P04 | done | 2026-11-02 | gates green · reviews passed |
| P16 | IN · operate | P06, P05 | done | 2026-11-02 | gates green · reviews passed |
| P17 | ST · identity and access | P06, P05 | done | 2026-11-02 | gates green · reviews passed |
| P18 | ST · platform settings | P17 | done | 2026-11-02 | gates green · reviews passed |
| P19 | SH · shell and journeys | P08, P10, P11, P14, P15, P16, P18 | done | 2026-11-02 | gates green · reviews passed |
| P20 | System design | P19 | done | 2026-11-02 | gates green · reviews passed |
| P21 | Repoint citations | P20 | done | 2026-11-02 | gates green · QA PASS (report not saved: .claude/ write refused) · accepted by Ravi |
| P22 | Review index | P21 | done | 2026-11-02 | gates green · reviews passed |

## Hand-off notes

| ID | Note |
|---|---|
| P21 | Fix round 2: QA wrote no report, so there was no finding to fix; no code changed. Citations were last repointed in the P21 step 1–3 commits. Re-run QA for P21. |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
