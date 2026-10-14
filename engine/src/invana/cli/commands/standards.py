"""`invana standards …` — the install's standards, and the ones a dataset claims.

docs/for-developers/modules/bring-data-in/features/standards.md. A standard
lives above Graphs, so every command names who acts with ``--user``:

    invana standards list    --user ada [--origin pack]
    invana standards show    admin/iso-3166 --user ada
    invana standards apply   --file iso-3166.json --user admin
    invana standards import  --skos crop-stages.ttl --user ada [--scheme IRI] [--dry-run]
    invana standards attach  abrc/accessions --standard admin/iso-3166 --mode block \\
                             --map country=country_code --user ada
    invana standards detach  abrc/accessions --standard admin/iso-3166 --user ada
    invana standards check   abrc/accessions@3 --user ada

**A standard file is JSON** with the fields of ``POST /api/v1/standards`` —
``publisher?``, ``name``, ``title?``, ``description?``, ``origin?``, ``terms``,
``why?``. ``apply`` creates the standard, or mints its next version when the
terms changed, and prints ``unchanged`` when they did not.

``import`` reads a SKOS concept scheme — a file, or a URL it fetches itself —
into a standard (docs/for-developers/modules/bring-data-in/features/skos-import.md).

``check`` scores one dataset version (the current one when none is named)
against every standard the dataset claims, and exits 1 when any does not
conform — so a pipeline can stop on it.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click

from invana.apps.datasets.managers import ConformanceManager, DatasetManager
from invana.apps.datasets.schemas import DatasetStandardCreate, Enforcement
from invana.apps.standards.managers import SkosImportManager, StandardManager
from invana.apps.standards.schemas import SkosImportRequest, SkosImportResult, StandardCreate
from invana.cli.context import as_user
from invana.cli.sources import FORMAT_CHOICES, read_source

_standards = StandardManager()
_skos = SkosImportManager()
_datasets = DatasetManager()
_claims = ConformanceManager()


def _user_option(fn):
    return click.option("--user", "user_ref", required=True, help="Who is doing it (username or email).")(fn)


def read_standard_file(path: str) -> StandardCreate:
    file = Path(path)
    if not file.is_file():
        raise click.ClickException(f"Cannot read {path!r}: no such file.")
    try:
        raw = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise click.ClickException(f"{path} is not JSON: {exc}.") from exc
    if not isinstance(raw, dict):
        raise click.ClickException(f"{path} is not a JSON object.")
    return StandardCreate.model_validate(raw)


@click.group("standards")
def standards_cmd() -> None:
    """Standards: the library, apply a file, and the ones a dataset claims."""


@standards_cmd.command("list")
@_user_option
@click.option("--origin", type=click.Choice(["pack", "authored"]), default=None)
def list_(user_ref: str, origin: str | None) -> None:
    """Every standard in the install, by address."""

    async def go() -> None:
        async with as_user(user_ref) as (session, _):
            for row in await _standards.search(session, origin=origin):
                read = await _standards.read(session, row)
                version = f"v{read.current_version}" if read.current_version else "—"
                click.echo(f"{read.address}\t{version}\t{read.origin}\t{len(read.terms)} terms")

    asyncio.run(go())


@standards_cmd.command("show")
@click.argument("ref")
@_user_option
def show(ref: str, user_ref: str) -> None:
    """One standard version's terms — the current one when the ref names none."""

    async def go() -> None:
        async with as_user(user_ref) as (session, _):
            standard, version = await _standards.get_by_ref(session, ref=ref)
            click.echo(f"{standard.address}@{version.version} — {standard.title} · {standard.origin}")
            for term in version.terms:
                flag = "required" if term["required"] else "optional"
                codes = ", ".join(v["code"] for v in term.get("values") or [])
                click.echo(f"  {term['name']}\t{term['type']}\t{flag}" + (f"\t{codes}" if codes else ""))

    asyncio.run(go())


@standards_cmd.command("apply")
@click.option("--file", "path", required=True, help="A standard as JSON.")
@_user_option
def apply(path: str, user_ref: str) -> None:
    """Create the standard, or mint its next version when the terms changed."""
    payload = read_standard_file(path)

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            standard, version = await _standards.apply(session, payload=payload, actor=actor)
            click.echo("unchanged" if version is None else f"{standard.address}@{version.version}")

    asyncio.run(go())


