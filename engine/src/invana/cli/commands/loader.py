"""invana loader <path> — load CSV datasets into a graph database."""

from __future__ import annotations

import asyncio

import click


def _print_summary(path: str, stats, dry_run: bool) -> None:
    """Print a human-readable load summary to stdout."""
    prefix = "DRY RUN — " if dry_run else ""

    click.echo(f"\n{prefix}Dataset: {path}")

    for label, count in stats.vertices_by_label.items():
        status = "✓" if label not in {e.get("label") for e in stats.errors} else "✗"
        click.echo(f"  {status} {label:<20} {count:>6} vertices")

    for label, count in stats.edges_by_label.items():
        click.echo(f"  ✓ {label:<20} {count:>6} edges")

    if stats.errors:
        click.echo(f"\n  Errors: {len(stats.errors)}")
        for err in stats.errors[:5]:
            click.echo(f"    - {err}")
        if len(stats.errors) > 5:
            click.echo(f"    ... and {len(stats.errors) - 5} more")

    total_v = stats.vertices_created
    total_e = stats.edges_created
    duration = f"{stats.duration_seconds:.2f}s" if stats.duration_seconds else ""

    summary_parts = []
    if total_v:
        summary_parts.append(f"{total_v} vertices")
    if total_e:
        summary_parts.append(f"{total_e} edges")

    summary = ", ".join(summary_parts) if summary_parts else "0 records"
    click.echo(f"\n{prefix}Total: {summary}" + (f" in {duration}" if duration else ""))


async def _run_loader(connector, path: str, config) -> object:
    """Run the CSV loader inside the connector's async context."""
    from invana.loaders import CSVLoader

    loader = CSVLoader(connector=connector, config=config)
    async with connector:
        return await loader.load_directory(path)


@click.command("loader")
@click.argument("path")
@click.option("--uri", default=None, help="Graph DB connection URI (env: INVANA_GRAPH_URI).")
@click.option("--username", default=None, help="DB username (env: INVANA_GRAPH_USERNAME).")
@click.option("--password", default=None, help="DB password (env: INVANA_GRAPH_PASSWORD).")
@click.option(
    "--connector",
    "connector_path",
    default=None,
    help=(
        "Full dotted path to a connector class, e.g. "
        "invana.graph.connectors.cypher.connector.OpenCypherConnector "
        "or invana_neo4j.connector.Neo4jConnector "
        "(env: INVANA_GRAPH_CONNECTOR). Required."
    ),
)
@click.option("--batch-size", default=500, show_default=True, help="Records per bulk call.")
@click.option("--skip-on-error", is_flag=True, default=False, help="Log and skip failures.")
@click.option("--dry-run", is_flag=True, default=False, help="Parse only — no DB writes.")
@click.option("--no-source-ids", is_flag=True, default=False, help="Omit _csv_source_id property.")
def loader_cmd(
    path: str,
    uri: str | None,
    username: str | None,
    password: str | None,
    connector_path: str | None,
    batch_size: int,
    skip_on_error: bool,
    dry_run: bool,
    no_source_ids: bool,
) -> None:
    """Load CSV datasets from PATH into a graph database."""
    from invana.loaders import LoaderConfig
    from invana.settings import settings
    from invana.utils import import_class_from_dotted_path

    # CLI flags win, then settings/env
    _uri = uri or settings.graph_uri
    _username = username or settings.graph_username or None
    _password = password or settings.graph_password or None
    _connector_path = connector_path or settings.graph_connector or None

    if not _uri:
        raise click.UsageError("--uri is required (or set INVANA_GRAPH_URI).")
    if not _connector_path:
        raise click.UsageError("--connector is required (or set INVANA_GRAPH_CONNECTOR).")

    if dry_run:
        click.echo(f"DRY RUN — parsing {path} (no DB writes)")

    try:
        connector_cls = import_class_from_dotted_path(_connector_path)
    except (ValueError, ImportError, AttributeError) as exc:
        raise click.ClickException(str(exc)) from exc

    # Instantiate connector
    kwargs: dict = {}
    if _username is not None:
        kwargs["username"] = _username
    if _password is not None:
        kwargs["password"] = _password

    connector = connector_cls(_uri, **kwargs)

    config = LoaderConfig(
        batch_size=batch_size,
        skip_on_error=skip_on_error,
        dry_run=dry_run,
        keep_source_ids=not no_source_ids,
    )

    if not dry_run:
        click.echo(f"Loading {path} → {_uri}")

    try:
        stats = asyncio.run(_run_loader(connector, path, config))
    except Exception as exc:
        raise click.ClickException(f"Load failed: {exc}") from exc

    _print_summary(path, stats, dry_run)
