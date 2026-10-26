#!/usr/bin/env python3
"""Run the products migration unattended — build, gates, design review, fix, commit — session after session.

The plan is ``docs/products/migration-plan.md``; the runbook and its log are
``docs/products/migration-sessions.md``. This driver never decides *what* to
build: it reads the log, picks the next session whose dependencies are done,
and hands that one runbook entry to a fresh headless Claude session. Everything
that decides whether the session counts as done happens here, outside the
agent:

1. **Build** — ``claude -p`` with ``prompts/build.md`` for the session.
2. **Gates** — the driver re-runs lint, types, tests, knip, e2e and the boundary
   check itself. The agent saying "green" is not evidence.
3. **Design review** — a *separate* ``claude -p`` with ``prompts/review.md``
   screenshots the implemented screens and compares them with the prototype
   boards the session's stories name (``screen-map.json``), and writes
   ``reviews/<ID>.md`` starting ``VERDICT: PASS`` or ``VERDICT: FAIL``.
4. **Fix** — on a failed gate or review, ``prompts/fix.md`` gets the findings;
   up to ``--max-fix`` rounds, then the session is logged ``blocked`` and the
   run stops.
5. **Close** — the driver marks the log row ``done`` and commits on the
   session's branch. It never pushes and never opens a pull request.

Commits are small enough to review: the lead commits each finished step as a
``wip`` commit, the driver checkpoints whatever is left after every session and
when a phase is blocked, and a phase's first session tags its starting point
``<scope>/<ID>-start`` so ``git reset --hard`` to that tag undoes the phase.

Resumable: the log is the only state. Run it again and it continues from the
first unfinished session.

The same driver runs any runbook laid out like it. Point it elsewhere with
``INVANA_RUNBOOK`` (the runbook), ``INVANA_RUNNER_PROMPTS`` (its prompts),
``INVANA_RUNNER_REVIEWS`` (where reviews land), ``INVANA_RUNNER_SCOPE`` (the
commit scope), ``INVANA_RUNNER_GATES=full`` (engine and Studio gates for every
row) and ``INVANA_RUNNER_MAX_HANDOFFS``. ``docs/products/agents-build-sessions.md``
is run that way.

Usage::

    python3 scripts/migration/run.py              # run until done or blocked
    python3 scripts/migration/run.py --only A01   # one session
    python3 scripts/migration/run.py --dry-run    # print what would run next
"""
from __future__ import annotations

import argparse
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

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "scripts" / "migration"
SESSIONS = ROOT / os.environ.get("INVANA_RUNBOOK", "docs/products/migration-sessions.md")
PROMPTS = ROOT / os.environ.get("INVANA_RUNNER_PROMPTS", "scripts/migration/prompts")
REVIEWS = ROOT / os.environ.get("INVANA_RUNNER_REVIEWS", "scripts/migration/reviews")
SCOPE = os.environ.get("INVANA_RUNNER_SCOPE", "migration")
FULL_GATES = os.environ.get("INVANA_RUNNER_GATES") == "full"
MAX_HANDOFFS = int(os.environ.get("INVANA_RUNNER_MAX_HANDOFFS", "8"))
CACHE = ROOT / ".migration-cache"
STUDIO_URL = os.environ.get("INVANA_MIGRATION_STUDIO_URL", "http://localhost:8300")
ENGINE_URL = os.environ.get("INVANA_MIGRATION_ENGINE_URL", "http://localhost:8200")
BASELINE = HERE / "baseline.json"
# Accepted live shots of every finished phase's boards; regressions are pixel-diffed against them.
SHOTS = CACHE / "baseline"
SHOT_THRESHOLD = float(os.environ.get("INVANA_RUNNER_SHOT_THRESHOLD", "0.005"))
# Reviews compare screenshots against the docs; Sonnet does that well at a fraction of Opus's usage.
GATE_TIMEOUT = float(os.environ.get("INVANA_RUNNER_GATE_TIMEOUT", "1800"))
REVIEW_MODEL = os.environ.get("INVANA_RUNNER_REVIEW_MODEL", "sonnet")
# e2e specs default to a Graph this stack lacks; set here so headless sessions inherit it too.
os.environ.setdefault("E2E_GRAPH_PATH", "/u/admin/airways")

