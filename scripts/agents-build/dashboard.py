#!/usr/bin/env python3
"""A live dashboard for the Agents build: the phases, the sessions working them, and each session's todos.

Reads what the runner already writes — the runbook's log (``docs/products/agents-build-sessions.md``),
``.migration-cache/<ID>/*.jsonl`` (each headless session's event stream), ``.migration-cache/sessions.md``,
the design reviews and git — every time the page polls. Nothing is stored; standard library only.

Usage::

    python3 scripts/agents-build/dashboard.py            # http://localhost:8765
    python3 scripts/agents-build/dashboard.py --port 9000
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUNBOOK = ROOT / "docs" / "products" / "agents-build-sessions.md"
CACHE = ROOT / ".migration-cache"
REVIEWS = ROOT / "scripts" / "agents-build" / "reviews"
RUN_LOG = CACHE / "agents-run.log"
ID = re.compile(r"^[FI]\d{2}$")


def table(text: str, start: str, end: str | None) -> list[list[str]]:
    """The rows of the markdown table between two headings, header and rule dropped."""
    i = text.find(start)
    if i < 0:
        return []
    chunk = text[i:text.find(end, i) if end and text.find(end, i) > 0 else None]
    rows = [[c.strip() for c in ln.strip().strip("|").split("|")] for ln in chunk.splitlines() if ln.startswith("|")]
    return [r for r in rows[2:] if r]


def phases() -> list[dict]:
    text = RUNBOOK.read_text()
    entries = {}
    for m in re.finditer(r"^### ([FI]\d{2}) · (.+?)\n(.*?)(?=^### |^Later|^## )", text, re.S | re.M):
        body = {r[0]: r[1] for r in table(m.group(3), "| |", None) if len(r) > 1}
        entries[m.group(1)] = {"title": m.group(2), "done_when": body.get("Done when", ""), "lands": body.get("Lands", ""),
                               "boards": body.get("Boards", ""), "steps": body.get("Steps", "")}
    notes = {}
    for r in table(text, "## Hand-off notes", None):
        if len(r) > 1 and ID.match(r[0]):
            notes.setdefault(r[0], []).append(r[1])
    out = []
    for r in table(text, "## Log", "## Hand-off notes"):
        if len(r) < 8 or not ID.match(r[0]):
            continue
        sid = r[0]
        review = REVIEWS / f"{sid}.md"
        verdict = review.read_text().splitlines()[0].strip() if review.exists() and review.read_text().strip() else ""
        out.append({"id": sid, "phase": r[1], "kind": r[2], "needs": r[3], "status": r[5], "date": r[6], "notes": r[7],
                    "review": verdict, "handoffs": notes.get(sid, []), **entries.get(sid, {})})
    return out


def session(path: Path) -> dict:
    """One session's stream: its id, context, todos, sub-agents and latest actions."""
    s = {"label": path.stem, "id": "", "context": 0, "peak": 0, "tools": 0, "finished": False, "todos": [],
         "agents": [], "recent": [], "said": "", "mtime": path.stat().st_mtime}
    tasks: dict[str, dict] = {}
    for line in path.open(errors="replace"):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        s["id"] = s["id"] or e.get("session_id", "")
        if e.get("type") == "result":
            s["finished"] = True
        if e.get("type") != "assistant":
            continue
        u = e["message"].get("usage") or {}
        s["context"] = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        s["peak"] = max(s["peak"], s["context"])
        for b in e["message"].get("content", []):
            if b.get("type") == "text" and b.get("text", "").strip():
                s["said"] = b["text"].strip()[:600]
            if b.get("type") != "tool_use":
                continue
            s["tools"] += 1
            name, inp = b["name"], b.get("input") or {}
            if name == "TodoWrite":
                s["todos"] = [{"text": t.get("content", ""), "status": t.get("status", "pending")} for t in inp.get("todos", [])]
            elif name == "TaskCreate":
                tasks[str(len(tasks) + 1)] = {"text": inp.get("subject") or inp.get("description", ""), "status": "pending"}
            elif name == "TaskUpdate" and str(inp.get("taskId")) in tasks:
                tasks[str(inp["taskId"])]["status"] = inp.get("status", tasks[str(inp["taskId"])]["status"])
            elif name in ("Agent", "Task"):
                s["agents"].append(inp.get("description", ""))
            what = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("pattern") or ""
            s["recent"].append(f"{name}: {str(what)[:140]}")
    if tasks and not s["todos"]:
        s["todos"] = list(tasks.values())
    s["recent"] = s["recent"][-8:]
    return s


