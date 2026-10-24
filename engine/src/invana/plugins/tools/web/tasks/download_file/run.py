"""The ``web.download_file`` task type; ``manifest.toml`` beside this file declares it.

One task type for three acts — download, unzip, parse — so a dataset pulled
from the web is one envelope and one step on the run page rather than three
steps handing a temp path between them.
"""

from __future__ import annotations

import asyncio
import csv
import io
import json
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

#: Rows one run returns in all; the files list says when a file was cut short.
MAX_ROWS = 50_000
MAX_MB_CEILING = 500

_BY_TYPE = {
    "text/csv": ".csv",
    "text/tab-separated-values": ".tsv",
    "application/json": ".json",
    "application/x-ndjson": ".jsonl",
    "text/plain": ".txt",
    "application/zip": ".zip",
}
_TEXT = (".txt", ".md", ".text", ".log")


def _file_name(url: str, content_type: str) -> str:
    name = PurePosixPath(unquote(urlsplit(url).path)).name or "download"
    if not PurePosixPath(name).suffix:
        name += _BY_TYPE.get(content_type, "")
    return name


def _records(name: str, raw: bytes) -> tuple[str, list[dict]]:
    """``(format, rows)`` of one file; an unknown format is ``skipped`` with no rows."""
    suffix = PurePosixPath(name).suffix.lower()
    text = raw.decode("utf-8-sig", errors="replace")
    if suffix in (".csv", ".tsv"):
        reader = csv.DictReader(io.StringIO(text), delimiter="\t" if suffix == ".tsv" else ",")
        return suffix[1:], [dict(row) for row in reader]
    if suffix in (".jsonl", ".ndjson"):
        rows = [json.loads(line) for line in text.splitlines() if line.strip()]
        return "jsonl", [r if isinstance(r, dict) else {"value": r} for r in rows]
    if suffix == ".json":
        data = json.loads(text)
        if isinstance(data, dict):
            # The common wrapper: one key holding the list of records.
            lists = [value for value in data.values() if isinstance(value, list)]
            data = lists[0] if len(lists) == 1 else [data]
        rows = data if isinstance(data, list) else [data]
        return "json", [r if isinstance(r, dict) else {"value": r} for r in rows]
    if suffix in _TEXT:
        return "text", [{"line": n, "text": line} for n, line in enumerate(text.splitlines(), 1) if line.strip()]
    return "skipped", []


def _unzip(archive: Path, into: Path, max_bytes: int) -> list[tuple[str, Path]]:
    """``(name, path)`` of every member file, refusing a path that escapes ``into`` and a total past ``max_bytes``."""
    with zipfile.ZipFile(archive) as zf:
        members = [m for m in zf.infolist() if not m.is_dir() and not m.filename.startswith("__MACOSX/")]
        if sum(m.file_size for m in members) > max_bytes:
            raise web.blocked(
                f"The archive unpacks to more than {max_bytes / 1_000_000:g} MB.", cause="too_large", file=archive.name
            )
        out: list[tuple[str, Path]] = []
        for member in members:
            target = (into / member.filename).resolve()
            if not target.is_relative_to(into.resolve()):
                raise web.blocked(f"The archive holds an unsafe path: {member.filename}.", cause="unsafe_archive")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zf.read(member))
            out.append((member.filename, target))
        return out


def _extract(path: Path, workdir: Path, source: str, max_bytes: int) -> tuple[list[dict], list[dict]]:
    """``(files, rows)`` — blocking file work, run off the event loop."""
    if zipfile.is_zipfile(path):
        unpacked = workdir / "unpacked"
        unpacked.mkdir()
        named = _unzip(path, unpacked, max_bytes)
    else:
        named = [(path.name, path)]
    files: list[dict] = []
    rows: list[dict] = []
    for name, file in sorted(named):
        try:
            fmt, records = _records(name, file.read_bytes())
        except (ValueError, csv.Error) as exc:
            files.append({"name": name, "format": "unreadable", "rows": 0, "error": str(exc)[:200]})
            continue
        room = max(0, MAX_ROWS - len(rows))
        kept = records[:room]
        rows.extend({**r, "_source_url": source, "_source_file": name} for r in kept)
        files.append(
            {"name": name, "format": fmt, "rows": len(records), "kept": len(kept), "bytes": file.stat().st_size}
        )
    return files, rows


async def web_download_file(ctx: TaskContext, v: RunVars) -> Out:
    """Download ``url`` (at most ``max_mb``), unzip it if it is an archive, parse every file into rows.

    CSV and TSV rows are their columns; JSON is a list of records (or the one
    list a wrapper object holds); JSON Lines is one record a line; plain text
    is one row a line. Every row carries ``_source_url`` and ``_source_file``,
    so a row in the graph can say where it came from. Other formats are listed
    in ``files`` as ``skipped``. The download lives in a temp dir that is gone
    when the step ends.
    """
    args = ctx.step.args or {}
    url = web.check_url(args.get("url"))
    max_mb = int(args.get("max_mb") or 50)
    if not 1 <= max_mb <= MAX_MB_CEILING:
        raise web.blocked(f"max_mb is between 1 and {MAX_MB_CEILING}, not {max_mb}.", cause="bad_args")
    max_bytes = max_mb * 1_000_000

    with tempfile.TemporaryDirectory(prefix="invana-download-") as tmp:
        workdir = Path(tmp)
        async with web.client(timeout_s=120) as http:
            if not await web.robots_allows(url, http):
                raise web.robots_refusal(url)
            part = workdir / "download.part"
            with part.open("wb") as sink:
                response = await web.stream_to(url, http, sink.write, max_bytes=max_bytes)
        source = str(response.url)
        kind = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
        path = part.rename(workdir / _file_name(source, kind))
        files, rows = await asyncio.to_thread(_extract, path, workdir, source, max_bytes)

    ctx.artifact(source, direction="read", summary=f"{len(files)} files · {len(rows):,} rows")
    return Out(
        detail=f"{len(files)} files · {len(rows):,} rows from {source[:120]}",
        input={"url": url, "max_mb": max_mb},
        output={"url": source, "files": files, "rows": rows, "fetched_at": web.now()},
    )


run = web_download_file
