"""Every SQLAlchemy query behind the modeller, one file per model.

Was a single 42-method ``ModelStore`` over eleven models (migration-plan §12.2).
``ModelStore`` survives as a façade so the call sites migrate gradually.
"""

from invana.apps.modeller.querysets.base import VersionScopedQuerySet
from invana.apps.modeller.querysets.constraint import ConstraintQuerySet
from invana.apps.modeller.querysets.edge_type import EdgeTypeQuerySet
from invana.apps.modeller.querysets.graph_model import GraphModelQuerySet
from invana.apps.modeller.querysets.graph_version import GraphVersionQuerySet
from invana.apps.modeller.querysets.index import IndexQuerySet
from invana.apps.modeller.querysets.node_type import NodeTypeQuerySet
from invana.apps.modeller.querysets.property_key import PropertyKeyQuerySet
from invana.apps.modeller.querysets.schema_projection import SchemaProjectionQuerySet

__all__ = [
    "ConstraintQuerySet",
    "EdgeTypeQuerySet",
    "GraphModelQuerySet",
    "GraphVersionQuerySet",
    "IndexQuerySet",
    "NodeTypeQuerySet",
    "PropertyKeyQuerySet",
    "SchemaProjectionQuerySet",
    "VersionScopedQuerySet",
]
