RESULT: PASS

## Summary
- P04 repoints code, scripts and golden files: no `specs/products/` or `specs/foundation/` path remains in engine, studio, integrations, scripts, specs or docs. No SH/ST/IN ID remains in engine, studio, integrations or scripts. `check.py` knows only `os` and `capabilities`. All gates are green.
- One miss against "Done when": `docs/` still names old SH-xx IDs in 9 pages (SH-07 … SH-23). The project's P04 note says this is deliberate (R111, P07 moves those pages), so it is a note, not a blocker.
- 244 engine tests were skipped, mostly graph-database tests (no `INVANA_ALL`/`NEO4J_URI`). The change is docstrings, comments, golden text and `check.py`, so the risk is low (R113).

## Pass 1 · Tests
No story is named under "Stories" (`—`), so there is no `task.md` to add rows to.

| Check | Command | Result |
|---|---|---|
| No old spec paths (gate) | `sh -c '! grep -rIl -e specs/products/ -e specs/foundation/ --exclude-dir=node_modules --exclude-dir=_stale --exclude=migrations.md engine studio scripts specs docs integrations'` | pass, no match |
| No old SH/ST/IN IDs in code (Done when) | `grep -rIlE "\b(SH\|ST\|IN)-[0-9]+" engine studio integrations scripts` (excluding node_modules, .venv, dist, _stale) | pass, none |
| No old SH IDs in `docs/` (Done when) | same grep over `docs/` | 9 pages still cite SH-07/13/14/18/23 (see Findings F1) |
| `check.py` drops `products` and `foundation` | `git diff specs-m3/P04-start..HEAD -- scripts/specs/check.py`: `AREAS` is `os` and `capabilities` only | pass |
| Spec check | `python3 scripts/specs/check.py` | pass: 232 specs · 166 stories · 0 errors |
| Spec script tests | `python3 -m unittest discover -s scripts/specs` | 11 tests OK |
| Repointed paths exist | extracted every `specs/(os\|capabilities)/…` path added in the diff and tested it on disk | all exist |
| Spot-check mapping | SH-07→GR-11 and SH-20→GR-12 against `specs/migrations.md`; golden text now cites RT-F03 and RT-F01 | match the map |
| Engine lint | `cd engine && uv run ruff check .` | All checks passed |
| Engine tests | `cd engine && uv run pytest -q` | 1241 passed, 244 skipped, 0 failed (golden openapi included) |
| Studio lint | `cd studio && pnpm lint` | pass |
| Studio types | `cd studio && pnpm check-types` | pass |
| Studio unit tests | `cd studio && pnpm test` | 45 files, 159 tests passed |
| E2E on the running stack (changed specs) | `E2E_GRAPH_PATH=/u/admin/airways pnpm exec playwright test e2e/change-log.spec.ts e2e/schedules.spec.ts` | 8 passed |

The e2e changes are only renamed test titles. No screen or journey changed, so pass 2 (design) is not needed. No agent or skill changed, so no eval set applies.

## Pass 1 · Code
I read the whole diff: 89 files, 217 insertions and 199 deletions. The code changes are docstrings and comments in the engine, the `check.py` area table, e2e test titles, and the openapi golden text. No behaviour changed and nothing is mocked. Two Studio source edits (`useEventStream.ts`, `setupSteps.ts`) change comments only. Only the golden's description text changed.

## Findings
| Pass | Severity | Where | What | How to fix |
|---|---|---|---|---|
| 1 | note | `docs/products/*`, `docs/for-developers/**` (9 files, e.g. `docs/products/platform.md:17`) | "Done when" says no file in `docs/` names an old SH ID. SH-07, SH-13, SH-14, SH-18 and SH-23 are still cited. P03 and P04 recorded this as R111: SH-11…SH-23 have no M3 row and P07 moves those pages. | Settle it in P07 (the pages move to `_stale`), or reword P04's "Done when" to exclude `docs/`. |
| 1 | note | engine test run | 244 tests skipped (graph-database tests need `INVANA_ALL` and a Neo4j URI) | R113 |

## Recommendations
- R113: run the engine suite against the isolated Neo4j in the runner's QA setup, so graph-database tests are not skipped.
- R111 (existing): the docs still cite SH-11…SH-23.
