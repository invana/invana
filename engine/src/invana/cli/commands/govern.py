"""`invana govern …` — the bounds a Graph runs inside, from a file.

A Graph's guardrails and its worlds are one record separated by ``kind``
(docs/for-developers/modules/govern/spec.md GV1), so one file declares both and
one command applies it:

    invana govern apply --graph demo/airways --file demos/airways/govern.json
    invana govern list  --graph demo/airways
    invana govern show  --graph demo/airways --world "EU · H1 2026"

**Guardrails go in first, and the worlds are checked against them.** That is the
same order the product enforces: a world is validated at save, not at run
(WO3), so a world this file cannot legally create is refused here rather than
landing and failing the first time somebody picks it.

Applying is **idempotent by name** — a lens whose name is already in the Graph
is updated in place, so re-running the file after an edit does what you mean
instead of refusing on the unique key.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click

from invana.apps.govern.catalogue import CatalogueResolver
from invana.apps.govern.managers import LensManager
from invana.apps.govern.models import LensKind
from invana.apps.govern.schemas import LensCreate, LensUpdate, RuleIn
from invana.apps.graphs.querysets import GraphQuerySet
from invana.core.auth.querysets import UserQuerySet
from invana.core.db import create_db_engine, create_session_factory
from invana.core.errors import InvanaError

_lenses = LensManager()
_catalogue = CatalogueResolver()


@click.group("govern")
def govern_cmd() -> None:
    """Load and read a Graph's guardrails and worlds."""


async def _with_graph(graph_ref: str, user_ref: str | None, work):
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
            if actor_id is None:
                actor_id = graph.created_by_id

            result = await work(session, graph, actor_id)
            await session.commit()
            return result
    finally:
        await engine.dispose()


def _rules(raw: list[dict]) -> list[RuleIn]:
    return [RuleIn(**rule) for rule in raw]


@govern_cmd.command("apply")
@click.option("--graph", "graph_ref", required=True, help="<username>/<slug>.")
@click.option(
    "--file",
    "file_path",
    required=True,
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    help="The guardrails and worlds to declare.",
)
@click.option("--user", "user_ref", default=None, help="Who is doing it. Defaults to the Graph's owner.")
def apply(graph_ref: str, file_path: Path, user_ref: str | None) -> None:
    """Declare every guardrail and world the file names."""
    payload = json.loads(file_path.read_text())

    async def work(session, graph, actor_id):
        catalogue = await _catalogue.resolve(session, graph_id=graph.id)
        existing = {lens.name: lens for lens in await _lenses.list_for_graph(session, graph_id=graph.id) if lens.name}

        lines: list[tuple[str, str, str]] = []
        # Guardrails first: a world is checked against them, so applying in the
        # other order would refuse worlds that are perfectly legal by the end.
        for kind, entries in (
            (LensKind.guardrail, payload.get("guardrails", [])),
            (LensKind.world, payload.get("worlds", [])),
        ):
            for entry in entries:
                name = entry["name"]
                try:
                    if name in existing:
                        await _lenses.update(
                            session,
                            lens=existing[name],
                            payload=LensUpdate(
                                rules=_rules(entry.get("rules", [])),
                                cast=entry.get("cast", {}),
                                closed_layers=entry.get("closed_layers", []),
                            ),
                            actor_id=actor_id,
                            catalogue=catalogue,
                            may_edit_guardrails=True,
                        )
                        lines.append(("updated", kind.value, name))
                    else:
                        lens = await _lenses.create(
                            session,
                            graph_id=graph.id,
                            payload=LensCreate(
                                name=name,
                                kind=kind,
                                scope=entry.get("scope") if kind is LensKind.guardrail else None,
                                rules=_rules(entry.get("rules", [])),
                                cast=entry.get("cast", {}),
                                closed_layers=entry.get("closed_layers", []),
                            ),
                            actor_id=actor_id,
                            catalogue=catalogue,
                            may_edit_guardrails=True,
                        )
                        existing[name] = lens
                        lines.append(("created", kind.value, name))
                except InvanaError as exc:
                    lines.append(("refused", kind.value, f"{name} — {_why(exc)}"))
        return lines

    lines = asyncio.run(_with_graph(graph_ref, user_ref, work))

    click.echo("")
    for verb, kind, what in lines:
        mark = "ok  " if verb != "refused" else "    "
        click.echo(f"  {mark} {verb:<8} {kind:<10} {what}")
    refused = sum(1 for verb, _, _ in lines if verb == "refused")
    click.echo("")
    click.echo(f"{len(lines)} declared · {len(lines) - refused} applied, {refused} refused.")
    if refused:
        raise SystemExit(1)


