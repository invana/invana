---
name: handoff
description: Hand the current task to a fresh session — stop cleanly, write a hand-off prompt to .handoffs/ from the template, and start the next session (in the background when unattended; on the clipboard, ready to paste after /clear, when a person is in the conversation). Use when the user types /handoff, when the conversation has been compacted, or when the session passes its context budget.
---

# Hand-off — continue the task in a fresh session

The person never writes or opens the hand-off file: this skill writes it, and the next session reads it. The project's
`CLAUDE.md` sets the context budget and names any runner.

## 1. When

| Trigger | Who starts it |
|---|---|
| The user types `/handoff` (optionally with a task name) | The user |
| The conversation has been compacted into a summary | The session itself |
| The session passes its budget (`CLAUDE.md`, or a `Budget:` line in its brief), or the `context_budget` hook or a runner says it is reached | The session itself |

## 2. Stop cleanly

- Finish or revert the file you are editing so everything builds and every check the project runs still passes.
- Commit only if your brief or the user's current instruction says so — then stage named paths only.
- Write any report your role owes (its partial result) before the hand-off, so the next session finds it.

## 3. Write the hand-off

| Part | Rule |
|---|---|
| Path | `.handoffs/<agent>-<task>-<n>.md` — `<agent>` is the `--agent` name, or `main`; `<task>` a short kebab slug, the same across the chain; `<n>` one more than the highest existing number for that agent and task |
| Content | `template.md` beside this file, every section filled. It is a prompt: written to the next session, in the imperative, standing alone — no "as discussed", no reference to this conversation |
| Never | A secret's value, a token, or anything the next session can re-read from the repo instead of being told |
| Limit | Count the files already in the chain. At 8, do not start another session: stop and ask the person how to proceed |

## 4. Start the next session

| Situation | Do |
|---|---|
| **A person is in the conversation** (they have sent a message in this session) | Copy the start line to the clipboard — `pbcopy` (macOS) · `clip.exe` (Windows, WSL) · `wl-copy` or `xclip -selection clipboard` (Linux), whichever exists — and show it. Tell them: type `/clear`, then paste. If the clipboard fails, show the line to copy |
| **Unattended, top-level** (started with `claude -p`) | Start it in the background, then stop: `nohup claude -p [--agent <agent>] --permission-mode acceptEdits "$(cat .handoffs/<file>.md)" > .handoffs/<file>.log 2>&1 &` |
| **A sub-agent** | Return the hand-off's path to whoever delegated to you; they relaunch it |
| **Under a runner** `CLAUDE.md` names | Do what `CLAUDE.md` says for it (mark the row, then stop); the runner starts the next session |

The start line, for the clipboard:

```
Continue from .handoffs/<file>.md — read it, then the files it lists under "Read first", then do its next step.
```

When the session runs under an agent and the person's tool does not keep it across `/clear`, say so: they start
`claude --agent <agent>` and paste the same line.

## 5. Report

Two lines: the hand-off's path, and how the next session starts (clipboard, background with its log path, returned to
the delegator, or the runner). Then stop — do no further work in this session.

## Budgets

Every session — the main one, one started with `--agent`, or a sub-agent — has **300k tokens** of context unless it is
given another. The `context_budget` hook (`.claude/hooks/`) measures every session and sub-agent after each tool call
and warns past the budget; it never blocks. Auto-compact fires at 30% of the window; a compacted conversation hands off
too.

| Project rule | Detail |
|---|---|
| Another budget | A `Budget: 400k` line in a session's or sub-agent's brief, or a phase's `Budget` row in a project. Only the product manager sets one above 300k, with a reason, after trying to split the work — Ravi approves it with the project or the delegation |
| Observing | Every warning is logged to `.claude/team/.live/budget.jsonl` (gitignored) |
| Under a runner | Started by `/run-project` (or `scripts/migration/run.py`): set the row `partial` and stop — the runner starts the next session |
| Sub-agents | Return the hand-off to whoever delegated, which relaunches it |
| Limit | After 8 hand-offs on one task, stop and ask Ravi |
