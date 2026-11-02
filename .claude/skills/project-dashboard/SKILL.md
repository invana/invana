---
name: project-dashboard
description: Start the project dashboard — every project in .claude/team/projects/ with its phases, the sessions each phase ran (build parts, hand-offs, fix rounds, reviews) and their sub-agents, plus every other Claude Code session in this repo, each with its live activity feed. Use when the user types /project-dashboard or asks to see what sessions or agents are running.
---

# Project dashboard

Start it and give the user the URL. Nothing else.

```bash
python3 .claude/skills/project-dashboard/dashboard.py --start
```

It starts in the background (or reuses the one already running), prints `http://localhost:8766` and opens it. Reply
with the URL in one line.

| If | Do |
|---|---|
| The user asks to stop it | `python3 .claude/skills/project-dashboard/dashboard.py --stop` |
| Numbers are blank, or after a Claude Code upgrade | `python3 .claude/skills/project-dashboard/dashboard.py --check` and report what it prints |
| Every session shows *no hook* | The hooks are not registered — see below; tell the user, do not register them unasked |

## How it knows

| Piece | Role |
|---|---|
| `hook.py` | A hook on SessionStart · UserPromptSubmit · PreToolUse · PostToolUse · Notification · Stop · SubagentStop · SessionEnd. Writes `.claude/team/.live/<session>.json` (git-ignored): the state — *working*, *needs you*, *waiting on you*, *ended* — and the project and phase from `INVANA_PROJECT` · `INVANA_PHASE` |
| `.claude/team/projects/<name>/project.md` · `.claude/team/.live/projects/<name>.jsonl` | A project's phases, Log, reviews and questions; the runner's record of every session it started — phase, step, part, peak context, hand-off |
| `dashboard.py` | Serves the page; reads those files and Claude Code's transcripts in `~/.claude/projects/<repo>/` for title, model, context, spend, todos and sub-agents |
| `dashboard.html` | The page; polls every 3 s. Projects → phases → session pills; a pill or card opens its live activity, newest first, on the right half |

| Setting | Default |
|---|---|
| `INVANA_DASHBOARD_PORT` | `8766` |
| `INVANA_DASHBOARD_HOURS` | `24` — how far back a session is listed |
| `INVANA_CONTEXT_LIMIT` | `300000` — the context bar's full mark |

## Registering the hooks

Per person, in `.claude/settings.local.json` — each hook is a short Python process on every tool call, which nobody
should get without choosing it. One entry per event above:

```json
{"hooks": {"PreToolUse": [{"matcher": "*", "hooks": [{"type": "command", "timeout": 5,
  "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/skills/project-dashboard/hook.py\""}]}]}}
```

A session started before the hooks were registered shows *no hook*: its state is guessed from its transcript's age.
