"""`invana simulate · simulations` — run a simulator on a branch from a terminal.

docs/for-developers/modules/work/features/simulation.md. The same path the API
takes: ``SimulationManager.simulate`` checks the spec, pins every input dataset
version and opens a run of the simulator's packaged flow; the CLI then works
that run in-process and prints the ranked result read back off it::

    invana simulate --project flowering-time --branch 2 --plugin genomic \\
        --file spec.json --input ada/accessions@3 --input ada/trials@1 [--seed 7] --graph ada/arabidopsis
    invana simulations list --project flowering-time [--branch 2] --graph ada/arabidopsis
    invana simulations show 1 --project flowering-time --graph ada/arabidopsis

``--plugin`` takes a simulator key, ``key@version`` or its plugin's short name.
A refusal — an unknown simulator, a spec field missing or unknown, a retracted
input, a closed branch — exits 1 with the API's sentence; so does a run that
fails, with the step's own reason.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click

from invana.apps.work.managers import BranchManager, ProjectManager
from invana.apps.work.schemas import SimulationCreate, SimulationRead
from invana.cli.context import graph_options, on_graph, with_runtime
from invana.runtime.managers import SimulationManager

_projects = ProjectManager()
_branches = BranchManager()
_simulations = SimulationManager()


async def _project(session, graph, actor, key: str):
    return await _projects.get_by_key(session, key=key, graph_id=graph.id, reader_id=actor.id)


def _ranked(read: SimulationRead) -> None:
    """The ranked crosses, one line each: the cross, the share of progeny meeting every target, each trait."""
    if read.result is None:
        return
    for row in read.result.ranked:
        traits = "  ".join(
            f"{name} {t['mean']:.2f} sd {t['sd']:.2f} meets {t['meets']:.0%}"
            for name, t in (row.get("traits") or {}).items()
        )
        click.echo(f"{row['cross']}\tmeets all {row['meets_all']:.0%}\t{traits}")


@click.command("simulate")
@click.option("--project", "project_key", required=True, help="The project's key.")
@click.option("--branch", "branch_number", required=True, type=int, help="The branch to simulate on.")
@click.option("--plugin", "simulator", required=True, help="Simulator key, key@version or plugin short name.")
@click.option("--file", "spec_file", required=True, type=click.Path(exists=True, dir_okay=False), help="Spec JSON.")
@click.option("--input", "inputs", multiple=True, help="publisher/name@v of a dataset version it reads.")
@click.option("--seed", type=int, default=None, help="Fix the seed; the same seed reproduces the result.")
@click.option("--json", "as_json", is_flag=True, help="Print the simulation as JSON.")
@graph_options
def simulate_cmd(
    project_key: str,
    branch_number: int,
    simulator: str,
    spec_file: str,
    inputs: tuple[str, ...],
    seed: int | None,
    as_json: bool,
    graph_ref: str,
    user_ref: str | None,
) -> None:
    """Run a simulator on a branch, wait for its run, and print the ranked result."""
    try:
        spec = json.loads(Path(spec_file).read_text())
    except json.JSONDecodeError as exc:
        raise click.UsageError(f"{spec_file} is not JSON: {exc}") from exc
    if not isinstance(spec, dict):
        raise click.UsageError(f"{spec_file} must hold one JSON object of spec fields.")
    payload = SimulationCreate(simulator=simulator, spec=spec, inputs=list(inputs), seed=seed)

    async def go() -> SimulationRead:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            branch = await _branches.get(session, project=project, number=branch_number)
            row, run = await _simulations.simulate(
                session, graph=graph, project=project, branch=branch, payload=payload, actor=actor
            )
            number, run_id = row.number, run.id
        click.echo(f"simulation {number}\trun {run_id}", err=True)
        async with with_runtime() as runtime:
            await runtime.run_inline(run_id)
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            return await _simulations.read(session, await _simulations.get(session, project=project, number=number))

    read = asyncio.run(go())
    if as_json:
        click.echo(json.dumps(read.model_dump(mode="json"), indent=2))
    else:
        _ranked(read)
    if read.status != "succeeded":
        raise click.ClickException(read.error or f"The simulation {read.status}. Open run {read.run_id}.")


@click.group("simulations")
def simulations_cmd() -> None:
    """A project's simulations — list, show."""


@simulations_cmd.command("list")
@click.option("--project", "project_key", required=True, help="The project's key.")
@click.option("--branch", "branch_number", type=int, default=None, help="Narrow to one branch.")
@graph_options
def simulations_list(project_key: str, branch_number: int | None, graph_ref: str, user_ref: str | None) -> None:
    """Every simulation in a project, newest first."""

    async def go() -> list[SimulationRead]:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            on = await _branches.get(session, project=project, number=branch_number) if branch_number else None
            return await _simulations.list(session, project=project, branch=on)

    for r in asyncio.run(go()):
        click.echo(f"{r.number}\tbranch {r.branch}\t{r.simulator.key}@{r.simulator.version}\t{r.status}\tseed {r.seed}")


@simulations_cmd.command("show")
@click.argument("number", type=int)
@click.option("--project", "project_key", required=True, help="The project's key.")
@graph_options
def simulations_show(number: int, project_key: str, graph_ref: str, user_ref: str | None) -> None:
    """One simulation — its spec, pinned inputs, seed, run and result — as JSON."""

    async def go() -> SimulationRead:
        async with on_graph(graph_ref, user_ref) as (session, graph, actor):
            project = await _project(session, graph, actor, project_key)
            return await _simulations.read(session, await _simulations.get(session, project=project, number=number))

    click.echo(json.dumps(asyncio.run(go()).model_dump(mode="json"), indent=2))
