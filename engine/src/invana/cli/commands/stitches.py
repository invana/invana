"""`invana stitches …` — declare the stitches a bundle states (stitch-models.md ST39).

A bundle says how its datasets join in one `stitches.json`
(docs/for-developers/modules/bring-data-in/features/load-data.md LD12).
`invana records check` resolves those rules against the files; these commands declare
the same file against a Graph, so the rules are written once and read twice.

    invana stitches apply   --graph ravi/airways --file demos/airways/stitches.json
    invana stitches apply   --graph ravi/airways --file demos/airways/stitches.json --commit
    invana stitches list    --graph ravi/airways
    invana stitches resolve --graph ravi/airways
    invana stitches commit  --graph ravi/airways
    invana stitches discard --graph ravi/airways

Declaring lands **staged** (ST21): the rows exist and nothing a question can reach has
changed until they are committed. **Committing writes the edges** (ST44) — a keyed
relationship writes its edge type, an anchor writes `SAME_AS`, and every edge carries
`_inv_origin = "stitch"` so the graph says which of it nobody loaded (ST46).
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import click

from invana.apps.graphs.managers import GraphManager
from invana.apps.graphs.pool import build_connector
from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.modeller import links as link_service
from invana.apps.modeller.solve import count_written, solvable
from invana.apps.modeller.store import ModelStore
from invana.core.auth.querysets import UserQuerySet
from invana.core.db import create_db_engine, create_session_factory
from invana.core.events import actions as event_actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.settings import settings
from invana.runtime.catalogue.bundle import MANIFEST, BundleError
from invana.runtime.catalogue.stitching import Applied, apply_bundle, commit_stitches

_store = ModelStore()


@click.group("stitches")
def stitches_cmd() -> None:
    """Declare, commit and discard the stitches between two models."""


# ---------------------------------------------------------------------------
# Shared plumbing
# ---------------------------------------------------------------------------


async def _with_graph(graph_ref: str, user_ref: str | None, work):
    """Resolve the Graph and the actor, run *work(session, graph, actor_id)*."""
    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    username, slug = graph_ref.split("/", 1)

    engine = await create_db_engine()
    session_factory = create_session_factory(engine)
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

            result = await work(session, graph, actor_id)
            await session.commit()
            return result
    finally:
        await engine.dispose()


def _actor(actor_id: str | None) -> dict:
    """A CLI run with no `--user` is the system acting, not an anonymous person."""
    return {"actor_id": actor_id} if actor_id else {"actor_kind": ActorKind.system}


async def _connector(session, graph, *, writing: bool):
    """The Graph's connector, built from its stored connection.

    Solving writes, so a read-only connection is refused before anything is
    flipped — Invana never writes to one.
    """
    connection = await GraphManager().get_graph_connection(session, graph_id=graph.id)
    if connection is None:
        raise click.ClickException("This Graph has no connection. Attach one in Studio first.")
    if writing and connection.read_only:
        raise click.ClickException("This connection is marked read-only, and committing a stitch writes edges.")
    return build_connector(connection, settings.encryption_key)


def _solved_lines(results) -> None:
    """What each stitch wrote, one line each — a zero is a verdict, not a silence.

    Takes both shapes a commit produces: a rule that joined, and one that loaded
    the rows its dataset ships (ST51).
    """
    for result in results:
        what = getattr(result, "rule", None) or f"rows for {result.edge_type}"
        if result.skipped:
            click.echo(f"  --    {what:<52} nothing run — {result.skipped}")
        else:
            click.echo(f"  {result.written:>6}  {what:<52} -[{result.edge_type}]->")


def _bundle_root(file: str) -> Path:
    """`--file` takes the manifest or the folder holding it — both name one bundle."""
    path = Path(file)
    return path.parent if path.is_file() else path


def _rule_of(link) -> str:
    if link.kind == "anchor":
        return f"{link.source_type}.{link.source_property} ≡ {link.target_type}.{link.target_property}"
    if link.source_model_id:
        return f"{link.source_type} -[{link.edge_type}]-> {link.target_type}  (rows ship with its records)"
    return f"{link.source_type}.{link.source_property} -[{link.edge_type}]-> {link.target_type}.{link.target_property}"


# ---------------------------------------------------------------------------
# apply
# ---------------------------------------------------------------------------

_MARK = {"declared": "ok  ", "planned": "plan", "already": "--  ", "skipped": "skip"}


def _report(run: Applied, graph_ref: str) -> None:
    click.echo(f"\n{run.name} — {len(run.outcomes)} rules → {graph_ref}\n")
    section = None
    for outcome in run.outcomes:
        heading = "anchors" if outcome.rule.kind == "anchor" else "relationships"
        if heading != section:
            section = heading
            click.echo(f"  {heading}")
        bound = f"{outcome.source.model} → {outcome.target.model}" if outcome.source and outcome.target else ""
        note = outcome.detail if outcome.status in ("skipped", "already") else bound
        if outcome.status == "already":
            note = f"already declared, {outcome.detail}"
        click.echo(f"  {_MARK[outcome.status]} {outcome.rule.id:<4} {outcome.rule.describe():<52} {note}")

    verb = "would declare" if run.dry_run else "declared"
    click.echo(
        f"\n{len(run.outcomes)} rules — {run.declared} {verb}, {run.already} already declared, {run.skipped} skipped."
    )
    if run.committed:
        click.echo(
            f"\nCommitted {run.committed} stitch(es) — they are in the union now, and wrote {run.written:,} edge(s)."
        )
        _solved_lines(run.solved)
    elif run.declared and not run.dry_run:
        click.echo("Staged — the global model is unchanged until you commit.")


@stitches_cmd.command("apply")
@click.option("--graph", "graph_ref", required=True, help="Target graph as <username>/<slug>.")
@click.option(
    "--file",
    "file",
    required=True,
    type=click.Path(exists=True),
    help=f"A bundle's {MANIFEST}, or the folder holding it.",
)
@click.option("--commit", "do_commit", is_flag=True, help="Flip the staged set to active in the same run.")
@click.option("--dry-run", "dry_run", is_flag=True, help="Say what would be declared, and write nothing.")
@click.option("--user", "user_ref", default=None, help="Attribute the declarations to this user (username or email).")
def apply_cmd(graph_ref: str, file: str, do_commit: bool, dry_run: bool, user_ref: str | None) -> None:
    """Declare every stitch a bundle states, against this Graph.

    Each rule lands **staged** (ST21). A rule already declared is reported, never
    declared twice (ST41), and a rule that cannot resolve is skipped with the reason —
    a model with no published version, or a dataset this Graph has not imported.
    Counting is `invana records check`, offline; nothing here opens the database (ST43).
    """
    root = _bundle_root(file)

    async def work(session, graph, actor_id):
        # The connector is resolved before anything is declared, so a commit that
        # cannot write fails before it has flipped a single row (ST44).
        connector = await _connector(session, graph, writing=True) if do_commit and not dry_run else None
        run = await apply_bundle(session, _store, graph_id=graph.id, root=root, dry_run=dry_run)
        for outcome in run.outcomes:
            if outcome.status == "declared":
                await emit_event(
                    session,
                    action=event_actions.MODEL_LINK_DECLARE,
                    target_kind=event_actions.TARGET_MODEL_LINK,
                    target_id=outcome.link_id,
                    graph_id=graph.id,
                    details={"kind": outcome.rule.kind, "rule": outcome.rule.describe(), "bundle": run.name},
                    **_actor(actor_id),
                )
        if connector is not None:
            done = await commit_stitches(session, graph_id=graph.id, connector=connector)
            run.committed = len(done.links)
            run.written = done.written
            run.solved = [*done.solved, *done.loaded]
            if done.links:
                await emit_event(
                    session,
                    action=event_actions.MODEL_LINK_COMMIT,
                    target_kind=event_actions.TARGET_MODEL_LINK,
                    graph_id=graph.id,
                    details={"count": run.committed, "edges_written": run.written, "bundle": run.name},
                    **_actor(actor_id),
                )
        return run

    try:
        run = asyncio.run(_with_graph(graph_ref, user_ref, work))
    except BundleError as exc:
        raise click.ClickException(str(exc)) from exc

    _report(run, graph_ref)
    # Non-zero for a rule that could not be declared at all (ST41) — already-declared is not one.
    if not run.passed:
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# list · commit · discard
# ---------------------------------------------------------------------------


@stitches_cmd.command("list")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--status", "status", type=click.Choice(["staged", "active"]), default=None, help="Narrow to one set.")
def list_cmd(graph_ref: str, status: str | None) -> None:
    """Every stitch in this Graph — its rule, the models it binds, and its status."""

    async def work(session, graph, _actor_id):
        rows = []
        for link in await link_service.list_links(session, graph.id, status=status):
            names = []
            for side in ("source", "target"):
                version = await _store.get_version(session, getattr(link, f"{side}_version_id"))
                model = await _store.get_graph_model(session, version.model_id) if version else None
                names.append(model.name if model else "?")
            rows.append((link.kind, _rule_of(link), f"{names[0]} → {names[1]}", link.status))
        return rows

    rows = asyncio.run(_with_graph(graph_ref, None, work))
    if not rows:
        click.echo("No stitches in this Graph yet.")
        return
    width = max(len(r[1]) for r in rows)
    click.echo(f"{'KIND':<13} {'RULE'.ljust(width)}  MODELS                    STATUS")
    for kind, rule, models, state in rows:
        click.echo(f"{kind:<13} {rule.ljust(width)}  {models:<25} {state}")


@stitches_cmd.command("resolve")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
def resolve_cmd(graph_ref: str) -> None:
    """Count what each declared stitch matches, against the live database (ST43).

    The same question the declare card answers before a stitch exists, asked again
    after it does — a rule nobody can re-check is a rule nobody trusts. It reads and
    writes nothing. Beside the count, the edges the stitch has actually written.
    """

    async def work(session, graph, _actor_id):
        links = await link_service.list_links(session, graph.id)
        if not links:
            return []
        connector = await _connector(session, graph, writing=False)
        rows = []
        await connector.connect()
        try:
            for link in links:
                if not solvable(link):
                    rows.append((link, None, 0))
                    continue
                query = link_service.stitch_preview_query(
                    source_type=link.source_type,
                    source_property=link.source_property or "",
                    target_type=link.target_type,
                    target_property=link.target_property or "",
                    case_insensitive=link.identity_match == "case_insensitive",
                )
                result = await connector.execute(query)
                raw = getattr(result, "records", None) or getattr(result, "rows", None) or []
                preview = link_service.read_preview(
                    raw[0] if raw else {},
                    source_type=link.source_type,
                    source_property=link.source_property or "",
                    target_type=link.target_type,
                    target_property=link.target_property or "",
                )
                written = await count_written(connector, link) if link.status == "active" else 0
                rows.append((link, preview, written))
        finally:
            await connector.disconnect()
        return rows

    rows = asyncio.run(_with_graph(graph_ref, None, work))
    if not rows:
        click.echo("No stitches in this Graph yet.")
        return

    click.echo(f"\n{graph_ref} — {len(rows)} stitches\n")
    for link, preview, written in rows:
        rule = _rule_of(link)
        if preview is None:
            click.echo(f"  --   {rule:<52} {'its rows arrive with a dataset':>24}  {link.status}")
            continue
        counted = f"{preview.resolved}/{preview.source_total} keys" if preview.countable else "no records to count"
        mark = "ok  " if preview.resolved else "FAIL"
        edges = f"{written:,} edges" if link.status == "active" else "not committed"
        click.echo(f"  {mark} {rule:<52} {counted:>24}  {edges}")
    unresolved = [r for r in rows if r[1] is not None and r[1].countable and not r[1].resolved]
    click.echo(f"\n{len(rows)} stitches, {len(rows) - len(unresolved)} resolve.")
    if unresolved:
        raise SystemExit(1)


@stitches_cmd.command("commit")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--user", "user_ref", default=None, help="Attribute the commit to this user (username or email).")
def commit_cmd(graph_ref: str, user_ref: str | None) -> None:
    """Flip every staged stitch to active — one action for the whole set (ST21)."""

    async def work(session, graph, actor_id):
        connector = await _connector(session, graph, writing=True)
        done = await commit_stitches(session, graph_id=graph.id, connector=connector)
        if done.links:
            await emit_event(
                session,
                action=event_actions.MODEL_LINK_COMMIT,
                target_kind=event_actions.TARGET_MODEL_LINK,
                graph_id=graph.id,
                details={"count": len(done.links), "edges_written": done.written},
                **_actor(actor_id),
            )
        return done

    done = asyncio.run(_with_graph(graph_ref, user_ref, work))
    if not done.links:
        raise click.ClickException("Nothing staged to commit.")
    _solved_lines([*done.solved, *done.loaded])
    click.echo(
        f"Committed {len(done.links)} stitch(es) — they are in the union now, and wrote {done.written:,} edge(s)."
    )
    if done.rejected:
        click.echo(f"  {done.rejected} row(s) had an endpoint that resolved nowhere.")


@stitches_cmd.command("discard")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--user", "user_ref", default=None, help="Attribute the discard to this user (username or email).")
def discard_cmd(graph_ref: str, user_ref: str | None) -> None:
    """Delete the staged set. Nothing has read it, so there is nothing to put back."""

    async def work(session, graph, actor_id):
        dropped = await link_service.discard_staged(session, graph.id)
        if dropped:
            await emit_event(
                session,
                action=event_actions.MODEL_LINK_DISCARD,
                target_kind=event_actions.TARGET_MODEL_LINK,
                graph_id=graph.id,
                details={"count": len(dropped)},
                **_actor(actor_id),
            )
        return len(dropped)

    dropped = asyncio.run(_with_graph(graph_ref, user_ref, work))
    if not dropped:
        raise click.ClickException("Nothing staged to discard.")
    click.echo(f"Discarded {dropped} staged stitch(es).")
