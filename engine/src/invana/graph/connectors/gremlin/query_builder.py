"""Gremlin query builder — generates Gremlin traversal bytecode.

All methods return (traversal_func, params) tuples where traversal_func
is a callable that takes a graph traversal source `g` and returns a traversal.
"""

from __future__ import annotations

from typing import Any

from gremlin_python.process.graph_traversal import GraphTraversalSource, __
from gremlin_python.process.traversal import P, TextP

from invana.graph.connectors.base.data_types.filter_types import FilterOp
from invana.graph.connectors.base.data_types.filters import FilterExpression, FilterGroup, LogicalOp


def _project_edge(traversal: Any) -> Any:
    """Project edge data using primitive steps (avoids elementMap on edges).

    Returns a dict with keys: eid, elabel, eprops, source (elementMap), target (elementMap).
    """
    return (
        traversal.project("eid", "elabel", "eprops", "source", "target")
        .by(__.id_())
        .by(__.label())
        .by(__.value_map())
        .by(__.out_v().element_map())
        .by(__.in_v().element_map())
    )


def _apply_filters(traversal: Any, filters: FilterGroup | None, element_var: str = "") -> Any:
    """Apply a FilterGroup to a Gremlin traversal using has/and/or steps."""
    if not filters or not filters.conditions:
        return traversal

    predicate = _build_predicate(filters)
    if predicate is not None:
        traversal = traversal.where(predicate)
    return traversal


def _build_predicate(group: FilterGroup) -> Any:
    """Recursively build a Gremlin anonymous traversal predicate from a FilterGroup."""
    parts = []
    for condition in group.conditions:
        if isinstance(condition, FilterGroup):
            sub = _build_predicate(condition)
            if sub is not None:
                parts.append(sub)
        elif isinstance(condition, FilterExpression):
            part = _build_expression_traversal(condition)
            if part is not None:
                parts.append(part)

    if not parts:
        return None

    if len(parts) == 1:
        return parts[0]

    if group.operator == LogicalOp.AND:
        result = parts[0]
        for p in parts[1:]:
            result = __.and_(result, p)
        return result
    else:
        result = parts[0]
        for p in parts[1:]:
            result = __.or_(result, p)
        return result


_FILTER_OP_MAP: dict[FilterOp, Any] = {
    FilterOp.EQ: P.eq,
    FilterOp.NEQ: P.neq,
    FilterOp.GT: P.gt,
    FilterOp.GTE: P.gte,
    FilterOp.LT: P.lt,
    FilterOp.LTE: P.lte,
    FilterOp.IN: P.within,
    FilterOp.NOT_IN: P.without,
}


def _build_expression_traversal(expr: FilterExpression) -> Any:
    """Build an anonymous traversal for a single FilterExpression."""
    if expr.op in _FILTER_OP_MAP:
        predicate_fn = _FILTER_OP_MAP[expr.op]
        if expr.op == FilterOp.IN or expr.op == FilterOp.NOT_IN:
            return __.has(expr.property, predicate_fn(*expr.value))
        return __.has(expr.property, predicate_fn(expr.value))

    if expr.op == FilterOp.CONTAINS:
        return __.has(expr.property, TextP.containing(expr.value))

    if expr.op == FilterOp.STARTS_WITH:
        return __.has(expr.property, TextP.starting_with(expr.value))

    if expr.op == FilterOp.ENDS_WITH:
        return __.has(expr.property, TextP.ending_with(expr.value))

    if expr.op == FilterOp.IS_NULL:
        return __.has_not(expr.property)

    if expr.op == FilterOp.IS_NOT_NULL:
        return __.has(expr.property)

    return None


