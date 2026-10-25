"""`invana iam …` — a Graph's policies, from a terminal.

docs/for-developers/modules/identity-and-access/features/policies.md. A policy
file is YAML — ``name`` · ``kind`` (custom · boundary) · ``description`` ·
``statements`` · ``limits``::

    invana iam list   --graph ada/airways [--json]
    invana iam show   fare-read --graph ada/airways [--json]
    invana iam apply  fare-read.yaml --why "scouts read fares" --graph ada/airways

``apply`` creates the policy and saves it as version 1, or saves an existing
custom or boundary policy's next version. It refuses what the API refuses — a
managed or inline name, a statement outside the grammar — and exits 1.
``--user`` is who acts and defaults to the Graph's owner.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click

from invana.apps.iam.managers.policies import PolicyManager
from invana.cli.context import graph_options, on_graph
from invana.core.lists import ListParams

_policies = PolicyManager()


def _load(path: Path) -> object:
    """A policy file's contents. JSON is read as itself; anything else as YAML."""
    text = path.read_text()
    try:
        return json.loads(text)
    except ValueError:
        pass
    try:
        import yaml
    except ImportError as exc:
        raise click.ClickException("Reading a YAML policy file needs PyYAML; give the file as JSON instead.") from exc
    try:
        return yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise click.ClickException(f"{path.name} is not YAML: {exc}") from exc


@click.group("iam")
def iam_cmd() -> None:
    """A Graph's policies — list, show, apply."""


@iam_cmd.command("list")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def list_(graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """Every policy: kind, status, what it allows and who holds it."""

    async def go() -> list:
        async with on_graph(graph_ref, user_ref) as (session, graph, _):
            rows, _info, _kinds = await _policies.page(
                session, graph_id=graph.id, params=ListParams(sort="name", limit=200)
            )
            return rows

    rows = asyncio.run(go())
    if as_json:
        click.echo(json.dumps([r.model_dump(mode="json") for r in rows], indent=2))
        return
    for r in rows:
        status = "" if r.status == "saved" else " (draft)"
        click.echo(f"{r.name}\t{r.kind}{status}\t{r.summary}\t{r.held_by.line}")


@iam_cmd.command("show")
@click.argument("name")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of text.")
def show(name: str, graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """NAME's statements, limits and holders."""

    async def go():
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            return await _policies.get(session, graph_id=graph.id, name=name, actor_id=actor.id)

    policy = asyncio.run(go())
    if as_json:
        click.echo(json.dumps(policy.model_dump(mode="json"), indent=2))
        return
    state = f"v{policy.version}" if policy.status == "saved" else "draft"
    click.echo(f"{policy.name}\t{policy.kind}\t{state}\theld by {policy.held_by.line}")
    if policy.description:
        click.echo(policy.description)
    for s in policy.statements:
        extra = f"\t{json.dumps(s.conditions)}" if s.conditions else ""
        click.echo(f"  {s.layer}\tallow {' · '.join(s.actions)} on {' · '.join(s.resources)}{extra}")
    limits = policy.limits.model_dump(exclude_defaults=True)
    for key, value in limits.items():
        click.echo(f"  limit\t{key}\t{value}")


@iam_cmd.command("apply")
@click.argument("file_path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--why", default=None, help="Why this version — kept in its History.")
@graph_options
def apply(file_path: Path, why: str | None, graph_ref: str, user_ref: str | None) -> None:
    """Create or save a new version of the policy FILE_PATH describes."""
    doc = _load(file_path)

    async def go() -> str:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            policy = await _policies.apply_file(session, graph_id=graph.id, doc=doc, why=why, actor_id=actor.id)
            return f"{policy.name}\tsaved v{policy.version}"

    click.echo(asyncio.run(go()))
