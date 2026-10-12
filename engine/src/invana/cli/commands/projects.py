"""`invana projects · branches · findings · proposals · reports` — a project's
records from a terminal.

docs/for-developers/modules/work/features/branches-and-decisions.md ·
project-reports.md · private-projects.md. Every command names the Graph;
``--user`` is who acts and defaults to the Graph's owner. A private project the
user is not on reads as absent, as it does over the API:

    invana projects create "Flowering time" --type research --question "…" [--private] --graph ada/arabidopsis
    invana projects list | show <key>
    invana branches list --project flowering-time
    invana branches fork 1 --into "Early" --into "Late" --project flowering-time
    invana findings add --branch 2 --stance contradicts --cites dataset:ada/trials@3 "…" --project flowering-time
    invana findings review 4 --project flowering-time
    invana branches decide 2 --verdict supported --decision pursue --rationale "…" [--addresses 4] [--supersedes 1]
    invana branches merge 2 3 --rationale "…" --project flowering-time
    invana proposals list | accept <n> | reject <n> --project flowering-time
    invana reports generate | publish | export <version> --project flowering-time

Verdicts and decisions are given in their canonical words (``supported ·
refuted · inconclusive`` and ``pursue · park · drop · merge``) and printed in
the type's. The command refuses what the API refuses and exits 1.
"""

from __future__ import annotations

import asyncio
import json

import click

from invana.apps.work.managers import (
    BranchManager,
    DecisionManager,
    ProjectManager,
    ProposalManager,
    ReportManager,
)
from invana.apps.work.schemas import Cite, DecisionCreate, FindingCreate, ProjectCreate
from invana.cli.context import graph_options, on_graph

_projects = ProjectManager()
_branches = BranchManager()
_decisions = DecisionManager()
_proposals = ProposalManager()
_reports = ReportManager()


def _project_option(fn):
    return click.option("--project", "project_key", required=True, help="The project's key.")(fn)


async def _project(session, graph, actor, key: str):
    return await _projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=actor.id)


def _cite(raw: str) -> Cite:
    kind, sep, ref = raw.partition(":")
    if not sep or kind not in {"record", "dataset", "run"}:
        raise click.UsageError(f"A cite is record:<id>, dataset:<publisher/name@v> or run:<id> — not {raw!r}.")
    return Cite(kind=kind, ref=ref)


# ── projects ─────────────────────────────────────────────────────────────────


@click.group("projects")
def projects_cmd() -> None:
    """A Graph's projects — list, create, show."""


@projects_cmd.command("list")
@graph_options
@click.option("--json", "as_json", is_flag=True, help="Print JSON instead of a table.")
def projects_list(graph_ref: str, user_ref: str | None, as_json: bool) -> None:
    """Every project the user may see."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            rows = await _projects.list_for_graph(session, graph_id=graph.id, reader_id=actor.id)
        if as_json:
            click.echo(json.dumps([r.model_dump(mode="json") for r in rows], indent=2))
            return
        for r in rows:
            click.echo(f"{r.key}\t{r.type}\t{r.visibility}\t{r.status}\t{r.question or r.name}")

    asyncio.run(go())


@projects_cmd.command("create")
@click.argument("name")
@click.option("--type", "project_type", default="general", help="research · policy · general.")
@click.option("--question", default="", help="The one question the project is deciding.")
@click.option("--private", is_flag=True, help="Only the people on it can see it.")
@graph_options
def projects_create(
    name: str, project_type: str, question: str, private: bool, graph_ref: str, user_ref: str | None
) -> None:
    """Start a project NAME; its first branch is the question."""

    async def go() -> None:
        payload = ProjectCreate(
            name=name, type=project_type, question=question, visibility="private" if private else "graph"
        )
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _projects.create(session, graph_id=graph.id, payload=payload, actor=actor)
            line = f"created\t{project.key}\t{project.type}\t{project.visibility}"
        click.echo(line)

    asyncio.run(go())


@projects_cmd.command("show")
@click.argument("key")
@graph_options
def projects_show(key: str, graph_ref: str, user_ref: str | None) -> None:
    """A project and its branches, as JSON."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, key)
            read = await _projects.read(session, project=project)
            branches = await _branches.list(session, project=project)
        out = read.model_dump(mode="json") | {"branches": [b.model_dump(mode="json") for b in branches]}
        click.echo(json.dumps(out, indent=2))

    asyncio.run(go())


# ── branches ─────────────────────────────────────────────────────────────────


