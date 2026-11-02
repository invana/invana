#!/usr/bin/env python3
"""The project dashboard: every Claude Code session in this repo, grouped by project, and the sub-agents each one runs.

Two sources, both read on every poll and nothing stored:

| Source | Gives |
|---|---|
| ``.claude/team/.live/<session>.json`` | What the session is doing now, written by ``hook.py`` per hook event — \
the state is the event, never a guess — and the project and phase it works on |
| ``~/.claude/projects/<repo>/<session>.jsonl``, ``<session>/subagents/agent-*`` | Title, agent, model, context, \
spend, todos, sub-agents and the live feed |

The transcripts are Claude Code's own files and their shape is not a contract: every read is defensive, and a line
it cannot read is skipped, so a format change blanks a number rather than breaking the page. ``--check`` reports
the line shapes of the newest transcript it does not recognise — run it after a Claude Code upgrade.

Usage::

    python3 .claude/skills/project-dashboard/dashboard.py --start   # in the background; prints the URL, opens it
    python3 .claude/skills/project-dashboard/dashboard.py           # in the foreground
    python3 .claude/skills/project-dashboard/dashboard.py --check
    python3 .claude/skills/project-dashboard/dashboard.py --stop

Standard library only; runs on macOS, Linux and Windows.
"""
from __future__ import annotations

import argparse
import contextlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or HERE.parents[2])
LIVE = ROOT / ".claude" / "team" / ".live"
PROJECTS = ROOT / ".claude" / "team" / "projects"
TRANSCRIPTS = Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(ROOT))
PORT = int(os.environ.get("INVANA_DASHBOARD_PORT", "8766"))
HOURS = float(os.environ.get("INVANA_DASHBOARD_HOURS", "24"))
LIMIT = int(os.environ.get("INVANA_CONTEXT_LIMIT", "300000"))
QUIET = 15 * 60  # a session that says "working" but has been silent this long is shown as quiet
KNOWN = {"user", "assistant", "system", "ai-title", "agent-setting", "last-prompt", "summary", "mode",
         "permission-mode",
         "queue-operation", "attachment", "file-history-snapshot", "file-history-delta", "atis-latch", "api-request",
         "api-request-shape", "api-request-blob", "tools-used", "bridge-session", "cost-state", "isolation-latch",
         "frame-link", "artifact-comment-monitor", "artifact-autoreact-ledger", "custom-title"}
SID = re.compile(r"^[0-9a-f-]{36}$")
AGENT = re.compile(r"^[0-9a-z]+$")


def what(name: str, inp: dict) -> str:
    arg = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("pattern") \
        or inp.get("subject") or ""
    return f"{name}: {str(arg)[:160]}" if arg else name


