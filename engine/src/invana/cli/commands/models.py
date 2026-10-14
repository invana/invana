"""`invana models …` — the portable side of a domain model.

Files and git are the registry (docs/for-developers/modules/connect-and-model/features/share-a-model.md
SM1). There is no service to publish to: a model exports as one file, that file is
committed, and another Graph imports or upgrades from it.

    invana models list      --graph ravi/finance
    invana models starters
    invana models export    --graph ravi/finance --name MarketData --out marketdata.json
    invana models import    --graph ravi/other   --file marketdata.json [--as MarketDataV2]
    invana models import    --graph ravi/other   --starter memory
    invana models import    --graph ravi/other   --ontology schemaorg.jsonld --types Person,Organization [--dry-run]
    invana models upgrade   --graph ravi/other   --name MarketData --file marketdata.json
    invana models publish   --graph ravi/finance --name MarketData --user ravi [--dry-run] [--why …] [--approver …]

`publish` is the one command here that is not about files: it publishes the
draft in this Graph — an additive change at once, a breaking one through a
publish review (docs/for-developers/modules/connect-and-model/features/publish-review.md).
"""

from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path

import click

from invana.activity.managers.publish_reviews import PublishReviewManager
from invana.apps.graphs.pool import GraphConnectionManager
from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.modeller import starters as starter_models
from invana.apps.modeller.portability import (
    ImportRefused,
    ModelArtefact,
    build_artefact,
    import_artefact,
    upgrade_model,
)
from invana.apps.modeller.schemas import ModelPublishRequest
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import compute_diff
from invana.apps.semantic.managers import OntologyImportManager
from invana.apps.semantic.schemas import OntologyImportRequest
from invana.cli.sources import FORMAT_CHOICES, read_source
from invana.core.auth.querysets import UserQuerySet
from invana.core.db import create_db_engine, create_session_factory
from invana.core.errors import InvanaError
from invana.core.settings import settings
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.models import TaskRun
from invana.runtime.querysets import TaskRunQuerySet

_store = ModelStore()
_reviews = PublishReviewManager()
_ontologies = OntologyImportManager()


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
@click.option("--ontology", "ontology", default=None, help="An RDFS / OWL ontology: a file, or a URL to fetch.")
@click.option("--as", "local_name", default=None, help="Name it this on arrival — the name is local.")
@click.option("--types", default=None, help="With --ontology: the classes to import, comma-separated.")
@click.option("--format", "fmt", type=click.Choice(FORMAT_CHOICES), default=None, help="With --ontology.")
@click.option("--lang", default="en", show_default=True, help="With --ontology: which labels to read.")
@click.option("--dry-run", is_flag=True, help="With --ontology: show what would import; write nothing.")
def import_cmd(
    graph_ref: str,
    file: str | None,
    starter: str | None,
    ontology: str | None,
    local_name: str | None,
    types: str | None,
    fmt: str | None,
    lang: str,
    dry_run: bool,
) -> None:
    """Import an artefact, a starter or an ontology as a draft."""
    if sum(bool(s) for s in (file, starter, ontology)) != 1:
        raise click.UsageError("Give one of --file, --starter or --ontology.")
    if ontology:
        _import_ontology(graph_ref, ontology, local_name, types, fmt, lang, dry_run)
        return
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


def _import_ontology(
    graph_ref: str, source: str, name: str | None, types: str | None, fmt: str | None, lang: str, dry_run: bool
) -> None:
    """``import --ontology``: the manager the API calls, then the report as lines."""
    content, detected = read_source(source, fmt)
    payload = OntologyImportRequest(
        content=content,
        format=detected,
        types=[t.strip() for t in types.split(",") if t.strip()] if types else None,
        name=name,
        lang=lang,
        dry_run=dry_run,
    )

    async def work(session, graph):
        try:
            imported = await _ontologies.import_ontology(session, graph_id=graph.id, payload=payload)
        except ImportRefused as exc:
            taken = exc.detail.get("name")
            raise click.ClickException(
                f"{taken!r} is already in this Graph. Nothing was imported.\n"
                f"  invana models import --graph {graph_ref} --ontology {source} --as <name>"
            ) from exc
        except InvanaError as exc:
            raise click.ClickException(_detail(exc)) from exc
        if imported.model is not None:
            await session.commit()
        return imported

    imported = asyncio.run(_with_graph(graph_ref, work))
    report = imported.report
    for mapped in report.types:
        brought = f"  (came with {mapped.came_with})" if mapped.came_with else ""
        props = f" — {', '.join(mapped.properties)}" if mapped.properties else ""
        click.echo(f"  {mapped.kind:<4} {mapped.name}{props}{brought}")
    for note in report.skipped:
        click.echo(f"  skipped {note.subject}: {note.message}")
    for note in report.notes:
        click.echo(f"  note {note.subject}: {note.message}")
    for hint in report.suggestions:
        click.echo(f"  suggestion {hint.name} {hint.kind} {hint.target_iri}")
    counts = report.mapped
    summary = (
        f"{counts['node_types']} node types, {counts['edge_types']} edge types, "
        f"{counts['property_keys']} property keys; {report.skipped_count} skipped."
    )
    if imported.model is None:
        click.echo(f"dry run — nothing written. {summary}")
        return
    click.echo(f"{imported.model.name} imported as a draft — {summary}")
    click.echo(
        f"Publish it when it reads right: invana models publish --graph {graph_ref} --name {imported.model.name}"
    )


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


def _detail(exc: InvanaError) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        return str(detail.get("message") or detail.get("error") or detail)
    return str(detail)


