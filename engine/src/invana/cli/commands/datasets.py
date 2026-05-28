"""`invana datasets ...` — dataset ingestion (RFC-020)."""

from __future__ import annotations

import asyncio

import click
from sqlalchemy import select

from invana.auth.models import User
from invana.datasets.importer import DatasetImportError, import_dataset
from invana.db import create_db_engine, create_session_factory
from invana.graphs.models import Graph


@click.group("datasets")
def datasets_cmd() -> None:
    """Dataset ingestion."""


@datasets_cmd.command("import")
@click.option("--graph", "graph_ref", required=True, help="Target graph as <username>/<slug>.")
@click.option("--name", required=True, help="Dataset + model name.")
@click.option(
    "--path",
    "path",
    required=True,
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="Dataset directory (model.json + nodes/ + edges/).",
)
def import_cmd(graph_ref: str, name: str, path: str) -> None:
    """Import a dataset: derive/version a model, validate, ingest + stitch into the graph."""
    asyncio.run(_run_import(graph_ref, name, path))


async def _run_import(graph_ref: str, name: str, path: str) -> None:
    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    username, slug = graph_ref.split("/", 1)

    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            graph = (
                await session.execute(
                    select(Graph)
                    .join(User, User.id == Graph.created_by_id)
                    .where(User.username == username, Graph.slug == slug)
                )
            ).scalar_one_or_none()
            if graph is None:
                raise click.UsageError(f"Graph {graph_ref!r} not found.")

            try:
                job = await import_dataset(session, graph_id=graph.id, name=name, path=path)
            except DatasetImportError as exc:
                raise click.ClickException(str(exc)) from exc

            status = job.status
            processed, total, errors = job.records_processed, job.records_total, job.error_count
            report = job.report or {}

        click.echo(f"Import {status}: {processed}/{total} records ingested, {errors} validation error(s).")
        for e in (report.get("errors") or [])[:20]:
            click.echo(f"  - {e.get('file')}[{e.get('record_index')}] id={e.get('record_id')}: {e.get('message')}")
        if report.get("fatal"):
            raise click.ClickException(report["fatal"])
    finally:
        await engine.dispose()
