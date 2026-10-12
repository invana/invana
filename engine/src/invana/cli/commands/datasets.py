"""`invana datasets …` — the install's catalogue of versioned tables, from a terminal.

docs/for-developers/modules/bring-data-in/features/datasets.md ·
retract-and-refresh.md · bind-a-dataset.md. A dataset lives above Graphs, so
every command but ``bind`` names who acts with ``--user`` and no Graph:

    invana datasets list     --user ada [--origin official] [--bound-in demo/arabidopsis]
    invana datasets show     abrc/accessions --user ada
    invana datasets import   --path accessions.csv --as abrc/accessions --origin official --licence CC-BY-4.0 \\
                             --key accession --user ada
    invana datasets versions abrc/accessions --user ada
    invana datasets diff     abrc/accessions 2 3 --user ada
    invana datasets history  abrc/accessions --record CS76779 --user ada
    invana datasets share    abrc/accessions --visibility install --user ada
    invana datasets retract  abrc/accessions@2 --reason "contaminated batch" --user admin
    invana datasets refresh  abrc/accessions --schedule "0 3 * * *" --source accessions.csv --user ada
    invana datasets refresh  abrc/accessions --now --user ada
    invana datasets bind     abrc/accessions@3 --graph ada/arabidopsis --model Germplasm --type Accession

**A file is the CLI's; the API takes records in the body.** ``import`` and
``refresh --now`` read CSV (a header row) or JSON (a list of objects) here and
mint through the same manager the API calls, so one set of records hashes the
same whichever front-end carried it. An empty CSV cell is null.

``refresh --now`` is the firing until shared schedules exist: it reads the
dataset's stored source and mints a version only when the content changed —
exit 0 either way, ``unchanged`` on stdout when it minted nothing.

``bind`` opens the load run, commits, and works it in this process, as
``invana records import`` does; it exits 1 when the load fails.
"""

from __future__ import annotations

import asyncio
import csv
import json
from pathlib import Path
from typing import Any

import click

from invana.activity.managers import ChangeLogManager
from invana.apps.datasets.managers import DatasetManager, parse_ref
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetUpdate, DatasetVersionCreate
from invana.cli.context import as_user, on_graph, with_runtime
from invana.core.errors import NotFoundError
from invana.runtime.managers import DatasetBindManager

_datasets = DatasetManager()
_changes = ChangeLogManager()
_binds = DatasetBindManager()


def read_records(path: str) -> list[dict[str, Any]]:
    """The records in a CSV or JSON file — the CLI's half of an import."""
    file = Path(path)
    if not file.is_file():
        raise click.ClickException(f"Cannot read {path!r}: no such file.")
    text = file.read_text(encoding="utf-8")
    if file.suffix.lower() == ".json":
        records = json.loads(text)
        if not isinstance(records, list):
            raise click.ClickException(f"{path} is not a JSON list of objects.")
        return records
    if file.suffix.lower() == ".csv":
        return [{k: (v if v != "" else None) for k, v in row.items()} for row in csv.DictReader(text.splitlines())]
    raise click.ClickException(f"{path}: a dataset is read from .csv or .json.")


def _user_option(fn):
    return click.option("--user", "user_ref", required=True, help="Who is doing it (username or email).")(fn)


@click.group("datasets")
def datasets_cmd() -> None:
    """Datasets: import, version, share, retract, refresh, and bind into a Graph."""


@datasets_cmd.command("list")
@_user_option
@click.option("--origin", default=None, help="official · collected · generated · observed · derived")
@click.option("--bound-in", "bound_in", default=None, help="A Graph as <username>/<slug>.")
def list_(user_ref: str, origin: str | None, bound_in: str | None) -> None:
    """Every dataset you may read, newest first."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            for ds in await _datasets.catalogue(session, reader=actor, origin=origin, bound_in=bound_in):
                read = await _datasets.read(session, ds)
                version = f"v{read.current_version}" if read.current_version else "—"
                click.echo(f"{read.address}\t{version}\t{read.origin}\t{read.visibility}\t{read.licence or '—'}")

    asyncio.run(go())


@datasets_cmd.command("show")
@click.argument("ref")
@_user_option
def show(ref: str, user_ref: str) -> None:
    """One dataset: its origin, labels, current version and author chain."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            read = await _datasets.read(session, dataset)
            click.echo(f"{read.address} — {read.title}")
            click.echo(f"origin {read.origin} · key {read.key_column} · {read.visibility} · {read.sensitivity}")
            if read.current_version:
                click.echo(f"v{read.current_version} · {read.record_count} records · {read.licence}")
                click.echo(f"{read.content_hash}")
            for step in read.author_chain:
                click.echo(f"  {step['role']}\t{step['kind']}\t{step['name']}")
            if read.refresh_schedule:
                click.echo(f"refresh {read.refresh_schedule} from {read.refresh_source}")

    asyncio.run(go())


