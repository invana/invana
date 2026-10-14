"""Simulation on a branch (docs/for-developers/modules/work/features/simulation.md),
against a real Postgres — the genomic simulator needs no graph database.

What is worth testing is the contract around the science: a spec is checked
against the fields the simulator declares, every input is pinned and a
retracted one refused before a run opens, the result is read off the run and
ranked, the same seed reproduces it, a parent the inputs do not state fails
the run with its reason, and a simulator plugin that breaks the contract does
not load.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest
import pytest_asyncio

from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.datasets.schemas import AuthorStep, DatasetCreate, DatasetVersionCreate
from invana.apps.standards.models import Standard  # noqa: F401
from invana.apps.work.managers import BranchManager, ProjectManager
from invana.apps.work.schemas import ProjectCreate, SimulationCreate
from invana.core.auth.models import User
from invana.core.errors import ConflictError, ValidationError
from invana.plugins.registry import SIMULATORS_DIR, PluginError, load_plugin
from invana.plugins.simulators.genomic.tasks.genomic_prediction.run import CROSS
from invana.runtime.interpreter import TaskRuntime
from invana.runtime.managers import SimulationManager

datasets = DatasetManager()
projects = ProjectManager()
branches = BranchManager()
sims = SimulationManager()

LAB = [AuthorStep(role="original", kind="organisation", name="Growth room")]
FLOWERING = [
    {"accession": "Col-0", "flowering_days": 28},
    {"accession": "Ler-1", "flowering_days": 33},
    {"accession": "Cvi-0", "flowering_days": 40},
]
HEIGHT = [
    {"accession": "Col-0", "height_cm": 30},
    {"accession": "Ler-1", "height_cm": 42},
    {"accession": "Cvi-0", "height_cm": 48},
]
SPEC = {
    "females": ["Col-0", "Ler-1"],
    "males": ["Cvi-0"],
    "targets": [
        {"trait": "flowering_days", "op": "<=", "value": 34},
        {"trait": "height_cm", "op": ">=", "value": 38},
    ],
    "progeny": 200,
}


async def _publish(session, user: User, name: str, records: list[dict]):
    dataset = await datasets.create(
        session,
        payload=DatasetCreate(publisher="lab", name=name, origin="official", key_column="accession"),
        actor=user,
    )
    payload = DatasetVersionCreate(licence="CC-BY-4.0", author_chain=LAB, records=records)
    return dataset, await datasets.publish_version(session, dataset=dataset, payload=payload, actor=user)


@pytest_asyncio.fixture
async def setup(session, graph, user):
    """A project, its first branch, and two published inputs."""
    project = await projects.create(
        session, graph_id=graph.id, payload=ProjectCreate(name="Early tall", type="research"), actor=user
    )
    branch = await branches.get(session, project=project, number=1)
    await _publish(session, user, "flowering", FLOWERING)
    await _publish(session, user, "height", HEIGHT)
    return project, branch


async def _simulate(session, session_factory, graph, user, project, branch, **payload):
    payload = {"simulator": "genomic", "spec": SPEC, "inputs": ["lab/flowering@1", "lab/height@1"]} | payload
    row, run = await sims.simulate(
        session, graph=graph, project=project, branch=branch, payload=SimulationCreate(**payload), actor=user
    )
    number, run_id = row.number, run.id
    await session.commit()
    await TaskRuntime(session_factory=session_factory, manager=object(), encryption_key="x").run_inline(run_id)
    async with session_factory() as fresh:
        return await sims.read(fresh, await sims.get(fresh, project=project, number=number))


async def test_simulate_ranks_the_crosses_and_the_seed_reproduces(session, session_factory, graph, user, setup):
    project, branch = setup
    assert [s.handle for s in sims.simulators()] == ["genomic"]

    read = await _simulate(session, session_factory, graph, user, project, branch, seed=7)
    assert read.status == "succeeded", read.error
    assert read.origin == "derived" and read.seed == 7
    assert [i.ref for i in read.inputs] == ["lab/flowering@1", "lab/height@1"]
    ranked = read.result.ranked
    assert {r["cross"] for r in ranked} == {f"Col-0 {CROSS} Cvi-0", f"Ler-1 {CROSS} Cvi-0"}
    assert [r["meets_all"] for r in ranked] == sorted((r["meets_all"] for r in ranked), reverse=True)

    again = await _simulate(session, session_factory, graph, user, project, branch, seed=7)
    assert again.number == read.number + 1
    assert again.result.ranked == ranked
    assert [s.number for s in await sims.list(session, project=project)] == [again.number, read.number]


async def test_refusals_before_a_run_opens_and_a_run_that_fails(session, session_factory, graph, user, setup):
    project, branch = setup

    async def refused(**payload):
        payload = {"simulator": "genomic", "spec": SPEC, "inputs": ["lab/flowering@1"]} | payload
        await sims.simulate(
            session, graph=graph, project=project, branch=branch, payload=SimulationCreate(**payload), actor=user
        )

    with pytest.raises(ValidationError, match="No simulator 'weather'"):
        await refused(simulator="weather")
    with pytest.raises(ValidationError, match="needs `targets`"):
        await refused(spec={k: v for k, v in SPEC.items() if k != "targets"})
    with pytest.raises(ValidationError, match="colour is not a field"):
        await refused(spec=SPEC | {"colour": "red"})

    admin = User(email="admin@example.com", username="admin", password_hash="x", first_name="A", is_superuser=True)
    session.add(admin)
    await session.flush()
    dataset, v1 = await _publish(session, user, "retracted", HEIGHT)
    await datasets.retract(session, dataset=dataset, version=v1, reason="mislabelled", actor=admin)
    with pytest.raises(ConflictError, match="retracted"):
        await refused(inputs=["lab/retracted@1"])

    # A parent no input states fails the run, by name — nothing is guessed.
    read = await _simulate(
        session, session_factory, graph, user, project, branch, spec=SPEC | {"males": ["Ws-2"]}, seed=1
    )
    assert read.status != "succeeded" and read.result is None
    assert read.error == "Ws-2 is in none of the inputs."


def test_a_simulator_that_breaks_the_contract_does_not_load(tmp_path: Path) -> None:
    folder = tmp_path / "genomic"
    shutil.copytree(SIMULATORS_DIR / "genomic", folder, ignore=shutil.ignore_patterns("__pycache__"))
    manifest = folder / "tasks" / "genomic_prediction" / "manifest.toml"
    manifest.write_text(manifest.read_text().replace('bound = "none"', 'bound = "llm"'))
    with pytest.raises(PluginError, match="must be bound 'none'"):
        load_plugin(folder, "invana.plugins.simulators.genomic")
