#!/usr/bin/env python3
"""Add, take up, close and list rows of ``.claude/team/agents-recommendations.md`` — the only way any role writes it.

Every role raises a recommendation with ``add``; nobody edits the file by hand, so the table always parses, IDs never
collide and a cell never breaks on a pipe. Only the product manager takes a row up (``take``) or closes it (``done``);
the edit-rights hook refuses those two for every other agent.

Usage::

    python3 .claude/skills/recommend/add.py add --from qa --raised-in "phase specs-accounts/P02" --kind test \\
        --severity medium --title "No test proves sign-out on password change" --description "SH-1.2 · …"
    python3 .claude/skills/recommend/add.py take R004 --priority P2 --as "phase specs-accounts/P03"
    python3 .claude/skills/recommend/add.py take R005 --priority P3 --as "declined — covered by R002"
    python3 .claude/skills/recommend/add.py done R004
    python3 .claude/skills/recommend/add.py list [--open] [--raised-in specs-accounts]

``add`` refuses a title that is already in the table and prints the existing row's ID instead. ``done`` deletes a row
once the work it was taken up as is done; a declined row is kept so it is not raised again. Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[3])
FILE = ROOT / ".claude" / "team" / "agents-recommendations.md"
HEAD = ["ID", "Date", "From", "Raised in", "Kind", "Severity", "Title", "Description", "Priority", "Taken up as"]
ROLES = ["product-manager", "project-lead", "designer", "coder", "qa", "security", "ravi"]
KINDS = ["bug", "test", "docs", "security", "component", "debt", "idea"]
SEVERITIES = ["blocker", "high", "medium", "low"]
PRIORITIES = ["P1", "P2", "P3"]
RAISED_IN = re.compile(r"^(session|phase \S+/[A-Z]\d{2}[a-z]?|project \S+)$")


def cell(value: str) -> str:
    return " ".join(value.replace("|", "·").split())


def load() -> tuple[list[str], int, list[list[str]]]:
    """The file's lines, the index of the table's header line, and its rows as cell lists."""
    lines = FILE.read_text().rstrip("\n").split("\n")
    head = next((i for i, ln in enumerate(lines) if ln.startswith("| ID | Date |")), None)
    if head is None:
        sys.exit(f"No recommendations table in {FILE.relative_to(ROOT)}")
    rows = []
    for ln in lines[head + 2:]:
        if not ln.startswith("|"):
            break
        rows.append([c.strip() for c in ln.strip().strip("|").split("|")])
    return lines, head, rows


def save(lines: list[str], head: int, rows: list[list[str]]) -> None:
    end = head + 2
    while end < len(lines) and lines[end].startswith("|"):
        end += 1
    lines[head + 2:end] = ["| " + " | ".join(r) + " |" for r in rows]
    FILE.write_text("\n".join(lines) + "\n")


def find(rows: list[list[str]], rid: str) -> list[str]:
    row = next((r for r in rows if r[0] == rid), None)
    if row is None:
        sys.exit(f"No recommendation {rid}")
    return row


def add(a: argparse.Namespace) -> None:
    if not RAISED_IN.match(a.raised_in):
        sys.exit("--raised-in is `session`, `phase <project>/<ID>` or `project <name>`")
    lines, head, rows = load()
    title = cell(a.title)
    if same := next((r for r in rows if r[6].lower() == title.lower()), None):
        print(f"{same[0]} already says this — add to it through the product manager, not a new row")
        return
    n = max((int(r[0][1:]) for r in rows if re.fullmatch(r"R\d+", r[0])), default=0) + 1
    rid = f"R{n:03d}"
    rows.append([rid, dt.date.today().isoformat(), a.who, a.raised_in, a.kind, a.severity, title,
                 cell(a.description), "", ""])
    save(lines, head, rows)
    print(rid)


def take(a: argparse.Namespace) -> None:
    lines, head, rows = load()
    row = find(rows, a.id)
    row[8], row[9] = a.priority, cell(getattr(a, "as"))
    save(lines, head, rows)
    print(f"{a.id} · {row[8]} · {row[9]}")


def done(a: argparse.Namespace) -> None:
    lines, head, rows = load()
    row = find(rows, a.id)
    if not row[9] or row[9].startswith("declined"):
        sys.exit(f"{a.id} is not taken up as work — a declined row stays")
    save(lines, head, [r for r in rows if r[0] != a.id])
    print(f"{a.id} closed")


def show(a: argparse.Namespace) -> None:
    _, _, rows = load()
    for r in rows:
        if a.open and r[9]:
            continue
        if a.raised_in and a.raised_in not in r[3]:
            continue
        print(" · ".join(x for x in (r[0], r[2], r[3], r[4], r[5], r[6], r[8], r[9]) if x))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("add", help="raise a recommendation (any role)")
    p.add_argument("--from", dest="who", required=True, choices=ROLES)
    p.add_argument("--raised-in", required=True, help="session · phase <project>/<ID> · project <name>")
    p.add_argument("--kind", required=True, choices=KINDS)
    p.add_argument("--severity", required=True, choices=SEVERITIES)
    p.add_argument("--title", required=True)
    p.add_argument("--description", required=True, help="what and where · the change recommended")
    p.set_defaults(fn=add)
    p = sub.add_parser("take", help="prioritise and take up a row (product manager)")
    p.add_argument("id")
    p.add_argument("--priority", required=True, choices=PRIORITIES)
    p.add_argument("--as", required=True, help="session · phase <project>/<ID> · project <name> · declined — <reason>")
    p.set_defaults(fn=take)
    p = sub.add_parser("done", help="close a row whose work is done (product manager)")
    p.add_argument("id")
    p.set_defaults(fn=done)
    p = sub.add_parser("list", help="print the rows")
    p.add_argument("--open", action="store_true", help="only rows not yet taken up")
    p.add_argument("--raised-in", default="", help="only rows whose Raised in contains this")
    p.set_defaults(fn=show)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