class Transcript:
    """A transcript read incrementally: each poll parses only the lines appended since the last."""

    def __init__(self, path: Path) -> None:
        self.path, self.offset, self.seen = path, 0, set()
        self.s = {"title": "", "agent": "", "model": "", "context": 0, "peak": 0, "spend": 0, "turns": 0, "tools": 0,
                  "branch": "", "entrypoint": "", "prompt": "", "said": "", "doing": "", "todos": [], "first": "",
                  "unknown": {}}
        self._tasks: dict[str, dict] = {}

    def read(self) -> dict:
        try:
            size = self.path.stat().st_size
        except OSError:
            return self.s
        if size < self.offset:  # rewritten: start over
            self.__init__(self.path)
        if size > self.offset:
            with self.path.open("rb") as f:
                f.seek(self.offset)
                chunk = f.read(size - self.offset)
            end = chunk.rfind(b"\n") + 1  # leave a half-written last line for the next poll
            self.offset += end
            for line in chunk[:end].decode(errors="replace").splitlines():
                try:
                    self._line(json.loads(line))
                except (ValueError, TypeError, AttributeError, KeyError):
                    continue
        return self.s

    def _line(self, e: dict) -> None:
        s, kind = self.s, e.get("type")
        if kind not in KNOWN:
            s["unknown"][kind] = s["unknown"].get(kind, 0) + 1
        if kind in {"ai-title", "custom-title"}:
            s["title"] = e.get("aiTitle") or e.get("customTitle") or e.get("title") or s["title"]
        elif kind == "summary" and not s["title"]:
            s["title"] = e.get("summary", "")
        elif kind == "agent-setting":
            s["agent"] = e.get("agentSetting", "")
        elif kind == "last-prompt":
            s["prompt"] = str(e.get("lastPrompt", ""))[:300]
        s["branch"] = e.get("gitBranch") or s["branch"]
        s["entrypoint"] = e.get("entrypoint") or s["entrypoint"]
        msg = e.get("message") or {}
        if kind == "user" and not e.get("isMeta") and not s["first"]:
            c = msg.get("content")
            text = c if isinstance(c, str) else " ".join(b.get("text", "") for b in c or [] if isinstance(b, dict))
            if text.strip() and not text.lstrip().startswith("<"):
                s["first"] = text.strip()[:200]
        if kind != "assistant":
            return
        u = msg.get("usage") or {}
        ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        if ctx:
            s["context"], s["peak"] = ctx, max(s["peak"], ctx)
        s["model"] = msg.get("model") or s["model"]
        if msg.get("id") not in self.seen:  # one API turn can span several lines
            self.seen.add(msg.get("id"))
            s["turns"] += 1
            s["spend"] += ctx + u.get("output_tokens", 0)
        for b in msg.get("content") or []:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "text" and b.get("text", "").strip():
                s["said"] = b["text"].strip()[:400]
            if b.get("type") != "tool_use":
                continue
            s["tools"] += 1
            name, inp = b.get("name", ""), b.get("input") or {}
            s["doing"] = what(name, inp)
            if name == "TodoWrite":
                items = inp.get("todos", [])
                if isinstance(items, str):
                    items = json.loads(items)
                s["todos"] = [{"text": t.get("content", ""), "status": t.get("status", "pending")} for t in items]
            elif name == "TaskCreate":
                self._tasks[str(len(self._tasks) + 1)] = {"text": inp.get("subject") or inp.get("description", ""),
                                                          "status": "pending"}
                s["todos"] = list(self._tasks.values())
            elif name == "TaskUpdate" and str(inp.get("taskId")) in self._tasks:
                self._tasks[str(inp["taskId"])]["status"] = inp.get("status", "pending")
                s["todos"] = list(self._tasks.values())


_cache: dict[Path, Transcript] = {}
_lock = threading.Lock()


def transcript(path: Path) -> dict:
    with _lock:
        t = _cache.setdefault(path, Transcript(path))
        return t.read()


def alive(pid: int | None) -> bool | None:
    """Whether the process that ran the hook is still there; ``None`` when that cannot be told."""
    if not pid or os.name == "nt":  # on Windows, signal 0 is CTRL_C_EVENT
        return None
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except OSError:
        return None
    return True


def subagents(sid: str, hooked: dict) -> list[dict]:
    out = []
    for meta in sorted((TRANSCRIPTS / sid / "subagents").glob("agent-*.meta.json")):
        aid = meta.name[len("agent-"):-len(".meta.json")]
        try:
            m = json.loads(meta.read_text())
        except (OSError, ValueError):
            m = {}
        log = meta.with_name(f"agent-{aid}.jsonl")
        t = transcript(log) if log.exists() else {}
        mtime = log.stat().st_mtime if log.exists() else meta.stat().st_mtime
        h = hooked.get(aid, {})
        if m.get("finished") or h.get("state") == "finished":
            state = "finished"
        elif time.time() - mtime < 90:
            state = "working"
        else:
            state = "quiet"
        out.append({"id": aid, "name": m.get("description", ""), "type": m.get("agentType", ""),
                    "background": m.get("requestShape") == "background", "state": state, "at": mtime,
                    "model": t.get("model", ""), "context": t.get("context", 0), "peak": t.get("peak", 0),
                    "spend": t.get("spend", 0), "tools": t.get("tools", 0), "todos": t.get("todos", []),
                    "doing": h.get("doing") or t.get("doing", "")})
    return out


