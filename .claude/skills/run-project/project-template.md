---
name: <project-name>
status: draft
branch: feat/<project-name>
scope: <project-name>
---

# <Project title>

<One line: what this project delivers and for whom.>

| | |
|---|---|
| Goal | <What is true when the project is done — one or two bullets' worth> |
| Specs | <The `specs/` features and stories it delivers, by ID> |
| Not in this project | <What it deliberately leaves out> |

Run it: `python3 .claude/skills/run-project/run.py <project-name>` (the project-lead does, with `--start`).

## Rules for every session

Only the rules this project adds. The runner already gives every session the common ones: what to read, only this
phase, recommendations, a `wip` commit per step, the phase branch, never merge or push
(`.claude/skills/run-project/SKILL.md` › *Every session*). Leave the table empty if there are none.

| Rule | Detail |
|---|---|
| <rule> | <detail> |

## Environment

Set for the runner, so every gate and session inherits it. Optional.

| Name | Value |
|---|---|
| `<NAME>` | `<value>` |

## Setup

Run by the runner before each gate round; a failure blocks the phase. Optional. `setup.py stack` · `setup.py demo-data`
(`.claude/skills/run-project/`) and `python3 demos/agents/reseed.py` cover the dev stack and its data.

| Step | Command | In | Phases |
|---|---|---|---|
| <name> | `<command>` | `.` | all |

## Gates

Run by the runner, never trusted from the agent. *Phases*: `all`, IDs (`P01, P03`) or a prefix (`B*`). *Known
failures*: a JSON list, in this folder, of e2e or knip items that already failed before the project — they pass.

| Gate | Command | In | Phases | Known failures |
|---|---|---|---|---|
| <name> | `<command>` | `<dir>` | all | |

## Phases

### P01 · <Phase title>

| | |
|---|---|
| Agent | coder |
| Read | <docs and specs the session reads> |
| Stories | <story IDs it delivers (`RC-08 · RC-09`) — the agent adds and works its role's tasks in each `task.md`; — for a phase with no story> |
| Done when | <the observable result — what a reviewer checks> |
| Lands | <files, routes or surfaces it adds or changes> |
| Boards | <board names it implements, or —> |
| Review | qa — pass 1 always; pass 2 (design) when *Boards* names boards. Blank: no QA |
| Approve | <Ravi — the runner pauses after this phase until he starts it again; blank or — when not needed> |
| Budget | <blank = 300k context per session; above it only with a reason, e.g. `400k — one migration touches every model`> |
| Steps | <1. … 2. … — the order the session works in> |

## Log

Status is the runner's: `pending` · `in progress` · `gates` · `qa` · `fixing N` · `done` · `blocked`. A session sets
only `partial` (it handed off) or `blocked` (with the question).

| ID | Phase | Needs | Status | Date | Notes |
|---|---|---|---|---|---|
| P01 | <Phase title> |  | pending |  |  |

## Hand-off notes

What a later phase must know that the code does not say. One row per note, newest last.

| ID | Note |
|---|---|

## Questions for Ravi

The project-lead's, batched. Answered rows stay until the phase they unblock is done.

| Date | Phase | Question | Options | Recommend | Answer |
|---|---|---|---|---|---|
