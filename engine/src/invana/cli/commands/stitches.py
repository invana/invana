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
from types import SimpleNamespace

import click

from invana.apps.graphs.querysets import GraphQuerySet
from invana.apps.modeller import links as link_service
from invana.apps.modeller.store import ModelStore
from invana.core.auth.querysets import UserQuerySet
from invana.core.db import create_db_engine, create_session_factory
from invana.core.events import actions as event_actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.settings import settings
from invana.runtime.catalogue.bundle import MANIFEST, BundleError
from invana.runtime.catalogue.stitching import Applied, apply_bundle

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


def _solved_lines(rows: list[dict]) -> None:
    """What each stitch wrote, one line each — a zero is a verdict, not a silence.

    Reads `commit_stitches`' own `links` output, which carries both shapes a
    commit produces: a rule that joined, and one that loaded the rows its dataset
    ships (ST51) — and a stitch the guardrails refused (ST53).
    """
    for row in rows:
        what = row.get("rule") or f"rows for {row['edge_type']}"
        if row.get("skipped"):
            click.echo(f"  --    {what:<52} nothing run — {row['skipped']}")
        else:
            click.echo(f"  {row['written']:>6}  {what:<52} -[{row['edge_type']}]->")


async def _as_run(graph_ref: str, user_ref: str | None, *, open_run, task_key: str, after=None) -> dict:
    """Open a stitch builtin as a run, wait for it, and return its step's output.

    The drawer's path, from a terminal (ST54): the Graph's guardrails are frozen
    on the run and every read or write it makes goes through them. ``open_run``
    is ``(services, session, graph, actor_id) -> TaskRun``; ``after`` gets the
    settled root and output in a fresh session, for what a command records.
    """
    from invana.apps.graphs.pool import GraphConnectionManager
    from invana.core.errors import InvanaError
    from invana.runtime import services as run_services
    from invana.runtime.interpreter import TaskRuntime
    from invana.runtime.models import TaskRun
    from invana.runtime.querysets import TaskRunQuerySet

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
            try:
                run = await open_run(run_services, session, graph, actor_id)
            except InvanaError as exc:
                detail = exc.detail
                raise click.ClickException(
                    detail.get("message") or detail.get("error") if isinstance(detail, dict) else str(detail)
                ) from exc
            run_id, graph_id = run.id, graph.id
            await session.commit()

        click.echo(f"run {run_id}")
        await runtime.run_inline(run_id)

        async with session_factory() as session:
            root = await session.get(TaskRun, run_id)
            nodes = await TaskRunQuerySet().nodes_of(session, run_id=run_id)
            out = next((n.output or {} for n in nodes if n.task_key == task_key), {})
            if after is not None:
                await after(session, root, out, graph_id=graph_id, actor_id=actor_id)
            return {**out, "status": root.status, "error": (root.error or {}).get("message"), "run_id": run_id}
    finally:
        await manager.shutdown()
        await engine.dispose()


async def _commit_as_run(graph_ref: str, user_ref: str | None) -> dict:
    """Commit the staged set as a `stitch-commit@1` run, and wait for it (ST54)."""

    async def recorded(session, root, out, *, graph_id, actor_id) -> None:
        if root.status == "succeeded" and out.get("links"):
            await emit_event(
                session,
                action=event_actions.MODEL_LINK_COMMIT,
                target_kind=event_actions.TARGET_MODEL_LINK,
                graph_id=graph_id,
                details={"count": len(out["links"]), "edges_written": out.get("written", 0), "run_id": root.id},
                **_actor(actor_id),
            )
            await session.commit()

    return await _as_run(
        graph_ref,
        user_ref,
        open_run=lambda services, session, graph, actor_id: services.open_stitch_commit_run(
            session, graph=graph, actor_id=actor_id
        ),
        task_key="commit_stitches",
        after=recorded,
    )


def _commit_report(done: dict) -> None:
    """Say what a commit run did, or why it did not — the same words either command uses."""
    if done["status"] != "succeeded":
        raise click.ClickException(done["error"] or f"The commit {done['status']}. Open run {done['run_id']}.")
    rows = done.get("links") or []
    _solved_lines(rows)
    written = int(done.get("written") or 0)
    click.echo(f"Committed {len(rows)} stitch(es) — they are in the union now, and wrote {written:,} edge(s).")
    if done.get("rejected"):
        click.echo(f"  {done['rejected']} row(s) had an endpoint that resolved nowhere.")


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
    if run.declared and not run.dry_run:
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
        return run

    try:
        run = asyncio.run(_with_graph(graph_ref, user_ref, work))
    except BundleError as exc:
        raise click.ClickException(str(exc)) from exc

    # Declaring writes rows, not the graph; committing writes edges, so it is a
    # run under the Graph's guardrails — the same one the drawer opens (ST54).
    _report(run, graph_ref)
    if do_commit and not dry_run:
        click.echo("")
        _commit_report(asyncio.run(_commit_as_run(graph_ref, user_ref)))
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

    **Counting reads the graph, so it is a run** — `stitch-preview@1` under the
    Graph's guardrails, the drawer's own preview. A rule the guardrails refuse
    says so, rather than being counted around.
    """
    done = asyncio.run(
        _as_run(
            graph_ref,
            None,
            open_run=lambda services, session, graph, actor_id: services.open_stitch_preview_run(
                session, graph=graph, actor_id=actor_id
            ),
            task_key="preview_stitches",
        )
    )
    if done["status"] != "succeeded":
        raise click.ClickException(done["error"] or f"The preview {done['status']}. Open run {done['run_id']}.")
    rows = done.get("previews") or []
    if not rows:
        click.echo("No stitches in this Graph yet.")
        return

    click.echo(f"\n{graph_ref} — {len(rows)} stitches\n")
    for row in rows:
        rule = _rule_of(SimpleNamespace(**row))
        if row["refused"]:
            click.echo(f"  --   {rule:<52} refused — {row['refused']}")
            continue
        preview = row["preview"]
        if preview is None:
            click.echo(f"  --   {rule:<52} {'its rows arrive with a dataset':>24}  {row['status']}")
            continue
        countable = preview["source_total"] > 0 and preview["target_total"] > 0
        counted = f"{preview['resolved']}/{preview['source_total']} keys" if countable else "no records to count"
        mark = "ok  " if preview["resolved"] else "FAIL"
        edges = f"{row['written'] or 0:,} edges" if row["status"] == "active" else "not committed"
        click.echo(f"  {mark} {rule:<52} {counted:>24}  {edges}")


@stitches_cmd.command("commit")
@click.option("--graph", "graph_ref", required=True, help="Graph as <username>/<slug>.")
@click.option("--user", "user_ref", default=None, help="Attribute the commit to this user (username or email).")
def commit_cmd(graph_ref: str, user_ref: str | None) -> None:
    """Flip every staged stitch to active — one action for the whole set (ST21)."""

    if "/" not in graph_ref:
        raise click.UsageError("--graph must be <username>/<slug>.")
    _commit_report(asyncio.run(_commit_as_run(graph_ref, user_ref)))


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
