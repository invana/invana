"""`invana records ...` — loading records into a model.

docs/for-developers/modules/bring-data-in/features/load-data.md. The group names
the object, because the verb is already spoken for: `invana models import` brings
a *model* in. Records are their own noun, so they get their own group.

`restamp` lived here for one upgrade and is gone with the tables it read. It
remapped `_inv_dataset_id` → `_inv_model_id` and `_inv_job_id` → `_inv_run_id`
through `datasets` and `import_jobs` — **the value changed with the name**, a job
id is not a run id — so it could only ever run while those tables existed
(task-model-migration § 6.6 · § 6.7).
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import click

from invana.apps.graphs.querysets import GraphQuerySet

# A run trace opens a `Thought`, whose `message_id` points at `session_messages`
# (run/models.py). The server imports every model at startup, so the mapper can
# resolve that foreign key; a CLI process imports only what it names, so without this
# the first flush raises NoReferencedTableError and no dataset can be imported at all.
from invana.apps.sessions.models import SessionMessage  # noqa: F401
from invana.core.auth.querysets import UserQuerySet
from invana.core.db import create_db_engine, create_session_factory
from invana.runtime.catalogue.records import LoadRefused


@click.group("records")
def records_cmd() -> None:
    """Load records into a model, and check them before you do."""


def _progress_renderer():
    """Render a run's journal as it arrives (LD17).

    Everything goes to **stderr**, so `stdout` stays the summary a pipe parses.
    On a tty that is one rewriting counter; redirected, it is one line per stage —
    a log file should not collect ten thousand carriage returns.
    """
    tty = sys.stderr.isatty()
    last = 0.0
    width = 0

    def render(event: dict) -> None:
        nonlocal last, width
        stage, message, done, total = (
            event["stage"],
            event["message"],
            event["done"],
            event["total"],
        )
        if not tty:
            # A tick carries no message; only stage transitions are worth a line here.
            if message:
                click.echo(f"  {stage:<9} {message}", err=True)
            return

        now = time.monotonic()
        # Redraw at most ~8 times a second: past that the terminal is the bottleneck, not the load.
        if not message and now - last < 0.12:
            return
        last = now
        counted = f"{done}/{total}" if total else ""
        pct = f" {100 * done // total:>3}%" if total and done else ""
        line = f"  {stage:<9} {message or counted}{'' if message else pct}"
        # Pad over whatever the previous, longer line left behind.
        click.echo(line.ljust(width) + "\r", nl=False, err=True)
        width = max(width, len(line))
        if message:
            click.echo("", err=True)  # a stage transition keeps its line
            width = 0

    return render


@records_cmd.command("import")
@click.option("--graph", "graph_ref", required=True, help="Target graph as <username>/<slug>.")
@click.option("--name", required=True, help="Dataset name.")
@click.option(
    "--model",
    "model_name",
    required=True,
    help="The authored model this dataset conforms to. Nothing is inferred.",
)
@click.option(
    "--path",
    "path",
    required=True,
    type=click.Path(exists=True, file_okay=False, dir_okay=True),
    help="Dataset directory (nodes/ + edges/, and an optional model.json for identity keys).",
)
@click.option(
    "--user",
    "user_ref",
    default=None,
    help="Attribute the run to this user (username or email). Without it, the run is labelled with the shell.",
)
@click.option(
    "--max-rejected",
    "max_rejected",
    type=int,
    default=None,
    help="Exit non-zero when more than this many records are reported — for a scheduler to branch on.",
)
def import_cmd(
    graph_ref: str,
    name: str,
    model_name: str,
    path: str,
    user_ref: str | None,
    max_rejected: int | None,
) -> None:
    """Validate records against their model, write them with provenance, and report what was not.

    The model is authored first and named here: `--model` is required and nothing
    is derived from the data (docs/for-developers/modules/bring-data-in/features/load-data.md LD1).
    """
    asyncio.run(_run_import(graph_ref, name, model_name, path, user_ref, max_rejected))


async def _run_import(
    graph_ref: str,
    name: str,
    model_name: str,
    path: str,
    user_ref: str | None,
    max_rejected: int | None,
) -> None:
    """Open the run, hand it to the runtime, and report what it did.

    **Nothing here knows the stages.** `model-import@1` does. The command's job
    is to resolve the Graph, open the run against that plan, tail it so a load
    that takes minutes still moves on screen (LD17), and turn the outcome into
    an exit code a scheduler can branch on.
    """
    from invana.apps.graphs.pool import GraphConnectionManager
    from invana.apps.task_plans.models import Task as PlanTask  # noqa: F401
    from invana.core.settings import settings
    from invana.runtime import services as run_services
    from invana.runtime.interpreter import TaskRuntime
    from invana.runtime.models import RunStatus, TaskRun
    from invana.runtime.querysets import TaskRunQuerySet
    from invana.runtime.stream import broadcaster

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

            try:
                run = await run_services.open_load_run(
                    session, graph=graph, name=name, path=path, model_name=model_name, actor_id=actor_id
                )
            except LoadRefused as exc:
                raise click.ClickException(str(exc)) from exc
            run_id = run.id
            await session.commit()

        click.echo(f"run {run_id}")
        # Attach **before** dispatching, so nothing emitted between the two is
        # missed — the same ordering the SSE tail relies on.
        with broadcaster.attach(run_id) as frames:
            tail = asyncio.create_task(_render_frames(frames))
            try:
                await runtime._run(run_id)
            finally:
                broadcaster.close(run_id)
                await tail

        async with session_factory() as session:
            root = await session.get(TaskRun, run_id)
            nodes = await TaskRunQuerySet().nodes_of(session, run_id=run_id)
            outcome = next((n.output or {} for n in nodes if n.task_key == "snapshot_model"), {})
            written = next((n.output or {} for n in nodes if n.task_key == "write_graph"), {})
            status = root.status
            errors = int(outcome.get("reported") or 0)
            groups = outcome.get("groups") or []
            fatal = (root.error or {}).get("message")

        total = int(written.get("written") or 0)
        click.echo(f"Import {status}: {total} record(s) written, {errors} reported.")
        # Grouped by reason: one bad column is one line, not four thousand.
        for group in groups[:10]:
            files = ", ".join(f"{f} x{n}" for f, n in (group.get("files") or {}).items())
            click.echo(f"  {group['count']:>6}  {group['reason']}  ({files})")
            for sample in group.get("samples", [])[:2]:
                click.echo(f"          {sample.get('message')}")
        if status != RunStatus.succeeded.value:
            raise click.ClickException(fatal or f"The load {status}. Open the run for the trace.")
        # An exit code a DAG can branch on (C1).
        if max_rejected is not None and errors > max_rejected:
            raise SystemExit(2)
    finally:
        await manager.shutdown()
        await engine.dispose()


async def _render_frames(frames) -> None:
    """Print each step as it settles — the run's own stream, not a second one."""
    while True:
        frame = await frames.get()
        if frame is None:
            return
        if frame.kind == "step.started":
            click.echo(f"  … {frame.payload.get('label') or frame.payload.get('task_key')}")
        elif frame.kind == "step.progress" and frame.payload.get("detail"):
            click.echo(f"    {frame.payload['detail']}")
        elif frame.kind == "step.finished":
            label = frame.payload.get("label") or frame.payload.get("task_key")
            click.echo(f"  ✓ {label} — {frame.payload.get('detail') or ''}")


