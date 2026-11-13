#!/usr/bin/env python3
"""Run a project unattended — phase after phase: build, hand-offs, gates, reviews, fixes, commit.

A project is ``.claude/team/projects/<name>/project.md`` (the format is ``project-template.md`` beside this file).
The runner never decides *what* to build: it picks the first phase in the project's log whose *Needs* are done and
hands that one entry to a fresh headless session. Everything that decides whether the phase counts as done happens
here, outside the agent:

| Step | What |
|---|---|
| Build | ``claude -p --agent <Agent>`` with ``prompts/build.md``; past the context limit the session hands off \
(row ``partial``) and a fresh one continues from its note, up to ``--max-handoffs`` times |
| Setup · gates | The project's *Setup* and *Gates* tables, re-run here. A gate's known failures pass |
| Reviews | One ``qa`` session per kind the entry's *Review* names (``code``, ``design``), each writing \
``.agent-reports/qa/<project>-<ID>-<kind>.md`` that starts ``RESULT: PASS`` or ``FAIL`` |
| Fix | Failures go to ``prompts/fix.md``, up to ``--max-fix`` rounds; then the phase is ``blocked`` |
| Exit | A missing report, a ``pm`` or ``env`` finding, the same findings two rounds running, or a changed story \
blocks at once; after an investigate re-run, 2 fix rounds, then the final stop |
| Branch | Each phase is built on ``<project>/<ID>-<slug>``, cut from the last done phase's branch (the first from the \
project's ``branch``); a stopped run resumes on it, and every step commits there |
| Close | The row becomes ``done``; the runner commits ``feat(<scope>): <ID> · <phase>`` on the phase branch. It never \
merges and never pushes |

Each session runs with ``INVANA_PROJECT`` · ``INVANA_PHASE`` · ``INVANA_STEP`` · ``INVANA_PART`` set, so the
project-dashboard hook files it under its phase; the runner also appends one record per session to
``.claude/team/.live/projects/<name>.jsonl``. A project folder may hold its own ``prompts/<name>.md`` to replace one
of the prompts here.

Resumable: the log is the only state. Run it again and it continues from the first unfinished phase.

Usage::

    python3 .claude/skills/run-project/run.py <name>             # run until done or blocked
    python3 .claude/skills/run-project/run.py <name> --start     # the same, detached; log in .claude/team/.live/
    python3 .claude/skills/run-project/run.py <name> --only P02  # one phase
    python3 .claude/skills/run-project/run.py <name> --dry-run   # what would run next
    python3 .claude/skills/run-project/run.py <name> --stop
"""
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or HERE.parents[2])
PROJECTS = ROOT / ".claude" / "team" / "projects"
REVIEWS = ROOT / ".agent-reports" / "qa"
LIVE = ROOT / ".claude" / "team" / ".live" / "projects"
CONTEXT_LIMIT = int(os.environ.get("INVANA_CONTEXT_LIMIT", "300000"))
GRACE = int(os.environ.get("INVANA_RUNNER_HANDOFF_GRACE", "50000"))
LEAD_MODEL = os.environ.get("INVANA_RUNNER_LEAD_MODEL", "")
CHEAP_MODEL = os.environ.get("INVANA_RUNNER_CHEAP_MODEL", "sonnet")
GATE_TIMEOUT = float(os.environ.get("INVANA_RUNNER_GATE_TIMEOUT", "1800"))
SHOOT = ROOT / ".claude" / "skills" / "design-qa" / "shoot.mjs"
SCREEN_MAP = SHOOT.with_name("screen-map.json")
SHOT_THRESHOLD = float(os.environ.get("INVANA_RUNNER_SHOT_THRESHOLD", "0.005"))  # share of pixels a board may change
ID = re.compile(r"^[A-Z]\d{2}[a-z]?$")
TRAILER = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

# Tools a headless session may use. Widen deliberately; never `--dangerously-skip-permissions`
# outside a disposable container (set INVANA_RUNNER_SANDBOX=1 there).
ALLOWED_TOOLS = [
    "Read", "Edit", "Write", "Glob", "Grep", "Agent", "Skill",
    "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git mv *)", "Bash(git show *)",
    "Bash(git add *)", "Bash(git commit --no-verify *)", "Bash(git -C * add *)", "Bash(git -C * commit --no-verify *)",
    "Bash(pnpm *)", "Bash(node *)", "Bash(npx playwright *)", "Bash(uv run *)", "Bash(python3 *)", "Bash(make *)",
    "Bash(docker compose *)", "Bash(ls *)", "Bash(mkdir *)", "Bash(rm -rf node_modules/.vite*)",
    "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(grep *)", "Bash(rg *)", "Bash(find *)",
    "Bash(sed -n *)", "Bash(jq *)", "Bash(curl *)", "Bash(sort *)", "Bash(uniq *)", "Bash(diff *)",
    "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TaskStop",
]