# Tools a headless session may use. Widen deliberately; never `--dangerously-skip-permissions`
# outside a disposable container (set INVANA_MIGRATION_SANDBOX=1 there).
ALLOWED_TOOLS = [
    "Read", "Edit", "Write", "Glob", "Grep", "Agent",
    "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git mv *)", "Bash(git show *)",
    "Bash(git add *)", "Bash(git commit --no-verify *)",
    "Bash(git -C * add *)", "Bash(git -C * commit --no-verify *)",
    "Bash(pnpm *)", "Bash(node *)", "Bash(npx playwright *)",
    "Bash(uv run *)", "Bash(python3 *)", "Bash(make *)", "Bash(docker compose *)",
    "Bash(ls *)", "Bash(mkdir *)", "Bash(rm -rf node_modules/.vite*)",
    "Bash(cat *)", "Bash(head *)", "Bash(tail *)", "Bash(wc *)", "Bash(grep *)", "Bash(rg *)", "Bash(find *)",
    "Bash(sed -n *)", "Bash(jq *)", "Bash(curl *)", "Bash(sort *)", "Bash(uniq *)", "Bash(diff *)",
    "TodoWrite", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TaskStop",
]


# ── the log ────────────────────────────────────────────────────────────────
FIELDS = ("id", "phase", "kind", "needs", "branch", "status", "date", "notes")
ID = re.compile(r"^[A-Z]\d{2}[a-z]?$")


def parse_row(line: str) -> dict | None:
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) != len(FIELDS) or not ID.match(cells[0]):
        return None
    return dict(zip(FIELDS, cells))


def read_log() -> list[dict]:
    text = SESSIONS.read_text()
    log = text[text.index("## Log"):text.index("## Hand-off notes")]
    rows = []
    for line in log.splitlines():
        row = parse_row(line)
        if row:
            row["needs"] = [] if row["needs"] in ("—", "") else [n.strip() for n in row["needs"].split(",")]
            row["branch"] = row["branch"].strip("`")
            rows.append(row)
    return rows


def set_status(sid: str, status: str, note: str = "") -> None:
    text = SESSIONS.read_text()
    out = []
    for line in text.splitlines():
        g = parse_row(line)
        if g and g["id"] == sid and "## Log" in text[:text.find(line)]:
            g["status"], g["date"] = status, dt.date.today().isoformat()
            if note:
                g["notes"] = note.replace("|", "/")[:140]
            line = "| " + " | ".join(g[k] for k in FIELDS) + " |"
        out.append(line)
    SESSIONS.write_text("\n".join(out) + "\n")


def next_session(rows: list[dict], only: str | None) -> dict | None:
    done = {r["id"] for r in rows if r["status"] == "done"}
    for r in rows:
        if only and r["id"] != only:
            continue
        if r["status"] in ("pending", "partial", "in progress") and all(n in done for n in r["needs"]):
            return r
    return None


