"""`invana models …` — the portable side of a domain model.

Files and git are the registry (docs/for-developers/modules/connect-and-model/features/share-a-model.md
SM1). There is no service to publish to: a model exports as one file, that file is
committed, and another Graph imports or upgrades from it.

    invana models list      --graph ravi/finance
    invana models starters
    invana models export    --graph ravi/finance --name MarketData --out marketdata.json
    invana models import    --graph ravi/other   --file marketdata.json [--as MarketDataV2]
    invana models import    --graph ravi/other   --starter memory
    invana models upgrade   --graph ravi/other   --name MarketData --file marketdata.json
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click

from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.modeller import starters as starter_models
from invana.apps.modeller.portability import (
    ImportRefused,
    ModelArtefact,
    build_artefact,
    import_artefact,
    upgrade_model,
)
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import compute_diff
from invana.core.db import create_db_engine, create_session_factory

_store = ModelStore()


@click.group("models")
def models_cmd() -> None:
    """Export, import and upgrade domain models."""


# ---------------------------------------------------------------------------
# Shared plumbing
# ---------------------------------------------------------------------------


def _split_graph_ref(graph_ref: str) -> tuple[str, str]:
    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    username, slug = graph_ref.split("/", 1)
    return username, slug


async def _with_graph(graph_ref: str, work):
    """Resolve the Graph, run *work(session, graph)*, dispose the engine."""
    username, slug = _split_graph_ref(graph_ref)
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    try:
        async with session_factory() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(session, owner_username=username, slug=slug)
            if graph is None:
                raise click.UsageError(f"Graph {graph_ref!r} not found.")
            return await work(session, graph)
    finally:
        await engine.dispose()


async def _model_by_name(session, graph_id: str, name: str):
    models = await _store.list_graph_models(session, graph_id)
    model = next((m for m in models if m.name.lower() == name.lower()), None)
    if model is None:
        known = ", ".join(m.name for m in models) or "none"
        raise click.UsageError(f"No model named {name!r} in this Graph. Models here: {known}.")
    return model


def _read_artefact(file: str) -> ModelArtefact:
    try:
        return ModelArtefact.model_validate(json.loads(Path(file).read_text()))
    except (OSError, ValueError) as exc:
        raise click.ClickException(f"{file} is not a model artefact: {exc}") from exc


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


@models_cmd.command("list")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
def list_cmd(graph_ref: str) -> None:
    """List the Graph's models with their active version and package id."""

    async def work(session, graph):
        models = await _store.list_graph_models(session, graph.id)
        rows = []
        for model in models:
            active = await _store.get_active_version(session, model.id)
            rows.append((model.name, active.version if active else "—", model.package_id, model.import_source or "—"))
        return rows

    rows = asyncio.run(_with_graph(graph_ref, work))
    if not rows:
        click.echo("No models in this Graph yet.")
        return
    width = max(len(r[0]) for r in rows)
    click.echo(f"{'MODEL'.ljust(width)}  ACTIVE   SOURCE    PACKAGE")
    for name, version, package_id, source in rows:
        click.echo(f"{name.ljust(width)}  {version:<8} {source:<9} {package_id}")


@models_cmd.command("starters")
def starters_cmd() -> None:
    """List the starter models shipped with this distribution."""
    for starter in starter_models.summaries():
        click.echo(f"{starter.slug:<12} {starter.name} {starter.version or ''}")
        click.echo(f"             {starter.description}")
        click.echo(f"             node types: {', '.join(starter.node_types)}")


@models_cmd.command("export")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--name", required=True, help="Model name in that Graph.")
@click.option("--version", "version_semver", default=None, help="Version to export (default: the active one).")
@click.option("--out", "out", default=None, type=click.Path(dir_okay=False), help="Write here (default: stdout).")
def export_cmd(graph_ref: str, name: str, version_semver: str | None, out: str | None) -> None:
    """Export a published version as one self-contained artefact."""

    async def work(session, graph):
        model = await _model_by_name(session, graph.id, name)
        version = (
            await _store.get_version_by_semver(session, model.id, version_semver)
            if version_semver
            else await _store.get_active_version(session, model.id)
        )
        if version is None:
            raise click.ClickException(f"{name} has no published version to export — commit a draft first.")
        version = await _store.get_version(session, version.id)
        if version.status == "draft":
            raise click.ClickException("A draft has nothing stable to export — commit it first.")
        return build_artefact(model, version)

    artefact = asyncio.run(_with_graph(graph_ref, work))
    payload = json.dumps(artefact.model_dump(mode="json"), indent=2) + "\n"
    if out:
        Path(out).write_text(payload)
        click.echo(f"{artefact.name} {artefact.version} → {out}  ({artefact.content_hash[:12]})")
    else:
        click.echo(payload, nl=False)


