"""Bind a dataset version into a Graph's model
(docs/for-developers/modules/bring-data-in/features/bind-a-dataset.md).

A dataset lives above Graphs; a Graph takes **one exact version** of it into
one of its models as one node type. The bind is not a second loader: the
version's records are written once as a load folder, content-addressed under
``settings.dataset_dir``, and the ordinary import run is opened over it — so
validation, provenance, stitching and the trace are the load's own.

Lives in ``runtime`` because it joins ``apps/datasets``, ``apps/modeller`` and
the run opener, and ``apps/`` may not import the runtime.

**The caller commits and submits.** ``bind`` leaves the run queued in the
request's transaction; the view commits and hands it to the runtime, the shape
a skill draw and an eval run already have.

Usage::

    binds = DatasetBindManager()
    binding, run, warnings = await binds.bind(session, graph=g, ref="abrc/accessions@2", model_id=m.id,
                                              type_name="Accession", actor=user)
    await session.commit()
    runtime.submit(run.id)

Five refusals: a dataset the binder cannot read and a model not in this Graph
read as absent (404); a retracted version, a checked rule that blocks the bind,
and a load the prologue refuses (no published model version, no connection, a
read-only one), are 409. A rule that warns lets the bind through and its line
comes back in ``warnings``.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.models import Dataset, DatasetBinding, DatasetVersion
from invana.apps.datasets.querysets import DatasetBindingQuerySet, DatasetRecordQuerySet
from invana.apps.datasets.schemas import DatasetBindingRead
from invana.apps.graphs.models import Graph
from invana.apps.modeller.querysets import GraphModelQuerySet
from invana.apps.skills.checks import ACT_DATASET_BIND
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.settings import settings
from invana.plugins.core.ingest.records import LoadRefused
from invana.runtime.managers.rule_checks import RuleCheckManager
from invana.runtime.models import TaskRun
from invana.runtime.querysets.task_run import TaskRunQuerySet


class DatasetBindManager:
    """Stateless. The session is the first argument of every method."""

    datasets = DatasetManager()
    bindings_qs = DatasetBindingQuerySet()
    records_qs = DatasetRecordQuerySet()
    models_qs = GraphModelQuerySet()
    runs_qs = TaskRunQuerySet()
    checks = RuleCheckManager()

    async def list(self, session: AsyncSession, *, graph: Graph) -> list[DatasetBindingRead]:
        """The Graph's bindings, newest first, each flagged as it reads now."""
        return [
            await self.datasets.read_binding(session, b) for b in await self.bindings_qs.for_graph(session, graph.id)
        ]

    async def model_named(self, session: AsyncSession, *, graph: Graph, name: str) -> str:
        """The id of the Graph's model called *name* — the CLI names models, the API ids."""
        for model in await self.models_qs.list_graph_models(session, graph.id):
            if model.name.lower() == name.lower():
                return model.id
        raise NotFoundError(f"No model named {name!r} in this Graph.")

    async def run_status(self, session: AsyncSession, *, run_id: str) -> str | None:
        run = await self.runs_qs.get(session, run_id)
        return run.status if run is not None else None

    async def bind(
        self, session: AsyncSession, *, graph: Graph, ref: str, model_id: str, type_name: str, actor: User
    ) -> tuple[DatasetBinding, TaskRun, list[str]]:
        """Open the load of one version into one model as one node type, and
        record the binding — moving it when this dataset already feeds that type.
        The third item is what a ``warn`` rule said about the bind."""
        from invana.runtime.services import open_load_run  # noqa: PLC0415 — services imports the managers

        dataset, number = await self.datasets.get_by_ref(session, ref=ref, reader=actor)
        if number is None:
            raise ValidationError(f"{ref!r} names no version — bind publisher/name@v.")
        version = await self.datasets.get_version(session, dataset=dataset, version=number)
        if version.retracted_at is not None:
            raise ConflictError(f"retracted — {dataset.address}@{number} was withdrawn and cannot be bound.")
        if version.state == "draft":
            raise ConflictError(f"draft — {dataset.address}@{number} is not published yet and cannot be bound.")
        model = await self.models_qs.get_graph_model(session, model_id)
        if model is None or model.graph_id != graph.id:
            raise NotFoundError("Model not found.")
        type_name = type_name.strip()
        if not type_name or "/" in type_name or "`" in type_name or type_name.startswith("."):
            raise ValidationError(f"{type_name!r} is not a node type name.")
        warnings = await self.checks.enforce(
            session, act=ACT_DATASET_BIND, graph_id=graph.id, dataset=dataset, version=version, actor=actor
        )

        root = await self._materialise(session, dataset=dataset, version=version, type_name=type_name)
        try:
            run = await open_load_run(
                session,
                graph=graph,
                name=f"{dataset.address}@{number}",
                path=str(root),
                model_name=model.name,
                actor_id=actor.id,
            )
        except LoadRefused as exc:
            raise ConflictError(str(exc)) from exc

        binding = await self.bindings_qs.get_target(
            session, graph_id=graph.id, model_id=model.id, dataset_id=dataset.id, type_name=type_name
        )
        from_version = None
        if binding is None:
            binding = DatasetBinding(
                graph_id=graph.id,
                model_id=model.id,
                dataset_id=dataset.id,
                dataset_version_id=version.id,
                type_name=type_name,
            )
            await self.bindings_qs.add(session, binding)
        elif binding.dataset_version_id != version.id:
            moved_from = await self.datasets.versions_qs.get(session, binding.dataset_version_id)
            from_version = moved_from.version if moved_from is not None else None
            binding.dataset_version_id = version.id
        binding.run_id = run.id
        binding.bound_by_id = actor.id
        binding.bound_at = datetime.now(UTC)
        await session.flush()

        details = {
            "address": dataset.address,
            "version": number,
            "version_id": version.id,
            "model_id": model.id,
            "type_name": type_name,
            "run_id": run.id,
        }
        if from_version is not None:
            details["from_version"] = from_version
        await emit_event(
            session,
            action=actions.DATASET_BIND,
            target_kind=actions.TARGET_DATASET,
            target_id=dataset.id,
            graph_id=graph.id,
            actor_id=actor.id,
            details=details,
        )
        return binding, run, warnings

    async def _materialise(
        self, session: AsyncSession, *, dataset: Dataset, version: DatasetVersion, type_name: str
    ) -> Path:
        """Write the version's records as the load folder ``nodes/<Type>.json``,
        once per content hash and type, with the key as ``id``."""
        digest = version.content_hash.split(":", 1)[-1]
        root = Path(settings.dataset_dir).resolve() / digest / type_name
        target = root / "nodes" / f"{type_name}.json"
        if not target.is_file():
            rows = await self.records_qs.all_for_version(session, version.id)
            records = [{**r.values, "id": r.key} for r in rows]
            target.parent.mkdir(parents=True, exist_ok=True)
            partial = target.with_suffix(".json.partial")
            partial.write_text(json.dumps(records, ensure_ascii=False, default=str), encoding="utf-8")
            partial.replace(target)
        return root
