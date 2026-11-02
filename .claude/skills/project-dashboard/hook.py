#!/usr/bin/env python3
"""Records what each Claude Code session is doing, for the project dashboard.

Registered as a hook for SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Notification,
Stop, SubagentStop and SessionEnd (see ``SKILL.md``). Claude Code passes each event as JSON on
stdin; this writes one status file per session to ``.claude/team/.live/<session_id>.json``:

| Event | State |
|---|---|
| SessionStart | ``started`` |
| UserPromptSubmit · PreToolUse · PostToolUse | ``working`` |
| Notification | ``needs you`` |
| Stop | ``waiting on you`` |
| SessionEnd | ``ended`` |

``INVANA_PROJECT`` and ``INVANA_PHASE`` in the session's environment tie it to a project phase —
``/run-project`` sets them; an interactive session has neither. The hook never blocks a session:
any failure is swallowed and it always exits 0 with no output. Standard library only.
"""
from __future__ import annotations

import contextlib
import json
import os
import sys
import time
from pathlib import Path

STATE = {
    "SessionStart": "started",
    "UserPromptSubmit": "working",
    "PreToolUse": "working",
    "PostToolUse": "working",
    "Notification": "needs you",
    "Stop": "waiting on you",
    "SessionEnd": "ended",
}


def what(tool: str, inp: dict) -> str:
    """A one-line summary of a tool call."""
    arg = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("pattern") or ""
    return f"{tool}: {str(arg)[:160]}" if arg else tool


def record(event: dict) -> None:
    sid = str(event.get("session_id") or "")
    name = event.get("hook_event_name", "")
    if not sid or not sid.replace("-", "").isalnum():
        return
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or event.get("cwd") or ".")
    live = root / ".claude" / "team" / ".live"
    live.mkdir(parents=True, exist_ok=True)
    path = live / f"{sid}.json"
    try:
        s = json.loads(path.read_text())
    except (OSError, ValueError):
        s = {"session_id": sid, "started": time.time()}
    now = time.time()
    agent = event.get("agent_id")  # set when the event comes from inside a sub-agent
    s.update({"transcript": event.get("transcript_path", s.get("transcript", "")), "cwd": str(root),
              "project": os.environ.get("INVANA_PROJECT", s.get("project", "")),
              "phase": os.environ.get("INVANA_PHASE", s.get("phase", "")), "pid": os.getppid()})
    if agent:
        sub = s.setdefault("subagents", {}).setdefault(agent, {})
        sub["at"] = now
        if name == "SubagentStop":
            sub["state"] = "finished"
        elif name in ("PreToolUse", "PostToolUse"):
            sub["state"], sub["doing"] = "working", what(event.get("tool_name", ""), event.get("tool_input") or {})
    else:
        if name in STATE:
            s["state"], s["at"] = STATE[name], now
        if name == "PreToolUse":
            s["doing"] = what(event.get("tool_name", ""), event.get("tool_input") or {})
        elif name == "Notification":
            s["doing"] = str(event.get("message", ""))[:200]
        elif name == "UserPromptSubmit":
            s["doing"] = "thinking"
        elif name == "Stop":
            s["doing"] = ""
        elif name == "SessionEnd":
            s["reason"] = event.get("reason", "")
    tmp = path.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(s))
    tmp.replace(path)


def main() -> None:
    with contextlib.suppress(Exception):  # a status line is never worth failing a session for
        record(json.loads(sys.stdin.read() or "{}"))


if __name__ == "__main__":
    main()
