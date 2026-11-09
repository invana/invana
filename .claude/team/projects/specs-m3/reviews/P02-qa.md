RESULT: PASS

## Summary
- `check.py` knows `os` · `capabilities` · `products` · `foundation` in that index order, skips `specs/_stale/`, and refuses any live link into it (inline, angle-bracket with spaces/anchors, reference style); the check and links pass on today's tree.
- The phase changed only `scripts/specs/{check,links,test_check}.py` (no story, engine, Studio, agent or skill) — so no story `task.md` rows, no e2e specs and no evals apply.
- No blockers. The new tests are in no gate yet (already recorded as R099/R103).

## Pass 1 · Tests
| Check | Command | Result |
|---|---|---|
| Done when: areas `os` and `capabilities` alongside today's two; index puts the OS before the capabilities | `python3 -m unittest discover -s scripts/specs` (`Areas.test_os_and_capabilities_are_spec_areas`, `test_index_lists_the_os_before_the_capabilities`, `WholeCheck.test_a_valid_os_and_capabilities_tree_passes_and_indexes_os_first`) | 10 tests · OK |
| Done when: skips `_stale/` (check and links) | `Areas.test_stale_is_never_a_spec`, `LinksSkipStale`, `WholeCheck.test_stale_files_are_skipped…` | OK |
| Done when: fails on a live link into `_stale/` (positive and negative) | `StaleLinks` — live/backticked paths pass; spec and doc links, reference-style and padded/spaced/anchored angle links fail | OK (4 forms counted) |
| Done when: the check passes on today's tree | `python3 scripts/specs/check.py` | `229 specs · 166 stories · 0 tasks · 0 errors`, exit 0 (only undrawn-board warnings) |
| Links pass | `python3 scripts/specs/links.py specs docs` | `651 files · no broken links` |
| Engine / Studio unit / e2e / evals | — | Not applicable: the diff touches no engine, Studio, agent, skill or prompt |

## Pass 1 · Code
Reviewed the `specs-m3/P02-start..HEAD` diff of `check.py`, `links.py` and `test_check.py`: the `LINK` regex (every alternative yields a non-empty group, so `next(...)` is safe; anchor-only and URL/absolute targets are skipped; code spans and fences are stripped), `is_stale`, the shared `live()` helper in `links.py`, the `AREAS` index sort, and test coverage (one positive and one negative per capability). Docstrings are full; no mocks, standard library only; nothing writes outside the script's own `--index` flag, which was not run.

## Findings
| Pass | Severity | Where | What | How to fix |
|---|---|---|---|---|
| 1 | note | `scripts/specs/test_check.py` | The 10 tests run in no gate, so a regression in the stale-link rule would not block a commit (already R099/R103). | Wire `python3 -m unittest discover -s scripts/specs` into pre-commit/CI (R099/R103). |

## Recommendations
- None new. The one gap is already open as R099 / R103.