@datasets_cmd.command("import")
@click.option("--path", required=True, help="A .csv (header row) or .json (list of objects).")
@click.option("--as", "ref", required=True, help="<publisher>/<name>; created when absent.")
@click.option("--origin", default=None, help="Required when the dataset is created.")
@click.option("--licence", required=True)
@click.option("--key", "key_column", default="id", show_default=True, help="The column records are keyed by.")
@click.option("--author", "authors", multiple=True, help="An original author, as <kind>:<name> (organisation:ABRC).")
@click.option("--derived-from", "derived_from", multiple=True, help="An input version, publisher/name@v.")
@click.option("--why", default=None)
@_user_option
def import_(
    path: str,
    ref: str,
    origin: str | None,
    licence: str,
    key_column: str,
    authors: tuple[str, ...],
    derived_from: tuple[str, ...],
    why: str | None,
    user_ref: str,
) -> None:
    """Mint the next version from a file — creating the dataset first when it does not exist."""
    records = read_records(path)
    publisher, name, version = parse_ref(ref)
    if version is not None:
        raise click.UsageError("--as names a dataset, not a version.")
    chain = []
    for author in authors:
        kind, _, who = author.partition(":")
        if not who:
            raise click.UsageError(f"--author {author!r}: expected <kind>:<name>.")
        chain.append(AuthorStep(role="original", kind=kind, name=who))

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            try:
                dataset = await _datasets.get(session, publisher=publisher, name=name, reader=actor)
            except NotFoundError:
                if origin is None:
                    raise click.UsageError(f"{ref} does not exist yet — name its --origin.") from None
                dataset = await _datasets.create(
                    session,
                    payload=DatasetCreate(publisher=publisher, name=name, origin=origin, key_column=key_column),
                    actor=actor,
                )
            payload = DatasetVersionCreate(
                licence=licence,
                author_chain=chain,
                records=records,
                source=Path(path).name,
                derived_from=list(derived_from),
                why=why,
            )
            minted = await _datasets.publish_version(session, dataset=dataset, payload=payload, actor=actor)
            click.echo(f"{dataset.address}@{minted.version}\t{minted.record_count} records\t{minted.content_hash}")

    asyncio.run(go())


@datasets_cmd.command("versions")
@click.argument("ref")
@_user_option
def versions(ref: str, user_ref: str) -> None:
    """Every version, newest first; a retracted one says so."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            for row in await _datasets.list_versions(session, dataset=dataset):
                read = await _datasets.read_version(session, dataset=dataset, version=row)
                flag = f"\tretracted: {read.retracted.reason}" if read.retracted else ""
                inputs = f"\tretracted inputs: {', '.join(read.retracted_inputs)}" if read.retracted_inputs else ""
                at = f"{read.published_at:%Y-%m-%d %H:%M}"
                click.echo(f"v{read.version}\t{at}\t{read.record_count} records\t{read.why or ''}{flag}{inputs}")

    asyncio.run(go())


@datasets_cmd.command("diff")
@click.argument("ref")
@click.argument("a")
@click.argument("b")
@_user_option
def diff(ref: str, a: str, b: str, user_ref: str) -> None:
    """Two versions: the records summary, then licence, author chain and columns."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            compare = await _changes.compare(
                session, graph_id=None, record_kind="dataset", record_id=dataset.id, a=a.lstrip("v"), b=b.lstrip("v")
            )
            click.echo(f"v{compare.a} → v{compare.b}: {compare.summary}")
            for field in compare.fields:
                click.echo(f"  {field.field}: {field.before!r} → {field.after!r}")

    asyncio.run(go())