COMMIT = ("Keep your plan in the todo list (TodoWrite) — the project dashboard shows it. Commit each finished step "
          "yourself (only the lead, never a sub-agent, never mid-file): run exactly two Bash calls from the repo root, "
          "each on its own — `git add -A`, then `git commit --no-verify -m \"wip({scope}): {id} · step N — <what>\" "
          f"-m \"{TRAILER}\"`. No `cd`, no `&&` or `;`, no `$(…)`, no heredoc: a compound command needs an approval "
          "nobody is here to give. You are on this phase's own branch, which the runner checked out: never switch, "
          "create or merge branches. Never amend, rebase, reset, push or open a PR, never edit a known-failures file, "
          "and never set your own row to `done`.")
HANDOFF = ("Context budget reached: this session has used more than {limit:,} tokens of context. Stop at the next "
           "clean point — finish or revert the file you are editing so the tree compiles; start nothing new. "
           "Set {id}'s log row to `partial`, add a hand-off note saying exactly where the next session resumes "
           "(files done, files left, the next step), commit, and stop. A fresh session continues from your note.")
PART_HANDOFF = ("Sub-agent '{name}' has passed {limit:,} tokens of context. Stop it with TaskStop (its edits stay on "
                "disk), write its hand-off yourself — the files it owns, what `git diff` shows it changed, what its "
                "brief still lists — and launch one fresh sub-agent with the brief plus that hand-off, or finish it "
                "yourself if it is small.")
AUDIT = ("This phase is QA work, not a build: prove what is true by running the stack, the tests and the screens, and "
         "record each verdict with its evidence in the report the entry's Done when names ({report} if none). Write "
         "nothing else — no code, tests or docs — and never commit. What should be added (a missing test, an unproven "
         "claim, a follow-up) is raised with the `recommend` skill, `--raised-in \"phase {where}\"`.\n\n")
LIMIT_RETRY = ("A previous attempt was cut off by a usage limit. Check `git log` and `git status` for what it already "
               "did, do not redo it, and carry on.\n\n")


# ── the project file ───────────────────────────────────────────────────────
class Project:
    """One project file: its frontmatter, phase entries, setup and gate tables, and the log the runner owns."""

    def __init__(self, name: str) -> None:
        self.name, self.dir = name, PROJECTS / name
        self.file = self.dir / "project.md"
        if not self.file.exists():
            raise SystemExit(f"No project at {self.file.relative_to(ROOT)}")

    @property
    def text(self) -> str:
        return self.file.read_text()

    def meta(self) -> dict[str, str]:
        m = re.match(r"^---\n(.*?)\n---\n", self.text, re.S)
        return dict(ln.split(":", 1) for ln in m.group(1).splitlines() if ":" in ln) if m else {}

    def get(self, key: str, default: str = "") -> str:
        return {k.strip(): v.strip() for k, v in self.meta().items()}.get(key, default)

    def set_meta(self, key: str, value: str) -> None:
        text = self.text
        text, n = re.subn(rf"^({key}:).*$", rf"\1 {value}", text, count=1, flags=re.M)
        if n:
            self.file.write_text(text)

    def section(self, title: str) -> str:
        m = re.search(rf"^## {re.escape(title)}\n(.*?)(?=^## |\Z)", self.text, re.S | re.M)
        return m.group(1) if m else ""

    @staticmethod
    def rows(chunk: str) -> list[dict[str, str]]:
        """A section's first table, as dicts keyed by its header row."""
        lines = [ln for ln in chunk.splitlines() if ln.startswith("|")]
        if len(lines) < 2:
            return []
        cells = lambda ln: [c.strip() for c in ln.strip().strip("|").split("|")]  # noqa: E731
        head = [h.lower() for h in cells(lines[0])]
        return [dict(zip(head, cells(ln), strict=True)) for ln in lines[2:] if len(cells(ln)) == len(head)]

    def environment(self) -> dict[str, str]:
        """The project's *Environment* table: set for the runner, so every gate and session inherits it."""
        return {r["name"].strip("`"): r["value"].strip("`") for r in self.rows(self.section("Environment"))
                if r.get("name") and not r["name"].startswith("`<")}

    def boards(self, pid: str) -> list[str]:
        """The screen-map boards a phase's entry names under *Boards*: `x*` is a prefix, `(not …)` excludes."""
        line = self.entry(pid).get("boards", "")
        if "`" not in line or not SCREEN_MAP.exists():
            return []
        names = list(json.loads(SCREEN_MAP.read_text())["boards"])
        drop = " ".join(re.findall(r"\(not ([^)]*)\)", line))
        keep = re.sub(r"\(not [^)]*\)", "", line)
        kept = {n for pat in re.findall(r"`([^`]+)`", keep) for n in names
                if (n.startswith(pat[:-1]) if pat.endswith("*") else n == pat)}
        # An exclusion may be a partial name (`run.remote*` inside `agents.run.*`), so it matches anywhere.
        dropped = {n for pat in re.findall(r"`([^`]+)`", drop) for n in names if pat.rstrip("*") in n}
        return sorted(kept - dropped)

    def log(self) -> list[dict[str, str]]:
        out = []
        for r in self.rows(self.section("Log")):
            if ID.match(r.get("id", "")):
                r["needs_list"] = [n.strip() for n in r.get("needs", "").split(",") if n.strip() not in ("", "—")]
                out.append(r)
        return out

    def status_of(self, pid: str) -> str:
        return next((r["status"] for r in self.log() if r["id"] == pid), "")

    def set_status(self, pid: str, status: str, note: str = "") -> None:
        text = self.text
        start = text.index("## Log")
        end = text.find("\n## ", start + 1)
        end = len(text) if end < 0 else end
        lines = text[start:end].split("\n")
        head = None
        for i, ln in enumerate(lines):
            if not ln.startswith("|"):
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if head is None:
                head = [h.lower() for h in cells]
                continue
            if cells and cells[0] == pid and len(cells) == len(head):
                row = dict(zip(head, cells, strict=True))
                row["status"], row["date"] = status, dt.date.today().isoformat()
                if note and "notes" in row:
                    row["notes"] = note.replace("|", "/").replace("\n", " ")[:200]
                lines[i] = "| " + " | ".join(row[h] for h in head) + " |"
        self.file.write_text(text[:start] + "\n".join(lines) + text[end:])

    def entry(self, pid: str) -> dict[str, str]:
        m = re.search(rf"^### {re.escape(pid)} · (.+?)\n(.*?)(?=^### |^## |\Z)", self.text, re.S | re.M)
        if not m:
            return {}
        body = {}
        for ln in m.group(2).splitlines():
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if ln.startswith("|") and len(cells) >= 2 and cells[0] and not set(cells[0]) <= {"-"}:
                body[cells[0].lower()] = cells[1]
        return {"title": m.group(1), **body}

    def commands(self, title: str, pid: str) -> list[dict[str, str]]:
        """The Setup or Gates rows that apply to a phase."""
        out = []
        for r in self.rows(self.section(title)):
            if r.get("command", "").startswith("`<") or not r.get("command"):
                continue
            if applies(r.get("phases", "all"), pid):
                r["cmd"] = r["command"].strip("`")
                r["in"] = r.get("in", ".").strip("`") or "."
                out.append(r)
        return out

    def prompt(self, name: str, **values: str) -> str:
        own = self.dir / "prompts" / f"{name}.md"
        text = (own if own.exists() else HERE / "prompts" / f"{name}.md").read_text()
        values = {"PROJECT": self.name, "FILE": str(self.file.relative_to(ROOT)),
                  "COMMIT": COMMIT.format(scope=self.get("scope", self.name), id=values.get("ID", "")), **values}
        for k, v in values.items():
            text = text.replace("{{" + k + "}}", v)
        return text


