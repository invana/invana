---
name: m3-code
status: abandoned
branch: chore/m3-code
scope: m3-code
---

# M3 code — one name across layers, in the code

Carries the M3 spec restructure into the code. The code drops what no story serves, stops citing the removed
`docs/for-developers/`, and renames every engine module, table, route, action, event and Studio package to the one
package name in `specs/system-design/architecture.md` › *One name across layers*. Connectors move into `runtime` and
register by entry point. For everyone who builds, checks and reads Invana's code.

| | |
|---|---|
| Goal | Every `docs/for-developers` citation in code, tests, config and demos points at a live spec (never `specs/_stale/`) · `mail` and `science` plugins deleted · no projects ↔ agents import cycle · the packages `access` · `graphs` · `model` · `explore` · `datasets` · `projects` · `agents` · `runtime` hold their code in every layer, with no alias · connectors live in `runtime/connectors` and register under the `invana.connectors` entry-point group · RT-F05 specified · module spec files, glossary, Studio specs and `docs/` use the package names · spec tooling tested in pre-commit |
| Specs | RT-F05 Graph database connectors (written in D02) · `specs/system-design/architecture.md` › *One name across layers* · recommendations R102 · R103 · R109 · R113 · R114 · R117 · R118 · R119 · R120 · R122 · R123 · R125 · R128 · R129 · R131 · R133 |
| Not in this project | S01 and S02 (Q7) · R121, canvas bodies in `studio/packages/canvases` (Q11) · removing `starlette-admin` (Q5, a recommendation) · an engine module for `data` (Q4) · the `/api/v1/u/{u}/{g}` route scope (Q1) · released changesets (Q12) · team files — `CLAUDE.md`, `engine/CLAUDE.md`, `CONTRIBUTING.md`, `.claude/**` (R132, Ravi's own edit) · `.env.example` (no role's edit rights; a recommendation) · drawing boards · aliases or shims for any old name |

Run it: `python3 .claude/skills/run-project/run.py m3-code` (the project-lead does, with `--start`). Cut
`chore/m3-code` from `chore/remove-for-developers`: start the runner on `chore/remove-for-developers` and it creates
`chore/m3-code` there, then stacks each phase on its own `m3-code/<ID>-<slug>` branch. Ravi reviews the stacked
branches at the end; no phase pauses for approval.

## Rules for every session

| Rule | Detail |
|---|---|
| Full auto | No phase waits for a person. Every question is settled in *Questions for Ravi* (all approved as recommended). A point they do not settle is decided by the option closest to `architecture.md` and the rules here, and written as a hand-off note — never a `blocked` row |
| The map governs | From D01, `specs/system-design/architecture.md` › *One name across layers* holds the old → new name of every engine module, table, route tail, access action, event, Studio package and Studio route. A rename phase follows it; a row that turns out wrong is a hand-off note and the nearest correct name, never a silent second spelling |
| The citation map governs | From D04, `.agent-reports/product-manager/m3-code/citation-map.md` says where each `docs/for-developers/...` path now points. A citation it does not cover takes its area's fallback row |
| Team files are Ravi's | `CLAUDE.md`, `engine/CLAUDE.md`, `CONTRIBUTING.md` and `.claude/**` are never edited by a phase and never block one. A stale cite in one of them is skipped; every guard excludes them |
| Edit rights hold | A file outside the phase agent's rights (`.env.example`, a spec for the coder, code for the product-manager) is skipped and raised with the `recommend` skill, never a blocker |
| Specs never link into code | Specs and docs name code paths in code spans, never as markdown links, so a rename never breaks `links.py` |
| No aliases | Rename and delete outright: no re-export, redirect, old route, old table, old event name or old Studio package kept. Capabilities and the airways demo data keep working |
| Rename standard | Engine code under `engine/src/invana/<pkg>/` (`git mv`) · tables `<pkg>_<records>` by one Alembic migration that renames and keeps the data, its upgrade and downgrade both run on the dev DB with `docker compose run --rm engine-migrate` · API tail `/api/v1/u/{u}/{g}/<pkg>/<records>` · access actions and events `<pkg>.<records>.<verb>` / `.<event>` · Studio package `@invana-studio/<pkg>`, its routes under the kept `/u/:user/:graph` scope, and its `docker-compose.yml` node_modules volume renamed · imports, tests, e2e specs and `screen-map.json` routes follow · one changeset per phase |
| Golden files | `uv run python -m tests.golden.update` rewrites all three from the whole tree: keep this phase's diff, revert anything else |
| Graph tests are isolated | Graph-database tests run only on the isolated Neo4j `invana-migration-neo4j` at `bolt://localhost:27687` (the *Environment* table sets it). Never the developer's Neo4j on `:7687`, whose data the fixtures would flush. A test this phase touches that connects to a hard-coded `:7687` reads `NEO4J_URI` instead |
| Restore point | Before C02's build the runner tags `m3-code/C02-start`; the C02 *Setup* row copies it to the local tag `pre-m3-code`. Never pushed |
| Budget ceiling | A session hands off at its phase's *Budget*: 400k for R04, R05a, R05b and C05a; 300k for every other phase. Past it, hand off — never cut scope. Why 400k: C05a repoints 331 files and the golden files together; R04 moves about 60 engine and 89 Studio files; R05a about 130 engine files with the run engine; R05b about 200 Studio files. Split, the tree does not compile between sessions |

