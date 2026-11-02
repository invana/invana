#!/usr/bin/env python3
"""Lets each team agent edit only its own files — and writes the matrix that says which those are.

``.claude/team/edit-rights.json`` is the one source: the *areas* of the repo (path globs) and, per role, the areas it
may edit. This file reads it two ways:

| Run as | Does |
|---|---|
| A ``PreToolUse`` hook (``.claude/settings.json``, stdin) | Refuses an ``Edit``, ``Write`` or ``NotebookEdit`` of a file outside the agent's areas, and a ``Bash`` call that visibly writes one (``>``, ``tee``, ``sed -i``, ``cp``, ``mv``, ``rm``, ``touch``), commits without the right, pushes, or takes up a recommendation without being the product manager. The refusal names the area and how to raise a recommendation instead |
| ``--table`` · ``--write`` · ``--check`` | Prints the matrix as markdown · writes it into ``.claude/team/TEAM.md`` between the ``edit-rights`` markers · exits 1 when TEAM.md is out of date |

Who is checked: a call whose hook input carries ``agent_type`` naming a role in the JSON — a sub-agent of that type, or
a session started with ``--agent``. A plain session (Ravi's) and any other agent type are not checked. A path that
matches several areas is allowed when any of them is. The Bash check sees what a command names on its face; a script
that writes files (``python3 x.py``) is not inspected. Any failure inside the hook allows the call: it never breaks a
session. Standard library only.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import shlex
import sys
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2])
RIGHTS = ROOT / ".claude" / "team" / "edit-rights.json"
TEAM = ROOT / ".claude" / "team" / "TEAM.md"
START, END = "<!-- edit-rights:start -->", "<!-- edit-rights:end -->"
RAISE = ("Raise it instead: python3 .claude/skills/recommend/add.py add --from {role} --raised-in <session · phase "
         "<project>/<ID>> --kind <kind> --severity <severity> --title \"…\" --description \"…\"")
WRITERS = {"tee", "touch", "rm", "cp", "mv", "install", "truncate"}
SEPARATORS = {";", "&&", "||", "|", "&", "(", ")"}


def glob_re(pattern: str, role: str) -> re.Pattern:
    """A path glob as a regex: ``**`` spans folders, ``*`` stays within one."""
    pattern = os.path.expanduser(pattern.replace("{role}", role))
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + r"\Z")


def load() -> dict:
    return json.loads(RIGHTS.read_text())


def role_of(spec: dict, name: str) -> dict | None:
    return next((r for r in spec["roles"] if r["key"] == name), None)


def areas_of(spec: dict, path: str, role: str) -> list[str]:
    """The keys of every area whose globs match the path (relative to the repo, or absolute outside it)."""
    found = []
    for area in spec["areas"] + [{"key": "always", **spec["always"]}]:
        if any(glob_re(p, role).match(path) for p in area["paths"]):
            found.append(area["key"])
    return found


def relative(path: str, cwd: str) -> str:
    full = Path(path) if os.path.isabs(path) else Path(cwd or ROOT) / path
    full = Path(os.path.normpath(full))
    try:
        return full.relative_to(ROOT).as_posix()
    except ValueError:
        return full.as_posix()


def may_edit(spec: dict, role: dict, path: str) -> tuple[bool, list[str]]:
    hit = areas_of(spec, path, role["key"])
    rights = role.get("rights", {})
    return ("always" in hit or any(rights.get(a) for a in hit)), hit


def bash_targets(command: str) -> list[str]:
    """The files a shell command visibly writes."""
    lex = shlex.shlex(command, posix=True, punctuation_chars=";&|()<>")
    lex.whitespace_split = True
    tokens = list(lex)
    targets: list[str] = []
    segment: list[str] = []
    for i, tok in enumerate(tokens + [";"]):
        if tok in (">", ">>") and i + 1 < len(tokens):
            nxt, prev = tokens[i + 1], tokens[i - 1] if i else ""
            if nxt != "&" and not (prev.isdigit() and nxt.startswith("/dev/")) and nxt != "/dev/null":
                targets.append(nxt)
            continue
        if tok in SEPARATORS or tok == ";":
            targets += writes_of(segment)
            segment = []
        elif tok not in ("<", ">", ">>"):
            segment.append(tok)
    return targets


def writes_of(seg: list[str]) -> list[str]:
    if not seg:
        return []
    cmd, args = os.path.basename(seg[0]), [a for a in seg[1:] if not a.startswith("-")]
    if cmd == "git" and len(seg) > 2 and seg[1] == "mv":
        return seg[2:]
    if cmd == "sed" and any(a.startswith("-i") for a in seg[1:]):
        return args[-1:] if args else []
    if cmd in ("cp", "mv", "install"):
        return args[-1:]
    if cmd in WRITERS:
        return args
    return []


def refuse(reason: str) -> None:
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": reason}}))
    sys.exit(0)


def label(spec: dict, keys: list[str]) -> str:
    names = {a["key"]: a["label"] for a in spec["areas"]}
    return " · ".join(names.get(k, k) for k in keys) or "no area — not editable by any team agent"


def check(event: dict) -> None:
    spec = load()
    role = role_of(spec, event.get("agent_type") or "")
    if not role or role.get("all"):
        return
    name, rights, tool = role["key"], role.get("rights", {}), event.get("tool_name", "")
    inp, cwd = event.get("tool_input") or {}, event.get("cwd") or str(ROOT)
    paths: list[str] = []
    if tool in ("Edit", "Write", "MultiEdit"):
        paths = [inp.get("file_path", "")]
    elif tool == "NotebookEdit":
        paths = [inp.get("notebook_path", "")]
    elif tool == "Bash":
        cmd = inp.get("command", "")
        if re.search(r"\bgit\b[^;&|]*\bpush\b", cmd):
            refuse(f"Edit rights: no agent pushes ({name}). Pushing is Ravi's.")
        if re.search(r"\bgit\b[^;&|]*\bcommit\b", cmd) and not rights.get("commit"):
            refuse(f"Edit rights: {name} does not commit. Leave the change for whoever does.")
        if re.search(r"recommend/add\.py\s+(take|done)\b", cmd) and not rights.get("take"):
            refuse(f"Edit rights: only the product manager takes up or closes a recommendation ({name}).")
        try:
            paths = bash_targets(cmd)
        except ValueError:
            return
    for p in filter(None, paths):
        rel = relative(p, cwd)
        ok, hit = may_edit(spec, role, rel)
        if not ok:
            refuse(f"Edit rights: {name} may not edit {rel} ({label(spec, hit)}). See .claude/team/TEAM.md §1 "
                   f"*Edit rights*. " + RAISE.format(role=name))


# ── the matrix ─────────────────────────────────────────────────────────────
def table(spec: dict) -> str:
    cols = spec["areas"]
    out = ["| Role | " + " | ".join(a["label"] for a in cols) + " |", "|---" * (len(cols) + 1) + "|"]
    for r in spec["roles"]:
        cells = []
        for a in cols:
            v = True if r.get("all") else r.get("rights", {}).get(a["key"])
            cells.append("✅" if v is True else f"✅ {v}" if v else "—")
        out.append(f"| {r['label']} | " + " | ".join(cells) + " |")
    paths = " · ".join(f"`{p}`" for p in spec["always"]["paths"])
    areas = "\n".join(f"| {a['label']} | " + (" · ".join(f"`{p}`" for p in a["paths"]) or "a command, not a path") + " |"
                      for a in cols)
    return ("\n".join(out) + f"\n\n{spec['always']['label']}: {paths}.\n\n| Area | Paths |\n|---|---|\n" + areas)


def block(spec: dict) -> str:
    return f"{START}\n<!-- written by .claude/hooks/edit_rights.py --write from edit-rights.json; do not edit -->\n\n" \
           f"{table(spec)}\n\n{END}"


def team_text(spec: dict) -> str | None:
    text = TEAM.read_text()
    if START not in text or END not in text:
        return None
    return text[:text.index(START)] + block(spec) + text[text.index(END) + len(END):]


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else ""
    if arg == "--table":
        print(table(load()))
        return 0
    if arg in ("--write", "--check"):
        spec = load()
        new = team_text(spec)
        if new is None:
            print(f"No {START} … {END} markers in {TEAM.relative_to(ROOT)}")
            return 1
        if arg == "--write":
            TEAM.write_text(new)
            return 0
        if new != TEAM.read_text():
            print("TEAM.md's edit-rights matrix is out of date: python3 .claude/hooks/edit_rights.py --write")
            return 1
        return 0
    with contextlib.suppress(Exception):  # the hook never breaks a session
        check(json.load(sys.stdin))
    return 0


if __name__ == "__main__":
    sys.exit(main())