@standards_cmd.command("import")
@click.option("--skos", "source", required=True, help="A SKOS vocabulary: a file, or a URL to fetch.")
@click.option(
    "--format", "fmt", type=click.Choice(FORMAT_CHOICES), default=None, help="Default: from the name or text."
)
@click.option("--scheme", default=None, help="The concept scheme's IRI, when the file holds several.")
@click.option("--publisher", default=None, help="Default: the user's username.")
@click.option("--name", default=None, help="Default: the slug of the scheme's title.")
@click.option("--lang", default="en", show_default=True, help="Which labels to read.")
@click.option("--why", default=None, help="Recorded on the version.")
@click.option("--dry-run", is_flag=True, help="Show the terms and the report; write nothing.")
@_user_option
def import_(
    source: str,
    fmt: str | None,
    scheme: str | None,
    publisher: str | None,
    name: str | None,
    lang: str,
    why: str | None,
    dry_run: bool,
    user_ref: str,
) -> None:
    """A SKOS concept scheme as a standard — created, or its next version."""
    content, detected = read_source(source, fmt)
    payload = SkosImportRequest(
        content=content,
        format=detected,
        scheme=scheme,
        publisher=publisher,
        name=name,
        lang=lang,
        why=why,
        dry_run=dry_run,
    )

    async def go() -> SkosImportResult:
        async with as_user(user_ref) as (session, actor):
            return await _skos.import_skos(session, payload=payload, actor=actor)

    result = asyncio.run(go())
    for term in result.terms:
        click.echo(f"  {term.name}\t{len(term.values or [])} values")
    report = result.report
    click.echo(f"{report.mapped['terms']} terms, {report.mapped['values']} values; {report.skipped_count} skipped.")
    for note in report.skipped:
        click.echo(f"  skipped {note.subject}: {note.message}")
    for note in report.notes:
        click.echo(f"  note {note.subject}: {note.message}")
    if dry_run:
        click.echo(f"dry run — nothing written; would write {result.address}.")
    elif result.unchanged:
        click.echo(f"unchanged — {result.address} already holds these terms.")
    else:
        click.echo(f"{result.address}@{result.version.version}")


@standards_cmd.command("attach")
@click.argument("dataset_ref")
@click.option("--standard", "standard_ref", required=True, help="publisher/name[@v]; the current version if none.")
@click.option("--mode", type=click.Choice([e.value for e in Enforcement]), default=Enforcement.warn.value)
@click.option("--map", "maps", multiple=True, help="term=column, when the column has another name.")
@_user_option
def attach(dataset_ref: str, standard_ref: str, mode: str, maps: tuple[str, ...], user_ref: str) -> None:
    """Claim a standard for a dataset, scored against its current version."""
    mapping: dict[str, str] = {}
    for item in maps:
        term, sep, column = item.partition("=")
        if not sep or not term or not column:
            raise click.UsageError(f"--map {item!r} is not term=column.")
        mapping[term] = column

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=dataset_ref, reader=actor)
            payload = DatasetStandardCreate(standard=standard_ref, mode=mode, mapping=mapping or None)
            claim = await _claims.attach(session, dataset=dataset, payload=payload, actor=actor)
            read = await _claims.read_attachment(session, dataset=dataset, claim=claim)
            score = f"{read.conformance.score:.4g}" if read.conformance else "no version yet"
            click.echo(f"{dataset.address}\tclaims {read.standard}\t{read.mode}\t{score}")

    asyncio.run(go())


@standards_cmd.command("detach")
@click.argument("dataset_ref")
@click.option("--standard", "standard_ref", required=True, help="publisher/name.")
@_user_option
def detach(dataset_ref: str, standard_ref: str, user_ref: str) -> None:
    """Stop claiming a standard."""

    async def go() -> None:
        async with as_user(user_ref) as (session, actor):
            dataset, _ = await _datasets.get_by_ref(session, ref=dataset_ref, reader=actor)
            await _claims.detach(session, dataset=dataset, ref=standard_ref, actor=actor)
            click.echo(f"{dataset.address}\tno longer claims {standard_ref}")

    asyncio.run(go())


@standards_cmd.command("check")
@click.argument("dataset_ref")
@_user_option
def check(dataset_ref: str, user_ref: str) -> None:
    """Score a dataset version against every standard it claims; exit 1 when one does not conform."""

    async def go() -> bool:
        async with as_user(user_ref) as (session, actor):
            dataset, number = await _datasets.get_by_ref(session, ref=dataset_ref, reader=actor)
            if number is not None:
                version = await _datasets.get_version(session, dataset=dataset, version=number)
            else:
                version = await _datasets.current(session, dataset)
            if version is None:
                raise click.ClickException(f"{dataset.address} has no version to check.")
            items = await _claims.conformance(session, dataset=dataset, version=version)
            if not items:
                click.echo(f"{dataset.address} claims no standard.")
            for item in items:
                click.echo(
                    f"{item.dataset}\t{item.standard}\t{item.mode}\t{item.score:.4g}\t"
                    f"{item.conforming}/{item.record_count} conform\t{item.violation_count} violation(s)"
                )
                for v in item.violations[:10]:
                    click.echo(f"  {v.key}\t{v.term}\t{v.kind}" + (f"\t{v.value}" if v.value is not None else ""))
            return all(item.conforms for item in items)

    if not asyncio.run(go()):
        raise SystemExit(1)