def applies(phases: str, pid: str) -> bool:
    for p in (x.strip() for x in phases.split(",")):
        if p in ("all", "") or p == pid or (p.endswith("*") and pid.startswith(p[:-1])):
            return True
    return False


# ── shell ──────────────────────────────────────────────────────────────────
def sh(cmd: list[str] | str, cwd: Path = ROOT, timeout: float | None = None) -> subprocess.CompletedProcess:
    """Run a command; past ``timeout`` its process group is killed and it returns 124 with what it wrote."""
    shell = isinstance(cmd, str)
    print("  $", cmd if shell else " ".join(cmd), f"  (in {cwd.relative_to(ROOT) if cwd != ROOT else '.'})", flush=True)
    kw = {"start_new_session": True} if os.name != "nt" else {}
    proc = subprocess.Popen(cmd, cwd=cwd, shell=shell, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        if os.name != "nt":
            os.killpg(proc.pid, signal.SIGKILL)
        else:
            proc.kill()
        out, err = proc.communicate()
        return subprocess.CompletedProcess(cmd, 124, out, err + f"\n\nTimed out after {timeout / 60:.0f} min.\n")
    return subprocess.CompletedProcess(cmd, proc.returncode, out, err)


def git_clean(ignore: Path | None = None) -> bool:
    """No uncommitted change — besides ``ignore``, the project file whose status the runner itself writes."""
    skip = str(ignore.relative_to(ROOT)) if ignore else None
    lines = sh(["git", "status", "--porcelain", "--untracked-files=all"]).stdout.splitlines()
    return all(ln[2:].strip() == skip for ln in lines if ln.strip())


def checkpoint(p: Project, pid: str, what: str) -> None:
    """Commit what a session left uncommitted as a `wip` commit; hooks skipped, the closing commit runs them."""
    if git_clean():
        return
    sh(["git", "add", "-A"])
    sh(["git", "commit", "--no-verify", "-m", f"wip({p.get('scope', p.name)}): {pid} · {what}\n\n{TRAILER}"])


def branch_exists(branch: str) -> bool:
    return sh(["git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"]).returncode == 0


def switch(p: Project, branch: str) -> None:
    """Check out ``branch``, creating it from HEAD when it does not exist.

    Outside a phase the runner writes only the project file's frontmatter status, and sets it again after the switch,
    so an existing branch is checked out over that one uncommitted edit; a new branch carries it.
    """
    if not branch or sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip() == branch:
        return
    if branch_exists(branch):
        sh(["git", "checkout", "--", str(p.file.relative_to(ROOT))])
        res = sh(["git", "checkout", branch])
    else:
        res = sh(["git", "checkout", "-b", branch])
    if res.returncode != 0:
        raise RuntimeError(f"could not check out {branch}: {res.stderr.strip()[:500]}")


def phase_branch(p: Project, pid: str) -> str:
    """``<project>/<ID>-<slug of the phase title>`` — every phase is built on its own branch."""
    title = next((r["phase"] for r in p.log() if r["id"] == pid), "")
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40].rstrip("-")
    return f"{p.name}/{pid}-{slug}" if slug else f"{p.name}/{pid}"