def sessions() -> list[dict]:
    now, hooked = time.time(), {}
    for f in LIVE.glob("*.json"):
        try:
            h = json.loads(f.read_text())
            hooked[h["session_id"]] = h
        except (OSError, ValueError, KeyError):
            continue
    paths = {p.stem: p for p in TRANSCRIPTS.glob("*.jsonl") if now - p.stat().st_mtime < HOURS * 3600}
    for sid, h in hooked.items():
        p = Path(h.get("transcript") or TRANSCRIPTS / f"{sid}.jsonl")
        if p.exists() and now - max(p.stat().st_mtime, h.get("at", 0)) < HOURS * 3600:
            paths[sid] = p
    out = []
    for sid, path in paths.items():
        if not SID.match(sid):
            continue
        t, h = transcript(path), hooked.get(sid, {})
        if not t["turns"]:
            continue
        mtime = path.stat().st_mtime
        state, last = h.get("state"), max(h.get("at", 0), mtime)
        if not state:
            state = "active" if now - mtime < 60 else "idle"  # no hook has seen this session
        elif state in ("started", "working") and now - last > QUIET:
            state = "quiet"
        if state != "ended" and alive(h.get("pid")) is False:
            state = "ended"
        subs = subagents(sid, h.get("subagents", {}))
        for a in subs:
            if a["state"] == "quiet" and state in ("ended", "idle"):
                a["state"] = "ended"  # its session is gone; it cannot still be running
        out.append({"id": sid, "title": t["title"] or t["first"] or sid[:8], "agent": t["agent"], "model": t["model"],
                    "state": state, "hooked": bool(h), "at": last, "project": h.get("project", ""),
                    "phase": h.get("phase", ""), "branch": t["branch"], "entrypoint": t["entrypoint"],
                    "context": t["context"], "peak": t["peak"], "spend": t["spend"], "turns": t["turns"],
                    "tools": t["tools"], "doing": h.get("doing") or t["doing"],
                    "prompt": t["prompt"], "said": t["said"], "todos": t["todos"], "subagents": subs})
    return out


def _runner():
    """The run-project skill's parser for project files — one reader of the format, the runner's own."""
    path = HERE.parent / "run-project" / "run.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("run_project", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.PROJECTS = PROJECTS
    return mod


RUNNER = _runner()
LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")


def tasks(steps: str) -> list[str]:
    """A phase's numbered *Steps* cell as its tasks — ``1. … 2. …`` split where the numbers run in order."""
    text, out, start, n = LINK.sub(r"\1", steps), [], None, 1
    for m in re.finditer(r"(?:^|\s)(\d+)\.\s+", text):
        if int(m.group(1)) != n:  # "1.12" or "§3." inside a step is not a new step
            continue
        if start is not None:
            out.append(text[start:m.start()].strip())
        start, n = m.end(), n + 1
    if start is not None:
        out.append(text[start:].strip())
    return out or ([text.strip()] if text.strip() and text.strip() != "—" else [])