## Environment

| Name | Value |
|---|---|
| `INVANA_TELEMETRY_ENABLED` | `false` |
| `INVANA_ALLOW_GRAPH_TESTS` | `1` |
| `INVANA_ALL` | `1` |
| `NEO4J_URI` | `bolt://localhost:27687` |
| `NEO4J_HOST` | `localhost` |
| `NEO4J_PORT` | `27687` |
| `NEO4J_USERNAME` | `neo4j` |
| `NEO4J_PASSWORD` | `testpassword` |
| `E2E_GRAPH_PATH` | `/u/admin/airways` |

## Setup

Run in this order before each gate round. `setup.py demo-data` strips the `NEO4J_*` settings, so the airways import
writes to the developer's Graph, never the isolated one.

| Step | Command | In | Phases |
|---|---|---|---|
| restore tag | `sh -c 'git rev-parse -q --verify refs/tags/pre-m3-code >/dev/null && exit 0; git tag pre-m3-code m3-code/C02-start'` | `.` | C02 |
| isolated neo4j | `sh -c 'docker start invana-migration-neo4j >/dev/null 2>&1 && exit 0; docker run -d --name invana-migration-neo4j -p 27687:7687 -e NEO4J_AUTH=neo4j/testpassword neo4j:5-community'` | `.` | C02, C03, C05a, C05b, R*, C04 |
| isolated neo4j ready | `sh -c 'for i in $(seq 1 40); do docker exec invana-migration-neo4j cypher-shell -u neo4j -p testpassword "RETURN 1" >/dev/null 2>&1 && exit 0; sleep 3; done; exit 1'` | `.` | C02, C03, C05a, C05b, R*, C04 |
| dev DB migrate | `docker compose run --rm engine-migrate` | `.` | C02, R* |
| engine restart | `docker compose restart engine` | `.` | C02, R* |
| studio deps | `docker compose run --rm --no-deps -T studio pnpm install` | `.` | C02, R* |
| studio restart | `docker compose up -d --force-recreate --no-deps studio` | `.` | C02, R* |
| stack | `python3 .claude/skills/run-project/setup.py stack` | `.` | C02, R* |
| demo data | `python3 .claude/skills/run-project/setup.py demo-data` | `.` | C02, R* |

## Gates

