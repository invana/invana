"""Simulate on a branch (docs/for-developers/modules/work/features/simulation.md).

A simulator plugin does the science; this manager does everything around it:
lists what is installed, checks a spec against the fields the simulator
declares, resolves and pins every input dataset version, opens the run that
walks the simulator's packaged flow, and reads the result back off that run.

Lives in ``runtime`` because it joins ``apps/work``, ``apps/datasets``, the
plugin registry and the run opener, and ``apps/`` may not import band 3.

**The caller commits and submits.** ``simulate`` leaves the run queued in the
request's transaction; the view commits and hands it to the runtime, the shape
a dataset bind already has.

Usage::

    sims = SimulationManager()
    row, run = await sims.simulate(session, graph=g, project=p, branch=b, payload=SimulationCreate(
        simulator="genomic", spec={...}, inputs=["ada/accessions@3"]), actor=user)
    await session.commit()
    runtime.submit(run.id)
    read = await sims.read(session, row)      # status, and the ranked result once it succeeded

Refusals, all before a run opens: an unknown simulator, a spec field missing,
mistyped or unknown, and an input that does not resolve are 422; a retracted
input, a dropped or merged branch and an archived project are 409.
"""

from __future__ import annotations

import secrets
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import DatasetManager
from invana.apps.graphs.models import Graph
from invana.apps.work.managers import ProjectManager
from invana.apps.work.models import CLOSED_BRANCH_STATUSES, Project, ProjectBranch, ProjectSimulation
from invana.apps.work.querysets import ProjectBranchQuerySet, ProjectSimulationQuerySet
from invana.apps.work.schemas import (
    SimulationCreate,
    SimulationInput,
    SimulationRead,
    SimulationResult,
    SimulatorRead,
    SimulatorRef,
    SpecFieldRead,
)
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.plugins import load_plugins
from invana.plugins.registry import Simulator
from invana.plugins.sdk.manifest import Type
from invana.runtime.models import RunStatus, TaskRun
from invana.runtime.querysets.task_run import TaskRunQuerySet

#: What a spec value must be for each declared type. ``bool`` is not an ``int`` here.
_PYTHON: dict[Type, tuple[type, ...]] = {
    Type.str_: (str,),
    Type.int_: (int,),
    Type.float_: (int, float),
    Type.bool_: (bool,),
    Type.list_: (list,),
    Type.obj: (dict,),
}

#: The largest seed Invana picks — any seed a caller gives up to 2**53 is kept as given.
_SEED_SPACE = 2**31


def _typed(value: Any, wanted: Type) -> bool:
    if isinstance(value, bool) and wanted is not Type.bool_:
        return False
    return isinstance(value, _PYTHON[wanted])


