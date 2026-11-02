---
name: code-review-invana
description: Review an Invana change for correctness, safety and the repo's engine, Studio and testing standards against its spec's acceptance criteria and feature file, and write a PASS/FAIL report. Use for QA pass 1, or whenever a change needs an independent code review. Never edits any file but its report; recommends what should be added.
---

# Code review — the change against its spec and the standards

The procedure **QA** follows in pass 1, after the tests, and anyone else reviewing a change. You did not write the code;
find what is wrong. How the team works around a review is `.claude/team/TEAM.md`.

## Read

The change (`git diff <base>...HEAD` or the commits named), the feature file it implements, its module `spec.md`, `CLAUDE.md`, and the standard the code is held to: the **`build-feature`** skill, and **`build-studio`** for Studio or kit code. When the feature has a spec in `specs/`, review against each story's `story.md` acceptance criteria and its `task.md`: a criterion with no code or no test is a FAIL; code that does more than the spec says is a finding; a coder task marked `done` whose evidence does not hold, or a criterion no coder task names, is a finding.

## Look for

| Area | Finding |
|---|---|
| Access | an act the spec's Access table names but no role guards; a graph-scoped write route not mapped to its area; a refusal Studio does not draw; a new role or area nobody decided |
| Correctness | bugs, unhandled seams the feature file names (empty, refused, read-only, no access), races, wrong status codes |
| Scope | anything the index does not list, or a *Not building* row built |
| Engine | sync code in async paths; a number computed at read time instead of stored when the fact settles; currency; a list off the list contract; a refusal that does not name its rule; a migration that would lose demo data |
| Studio | UI not from `@invana/*`; hex, `hsl(`, `style={{}}`, hard-coded heights; a number derived in Studio; PixiJS; server state outside TanStack Query; a committed `link:` override |
| Docs in code | decision ids in code or tests; long column comments; missing usage docstrings on modules, classes, methods |
| Security | a route or agent tool without its authorisation check; a query built from strings instead of parameters; graph or document text reaching an LLM as instructions; an agent tool that writes, sends or spends without the person's yes; a secret logged, returned or committed; a dependency added without need |
| Agents | a change to an agent, skill, prompt, plan or model with no eval run, or a trace step not recorded by the engine |
| Tests | mocks; missing positive or negative test per capability; graph tests aimed at the live database |
| Process | a coder task still open, or `done` without its commit; no changeset for a user-facing change; feature file or index not updated; a fix-lane change that alters a criterion, a board or access; several stories batched in one change; `git add -A` sweeping in another session's files |

## Report

When QA runs it, it is the *Pass 1 · Code* section of the story's QA report (`.agent-reports/qa/<ID>-qa.md`, or the
runner's `reviews/<ID>-qa.md`), its rows in that report's one *Findings* table. Anyone else writes
`.agent-reports/<agent>/<ID>-code.md` in the shape of `.claude/team/TEAM.md` §3 *Reports*:
line 1 exactly `RESULT: PASS` or `RESULT: FAIL`; a *Findings* table of severity (blocker · should-fix · note) · file:line ·
what · how to fix; then *Requests*. PASS only with no blockers. Never edit any file but the report — code, tests or docs. What should be added —
a missing test, an unproven criterion, a follow-up — is raised with the `recommend` skill, its ID listed
under `## Recommendations` in the report, never a finding.
The folder is git-ignored; a
report is never committed.