*Known failures*: `e2e-known.json` in this folder, written by the project-lead from a run on untouched code; until it
exists the set is empty.

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| spec check | `python3 scripts/specs/check.py` | `.` | all | |
| links | `python3 scripts/specs/links.py specs docs` | `.` | all | |
| spec tooling tests | `python3 -m unittest discover -s scripts/specs` | `.` | all | |
| module spec names | `python3 -c "import pathlib,sys; P=('graphs','access','runtime','model','data','datasets','agents','explore','projects'); bad=[f.name for f in pathlib.Path('specs/system-design/modules').glob('*.md') if f.stem.split('-')[0] not in P]; print(bad); sys.exit(1 if bad else 0)"` | `.` | all | |
| openapi.yaml gone | `test -z "$(git ls-files docs/api/openapi.yaml)"` | `.` | D01 | |
| citation map resolves | `python3 scripts/specs/links.py .agent-reports/product-manager/m3-code/citation-map.md` | `.` | D04 | |
| citation map never stale | `! grep -F -e _stale/ .agent-reports/product-manager/m3-code/citation-map.md` | `.` | D04 | |
| glossary and canvases | `sh -c 'grep -q "Onboarding wizard" specs/glossary.md && grep -q "Personal access token" specs/glossary.md && grep -q "^## .*Design canvases" specs/design-language.md'` | `.` | D05 | |
| studio specs retired words | `! grep -rIlw -e Operate -e Modeller -e Govern specs/system-design/studio` | `.` | D06, D03 | |
| RT-F05 has no boards | `sh -c 'grep -q "^boards: \[\]" specs/os/runtime/features/RT-F05-*/feature.md'` | `.` | D02 | |
| spec tooling in pre-commit | `grep -q "unittest discover -s scripts/specs" .pre-commit-config.yaml` | `.` | C01 | |
| plugins deleted | `test -z "$(git ls-files engine/src/invana/plugins/tools/mail engine/src/invana/plugins/tools/science)"` | `.` | C02 | |
| for-developers · engine src | `! grep -rIl --exclude-dir=__pycache__ -F docs/for-developers engine/src engine/tests/golden` | `.` | C05a | |
| for-developers · engine and config | `! grep -rIl --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=dist --exclude-dir=__pycache__ --exclude-dir=.pytest_cache --exclude=CLAUDE.md --exclude=CONTRIBUTING.md -F docs/for-developers engine integrations scripts demos docker .github docker-compose.yml pyproject.toml .pre-commit-config.yaml` | `.` | C05b, C05c, R*, C04, D03 | |
| for-developers · studio | `! grep -rIl --exclude-dir=node_modules --exclude-dir=dist --exclude=CLAUDE.md -F docs/for-developers studio` | `.` | C05c, R*, C04, D03 | |
| old names · access | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/iam engine/src/invana/apps/govern engine/src/invana/server/iam engine/src/invana/server/govern studio/packages/iam)" && test -n "$(git ls-files engine/src/invana/access)" && ! grep -rIlFw --exclude-dir=node_modules --exclude-dir=__pycache__ -e invana.apps.iam -e invana.apps.govern -e invana.server.iam -e invana.server.govern -e @invana-studio/iam engine/src engine/tests studio/apps studio/packages'` | `.` | R*, C04 | |
| old names · graphs | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/graphs engine/src/invana/apps/setup engine/src/invana/server/graphs)" && test -n "$(git ls-files engine/src/invana/graphs)" && ! grep -rIlFw --exclude-dir=__pycache__ -e invana.apps.graphs -e invana.apps.setup -e invana.server.graphs engine/src engine/tests'` | `.` | R02, R04, R06, R08, R09, R05a, R05b, R03a, R03b, C04 | |
| old names · model | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/modeller engine/src/invana/apps/semantic engine/src/invana/apps/standards engine/src/invana/server/modeller engine/src/invana/server/standards studio/packages/modeller)" && test -n "$(git ls-files engine/src/invana/model)" && ! grep -rIlFw --exclude-dir=node_modules --exclude-dir=__pycache__ -e invana.apps.modeller -e invana.apps.semantic -e invana.apps.standards -e invana.server.modeller -e invana.server.standards -e @invana-studio/modeller engine/src engine/tests studio/apps studio/packages'` | `.` | R04, R06, R08, R09, R05a, R05b, R03a, R03b, C04 | |
| old names · explore | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/explorer engine/src/invana/apps/boards engine/src/invana/apps/annotations engine/src/invana/server/explorer engine/src/invana/server/boards engine/src/invana/server/annotations studio/packages/explorer)" && test -n "$(git ls-files engine/src/invana/explore)" && ! grep -rIlFw --exclude-dir=node_modules --exclude-dir=__pycache__ -e invana.apps.explorer -e invana.apps.boards -e invana.apps.annotations -e invana.server.explorer -e invana.server.boards -e invana.server.annotations -e @invana-studio/explorer engine/src engine/tests studio/apps studio/packages'` | `.` | R06, R08, R09, R05a, R05b, R03a, R03b, C04 | |
| old names · datasets | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/datasets engine/src/invana/server/datasets)" && test -n "$(git ls-files engine/src/invana/datasets)" && ! grep -rIlFw --exclude-dir=__pycache__ -e invana.apps.datasets -e invana.server.datasets engine/src engine/tests'` | `.` | R08, R09, R05a, R05b, R03a, R03b, C04 | |
| old names · projects | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/work engine/src/invana/server/work)" && test -n "$(git ls-files engine/src/invana/projects)" && ! grep -rIlFw --exclude-dir=__pycache__ -e invana.apps.work -e invana.server.work engine/src engine/tests'` | `.` | R09, R05a, R05b, R03a, R03b, C04 | |
| old names · agents engine | `sh -c 'test -z "$(git ls-files engine/src/invana/apps/agents engine/src/invana/apps/skills engine/src/invana/apps/flows engine/src/invana/apps/sessions engine/src/invana/apps/llm engine/src/invana/server/agents engine/src/invana/server/skills engine/src/invana/server/flows engine/src/invana/server/sessions)" && test -n "$(git ls-files engine/src/invana/agents)" && ! grep -rIlFw --exclude-dir=__pycache__ -e invana.apps.agents -e invana.apps.skills -e invana.apps.flows -e invana.apps.sessions -e invana.apps.llm -e invana.server.agents -e invana.server.skills -e invana.server.flows -e invana.server.sessions engine/src engine/tests'` | `.` | R05a, R05b, R03a, R03b, C04 | |
| run engine out of runtime | `test -z "$(git ls-files engine/src/invana/runtime)"` | `.` | R05a, R05b | |
| old names · assistant | `sh -c 'test -z "$(git ls-files studio/packages/assistant)" && ! grep -rIlFw --exclude-dir=node_modules -e @invana-studio/assistant studio/apps studio/packages'` | `.` | R05b, R03a, R03b, C04 | |
| old names · connectors | `sh -c 'test -z "$(git ls-files engine/src/invana/graph/connectors)" && test -n "$(git ls-files engine/src/invana/runtime/connectors)" && ! grep -rIlFw --exclude-dir=__pycache__ --exclude-dir=.venv -e invana.graph.connectors engine/src engine/tests integrations'` | `.` | R03a, R03b, C04 | |
| old names · runtime | `sh -c 'test -z "$(git ls-files engine/src/invana/apps engine/src/invana/server/workers engine/src/invana/server/llm_providers engine/src/invana/server/mcp_server)" && ! grep -rIlFw --exclude-dir=__pycache__ -e invana.apps engine/src engine/tests'` | `.` | R03b, C04 | |
| connector entry points | `sh -c 'for d in integrations/invana-*; do grep -q "invana.connectors" "$d/pyproject.toml" && continue; echo "$d registers no invana.connectors entry point"; exit 1; done'` | `.` | C04 | |
| engine lint | `uv run ruff check .` | `engine` | C02, C03, C05a, C05b, R*, C04 | |
| engine import contracts | `uv run lint-imports` | `engine` | C03, C05a, C05b, R*, C04 | |
| engine tests | `uv run pytest -q` | `engine` | C02, C03, C05a, C05b, R*, C04 | |
| studio lint | `pnpm lint` | `studio` | C02, C05c, R* | |
| studio types | `pnpm check-types` | `studio` | C02, C05c, R* | |
| studio tests | `pnpm test` | `studio` | C02, C05c, R* | |
| studio build | `pnpm build` | `studio` | C02, R* | |
| studio e2e | `pnpm test:e2e --reporter=line` | `studio/apps/studio` | C02, R* | `e2e-known.json` |
| integrations tests | `uv run pytest -q` | `integrations/invana-neo4j` | R03a, R03b, C04 | |
| docs build | `make docs-build` | `.` | D01, D03 | |