def project(name: str, live: dict[str, dict], commits: list[str]) -> dict:
    """One project: its header, every phase with its steps → parts → sessions, reviews, notes and questions."""
    p = RUNNER.Project(name)
    records: dict[str, dict] = {}
    ledger = LIVE / "projects" / f"{name}.jsonl"
    for line in ledger.read_text().splitlines() if ledger.exists() else []:
        with contextlib.suppress(ValueError, KeyError):
            r = json.loads(line)
            records.setdefault(r["session"], {}).update(r)  # a session's start record, then its end record
    for sid, s in live.items():  # a session the hook tied to this project but the ledger has not seen yet
        if s["project"] == name and sid not in records:
            records[sid] = {"session": sid, "phase": s["phase"], "step": "session", "part": 1, "started": s["at"]}
    notes: dict[str, list[str]] = {}
    for r in p.rows(p.section("Hand-off notes")):
        notes.setdefault(r.get("id", ""), []).append(r.get("note", ""))
    scope = p.get("scope", name)
    phases = []
    for row in p.log():
        pid = row["id"]
        steps: dict[str, list[dict]] = {}
        for r in sorted((r for r in records.values() if r.get("phase") == pid), key=lambda r: r.get("started", 0)):
            s = live.get(r["session"], {})
            ended = "ended" in r
            steps.setdefault(r.get("step", "build"), []).append({
                "session": r["session"], "part": r.get("part", 1), "agent": r.get("agent", ""),
                "state": "finished" if ended else (s.get("state") or "unknown"), "started": r.get("started", 0),
                "ended": r.get("ended"), "peak": r.get("peak") or s.get("peak", 0), "context": s.get("context", 0),
                "handed_off": r.get("handed_off", False), "result": r.get("result", ""),
                "doing": s.get("doing", ""), "todos": s.get("todos", []), "subagents": s.get("subagents", [])})
        reviews = []
        for f in sorted((p.dir / "reviews").glob(f"{pid}-*.md")):
            first = (f.read_text().splitlines() or [""])[0]
            reviews.append({"kind": f.stem[len(pid) + 1:], "result": first.replace("RESULT:", "").strip(),
                            "path": os.path.relpath(f, ROOT)})
        mark = f"({scope}): {pid} "
        entry = p.entry(pid)
        phases.append({"id": pid, "title": row.get("phase", ""), "status": row.get("status", ""),
                       "needs": row["needs_list"], "date": row.get("date", ""), "notes": row.get("notes", ""),
                       "agent": entry.get("agent") or "coder", "reviewer": entry.get("review", "").strip("— "),
                       "tasks": tasks(entry.get("steps", "")), "steps": steps, "reviews": reviews,
                       "handoffs": notes.get(pid, []), "commits": [c for c in commits if mark in c]})
    questions = [q for q in p.rows(p.section("Questions for Ravi")) if q.get("question")]
    pidfile = LIVE / "projects" / f"{name}.pid"
    running = pidfile.exists() and alive(int(pidfile.read_text() or 0)) is not False
    done = sum(ph["status"] == "done" for ph in phases)
    current = next((ph for ph in phases if ph["status"] not in ("done", "pending")), None)
    return {"name": name, "title": (re.search(r"^# (.+)$", p.text, re.M) or [None, name])[1],
            "status": p.get("status"), "branch": p.get("branch"), "scope": scope, "runner": running,
            "done": done, "total": len(phases), "current": current and current["id"], "phases": phases,
            "questions": questions, "open": sum(not q.get("answer") for q in questions),
            "sessions": sorted(records), "spend": sum(live.get(s, {}).get("spend", 0) for s in records)}


def state() -> dict:
    found = sessions()
    live = {s["id"]: s for s in found}
    projects = []
    if RUNNER:
        commits = subprocess.run(["git", "log", "--format=%h %s", "-n", "2000"], cwd=ROOT, text=True,
                                 capture_output=True, check=False).stdout.splitlines()
        for d in sorted(PROJECTS.glob("*/project.md")):
            try:
                projects.append(project(d.parent.name, live, commits))
            except Exception as exc:  # one unreadable project never blanks the page; it shows why
                projects.append({"name": d.parent.name, "error": f"{type(exc).__name__}: {exc}", "sessions": []})
    owned = {sid for pr in projects for sid in pr["sessions"]}
    return {"root": str(ROOT), "limit": LIMIT, "hours": HOURS, "now": time.time(), "projects": projects,
            "sessions": found, "owned": sorted(owned)}


def feed(path: Path, n: int = 80) -> list[dict]:
    """The last ``n`` things a transcript shows: prompts, what was said, each tool call and the head of each result."""
    if not path.exists():
        return []
    lines = path.read_bytes()[-3_000_000:].decode(errors="replace").splitlines()[1:]
    out: list[dict] = []
    for line in lines:
        try:
            e = json.loads(line)
        except ValueError:
            continue
        kind = e.get("type")
        if kind not in ("assistant", "user") or e.get("isMeta"):
            continue
        at, content = e.get("timestamp", ""), (e.get("message") or {}).get("content")
        if isinstance(content, str):
            if content.strip() and not content.lstrip().startswith("<"):
                out.append({"at": at, "kind": "prompt", "text": content.strip()[:1500]})
            continue
        for b in content or []:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "text" and b.get("text", "").strip():
                said = "said" if kind == "assistant" else "prompt"
                out.append({"at": at, "kind": said, "text": b["text"].strip()[:1500]})
            elif b.get("type") == "tool_use":
                name, inp = b.get("name", ""), b.get("input") or {}
                text = what(name, inp)
                if text == name:
                    text = f"{name}: {json.dumps(inp)[:200]}"
                out.append({"at": at, "kind": "tool", "text": text})
            elif b.get("type") == "tool_result":
                r = b.get("content")
                r = r if isinstance(r, str) else " ".join(x.get("text", "") for x in r or [] if isinstance(x, dict))
                out.append({"at": at, "kind": "error" if b.get("is_error") else "result", "text": r.strip()[:400]})
    return out[-n:]