def sessions() -> dict[str, list[dict]]:
    out = {}
    for d in sorted(CACHE.glob("*")):
        if d.is_dir() and ID.match(d.name):
            out[d.name] = sorted((session(p) for p in d.glob("*.jsonl")), key=lambda x: x["mtime"])
    return out


def sh(*cmd: str) -> str:
    return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True).stdout.strip()


def state() -> dict:
    runner = sh("pgrep", "-f", "scripts/migration/run.py")
    log = RUN_LOG.read_text(errors="replace").splitlines()[-25:] if RUN_LOG.exists() else []
    return {"phases": phases(), "sessions": sessions(), "runner": bool(runner), "log": log,
            "branch": sh("git", "rev-parse", "--abbrev-ref", "HEAD"),
            "commits": sh("git", "log", "--oneline", "main..HEAD").splitlines(),
            "changed": sh("git", "status", "--short").splitlines()}


PAGE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agents build</title><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#16181d;--mut:#667085;--bd:#e4e7ec;--ok:#12805c;--run:#1f6feb;--warn:#b45309;--bad:#c4302b}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--fg:#e6e8ee;--mut:#98a2b3;--bd:#2a2f3a;--ok:#3fb950;--run:#58a6ff;--warn:#d29922;--bad:#f85149}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bd);background:var(--card);position:sticky;top:0}
h1{font-size:15px;margin:0}main{padding:16px;display:grid;gap:14px;max-width:1500px;margin:auto}
.card{background:var(--card);border:1px solid var(--bd);border-radius:6px}.card>h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:0;padding:10px 12px;border-bottom:1px solid var(--bd)}
.phases{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;padding:12px}
.ph{border:1px solid var(--bd);border-radius:6px;padding:10px;cursor:pointer}.ph.on{outline:2px solid var(--run)}
.ph b{display:block}.mut{color:var(--mut)}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid currentColor}
.done{color:var(--ok)}.in-progress,.partial{color:var(--run)}.blocked{color:var(--bad)}.pending{color:var(--mut)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.grid{grid-template-columns:1fr}}
.pad{padding:12px}ul{margin:6px 0;padding-left:18px}li{margin:2px 0}.todo-completed{color:var(--ok);text-decoration:line-through}.todo-in_progress{color:var(--run);font-weight:600}
.sess{border-top:1px solid var(--bd);padding:12px}.sess:first-of-type{border-top:0}.bar{height:6px;background:var(--bd);border-radius:3px;overflow:hidden;margin:6px 0}.bar i{display:block;height:100%;background:var(--run)}
pre{margin:0;padding:12px;white-space:pre-wrap;overflow:auto;max-height:320px}.dot{width:9px;height:9px;border-radius:50%;display:inline-block}
</style></head><body>
<header><h1>Agents build</h1><span id="runner"></span><span class="mut mono" id="branch"></span><span style="flex:1"></span><span class="mut" id="at"></span></header>
<main>
<section class="card"><h2>Phases</h2><div class="phases" id="phases"></div></section>
<div class="grid">
<section class="card"><h2 id="ptitle">Phase</h2><div class="pad" id="pdetail"></div></section>
<section class="card"><h2>Sessions on this phase</h2><div id="sessions"></div></section>
</div>
<div class="grid">
<section class="card"><h2>Runner log</h2><pre class="mono" id="log"></pre></section>
<section class="card"><h2>Branch</h2><div class="pad" id="git"></div></section>
</div>
</main>
<script>
const LIMIT = 400000; let pick = null;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cls = s => esc(s).replace(/ /g, '-');
const md = s => esc(s).replace(/`([^`]+)`/g, '<span class="mono">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
async function tick() {
  let st; try { st = await (await fetch('/api/state')).json(); } catch { document.getElementById('at').textContent = 'dashboard server unreachable'; return; }
  document.getElementById('runner').innerHTML = st.runner ? '<span class="pill in-progress">runner running</span>' : '<span class="pill blocked">runner stopped</span>';
  document.getElementById('branch').textContent = st.branch;
  document.getElementById('at').textContent = 'updated ' + new Date().toLocaleTimeString();
  const live = st.phases.find(p => p.status === 'in progress' || p.status === 'partial');
  if (!pick) pick = (live || st.phases[0]).id;
  document.getElementById('phases').innerHTML = st.phases.map(p => `<div class="ph ${p.id === pick ? 'on' : ''}" data-id="${p.id}">
    <div style="display:flex;justify-content:space-between"><span class="mono">${p.id}</span><span class="pill ${cls(p.status)}">${esc(p.status)}</span></div>
    <b>${esc(p.phase)}</b><span class="mut">${esc(p.date)}</span>${p.review ? `<div class="${p.review.includes('PASS') ? 'done' : 'blocked'}">${esc(p.review)}</div>` : ''}</div>`).join('');
  document.querySelectorAll('.ph').forEach(el => el.onclick = () => { pick = el.dataset.id; tick(); });
  const p = st.phases.find(x => x.id === pick);
  document.getElementById('ptitle').textContent = `${p.id} · ${p.title || p.phase}`;
  document.getElementById('pdetail').innerHTML = `<p><b>Done when</b><br>${md(p.done_when)}</p><p><b>Lands</b><br>${md(p.lands)}</p>
    ${p.steps ? `<p><b>Steps</b><br>${md(p.steps)}</p>` : ''}<p><b>Boards validated</b><br>${md(p.boards)}</p>
    ${p.notes ? `<p><b>Runner note</b><br>${md(p.notes)}</p>` : ''}
    ${p.handoffs.length ? `<p><b>Hand-off notes</b></p><ul>${p.handoffs.map(h => `<li>${md(h)}</li>`).join('')}</ul>` : ''}`;
  const ss = st.sessions[pick] || [];
  document.getElementById('sessions').innerHTML = ss.length ? ss.slice().reverse().map(s => `<div class="sess">
    <div style="display:flex;gap:8px;align-items:center"><span class="dot" style="background:var(${s.finished ? '--ok' : '--run'})"></span>
      <b>${esc(s.label)}</b><span class="mut">${s.finished ? 'finished' : 'live'}</span><span style="flex:1"></span><span class="mono mut">claude -r ${esc(s.id)}</span></div>
    <div class="mut">context ${s.context.toLocaleString()} · peak ${s.peak.toLocaleString()} of ${LIMIT.toLocaleString()} · ${s.tools} tool calls</div>
    <div class="bar"><i style="width:${Math.min(100, s.peak / LIMIT * 100)}%"></i></div>
    ${s.todos.length ? `<b>Todos</b><ul>${s.todos.map(t => `<li class="todo-${esc(t.status)}">${esc(t.text)}</li>`).join('')}</ul>` : '<div class="mut">No todo list yet — the session has not written one.</div>'}
    ${s.agents.length ? `<b>Sub-agents</b><ul>${s.agents.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    ${s.said ? `<b>Last said</b><div class="mut">${esc(s.said)}</div>` : ''}
    <b>Latest</b><ul class="mono">${s.recent.slice().reverse().map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`).join('')
    : '<div class="pad mut">No session has run this phase yet.</div>';
  document.getElementById('log').textContent = st.log.join('\n');
  document.getElementById('git').innerHTML = `<b>Phase commits</b><ul class="mono">${st.commits.map(c => `<li>${esc(c)}</li>`).join('') || '<li class="mut">none</li>'}</ul>
    <b>Uncommitted</b> <span class="mut">${st.changed.length} files</span><ul class="mono">${st.changed.slice(0, 30).map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
}
tick(); setInterval(tick, 5000);
</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        body, kind = (json.dumps(state()).encode(), "application/json") if self.path.startswith("/api/state") \
            else (PAGE.encode(), "text/html; charset=utf-8")
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_: object) -> None:
        pass


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--port", type=int, default=8765)
    port = ap.parse_args().port
    print(f"Agents build dashboard on http://localhost:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