def _why(exc: InvanaError) -> str:
    """A refusal, as the surface would word it — the bound named, not a code."""
    detail = exc.detail
    if isinstance(detail, dict) and detail.get("refusals"):
        return "; ".join(r["message"] for r in detail["refusals"])
    return str(detail)


@govern_cmd.command("list")
@click.option("--graph", "graph_ref", required=True, help="<username>/<slug>.")
def list_lenses(graph_ref: str) -> None:
    """Every guardrail in force, then every world that narrows within them."""

    async def work(session, graph, _actor_id):
        return (
            await _lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.guardrail.value),
            await _lenses.list_for_graph(session, graph_id=graph.id, kind=LensKind.world.value),
        )

    guardrails, worlds = asyncio.run(_with_graph(graph_ref, None, work))

    click.echo("")
    click.echo(f"  guardrails — in force on every run  ({len(guardrails)})")
    for lens in guardrails:
        click.echo(f"    {lens.name:<26} {len(lens.rules)} rules · {lens.scope}")
    if not guardrails:
        click.echo("    nothing set — the widest state: every configured provider, the whole global model")

    click.echo("")
    click.echo(f"  worlds — picked per question  ({len(worlds)})")
    for lens in worlds:
        narrows = _narrows(lens)
        click.echo(f"    {lens.name:<26} {narrows}")
    if not worlds:
        click.echo("    none yet — the chip reads Everything")
    click.echo("")


def _narrows(lens) -> str:
    """One line saying what a world actually does, or that it does nothing."""
    bits: list[str] = []
    allows = sum(1 for r in lens.rules or [] if r.get("allow"))
    denies = len(lens.rules or []) - allows
    if allows:
        bits.append(f"{allows} allow")
    if denies:
        bits.append(f"{denies} deny")
    if any(r.get("select") for r in lens.rules or []):
        bits.append("sliced")
    excluded = sorted({p for r in lens.rules or [] for p in (r.get("properties") or {}).get("exclude", [])})
    if excluded:
        bits.append(f"excludes {', '.join(excluded)}")
    if lens.closed_layers:
        bits.append(f"closes {', '.join(lens.closed_layers)}")
    if lens.cast:
        bits.append(f"casts {', '.join(sorted(lens.cast))}")
    return " · ".join(bits) or "narrows nothing — the whole model, inside the guardrails"


@govern_cmd.command("show")
@click.option("--graph", "graph_ref", required=True, help="<username>/<slug>.")
@click.option("--world", "name", required=True, help="Its name, as the list prints it.")
def show(graph_ref: str, name: str) -> None:
    """One lens, read as one object — which is what an auditor is handed."""

    async def work(session, graph, _actor_id):
        for lens in await _lenses.list_for_graph(session, graph_id=graph.id, kind=None, include_unnamed=False):
            if lens.name == name:
                return lens
        raise click.UsageError(f"No lens called {name!r} in this Graph.")

    lens = asyncio.run(_with_graph(graph_ref, None, work))

    click.echo("")
    click.echo(f"  {lens.name}   {lens.kind}" + (f" · {lens.scope}" if lens.scope else ""))
    click.echo(f"  {_narrows(lens)}")
    click.echo("")
    for rule in lens.rules or []:
        verb = "allow" if rule.get("allow") else "deny "
        click.echo(f"    {verb}  {rule['match']}")
        for label, value in (
            ("excludes", (rule.get("properties") or {}).get("exclude")),
            ("select", rule.get("select")),
            ("egress", (rule.get("egress") or {}).get("may_send")),
            ("options", rule.get("options")),
        ):
            if value:
                click.echo(f"           {label}: {json.dumps(value)}")
    if not lens.rules:
        click.echo("    no rules — the widest state, inside whatever bounds it")
    click.echo("")
