"""JanusGraph result serialization — reading JanusGraph's own id type.

JanusGraph identifies an **edge** with a ``RelationIdentifier``, a type of its
own rather than a primitive. Over GraphSON it arrives as a tagged map::

    {"@type": "janusgraph:RelationIdentifier",
     "@value": {"relationId": "4465-7n54-m51-7ahs"}}

gremlinpython has no deserializer registered for that tag, so it hands the map
through untouched. This serializer reads the ``relationId`` out of it, which is
the string JanusGraph accepts back in ``g.E(...)`` — so an edge read here can be
re-addressed later.

A **vertex** id is a plain long and needs none of this.
"""

from __future__ import annotations

from typing import Any

from invana.graph.connectors.gremlin.serializers import GremlinSerializer

RELATION_IDENTIFIER = "janusgraph:RelationIdentifier"


def relation_id(value: Any) -> Any:
    """The ``relationId`` inside a RelationIdentifier map, or *value* unchanged."""
    if isinstance(value, dict) and value.get("@type") == RELATION_IDENTIFIER:
        inner = value.get("@value") or {}
        return inner.get("relationId", value)
    return value


class JanusGraphSerializer(GremlinSerializer):
    """The Gremlin serializer, with JanusGraph's edge id unwrapped.

    One method, because the base routes every element id through one funnel.
    """

    def coerce_element_id(self, value: Any) -> Any:
        return relation_id(value)