@click.group("branches")
def branches_cmd() -> None:
    """A project's lines of inquiry — list, fork, decide, merge."""


@branches_cmd.command("list")
@_project_option
@graph_options
def branches_list(project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """The tree: number, parent, status, the balance of evidence, the title."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            rows = await _branches.list(session, project=await _project(session, graph, actor, project_key))
        for b in rows:
            parent = f"b{b.parent_number}" if b.parent_number else "—"
            balance = f"{b.supports} supports · {b.contradicts} contradicts"
            click.echo(f"b{b.number}\t{parent}\t{b.status}\t{balance}\t{b.title}")

    asyncio.run(go())


@branches_cmd.command("fork")
@click.argument("number", type=int)
@click.option("--into", "titles", multiple=True, required=True, help="A child branch's title. Repeat for several.")
@_project_option
@graph_options
def branches_fork(number: int, titles: tuple[str, ...], project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Fork branch NUMBER into one child per --into."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            branch = await _branches.get(session, project=project, number=number)
            children = await _branches.fork(session, project=project, branch=branch, titles=list(titles), actor=actor)
            lines = [f"b{c.number}\t{c.title}" for c in children]
        click.echo("\n".join(lines))

    asyncio.run(go())


async def _decide(graph_ref: str, user_ref: str | None, project_key: str, number: int, payload: DecisionCreate):
    async with on_graph(graph_ref, user_ref) as (session, graph, actor):
        project = await _project(session, graph, actor, project_key)
        branch = await _branches.get(session, project=project, number=number)
        decision = await _decisions.decide(session, project=project, branch=branch, payload=payload, actor=actor)
        (read,) = await _decisions.read(session, [decision])
    click.echo(f"d{read.number}\tb{read.branch_number}\t{read.verdict_label} · {read.choice_label}")
    for warning in read.warnings:
        click.echo(f"warning\t{warning}", err=True)


@branches_cmd.command("decide")
@click.argument("number", type=int)
@click.option("--verdict", required=True, type=click.Choice(["supported", "refuted", "inconclusive"]))
@click.option("--decision", "choice", required=True, type=click.Choice(["pursue", "park", "drop"]))
@click.option("--rationale", required=True)
@click.option("--addresses", multiple=True, type=int, help="A contradicting finding the verdict answers.")
@click.option("--cites", multiple=True, type=int, help="A finding it rests on; every one on the branch if none.")
@click.option("--supersedes", type=int, default=None, help="The decision this one supersedes.")
@_project_option
@graph_options
def branches_decide(
    number: int,
    verdict: str,
    choice: str,
    rationale: str,
    addresses: tuple[int, ...],
    cites: tuple[int, ...],
    supersedes: int | None,
    project_key: str,
    graph_ref: str,
    user_ref: str | None,
) -> None:
    """Record a verdict and a decision on branch NUMBER; the rules are checked, nothing is edited."""
    payload = DecisionCreate(
        verdict=verdict,
        choice=choice,
        rationale=rationale,
        addresses=list(addresses),
        cites=list(cites) or None,
        supersedes=supersedes,
    )
    asyncio.run(_decide(graph_ref, user_ref, project_key, number, payload))


@branches_cmd.command("merge")
@click.argument("source", type=int)
@click.argument("into", type=int)
@click.option("--verdict", default="supported", type=click.Choice(["supported", "refuted", "inconclusive"]))
@click.option("--rationale", required=True)
@click.option("--addresses", multiple=True, type=int, help="A contradicting finding the verdict answers.")
@click.option("--carry", multiple=True, type=int, help="A finding to carry; every one on SOURCE if none.")
@click.option("--supersedes", type=int, default=None, help="The decision this one supersedes.")
@_project_option
@graph_options
def branches_merge(
    source: int,
    into: int,
    verdict: str,
    rationale: str,
    addresses: tuple[int, ...],
    carry: tuple[int, ...],
    supersedes: int | None,
    project_key: str,
    graph_ref: str,
    user_ref: str | None,
) -> None:
    """Merge branch SOURCE into INTO — a decision, carrying findings by reference."""
    payload = DecisionCreate(
        verdict=verdict,
        choice="merge",
        rationale=rationale,
        addresses=list(addresses),
        into=into,
        carry=list(carry) or None,
        supersedes=supersedes,
    )
    asyncio.run(_decide(graph_ref, user_ref, project_key, source, payload))


# ── findings ─────────────────────────────────────────────────────────────────


@click.group("findings")
def findings_cmd() -> None:
    """Evidence on a branch — add, review."""


@findings_cmd.command("add")
@click.argument("statement")
@click.option("--branch", "number", required=True, type=int)
@click.option("--stance", required=True, type=click.Choice(["supports", "contradicts", "context"]))
@click.option("--cites", multiple=True, help="record:<id> · dataset:<publisher/name@v> · run:<id>. Repeat.")
@_project_option
@graph_options
def findings_add(
    statement: str,
    number: int,
    stance: str,
    cites: tuple[str, ...],
    project_key: str,
    graph_ref: str,
    user_ref: str | None,
) -> None:
    """Add a finding to a branch. A person's finding is reviewed by them."""
    payload = FindingCreate(statement=statement, stance=stance, cites=[_cite(c) for c in cites])

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            branch = await _branches.get(session, project=project, number=number)
            finding = await _branches.add_finding(
                session, graph_id=graph.id, project=project, branch=branch, payload=payload, actor=actor
            )
            line = f"f{finding.number}\tb{number}\t{finding.stance}"
        click.echo(line)

    asyncio.run(go())


@findings_cmd.command("review")
@click.argument("number", type=int)
@_project_option
@graph_options
def findings_review(number: int, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Review finding NUMBER as a person."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            finding = await _branches.get_finding(session, project=project, number=number)
            await _branches.review(session, project=project, finding=finding, actor=actor)
        click.echo(f"reviewed\tf{number}")

    asyncio.run(go())


# ── proposals ────────────────────────────────────────────────────────────────


@click.group("proposals")
def proposals_cmd() -> None:
    """What agents proposed — list, accept, reject."""


@proposals_cmd.command("list")
@click.option("--status", "status", type=click.Choice(["open", "accepted", "rejected"]), default=None)
@_project_option
@graph_options
def proposals_list(status: str | None, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """A project's proposals, oldest first."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            rows = await _proposals.list(session, project=project, status=status)
        for p in rows:
            click.echo(f"p{p.number}\tb{p.branch_number}\t{p.kind}\t{p.status}\t{p.rationale}")

    asyncio.run(go())


async def _resolve(accept: bool, number: int, note: str, project_key: str, graph_ref: str, user_ref: str | None):
    async with on_graph(graph_ref, user_ref) as (session, graph, actor):
        project = await _project(session, graph, actor, project_key)
        proposal = await _proposals.get(session, project=project, number=number)
        act = _proposals.accept if accept else _proposals.reject
        proposal = await act(session, project=project, proposal=proposal, note=note, actor=actor)
        line = f"p{proposal.number}\t{proposal.status}\t{json.dumps(proposal.result or {})}"
    click.echo(line)


@proposals_cmd.command("accept")
@click.argument("number", type=int)
@click.option("--note", default="")
@_project_option
@graph_options
def proposals_accept(number: int, note: str, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Do what proposal NUMBER proposes, as this person — a decision is checked by the rules."""
    asyncio.run(_resolve(True, number, note, project_key, graph_ref, user_ref))


@proposals_cmd.command("reject")
@click.argument("number", type=int)
@click.option("--note", default="")
@_project_option
@graph_options
def proposals_reject(number: int, note: str, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Reject proposal NUMBER, with a note."""
    asyncio.run(_resolve(False, number, note, project_key, graph_ref, user_ref))


# ── reports ──────────────────────────────────────────────────────────────────


@click.group("reports")
def reports_cmd() -> None:
    """A project's report — generate, publish, export."""


@reports_cmd.command("generate")
@_project_option
@graph_options
def reports_generate(project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Draw the draft from the records and print it."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            read = await _reports.generate(session, project=project, actor=actor)
        click.echo(read.draft)

    asyncio.run(go())


@reports_cmd.command("publish")
@_project_option
@graph_options
def reports_publish(project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Freeze the draft as the next version."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            version = await _reports.publish(session, project=project, actor=actor)
            line = f"published\tv{version.version}\t{len(version.cites)} dataset versions cited"
        click.echo(line)

    asyncio.run(go())


@reports_cmd.command("export")
@click.argument("version", type=int)
@click.option("--format", "fmt", type=click.Choice(["md"]), default="md", help="Markdown; PDF is Studio's print.")
@_project_option
@graph_options
def reports_export(version: int, fmt: str, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """Print VERSION as Markdown, with the retraction notice when one applies."""

    async def go() -> None:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            read = await _reports.version(session, project=project, number=version)
        if read.retracted:
            click.echo(f"> Cites retracted data: {', '.join(read.retracted)}.\n")
        click.echo(read.body)

    asyncio.run(go())