def enter_phase(p: Project, pid: str) -> None:
    """Check out the phase's branch — the one a stopped run left, or a new one.

    A new phase branch is cut from the branch of the last done phase in the log, so the phases stack and each holds
    the work before it; the first is cut from the project branch. The runner never merges: Ravi merges when he asks.
    """
    branch = phase_branch(p, pid)
    if not branch_exists(branch):
        done = [phase_branch(p, r["id"]) for r in p.log() if r["status"] == "done"]
        switch(p, next((b for b in reversed(done) if branch_exists(b)), p.get("branch")))
    switch(p, branch)


# ── one headless session ───────────────────────────────────────────────────
def ledger(p: Project, record: dict) -> None:
    LIVE.mkdir(parents=True, exist_ok=True)
    with (LIVE / f"{p.name}.jsonl").open("a") as f:
        f.write(json.dumps(record) + "\n")


def claude(p: Project, text: str, pid: str, step: str, part: int, agent: str, model: str = "") -> str:
    """Run a session; when a usage limit refuses it, wait for the reset and run it again."""
    for _ in range(9):
        result, resets_at = session(p, text, pid, step, part, agent, model)
        if resets_at is None:
            return result
        wait = max(0, resets_at - time.time()) + 60
        print(f"  {pid} {step}: usage limit — waiting {wait / 60:.0f} min for the reset", flush=True)
        time.sleep(wait)
        text = LIMIT_RETRY + text.removeprefix(LIMIT_RETRY)
    raise RuntimeError(f"{pid} {step}: refused by the usage limit nine times")


def budget(p: Project, pid: str) -> int:
    """The phase's context budget: its entry's ``Budget`` row (``400k``), else ``CONTEXT_LIMIT``."""
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(k|m)?", p.entry(pid).get("budget", "").strip().lower())
    return int(float(m.group(1)) * {"k": 1e3, "m": 1e6}.get(m.group(2) or "", 1)) if m else CONTEXT_LIMIT