class SimulationManager:
    """Stateless. The session is the first argument of every method."""

    projects = ProjectManager()
    datasets = DatasetManager()
    simulations_qs = ProjectSimulationQuerySet()
    branches_qs = ProjectBranchQuerySet()
    runs_qs = TaskRunQuerySet()

    # ── the installed simulators ─────────────────────────────────────────────

    def simulators(self) -> list[SimulatorRead]:
        return [self._simulator_read(s) for s in load_plugins().simulators.values()]

    @staticmethod
    def _simulator_read(sim: Simulator) -> SimulatorRead:
        return SimulatorRead(
            key=sim.key,
            version=sim.task.version,
            plugin=sim.plugin.name,
            plugin_version=sim.plugin.version,
            handle=sim.handle,
            title=sim.plugin.title or sim.key,
            summary=sim.task.summary,
            spec=[
                SpecFieldRead(name=name, type=str(f.type), required=f.required, default=f.default, label=f.label)
                for name, f in sim.task.spec.items()
            ],
        )

    def resolve(self, ref: str) -> Simulator:
        sim = load_plugins().simulator(ref)
        if sim is None:
            installed = ", ".join(f"{s.key}@{s.task.version}" for s in load_plugins().simulators.values()) or "none"
            raise ValidationError(f"No simulator {ref!r} is installed. Installed: {installed}.")
        return sim

    # ── simulating ───────────────────────────────────────────────────────────

    def check_spec(self, sim: Simulator, spec: dict[str, Any]) -> dict[str, Any]:
        """The spec as it will run: every declared field present and typed, defaults filled."""
        declared = sim.task.spec
        unknown = sorted(set(spec) - set(declared))
        if unknown:
            raise ValidationError(
                f"{', '.join(unknown)} {'is' if len(unknown) == 1 else 'are'} not a field of {sim.key}. "
                f"Fields: {', '.join(declared)}."
            )
        out: dict[str, Any] = {}
        for name, f in declared.items():
            if name not in spec or spec[name] is None:
                if f.required:
                    raise ValidationError(f"{sim.key} needs `{name}` ({f.label or f.type}).")
                if f.default is not None:
                    out[name] = f.default
                continue
            if not _typed(spec[name], f.type):
                raise ValidationError(f"`{name}` is a {f.type} — not {type(spec[name]).__name__}.")
            out[name] = spec[name]
        return out

    async def pin_inputs(self, session: AsyncSession, *, refs: list[str], reader: User) -> list[dict[str, str]]:
        """Each ``publisher/name@v`` resolved, readable by the reader and not retracted, as a pin."""
        pins: list[dict[str, str]] = []
        for ref in refs:
            try:
                dataset, number = await self.datasets.get_by_ref(session, ref=ref, reader=reader)
                if number is None:
                    raise ValidationError(f"Input {ref!r} names no version — use publisher/name@v.")
                version = await self.datasets.get_version(session, dataset=dataset, version=number)
            except NotFoundError as exc:
                raise ValidationError(f"Input {ref!r} does not resolve: {exc}") from exc
            if version.retracted_at is not None:
                raise ConflictError(f"retracted — {dataset.address}@{number} was withdrawn and cannot be simulated on.")
            if version.state == "draft":
                raise ConflictError(
                    f"draft — {dataset.address}@{number} is not published yet and cannot be simulated on."
                )
            pin = {
                "ref": f"{dataset.address}@{version.version}",
                "dataset_id": dataset.id,
                "version_id": version.id,
                "content_hash": version.content_hash,
            }
            if pin["version_id"] in {p["version_id"] for p in pins}:
                raise ValidationError(f"Input {pin['ref']} is named twice.")
            pins.append(pin)
        return pins

    async def simulate(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        project: Project,
        branch: ProjectBranch,
        payload: SimulationCreate,
        actor: User,
    ) -> tuple[ProjectSimulation, TaskRun]:
        """Check, pin, record and open the run — left queued for the caller to commit and submit."""
        from invana.runtime.services import open_simulation_run  # noqa: PLC0415 — services imports the managers

        self.projects.require_writable(project)
        if branch.status in CLOSED_BRANCH_STATUSES:
            raise ConflictError(f"Branch {branch.number} is {branch.status}; simulate on an open branch.")
        sim = self.resolve(payload.simulator)
        spec = self.check_spec(sim, payload.spec)
        pins = await self.pin_inputs(session, refs=payload.inputs, reader=actor)
        seed = payload.seed if payload.seed is not None else secrets.randbelow(_SEED_SPACE)

        number = await self.simulations_qs.next_number(session, project_id=project.id)
        run = await open_simulation_run(
            session,
            graph=graph,
            flow_key=sim.flow.key,
            body=f"{sim.plugin.title or sim.key} on {project.key} · branch {branch.number}",
            args={"spec": spec, "inputs": pins, "seed": seed},
            params={"project_id": project.id, "branch": branch.number, "simulation": number},
            actor_id=actor.id,
        )
        row = await self.simulations_qs.add(
            session,
            ProjectSimulation(
                project_id=project.id,
                branch_id=branch.id,
                number=number,
                simulator=sim.key,
                simulator_version=sim.task.version,
                plugin=sim.plugin.name,
                plugin_version=sim.plugin.version,
                spec=spec,
                seed=seed,
                inputs=pins,
                run_id=run.id,
                created_by_id=actor.id,
            ),
        )
        await emit_event(
            session,
            action=actions.SIMULATION_RUN,
            target_kind=actions.TARGET_PROJECT,
            target_id=project.id,
            graph_id=graph.id,
            project_id=project.id,
            run_id=run.id,
            actor_id=actor.id,
            details={
                "key": project.key,
                "branch": branch.number,
                "simulation": number,
                "simulator": f"{sim.key}@{sim.task.version}",
                "inputs": [p["ref"] for p in pins],
            },
        )
        return row, run

    # ── reading ──────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, project: Project, number: int) -> ProjectSimulation:
        row = await self.simulations_qs.get_by_number(session, project_id=project.id, number=number)
        if row is None:
            raise NotFoundError(f"Simulation {number} not found in '{project.key}'.")
        return row

    async def list(
        self, session: AsyncSession, *, project: Project, branch: ProjectBranch | None = None
    ) -> list[SimulationRead]:
        rows = await self.simulations_qs.list_for_project(
            session, project_id=project.id, branch_id=branch.id if branch is not None else None
        )
        return [await self.read(session, row) for row in rows]

    async def read(self, session: AsyncSession, row: ProjectSimulation) -> SimulationRead:
        """The record, its run's status and tokens, and the result once the run succeeded."""
        numbers = await self.branches_qs.numbers_by_ids(session, [row.branch_id])
        installed = load_plugins().simulators.get(row.simulator)
        read = SimulationRead(
            number=row.number,
            branch=numbers.get(row.branch_id, 0),
            simulator=SimulatorRef(
                key=row.simulator,
                version=row.simulator_version,
                plugin=row.plugin,
                plugin_version=row.plugin_version,
                title=(installed.plugin.title if installed is not None else "") or row.simulator,
            ),
            spec=row.spec,
            seed=row.seed,
            inputs=[SimulationInput(**pin) for pin in row.inputs],
            run_id=row.run_id,
            status=None,
            created_by_id=row.created_by_id,
            created_at=row.created_at,
        )
        run = await self.runs_qs.get(session, row.run_id) if row.run_id else None
        if run is None:
            return read
        nodes = await self.runs_qs.nodes_of(session, run_id=run.id)
        step = next((n for n in nodes if n.task_key == row.simulator), None)
        read.status, read.outcome = run.status, run.outcome
        read.started_at, read.finished_at = run.started_at, run.finished_at
        read.duration_ms = run.duration_ms
        read.tokens = sum((r.tokens_in or 0) + (r.tokens_out or 0) for r in (run, *nodes))
        failed = (step.error if step is not None else None) or run.error
        if run.status != RunStatus.succeeded.value and failed:
            read.error = failed.get("message")
        out = (step.output or {}) if step is not None else {}
        if run.status == RunStatus.succeeded.value and "ranked" in out:
            read.result = SimulationResult(ranked=out["ranked"], summary=out.get("summary") or {})
        return read
