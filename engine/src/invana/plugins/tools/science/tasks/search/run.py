"""The ``science.pubmed.search`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
MAX_ARTICLES = 200


async def science_pubmed_search(ctx: TaskContext, v: RunVars) -> Out:
    """Search PubMed through NCBI E-utilities: ``esearch`` for the PMIDs, ``esummary`` for each one.

    Each article is ``{pmid, title, journal, year, url}``, ``url`` being its
    PubMed page. No match is an empty list, not a failure.
    """
    args = ctx.step.args or {}
    query = str(args.get("query") or "").strip()
    if not query:
        raise web.blocked("Name what to search PubMed for.", cause="bad_args")
    limit = max(1, min(int(args.get("limit") or 20), MAX_ARTICLES))

    async with web.client() as http:
        found = await web.get_json(
            f"{EUTILS}/esearch.fcgi",
            {"db": "pubmed", "term": query, "retmode": "json", "retmax": limit},
            http=http,
        )
        ids = [str(i) for i in (found.get("esearchresult") or {}).get("idlist") or []]
        summary = (
            await web.get_json(
                f"{EUTILS}/esummary.fcgi", {"db": "pubmed", "id": ",".join(ids), "retmode": "json"}, http=http
            )
            if ids
            else {}
        )

    result = summary.get("result") or {}
    articles = [
        {
            "pmid": pmid,
            "title": str(doc.get("title") or ""),
            "journal": str(doc.get("fulljournalname") or doc.get("source") or ""),
            "year": str(doc.get("pubdate") or "")[:4],
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
        }
        for pmid in ids
        if isinstance(doc := result.get(pmid), dict)
    ]
    return Out(
        detail=f"{len(articles)} PubMed articles for “{query[:80]}”",
        input={"query": query, "limit": limit},
        output={"articles": articles},
    )


run = science_pubmed_search
