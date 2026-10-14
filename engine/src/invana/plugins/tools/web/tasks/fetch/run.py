"""The ``web.fetch`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

#: A page, not a dataset — larger bodies are ``web.download_and_extract``'s job.
MAX_PAGE_BYTES = 5_000_000
_TEXTUAL = ("text/", "application/xhtml", "application/xml", "application/json")


async def fetch(ctx: TaskContext, v: RunVars) -> Out:
    """Read one page as ``{url, title, text, links, fetched_at}``.

    robots.txt is checked first and a disallowed URL is never requested. HTML
    is reduced to its text and absolute links; any other textual body is kept
    as it came, untitled. A binary body is refused with a pointer to
    ``web.download_and_extract``.
    """
    url = web.check_url((ctx.step.args or {}).get("url"))
    body = bytearray()
    async with web.client() as http:
        if not await web.robots_allows(url, http):
            raise web.robots_refusal(url)
        response = await web.stream_to(url, http, body.extend, max_bytes=MAX_PAGE_BYTES)

    final = str(response.url)
    kind = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if kind and not kind.startswith(_TEXTUAL):
        raise web.blocked(
            f"{final} is {kind}, not a page; download it with web.download_and_extract.",
            cause="not_a_page",
            url=final,
            content_type=kind,
        )
    raw = bytes(body).decode(response.charset_encoding or "utf-8", errors="replace")
    if kind in ("", "text/html", "application/xhtml+xml"):
        title, text, links = web.html_to_text(raw, base_url=final)
    else:
        title, text, links = "", raw, []
    ctx.artifact(final, direction="read", summary=title or None)
    return Out(
        detail=f"read {final[:120]} · {len(text):,} chars · {len(links)} links",
        input={"url": url},
        output={"url": final, "title": title, "text": text, "links": links, "fetched_at": web.now()},
    )


run = fetch