## Phases

### D01 · Rename map and module spec names

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/architecture.md` · `specs/system-design/modules/*.md` · `.agent-reports/qa/specs-m3-audit.md` · recommendations R117 · R118 · R119 · R122 · R124 · R131 · this file's *Questions for Ravi* · `.claude/skills/product-spec/SKILL.md` |
| Stories | — |
| Done when | `architecture.md` › *One name across layers* holds an old → new table for every engine module under `apps/`, `server/`, `runtime/` and `graph/`, every app-DB table, every route tail, access action, event, Studio package and Studio route — naming the phase (R01–R09, R03a/b, R05a/b) that renames it · the API row reads `/api/v1/u/{u}/{g}/<pkg>/<records>` and the Studio route row `/u/:user/:graph/<pkg>/<records>` (Q1) · `graph_query_log` → `model` (Q2) · `projects` records `tasks`; plan-library tasks → `agents_plan_steps` (Q6) · AI models `llms` · every file in `specs/system-design/modules/` is named `<package>.md` or `<package>-<topic>.md` (R131) and every inbound link follows · `mail` and `science` move to *Deleted* in `specs/_stale/code.md` (Q3) · `docs/api/openapi.yaml` is deleted and `specs/vision.md` names `engine/tests/golden/openapi.json` instead (R122) · the module spec, architecture and docs gates pass |
| Lands | `specs/system-design/architecture.md` · `specs/system-design/modules/*` · `specs/_stale/code.md` · `specs/vision.md` · `docs/api/openapi.yaml` (deleted) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. List every engine module, table (from `engine/tests/golden/schema.models.sql`), route, action, event and Studio package. 2. Write the old → new table with the phase for each. 3. Rename the module spec files and repoint their links. 4. `code.md`, `vision.md`, delete `openapi.yaml`. 5. Check, links, docs build |

### D04 · Citation map

| | |
|---|---|
| Agent | product-manager |
| Read | `.agent-reports/product-manager/for-developers-citations.md` · `specs/_stale/docs/for-developers/` (only to learn what each old path covered) · `specs/README.md` · `specs/system-design/**` · `specs/glossary.md` |
| Stories | — |
| Done when | `.agent-reports/product-manager/m3-code/citation-map.md` holds one row per old path cited in code — each of the 122 `modules/**` files, every `building-*` file and every other `docs/for-developers/...` path found by `grep -rIl docs/for-developers engine studio integrations scripts demos docker .github` — with its target as a markdown link to a live story, feature, `specs/system-design/**` file or glossary anchor · one fallback row per top-level old folder (`modules/<module>/**`, `building-engine/**`, `building-studio/**`) so every citation matches a row · no target under `specs/_stale/` · the map's links resolve |
| Lands | `.agent-reports/product-manager/m3-code/citation-map.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Grep every cited old path. 2. Read what each covered. 3. Pick its live target. 4. Fallback rows. 5. Links |

### D05 · Glossary and design canvases

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/glossary.md` · `specs/design-language.md` · `.agent-reports/product-manager/for-developers-citations.md` (the design-canvases row) |
| Stories | — |
| Done when | `specs/glossary.md` defines **Onboarding wizard** and **Personal access token** · the *Wizard* rows in *Words not used* and *Not on screen*, the *Key* row (screen word PAT, not Key) and the *Service account* row agree with them · no row bans a term another row defines · `specs/design-language.md` has a *Design canvases* section, the one list of canvases |
| Lands | `specs/glossary.md` · `specs/design-language.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Fix the rows. 2. Write the canvases section. 3. Check and links |

### D06 · Studio specs in package names

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/system-design/studio/*.md` · the D01 table in `architecture.md` |
| Stories | — |
| Done when | The five files in `specs/system-design/studio/` use package names: no `Operate`, `Modeller` or `Govern` as a word · each spec path is a markdown link that resolves · each code path is a code span in the package's new name |
| Lands | `specs/system-design/studio/*.md` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Replace the retired names from the D01 table. 2. Turn spec paths into links, code paths into code spans. 3. Check and links |

### D02 · RT-F05 Graph database connectors

| | |
|---|---|
| Agent | product-manager |
| Read | `specs/os/runtime/` · `specs/system-design/integrations.md` · the D01-renamed connectors module spec · recommendations R114 · R125 · `.claude/skills/product-spec/SKILL.md` · `format.md` |
| Stories | The RT-F05 stories this phase writes |
| Done when | `specs/os/runtime/features/RT-F05-*/feature.md` and its stories, each a folder with `story.md` (five parts, *Who can* for Admin and Operator) and an empty `task.md` · connectors live in `runtime/connectors` and register under the `invana.connectors` entry-point group, loaded by name, never by dotted path · `boards: []` and every `## Screens` cell `—` (an act needing a board is a *Not building* row and a recommendation) · stories `specified` — buildable by R03a and C04 (Q10) · the connectors module spec's registration section names the entry-point group (R114) · check and links pass |
| Lands | `specs/os/runtime/features/RT-F05-*/**` · `specs/os/runtime/product.md` · the connectors module spec · `specs/README.md` (regenerated) |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Read what exists. 2. Write the feature and stories from the templates. 3. Rewrite the module spec's registration. 4. Regenerate the index. 5. Check and links |

