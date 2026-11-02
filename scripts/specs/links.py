#!/usr/bin/env python3
"""Report relative markdown links that point at a file that does not exist.

A doc migration moves and deletes text; this is its gate that nothing still points at what moved. Run from the repo
root with the files or folders to check (default: ``docs``):

    python3 scripts/specs/links.py specs docs/for-developers

Checks ``[text](path)`` and ``[text](path#anchor)`` links that are relative paths — never URLs, anchors alone, code
spans or fenced code, and not the anchor itself. Exits 1 and lists each broken link when there is one. Standard library only.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

LINK = re.compile(r"\]\(([^)\s#]+)(?:#[^)\s]*)?\)")
FENCE = re.compile(r"^```.*?^```", re.S | re.M)
CODE = re.compile(r"`[^`\n]*`")


def broken(path: Path) -> list[str]:
    text = CODE.sub("", FENCE.sub("", path.read_text(encoding="utf-8", errors="replace")))
    out = []
    for target in LINK.findall(text):
        if re.match(r"^[a-z][a-z0-9+.-]*:", target, re.I) or target.startswith(("/", "<")):
            continue
        if not (path.parent / target).exists():
            out.append(f"{path}: {target}")
    return out


def main() -> int:
    roots = [Path(a) for a in sys.argv[1:]] or [Path("docs")]
    files = [f for r in roots for f in ([r] if r.is_file() else sorted(r.rglob("*.md")))]
    bad = [b for f in files for b in broken(f)]
    print("\n".join(bad) if bad else f"{len(files)} files · no broken links")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