def feed_for(q: dict[str, list[str]]) -> dict:
    sid, agent = q.get("session", [""])[0], q.get("agent", [""])[0]
    if not SID.match(sid) or (agent and not AGENT.match(agent)):
        return {"events": []}
    path = TRANSCRIPTS / sid / "subagents" / f"agent-{agent}.jsonl" if agent else TRANSCRIPTS / f"{sid}.jsonl"
    return {"events": feed(path)}


def page() -> str:
    """The page, read on every request so a change to it shows without a restart."""
    f = HERE / "dashboard.html"
    return f.read_text() if f.exists() else "<p>dashboard.html missing</p>"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/":
            body, kind = page().encode(), "text/html; charset=utf-8"
        elif u.path == "/api/state":
            body, kind = json.dumps(state()).encode(), "application/json"
        elif u.path == "/api/feed":
            body, kind = json.dumps(feed_for(parse_qs(u.query))).encode(), "application/json"
        elif u.path == "/api/ping":
            body, kind = json.dumps({"app": "project-dashboard", "root": str(ROOT)}).encode(), "application/json"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_: object) -> None:
        pass


def running(port: int) -> dict | None:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=1) as r:
            return json.loads(r.read())
    except (OSError, ValueError):
        return None


def start(port: int) -> int:
    """Start the server detached from this shell — it outlives the session that asked — and open it."""
    url = f"http://localhost:{port}"
    ping = running(port)
    if ping and ping.get("app") == "project-dashboard":
        print(f"Already running: {url}")
    else:
        LIVE.mkdir(parents=True, exist_ok=True)
        log = (LIVE / "dashboard.log").open("a")
        kw = {"creationflags": 0x00000008 | 0x00000200} if os.name == "nt" else {"start_new_session": True}
        subprocess.Popen([sys.executable, str(Path(__file__).resolve()), "--port", str(port)], cwd=ROOT,
                         stdout=log, stderr=log, stdin=subprocess.DEVNULL, **kw)
        for _ in range(30):
            if running(port):
                break
            time.sleep(0.2)
        else:
            print(f"Did not start on :{port} — see {LIVE / 'dashboard.log'}")
            return 1
        print(f"Started: {url}")
    webbrowser.open(url)
    return 0


def stop(port: int) -> int:
    pidfile = LIVE / "dashboard.pid"
    if not pidfile.exists():
        print("Not running")
        return 0
    pid = int(pidfile.read_text())
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(pid), "/F"], check=False, capture_output=True)
    else:
        with contextlib.suppress(OSError):
            os.kill(pid, 15)
    pidfile.unlink(missing_ok=True)
    print(f"Stopped :{port}")
    return 0


def check() -> int:
    newest = max(TRANSCRIPTS.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, default=None)
    if not newest:
        print(f"No transcripts in {TRANSCRIPTS}")
        return 1
    t = Transcript(newest).read()
    print(f"{newest.name}: {t['turns']} turns · context {t['context']:,} · model {t['model'] or '—'}"
          f" · title {t['title'] or '—'}")
    if not t["turns"] or not t["model"]:
        print("No assistant turns read — the transcript shape has changed; numbers will be blank.")
        return 1
    if t["unknown"]:
        print("Line types not recognised (skipped):", ", ".join(f"{k} x{v}" for k, v in t["unknown"].items()))
    hooks = list(LIVE.glob("*.json"))
    print(f"{len(hooks)} hooked session(s) in {LIVE}" if hooks
          else "No hook status yet — are the hooks registered? (SKILL.md)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--start", action="store_true", help="start in the background and open the page")
    ap.add_argument("--stop", action="store_true")
    ap.add_argument("--check", action="store_true", help="report transcript shapes this cannot read")
    a = ap.parse_args()
    if a.start:
        return start(a.port)
    if a.stop:
        return stop(a.port)
    if a.check:
        return check()
    LIVE.mkdir(parents=True, exist_ok=True)
    (LIVE / "dashboard.pid").write_text(str(os.getpid()))
    print(f"Project dashboard on http://localhost:{a.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
