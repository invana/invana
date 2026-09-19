#!/usr/bin/env python3
"""Extract artboards from the *Agents at Work Wireframes* design canvas.

The hi-fi lives in a published artifact, not in this repo. Claude Code reads it
with the Artifact tool, which saves the whole page to a local file; this script
turns that file into one standalone HTML page per artboard under `.design/`,
so a build session can open a single screen instead of a 4.6MB canvas.

    # 1. in Claude Code:  Artifact read https://claude.ai/code/artifact/<id>
    # 2. then:
    python scripts/design-pull.py --list
    python scripts/design-pull.py --page "Hi-fi · finance"
    python scripts/design-pull.py --only SkillsHiFi --only WorkflowsHiFi

`.design/` is gitignored: the canvas is the source of truth, this is a cache.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

CANVAS_ID = "58f2e380-ef59-41cd-8c96-d3dc7ddd06e4"
DOC_RE = re.compile(r'id="appifact-doc"[^>]*>(.*?)</script>', re.S)
HELMET_RE = re.compile(r"<helmet>(.*?)</helmet>", re.S)
BOARD_RE = re.compile(r"<x-dc>(.*?)</x-dc>", re.S)


def find_artifact(explicit: str | None) -> Path:
    """The newest locally saved copy of the canvas."""
    if explicit:
        return Path(explicit).expanduser()
    roots = sorted(
        (Path.home() / ".claude" / "projects").glob(f"*/*/tool-results/artifact-{CANVAS_ID[:8]}*.html"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not roots:
        sys.exit(
            "No saved canvas found. Read the artifact first:\n"
            f"  https://claude.ai/code/artifact/{CANVAS_ID}\n"
            "then pass the saved path with --artifact."
        )
    return roots[0]


def load(path: Path) -> tuple[dict[str, str], list[dict], dict[str, str]]:
    doc = json.loads(DOC_RE.search(path.read_text(encoding="utf-8", errors="replace")).group(1))
    files = doc["content"]["files"]
    canvas = json.loads(files["canvas.json"])
    pages = {p["id"]: p["name"] for p in canvas.get("pages", [])}
    return files, canvas["artboards"], pages


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-") or "artboard"


def standalone(source: str, title: str, dark: bool) -> str:
    """One .dc.html artboard as a page a browser can open on its own."""
    helmet = HELMET_RE.search(source)
    board = BOARD_RE.search(source)
    if not board:
        raise ValueError("no <x-dc> block")
    body = board.group(1).replace("{{themeClass}}", "dark" if dark else "light")
    return (
        "<!doctype html>\n<html>\n<head>\n<meta charset='utf-8'>\n"
        f"<title>{title}</title>\n"
        f"{helmet.group(1) if helmet else ''}\n"
        "</head>\n<body style='margin:0'>\n"
        f"{body}\n</body>\n</html>\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--artifact", help="path to the saved canvas HTML (default: newest under ~/.claude)")
    ap.add_argument("--out", default=".design", help="output directory (default: .design)")
    ap.add_argument("--page", action="append", help="only this canvas page, by name; repeatable")
    ap.add_argument("--only", action="append", help="only this artboard, by file stem; repeatable")
    ap.add_argument("--dark", action="store_true", help="render the dark theme")
    ap.add_argument("--list", action="store_true", help="list artboards and exit")
    args = ap.parse_args()

    path = find_artifact(args.artifact)
    files, artboards, pages = load(path)

    if args.list:
        for board in artboards:
            print(f"{pages.get(board.get('page'), '?'):20s}  {board['file'][:-8]:26s}  {board.get('title', '')}")
        return

    out = Path(args.out)
    written: list[dict] = []
    for board in artboards:
        page = pages.get(board.get("page"), "unpaged")
        stem = board["file"][: -len(".dc.html")]
        if args.page and page not in args.page:
            continue
        if args.only and stem not in args.only:
            continue
        title = board.get("title", stem)
        target = out / slug(page) / f"{stem}.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(standalone(files[board["file"]], title, args.dark), encoding="utf-8")
        written.append({"page": page, "artboard": stem, "title": title, "file": str(target)})
        print(f"{target}  ·  {title}")

    if not written:
        sys.exit("Nothing matched. Run with --list to see what the canvas holds.")

    out.mkdir(parents=True, exist_ok=True)
    (out / "index.json").write_text(
        json.dumps({"source": str(path), "canvas": CANVAS_ID, "artboards": written}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\n{len(written)} artboards → {out}/  (index.json written)")


if __name__ == "__main__":
    main()
