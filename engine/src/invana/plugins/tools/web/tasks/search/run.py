"""The ``web.search`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

MAX_RESULTS = 50


async def search(ctx: TaskContext, v: RunVars) -> Out:
    """Ask the install's SearXNG (the ``web_search`` secret is its base URL) for ``query``.

    Every result is ``{title, url, snippet}`` — the URL is the citation a later
    step fetches. No results is an answer, not a failure.
    """
    args = ctx.step.args or {}
    query = str(args.get("query") or "").strip()
    if not query:
        raise web.blocked("Name what to search for.", cause="bad_args")
    limit = max(1, min(int(args.get("limit") or 10), MAX_RESULTS))
    base = web.check_url(ctx.secret("web_search")).rstrip("/")

    data = await web.get_json(f"{base}/search", {"q": query, "format": "json"})
    results = [
        {"title": str(r.get("title") or ""), "url": str(r["url"]), "snippet": str(r.get("content") or "")}
        for r in (data.get("results") or [] if isinstance(data, dict) else [])
        if isinstance(r, dict) and r.get("url")
    ][:limit]
    return Out(
        detail=f"{len(results)} results for “{query[:80]}”",
        input={"query": query, "limit": limit},
        output={"results": results, "searched_at": web.now()},
    )


run = search
