"""JanusGraph connector — a driver's worth of difference, and no more.

Two things JanusGraph does not share with the rest of the Gremlin family, and
both are about **identity**:

1. Its edge id is a ``RelationIdentifier``, its own type. GraphBinary cannot
   carry a type the client does not know — the whole response fails to decode
   with ``KeyError: <DataType.custom: 0>``, for any element that has properties.
   So this connector speaks **GraphSON**, which passes an unknown ``@type``
   through as a plain map for the serializer to read
   (docs/for-developers/modules/graph-connectors/features/languages.md LG9).
2. Its vertex id is a **long**. An id that made the round trip as a string has to
   become one again before it can address anything.

Everything else — reading, writing, schema, filters, the script path — is
inherited from the language connector and overridden nowhere
(docs/for-developers/modules/graph-connectors/spec.md CN2).
"""

from __future__ import annotations

from typing import Any

from gremlin_python.driver.serializer import GraphSONSerializersV3d0
from invana.graph.connectors.base.serializers import BaseSerializer
from invana.graph.connectors.gremlin.connector import GREMLIN_PROFILE, GremlinConnector
from invana.graph.types.capabilities import Version

from invana_janusgraph.serializers import JanusGraphSerializer

# JanusGraph tracks TinkerPop rather than versioning its Gremlin dialect
# separately, so ``detect_version()`` reports the TinkerPop version the server
# bundles and the window is keyed on that.
JANUSGRAPH_PROFILE = GREMLIN_PROFILE.merge(
    min_version=Version(3, 5),
    tested_max=Version(3, 7),
)


class JanusGraphConnector(GremlinConnector):
    """Gremlin, speaking GraphSON and reading JanusGraph's own ids."""

    _capability_profile = JANUSGRAPH_PROFILE

    def _create_serializer(self) -> BaseSerializer:
        return JanusGraphSerializer()

    def message_serializer(self) -> Any:
        """GraphSON, because GraphBinary cannot carry a ``RelationIdentifier``."""
        return GraphSONSerializersV3d0()

    def coerce_id(self, id_value: str) -> Any:
        """A vertex id back to the long JanusGraph stores it as.

        An edge id is a ``RelationIdentifier`` string — ``4465-7n54-m51-7ahs`` —
        which JanusGraph takes as-is, and which is not a number. So the rule is
        the shape of the value, not the kind of element: digits are a vertex,
        anything else already addresses what it names.
        """
        text = str(id_value)
        return int(text) if text.lstrip("-").isdigit() else id_value
