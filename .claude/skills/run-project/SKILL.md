---
name: run-project
description: Run a project from .claude/team/projects/ unattended — phase after phase, each in fresh headless sessions that hand off at 300k, with the runner's own gates, QA reviews, fix rounds and a commit per phase. Use when the project-lead starts, resumes, checks or stops a project run, or when the user types /run-project <name>.
---

# Run a project

A project is `.claude/team/projects/<name>/project.md`, written by the product-manager from
[`project-template.md`](project-template.md) and approved by Ravi (`status: ready`). This skill runs it; the
project-lead decides when.

| Want | Command |
|---|---|
| What runs next | `python3 .claude/skills/run-project/run.py <name> --dry-run` |
| Start, detached — survives this session | `python3 .claude/skills/run-project/run.py <name> --start` |
| One phase only | `… <name> --start --only P02` |
| Stop | `… <name> --stop` — the phase in progress resumes on the next start |
| Watch | `/project-dashboard` · the log `.claude/team/.live/projects/<name>.log` |

Before `--start`: `git status` clean (or the phase is resuming), the project's *Setup* will pass, `status` is `ready`,
`running`, `paused` or `blocked` with its question answered — never `draft`. Starting a run is Ravi's yes, not yours:
only start when he asked for it in this conversation.

## What it does

| Step | Who |
|---|---|
| Pick the first phase whose *Needs* are `done` | runner |
| Build — `claude -p --agent <Agent>` from `prompts/build.md`; past 300k the session hands off, the next **part** continues from its note | the entry's agent (default `coder`) |
| Setup, then gates from the project's tables | runner — the agent's "green" is not evidence |
| QA, when the entry's *Review* is `qa`, into one report `.agent-reports/qa/<project>-<ID>-qa.md`. **Pass 1** (`prompts/qa-build.md`): runs the tests that exist — engine, Studio, end to end on the running stack, agent evals — proves by hand what none covers, then `/code-review-invana`. QA writes only its report and recommendations; the coder writes every test. **Pass 2** (`prompts/qa-design.md`, only when the entry names boards), in a fresh session: `/design-qa` plus the **regression set** — every done phase's boards shot live and pixel-diffed against their accepted shots, only the changed ones viewed. Line 1 passes only when both passes do | `qa` |
| Recommendations: every session writes what it thinks should change, outside its phase or its role's files, to `.claude/team/agents-recommendations.md` (*Raised in* `phase <name>/<ID>`) — findings fail the phase, recommendations never do. The project-lead has the product-manager take up the ones still open when the run pauses or ends | every session |
| Up to 3 fix rounds on failures | the entry's agent, on Sonnet |
| `done`: a QA'd phase's boards become accepted shots (`.claude/team/.live/projects/<name>/shots/accepted/`), then commit `feat(<scope>): <ID> · <phase>` on the phase branch | runner — never merges, never pushes |

## Every session

The runner's prompts (`prompts/build.md` · `continue.md` · `fix.md`, and the commit rule in `run.py`) give every
session these rules, so a project never repeats them; its *Rules for every session* holds only what it adds.

| Rule | Detail |
|---|---|
| Read first | `CLAUDE.md`, `.claude/team/TEAM.md`, the project's rules, the phase entry and the hand-off notes of every phase it needs |
| Only this phase | What the entry's *Done when* says, in the files the agent's role writes (`TEAM.md` §1 *Edit rights*) |
| Recommend the rest | Anything outside the phase or the role goes through the `recommend` skill, `--raised-in "phase <name>/<ID>"` |
| Commit each step | Ravi's start of the run is the yes for these commits (`TEAM.md` §6 *Git*). The lead commits each finished step as `wip(<scope>): <ID> · step N — <what>` with `git add -A` and `--no-verify` — safe only because the phase starts from a clean tree on its own branch; the closing commit runs the hooks. Never amends, rebases, resets, pushes or opens a PR |
| Stay on the phase branch | Never switch, create or merge branches (*Branches* below) |
| Hand off | A hand-off note when done; past the context limit, row `partial` and a note saying where to resume |

## Branches

| Branch | Holds | Made by |
|---|---|---|
| Project — the frontmatter's `branch:`, `feat/<name>` | Where the project starts; it moves only when Ravi merges phases into it, and reaches `main` only through a PR he asks for | Ravi, off an up-to-date `main`, before the project is `ready` |
| Phase — `<name>/<ID>-<slug of the phase title>` | One phase: a `wip` commit per finished step, the runner's checkpoints, the closing commit | the runner, when the phase starts — off the last done phase's branch, the first off the project branch; a stopped or blocked run resumes on it |

- Phase branches stack: each holds every phase before it, so the last done phase's branch is the whole project so far.
- Every session commits each finished step on its phase branch; nothing is committed to the project branch.
- The runner only forks: it never merges, never touches `main` and never pushes. Merging is Ravi's, when he asks.

| Project table | Used for |
|---|---|
| *Environment* | Set for the runner, so every gate and session inherits it — e.g. the isolated graph database tests must use |
| *Setup* | Run before each gate round. `setup.py stack` starts the dev stack if it is down; `setup.py demo-data` reloads `demos/airways` into an empty Graph; `python3 demos/agents/reseed.py` refreshes boards whose data is relative to now |
| *Gates* | Run by the runner; *In* is the folder, *Known failures* a JSON list in the project folder |

| Ends as | Means | Next |
|---|---|---|
| `done` | Every phase done | Report to Ravi |
| `paused` | Nothing runnable, one phase run with `--only`, or a phase with an `Approve` row is done | Ravi approves, then start again |
| `blocked` | A phase's Notes say why — a question, failed gates after 3 rounds, a setup failure | The project-lead triages |

| Setting | Default |
|---|---|
| `INVANA_CONTEXT_LIMIT` · `INVANA_RUNNER_HANDOFF_GRACE` | `300000` · `50000` — hand-off, then hard stop. A phase's `Budget` row overrides the limit for that phase |
| `INVANA_RUNNER_LEAD_MODEL` · `INVANA_RUNNER_CHEAP_MODEL` | the agent's model · `sonnet` (fixes, QA, sub-agents) |
| `INVANA_RUNNER_GATE_TIMEOUT` | `1800` s |
| `INVANA_RUNNER_SHOT_THRESHOLD` | `0.005` — the share of a board's pixels that may change before QA looks at it |
| `INVANA_RUNNER_SANDBOX=1` | skip permission prompts — only inside a disposable container |

A project may override any prompt with `prompts/<name>.md` in its own folder (`build` · `continue` · `fix` ·
`qa-build` · `qa-design` · `team`).