### C01 · Spec tooling tests

| | |
|---|---|
| Agent | coder |
| Read | `scripts/specs/check.py` · `scripts/specs/test_check.py` · `.pre-commit-config.yaml` · R102 · R103 · R109 |
| Stories | — |
| Done when | `test_check.py` runs a full `main()` over a minimal valid `os/` story tree and returns 0, and one negative case returns 1 (R102) · a pre-commit hook runs `python3 -m unittest discover -s scripts/specs` (R103) · coverage of `scripts/specs` runs with `uv run --with coverage` and is ≥ 80% or the target is recorded in the test module docstring as not applicable (R109) |
| Lands | `scripts/specs/test_check.py` · `.pre-commit-config.yaml` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. The main() tests. 2. The hook. 3. Coverage. 4. Gates |

### C02 · Dead plugins

| | |
|---|---|
| Agent | coder |
| Read | `specs/_stale/code.md` · `engine/src/invana/plugins/` · R119 |
| Stories | — |
| Done when | `engine/src/invana/plugins/tools/mail` and `.../science`, their tests, registry entries and every reference are gone · nothing else in *Deleted* of `specs/_stale/code.md` remains · `server/admin` (starlette-admin) stays (Q5) · the local tag `pre-m3-code` exists · every gate green |
| Lands | `engine/src/invana/plugins/**` · their tests · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Grep every reference. 2. Delete the plugins and their tests. 3. Golden files. 4. Changeset. 5. Gates |

### C03 · One-way projects → agents

| | |
|---|---|
| Agent | coder |
| Read | R123 · `engine/src/invana/apps/work/` · `engine/src/invana/runtime/delegation.py` · `engine/src/invana/plugins/` (work_write) · `engine/pyproject.toml` › `[tool.importlinter]` |
| Stories | — |
| Done when | No module of the agents side (`apps/agents`, `apps/skills`, `apps/flows`, `apps/sessions`, `runtime/`) imports `apps/work`; `apps/work` may import the agents side · an import-linter contract in `engine/pyproject.toml` enforces it and `lint-imports` passes · behaviour unchanged: every gate green |
| Lands | `engine/src/invana/apps/work/**` · `engine/src/invana/runtime/delegation.py` · `engine/src/invana/plugins/**` · `engine/pyproject.toml` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. List the agents → work imports. 2. Invert each (pass in, or move to work). 3. The contract. 4. Gates |

### C05a · Citations in engine source

| | |
|---|---|
| Agent | coder |
| Read | `.agent-reports/product-manager/m3-code/citation-map.md` |
| Stories | — |
| Done when | No file in `engine/src` or `engine/tests/golden` names `docs/for-developers` · each repointed citation names the map's target, never `specs/_stale/` · the golden diff changes docstrings only · every gate green |
| Lands | `engine/src/**` comments and docstrings · `engine/tests/golden/*` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | 400k |
| Steps | 1. Repoint by band: `core`, `server`, `cli`, `activity`, `plugins`, `graph`, `runtime`, `apps`. 2. Golden files. 3. Gates |

### C05b · Citations in tests, config and demos

