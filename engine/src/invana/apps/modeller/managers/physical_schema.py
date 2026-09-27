"""What the database holds, marked against the models (the-model-page.md MP9 · MP26 · MP27 · MP28).

The rows are the mirror's — the introspected model's active version, refreshed
only by ``Introspect`` — and each one is marked against every authored model's
active version: declared and present is ``in_both``, declared and absent is
``model_only``, present and declared by nothing is ``database_only``. The counts
are the only live read.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from invana.apps.modeller.querysets.graph_model import GraphModelQuerySet
from invana.apps.modeller.querysets.graph_version import GraphVersionQuerySet
from invana.apps.modeller.querysets.type_count_snapshot import TypeCountSnapshotQuerySet
from invana.apps.modeller.schemas import PhysicalRule, PhysicalSchema, PhysicalType
from invana.apps.modeller.solve import ANCHOR_EDGE
from invana.core.errors import NotFoundError
from invana.graph.connectors.base.exceptions import ConnectorError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import GraphVersion
    from invana.graph.connectors.base.connector import BaseConnector


def _drift(declared: bool, present: bool):
    return "in_both" if declared and present else "model_only" if declared else "database_only"


def _index_key(label: str, properties: list[str]) -> tuple:
    return (label, tuple(properties))


def _constraint_key(label: str, properties: list[str], kind: str) -> tuple:
    # Neo4j reports a relationship's uniqueness as `unique`; a model says
    # `relationship_unique`. Both cover the same thing (MP27).
    return (label, tuple(properties), kind.removeprefix("relationship_"))


class PhysicalSchemaManager:
    def __init__(self) -> None:
        self._models = GraphModelQuerySet()
        self._versions = GraphVersionQuerySet()

    async def read(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        connector: BaseConnector | None,
        model_id: str | None = None,
    ) -> PhysicalSchema:
        authored = [
            m
            for m in await self._models.list_graph_models(session, graph_id)
            if m.origin != "introspected" and m.status != "archived"
        ]
        if model_id is not None and not any(m.id == model_id for m in authored):
            raise NotFoundError("Model not found.")

        declared: list[tuple[str, str, GraphVersion]] = []
        for m in authored:
            version = await self._versions.get_active_version(session, m.id)
            if version is not None:
                declared.append((m.id, m.name, version))

        in_scope = [v for mid, _, v in declared if model_id in (None, mid)]
        said = {
            "declared_indexes": len({_index_key(i.target_label, i.properties) for v in in_scope for i in v.indexes}),
            "declared_constraints": len(
                {
                    _constraint_key(c.target_label, c.properties, c.constraint_type)
                    for v in in_scope
                    for c in v.constraints
                }
            ),
        }

        mirror_model = await self._models.get_introspected_model(session, graph_id)
        mirror = await self._versions.get_active_version(session, mirror_model.id) if mirror_model else None
        lists_schema = bool(connector is not None and connector.schema_reader.lists_schema)
        name = type(connector).__name__.removesuffix("Connector") if connector is not None else None
        if mirror is None:
            return PhysicalSchema(captured_at=None, connector=name, lists_schema=lists_schema, **said)

        node_counts, edge_counts = None, None
        if connector is not None:
            try:
                node_counts, edge_counts = await connector.schema_reader.count_types()
            except ConnectorError:
                # A database that will not count still has a mirror to read (MP25).
                node_counts, edge_counts = None, None

        def by(key_of) -> dict[str, list[str]]:
            out: dict = {}
            for _, model_name, version in declared:
                for key in key_of(version):
                    out.setdefault(key, [])
                    if model_name not in out[key]:
                        out[key].append(model_name)
            return out

        node_models = by(lambda v: [t.name for t in v.node_types])
        edge_models = by(lambda v: [t.name for t in v.edge_types])
        # A stitch declares the edge type it writes, named by its two models (MP29).
        for link, source, target in await self._models.active_stitches(session, graph_id):
            edge = link.edge_type or ANCHOR_EDGE
            stitch = f"{source} ⇄ {target}"
            if stitch not in edge_models.setdefault(edge, []):
                edge_models[edge].append(stitch)

        def types(present: list[str], models: dict, counts: dict[str, int] | None) -> list[PhysicalType]:
            return _sorted(
                [
                    PhysicalType(
                        name=t,
                        models=models.get(t, []),
                        count=counts.get(t, 0) if counts is not None else None,
                        drift=_drift(t in models, t in present),
                    )
                    for t in dict.fromkeys([*present, *models])
                ]
            )

        labels = types([t.name for t in mirror.node_types], node_models, node_counts)
        rels = types([t.name for t in mirror.edge_types], edge_models, edge_counts)

        indexes: list[PhysicalRule] = []
        constraints: list[PhysicalRule] = []
        if lists_schema:

            def index_rule(i) -> tuple[tuple, PhysicalRule]:
                rule = PhysicalRule(
                    name=i.name, label=i.target_label, properties=list(i.properties), type=i.index_type, drift="in_both"
                )
                return _index_key(i.target_label, i.properties), rule

            def constraint_rule(c) -> tuple[tuple, PhysicalRule]:
                rule = PhysicalRule(
                    name=c.name,
                    label=c.target_label,
                    properties=list(c.properties),
                    type=c.constraint_type,
                    drift="in_both",
                )
                return _constraint_key(c.target_label, c.properties, c.constraint_type), rule

            indexes = _rules(
                [index_rule(i) for i in mirror.indexes],
                [(n, index_rule(i)) for _, n, v in declared for i in v.indexes],
            )
            constraints = _rules(
                [constraint_rule(c) for c in mirror.constraints],
                [(n, constraint_rule(c)) for _, n, v in declared for c in v.constraints],
            )

        if model_id is not None:
            # One model: only what it declares; the unmodelled rows are All models' (MP2).
            scoped = next((n for mid, n, _ in declared if mid == model_id), None)
            keep = lambda r: scoped is not None and scoped in r.models  # noqa: E731
            labels = [r for r in labels if keep(r)]
            rels = [r for r in rels if keep(r)]
            indexes = [r for r in indexes if keep(r)]
            constraints = [r for r in constraints if keep(r)]

        captured_at = mirror.activated_at or mirror.created_at
        last_import = await TypeCountSnapshotQuerySet().last_at(session, graph_id, source="import")
        return PhysicalSchema(
            captured_at=captured_at,
            stale=last_import is not None and last_import > captured_at,
            connector=name,
            lists_schema=lists_schema,
            **said,
            labels=labels,
            relationship_types=rels,
            indexes=indexes,
            constraints=constraints,
        )


def _rules(
    present: list[tuple[tuple, PhysicalRule]], declared: list[tuple[str, tuple[tuple, PhysicalRule]]]
) -> list[PhysicalRule]:
    """The database's rules and every model's, one row per key they cover (MP27)."""
    rows: dict[tuple, PhysicalRule] = {key: rule.model_copy(update={"drift": "database_only"}) for key, rule in present}
    for model_name, (key, rule) in declared:
        row = rows.get(key)
        if row is None:
            row = rows[key] = rule.model_copy(update={"drift": "model_only"})
        elif row.drift == "database_only":
            row.drift = "in_both"
        if model_name not in row.models:
            row.models.append(model_name)
    return _sorted(list(rows.values()))


_ORDER = {"database_only": 0, "model_only": 1, "in_both": 2}


def _sorted(rows: list) -> list:
    """Unmodelled first, then what the model lacks, then what agrees (MP9)."""
    return sorted(rows, key=lambda r: (_ORDER[r.drift], r.name.lower()))
