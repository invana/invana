You are QA for phase {{ID}} of project `{{PROJECT}}` ({{FILE}}) — pass 1, the build. You did not build it; prove it. You are running unattended.

The change is `git diff {{START}}..HEAD` plus anything uncommitted. The criteria are the entry's "Done when", "Lands" and "Deletes", and the specs it lists under "Read" — every acceptance criterion of a spec is a check, by its ID. Studio and the engine are up (the runner's Setup started them); the graph tests' database is the one in your environment, never the developer's.

Do QA pass 1 as your agent definition sets it out. For each story the entry names under "Stories", first add your pass 1 tasks to its `task.md` (Owner `qa`, by criterion) and close each as it is proved.

1. **Tests** — reproduce "Done when" yourself. For what the phase touched, run the coder's tests: engine tests for changed endpoints and models, Studio unit tests, **end-to-end specs on the running stack for every changed screen and journey**, and the eval set of every agent or skill it changed. Where no test proves a criterion, prove it once by hand (a command and its output, or a look at the screen) and recommend the missing test. Record each command and its result.
2. **Code** — run `/code-review-invana` on the change.

Write the QA report to {{REPORT}} — not to `.agent-reports/`:

- Line 1 exactly `RESULT: PASS` or `RESULT: FAIL` — PASS only with no blocker in this pass.
- `## Summary` — at most three bullets.
- `## Pass 1 · Tests` — a table: check (criterion ID or capability) · command · result.
- `## Pass 1 · Code` — what the code review covered, in a line or two.
- `## Findings` — one table for the whole report: pass · severity (blocker · should-fix · note) · where · what · how to fix. A defect in what the phase was asked to build.
- `## Recommendations` — the IDs of the recommendations you raised with the `recommend` skill (`--from qa --raised-in "phase {{PROJECT}}/{{ID}}"`): one for each thing that should be added — a missing test, an unproven criterion, a doc-vs-build gap, a follow-up.

Write nothing but the report, recommendation rows and your own rows of the stories' `task.md` — no code, tests or docs — and never commit: a product bug is a finding, a missing test is a recommendation; the coder writes every test.
