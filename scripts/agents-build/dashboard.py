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
import os
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
# The runner's context budget for the lead and every sub-agent, and the grace before it ends a session.
LIMIT = int(os.environ.get("INVANA_MIGRATION_CONTEXT_LIMIT", "300000"))
GRACE = int(os.environ.get("INVANA_RUNNER_HANDOFF_GRACE", "50000"))


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


def part(name: str) -> dict:
    return {"name": name, "model": "", "status": "running", "context": 0, "peak": 0, "turns": 0, "spend": 0,
            "tools": 0, "doing": ""}


def session(path: Path) -> dict:
    """One session's stream: its id, context and spend, todos, sub-agents and latest actions.

    Spend is every turn's context plus its output, summed: each turn re-reads the whole
    context, so this is what a session draws from the usage limit. A message with a
    ``parent_tool_use_id`` belongs to a sub-agent and is counted against that part.
    """
    s = {"label": path.stem, "id": "", "context": 0, "peak": 0, "spend": 0, "model": "", "tools": 0,
         "finished": False, "todos": [], "parts": [], "recent": [], "said": "", "mtime": path.stat().st_mtime}
    tasks: dict[str, dict] = {}
    parts: dict[str, dict] = {}  # Agent tool use id → part
    task_ids: dict[str, str] = {}  # background task id → Agent tool use id
    seen: set[str] = set()
    for line in path.open(errors="replace"):
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        s["id"] = s["id"] or e.get("session_id", "")
        kind, sub = e.get("type"), e.get("subtype")
        if kind == "result":
            s["finished"] = True
        if kind == "system" and sub == "task_started" and e.get("task_type") == "local_agent":
            p = parts.setdefault(e.get("tool_use_id", ""), part(e.get("description", "")))
            p["name"] = p["name"] or e.get("description", "")
            task_ids[e.get("task_id", "")] = e.get("tool_use_id", "")
        elif kind == "system" and sub == "task_progress" and e.get("tool_use_id") in parts:
            p = parts[e["tool_use_id"]]
            p["doing"] = e.get("description", "")
            p["tools"] = (e.get("usage") or {}).get("tool_uses", p["tools"])
        elif kind == "system" and sub == "task_notification" and task_ids.get(e.get("task_id", "")) in parts:
            parts[task_ids[e["task_id"]]]["status"] = e.get("status", "completed")
        if kind != "assistant":
            continue
        msg = e["message"]
        u = msg.get("usage") or {}
        ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        # One API turn can arrive as several events sharing its message id; count it once.
        first = msg.get("id") not in seen
        seen.add(msg.get("id", ""))
        tid = e.get("parent_tool_use_id")
        if tid:
            p = parts.setdefault(tid, part(e.get("task_description", "")))
            p["context"], p["peak"], p["model"] = ctx, max(p["peak"], ctx), msg.get("model", p["model"])
            if first:
                p["turns"] += 1
                p["spend"] += ctx + u.get("output_tokens", 0)
            for b in msg.get("content", []):
                if b.get("type") == "tool_use":
                    inp = b.get("input") or {}
                    what = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("pattern") or ""
                    p["doing"] = f"{b['name']}: {str(what)[:120]}"
            continue
        s["context"], s["model"] = ctx, msg.get("model", s["model"])
        s["peak"] = max(s["peak"], s["context"])
        if first:
            s["spend"] += ctx + u.get("output_tokens", 0)
        for b in msg.get("content", []):
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
                parts.setdefault(b.get("id", ""), part(inp.get("description", "")))
            what = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("pattern") or ""
            s["recent"].append(f"{name}: {str(what)[:140]}")
    if tasks and not s["todos"]:
        s["todos"] = list(tasks.values())
    for p in parts.values():
        if s["finished"] and p["status"] == "running":
            p["status"] = "ended"
    s["parts"] = list(parts.values())
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
            "limit": LIMIT, "hard_stop": LIMIT + GRACE,
            "branch": sh("git", "rev-parse", "--abbrev-ref", "HEAD"),
            "commits": sh("git", "log", "--oneline", "main..HEAD").splitlines(),
            "changed": sh("git", "status", "--short").splitlines()}


