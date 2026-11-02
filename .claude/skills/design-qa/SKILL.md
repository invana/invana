---
name: design-qa
description: Check that what Invana Studio shows is what the boards draw — screenshot each live screen and its board, compare them in every state and both lenses, check the design rules, and write a PASS/FAIL report. Use for QA pass 2, or whenever a built screen needs checking against its design. Never edits code or boards.
---

# Design QA — Studio against its boards

The procedure **QA** follows in pass 2, in a fresh session, and anyone else checking a built screen. You did not build
it; judge it. How the team works around a review is `.claude/team/TEAM.md`.

## Read

- `CLAUDE.md` › *Design rules* and `specs/design-language.md`, the language boards are judged against.
- The boards: a spec's stories name them in `## Screens` of each `story.md` (and the feature's `boards:`); your pass 2 tasks in the story's `task.md` — one per board, Owner `qa` — say which you check; they are on the Agent version canvas, `.design/canvas-agent-version/project/` (run `python3 av.py` there if one is missing). A feature not yet migrated: its Surfaces table and the story tables in `docs/products/*.md`, boards in `.design/canvas-products/project/` (`python3 products.py`).
- Routes: `.claude/skills/design-qa/screen-map.json` (regenerate with `python3 .claude/skills/design-qa/screen_map.py`). A board with no route is a blocker.

## Shoot

- Studio must be up at `http://localhost:8300` (`docker compose up -d engine studio`; plain `docker compose`, never `-f`, or the local kit is lost). Load demo data from `demos/airways` if the Graph is empty (`python3 .claude/skills/run-project/setup.py demo-data`), and run `python3 demos/agents/reseed.py` right before shooting: boards whose data is relative to now (worker heartbeats, charts, the newest draw) are stale an hour after their seed.
- `screen_map.py`'s state hints name the seeds that draw a board's data (`demos/agents/seed_*.py`).
- `node .claude/skills/design-qa/shoot.mjs --live --boards <names> --out <dir>/live`. Boards: `--proto --boards <names> --out <dir>/proto` reads Invana Products only; shoot an Agent version board from its `.dc.html` file, once per State and Lens value the spec names.
- **View each image exactly once.** Never Read the same file twice; note what you saw as you go. Over 15 boards: shoot them all, then look at them in batches of 15, writing each batch's findings into the report before the next; past 300k tokens, hand off with the boards still to look at.

## Compare

| Check | Blocker when |
|---|---|
| Regions | header, leftNav, leftSection, workbook tabs, page head with breadcrumb, tabs, page or canvas, assistant on the right — one is missing or moved |
| Components | a board element drawn by something other than its `@invana/*` component (`design-kit-coverage.md`) |
| Copy | labels, empty-state and refusal text differ in meaning |
| States | a cell of the feature's `## Screens` matrix (surface × state × lens) has no board, or Studio does not show it as drawn — walk every cell, as Admin and as Operator |
| Access | a member without the role sees the act working, or sees it differently from the board (hidden · disabled with reason · *Ask <owner>*) |
| Decide and trace | an agent outcome with no way to its trace; machinery (queries, logs, plans) on the first screen by default; a blank form where the agent should propose |
| Kit | an element not built from `@invana/design-kit` / `@invana/canvas-ui` |
| Rules | raw hex or `hsl(`, `style={{}}`, hard-coded heights, a number Studio derives instead of reading from the engine, currency instead of tokens |

Compare meaning, not pixels: prototype data is illustrative.

## Report

When QA runs it, it is the *Pass 2 · Design* section of the story's QA report (`.agent-reports/qa/<ID>-qa.md`, or the
runner's `reviews/<ID>-qa.md`): add the section and your *Findings* rows, and set line 1 for both passes. Anyone else
writes `.agent-reports/<agent>/<ID>-design.md` in the shape of `.claude/team/TEAM.md` §3 *Reports*:
line 1 exactly `RESULT: PASS` or `RESULT: FAIL`; a *Findings* table of severity (blocker · should-fix · note) · board ·
what · how to fix; then *Requests*. PASS only with no blockers. Never edit any file but the report — code, tests or docs. What should be added —
a missing test, an unproven criterion, a follow-up — is raised with the `recommend` skill, its ID listed
under `## Recommendations` in the report, never a finding.
The folder is git-ignored; a
report is never committed.