@records_cmd.command("check")
@click.argument("path", type=click.Path(exists=True, file_okay=False))
@click.option("--json", "as_json", is_flag=True, help="Emit the report as JSON.")
def check_cmd(path: str, as_json: bool) -> None:
    """Resolve a bundle's declared stitches against the files on disk.

    A preflight (load-data.md LD12): it reads `stitches.json` and the datasets beside it,
    and never opens a Graph, a connection or a database. Nothing is declared here —
    declaring a stitch is Studio and the API.

    Exits non-zero when a rule resolves nothing, or when a rule that did not declare
    itself `partial` leaves values unresolved.
    """
    from invana.runtime.catalogue.bundle import BundleError, check

    try:
        report = check(Path(path))
    except BundleError as exc:
        raise click.ClickException(str(exc)) from exc

    manifest, results = report.manifest, report.rules

    if as_json:
        click.echo(
            json.dumps(
                {
                    "name": manifest.name,
                    "datasets": [
                        {
                            "name": d.name,
                            "nodes": d.nodes,
                            "edges": d.edges,
                            "deferred": d.deferred,
                            "passed": d.passed,
                            "error": d.error,
                            "findings": [
                                {"check": f.check, "detail": f.detail, "count": f.count, "samples": f.samples}
                                for f in d.findings
                            ],
                        }
                        for d in report.datasets
                    ],
                    "passed": report.passed,
                    "rules": [
                        {
                            "id": r.rule.id,
                            "kind": r.rule.kind,
                            "rule": r.rule.describe(),
                            "resolved": r.resolved,
                            "total": r.total,
                            "rows": r.rows,
                            "unresolved": r.unresolved[:25],
                            "passed": r.passed,
                            "error": r.error,
                        }
                        for r in results
                    ],
                },
                indent=2,
            )
        )
    else:
        click.echo(f"\n{manifest.name} — {len(manifest.datasets)} datasets, {len(results)} rules\n")

        # Structure first, then the joins (LD15).
        click.echo("  datasets")
        for d in report.datasets:
            if d.error:
                click.echo(f"  FAIL {d.name:<57} {d.error}")
                continue
            counted = f"{d.nodes} nodes, {d.edges} edges"
            note = f"  {d.deferred} endpoints deferred" if d.deferred else ""
            click.echo(f"  {'ok  ' if d.passed else 'FAIL'} {d.name:<57} {counted}{note}")
            for finding in d.findings:
                click.echo(f"       {finding.check}: {finding.count} {finding.detail}")
                for sample in finding.samples:
                    click.echo(f"         · {sample}")

        section = None
        for r in results:
            heading = "anchors" if r.rule.kind == "anchor" else "relationships"
            if heading != section:
                section = heading
                click.echo(f"  {heading}")
            if r.error:
                click.echo(f"  FAIL {r.rule.id:<4} {r.rule.describe()}")
                click.echo(f"       {r.error}")
                continue
            match = "  (ci)" if r.rule.identity_match == "case_insensitive" else ""
            mark = "ok  " if r.passed else "FAIL"
            counted = f"{r.resolved}/{r.total} keys" if r.countable else "no records to count"
            click.echo(f"  {mark} {r.rule.id:<4} {r.rule.describe() + match:<52} {counted:>20}  {r.rows:>5} rows")
            if r.unresolved:
                what = "overlap only" if r.rule.partial else "unresolved"
                shown = ", ".join(r.unresolved[:6])
                click.echo(f"       {what}: {shown}{' …' if len(r.unresolved) > 6 else ''}")

        ok_datasets = sum(1 for d in report.datasets if d.passed)
        ok_rules = sum(1 for r in results if r.passed)
        click.echo(
            f"\n{len(report.datasets)} datasets, {ok_datasets} clean · {len(results)} rules, {ok_rules} resolve."
        )

    # A structural failure counts as much as a rule that does not resolve (LD15) — an exit
    # code that ignored half the report would pass a broken bundle through CI.
    if not report.passed:
        raise SystemExit(1)