def _refusal(exc: ImportRefused, *, graph_ref: str, file: str | None, starter: str | None) -> str:
    """An `ImportRefused` as a sentence that names the next command (SM5).

    The route returns ``error`` and its facts as a document, because Studio
    renders one. A terminal does not, so the code becomes: what happened, that
    nothing was written, and the command that does what was meant.

    A code with no sentence here falls through to the raw pair — an unhandled
    refusal stays visible rather than being flattened into a wrong guess.
    """
    detail = exc.detail
    source = f"--file {file}" if file else f"--starter {starter}"

    if exc.error == "model_name_taken":
        name = detail.get("name")
        if detail.get("same_package"):
            return (
                f"{name!r} is already in this Graph, from the same package. Nothing was imported.\n"
                f"An import creates a model; bringing a newer version of one in is an upgrade:\n"
                f"  invana models upgrade --graph {graph_ref} --name {name} {source}"
            )
        return (
            f"{name!r} is already in this Graph, and it is a different package "
            f"({detail.get('package_id')}) — so this artefact is not a newer version of it. "
            f"Nothing was imported.\n"
            f"The name is local, so bring this one in under another:\n"
            f"  invana models import --graph {graph_ref} {source} --as <name>"
        )

    if exc.error == "package_mismatch":
        return (
            f"This artefact is a different package than the model named here "
            f"({detail.get('artefact_package_id')} vs {detail.get('model_package_id')}). Nothing was upgraded.\n"
            f"An upgrade is the same domain moving forward; anything else arrives under a new name:\n"
            f"  invana models import --graph {graph_ref} {source} --as <name>"
        )

    return f"{exc.error}: {detail}"


@models_cmd.command("import")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--file", "file", default=None, type=click.Path(exists=True, dir_okay=False), help="Artefact to import.")
@click.option("--starter", "starter", default=None, help="A shipped starter, by slug.")
@click.option("--as", "local_name", default=None, help="Name it this on arrival — the name is local.")
def import_cmd(graph_ref: str, file: str | None, starter: str | None, local_name: str | None) -> None:
    """Import an artefact — or a starter — as a draft."""
    if bool(file) == bool(starter):
        raise click.UsageError("Give either --file or --starter, not both.")
    if starter:
        try:
            artefact = starter_models.get(starter)
        except KeyError as exc:
            raise click.UsageError(f"No starter named {starter!r}. Try: {', '.join(starter_models.slugs())}.") from exc
    else:
        artefact = _read_artefact(file)

    async def work(session, graph):
        try:
            model, version_id = await import_artefact(
                session,
                _store,
                graph_id=graph.id,
                artefact=artefact,
                name=local_name,
                import_source="starter" if starter else "file",
            )
        except ImportRefused as exc:
            raise click.ClickException(_refusal(exc, graph_ref=graph_ref, file=file, starter=starter)) from exc
        await session.commit()
        version = await _store.get_version(session, version_id)
        return model.name, version.id, len(version.node_types), len(version.edge_types)

    name, _version_id, nodes, edges = asyncio.run(_with_graph(graph_ref, work))
    click.echo(f"{name} imported as a draft — {nodes} node types, {edges} edge types.")
    click.echo("Rename what you want, then publish it from Studio or `invana models` upstream.")


@models_cmd.command("upgrade")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--name", required=True, help="Model to upgrade, by its local name.")
@click.option("--file", "file", default=None, type=click.Path(exists=True, dir_okay=False), help="Newer artefact.")
@click.option("--starter", "starter", default=None, help="A shipped starter, by slug.")
def upgrade_cmd(graph_ref: str, name: str, file: str | None, starter: str | None) -> None:
    """Bring a newer version of the same package in as a draft, and print the diff."""
    if bool(file) == bool(starter):
        raise click.UsageError("Give either --file or --starter, not both.")
    artefact = starter_models.get(starter) if starter else _read_artefact(file)

    async def work(session, graph):
        model = await _model_by_name(session, graph.id, name)
        existing = [v for v in await _store.list_versions(session, model.id) if v.status == "draft"]
        if existing:
            raise click.ClickException(
                "This model already has a draft. Commit or discard it first — "
                "an upgrade never silently overwrites local work."
            )
        try:
            version_id = await upgrade_model(session, _store, model=model, artefact=artefact)
        except ImportRefused as exc:
            raise click.ClickException(_refusal(exc, graph_ref=graph_ref, file=file, starter=starter)) from exc
        await session.commit()
        active = await _store.get_active_version(session, model.id)
        draft = await _store.get_version(session, version_id)
        # No capability gate on the CLI path: the check needs a live connection,
        # and Studio's upgrade route is where a bound Graph reports it (SM4).
        return compute_diff(active, draft) if active else None, []

    diff, blockers = asyncio.run(_with_graph(graph_ref, work))
    if diff is None:
        click.echo(f"{name} upgraded — nothing was published before, so the draft is the whole model.")
        return
    click.echo(f"{name} upgraded to a draft ({diff.classification}).")
    for label, items in (
        ("node types", (diff.added_node_types, diff.removed_node_types, [d.name for d in diff.modified_node_types])),
        ("edge types", (diff.added_edge_types, diff.removed_edge_types, [d.name for d in diff.modified_edge_types])),
    ):
        added, removed, modified = items
        if added or removed or modified:
            click.echo(f"  {label}: +{len(added)} -{len(removed)} ~{len(modified)}")
    for blocker in blockers:
        click.echo(f"  cannot publish: {blocker['property_key']} is {blocker['type']}")
