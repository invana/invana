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
ENGINE_URL = os.environ.get("INVANA_MIGRATION_ENGINE_URL", "http://localhost:8200")
BASELINE = HERE / "baseline.json"
# e2e specs default to a Graph this stack lacks; set here so headless sessions inherit it too.
os.environ.setdefault("E2E_GRAPH_PATH", "/u/admin/airways")

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
    # Langfuse (when its Claude Code plugin is enabled) files the session under these tags.
    env = {**os.environ, "CC_LANGFUSE_TRACE_TAGS": f"migration,{sid},{label}"}
    proc = subprocess.Popen(cmd, cwd=ROOT, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True)

    def send(msg: str) -> None:
        proc.stdin.write(json.dumps({"type": "user", "message": {"role": "user", "content": msg}}) + "\n")
        proc.stdin.flush()

    send(text)
    warned, result, peak, session_id = False, "", 0, ""
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
    index = CACHE / "sessions.md"
    if not index.exists():
        index.write_text("| Migration session | Step | Claude session | Peak context | Handed off | Finished |\n"
                         "|---|---|---|---|---|---|\n")
    with open(index, "a") as f:
        f.write(f"| {sid} | {label} | `claude -r {session_id}` | {peak:,} | {'yes' if warned else ''} | "
                f"{dt.datetime.now().strftime('%Y-%m-%d %H:%M')} |\n")
    return result


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


def build_until_handoffs_end(sid: str, first_prompt: str, label: str, max_handoffs: int = 8) -> None:
    """Run a session; while it ends `partial` (a hand-off), continue in a fresh session from the note."""
    claude(first_prompt, sid, label)
    reclaim(sid)
    for n in range(1, max_handoffs + 1):
        if status_of(sid) != "partial":
            return
        print(f"  {sid} handed off — continuing in session {n + 1}")
        claude(prompt("continue", ID=sid), sid, f"{label}-cont{n}")
        reclaim(sid)
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
        # Telemetry off, as in CI: its global httpx instrumentation and log handlers break the telemetry tests.
        env = {"INVANA_ALLOW_GRAPH_TESTS": "1", "INVANA_TELEMETRY_ENABLED": "false"} \
            if os.environ.get("INVANA_MIGRATION_GRAPH_DB") else {}
        cmds = [(["uv", "run", "ruff", "check", "."], ROOT / "engine", {})]
        if env:  # graph-DB tests only against the isolated database (README › Isolation)
            cmds.append((["uv", "run", "pytest", "tests/", "-x", "-q"], ROOT / "engine", {**env, **graph_db_env()}))
        return cmds
    base = [(["pnpm", "lint"], studio, {}), (["pnpm", "check-types"], studio, {}),
            (["pnpm", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if turbo:
        base = [(["pnpm", "turbo", "run", "lint", "check-types", "test"], studio, {}), (["pnpm", "knip"], studio, {})]
    if sid not in ("A00",):
        base.append((["pnpm", "test:e2e", "--reporter=line"], studio, {}))
    return base


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
        res = sh(cmd, cwd, env)
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
    current = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    resuming = row["status"] in ("in progress", "partial") and current == row["branch"]
    if not git_clean() and not resuming:
        print("  working tree not clean — refusing to start over someone's uncommitted work")
        return False
    ensure_branch(row["branch"])
    set_status(sid, "in progress")
    if not resuming and sid.startswith(("A", "C")) and row["kind"].startswith("move"):
        sh(["node", "scripts/migration/shoot.mjs", "--live", "--smoke", "--out", f".migration-cache/{sid}/before"])
    try:
        # An interrupted run picks up where it stopped, from the work on disk and the hand-off notes.
        first, label = (prompt("continue", ID=sid), "resume") if resuming else (prompt("build", ID=sid), "build")
        build_until_handoffs_end(sid, first, label)
    except RuntimeError as exc:
        set_status(sid, "blocked", str(exc))
        return False

    for attempt in range(max_fix + 1):
        if not sid.startswith("B") and not ensure_stack():
            set_status(sid, "blocked", "dev stack down — `docker compose up -d engine studio`, then re-run")
            return False
        findings = run_gates(sid)
        if sid in TAMPERED:
            findings.insert(0, BASELINE_TAMPERED)
            TAMPERED.discard(sid)
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
    ap.add_argument("--max-fix", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--track", choices=["A", "B", "C", "R"], help="only sessions of this track")
    ap.add_argument("--baseline", action="store_true", help="record what knip and e2e already fail on, then exit")
    args = ap.parse_args()
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
