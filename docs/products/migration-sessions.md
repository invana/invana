# Migration sessions — the runbook

One entry per Claude session. Each entry is self-contained: what to read, what to do, how to know it is
done. The why is in [migration-plan.md](migration-plan.md). Progress lives in the [log](#log) at the bottom.

## How to run a session

| Step | Do |
|---|---|
| 1 | Find the first `pending` row in the [log](#log) whose *Needs* are all `done` |
| 2 | Start a fresh Claude session in the repo root with the [prompt](#the-session-prompt) below, `<ID>` filled in |
| 3 | The session reads only what its entry lists, does its steps, runs its exit checks |
| 4 | It updates its log row and writes a hand-off note, then stops |
| 5 | Review, commit (or let it commit if the prompt said so), next session |

### The session prompt

```text
Execute migration session <ID> from docs/products/migration-sessions.md.

1. Read docs/products/migration-sessions.md: "Rules for every session", the entry for <ID>,
   and the log row + hand-off notes of every session <ID> needs.
2. Read only the files the entry lists under "Read". Skim others only when a step needs it.
3. Do the steps in order. Do not start any other session's work.
4. Run every exit check. If one fails and you cannot fix it inside this session's scope,
   stop and record it as `blocked` with the reason.
5. Update <ID>'s row in the log (status, date, branch, notes) and add its hand-off note.
6. Commit: <ALLOWED | NOT ALLOWED>. Never push. Never open a PR.
```

### Automating it

`python3 scripts/migration/run.py` runs the whole log unattended — see [scripts/migration/README.md](../../scripts/migration/README.md). It builds each session in a fresh headless Claude context, re-runs the gates itself, runs a separate **design review** against the prototype boards (`reviews/<ID>.md`), fixes up to twice, commits on the session's branch, and never pushes. A session whose context passes **300k tokens** is told to stop cleanly and write a hand-off; the next session continues from that note.


| Piece | How |
|---|---|
| Headless run | `claude -p "<the prompt>" --permission-mode acceptEdits` from the repo root |
| Picking the next one | A small script reads the log table, takes the first `pending` row whose *Needs* are `done`, fills `<ID>` |
| Stopping | The script stops on any row that comes back `blocked` |
| Commit permission | Put `Commit: ALLOWED` in the prompt only for runs you have pre-approved — `CLAUDE.md` rule 11 |
| Graph-DB tests | Track B sessions run them only when the prompt says so |

## Rules for every session

| Rule | Detail |
|---|---|
| Scope | Only the entry's steps. Notice something else? Write it in the hand-off note |
| Move ≠ change | Move sessions (`move`) never change behaviour. Change sessions (`change`) never move files |
| Moving | `git mv`; then `pnpm check-types`, fix what it names; then `pnpm biome check --write` |
| Barrels | Write a package's `src/index.ts` after its files compile; re-export files, never other barrels |
| Gates | From A01: `pnpm turbo run lint check-types test` · `pnpm knip` · `pnpm --filter studio test:e2e` (the two core specs at least) · from A04 the boundary check |
| Design rules | Studio UI follows `CLAUDE.md` *Design rules*: kit components and tokens only |
| Branch | Never `main`. Use the phase branch named in the log; create it from an up-to-date `main` only if the log says it does not exist yet |
| Peers | `git status` before the first write; never edit over uncommitted work you did not make |
| Size | If a step would move more than ~60 files, stop at a clean point, log `partial`, and say where the next session resumes |
| Comments | Short on fields, full on modules (`CLAUDE.md` rule 12); no decision ids in code |
| Tokens, never currency | Every budget, limit, usage figure and alert is shown in tokens — no `$` or other currency in UI, CLI output, docs or tests |
| Model versions | Code that runs an LLM records the exact model version on the run; never resolve a model alias silently |

---

## Phase 0 · Gate

### A00 — allow the studio UI package · `change` · docs + script

| | |
|---|---|
| Goal | The project rules allow `@invana-studio/ui`; the overlap check is ready for packages |
| Read | `CLAUDE.md` (rule 9, *Design rules*) · `studio/scripts/check-kit-overlap.mjs` · [migration-plan §4](migration-plan.md#4-the-studio-ui-package) · [README › Prerequisites](README.md#prerequisites) |

| # | Step |
|---|---|
| 1 | In `CLAUDE.md`, amend rule 9 and *Design rules › Missing component*: Studio-only compositions may live in `@invana-studio/ui` under the rules of migration-plan §4; primitives still go to `design-kit` with a story |
| 2 | Add a pointer in `CLAUDE.md` *Scope* to `docs/products/` as the plan for the product split (one line) |
| 3 | Change `check-kit-overlap.mjs` to scan `src/**` **and** `packages/*/src/**` and `apps/*/src/**` (whichever exist) |

| Exit check | |
|---|---|
| `pnpm lint` green in `studio/` | |
| `CLAUDE.md` diff shows only the two rule edits and the pointer | |

---

## Phase 1 · Workspace

### A01 — Turborepo around today's app · `move`

| | |
|---|---|
| Goal | `studio/` is a pnpm + Turborepo workspace; today's app runs unchanged from `apps/studio` |
| Read | `studio/package.json` · `studio/vite.config.ts` (top comment only) · `studio/tsconfig*.json` · `studio/pnpm-workspace.yaml` · `studio/knip.json` · `studio/biome.json` · `.github/workflows/ci.yml` (studio jobs) · `Makefile` (studio targets) · `docker-compose.yml` (`studio` service) · `studio/Dockerfile` · design-kit's `turbo.json` as the model |

| # | Step |
|---|---|
| 0 | On an up-to-date `main`, tag the starting point: `git tag pre-products-migrations` (local; push only if the user asks). Optional reference copy **outside** the repo: `git archive pre-products-migrations studio \| tar -x -C ~/Projects/invana/studio-reference` |
| 1 | `git mv` into `studio/apps/studio/`: `src/`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.json`, `e2e/`, `playwright.config.ts`, `scripts/`, `knip.json` |
| 2 | `apps/studio/package.json` = today's `package.json` with `"name": "studio"`; keep every dependency and script |
| 3 | New root `studio/package.json` (private, `packageManager` pinned like today): devDeps `turbo`, `@biomejs/biome`; scripts `dev` · `build` · `lint` · `check-types` · `test` · `knip` → `turbo run …`; `test:e2e` → `pnpm --filter studio test:e2e` |
| 4 | `pnpm-workspace.yaml`: add `packages: [apps/*, packages/*]`; keep `allowBuilds` and `minimumReleaseAge*` as they are |
| 5 | `turbo.json`: tasks `build` (outputs `dist/**`), `lint`, `check-types`, `test` (outputs `coverage/**`), `dev` (persistent, no cache) |
| 6 | Biome: root `biome.json` with today's settings; delete the app copy or make it extend the root |
| 7 | `vite.config.ts`: confirm the `INVANA_DESIGN_KIT` / `INVANA_CANVAS` relative paths still resolve from `apps/studio` (they are relative to the file — they now need one more `../`); update the doc comment's example paths |
| 8 | `Makefile`: studio targets run from `studio/` via the root scripts |
| 9 | CI: studio jobs run root scripts; coverage path `studio/apps/studio/coverage/…`; changeset filter `^(engine/src|studio/(apps|packages)/[^/]+/src)/` |
| 10 | Docker: compose `studio` service and `studio/Dockerfile` install at the workspace root and run `pnpm --filter studio dev --host 0.0.0.0`; volume covers the root `node_modules` and `apps/studio/node_modules` |
| 11 | `pnpm install` at `studio/`; regenerate the lockfile |

| Exit check | |
|---|---|
| `pnpm build` · `pnpm lint` · `pnpm check-types` · `pnpm test` · `pnpm knip` green from `studio/` | |
| `pnpm dev` serves :8300; the two core e2e specs pass | |
| `INVANA_DESIGN_KIT=… pnpm dev` and `INVANA_CANVAS=… pnpm dev` each boot once | |
| `docker compose up studio` serves :8300 | |
| `git log --stat` shows renames, no content edits outside config | |
| `git show pre-products-migrations:studio/src/router.tsx` returns today's router | |

---

## Phase 2 · Foundations

### A02 — `@invana-studio/core` · `move`

| | |
|---|---|
| Goal | Non-UI foundations live in `packages/core` |
| Read | `apps/studio/src/{services,stores,hooks,lib,types}/` file list · `tsconfig.app.json` `paths` · one feature's `api.ts` to see how the client is imported |

| # | Step |
|---|---|
| 1 | Create `packages/core`: `package.json` (`name: @invana-studio/core`, `exports: { ".": "./src/index.ts" }`, peers `react`, `@tanstack/react-query`, `zustand`), `tsconfig.json` extending a shared base, `vitest` project entry |
| 2 | Add `packages/tsconfig.base.json` from today's compiler options; packages and the app extend it |
| 3 | `git mv` `services/`, `stores/`, `hooks/`, `lib/`, `types/` into `packages/core/src/` |
| 4 | Replace `@/services/…`, `@/stores/…`, `@/hooks/…`, `@/lib/…`, `@/types/…` imports with `@invana-studio/core` |
| 5 | Write `packages/core/src/index.ts` |
| 6 | Root Vitest config with `projects` covering the app and every package (one coverage report) |
| 7 | `apps/studio/src/index.css`: add `@source "../../../packages/*/src";` |

| Exit check | |
|---|---|
| All gates green; store tests run from `core` | |
| `core` imports nothing from the app (grep `@/`) | |

### A03 — `@invana-studio/ui` and `@invana-studio/canvases` · `move`

| | |
|---|---|
| Goal | Studio-only components and shared canvas compositions are packages |
| Read | `src/ui/` · `src/components/forms/` · `pages/graphs-detail/shared/` file list · `src/canvases/` file list |

| # | Step |
|---|---|
| 1 | Create `packages/ui` (peers `react`, `@invana/*` it uses) and `packages/canvases` (peers `react`, `@invana/canvas*`) |
| 2 | `git mv` `src/ui/*`, `src/components/forms/`, and the presentational files of `shared/` (`DetailRows`, `ListPanel`, `RecordRow`, `SectionTitle`, `StackSection`, `statusTone`, `boardIcons`) into `packages/ui/src/` |
| 3 | `git mv` `src/canvases/*` into `packages/canvases/src/` |
| 4 | Fix imports; `ui` must not import `core` (move any data call it makes back into its caller first — that is a change, so log it and leave it for the owning product session if non-trivial) |
| 5 | Barrels |

| Exit check | |
|---|---|
| All gates green; `check-kit-overlap` scans both packages | |
| `ui` has no `@invana-studio/core` import | |

### A04 — boundary check · `change`

| | |
|---|---|
| Goal | CI fails when a package imports something [the table](migration-plan.md#allowed-imports) forbids |
| Read | migration-plan §2 *Allowed imports* · `knip.json` |

| # | Step |
|---|---|
| 1 | Add the check — `turbo boundaries` with tags, or a `scripts/check-boundaries.mjs` reading each package's imports — whichever expresses the table without exceptions |
| 2 | Tag every package (`core`, `ui`, `canvases`, `assistant`, `shell`, `product`, `app`) |
| 3 | Make `knip` workspace-aware (one entry per package) |
| 4 | Wire both into root `lint` and CI |

| Exit check | |
|---|---|
| Gates green; a deliberate forbidden import (try it, then revert) fails the check | |

---

## Phase 3 · Shell

### A05 — product contract and `<StudioShell>` · `move` + small `change`

| | |
|---|---|
| Goal | The shell package exists; the app composes products through the contract; today's graph page runs as one temporary product |
| Read | `apps/studio/src/router.tsx` · `App.tsx` · `pages/graphs-detail/GraphDetailPage.tsx` · `graphs-detail/shell/GraphDetail.tsx` · `GraphDetailChrome.tsx` · `useGraphLeftNav.tsx` · [the-shell.md](../for-developers/building-studio/the-shell.md) regions table · [shell.md](shell.md) header and breadcrumbs |

| # | Step |
|---|---|
| 1 | `core`: add `ProductDefinition`, `NavItem`, `ActionDef`, `CommandDef` types ([plan §2](migration-plan.md#the-product-contract)) |
| 2 | Create `packages/shell`; `git mv` `pages/auth`, `pages/graphs`, `pages/settings`, `pages/platform`, `pages/ErrorPage.tsx`, `components/` (non-forms) into it |
| 3 | `<StudioShell products={…}>`: `AppLayoutV2` with header (launcher, `Invana <Product>`, Graph picker, breadcrumb slot, ⌘K slot, notifications slot, Assistant toggle, user menu), `leftNav` from the active product's `nav` |
| 4 | Action registry: `useAction(id)` resolves from registered products; returns `null` when absent |
| 5 | Temporary product `legacy-graph` wrapping today's `GraphDetailPage` so behaviour is unchanged |
| 6 | `apps/studio/src/router.tsx` builds routes from the product list |

| Exit check | |
|---|---|
| Gates green; every e2e spec passes unchanged | |
| The launcher lists the registered products; only `legacy-graph` today | |

### A06 — path URLs, redirects, breadcrumbs · `change`

| | |
|---|---|
| Goal | Every product surface has a path; old `?panel=` links redirect; breadcrumbs come from routes |
| Read | `shared/useLeftSection.ts` (the panel union and entity params) · `router.tsx` redirects · [plan §5](migration-plan.md#5-urls) · [shell.md › Breadcrumbs](shell.md#breadcrumbs) · `e2e/routing.spec.ts` |

| # | Step |
|---|---|
| 1 | Route groups `/u/:user/:graph/{explorer,modeller,projects,agents,activity}/*` and `/datasets/*`, each rendering the legacy page with the matching panel open until the product moves |
| 2 | A redirect component maps every `?panel=` value and entity param to its path ([plan §5 table](migration-plan.md#redirects-from-todays-panel-values)) |
| 3 | Breadcrumbs: `handle.crumb` on routes + `useMatches()`; rules from shell.md (tabs are not levels, >4 collapses to `…`) |
| 4 | Extend `e2e/routing.spec.ts`: every old panel URL lands on its new path |

| Exit check | |
|---|---|
| Gates green; routing spec covers all 17 panel keys | |
| Reload on any new path lands on the same screen | |

---

## Phase 4 · Shared features

### A07a — `@invana-studio/assistant` · `move`

| | |
|---|---|
| Goal | The assistant is a package |
| Read | `features/assistant/` file list + `index.ts` · `graphs-detail/shell/AssistantHost.tsx` · `features/assistant/useAssistantCanvasBridge.ts` |

| # | Step |
|---|---|
| 1 | Create `packages/assistant`; `git mv` `features/assistant/*`, `AssistantHost.tsx`, `features/graphs/RecentSessions.tsx` |
| 2 | Fix imports; anything it needs from `shell` is passed in as props or context from the shell (assistant may not import shell) |
| 3 | Barrel |

| Exit check | Gates green; answer-surface e2e passes |
|---|---|

### A07b — chat docked right, closable; the Console · `change`

| | |
|---|---|
| Goal | The assistant behaves as [explorer.md › Decisions](explorer.md#decisions): centred on an empty board, `rightSection` once a conversation starts, closable; the Console in `bottomSection` |
| Read | [explorer.md](explorer.md) decisions · [the-console.md](../for-developers/modules/explore/features/the-console.md) · prototype boards `explorer.home`, `explorer.answer`, `explorer.answer.closed`, `explorer.answer.query`, `explorer.answer.query.error`, `explorer.answer.console` |

| # | Step |
|---|---|
| 1 | Chat in `rightSection`; ✕ closes; header toggle and a pill reopen; state survives reload (`?right=`) |
| 2 | Composer modes Ask · Cypher · Gremlin; ⌘↵ runs; query and outcome are chat messages |
| 3 | Console: `bottomSection`, `bottomSpan: "main"`, resizable, tabs Records · Query · Log, Table/JSON, Re-run, collapse (`?console=`) |
| 4 | Sessions open in the chat's history |
| 5 | E2e: ask → panel docks right; close → canvas full width; query error → Log tab |

| Exit check | Gates green; new e2e spec green |
|---|---|

### A08 — Activity and set-up in the shell · `move` then `change`

| | |
|---|---|
| Goal | Runs, Events, Approvals and the set-up checklist live in `shell` under `/activity` |
| Read | `features/runs/` · `features/events/` · `features/setup/` file lists and `index.ts` · [shell.md › Activity](shell.md#activity) |

| # | Step |
|---|---|
| 1 | `git mv` the three folders into `packages/shell/src/activity/` and `…/setup/`; gates green; log the move |
| 2 | Activity page with tabs Inbox · Approvals · Runs · Schedules · Events · Rules · Channels — tabs without engine support render their empty state naming what unlocks them |
| 3 | Run page under `/activity/runs/:id` |

| Exit check | Gates green; runs and events reachable from every product's header |
|---|---|

---

## Phase 5 · The products that exist

Each session: create the package, `git mv` its folders, give it a `ProductDefinition`, remove its panel from `legacy-graph`, add its rail. Moves land first and pass the gates; the rail and routes come second in the same session.

### A09 — Explorer · `move` + `change`

| Read | `features/explorer/` · `features/boards/useCanvasTabs.ts` · `e2e/explorer.spec.ts` · [explorer.md](explorer.md) |
|---|---|

| # | Step |
|---|---|
| 1 | `git mv` `features/explorer/*`, `useCanvasTabs.ts` → `packages/explorer/src/` |
| 2 | `ProductDefinition`: no rail, full width, floating vertical toolbar top-left, `gate` = today's set-up lock |
| 3 | Routes `/explorer`, `/explorer/:session` |

| Exit check | Gates green; explorer e2e passes at the new path |
|---|---|

### A10a — Modeller, models · `move`

| Read | `features/models/` file list (37 files) |
|---|---|

| # | Step |
|---|---|
| 1 | `git mv` `features/models/*` → `packages/modeller/src/models/`; gates green |

| Exit check | Gates green; models-page e2e passes |
|---|---|

### A10b — Modeller, govern and settings · `move` + `change`

| Read | `features/lenses/` · `features/rules/` · `features/graphs/` · [modeller.md](modeller.md) |
|---|---|

| # | Step |
|---|---|
| 1 | `git mv` `features/lenses/*` → `modeller/src/govern/`; `RulesSection`, `RuleParts` → `modeller/src/rules/`; `GraphTab`, `InfoTab`, `ConnectionFields`, `SettingsViewPanel` + their api/queries → `modeller/src/settings/` |
| 2 | `ProjectRules` stays for A12; `PoolsTable`, `ConcurrencyFields` stay for A11 |
| 3 | `ProductDefinition`: rail Global model · Models · Stitches · Requests │ Worlds · Guardrails · Rules │ Graph settings; landing Global model |

| Exit check | Gates green; global model reachable at `/modeller/global-model` |
|---|---|

### A11 — Agents · `move` + `change`

| Read | `features/agents/` · `skills/` · `plans/` · `projections/` · `llms/` file lists · `features/graphs/PoolsTable.tsx` · [agents.md](agents.md) |
|---|---|

| # | Step |
|---|---|
| 1 | `git mv` the five folders + `PoolsTable`, `ConcurrencyFields` → `packages/agents/src/` (≈ 64 files — split at a folder boundary if over budget) |
| 2 | `ProductDefinition`: rail Overview · Agents · Skills │ Library · Plugins · LLMs · Performance │ Settings. Library has Plans · Templates (today's Catalogue tab moves to Plugins). Plugins and Performance render empty states until B06a and Track C |

| Exit check | Gates green; plan-page e2e passes |
|---|---|

### A12 — Projects · `move` + `change`

| Read | `features/projects/` · `features/rules/ProjectRules.tsx` · [projects.md](projects.md) |
|---|---|

| # | Step |
|---|---|
| 1 | `git mv` `features/projects/*`, `ProjectRules.tsx` → `packages/projects/src/` |
| 2 | `ProductDefinition`: rail Projects · My todos · Decisions; Decisions renders its empty state until B05 |
| 3 | Register action `projects.addFinding` as "not available" until C02 (Explorer's button stays hidden) |

| Exit check | Gates green; a project and a todo open at their new paths |
|---|---|

---

## Phase 6 · Retire

### A13 — delete the graph page · `change`

| Read | `pages/graphs-detail/` what remains · `legacy-graph` product |
|---|---|

| # | Step |
|---|---|
| 1 | Confirm every panel key has a product route (routing spec) |
| 2 | Delete `GraphDetailPage`, `graphs-detail/shell/*` leftovers, `useLeftSection`'s panel union, the `legacy-graph` product |
| 3 | Keep the redirect component forever |

| Exit check | Gates green; `knip` reports nothing unused; `pages/graphs-detail/` is gone |
|---|---|

---

## Phase 7 · Ready for the new

### A14 — Datasets shell · `change`

| # | Step |
|---|---|
| 1 | `packages/datasets` with `scope: 'install'`, rail Catalogue · Validation · Standards │ Imports |
| 2 | Imports journal: today's runs filtered `kind in (import, bulk)`, plus the ingestion timeline; the rest render empty states naming B03 |

### A15 — ⌘K, the Inbox and the first run · `change`

| # | Step |
|---|---|
| 1 | ⌘K: products' `commands` + search over existing endpoints + "Ask the assistant" |
| 2 | Inbox: what the engine already emits (failed runs, approvals) until B08 |
| 3 | ⌘K groups results by product; names first, *related* (meaning) below when the graph database has a vector index; access filtering arrives with C07 |
| 4 | First run (SH-19): a new install asks *what are you trying to decide?* and offers connect · start from data · sample Graph |

### A16 — studio-ui promotion review · docs

| # | Step |
|---|---|
| 1 | List `@invana-studio/ui` components imported by two or more products |
| 2 | Write the candidates into `docs/for-developers/building-studio/design-kit-coverage.md` as kit work; do not move code in this session |

---

## R00 — review fixtures · `change`

| | |
|---|---|
| Goal | The design review has data: a chickpea demo Graph beside airways, and every board in `scripts/migration/screen-map.json` reachable with its data |
| Read | `demos/airways/` (how the airways demo loads) · `scripts/migration/screen-map.json` · docs/products/projects.md and datasets.md examples |

| # | Step |
|---|---|
| 1 | `demos/chickpea/`: models (Variety, Institute, Trait, Pedigree) and records matching the prototype's examples (JG 11, KAK 2, ICC 4958 …), loadable with today's CLI (`invana models import`, `invana records import`) |
| 2 | A load script beside it, like airways', that never runs against a database other than the one it is pointed at |
| 3 | Fill `state` in `screen-map.json` for boards that need a dialog open or a variant (how to reach each) |

| Exit check | `chickpea` appears in `/graphs`; `python3 scripts/migration/screen_map.py` maps every board |
|---|---|

## Track B · Engine

Every B session starts the same way.

| # | Step |
|---|---|
| 0a | Add the feature row to `docs/for-developers/README.md` and its feature file (user story, capabilities, seams, engine shapes, Not building) — `CLAUDE.md` scope rule |
| 0b | Read the matching product doc section in `docs/products/` and the relevant `orchestration.md` / `terminology.md` sections |
| end | Few positive and negative tests against a real graph database — run only if the prompt allows; a changeset; OpenAPI tag for the product area |

| ID | Prerequisite | Engine work | Read first |
|---|---|---|---|
| B01 | P-09 Change log | Version + diff + effect-after for versioned records; history routes | `terminology.md` versioned records; [shell.md › Decisions](shell.md#decisions) |
| B02 | P-11 · P-15 · P-17 Generated plans, drafts, evals, pinned models | instructions.md storage on skills, agents, schedules; drafts; eval sets (rule checks, labelled judge, promote from real asks); hard-check publish gate; drift re-runs on triggers + nightly; token eval budget; model versions pinned per agent/skill/judge and recorded per run; re-run on same versions; regenerate TaskPlan on publish; rollback; retire user-authored plans, add origin `packaged` | `orchestration.md` §0, §0.11; [agents.md › Instructions → plan](agents.md#instructions--plan) |
| B03 | P-08 Datasets | Dataset record, origin, author chain, licence, sensitivity labels, versions + hash, refresh schedule, retraction + downstream flags, install scope, record change log, bind to model | [datasets.md](datasets.md) |
| B04 | P-12 Rules & standards | Standard record + conformance; rule scope `install`; block/warn/report | [datasets.md › Standards and checks](datasets.md#standards-and-checks); [modeller.md › Govern](modeller.md#govern-four-kinds-of-bound) |
| B05 | P-10 · P-14 Project records | Project type, Branch, Finding with stance, Verdict, Decision (append-only, supersede), Proposal, Report versions, merge; rule checks on decide; per-project access | [projects.md](projects.md) |
| B06a | P-01 Plugins module (move) | `engine/src/invana/plugins/` per [plugins.md](plugins.md): `sdk/` (manifests, context, errors), `registry.py`, the seven core plugins moved from `runtime/catalogue/` with `plugin.yaml` + `tasks/<name>/manifest.yaml` + `run.py`, today's built-in flows as packaged flows, `runtime/catalogue/__init__.py` becomes a re-export (the move: keys unchanged, no behaviour change, all tests green); then, as a separate commit, `task_version` recorded on every Task (one additive migration) | [plugins.md](plugins.md) §2–§6 · `runtime/catalogue/` |
| B06b | P-01 · P-03 · P-04 · P-05 Tool plugins | `tools/web`, `tools/mail`, `tools/science` as optional extras; composite task types and skills as plugin contributions; Admin enable/disable; registry API for Agents › Plugins; tool plugins run in workers | [plugins.md](plugins.md) §4, §9 · [agents.md](agents.md) AG-13 |
| B07 | P-02 MCP | MCP client → an `mcp` plugin whose task types are the server's tools, frozen at enable time | [plugins.md](plugins.md) §2 · [agents.md](agents.md) AG-13 |
| B08 | P-13 Notifications & delivery | Notification rules, channels, schedule delivery, approvals inbox with deadlines and reminders, missed-firing policy |
| B11 | P-18 Roles and access | Graph roles and install Admin; enforce on every route; search filtered by access; per-project access joins B05 | [shell.md › Decisions](shell.md#decisions) |
| B12 | P-19 Semantic imports | SKOS → standard; RDFS/OWL subset + schema.org → draft model; parsers for JSON-LD, Turtle, RDF/XML; import report | [modeller.md › Decisions](modeller.md#decisions) · [datasets.md › Decisions](datasets.md#decisions) |
| B13 | P-20 Intent-ranked templates | Add `prefer` to the intent classifier's tool schema; rank in `select_template` by intent kind + `prefer`; keep the schema prompt-cached | `engine/src/invana/apps/llm/intent.py` · `runtime/projections.py` · [explorer.md › Decisions](explorer.md#decisions) |
| B14 | P-21 Distributed execution | On top of B06a's plugins module, introduce `TaskEnvelope` and `worker.run_envelope()` (context rebuilt from ids; idempotency key per attempt); then run the same workload on procrastinate, Dramatiq and Prefect with **1, 3 and 9 workers** (fan-out of 200 `graph.query` lanes + LLM steps, a worker killed mid-run); record tasks per second and how it scales with workers, p95 dispatch latency, recovery, ops cost; write the choice into a feature file | [plugins.md › Ready for N workers](plugins.md#7-ready-for-n-workers) · `orchestration.md` §5.1 · `runtime/executor.py` |
| B10 | P-16 Breaking-publish review | Classify a model change as additive or breaking; migration run with preview; approval before it runs | [modeller.md › Decisions](modeller.md#decisions) | [shell.md › Activity](shell.md#activity) |
| B09 | P-06 · P-07 Simulation | Post-1.0. Runtime and simulator plugin contract | [projects.md](projects.md) PJ-09 |

## Track C · New product UI

Every C session builds the stories' boards from the prototype, one story at a time, with an e2e spec per story.

| ID | Builds (stories) | Needs |
|---|---|---|
| C01 | Datasets DS-01…DS-12, DS-14 | A14, B03, B04 |
| C02 | Projects PJ-02 types + visibility, PJ-04…PJ-08, PJ-11, PJ-13, PJ-14; Explorer EX-12 | A12, B05 |
| C03 | Agents AG-04, AG-06, AG-08 (drafts, evals), AG-09, AG-11 revisions, AG-13 Plugins registry (plugin, task type, manifest, versions), AG-14 (pinned model versions) | A11, B02, B06a |
| C04 | Shared SH-14 changes and compare; MO-09; DS-04; MO-05 breaking publish (needs B10) | A08, B01 |
| C05 | Shared SH-13, SH-15, SH-16 | A15, B08 |
| C06 | Projects PJ-09, PJ-10 | B09 |
| C07 | Roles and access: SH-20 read-only views, MO-14 members and roles, ⌘K filtered by access, private projects (PJ-02) | A15, B11 |
| C08 | Semantic imports: DS-15 SKOS → standard, MO-15 ontology → draft model | C01, A10b, B12 |
| C09 | Runs and sharing: SH-18 re-run on same or current versions, EX-15 share as live link or frozen snapshot | A09, A08, B02 |

---

## Log

Statuses: `pending` · `in progress` · `partial` · `blocked` · `done`.

| ID | Phase | Kind | Needs | Branch | Status | Date | Notes |
|---|---|---|---|---|---|---|---|
| R00 | 0 | change | — | `refactor/studio-phase-0` | done | 2026-10-11 | gates green · design review passed |
| A00 | 0 | change | — | `refactor/studio-phase-0` | pending | | |
| A01 | 1 | move | A00 | `refactor/studio-phase-1` | pending | | |
| A02 | 2 | move | A01 | `refactor/studio-phase-2` | pending | | |
| A03 | 2 | move | A02 | `refactor/studio-phase-2` | pending | | |
| A04 | 2 | change | A03 | `refactor/studio-phase-2` | pending | | |
| A05 | 3 | move+change | A04 | `refactor/studio-phase-3` | pending | | |
| A06 | 3 | change | A05 | `refactor/studio-phase-3` | pending | | |
| A07a | 4 | move | A06 | `refactor/studio-phase-4` | pending | | |
| A07b | 4 | change | A07a | `refactor/studio-phase-4` | pending | | |
| A08 | 4 | move+change | A07b | `refactor/studio-phase-4` | pending | | |
| A09 | 5 | move+change | A08 | `refactor/studio-phase-5` | pending | | |
| A10a | 5 | move | A08 | `refactor/studio-phase-5` | pending | | |
| A10b | 5 | move+change | A10a | `refactor/studio-phase-5` | pending | | |
| A11 | 5 | move+change | A08 | `refactor/studio-phase-5` | pending | | |
| A12 | 5 | move+change | A08 | `refactor/studio-phase-5` | pending | | |
| A13 | 6 | change | A09, A10b, A11, A12 | `refactor/studio-phase-6` | pending | | |
| A14 | 7 | change | A13 | `refactor/studio-phase-7` | pending | | |
| A15 | 7 | change | A13 | `refactor/studio-phase-7` | pending | | |
| A16 | 7 | docs | A13 | `refactor/studio-phase-7` | pending | | |
| B01 | 8 | change | A04 | `feat/engine-change-log` | pending | | |
| B02 | 8 | change | B01 | `feat/engine-generated-plans` | pending | | |
| B03 | 8 | change | B02 | `feat/engine-datasets` | pending | | |
| B04 | 8 | change | B03 | `feat/engine-standards` | pending | | |
| B05 | 8 | change | B11 | `feat/engine-projects` | pending | | |
| B06a | 8 | move+change | A04 | `feat/engine-plugins-module` | pending | | no behaviour change; before B14 |
| B06b | 8 | change | B14 | `feat/engine-tool-plugins` | pending | | tools run in workers |
| B07 | 8 | change | B06b | `feat/engine-mcp` | pending | | |
| B08 | 8 | change | B05 | `feat/engine-notifications` | pending | | |
| B09 | 8 | change | B08 | `feat/engine-simulation` | pending | | post-1.0 |
| B10 | 8 | change | B08 | `feat/engine-model-publish-review` | pending | | |
| B11 | 8 | change | B04 | `feat/engine-roles` | pending | | before B05 and B10, which use roles |
| B12 | 8 | change | B04 | `feat/engine-semantic-imports` | pending | | SKOS first, then OWL/RDFS |
| B13 | 8 | change | A04 | `feat/engine-intent-ranked-templates` | pending | | small; any time |
| B14 | 8 | change | B06a | `spike/engine-executor` | pending | | before B06b runs tools in workers |
| C01 | 9 | change | A14, B03, B04, R00 | `feat/studio-datasets` | pending | | |
| C02 | 9 | change | A12, B05, R00 | `feat/studio-projects` | pending | | |
| C03 | 9 | change | A11, B02, B06a, R00 | `feat/studio-agents-instructions` | pending | | tool plugins appear as B06b lands |
| C04 | 9 | change | A08, B01, R00 | `feat/studio-change-log` | pending | | |
| C05 | 9 | change | A15, B08, R00 | `feat/studio-schedules-notifications` | pending | | |
| C06 | 9 | change | B09, R00 | `feat/studio-simulation` | pending | | post-1.0 |
| C07 | 9 | change | A15, B11, R00 | `feat/studio-roles` | pending | | |
| C08 | 9 | change | C01, A10b, B12, R00 | `feat/studio-semantic-imports` | pending | | SKOS first |
| C09 | 9 | change | A09, A08, B02, R00 | `feat/studio-rerun-and-share` | pending | | |

## Hand-off notes

One block per finished session, newest first. What a later session must know that the code does not say.

| Session | Date | Note |
|---|---|---|
| R00 | 2026-10-11 | **Done.** Ran the *To unblock* load against `invana-chickpea-neo4j` (already up): Chickpea 1.0.0 published, 52 of 52 records written, 3 projects and 5 todos — re-runnable, it merges. `chickpea` shows in Studio's `/graphs` (checked with a signed-in throwaway spec, since deleted). `screen_map.py`: 157 boards mapped, 128 with state. The studio gates now compare against `scripts/migration/baseline.json`, which already lists the e2e failures and knip's `touchKey` from the fix attempts below, so they are not R00's; the fixes those notes name (runner `E2E_GRAPH_PATH`, `zz-verify-*` data and locators, `touchKey`'s export) still need an owner. The chickpea container is not in `docker compose` — after a machine restart, start it again before a design review |
| R00 | 2026-10-11 | **Fix attempt 1 — nothing fixed; both gate failures predate R00 and sit outside its scope.** R00 changes no file under `studio/` (diff: `demos/chickpea/`, `scripts/migration/`, this doc), so the studio gates read the branch's committed code. `pnpm knip`: `touchKey` in `studio/src/pages/graphs-detail/features/lenses/runLayers.ts:72` is exported but only used in that file — drop the `export` (from c7be2be2, not R00); owner: whichever session next touches studio, or a one-line `chore(studio)` before A01. `pnpm test:e2e`: re-run, the same 14 fail / 35 pass as the driver saw. They need dev data and a graph path, not R00 code — `explorer.ts` defaults to `/u/admin/air-routes-graph`, which this stack lacks (set `E2E_GRAPH_PATH=/u/admin/airways`), and the `zz-verify-*` specs want a run for "How many airports are there?", Reports and model boards in the dev DB. The runner's e2e gate should set `E2E_GRAPH_PATH` and seed or skip the `zz-verify-*` specs — runner work, not R00. R00 itself stays `blocked` on the chickpea database below |
| R00 | 2026-10-11 | **Fix attempt 2 — knip fixed; e2e not, it is outside R00.** `touchKey` in `studio/src/pages/graphs-detail/features/lenses/runLayers.ts` is no longer exported (used only in that file; no behaviour change) — `pnpm knip` now passes. `pnpm test:e2e` re-run: same 14 fail / 35 pass, and R00 still changes no other file under `studio/`. Two causes, neither is R00 code: (a) **spec drift from c7be2be2** (design-kit 0.0.33) — icon-only buttons now have accessible names, so non-exact locators like `getByRole("button", { name: "Models" })` in `zz-verify-models-stack.spec.ts` hit 3 buttons (`Models 0`, `Starter models`, `Search models`); fix with `exact: true` or a regex anchored on the drawer header; (b) **missing dev data and graph path** — `explorer.ts` defaults to `/u/admin/air-routes-graph`, the models stack shows `Models 0`, and `zz-verify-pass` wants a run for "How many airports are there?" and Reports in the dev DB. Owner: a `chore(studio)` e2e fix before A01, and the runner's e2e gate (`run.py`) setting `E2E_GRAPH_PATH=/u/admin/airways` — the `E2E_GRAPH_PATH` re-run here needed an approval this unattended run could not get. Until then the e2e gate fails every studio session, not just R00 |
| R00 | 2026-10-11 | **Fix attempt 3 — nothing fixed; e2e is still outside R00, and the cause is now confirmed from the page.** Re-ran `answer-surface` + `explorer` specs: 6 fail / 1 pass, same as the driver. The failure snapshot shows the cause: the page opens `/u/admin/air-routes-graph` (`explorer.ts` default), which reads `NO CONNECTION`, and the status bar reads `API is down — reconnecting…`. So no ask can run, and every spec that asks a question or wants a run, a report or a model board fails. Nothing in R00's diff touches this: the only studio change is dropping `touchKey`'s `export`. Running with `E2E_GRAPH_PATH=/u/admin/airways` again needed an approval this unattended run could not get. **Do not run R00 a fourth time for this gate.** It needs, outside R00: (1) `run.py`'s e2e gate sets `E2E_GRAPH_PATH=/u/admin/airways` and checks the engine API is up before Playwright starts; (2) a `chore(studio)` that seeds or skips the `zz-verify-*` specs' dev data ("How many airports are there?" run, Reports, model boards) and fixes the non-exact locators that design-kit 0.0.33 broke (see attempt 2) |
| R00 | 2026-10-11 | **To unblock:** `docker run -d --name invana-chickpea-neo4j -p 37687:7687 -e NEO4J_AUTH=neo4j/chickpea-demo neo4j:5-community`, then `uv run --project engine --extra all python demos/chickpea/load.py --graph admin/chickpea --uri bolt://host.docker.internal:37687 --db-user neo4j --db-password chickpea-demo` from the repo root; then `chickpea` is in `/graphs`. **Own database, on purpose:** two Graphs on one Neo4j community database see each other's records; `invana-neo4j` is airways', `invana-migration-neo4j` is flushed by engine tests, so neither can hold chickpea. `load.py` refuses a URI another Graph already uses and an existing Graph on a different URI (both checked live against airways, before any write). **No CLI creates a Graph or publishes a model** — `load.py` does both through `GraphManager` and `Versioner.activate`, the rest through `invana models import` / `records import`. Connector is `invana_neo4j.connector.Neo4jConnector`, as airways uses. **Screen map:** `state` lives in `STATE` in `screen_map.py`; re-running it no longer wipes the field, and it exits non-zero when a variant board has none. Two route fixes: `shell.runs` → the runs list (it matched `shell.run` and landed on a run), `projects.new` → the projects list. Run ids are UUIDs, so `15`, `routes-out-of-lhr`, `analyst` and `answer-nl` in routes are stand-ins; each board's state names what to open. **Data gaps a later session fills:** `modeller.model.history` shows one version until B01; datasets, project branches, findings and decisions need B03/B05; the `Chickpea` model publishes as 1.0.0, not the prototype's v3. Chickpea values follow the prototype (KAK 2 and Vijay `tolerant` → `moderately resistant`, the model's enum); the README says it is a demo, not a release list |