# ── shell helpers ──────────────────────────────────────────────────────────
def sh(cmd: list[str], cwd: Path = ROOT, env: dict | None = None,
       timeout: float | None = None) -> subprocess.CompletedProcess:
    """Run a command and capture its output; past ``timeout`` seconds its whole process group is killed.

    A timed-out command returns code 124 with the output it had written, so a hung gate fails
    like any other instead of stalling the driver.
    """
    print("  $", " ".join(cmd), f"  (in {cwd.relative_to(ROOT) if cwd != ROOT else '.'})")
    proc = subprocess.Popen(cmd, cwd=cwd, env={**os.environ, **(env or {})}, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        out, err = proc.communicate()
        err += f"\n\nTimed out after {timeout / 60:.0f} min — the command hung, or a test never finished.\n"
        return subprocess.CompletedProcess(cmd, 124, out, err)
    return subprocess.CompletedProcess(cmd, proc.returncode, out, err)


def git_clean() -> bool:
    return sh(["git", "status", "--porcelain"]).stdout.strip() == ""


def checkpoint(sid: str, phase: str, what: str) -> None:
    """Commit whatever a session left uncommitted as a `wip` commit, so no phase piles up into one diff.

    Hooks are skipped: mid-phase the tree may not lint. The phase's closing commit runs them.
    """
    if git_clean():
        return
    sh(["git", "add", "-A"])
    res = sh(["git", "commit", "--no-verify", "-m", f"wip({SCOPE}): {sid} · {phase} — {what}\n\n"
              "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"])
    if res.returncode != 0:
        print(res.stdout[-2000:] + res.stderr[-2000:])


def ensure_branch(branch: str) -> None:
    """Sessions stack: a missing branch is created from the current HEAD, so phase N carries phase N-1."""
    if sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip() == branch:
        return
    exists = sh(["git", "rev-parse", "--verify", branch]).returncode == 0
    sh(["git", "checkout", branch] if exists else ["git", "checkout", "-b", branch])


# One context budget for the lead and every sub-agent. Every turn re-reads the whole context, so spend
# grows with context size × turns. Past the budget a session hands off; past the hard stop the driver ends it.
CONTEXT_LIMIT = int(os.environ.get("INVANA_MIGRATION_CONTEXT_LIMIT", "300000"))
HARD_STOP = CONTEXT_LIMIT + int(os.environ.get("INVANA_RUNNER_HANDOFF_GRACE", "50000"))
# The lead builds on Opus; fix rounds and every sub-agent run on the cheaper model.
LEAD_MODEL = os.environ.get("INVANA_RUNNER_LEAD_MODEL", "")
CHEAP_MODEL = os.environ.get("INVANA_RUNNER_CHEAP_MODEL", "sonnet")
PART_HANDOFF = ("Sub-agent '{name}' (tool use {tid}) has passed {limit:,} tokens of context. Hand it off now:\n"
                "1. Stop it with TaskStop. Its edits stay on disk.\n"
                "2. Write its hand-off yourself: the files it owns, what `git diff` shows it changed, and what its "
                "brief still lists as undone. Make sure the files it was editing compile.\n"
                "3. Launch one fresh sub-agent with the same brief plus that hand-off, told to continue from it and "
                "not redo finished work. If it is small enough, finish it yourself instead.")
HARD_STOPPED = ("stopped by the driver: {who} passed {limit:,} tokens of context without handing off — "
                "check `git status` and the last wip commit, then continue")
HANDOFF = ("Context budget reached: this session has used more than {limit:,} tokens of context. Stop at the next clean "
           "point — finish or revert the file you are editing so the tree compiles; do not start anything new. Then set "
           "{sid}'s row in the log to `partial`, write a hand-off note that says exactly where the next session resumes "
           "(files done, files left, the next step number), and stop. A fresh session will continue from your note.")


LIMIT_RETRY = ("A previous attempt at this was cut off by a usage limit. Check `git log` and `git status` for what it "
               "already did, do not redo it, and carry on from there.\n\n")


def claude(text: str, sid: str, label: str, model: str | None = None) -> str:
    """Run a session; when a usage limit refuses it, wait for the reset and run it again.

    A refusal is not a fix round and not a failure: the same prompt is retried, told
    that an earlier attempt may have left work on disk.
    """
    for n in range(1, 10):
        result, resets_at = _session(text, sid, label, model)
        if resets_at is None:
            return result
        wait = max(0, resets_at - dt.datetime.now().timestamp()) + 60
        print(f"  {label}: usage limit — waiting {wait / 60:.0f} min for the reset, then retrying")
        time.sleep(wait)
        text, label = LIMIT_RETRY + text.removeprefix(LIMIT_RETRY), f"{label.split('-limit')[0]}-limit{n}"
    raise RuntimeError(f"{label}: refused by the usage limit nine times")


def _session(text: str, sid: str, label: str, model: str | None) -> tuple[str, float | None]:
    """One headless session in a fresh context, watched for context size.

    Runs ``claude -p`` with streaming input and output. Every assistant message
    reports its usage; the context in use is input + cache-read + cache-written
    tokens. A message with a ``parent_tool_use_id`` belongs to a sub-agent and is
    counted against that part, not the lead. The lead and every part share one
    budget, ``CONTEXT_LIMIT``:

    - the lead past it is asked to stop cleanly and write a hand-off; the run then
      continues in a new session that starts from that note;
    - a part past it gets the lead told to stop the part, write its hand-off, and
      launch a fresh part from it;
    - anyone still growing past ``HARD_STOP`` ends the session: the driver marks
      the row ``partial`` with a note, so a fresh session continues from the disk.

    Fix rounds run on ``CHEAP_MODEL``, and so does every sub-agent; a caller may
    name the model instead. The full event stream is kept under
    ``.migration-cache/<ID>/<label>.jsonl``.
    """
    (CACHE / sid).mkdir(parents=True, exist_ok=True)
    cmd = ["claude", "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
           "--max-turns", "500"]
    model = model or (CHEAP_MODEL if label.startswith("fix") else LEAD_MODEL)
    if model:
        cmd += ["--model", model]
    if os.environ.get("INVANA_MIGRATION_SANDBOX") == "1":
        cmd.append("--dangerously-skip-permissions")
    else:
        cmd += ["--permission-mode", "acceptEdits", "--allowedTools", *ALLOWED_TOOLS]
    env = {**os.environ, "CLAUDE_CODE_SUBAGENT_MODEL": CHEAP_MODEL} if CHEAP_MODEL else None
    proc = subprocess.Popen(cmd, cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, env=env)

    def send(msg: str) -> None:
        proc.stdin.write(json.dumps({"type": "user", "message": {"role": "user", "content": msg}}) + "\n")
        proc.stdin.flush()

    send(text)
    # Sub-agents run in the background: a lead's turn ends while it waits for them, and their
    # completion starts its next turn. The session is over only at a result with none still running.
    warned, result, peak, session_id, running, resets_at = False, "", 0, "", set(), None
    killed = ""  # who passed HARD_STOP, when the driver ended the session
    parts: dict[str, str] = {}  # tool use id → part description
    part_peak: dict[str, int] = {}
    stopped: set[str] = set()
    with open(CACHE / sid / f"{label}.jsonl", "w") as log:
        for line in proc.stdout:
            log.write(line)
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not session_id and event.get("session_id"):
                session_id = event["session_id"]
                print(f"  {label}: session {session_id}  (open with: claude -r {session_id})")
            if event.get("type") == "assistant" and event.get("parent_tool_use_id"):
                tid = event["parent_tool_use_id"]
                u = event["message"].get("usage") or {}
                ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                part_peak[tid] = max(part_peak.get(tid, 0), ctx)
                name = parts.get(tid, "unnamed part")
                if ctx > HARD_STOP:
                    killed = f"sub-agent '{name}'"
                    break
                if ctx > CONTEXT_LIMIT and tid not in stopped:
                    print(f"  {label}: part '{name}' at {ctx:,} > {CONTEXT_LIMIT:,} — asking the lead to hand it off")
                    send(PART_HANDOFF.format(name=name, tid=tid, limit=CONTEXT_LIMIT))
                    stopped.add(tid)
            elif event.get("type") == "assistant":
                u = event["message"].get("usage") or {}
                ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                peak = max(peak, ctx)
                if ctx > HARD_STOP:
                    killed = "the lead"
                    break
                if ctx > CONTEXT_LIMIT and not warned:
                    print(f"  context {ctx:,} > {CONTEXT_LIMIT:,} — asking {label} to hand off")
                    send(HANDOFF.format(limit=CONTEXT_LIMIT, sid=sid))
                    warned = True
            elif event.get("type") == "rate_limit_event":
                info = event.get("rate_limit_info") or {}
                if info.get("status") == "rejected" and info.get("resetsAt"):
                    resets_at = float(info["resetsAt"])
            elif event.get("type") == "system" and event.get("subtype") == "background_tasks_changed":
                running = {t.get("task_id") for t in event.get("tasks") or []}
            elif event.get("type") == "system" and event.get("subtype") == "task_started":
                running.add(event.get("task_id"))
                if event.get("tool_use_id"):
                    parts[event["tool_use_id"]] = event.get("description", "")
            elif event.get("type") == "system" and event.get("subtype") in ("task_notification", "task_completed", "task_finished") \
                    or (event.get("type") == "system" and event.get("status") in ("completed", "failed", "killed", "stopped")):
                running.discard(event.get("task_id"))
            elif event.get("type") == "result":
                result = event.get("result", "") or ""
                if running:
                    print(f"  {label}: turn ended with {len(running)} sub-agent(s) still running — waiting for them")
                    continue
                break
    proc.stdin.close()
    if killed:
        print(f"  {label}: {killed} passed {HARD_STOP:,} tokens of context — ending the session")
        proc.terminate()
        # A review cut short writes no report, and a missing report already fails the review.
        if not label.startswith("review"):
            set_status(sid, "partial", HARD_STOPPED.format(who=killed, limit=HARD_STOP))
        warned = True
    # A slow exit hook can hold the process open after the result.
    try:
        proc.wait(timeout=120)
    except subprocess.TimeoutExpired:
        print(f"  {label}: still open 120s after its result — terminating")
        proc.terminate()
        proc.wait()
    print(f"  {label}: peak context {peak:,} tokens{' · handed off' if warned else ''}")
    for tid, top in part_peak.items():
        print(f"    part '{parts.get(tid, tid)}': peak {top:,}{' · stopped' if tid in stopped else ''}")
    index = CACHE / "sessions.md"
    if not index.exists():
        index.write_text("| Migration session | Step | Claude session | Peak context | Handed off | Finished |\n"
                         "|---|---|---|---|---|---|\n")
    with open(index, "a") as f:
        f.write(f"| {sid} | {label} | `claude -r {session_id}` | {peak:,} | {'yes' if warned else ''} | "
                f"{dt.datetime.now().strftime('%Y-%m-%d %H:%M')} |\n")
    return result, resets_at


def status_of(sid: str) -> str:
    return next((r["status"] for r in read_log() if r["id"] == sid), "")


BASELINE_TAMPERED = ("`scripts/migration/baseline.json` belongs to the driver and your change to it was reverted. "
                     "A failure is fixed, never baselined; if it truly cannot pass on this stack, say why in the hand-off note.")


def reclaim(sid: str) -> None:
    """Undo what only the driver may decide: a session's own `done`, and edits to the baseline."""
    if status_of(sid) == "done":
        print(f"  {sid} marked itself done — the driver decides that; back to in progress")
        set_status(sid, "in progress")
    if sh(["git", "diff", "--quiet", "HEAD", "--", str(BASELINE.relative_to(ROOT))]).returncode != 0:
        print(f"  {sid} edited baseline.json — reverted")
        sh(["git", "checkout", "HEAD", "--", str(BASELINE.relative_to(ROOT))])
        TAMPERED.add(sid)


TAMPERED: set[str] = set()


def build_until_handoffs_end(sid: str, phase: str, first_prompt: str, label: str,
                             max_handoffs: int = MAX_HANDOFFS) -> None:
    """Run a session; while it ends `partial` (a hand-off), continue in a fresh session from the note.

    Every session ends in a checkpoint commit, so each hand-off is its own reviewable diff.
    """
    claude(first_prompt, sid, label)
    reclaim(sid)
    checkpoint(sid, phase, f"{label} session")
    for n in range(1, max_handoffs + 1):
        if status_of(sid) != "partial":
            return
        print(f"  {sid} handed off — continuing in session {n + 1}")
        claude(prompt("continue", ID=sid), sid, f"{label}-cont{n}")
        reclaim(sid)
        checkpoint(sid, phase, f"{label}-cont{n} session")
    if status_of(sid) == "partial":
        raise RuntimeError(f"{sid} still partial after {max_handoffs} hand-offs")


def prompt(name: str, **values: str) -> str:
    text = (PROMPTS / f"{name}.md").read_text()
    for k, v in values.items():
        text = text.replace("{{" + k + "}}", v)
    return text


# ── gates — run by the driver, not trusted from the agent ──────────────────
def gate_commands(sid: str) -> list[tuple[list[str], Path, dict]]:
    studio = ROOT / "studio"
    turbo = (studio / "turbo.json").exists()
    if sid.startswith("B") or FULL_GATES:
        # Telemetry off, as in CI: its global httpx instrumentation and log handlers break the telemetry tests.
        env = {"INVANA_ALLOW_GRAPH_TESTS": "1", "INVANA_TELEMETRY_ENABLED": "false"} \
            if os.environ.get("INVANA_MIGRATION_GRAPH_DB") else {}
        cmds = [(["uv", "run", "ruff", "check", "."], ROOT / "engine", {})]
        if env:  # graph-DB tests only against the isolated database (README › Isolation)
            cmds.append((["uv", "run", "pytest", "tests/", "-x", "-q"], ROOT / "engine", {**env, **graph_db_env()}))
        if not FULL_GATES:
            return cmds
    else:
        cmds = []
    base = [(["pnpm", "lint"], studio, {}), (["pnpm", "check-types"], studio, {}),
            (["pnpm", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if turbo:
        base = [(["pnpm", "turbo", "run", "lint", "check-types", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if sid not in ("A00",):
        base.append((["pnpm", "test:e2e", "--reporter=line"], studio, {}))
    return cmds + base


def graph_db_env() -> dict:
    """The isolated database engine tests run against — never the developer's."""
    uri = os.environ["INVANA_MIGRATION_GRAPH_DB"]
    port = uri.rsplit(":", 1)[-1].split("/")[0]  # the tests' is-it-up probe reads NEO4J_PORT, not the URI
    return {"NEO4J_URI": uri, "NEO4J_PORT": port, "NEO4J_USERNAME": "neo4j",
            "NEO4J_PASSWORD": os.environ.get("INVANA_MIGRATION_GRAPH_PASSWORD", "testpassword"),
            "NEO4J_DATABASE": "neo4j"}


FAILED_TEST = re.compile(r"^\s+\[\w+\] › (\S+?):\d+:\d+ › (.+?)[\s─]*$")
KNIP_SECTION = re.compile(r"^([A-Z][a-z]+(?: [a-z]+)*) \(\d+\)$")


def failing_items(cmd: list[str], output: str) -> set[str]:
    """What a knip or e2e run reports as failing, keyed so a moved file keeps its key.

    e2e: ``spec file name › test title`` from the line reporter's summary.
    knip: ``section › symbol``. Any other command returns an empty set.
    """
    items: set[str] = set()
    if "test:e2e" in cmd:
        in_failed = False
        for line in output.splitlines():
            if re.match(r"^\s+\d+ failed$", line):
                in_failed = True
                continue
            m = FAILED_TEST.match(line) if in_failed else None
            if m:
                items.add(f"e2e › {Path(m.group(1)).name} › {m.group(2)}")
            elif in_failed:
                in_failed = False
    elif "knip" in cmd:
        section = ""
        for line in output.splitlines():
            if m := KNIP_SECTION.match(line.strip()):
                section = m.group(1)
            elif section and line.strip() and not line.startswith(("$", "[", " ")):
                items.add(f"knip › {section} › {line.split()[0]}")
    return items


def gate_failures(sid: str) -> tuple[list[str], set[str]]:
    """Run the gates; return the failure reports and every knip/e2e item seen failing."""
    failures, seen = [], set()
    baseline = set(json.loads(BASELINE.read_text())) if BASELINE.exists() else set()
    for cmd, cwd, env in gate_commands(sid):
        res = sh(cmd, cwd, env, timeout=GATE_TIMEOUT)
        if res.returncode == 0:
            continue
        out = res.stdout + res.stderr
        items = failing_items(cmd, out)
        seen |= items
        new = items - baseline
        if items and not new:
            print(f"  {' '.join(cmd)}: only failures already in the baseline ({len(items)}) — passes")
            continue
        detail = ("\n\nNew since the baseline (fix these; the rest already failed before the migration):\n"
                  + "\n".join(f"- {i}" for i in sorted(new))) if new else ""
        failures.append(f"`{' '.join(cmd)}` failed:{detail}\n```\n{out[-4000:]}\n```")
    return failures, seen


def run_gates(sid: str) -> list[str]:
    return gate_failures(sid)[0]


def write_baseline() -> int:
    """Record what knip and e2e already fail on, on code the migration has not touched yet."""
    if sh(["git", "diff", "--quiet", "pre-products-migrations", "--", "studio/"]).returncode != 0:
        print("studio/ differs from pre-products-migrations — a baseline must be taken on untouched code")
        return 1
    if not ensure_stack():
        return 1
    _, seen = gate_failures("R00")
    BASELINE.write_text(json.dumps(sorted(seen), indent=2, ensure_ascii=False) + "\n")
    print(f"baseline: {len(seen)} known failures → {BASELINE.relative_to(ROOT)}")
    return 0


def ensure_stack(wait: int = 120) -> bool:
    """e2e and the design review need the dev stack; start it if it is down."""
    def up() -> bool:
        return all(sh(["curl", "-sf", "-o", "/dev/null", url]).returncode == 0
                   for url in (STUDIO_URL, f"{ENGINE_URL}/health"))
    if up():
        return True
    sh(["docker", "compose", "up", "-d", "engine", "studio"])
    for _ in range(wait // 5):
        subprocess.run(["sleep", "5"])
        if up():
            return True
    print(f"  dev stack is down ({STUDIO_URL}, {ENGINE_URL}/health) and did not come up")
    return False


# ── demo data — a gate needs airways, and nothing may flush the developer's graph ─
AIRWAYS = [("news-articles", "NewsArticles"), ("twitter", "Twitter"), ("deals", "Deals"), ("air-routes", "AirRoutes")]


def isolate_graph_tests() -> None:
    """Every session the driver starts inherits the isolated database, so a test a session runs itself
    cannot fall back to the developer's Neo4j on :7687 and flush it."""
    if os.environ.get("INVANA_MIGRATION_GRAPH_DB"):
        os.environ.update(graph_db_env())


def airways_nodes() -> int:
    res = sh(["docker", "exec", "invana-neo4j", "cypher-shell", "-u", "neo4j", "-p",
              os.environ.get("INVANA_DEV_GRAPH_PASSWORD", "testpassword"), "--format", "plain", "MATCH (n) RETURN count(n)"])
    return int(res.stdout.split()[-1]) if res.returncode == 0 and res.stdout.split()[-1:] and res.stdout.split()[-1].isdigit() else -1


def ensure_demo_data() -> bool:
    """Reload demos/airways into the developer's graph when it is empty, then re-introspect the global model."""
    if airways_nodes() != 0:
        return True
    print("  admin/airways is empty — reloading demos/airways")
    cli, env = str(ROOT / "engine" / ".venv" / "bin" / "invana"), {"INVANA_TELEMETRY_ENABLED": "false"}
    dev = {k: v for k, v in os.environ.items() if not k.startswith("NEO4J_")}  # the import writes to the Graph's own connection
    for name, model in AIRWAYS:
        res = subprocess.run([cli, "records", "import", "--graph", "admin/airways", "--name", name, "--model", model,
                              "--path", f"demos/airways/{name}"], cwd=ROOT, env={**dev, **env}, text=True, capture_output=True)
        if res.returncode != 0:
            print(res.stdout[-1500:] + res.stderr[-1500:])
            return False
    sh(["pnpm", "exec", "playwright", "test", "--project=setup", "--reporter=line"], ROOT / "studio" / "apps" / "studio")
    state = json.loads((ROOT / "studio" / "apps" / "studio" / "e2e" / ".auth" / "user.json").read_text())
    auth = next(i["value"] for o in state["origins"] for i in o["localStorage"] if i["name"] == "invana.auth")
    token = json.loads(auth)["state"]["accessToken"]
    sh(["curl", "-sf", "-X", "POST", "-H", f"Authorization: Bearer {token}", f"{ENGINE_URL}/api/v1/u/admin/airways/connection/introspect"])
    return airways_nodes() > 0


# ── design review ──────────────────────────────────────────────────────────
def phase_boards(sid: str) -> list[str]:
    """The screen-map boards a phase's entry names under "Boards"; `x*` is a prefix, `(not ...)` excludes."""
    text = SESSIONS.read_text()
    head = re.search(rf"^### {re.escape(sid)} ·.*$", text, re.M)
    line = re.search(r"^\| Boards \|(.*)$", text[head.end():], re.M) if head else None
    if not line:
        return []
    names = list(json.loads((HERE / "screen-map.json").read_text())["boards"])
    drop = " ".join(re.findall(r"\(not ([^)]*)\)", line.group(1)))
    keep = re.sub(r"\(not [^)]*\)", "", line.group(1))
    # An exclusion may be a partial name (`run.remote*` inside `agents.run.*`), so it matches anywhere.
    kept = {n for pat in re.findall(r"`([^`]+)`", keep) for n in names
            if (n.startswith(pat[:-1]) if pat.endswith("*") else n == pat)}
    dropped = {n for pat in re.findall(r"`([^`]+)`", drop) for n in names if pat.rstrip("*") in n}
    return sorted(kept - dropped)


def reseed() -> None:
    """Re-seed the boards whose data is relative to now, when the runbook's scope ships a re-seed."""
    script = PROMPTS.parent / "reseed.py"
    if script.exists():
        sh([sys.executable, str(script)])


def regression(sid: str) -> str:
    """Shoot every finished phase's boards live and pixel-diff them against the accepted shots.

    Only boards past ``SHOT_THRESHOLD`` reach the reviewer, so a phase is not paid for by
    re-viewing every earlier board. Returns the reviewer's instructions for them.
    """
    boards = sorted({b for r in read_log() if r["status"] == "done" and r["id"] != sid for b in phase_boards(r["id"])}
                    - set(phase_boards(sid)))
    if not boards:
        return "No earlier phase is done; there is no regression set."
    out = CACHE / sid / "regression"
    shutil.rmtree(out, ignore_errors=True)
    reseed()
    sh(["node", "scripts/migration/shoot.mjs", "--live", "--boards", ",".join(boards), "--out", str(out)])
    sh(["node", "scripts/migration/shoot.mjs", "--diff", str(SHOTS), "--out", str(out)])
    diff = json.loads((out / "diff.json").read_text()) if (out / "diff.json").exists() else {}
    changed = [b for b, v in diff.items() if v == "new" or v > SHOT_THRESHOLD]
    rel = lambda d: d.relative_to(ROOT)
    if not changed:
        return f"The driver shot {len(diff)} boards of finished phases; none changed against the accepted shots."
    rows = "\n".join(f"- `{b}`: {'no accepted shot yet — compare it with the prototype' if diff[b] == 'new' else f'{diff[b]:.1%} of pixels changed'}"
                      for b in changed)
    return (f"The driver shot {len(diff)} boards of finished phases into `{rel(out)}` and pixel-diffed them against "
            f"the accepted shots in `{rel(SHOTS)}`. {len(diff) - len(changed)} are unchanged — do not view them. "
            f"These changed; view each live shot once beside its accepted shot (and the prototype only if unsure):\n{rows}")


def accept_shots(sid: str) -> None:
    """A passed phase's live shots, and the regression set it was judged on, become the accepted shots."""
    SHOTS.mkdir(parents=True, exist_ok=True)
    reg = CACHE / sid / "regression"
    for png in reg.glob("*.png") if reg.exists() else []:
        shutil.copy2(png, SHOTS / png.name)
    if boards := phase_boards(sid):
        reseed()
        sh(["node", "scripts/migration/shoot.mjs", "--live", "--boards", ",".join(boards), "--out", str(SHOTS)])


def review(row: dict) -> tuple[bool, str]:
    REVIEWS.mkdir(parents=True, exist_ok=True)
    report = REVIEWS / f"{row['id']}.md"
    claude(prompt("review", ID=row["id"], KIND=row["kind"], STUDIO_URL=STUDIO_URL,
                  REPORT=str(report.relative_to(ROOT)), CACHE=str((CACHE / row["id"]).relative_to(ROOT)),
                  BOARDS=", ".join(phase_boards(row["id"])) or "(none named)", REGRESSION=regression(row["id"])),
           row["id"], "review", model=REVIEW_MODEL)
    text = report.read_text() if report.exists() else "VERDICT: FAIL\n\nThe reviewer wrote no report."
    return text.lstrip().upper().startswith("VERDICT: PASS"), text


# ── one session ────────────────────────────────────────────────────────────
def run_session(row: dict, max_fix: int) -> bool:
    sid = row["id"]
    print(f"\n━━ {sid} · {row['kind']} · needs {', '.join(row['needs']) or '—'}")
    current = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    resuming = row["status"] in ("in progress", "partial") and current == row["branch"]
    if not git_clean() and not resuming:
        print("  working tree not clean — refusing to start over someone's uncommitted work")
        return False
    ensure_branch(row["branch"])
    if not resuming:
        sh(["git", "tag", "-f", f"{SCOPE}/{sid}-start"])
    else:
        checkpoint(sid, row["phase"], "work left by an interrupted run")
    set_status(sid, "in progress")
    if not resuming and sid.startswith(("A", "C")) and row["kind"].startswith("move"):
        sh(["node", "scripts/migration/shoot.mjs", "--live", "--smoke", "--out", f".migration-cache/{sid}/before"])
    try:
        # An interrupted run picks up where it stopped, from the work on disk and the hand-off notes.
        first, label = (prompt("continue", ID=sid), "resume") if resuming else (prompt("build", ID=sid), "build")
        build_until_handoffs_end(sid, row["phase"], first, label)
    except RuntimeError as exc:
        set_status(sid, "blocked", str(exc))
        checkpoint(sid, row["phase"], "blocked")
        return False

    for attempt in range(max_fix + 1):
        if not sid.startswith("B") and not ensure_stack():
            set_status(sid, "blocked", "dev stack down — `docker compose up -d engine studio`, then re-run")
            return False
        if not ensure_demo_data():
            set_status(sid, "blocked", "demos/airways would not reload into admin/airways — see the runner output")
            return False
        findings = run_gates(sid)
        if sid in TAMPERED:
            findings.insert(0, BASELINE_TAMPERED)
            TAMPERED.discard(sid)
        if not findings:
            ok, report = review(row)
            if ok:
                set_status(sid, "done", "gates green · design review passed")
                accept_shots(sid)
                kind = {"A": "refactor", "R": "chore"}.get(sid[0], "feat")
                sh(["git", "add", "-A"])
                res = sh(["git", "commit", "-m", f"{kind}({SCOPE}): {sid} · {row['phase']}\n\nGates green; design review in "
                          f"{(REVIEWS / f'{sid}.md').relative_to(ROOT)}.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"])
                if res.returncode != 0:
                    print(res.stdout[-3000:] + res.stderr[-3000:])
                    set_status(sid, "blocked", "commit refused by pre-commit hooks — see the runner output")
                    return False
                return True
            findings = [f"Design review failed:\n{report}"]
        if attempt == max_fix:
            break
        try:
            build_until_handoffs_end(sid, row["phase"], prompt("fix", ID=sid, ATTEMPT=str(attempt + 1),
                                                               FINDINGS="\n\n".join(findings)), f"fix-{attempt + 1}")
        except RuntimeError as exc:
            set_status(sid, "blocked", str(exc))
            checkpoint(sid, row["phase"], "blocked")
            return False

    set_status(sid, "blocked", f"failed after {max_fix} fix rounds — see .migration-cache/{sid}/")
    checkpoint(sid, row["phase"], "blocked")
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="run just this session id")
    ap.add_argument("--max-fix", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--track", choices=["A", "B", "C", "R"], help="only sessions of this track")
    ap.add_argument("--baseline", action="store_true", help="record what knip and e2e already fail on, then exit")
    args = ap.parse_args()
    isolate_graph_tests()
    if args.baseline:
        return write_baseline()
    while True:
        rows = [r for r in read_log() if not args.track or r["id"].startswith(args.track)
                or r["status"] == "done"]
        row = next_session(rows, args.only)
        if row is None:
            print("nothing runnable — all done, blocked, or waiting on dependencies")
            return 0
        if args.dry_run:
            print(f"next: {row['id']} ({row['kind']}) on {row['branch']}")
            return 0
        if not run_session(row, args.max_fix):
            print(f"stopped at {row['id']}")
            return 1
        if args.only:
            return 0


if __name__ == "__main__":
    sys.exit(main())