@datasets_cmd.command("history")
@click.argument("ref")
@click.option("--record", "key", default=None, help="One record's change log, by key.")
@_user_option
def history(ref: str, key: str | None, user_ref: str) -> None:
    """The dataset's change log, or with --record one record's."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            if key is None:
                log = await _changes.history(session, graph_id=None, record_kind="dataset", record_id=dataset.id)
                for item in log.items:
                    who = item.actor_name or "—"
                    effect = f"{item.effect.runs} bind load(s)"
                    click.echo(f"v{item.version}\t{item.at:%Y-%m-%d %H:%M}\t{who}\t{item.summary}\t{effect}")
                return
            log = await _datasets.record_history(session, dataset=dataset, key=key)
            for item in log.items:
                click.echo(f"v{item.version}\t{item.kind}\t{item.why or ''}")
                for change in item.properties:
                    click.echo(f"  {change.property}: {change.before!r} → {change.after!r}")

    asyncio.run(go())


@datasets_cmd.command("share")
@click.argument("ref")
@click.option("--visibility", type=click.Choice(["private", "install"]), required=True)
@_user_option
def share(ref: str, visibility: str, user_ref: str) -> None:
    """Share a dataset with the install, or take it back to only you."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            await _datasets.update(session, dataset=dataset, payload=DatasetUpdate(visibility=visibility), actor=actor)
            click.echo(f"{dataset.address}\t{dataset.visibility}")

    asyncio.run(go())


@datasets_cmd.command("retract")
@click.argument("ref")
@click.option("--reason", required=True)
@_user_option
def retract(ref: str, reason: str, user_ref: str) -> None:
    """Withdraw one version — an install Admin's act. It stays readable, flagged."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, number = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            if number is None:
                raise click.UsageError("Retract names a version: publisher/name@v.")
            row = await _datasets.get_version(session, dataset=dataset, version=number)
            await _datasets.retract(session, dataset=dataset, version=row, reason=reason, actor=actor)
            used = await _datasets.used(session, dataset=dataset, version=row, reader=actor)
            click.echo(f"{used.address}\tretracted")
            for binding in used.bindings:
                click.echo(f"  bound\t{binding.graph_id}\t{binding.model_name}\t{binding.type_name}")
            for ref_ in used.derived:
                click.echo(f"  derived\t{ref_.address}")

    asyncio.run(go())


@datasets_cmd.command("refresh")
@click.argument("ref")
@click.option("--schedule", default=None, help='A 5-field cron; "" clears it.')
@click.option("--source", default=None, help="The local path a refresh reads.")
@click.option("--now", is_flag=True, help="Read the source and mint a version if the content changed.")
@_user_option
def refresh(ref: str, schedule: str | None, source: str | None, now: bool, user_ref: str) -> None:
    """Set the refresh schedule, or fire it now."""
    if now == (schedule is not None or source is not None):
        raise click.UsageError("Either --now, or --schedule/--source to set the schedule.")

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=ref, reader=actor)
            if not now:
                fields = {
                    k: v for k, v in (("refresh_schedule", schedule), ("refresh_source", source)) if v is not None
                }
                await _datasets.update(session, dataset=dataset, payload=DatasetUpdate(**fields), actor=actor)
                click.echo(f"{dataset.address}\t{dataset.refresh_schedule or 'no schedule'}\t{dataset.refresh_source}")
                return
            _datasets.require_owner(dataset, actor, "refresh it")
            if not dataset.refresh_source:
                raise click.ClickException(f"{dataset.address} has no refresh source — set one with --source.")
            minted = await _datasets.refresh(
                session, dataset=dataset, records=read_records(dataset.refresh_source), actor=actor
            )
            click.echo("unchanged" if minted is None else f"{dataset.address}@{minted.version}")

    asyncio.run(go())


@datasets_cmd.command("bind")
@click.argument("ref")
@click.option("--graph", "graph_ref", required=True, help="<username>/<slug>.")
@click.option("--model", "model_name", required=True, help="The model's name in that Graph.")
@click.option("--type", "type_name", required=True, help="The node type the records become.")
@click.option("--user", "user_ref", default=None, help="Who binds. Defaults to the Graph's owner.")
def bind(ref: str, graph_ref: str, model_name: str, type_name: str, user_ref: str | None) -> None:
    """Bind one version into a Graph's model, then work the load here."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            model_id = await _binds.model_named(session, graph=graph, name=model_name)
            binding, run = await _binds.bind(
                session, graph=graph, ref=ref, model_id=model_id, type_name=type_name, actor=actor
            )
            run_id = run.id
            click.echo(f"bound {ref} → {model_name}.{binding.type_name}\trun {run_id}")
        async with with_runtime() as runtime:
            await runtime.run_inline(run_id)
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            status = await _binds.run_status(session, run_id=run_id)
        click.echo(f"load {status}")
        if status != "succeeded":
            raise SystemExit(1)

    asyncio.run(go())