def session(p: Project, text: str, pid: str, step: str, part: int, agent: str,
            model: str) -> tuple[str, float | None]:
    """One headless session in a fresh context, watched for context size.

    The context in use is input + cache-read + cache-written tokens of each assistant message. A message with a
    ``parent_tool_use_id`` is a sub-agent's. Past the phase's ``budget`` the lead is asked to hand off, or to hand off
    the sub-agent; anyone past the budget plus ``GRACE`` ends the session and the row is set ``partial``.
    """
    cmd = ["claude", "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]
    if agent:
        cmd += ["--agent", agent]
    if model:
        cmd += ["--model", model]
    if os.environ.get("INVANA_RUNNER_SANDBOX") == "1":
        cmd.append("--dangerously-skip-permissions")
    else:
        cmd += ["--permission-mode", "acceptEdits", "--allowedTools", *ALLOWED_TOOLS]
    limit = budget(p, pid)
    hard_stop = limit + GRACE
    env = {**os.environ, "INVANA_CONTEXT_LIMIT": str(limit), "INVANA_PROJECT": p.name, "INVANA_PHASE": pid,
           "INVANA_STEP": step, "INVANA_PART": str(part), "CLAUDE_CODE_SUBAGENT_MODEL": CHEAP_MODEL}
    proc = subprocess.Popen(cmd, cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, env=env)

    def send(msg: str) -> None:
        proc.stdin.write(json.dumps({"type": "user", "message": {"role": "user", "content": msg}}) + "\n")
        proc.stdin.flush()

    send(text)
    started, sid, peak, result, resets_at, warned, killed = time.time(), "", 0, "", None, False, ""
    running: set[str] = set()
    parts: dict[str, str] = {}
    stopped: set[str] = set()
    for line in proc.stdout:
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not sid and e.get("session_id"):
            sid = e["session_id"]
            print(f"  {pid} {step} part {part}: session {sid}  (claude -r {sid})", flush=True)
            ledger(p, {"phase": pid, "step": step, "part": part, "agent": agent, "session": sid, "started": started})
        kind, sub = e.get("type"), e.get("subtype")
        if kind == "assistant":
            u = e["message"].get("usage") or {}
            ctx = sum(u.get(k, 0) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
            tid = e.get("parent_tool_use_id")
            if ctx > hard_stop:
                killed = f"sub-agent '{parts.get(tid, tid)}'" if tid else "the lead"
                break
            if tid and ctx > limit and tid not in stopped:
                send(PART_HANDOFF.format(name=parts.get(tid, tid), limit=limit))
                stopped.add(tid)
            elif not tid:
                peak = max(peak, ctx)
                if ctx > limit and not warned:
                    print(f"  {pid} {step}: context {ctx:,} — asking for a hand-off", flush=True)
                    send(HANDOFF.format(limit=limit, id=pid))
                    warned = True
        elif kind == "rate_limit_event":
            info = e.get("rate_limit_info") or {}
            if info.get("status") == "rejected" and info.get("resetsAt"):
                resets_at = float(info["resetsAt"])
        elif kind == "system" and sub == "background_tasks_changed":
            running = {t.get("task_id") for t in e.get("tasks") or []}
        elif kind == "system" and sub == "task_started":
            running.add(e.get("task_id"))
            if e.get("tool_use_id"):
                parts[e["tool_use_id"]] = e.get("description", "")
        elif kind == "system" and (sub in ("task_notification", "task_completed", "task_finished")
                                   or e.get("status") in ("completed", "failed", "killed", "stopped")):
            running.discard(e.get("task_id"))
        elif kind == "result":
            result = e.get("result", "") or ""
            if not running:  # a lead's turn also ends while it waits on background sub-agents
                break
    proc.stdin.close()
    if killed:
        print(f"  {pid} {step}: {killed} passed {hard_stop:,} tokens — ending the session", flush=True)
        proc.terminate()
        if step != "review":
            p.set_status(pid, "partial", f"stopped by the runner: {killed} passed {hard_stop:,} tokens of context")
    try:
        proc.wait(timeout=120)
    except subprocess.TimeoutExpired:
        proc.terminate()
        proc.wait()
    ledger(p, {"phase": pid, "step": step, "part": part, "agent": agent, "session": sid, "started": started,
               "ended": time.time(), "peak": peak, "handed_off": warned or bool(killed),
               "result": "limit" if resets_at else ("stopped" if killed else "ok")})
    return result, resets_at


def until_handoffs_end(p: Project, pid: str, first: str, step: str, agent: str, model: str, max_handoffs: int) -> None:
    """Run a step; while it ends `partial` (a hand-off), continue in a fresh session from the note.

    A continuing session that commits nothing and leaves the tree clean found nothing left to do; it cannot always
    clear `partial` itself (a headless session may not edit the project file), so the runner counts the step built.
    """
    claude(p, first, pid, step, 1, agent, model)
    reclaim(p, pid)
    checkpoint(p, pid, f"{step} session 1")
    for n in range(2, max_handoffs + 2):
        if p.status_of(pid) != "partial":
            return
        print(f"  {pid} handed off — part {n}", flush=True)
        before = sh(["git", "rev-parse", "HEAD"]).stdout.strip()
        claude(p, p.prompt("continue", ID=pid), pid, step, n, agent, model)
        reclaim(p, pid)
        if p.status_of(pid) == "partial" and git_clean() and sh(["git", "rev-parse", "HEAD"]).stdout.strip() == before:
            print(f"  {pid} part {n} changed nothing — {step} counted as built", flush=True)
            p.set_status(pid, "in progress")
            return
        checkpoint(p, pid, f"{step} session {n}")
    if p.status_of(pid) == "partial":
        raise RuntimeError(f"still partial after {max_handoffs} hand-offs")


def reclaim(p: Project, pid: str) -> None:
    """Undo what only the runner decides: a session's own `done`, and edits to a known-failures file."""
    if p.status_of(pid) == "done":
        p.set_status(pid, "in progress")
    for path in p.dir.glob("*.json"):
        rel = str(path.relative_to(ROOT))
        if sh(["git", "diff", "--quiet", "HEAD", "--", rel]).returncode != 0:
            sh(["git", "checkout", "HEAD", "--", rel])


# ── gates ──────────────────────────────────────────────────────────────────
SEP = "\u203a"  # the separator Playwright and knip print
FAILED_TEST = re.compile(rf"^\s+\[\w+\] {SEP} (\S+?):\d+:\d+ {SEP} (.+?)[\s─]*$")
KNIP_SECTION = re.compile(r"^([A-Z][a-z]+(?: [a-z]+)*) \(\d+\)$")


def failing_items(cmd: str, output: str) -> set[str]:
    """What an e2e (Playwright line reporter) or knip run reports failing, keyed so a moved file keeps its key."""
    items: set[str] = set()
    if "e2e" in cmd:
        failed = False
        for line in output.splitlines():
            if re.match(r"^\s+\d+ failed$", line):
                failed = True
            elif failed and (m := FAILED_TEST.match(line)):
                items.add(f"e2e {SEP} {Path(m.group(1)).name} {SEP} {m.group(2)}")
            elif failed:
                failed = False
    elif "knip" in cmd:
        section = ""
        for line in output.splitlines():
            if m := KNIP_SECTION.match(line.strip()):
                section = m.group(1)
            elif section and line.strip() and not line.startswith(("$", "[", " ")):
                items.add(f"knip {SEP} {section} {SEP} {line.split()[0]}")
    return items


def gates(p: Project, pid: str) -> list[str]:
    failures = []
    for g in p.commands("Gates", pid):
        res = sh(g["cmd"], ROOT / g.get("in", "."), timeout=GATE_TIMEOUT)
        if res.returncode == 0:
            continue
        out = res.stdout + res.stderr
        known_file = g.get("known failures", "").strip("`")
        known_path = p.dir / known_file if known_file else None
        known = set(json.loads(known_path.read_text())) if known_path and known_path.exists() else set()
        items = failing_items(g["cmd"], out)
        if items and not items - known:
            print(f"  gate {g.get('gate')}: only known failures ({len(items)}) — passes", flush=True)
            continue
        new = "\n".join(f"- {i}" for i in sorted(items - known))
        failures.append(f"Gate `{g.get('gate')}` (`{g['cmd']}`) failed:" + (f"\n\nNew failures:\n{new}" if new else "")
                        + f"\n```\n{out[-4000:]}\n```")
    return failures


def setup(p: Project, pid: str) -> str:
    for s in p.commands("Setup", pid):
        res = sh(s["cmd"], ROOT / s.get("in", "."), timeout=GATE_TIMEOUT)
        if res.returncode != 0:
            return f"setup `{s.get('step')}` failed: {(res.stdout + res.stderr)[-300:]}"
    return ""


# ── screenshot regression ─────────────────────────────────────────────────
def shots(p: Project) -> Path:
    return LIVE / p.name / "shots"


def regression(p: Project, pid: str) -> str:
    """Shoot every done phase's boards live and pixel-diff them against their accepted shots.

    Only boards past ``SHOT_THRESHOLD`` reach the design reviewer, so a phase is not paid for by re-viewing every
    earlier board. Returns the reviewer's instructions.
    """
    boards = sorted({b for r in p.log() if r["status"] == "done" and r["id"] != pid for b in p.boards(r["id"])}
                    - set(p.boards(pid)))
    if not boards:
        return "No earlier phase names boards; there is no regression set."
    out = shots(p) / pid / "regression"
    shutil.rmtree(out, ignore_errors=True)
    sh(["node", str(SHOOT), "--live", "--boards", ",".join(boards), "--out", str(out)])
    sh(["node", str(SHOOT), "--diff", str(shots(p) / "accepted"), "--out", str(out)])
    diff = json.loads((out / "diff.json").read_text()) if (out / "diff.json").exists() else {}
    changed = [b for b, v in diff.items() if v == "new" or v > SHOT_THRESHOLD]
    if not changed:
        return f"The runner shot {len(diff)} boards of done phases; none changed against the accepted shots."
    rows = "\n".join(f"- `{b}`: " + ("no accepted shot yet — compare it with its board" if diff[b] == "new"
                                      else f"{diff[b]:.1%} of pixels changed") for b in changed)
    return (f"The runner shot {len(diff)} boards of done phases into `{out.relative_to(ROOT)}` and diffed them against "
            f"`{(shots(p) / 'accepted').relative_to(ROOT)}`; {len(diff) - len(changed)} are unchanged — do not view them. "
            "These changed: view each once beside its accepted shot. A board that lost a region, column, tab, act or "
            f"state, or shows an error or a blank page, is a blocker; data drift is not.\n{rows}")


def accept_shots(p: Project, pid: str) -> None:
    """A passed phase's boards, and the regression set it was judged on, become the accepted shots."""
    accepted = shots(p) / "accepted"
    accepted.mkdir(parents=True, exist_ok=True)
    reg = shots(p) / pid / "regression"
    for png in reg.glob("*.png") if reg.exists() else []:
        shutil.copy2(png, accepted / png.name)
    if boards := p.boards(pid):
        sh(["node", str(SHOOT), "--live", "--boards", ",".join(boards), "--out", str(accepted)])


def review(p: Project, pid: str, kind: str) -> Path:
    """Where a phase's QA report lives: ``.agent-reports/qa/<project>-<ID>-<kind>.md``."""
    return REVIEWS / f"{p.name}-{pid}-{kind}.md"


def verdict(report: Path) -> str:
    """``PASS`` or ``FAIL`` from line 1; ``""`` when the report is missing or line 1 is neither."""
    first = (report.read_text().lstrip().splitlines() or [""])[0].strip().upper() if report.exists() else ""
    return next((v for v in ("PASS", "FAIL") if first == f"RESULT: {v}"), "")


OWNERS = ("coder", "pm", "env")


def blockers(text: str) -> list[dict[str, str]]:
    """The *Findings* table's blocker rows, each with its ``owner`` (``coder`` · ``pm`` · ``env``) and ``where``.

    An owner the runner cannot read counts as ``pm``: an unclear finding goes to the product-manager, never to a fix.
    """
    m = re.search(r"^## Findings\n(.*?)(?=^## |\Z)", text, re.S | re.M)
    rows = Project.rows(m.group(1)) if m else []
    out = []
    for r in rows:
        if "blocker" not in r.get("severity", "").lower():
            continue
        owner = r.get("owner", "").strip("` ").lower()
        out.append({**r, "owner": owner if owner in OWNERS else "pm", "where": r.get("where", "").strip()})
    return out


def qa(p: Project, pid: str) -> tuple[str, str]:
    """QA the phase into one report, ``.agent-reports/qa/<project>-<ID>-qa.md``, in two fresh ``qa`` sessions.

    Pass 1 proves the build — the tests the change needs (engine, Studio, end to end, agent evals), then the code
    review — and writes the report. Pass 2, only when the entry names boards, is design QA with the regression set; it
    adds its section and sets line 1 for both. Returns ``(verdict, report text)``: ``PASS``, ``FAIL``, or ``""`` when
    QA wrote no report or its line 1 is neither — an environment failure, never a finding.
    """
    REVIEWS.mkdir(parents=True, exist_ok=True)
    report = review(p, pid, "qa")
    report.unlink(missing_ok=True)
    common = {"ID": pid, "START": start_tag(p, pid), "REPORT": str(report.relative_to(ROOT))}
    claude(p, p.prompt("qa-build", **common), pid, "qa build", 1, "qa", CHEAP_MODEL)
    if p.boards(pid) and verdict(report):
        claude(p, p.prompt("qa-design", **common, REGRESSION=regression(p, pid)), pid, "qa design", 1, "qa", CHEAP_MODEL)
    return verdict(report), report.read_text() if report.exists() else ""


def start_tag(p: Project, pid: str) -> str:
    return f"{p.get('scope', p.name)}/{pid}-start"


def stories(p: Project, pid: str) -> list[str]:
    """The ``story.md`` of each story the entry names under *Stories*, relative to the repo root."""
    ids = re.findall(r"\b[A-Z]{2,}-\d+\b", p.entry(pid).get("stories", ""))
    found = (f for i in ids for f in ROOT.glob(f"specs/*/*/features/*/stories/{i}-*/story.md"))
    return sorted(str(f.relative_to(ROOT)) for f in found)


def criteria_moved(p: Project, pid: str, agent: str) -> str:
    """The phase's stories whose ``story.md`` changed since the phase started — unless the product-manager runs it."""
    if agent == "product-manager" or not (paths := stories(p, pid)):
        return ""
    return sh(["git", "diff", "--name-only", start_tag(p, pid), "--", *paths]).stdout.strip()


# ── one phase ──────────────────────────────────────────────────────────────
def run_phase(p: Project, row: dict, max_fix: int, max_handoffs: int) -> bool:
    pid = row["id"]
    e = p.entry(pid)
    agent = e.get("agent", "coder")
    needs_qa = e.get("review", "").strip().lower() == "qa"
    print(f"\n━━ {p.name} / {pid} · {row['phase']} · {agent} · needs {', '.join(row['needs_list']) or '—'}", flush=True)
    investigated = bool(re.search(r"investigat", row.get("notes", ""), re.I))  # one investigate re-run already spent
    rounds = min(max_fix, 2) if investigated else max_fix
    reports = f".agent-reports/qa/{p.name}-{pid}-*.md"
    resuming = row["status"] not in ("pending",)
    if not git_clean(p.file) and not resuming:
        print("  working tree not clean — refusing to start over someone's uncommitted work")
        return False
    try:
        enter_phase(p, pid)
    except RuntimeError as exc:
        print(f"  {exc}")
        return False
    print(f"  on branch {phase_branch(p, pid)}", flush=True)
    p.set_meta("status", "running")
    if resuming:
        checkpoint(p, pid, "work left by an interrupted run")
    else:
        sh(["git", "tag", "-f", start_tag(p, pid)])
    p.set_status(pid, "in progress")
    try:
        first = p.prompt("continue" if resuming else "build", ID=pid)
        if agent == "qa":
            REVIEWS.mkdir(parents=True, exist_ok=True)
            first = AUDIT.format(report=review(p, pid, "audit").relative_to(ROOT), where=f"{p.name}/{pid}") + first
        until_handoffs_end(p, pid, first, "build", agent, LEAD_MODEL, max_handoffs)
        if p.status_of(pid) == "blocked":  # the session stopped on a question only Ravi can answer
            p.set_meta("status", "blocked")
            return False
        if moved := criteria_moved(p, pid, agent):
            return block(p, pid, f"criteria changed during the phase — Ravi decides: {moved}")
        last: set[str] | None = None
        for attempt in range(rounds + 1):
            if why := setup(p, pid):
                return block(p, pid, why)
            p.set_status(pid, "gates")
            findings = gates(p, pid)
            seen = {f.splitlines()[0] for f in findings}
            if not findings and needs_qa:
                p.set_status(pid, "qa")
                result, text = qa(p, pid)
                if not result:
                    return block(p, pid, "QA wrote no report (env) — see runner log")
                rows = blockers(text) if result == "FAIL" else []
                owners = {r["owner"] for r in rows}
                if "pm" in owners:
                    return block(p, pid, f"scope question — product-manager — see {reports}")
                if "env" in owners and "coder" not in owners:
                    return block(p, pid, f"environment — see {reports}")
                if result == "FAIL":
                    coder = [r for r in rows if r["owner"] == "coder"]
                    seen = {r["where"] for r in coder}
                    cols = [k for k in (coder[0] if coder else {}) if k != "owner"]
                    table = "\n".join(["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols),
                                       *("| " + " | ".join(r[k] for k in cols) + " |" for r in coder)])
                    findings = [f"QA failed ({review(p, pid, 'qa').relative_to(ROOT)}) — the coder's blockers:\n"
                                + (table if coder else text[:8000])]
            if not findings:
                return close(p, pid, row["phase"])
            if seen == last:
                return block(p, pid, f"same findings two rounds running — see {reports}")
            last = seen
            if attempt == rounds:
                break
            p.set_status(pid, f"fixing {attempt + 1}")
            fix = p.prompt("fix", ID=pid, ATTEMPT=str(attempt + 1), FINDINGS="\n\n".join(findings))
            until_handoffs_end(p, pid, fix, f"fix {attempt + 1}", agent, CHEAP_MODEL, max_handoffs)
            if moved := criteria_moved(p, pid, agent):
                return block(p, pid, f"criteria changed during the phase — Ravi decides: {moved}")
    except RuntimeError as exc:
        return block(p, pid, str(exc))
    if investigated:
        return block(p, pid, f"final stop — Ravi decides: {rounds} fix rounds after an investigate re-run — "
                             f"see {reports}")
    return block(p, pid, f"failed after {rounds} fix rounds — see {reports}")


def block(p: Project, pid: str, why: str) -> bool:
    p.set_status(pid, "blocked", why)
    p.set_meta("status", "blocked")
    checkpoint(p, pid, "blocked")
    return False


def close(p: Project, pid: str, title: str) -> bool:
    if p.entry(pid).get("review", "").strip().lower() == "qa" and p.boards(pid):
        accept_shots(p, pid)
    p.set_status(pid, "done", "gates green · reviews passed")
    sh(["git", "add", "-A"])
    res = sh(["git", "commit", "-m", f"feat({p.get('scope', p.name)}): {pid} · {title}\n\n{TRAILER}"])
    if res.returncode != 0:
        print(res.stdout[-3000:] + res.stderr[-3000:])
        return block(p, pid, "commit refused by pre-commit hooks — see the runner log")
    return True


def next_phase(rows: list[dict], only: str | None) -> dict | None:
    done = {r["id"] for r in rows if r["status"] == "done"}
    for r in rows:
        if only and r["id"] != only:
            continue
        if r["status"] not in ("done", "blocked") and all(n in done for n in r["needs_list"]):
            return r
    return None


# ── process control ────────────────────────────────────────────────────────
def pidfile(name: str) -> Path:
    return LIVE / f"{name}.pid"


def start(name: str, argv: list[str]) -> int:
    LIVE.mkdir(parents=True, exist_ok=True)
    if (pf := pidfile(name)).exists() and alive(int(pf.read_text())):
        print(f"{name} is already running (pid {pf.read_text()})")
        return 1
    log = (LIVE / f"{name}.log").open("a")
    kw = {"creationflags": 0x00000008 | 0x00000200} if os.name == "nt" else {"start_new_session": True}
    proc = subprocess.Popen([sys.executable, "-u", str(Path(__file__).resolve()), *argv], cwd=ROOT, stdout=log,
                            stderr=log, stdin=subprocess.DEVNULL, **kw)
    log_path = (LIVE / f"{name}.log").relative_to(ROOT)
    print(f"Started {name} (pid {proc.pid}) — log {log_path}; watch with /project-dashboard")
    return 0


def alive(pid: int) -> bool:
    if os.name == "nt":
        return str(pid) in sh(["tasklist", "/FI", f"PID eq {pid}"]).stdout
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def stop(name: str) -> int:
    pf = pidfile(name)
    if not pf.exists() or not alive(int(pf.read_text())):
        print(f"{name} is not running")
        return 0
    pid = int(pf.read_text())
    if os.name == "nt":
        sh(["taskkill", "/PID", str(pid), "/T", "/F"])
    else:
        with contextlib.suppress(OSError):
            os.killpg(pid, signal.SIGTERM)
    pf.unlink(missing_ok=True)
    print(f"Stopped {name}; the phase in progress resumes on the next run")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("name", help="the project's folder name under .claude/team/projects/")
    ap.add_argument("--only", help="run just this phase")
    ap.add_argument("--max-fix", type=int, default=3)
    ap.add_argument("--max-handoffs", type=int, default=8)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--start", action="store_true", help="run detached; log in .claude/team/.live/projects/")
    ap.add_argument("--stop", action="store_true")
    a = ap.parse_args()
    p = Project(a.name)
    if a.stop:
        return stop(a.name)
    if a.start:
        return start(a.name, [x for x in sys.argv[1:] if x != "--start"])
    if p.get("status") in ("draft", ""):
        print(f"{a.name} is a draft — Ravi approves it (status: ready) before it runs")
        return 1
    if a.dry_run:
        row = next_phase(p.log(), a.only)
        print(f"next: {row['id']} · {row['phase']} ({p.entry(row['id']).get('agent', 'coder')})" if row
              else "nothing runnable — all done, blocked, or waiting on dependencies")
        return 0
    LIVE.mkdir(parents=True, exist_ok=True)
    os.environ.update(p.environment())
    pidfile(a.name).write_text(str(os.getpid()))
    try:
        p.set_meta("status", "running")
        while row := next_phase(p.log(), a.only):
            if not run_phase(p, row, a.max_fix, a.max_handoffs):
                print(f"stopped at {row['id']}")
                return 1
            if p.entry(row["id"]).get("approve", "").strip("— -"):
                p.set_meta("status", "paused")
                print(f"{row['id']} is done and waits for {p.entry(row['id'])['approve']}'s approval — paused")
                return 0
            if a.only:
                return 0
        if p.get("status") == "running":
            p.set_meta("status", "done" if all(r["status"] == "done" for r in p.log()) else "paused")
        print("nothing runnable — all done, blocked, or waiting on dependencies")
        return 0
    finally:
        pidfile(a.name).unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
