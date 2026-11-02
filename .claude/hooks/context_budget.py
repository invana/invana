#!/usr/bin/env python3
"""Warns a session — or a sub-agent — that has passed its context budget, and logs it for review.

Registered in ``.claude/settings.json`` as a ``PostToolUse`` hook, so it runs for every session in this repo and for
every sub-agent those sessions start. After each tool call it reads the latest assistant message's usage from the
caller's own transcript — input + cache-read + cache-written tokens, the context in use — and compares it with the
budget:

| Source of the budget | Wins over |
|---|---|
| A ``Budget: 400k`` line in the session's or sub-agent's first prompt (the brief) | everything below |
| ``INVANA_CONTEXT_LIMIT`` in the environment (``/run-project`` sets it per phase) | the default |
| ``300000`` | — |

Past the budget it adds a warning to the conversation telling the caller to finish the step it is on and hand off —
again every further ``REPEAT`` tokens. It only warns; it never blocks a tool call. Under ``/run-project``
(``INVANA_PHASE`` set) the runner sends its own hand-off message, so the hook only logs.

Every warning is appended to ``.claude/team/.live/budget.jsonl`` (gitignored), so how sessions behave past their
budget can be reviewed before deciding on a hard stop. Any failure is swallowed: the hook always exits 0.
Standard library only.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import sys
import time
from pathlib import Path

DEFAULT = 300_000
REPEAT = 25_000  # warn again after this many more tokens
TAIL = 512 * 1024  # bytes of transcript read to find the latest usage
BUDGET_LINE = re.compile(r"^\s*\**budget\**\s*[:=]\s*(\d+(?:\.\d+)?)\s*(k|m)?\b", re.I | re.M)

MAIN = ("Context budget reached: this session is at {ctx:,} tokens of context, past its budget of {budget:,}. "
        "Finish the step you are on so everything builds, start nothing new, then run the `handoff` skill. "
        "If the remaining work truly needs more, say so to Ravi with the number you need and why — do not just carry on.")
SUB = ("Context budget reached: this sub-agent is at {ctx:,} tokens of context, past its budget of {budget:,}. "
       "Finish the step you are on so everything builds, start nothing new, and return now with a hand-off for your "
       "caller: what is done, what is left, the files involved and the exact next step.")


def transcript_of(event: dict) -> Path | None:
    """The caller's own transcript: the session's, or the sub-agent's beside it."""
    main = Path(event.get("transcript_path") or "")
    agent = event.get("agent_id")
    if not agent:
        return main if main.is_file() else None
    own = event.get("agent_transcript_path")
    candidates = [Path(own)] if own else []
    candidates.append(main.with_suffix("") / "subagents" / f"agent-{agent}.jsonl")
    return next((c for c in candidates if c.is_file()), None)


def context_in_use(path: Path) -> int:
    """Input + cache-read + cache-written tokens of the latest assistant message."""
    with path.open("rb") as f:
        f.seek(max(0, path.stat().st_size - TAIL))
        lines = f.read().decode("utf-8", "replace").splitlines()
    for line in reversed(lines):
        if '"usage"' not in line:
            continue
        with contextlib.suppress(ValueError):
            e = json.loads(line)
            u = (e.get("message") or {}).get("usage") or {}
            if e.get("type") == "assistant" and u:
                return sum(u.get(k, 0) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
    return 0


def brief_budget(path: Path) -> int | None:
    """A ``Budget:`` line in the first user prompt of the transcript, if there is one."""
    with path.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            with contextlib.suppress(ValueError):
                e = json.loads(line)
                if e.get("type") != "user":
                    continue
                content = (e.get("message") or {}).get("content")
                text = content if isinstance(content, str) else " ".join(
                    c.get("text", "") for c in content or [] if isinstance(c, dict))
                m = BUDGET_LINE.search(text)
                if not m:
                    return None
                n = float(m.group(1)) * {"k": 1e3, "m": 1e6}.get((m.group(2) or "").lower(), 1)
                return int(n) if n >= 10_000 else None
    return None


def check(event: dict) -> str:
    path = transcript_of(event)
    if not path:
        return ""
    ctx = context_in_use(path)
    env = os.environ.get("INVANA_CONTEXT_LIMIT", "")
    budget = brief_budget(path) or (int(env) if env.isdigit() else DEFAULT)
    if ctx <= budget:
        return ""

    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or ".")
    live = root / ".claude" / "team" / ".live"
    sid, agent = str(event.get("session_id") or ""), str(event.get("agent_id") or "")
    key = re.sub(r"[^\w-]", "", f"{sid}-{agent}" if agent else sid)
    state = live / "budget" / f"{key}.json"
    with contextlib.suppress(OSError, ValueError):
        if ctx < json.loads(state.read_text()).get("warned_at", 0) + REPEAT:
            return ""
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(json.dumps({"warned_at": ctx}))

    runner = bool(os.environ.get("INVANA_PHASE"))
    record = {"at": time.time(), "session": sid, "agent_id": agent, "agent_type": event.get("agent_type", ""),
              "context": ctx, "budget": budget, "project": os.environ.get("INVANA_PROJECT", ""),
              "phase": os.environ.get("INVANA_PHASE", ""), "warned": not runner}
    with (live / "budget.jsonl").open("a") as f:
        f.write(json.dumps(record) + "\n")
    return "" if runner else (SUB if agent else MAIN).format(ctx=ctx, budget=budget)


def main() -> None:
    with contextlib.suppress(Exception):  # a budget warning is never worth failing a session for
        event = json.loads(sys.stdin.read() or "{}")
        message = check(event)
        if message:
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": message}}))


if __name__ == "__main__":
    main()
