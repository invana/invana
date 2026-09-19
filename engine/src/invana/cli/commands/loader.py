"""invana loader <path> — load CSV datasets into a graph database.

The fast path (load-data.md · The other path): straight through the connector's
bulk queryset, no per-record validation, no report, no provenance. With
``--graph`` it still leaves a row in that Graph's Imports journal, marked
``bulk``, because a run that wrote fifty thousand nodes should not be invisible
to the person who has to account for them (IW11).
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import click


def _print_summary(path: str, stats, dry_run: bool) -> None:
    """Print a human-readable load summary to stdout."""
    prefix = "DRY RUN — " if dry_run else ""

    click.echo(f"\n{prefix}Dataset: {path}")

    # `LoaderStats.errors` is a list of messages, not of records — the label is
    # named inside the sentence, so that is where it is looked for.
    for label, count in stats.vertices_by_label.items():
        status = "✗" if any(label in message for message in stats.errors) else "✓"
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
    from invana.graph.loaders import CSVLoader

    loader = CSVLoader(connector=connector, config=config)
    async with connector:
        return await loader.load_directory(path)


@click.command("loader")
@click.argument("path")
@click.option(
    "--uri",
    default=None,
    help="Graph DB connection URI, e.g. bolt://localhost:7687. Taken from --graph when omitted.",
)
@click.option(
    "--database",
    default=None,
    help="Database on the server to load into. Taken from --graph when omitted; blank uses the connector's default.",
)
@click.option("--username", default=None, help="DB username.")
@click.option("--password", default=None, help="DB password.")
@click.option(
    "--connector",
    "connector_path",
    default=None,
    help=(
        "Full dotted path to the connector class, e.g. "
        "invana_neo4j.Neo4jConnector or "
        "invana.graph.connectors.OpenCypherConnector. "
        "Taken from --graph when omitted."
    ),
)
@click.option("--batch-size", default=500, show_default=True, help="Records per bulk call.")
@click.option("--skip-on-error", is_flag=True, default=False, help="Log and skip failures.")
@click.option("--dry-run", is_flag=True, default=False, help="Parse only — no DB writes.")
@click.option("--no-source-ids", is_flag=True, default=False, help="Omit _csv_source_id property.")
@click.option(
    "--graph",
    "graph_ref",
    default=None,
    help=(
        "Load into this Graph's own connection and record the run in its Imports "
        "journal. <username>/<slug>. Without it, --uri and --connector are required "
        "and the load is not journaled."
    ),
)
@click.option(
    "--user",
    "user_ref",
    default=None,
    help="Attribute the run to this user (username or email). Without it, the run is labelled with the shell.",
)
def loader_cmd(
    path: str,
    uri: str | None,
    database: str | None,
    username: str | None,
    password: str | None,
    connector_path: str | None,
    batch_size: int,
    skip_on_error: bool,
    dry_run: bool,
    no_source_ids: bool,
    graph_ref: str | None,
    user_ref: str | None,
) -> None:
    """Load CSV datasets from PATH into a graph database."""
    from invana.core.utils import import_class_from_dotted_path
    from invana.graph.loaders import LoaderConfig

    # **A run you cannot replay is not a run.** Naming a Graph and nothing else
    # means the connection is the Graph's, so the load can be opened as a
    # `bulk-load@1` run and re-run from its own record (LD10). Describing the
    # database on the command line cannot be journaled that way — replaying it
    # would need credentials, and credentials never ride a run's `params` — so
    # that stays the direct, unjournaled path, exactly as it is without a Graph.
    overrides = any(v is not None for v in (uri, database, username, password, connector_path))
    if graph_ref and not overrides and not dry_run:
        asyncio.run(_run_bulk(graph_ref, path, user_ref, batch_size, skip_on_error, not no_source_ids))
        return

    if dry_run:
        click.echo(f"DRY RUN — parsing {path} (no DB writes)")

    # The Graph knows its own database. Naming it is enough; the flags stay for a
    # database no Graph points at, and win when both are given.
    target = asyncio.run(_resolve_graph(graph_ref, user_ref)) if graph_ref else None

    # The Graph supplies the connection; each flag overrides one part of it. With
    # no Graph, the flags are the whole connection and two of them are required.
    destination = uri or (target.uri if target else None)
    class_path = connector_path or (target.connector_class if target else None)
    if not destination or not class_path:
        raise click.UsageError("Name a --graph, or give --connector and --uri.")

    auth: dict = dict(target.auth) if target else {}
    if username is not None:
        auth["username"] = username
    if password is not None:
        auth["password"] = password
    # The Graph names its own database (connect-a-database.md CD8), so a CLI load
    # lands where Studio reads. Passed on only when one is named.
    db_name = database if database is not None else (target.database if target else None)
    if (db_name or "").strip():
        auth["database"] = db_name.strip()

    try:
        connector_cls = import_class_from_dotted_path(class_path)
    except (ValueError, ImportError, AttributeError) as exc:
        raise click.ClickException(str(exc)) from exc
    connector = connector_cls(destination, **auth)

    config = LoaderConfig(
        batch_size=batch_size,
        skip_on_error=skip_on_error,
        dry_run=dry_run,
        keep_source_ids=not no_source_ids,
    )

    if not dry_run:
        click.echo(f"Loading {path} → {destination}")

    try:
        stats = asyncio.run(_run_loader(connector, path, config))
    except Exception as exc:
        raise click.ClickException(f"Load failed: {exc}") from exc

    _print_summary(path, stats, dry_run)

    # A dry run wrote nothing, so there is nothing to account for.
    if dry_run:
        return
    # Said once, where it can still be acted on. The journal is the place a
    # person looks for "what did the CLI do to my graph", and this load is not
    # in it.
    click.echo(
        "\n  not journaled — pass --graph <username>/<slug> on its own, with no connection flags, "
        "to record this load as a run."
    )


@dataclass
class _Target:
    """A Graph named with `--graph`: where to write, and who is doing it.

    The connection is carried as its parts rather than as a built connector, so a
    flag can override one of them — a Graph whose URI is a container hostname is
    still the right Graph when you run the CLI from the host with
    `--uri bolt://localhost:7687`.
    """

    graph_id: str
    uri: str
    connector_class: str
    database: str | None
    auth: dict
    actor_id: str | None
    actor_label: str


async def _resolve_graph(graph_ref: str, user_ref: str | None) -> _Target:
    """The Graph's own connection and the principal running this load.

    One lookup for both, because they answer one question: *whose database, and
    on whose behalf*.
    """

    from invana.apps.graphs.encryption import decrypt_credentials
    from invana.apps.graphs.managers import GraphManager
    from invana.apps.graphs.querysets import GraphQuerySet
    from invana.cli.principal import shell_label
    from invana.core.auth.querysets import UserQuerySet
    from invana.core.db import create_db_engine, create_session_factory
    from invana.core.settings import settings

    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    owner, slug = graph_ref.split("/", 1)

    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(session, owner_username=owner, slug=slug)
            if graph is None:
                raise click.UsageError(f"Graph {graph_ref!r} not found.")

            connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
            if connection is None:
                raise click.UsageError(f"Graph {graph_ref!r} has no connection — attach one, or pass --uri.")
            if connection.read_only:
                raise click.UsageError("This connection is marked read-only. Invana never writes to one.")

            actor_id: str | None = None
            actor_label = shell_label()
            if user_ref:
                actor = await UserQuerySet().get_by_username_or_email(session, user_ref)
                if actor is None:
                    raise click.UsageError(f"No user {user_ref!r}.")
                actor_id, actor_label = actor.id, actor.username

            return _Target(
                graph_id=graph.id,
                uri=connection.uri,
                connector_class=connection.connector_class,
                database=connection.database,
                auth=decrypt_credentials(connection.auth_encrypted, settings.encryption_key)
                if connection.auth_encrypted
                else {},
                actor_id=actor_id,
                actor_label=actor_label,
            )
    finally:
        await engine.dispose()


async def _run_bulk(
    graph_ref: str,
    path: str,
    user_ref: str | None,
    batch_size: int,
    skip_on_error: bool,
    keep_source_ids: bool,
) -> None:
    """Open the bulk run, hand it to the runtime, and report what it did.

    **Nothing here knows how a CSV folder is written.** `bulk-load@1` does, and
    `bulk_write` is the one step in it — the same shape `invana records import`
    already uses, so both kinds of load are one journal and one trace (LD10).
    """
    from invana.apps.graphs.pool import GraphConnectionManager
    from invana.apps.graphs.querysets import GraphQuerySet
    from invana.apps.task_plans.models import Task as PlanTask  # noqa: F401
    from invana.core.auth.querysets import UserQuerySet
    from invana.core.db import create_db_engine, create_session_factory
    from invana.core.settings import settings
    from invana.runtime import services as run_services
    from invana.runtime.interpreter import TaskRuntime
    from invana.runtime.models import RunStatus, TaskRun
    from invana.runtime.querysets import TaskRunQuerySet

    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    username, slug = graph_ref.split("/", 1)

    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    manager = GraphConnectionManager(session_factory=session_factory, encryption_key=settings.encryption_key)
    await manager.startup()
    runtime = TaskRuntime(session_factory=session_factory, manager=manager, encryption_key=settings.encryption_key)
    try:
        async with session_factory() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(session, owner_username=username, slug=slug)
            if graph is None:
                raise click.UsageError(f"Graph {graph_ref!r} not found.")
            actor_id: str | None = None
            if user_ref:
                actor = await UserQuerySet().get_by_username_or_email(session, user_ref)
                if actor is None:
                    raise click.UsageError(f"No user {user_ref!r}.")
                actor_id = actor.id
            run = await run_services.open_bulk_run(
                session,
                graph=graph,
                path=path,
                batch_size=batch_size,
                skip_on_error=skip_on_error,
                keep_source_ids=keep_source_ids,
                actor_id=actor_id,
            )
            run_id = run.id
            await session.commit()

        click.echo(f"run {run_id}")
        await runtime._run(run_id)

        async with session_factory() as session:
            root = await session.get(TaskRun, run_id)
            nodes = await TaskRunQuerySet().nodes_of(session, run_id=run_id)
            out = next((n.output or {} for n in nodes if n.task_key == "bulk_write"), {})
            status = root.status
            fatal = (root.error or {}).get("message")

        click.echo(
            f"Bulk load {status}: {out.get('nodes', 0)} node(s), {out.get('edges', 0)} edge(s), "
            f"{out.get('failed', 0)} failed."
        )
        # Said every time, because the whole point of the kind is that this load
        # cannot answer "where did this record come from".
        click.echo("  bulk: no validation, no provenance.")
        if status != RunStatus.succeeded.value:
            raise click.ClickException(fatal or f"The load {status}. Open the run for the trace.")
    finally:
        await manager.shutdown()
        await engine.dispose()
