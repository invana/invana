"""`invana search` — the ⌘K search, from a terminal.

docs/for-developers/modules/platform/features/search.md. Searches as the
``--user`` named, so it sees exactly what they may open:

    invana search "arabid" --user ada
    invana search "flower" --user ada --graph ada/arabidopsis --json

One line per hit — kind, name, Graph, id — closest first.
"""

from __future__ import annotations

import asyncio
import json

import click

from invana.activity.managers import SearchManager
from invana.activity.managers.search import DEFAULT_LIMIT
from invana.cli.context import as_user


@click.command("search")
@click.argument("text")
@click.option("--user", "user_ref", required=True, help="Who is searching (username or email).")
@click.option("--graph", "graph_ref", default=None, help="Narrow to one Graph, as <username>/<slug>.")
@click.option("--limit", default=DEFAULT_LIMIT, show_default=True, help="At most this many hits (up to 50).")
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of lines.")
def search_cmd(text: str, user_ref: str, graph_ref: str | None, limit: int, as_json: bool) -> None:
    """Find records by name across every Graph and dataset USER may open."""

    async def go() -> None:
        async with as_user(user_ref) as (session, reader):
            response = await SearchManager().search(session, reader=reader, text=text, graph_ref=graph_ref, limit=limit)
        if as_json:
            click.echo(json.dumps(response.model_dump(mode="json"), indent=2))
            return
        if not response.hits:
            click.echo(f"Nothing named like {response.query!r}.")
            return
        for hit in response.hits:
            click.echo(f"{hit.kind}\t{hit.name}\t{hit.graph or '—'}\t{hit.id}")

    asyncio.run(go())