class GremlinQueryBuilder:
    """Builds Gremlin traversals. All methods are static and work with a GraphTraversalSource."""

    @staticmethod
    def match_vertices(
        g: GraphTraversalSource,
        label: str,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Any:
        """Build a traversal to match vertices by label."""
        t = g.V().has_label(label)
        t = _apply_filters(t, filters)
        if offset is not None:
            t = t.skip(offset)
        if limit is not None:
            t = t.limit(limit)
        t = t.element_map()
        return t

    @staticmethod
    def match_edges(
        g: GraphTraversalSource,
        label: str,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> Any:
        """Build a traversal to match edges by label."""
        t = g.E().has_label(label)
        if source_label:
            t = t.where(__.out_v().has_label(source_label))
        if target_label:
            t = t.where(__.in_v().has_label(target_label))
        t = _apply_filters(t, filters)
        if limit is not None:
            t = t.limit(limit)
        t = _project_edge(t)
        return t

    @staticmethod
    def match_vertex_by_id(g: GraphTraversalSource, vertex_id: Any) -> Any:
        """Build a traversal to match a vertex by ID."""
        return g.V(vertex_id).element_map()

    @staticmethod
    def match_edge_by_id(g: GraphTraversalSource, edge_id: Any) -> Any:
        """Build a traversal to match an edge by ID."""
        return _project_edge(g.E(edge_id))

    @staticmethod
    def match_neighbors(
        g: GraphTraversalSource,
        vertex_id: Any,
        direction: str = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> Any:
        """Build a traversal for neighborhood exploration."""
        t = g.V(vertex_id)
        if direction == "out":
            t = t.out_e(edge_label) if edge_label else t.out_e()
        elif direction == "in":
            t = t.in_e(edge_label) if edge_label else t.in_e()
        else:
            t = t.both_e(edge_label) if edge_label else t.both_e()

        if limit is not None:
            t = t.limit(limit)

        t = _project_edge(t)
        return t

    @staticmethod
    def create_vertex(g: GraphTraversalSource, label: str, properties: dict) -> Any:
        """Build a traversal to create a vertex."""
        t = g.add_v(label)
        for key, value in properties.items():
            t = t.property(key, value)
        t = t.element_map()
        return t

    @staticmethod
    def create_edge(
        g: GraphTraversalSource,
        label: str,
        source_id: Any,
        target_id: Any,
        properties: dict | None = None,
    ) -> Any:
        """Build a traversal to create an edge."""
        t = g.V(source_id).add_e(label).to(__.V(target_id))
        if properties:
            for key, value in properties.items():
                t = t.property(key, value)
        t = _project_edge(t)
        return t

    @staticmethod
    def update_vertex(g: GraphTraversalSource, vertex_id: Any, properties: dict) -> Any:
        """Build a traversal to update vertex properties."""
        t = g.V(vertex_id)
        for key, value in properties.items():
            t = t.property(key, value)
        t = t.element_map()
        return t

    @staticmethod
    def update_edge(g: GraphTraversalSource, edge_id: Any, properties: dict) -> Any:
        """Build a traversal to update edge properties."""
        t = g.E(edge_id)
        for key, value in properties.items():
            t = t.property(key, value)
        t = _project_edge(t)
        return t

    @staticmethod
    def delete_vertex(g: GraphTraversalSource, vertex_id: Any) -> Any:
        """Delete a vertex and its connected edges."""
        return g.V(vertex_id).drop()

    @staticmethod
    def delete_edge(g: GraphTraversalSource, edge_id: Any) -> Any:
        """Delete a single edge."""
        return g.E(edge_id).drop()

    @staticmethod
    def count_vertices(g: GraphTraversalSource, label: str | None = None) -> Any:
        """Count vertices, optionally by label."""
        if label:
            return g.V().has_label(label).count()
        return g.V().count()

    @staticmethod
    def count_edges(g: GraphTraversalSource, label: str | None = None) -> Any:
        """Count edges, optionally by label."""
        if label:
            return g.E().has_label(label).count()
        return g.E().count()

    @staticmethod
    def shortest_path(
        g: GraphTraversalSource,
        source_id: Any,
        target_id: Any,
        max_depth: int = 10,
    ) -> Any:
        """Find shortest path between two vertices."""
        return (
            g.V(source_id)
            .repeat(__.both().simple_path())
            .until(__.has_id(target_id).or_().loops().is_(P.gte(max_depth)))
            .has_id(target_id)
            .path()
            .limit(1)
        )

    @staticmethod
    def get_node_labels(g: GraphTraversalSource) -> Any:
        """Get all vertex labels."""
        return g.V().label().dedup()

    @staticmethod
    def get_edge_labels(g: GraphTraversalSource) -> Any:
        """Get all edge labels."""
        return g.E().label().dedup()

    @staticmethod
    def get_property_keys(g: GraphTraversalSource, label: str) -> Any:
        """Get property keys for a given vertex label."""
        return g.V().has_label(label).properties().key().dedup()
