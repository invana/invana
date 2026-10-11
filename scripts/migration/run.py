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

Resumable: the log is the only state. Run it again and it continues from the
first unfinished session.

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
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "scripts" / "migration"
SESSIONS = ROOT / "docs" / "products" / "migration-sessions.md"
REVIEWS = HERE / "reviews"
CACHE = ROOT / ".migration-cache"
STUDIO_URL = os.environ.get("INVANA_MIGRATION_STUDIO_URL", "http://localhost:8300")

# Tools a headless session may use. Widen deliberately; never `--dangerously-skip-permissions`
# outside a disposable container (set INVANA_MIGRATION_SANDBOX=1 there).
ALLOWED_TOOLS = [
    "Read", "Edit", "Write", "Glob", "Grep",
    "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git mv *)", "Bash(git show *)",
    "Bash(pnpm *)", "Bash(node *)", "Bash(npx playwright *)",
    "Bash(uv run *)", "Bash(python3 *)", "Bash(make *)", "Bash(docker compose *)",
    "Bash(ls *)", "Bash(mkdir *)", "Bash(rm -rf node_modules/.vite*)",
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
def sh(cmd: list[str], cwd: Path = ROOT, env: dict | None = None) -> subprocess.CompletedProcess:
    print("  $", " ".join(cmd), f"  (in {cwd.relative_to(ROOT) if cwd != ROOT else '.'})")
    return subprocess.run(cmd, cwd=cwd, env={**os.environ, **(env or {})}, text=True, capture_output=True)


def git_clean() -> bool:
    return sh(["git", "status", "--porcelain"]).stdout.strip() == ""


def ensure_branch(branch: str) -> None:
    """Sessions stack: a missing branch is created from the current HEAD, so phase N carries phase N-1."""
    if sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip() == branch:
        return
    exists = sh(["git", "rev-parse", "--verify", branch]).returncode == 0
    sh(["git", "checkout", branch] if exists else ["git", "checkout", "-b", branch])


CONTEXT_LIMIT = int(os.environ.get("INVANA_MIGRATION_CONTEXT_LIMIT", "300000"))
HANDOFF = ("Context budget reached: this session has used more than {limit:,} tokens of context. Stop at the next clean "
           "point — finish or revert the file you are editing so the tree compiles; do not start anything new. Then set "
           "{sid}'s row in the log to `partial`, write a hand-off note that says exactly where the next session resumes "
           "(files done, files left, the next step number), and stop. A fresh session will continue from your note.")


def claude(text: str, sid: str, label: str) -> str:
    """One headless session in a fresh context, watched for context size.

    Runs ``claude -p`` with streaming input and output. Every assistant message
    reports its usage; the context in use is input + cache-read + cache-written
    tokens. Past ``CONTEXT_LIMIT`` the driver injects one message asking the
    agent to stop cleanly and write a hand-off — the run then continues in a new
    session that starts from that note. The full event stream is kept under
    ``.migration-cache/<ID>/<label>.jsonl``.
    """
    (CACHE / sid).mkdir(parents=True, exist_ok=True)
    cmd = ["claude", "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
           "--max-turns", "500"]
    if os.environ.get("INVANA_MIGRATION_SANDBOX") == "1":
        cmd.append("--dangerously-skip-permissions")
    else:
        cmd += ["--permission-mode", "acceptEdits", "--allowedTools", *ALLOWED_TOOLS]
    proc = subprocess.Popen(cmd, cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    def send(msg: str) -> None:
        proc.stdin.write(json.dumps({"type": "user", "message": {"role": "user", "content": msg}}) + "\n")
        proc.stdin.flush()

    send(text)
    warned, result, peak = False, "", 0
    with open(CACHE / sid / f"{label}.jsonl", "w") as log:
        for line in proc.stdout:
            log.write(line)
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "assistant":
                u = event["message"].get("usage") or {}
                ctx = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
                peak = max(peak, ctx)
                if ctx > CONTEXT_LIMIT and not warned:
                    print(f"  context {ctx:,} > {CONTEXT_LIMIT:,} — asking {label} to hand off")
                    send(HANDOFF.format(limit=CONTEXT_LIMIT, sid=sid))
                    warned = True
            elif event.get("type") == "result":
                result = event.get("result", "") or ""
                break
    proc.stdin.close()
    proc.wait()
    print(f"  {label}: peak context {peak:,} tokens{' · handed off' if warned else ''}")
    return result


def status_of(sid: str) -> str:
    return next((r["status"] for r in read_log() if r["id"] == sid), "")


def build_until_handoffs_end(sid: str, first_prompt: str, label: str, max_handoffs: int = 8) -> None:
    """Run a session; while it ends `partial` (a hand-off), continue in a fresh session from the note."""
    claude(first_prompt, sid, label)
    for n in range(1, max_handoffs + 1):
        if status_of(sid) != "partial":
            return
        print(f"  {sid} handed off — continuing in session {n + 1}")
        claude(prompt("continue", ID=sid), sid, f"{label}-cont{n}")
    if status_of(sid) == "partial":
        raise RuntimeError(f"{sid} still partial after {max_handoffs} hand-offs")


def prompt(name: str, **values: str) -> str:
    text = (HERE / "prompts" / f"{name}.md").read_text()
    for k, v in values.items():
        text = text.replace("{{" + k + "}}", v)
    return text


# ── gates — run by the driver, not trusted from the agent ──────────────────
def gate_commands(sid: str) -> list[tuple[list[str], Path, dict]]:
    studio = ROOT / "studio"
    turbo = (studio / "turbo.json").exists()
    if sid.startswith("B"):
        env = {"INVANA_ALLOW_GRAPH_TESTS": "1"} if os.environ.get("INVANA_MIGRATION_GRAPH_DB") else {}
        cmds = [(["uv", "run", "ruff", "check", "."], ROOT / "engine", {})]
        if env:  # graph-DB tests only against the isolated database (README › Isolation)
            cmds.append((["uv", "run", "pytest", "tests/", "-x", "-q"], ROOT / "engine", {**env, **graph_db_env()}))
        return cmds
    base = [(["pnpm", "lint"], studio, {}), (["pnpm", "check-types"], studio, {}),
            (["pnpm", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if turbo:
        base = [(["pnpm", "turbo", "run", "lint", "check-types", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if sid not in ("A00",):
        base.append((["pnpm", "test:e2e"], studio, {}))
    return base


def graph_db_env() -> dict:
    uri = os.environ["INVANA_MIGRATION_GRAPH_DB"]
    return {"NEO4J_URI": uri, "INVANA_NEO4J_URI": uri}


def run_gates(sid: str) -> list[str]:
    failures = []
    for cmd, cwd, env in gate_commands(sid):
        res = sh(cmd, cwd, env)
        if res.returncode != 0:
            failures.append(f"`{' '.join(cmd)}` failed:\n```\n{(res.stdout + res.stderr)[-4000:]}\n```")
    return failures


# ── design review ──────────────────────────────────────────────────────────
def review(row: dict) -> tuple[bool, str]:
    REVIEWS.mkdir(parents=True, exist_ok=True)
    report = REVIEWS / f"{row['id']}.md"
    claude(prompt("review", ID=row["id"], KIND=row["kind"], STUDIO_URL=STUDIO_URL,
                  REPORT=str(report.relative_to(ROOT)), CACHE=str((CACHE / row["id"]).relative_to(ROOT))),
           row["id"], "review")
    text = report.read_text() if report.exists() else "VERDICT: FAIL\n\nThe reviewer wrote no report."
    return text.lstrip().upper().startswith("VERDICT: PASS"), text


# ── one session ────────────────────────────────────────────────────────────
def run_session(row: dict, max_fix: int) -> bool:
    sid = row["id"]
    print(f"\n━━ {sid} · {row['kind']} · needs {', '.join(row['needs']) or '—'}")
    if not git_clean():
        print("  working tree not clean — refusing to start over someone's uncommitted work")
        return False
    ensure_branch(row["branch"])
    set_status(sid, "in progress")
    if sid.startswith(("A", "C")) and row["kind"].startswith("move"):
        sh(["node", "scripts/migration/shoot.mjs", "--live", "--smoke", "--out", f".migration-cache/{sid}/before"])
    try:
        build_until_handoffs_end(sid, prompt("build", ID=sid), "build")
    except RuntimeError as exc:
        set_status(sid, "blocked", str(exc))
        return False

    for attempt in range(max_fix + 1):
        findings = run_gates(sid)
        if not findings:
            ok, report = review(row)
            if ok:
                set_status(sid, "done", "gates green · design review passed")
                kind = {"A": "refactor", "B": "feat", "C": "feat", "R": "chore"}[sid[0]]
                sh(["git", "add", "-A"])
                res = sh(["git", "commit", "-m", f"{kind}(migration): session {sid} ({row['kind']})\n\nGates green; design review in "
                          f"scripts/migration/reviews/{sid}.md.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"])
                if res.returncode != 0:
                    print(res.stdout[-3000:] + res.stderr[-3000:])
                    set_status(sid, "blocked", "commit refused by pre-commit hooks — see the runner output")
                    return False
                return True
            findings = [f"Design review failed:\n{report}"]
        if attempt == max_fix:
            break
        try:
            build_until_handoffs_end(sid, prompt("fix", ID=sid, ATTEMPT=str(attempt + 1), FINDINGS="\n\n".join(findings)),
                                     f"fix-{attempt + 1}")
        except RuntimeError as exc:
            set_status(sid, "blocked", str(exc))
            return False

    set_status(sid, "blocked", f"failed after {max_fix} fix rounds — see .migration-cache/{sid}/")
    return False


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--only", help="run just this session id")
    ap.add_argument("--max-fix", type=int, default=2)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--track", choices=["A", "B", "C", "R"], help="only sessions of this track")
    args = ap.parse_args()
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