| | |
|---|---|
| Agent | coder |
| Read | `.agent-reports/product-manager/m3-code/citation-map.md` |
| Stories | — |
| Done when | No file in `engine`, `integrations`, `scripts`, `demos`, `docker`, `.github`, `docker-compose.yml`, `pyproject.toml` or `.pre-commit-config.yaml` names `docs/for-developers` (team files excluded) · unreleased changesets in `.changeset/` repointed; a changeset already in a `CHANGELOG.md` untouched (Q12) · the demo READMEs' links resolve (`python3 scripts/specs/links.py demos`) · `.env.example` raised as a recommendation |
| Lands | `engine/tests/**` · `engine/pyproject.toml` · `.github/workflows/ci.yml` · `.pre-commit-config.yaml` · `docker-compose.yml` · `docker/hyperdx/README.md` · `scripts/**` · `demos/airways/**/README.md` · `.changeset/*.md` |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Tests. 2. Config. 3. Demos. 4. Unreleased changesets. 5. Gates |

### C05c · Citations in Studio

| | |
|---|---|
| Agent | coder |
| Read | `.agent-reports/product-manager/m3-code/citation-map.md` · `specs/system-design/studio/` |
| Stories | — |
| Done when | No file in `studio/` names `docs/for-developers` · `packages/ui` and `packages/canvases` cite `specs/system-design/studio/` · every gate green |
| Lands | `studio/**` comments |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Repoint by package. 2. Gates |