def _change_lines(changes) -> None:
    for change in changes:
        mark = "breaking" if change.breaking else "additive"
        click.echo(f"  {mark:<9} {change.reason}")


def _scan_lines(preview: dict) -> None:
    """The preview's scan, one line per touched type."""
    types = preview.get("types") or []
    if not types:
        click.echo("  The change touches no records.")
        return
    width = max(len(t["type"]) for t in types)
    click.echo(f"  {'TYPE'.ljust(width)}  {'SCANNED/TOTAL':<15} AFFECTED  WOULD FAIL")
    for t in types:
        scanned = f"{t['scanned']:,}/{t['total']:,}"
        gone = "  (type removed)" if t.get("removed") else ""
        click.echo(f"  {t['type'].ljust(width)}  {scanned:<15} {t['affected']:>8}  {t['would_fail']:>10}{gone}")
    click.echo(f"  At most {preview.get('scan_limit', 0):,} records are scanned per type; no record was written.")


async def _publish(
    graph_ref: str, name: str, user_ref: str | None, *, dry_run: bool, why: str, approvers: list[str]
) -> dict:
    """Classify the draft, publish it if additive, and otherwise run its preview inline.

    A real request opens a review; once its preview settles, one clock step
    raises the approval, so a terminal does not wait on a server's clock. A
    migration run that step opens runs inline too, as the clock would submit it.
    """
    username, slug = _split_graph_ref(graph_ref)
    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
    manager = GraphConnectionManager(session_factory=session_factory, encryption_key=settings.encryption_key)
    await manager.startup()
    runtime = TaskRuntime(session_factory=session_factory, manager=manager, encryption_key=settings.encryption_key)
    done: dict = {}
    try:
        async with session_factory() as session:
            graph = await GraphQuerySet().get_by_owner_username_and_slug(session, owner_username=username, slug=slug)
            if graph is None:
                raise click.UsageError(f"Graph {graph_ref!r} not found.")
            model = await _model_by_name(session, graph.id, name)
            user = None
            if user_ref:
                user = await UserQuerySet().get_by_username_or_email(session, user_ref)
                if user is None:
                    raise click.UsageError(f"No user {user_ref!r}.")
            elif not dry_run:
                raise click.UsageError("A publish needs --user: a review names who asked for it.")
            try:
                if dry_run:
                    done["classification"], run_id = await _reviews.dry_run(
                        session, graph=graph, model=model, actor_id=user.id if user else None
                    )
                else:
                    request = ModelPublishRequest(why=why, approvers=approvers)
                    done["outcome"], run_id = await _reviews.publish(
                        session, graph=graph, model=model, user=user, payload=request
                    )
            except InvanaError as exc:
                raise click.ClickException(_detail(exc)) from exc
            model_id = model.id
            await session.commit()

        if run_id is None:
            return done
        click.echo(f"run {run_id}")
        await runtime.run_inline(run_id)

        opened: list[str] = []
        async with session_factory() as session:
            root = await session.get(TaskRun, run_id)
            nodes = await TaskRunQuerySet().nodes_of(session, run_id=run_id)
            out = next((n.output or {} for n in nodes if n.task_key == "migrate_model"), {})
            done.update(status=root.status, error=(root.error or {}).get("message"), preview=out.get("preview"))
            if not dry_run:
                opened = await _reviews.advance_due(session, now=datetime.now(UTC))
                await session.commit()
        for opened_id in opened:
            await runtime.run_inline(opened_id)
        if not dry_run:
            async with session_factory() as session:
                model = await _store.get_graph_model(session, model_id)
                done["review"] = await _reviews.get(session, model=model, review_id=done["outcome"].review.id)
        return done
    finally:
        await manager.shutdown()
        await engine.dispose()


@models_cmd.command("publish")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--name", required=True, help="Model whose draft to publish.")
@click.option("--dry-run", is_flag=True, help="Classify and preview; open no review and publish nothing.")
@click.option("--why", default="", help="Why the change; the change log and the approver read it.")
@click.option("--approver", "approvers", multiple=True, help="An owner to approve a breaking change; repeatable.")
@click.option("--user", "user_ref", default=None, help="Who publishes, by username or email.")
def publish_cmd(
    graph_ref: str, name: str, dry_run: bool, why: str, approvers: tuple[str, ...], user_ref: str | None
) -> None:
    """Publish a model's draft: an additive change now, a breaking one through a review."""
    done = asyncio.run(_publish(graph_ref, name, user_ref, dry_run=dry_run, why=why, approvers=list(approvers)))

    if dry_run:
        found = done["classification"]
        click.echo(f"{name}: {found.classification} against {found.base_version or 'nothing published'}.")
        _change_lines(found.changes)
        if found.classification == "additive":
            click.echo("It would publish at once: no review, no migration.")
            return
        if done.get("status") != "succeeded" or not done.get("preview"):
            raise click.ClickException(done.get("error") or f"The preview {done.get('status')}.")
        _scan_lines(done["preview"])
        click.echo("Nothing was published. Without --dry-run this opens a review for the other owners.")
        return

    outcome = done["outcome"]
    if outcome.outcome == "published":
        click.echo(f"{name} {outcome.version} published; the change is additive.")
        return
    click.echo(f"{name}: breaking. Publish review {outcome.review.id}.")
    _change_lines(c for c in outcome.review.changes if c.breaking)
    if done.get("preview"):
        _scan_lines(done["preview"])
    review = done["review"]
    if review.status == "pending":
        click.echo(f"Waiting on approval {review.approval_id} from {len(review.approver_ids)} owner(s).")
        click.echo("  invana approvals list")
    else:
        click.echo(f"Review {review.status}: {review.reason or 'open the run for why'}.")