PAGE = r"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Agents build</title><style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#16181d;--mut:#667085;--bd:#e4e7ec;--ok:#12805c;--run:#1f6feb;--warn:#b45309;--bad:#c4302b}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a21;--fg:#e6e8ee;--mut:#98a2b3;--bd:#2a2f3a;--ok:#3fb950;--run:#58a6ff;--warn:#d29922;--bad:#f85149}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
header{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bd);background:var(--card);position:sticky;top:0}
h1{font-size:15px;margin:0}main{padding:16px;display:grid;grid-template-columns:minmax(0,1fr);gap:14px;max-width:1500px;margin:auto}
.card,.sess,li{min-width:0;overflow-wrap:anywhere}
.card{background:var(--card);border:1px solid var(--bd);border-radius:6px}.card>h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);margin:0;padding:10px 12px;border-bottom:1px solid var(--bd)}
.phases{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;padding:12px}
.ph{border:1px solid var(--bd);border-radius:6px;padding:10px;cursor:pointer}.ph.on{outline:2px solid var(--run)}
.ph b{display:block}.mut{color:var(--mut)}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid currentColor}
.done{color:var(--ok)}.in-progress,.partial{color:var(--run)}.blocked{color:var(--bad)}.pending{color:var(--mut)}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}@media(max-width:900px){.grid{grid-template-columns:minmax(0,1fr)}}
.row{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{text-align:left;padding:4px 6px;border-top:1px solid var(--bd);vertical-align:top}
th{font-weight:600;color:var(--mut);font-size:11px;white-space:nowrap}td.nw{white-space:nowrap;overflow-wrap:normal}td.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.bar.sm{height:4px;min-width:60px}.bar.over i{background:var(--warn)}.bar.kill i{background:var(--bad)}
.completed{color:var(--ok)}.running{color:var(--run)}.failed,.killed{color:var(--bad)}.stopped,.ended{color:var(--warn)}
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
let LIMIT = 300000, HARD = 350000, pick = null;
const tok = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'k';
const meter = (peak, sm) => `<div class="bar ${sm ? 'sm' : ''} ${peak > HARD ? 'kill' : peak > LIMIT ? 'over' : ''}"><i style="width:${Math.min(100, peak / HARD * 100)}%"></i></div>`;
const partsTable = ps => !ps.length ? '' : `<b>Sub-agents (${ps.length})</b><div class="scroll"><table>
  <tr><th>Part</th><th>Status</th><th>Model</th><th>Context · peak</th><th>Turns</th><th>Spend</th><th>Now</th></tr>
  ${ps.map(p => `<tr><td>${esc(p.name)}</td><td class="nw ${cls(p.status)}">${esc(p.status)}</td><td class="nw mono">${esc(p.model.replace('claude-', ''))}</td>
    <td class="n">${tok(p.context)} · ${tok(p.peak)}${meter(p.peak, true)}</td><td class="n">${p.turns}</td><td class="n">${tok(p.spend)}</td>
    <td class="mut">${esc(p.doing)}</td></tr>`).join('')}</table></div>`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cls = s => esc(s).replace(/ /g, '-');
const md = s => esc(s).replace(/`([^`]+)`/g, '<span class="mono">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
async function tick() {
  let st; try { st = await (await fetch('/api/state')).json(); } catch { document.getElementById('at').textContent = 'dashboard server unreachable'; return; }
  LIMIT = st.limit; HARD = st.hard_stop;
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
    <div class="row"><span class="dot" style="background:var(${s.finished ? '--ok' : '--run'})"></span>
      <b>${esc(s.label)}</b><span class="mut">${s.finished ? 'finished' : 'live'}</span><span class="mono mut">${esc(s.model.replace('claude-', ''))}</span><span style="flex:1"></span><span class="mono mut">claude -r ${esc(s.id)}</span></div>
    <div class="mut">context ${tok(s.context)} · peak ${tok(s.peak)} · hand-off at ${tok(LIMIT)}, ended at ${tok(HARD)} · ${s.tools} tool calls
      · spend ${tok(s.spend)}${s.parts.length ? ` + sub-agents ${tok(s.parts.reduce((a, p) => a + p.spend, 0))}` : ''}</div>
    ${meter(s.peak)}
    ${s.todos.length ? `<b>Todos</b><ul>${s.todos.map(t => `<li class="todo-${esc(t.status)}">${esc(t.text)}</li>`).join('')}</ul>` : '<div class="mut">No todo list yet — the session has not written one.</div>'}
    ${partsTable(s.parts)}
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