### R01 · access

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R01 rows) · `specs/os/access/` · this file's *Rename standard* |
| Stories | — |
| Done when | `apps/iam`, `apps/govern`, `server/iam`, `server/govern` and `studio/packages/iam` are `access` in every layer, per the *Rename standard* · the access guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/access/**` · its migration and tests · `studio/packages/access/**` · Studio routes · `docker-compose.yml` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Engine move and imports. 2. Migration. 3. Routes, actions, events. 4. Studio package, routes, compose volume. 5. Tests, e2e, golden. 6. Changeset. 7. Gates |

### R02 · graphs

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R02 rows) · `specs/os/graph/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/graphs`, `apps/setup` and `server/graphs` are `graphs` in every layer, per the *Rename standard* · the graphs guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/graphs/**` · its migration and tests · Studio routes and API clients · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | As R01 |

### R04 · model

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R04 rows) · `specs/capabilities/model/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/modeller`, `apps/semantic`, `apps/standards`, `server/modeller`, `server/standards` and `studio/packages/modeller` are `model` in every layer, and `graph_query_log` with `core/querylog.py` moves to `model` (Q2), per the *Rename standard* · the model guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/model/**` · its migration and tests · `studio/packages/model/**` · `docker-compose.yml` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | 400k |
| Steps | As R01 |

### R06 · explore

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R06 rows) · `specs/capabilities/explore/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/explorer`, `apps/boards`, `apps/annotations`, `server/explorer`, `server/boards`, `server/annotations` and `studio/packages/explorer` are `explore` in every layer, per the *Rename standard* · the explore guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/explore/**` · its migration and tests · `studio/packages/explore/**` · `docker-compose.yml` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | As R01 |

### R08 · datasets

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R08 rows) · `specs/capabilities/datasets/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/datasets` and `server/datasets` are `engine/src/invana/datasets`, loaders in `datasets/loads`, tables and routes per the *Rename standard* · the datasets guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/datasets/**` · its migration and tests · `studio/packages/datasets/**` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | As R01 |

### R09 · projects

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R09 rows) · `specs/capabilities/projects/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/work` and `server/work` are `projects`, records `tasks` (`projects_tasks`); plan-library tasks are `agents_plan_steps` (Q6); the parts the D01 table gives to `agents` move there · the projects guard, the C03 import contract and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/projects/**` · its migration and tests · `studio/packages/projects/**` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | As R01 |

### R05a · agents in the engine

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R05a rows) · `specs/capabilities/agents/` · R117 · the *Rename standard* |
| Stories | — |
| Done when | `apps/agents`, `apps/skills`, `apps/flows`, `apps/sessions`, `apps/llm` (as `llms`), their `server/` routers and the run engine `engine/src/invana/runtime/` are `agents` in the engine, per the *Rename standard* · `engine/src/invana/runtime/` holds no tracked file (R117) · the agents guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/agents/**` · its migration and tests · Studio API clients only where routes change · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | 400k |
| Steps | 1. Run engine out of `runtime/`. 2. The `apps/` modules. 3. Routers. 4. Migration. 5. Tests, golden. 6. Changeset. 7. Gates |

### R05b · agents in Studio

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R05b rows) · `specs/capabilities/agents/` · `specs/capabilities/explore/` (the Assistant) · the *Rename standard* |
| Stories | — |
| Done when | `studio/packages/assistant` is gone: its parts live where the D01 table puts them (the Assistant is a feature of `explore`) · `@invana-studio/agents` routes follow the R05a API · the assistant guard and every gate green |
| Lands | `studio/packages/agents/**` · `studio/packages/explore/**` · `docker-compose.yml` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | 400k |
| Steps | 1. Move the assistant's parts. 2. Imports and routes. 3. Compose volume. 4. Tests, e2e. 5. Changeset. 6. Gates |

### R03a · Connectors into runtime

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R03a rows) · RT-F05 (D02) · `integrations/*/` · `.github/workflows/ci.yml` (the *integrations import only* step) |
| Stories | The RT-F05 stories D02 wrote — the coder adds and works its tasks in each `task.md` |
| Done when | `engine/src/invana/graph/connectors` is `engine/src/invana/runtime/connectors` · all six integrations import the new path and the CI import rule names it · the connectors guard, the integrations tests on the isolated Neo4j and every gate green |
| Lands | `engine/src/invana/runtime/connectors/**` · `integrations/*/src/**` · `.github/workflows/ci.yml` · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Move the connectors. 2. Integrations and CI rule. 3. Tests. 4. Changeset. 5. Gates |

### R03b · runtime: workers, LLM providers, MCP server

| | |
|---|---|
| Agent | coder |
| Read | `architecture.md` › *One name across layers* (the R03b rows) · `specs/os/runtime/` · the *Rename standard* |
| Stories | — |
| Done when | `apps/workers`, `apps/llm_providers`, `apps/mcp_server` and their `server/` routers are `runtime` in every layer, per the *Rename standard* · `engine/src/invana/apps/` holds no tracked file · the runtime guard and every gate green · the migration's upgrade and downgrade ran on the dev DB |
| Lands | `engine/src/invana/runtime/**` · its migration and tests · Studio API clients · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | As R01 |

### C04 · Connector entry points

| | |
|---|---|
| Agent | coder |
| Read | RT-F05 (D02) · `specs/system-design/integrations.md` · R125 · `engine/src/invana/runtime/connectors/` |
| Stories | The RT-F05 stories D02 wrote |
| Done when | Each of the six `integrations/*/pyproject.toml` registers its connector under `invana.connectors` · the engine loads a connector by entry-point name, never by dotted path · a positive and a negative engine test (a known and an unknown name) · the entry-point gate, the integrations tests and every gate green |
| Lands | `integrations/*/pyproject.toml` · `engine/src/invana/runtime/connectors/**` · `engine/src/invana/graphs/**` (compatibility) · tests · a changeset |
| Boards | — |
| Review | qa |
| Approve | |
| Budget | |
| Steps | 1. Entry points. 2. Loader by name. 3. Tests. 4. Changeset. 5. Gates |

### D03 · Developer docs in package names

| | |
|---|---|
| Agent | product-manager |
| Read | `docs/**` · `architecture.md` › *One name across layers* · R128 · R129 · R131 · R133 |
| Stories | — |
| Done when | `docs/` names packages, never `Operate`, `Modeller` or `Govern`, and no old module path or `docs/for-developers` · the docs build, links and every guard green · R128 · R129 · R131 · R133 closed or their remainder named in the report |
| Lands | `docs/**` |
| Boards | — |
| Review | |
| Approve | |
| Budget | |
| Steps | 1. Grep retired names and old paths. 2. Rewrite. 3. Docs build and links. 4. Close the recommendations |

## Log

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| D01 | Rename map and module spec names | — | done | 2026-11-09 | gates green · reviews passed |
| D04 | Citation map | D01 | pending |  |  |
| D05 | Glossary and design canvases | — | pending |  |  |
| D06 | Studio specs in package names | D01 | pending |  |  |
| D02 | RT-F05 Graph database connectors | D01 | pending |  |  |
| C01 | Spec tooling tests | — | pending |  |  |
| C02 | Dead plugins | D01 | pending |  |  |
| C03 | One-way projects → agents | C02 | pending |  |  |
| C05a | Citations in engine source | C02, D04 | pending |  |  |
| C05b | Citations in tests, config and demos | C05a | pending |  |  |
| C05c | Citations in Studio | D04, D06 | pending |  |  |
| R01 | access | C03, C05a, C05b, C05c | pending |  |  |
| R02 | graphs | R01 | pending |  |  |
| R04 | model | R01 | pending |  |  |
| R06 | explore | R01 | pending |  |  |
| R08 | datasets | R01 | pending |  |  |
| R09 | projects | C03, R01 | pending |  |  |
| R05a | agents in the engine | R09 | pending |  |  |
| R05b | agents in Studio | R05a | pending |  |  |
| R03a | Connectors into runtime | R05a, D02 | pending |  |  |
| R03b | runtime: workers, LLM providers, MCP server | R03a | pending |  |  |
| C04 | Connector entry points | R03b | pending |  |  |
| D03 | Developer docs in package names | C04 | pending |  |  |

## Hand-off notes

| ID | Note |
|---|---|
| D01 | Q2 settles `graph_query_log` → `model`, as Ravi was shown. The product-manager had recommended `explore` (it records the queries people run, not the ontology). The move is pure, so reversing it later is one rename |
| D01 | `docs/api/openapi.yaml` (R122) is deleted in D01, not C02: it sits in `docs/`, which only the product-manager edits. `engine/tests/golden/openapi.json` is the live API description |
| D01 | Q1 keeps the `/api/v1/u/{u}/{g}` scope. The Studio scope `/u/:user/:graph` is kept with it (the e2e suite runs on `E2E_GRAPH_PATH=/u/admin/airways`); only the `<pkg>/<records>` tail is renamed |
| D01 | Built: the map is `architecture.md` › *The rename map* (engine modules, tables, API routes, events, Studio packages, Studio routes, each with its phase). Decisions the docs did not settle, for *Questions for Ravi*: (1) `apps/govern` (lenses, guardrails, requests) → `model/lenses`, not `access` as R01's text says — MO-F05 and the module spec own lenses; R01 still moves it, because its guard removes `apps/govern`. (2) `apps/standards` → `datasets/standards`, not `model` — DS-F04 owns standards; R04 moves it (its guard), so R08 moves `apps/datasets` into an existing `datasets/`. (3) `apps/sessions` → `explore/sessions`, not `agents` — *Settled clashes*: the Assistant is `explore`'s; R05a moves it. (4) `apps/llm` → `agents/llms` (R05a, which may not use `runtime/`); providers → `runtime/llms` (R03b). (5) Records named as the package are said once: tables `graphs` · `projects` · `datasets` · `agents`, event `graphs.create`. (6) Events keep their verb (`access.rules.update`, not `updated`), so an event is the action that wrote it; each phase's migration rewrites stored `events.action` prefixes. (7) Tool actions in access rules (`graph.read.query`, `llm.call`) are not renamed — a layer, not a package. (8) `runtime/contention.py` and `runtime/managers/mcp_server.py` go through `apps/workers` and `apps/mcp_server` in R05a, then `runtime/` in R03b; plugin and MCP managers and tables go to `plugins/` in R05a (S01 is out). Rejected for each: the project text's package, or a second spelling |
| D01 | Module spec files renamed: `ask`→`explore-questions` · `bring-data-in`→`datasets-loads` · `connect-and-model`→`model` · `explore`→`explore-boards` · `govern`→`model-lenses` · `graph-connectors`→`runtime-connectors` · `identity-and-access`→`access` · `memory`→`explore-memory` · `operate`→`access-events` · `skills`→`agents-skills` · `work`→`projects` · `workflows`→`agents-plans`. About 176 citations in `engine/`, `studio/`, `integrations/` still name the old files: R136 asks C05a/b/c to repoint them. `architecture.md` › *Metrics are stored* still names `task_runs`, the table's name until R05a; it follows then. `vision.md`'s API row carries no positioning: the golden `openapi.json` has no `info.description` (R137) |
| D02 | Q10: RT-F05 stories stay `specified`. `check.py` refuses `designed` without a done designer task, and nobody draws for a story without boards. With `## Screens` all `—`, R03a and C04 build them as if designed |
| R01 | `INVANA_ALL=1` is set as Ravi asked; the engine's own switch is `INVANA_ALLOW_GRAPH_TESTS`, set too. Graph fixtures read `NEO4J_URI` and `NEO4J_HOST`/`NEO4J_PORT`, all pointed at `:27687` |

## Questions for Ravi

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
| 2026-11-09 | R* | Q1 · Keep the `/api/v1/u/{u}/{g}` route scope? | Keep · Change | Keep; rename only the `<pkg>/<records>` tail | Approved as recommended |
| 2026-11-09 | D01, R04 | Q2 · Where does `graph_query_log` go? | `model` · `explore` | `model` | Approved as recommended |
| 2026-11-09 | C02 | Q3 · Delete the `mail` and `science` plugins? | Delete · Keep | Delete in C02, after the `pre-m3-code` tag | Approved as recommended |
| 2026-11-09 | D01 | Q4 · Drop the `data` package? | Keep the name · Drop | Keep the name; no empty engine module | Approved as recommended |
| 2026-11-09 | C02 | Q5 · Keep `starlette-admin`? | Keep · Remove | Keep | Approved as recommended |
| 2026-11-09 | R09 | Q6 · `todos` / `tasks` naming | `projects` with records `tasks` · other | `projects` package, records `tasks`; plan-library tasks → `agents_plan_steps` | Approved as recommended |
| 2026-11-09 | — | Q7 · Leave S01/S02 out? | Out · In | Out | Approved as recommended |
| 2026-11-09 | C02, C03, C05*, R*, C04 | Q8 · Graph tests on an isolated Neo4j? | `:27687` · the live one | Isolated `invana-migration-neo4j` on `:27687` with `INVANA_ALL=1`; never the live one | Approved as recommended |
| 2026-11-09 | all | Q9 · Branch | Stacked phase branches · one branch | `chore/m3-code` cut from `chore/remove-for-developers`; the runner stacks `m3-code/<ID>-<slug>` | Approved as recommended |
| 2026-11-09 | D02, R03a, C04 | Q10 · Does RT-F05's spec review count as designed? | Yes when `## Screens` is all `—` · draw first | Yes when `## Screens` is all `—` | Approved as recommended |
| 2026-11-09 | — | Q11 · R121, canvas bodies in `studio/packages/canvases` | Out · In | Out — a canvas-repo project | Approved as recommended |
| 2026-11-09 | C05b | Q12 · `.changeset/*` citations | Unreleased only · all · none | Repoint unreleased changesets only | Approved as recommended |
| 2026-11-09 | all | Q13 · Pause for Ravi between phases? | No pauses · at set points | No pauses; Ravi reviews the stacked branches at the end | Approved as recommended |
