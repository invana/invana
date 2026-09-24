"""Gremlin query builder — generates Gremlin traversal bytecode.

All methods return (traversal_func, params) tuples where traversal_func
is a callable that takes a graph traversal source `g` and returns a traversal.
"""

from __future__ import annotations

from typing import Any

from gremlin_python.process.graph_traversal import GraphTraversalSource, __
from gremlin_python.process.traversal import Order, P, Pick, T, TextP

from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.types.lens import QueryLens, TypeBound
from invana.graph.types.sort import SortDirection, SortSpec


def _project_edge(traversal: Any, lens: QueryLens | None = None) -> Any:
    """Project edge data using primitive steps (avoids elementMap on edges).

    Returns a dict with keys: eid, elabel, eprops, source (elementMap), target (elementMap).
    Under a lens that excludes properties, each element returns only what its
    type permits (CC22) — chosen by label, in the traversal, never trimmed after.
    """
    narrowed = _narrowed(lens)
    return (
        traversal.project("eid", "elabel", "eprops", "source", "target")
        .by(__.id_())
        .by(__.label())
        .by(_by_label(narrowed, __.value_map, __.value_map()) if narrowed else __.value_map())
        .by(
            __.out_v().flat_map(_by_label(narrowed, __.element_map, __.element_map()))
            if narrowed
            else __.out_v().element_map()
        )
        .by(
            __.in_v().flat_map(_by_label(narrowed, __.element_map, __.element_map()))
            if narrowed
            else __.in_v().element_map()
        )
    )


#: A key no element carries, so ``elementMap`` of a type that permits nothing
#: returns its id and label alone — ``elementMap()`` with no keys means *all*.
_NO_PROPERTY = "_inv_no_property"


def _narrowed(lens: QueryLens | None) -> list[tuple[str, TypeBound]]:
    if lens is None:
        return []
    return sorted((n, b) for n, b in lens.bounds.items() if b.narrows_structure)


def _by_label(narrowed: list[tuple[str, TypeBound]], step: Any, otherwise: Any) -> Any:
    """``choose(label)`` with one option per narrowed type, the element whole otherwise."""
    t = __.choose(__.label())
    for name, bound in narrowed:
        t = t.option(name, step(*(bound.permitted or (_NO_PROPERTY,))))
    return t.option(Pick.none, otherwise)


def _apply_lens(traversal: Any, lens: QueryLens | None) -> Any:
    """The type and records grains, on whatever element the traversal is at.

    **Type**: the element's label must be allowed. **Records**: each narrowed
    type's slice is required of an element of that type and of no other, as
    ``where(or(not(hasLabel(T)), slice))`` — so it is part of the match.
    """
    if lens is None:
        return traversal
    # `label().is(…)`, not `hasLabel(…)`: the allow-list names node and edge
    # types together, and ArcadeDB folds a `hasLabel` after `bothE()` into its
    # edge iterator, where a vertex type in the list is a ClassCastException.
    if lens.allowed_types is not None:
        traversal = traversal.where(__.label().is_(P.within(*sorted(lens.allowed_types))))
    for name, bound in sorted(lens.bounds.items()):
        if not (bound.narrows_records and bound.predicates):
            continue
        predicate = _build_predicate(bound.predicates)
        if predicate is not None:
            traversal = traversal.where(__.or_(__.label().is_(P.neq(name)), predicate))
    return traversal


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
        if expr.op in (FilterOp.IN, FilterOp.NOT_IN):
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


def _apply_order(traversal: Any, sort: list[SortSpec] | None) -> Any:
    """Apply a list of SortSpec to a Gremlin traversal via order().by(values(prop), Order)."""
    if not sort:
        return traversal
    t = traversal.order()
    for s in sort:
        order = Order.desc if s.direction == SortDirection.DESC else Order.asc
        t = t.by(__.values(s.property), order)
    return t


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
        return t.element_map()

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
        return _project_edge(t)

    @staticmethod
    def match_vertex_by_id(g: GraphTraversalSource, vertex_id: Any) -> Any:
        """Build a traversal to match a vertex by ID."""
        return g.V(vertex_id).element_map()

    @staticmethod
    def match_edge_by_id(g: GraphTraversalSource, edge_id: Any) -> Any:
        """Build a traversal to match an edge by ID."""
        return _project_edge(g.E(edge_id))

    @staticmethod
    def _neighbor_traversal(
        g: GraphTraversalSource,
        vertex_id: Any,
        direction: str,
        edge_label: str | None,
        neighbor_label: str | None,
        filters: FilterGroup | None,
        lens: QueryLens | None = None,
    ) -> Any:
        """Shared traversal up to (and including) the neighbour vertex `m`.

        Steps to the edge (tagged `e`) then to the other vertex (tagged `m`), so
        neighbour-label, filters, sort and pagination all apply to the neighbour.
        A lens is applied at the anchor, the edge and the neighbour (CC22).
        """
        t = _apply_lens(g.V(vertex_id), lens)
        if direction == "out":
            t = t.out_e(edge_label) if edge_label else t.out_e()
        elif direction == "in":
            t = t.in_e(edge_label) if edge_label else t.in_e()
        else:
            t = t.both_e(edge_label) if edge_label else t.both_e()

        t = _apply_lens(t, lens).as_("e").other_v()
        t = _apply_lens(t, lens).as_("m")
        if neighbor_label:
            t = t.has_label(neighbor_label)
        return _apply_filters(t, filters)

    @staticmethod
    def match_neighbors(
        g: GraphTraversalSource,
        vertex_id: Any,
        direction: str = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        lens: QueryLens | None = None,
    ) -> Any:
        """Build a traversal for neighborhood exploration."""
        t = GremlinQueryBuilder._neighbor_traversal(g, vertex_id, direction, edge_label, neighbor_label, filters, lens)
        t = _apply_order(t, sort)
        if offset is not None:
            t = t.skip(offset)
        if limit is not None:
            t = t.limit(limit)
        t = t.select("e")
        return _project_edge(t, lens)

    @staticmethod
    def count_neighbors(
        g: GraphTraversalSource,
        vertex_id: Any,
        direction: str = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        lens: QueryLens | None = None,
    ) -> Any:
        """Build a traversal that counts matching neighbours."""
        t = GremlinQueryBuilder._neighbor_traversal(g, vertex_id, direction, edge_label, neighbor_label, filters, lens)
        return t.count()

    @staticmethod
    def create_vertex(g: GraphTraversalSource, label: str, properties: dict) -> Any:
        """Build a traversal to create a vertex."""
        t = g.add_v(label)
        for key, value in properties.items():
            t = t.property(key, value)
        return t.element_map()

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
        return _project_edge(t)

    @staticmethod
    def update_vertex(g: GraphTraversalSource, vertex_id: Any, properties: dict) -> Any:
        """Build a traversal to update vertex properties."""
        t = g.V(vertex_id)
        for key, value in properties.items():
            t = t.property(key, value)
        return t.element_map()

    @staticmethod
    def update_edge(g: GraphTraversalSource, edge_id: Any, properties: dict) -> Any:
        """Build a traversal to update edge properties."""
        t = g.E(edge_id)
        for key, value in properties.items():
            t = t.property(key, value)
        return _project_edge(t)

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
    def get_node_label_counts(g: GraphTraversalSource) -> Any:
        """Count vertices per label."""
        return g.V().group_count().by(T.label)

    @staticmethod
    def get_edge_label_counts(g: GraphTraversalSource) -> Any:
        """Count edges per label."""
        return g.E().group_count().by(T.label)

    @staticmethod
    def count_vertex_types(g: GraphTraversalSource, lens: QueryLens | None = None) -> Any:
        """Vertices per label, inside *lens* — denied types never matched, slices composed (SP11)."""
        return _apply_lens(g.V(), lens).group_count().by(T.label)

    @staticmethod
    def count_edge_types(g: GraphTraversalSource, lens: QueryLens | None = None) -> Any:
        """Edges per label, inside *lens* — both endpoints in the world too."""
        t = _apply_lens(g.E(), lens)
        if lens is not None:
            t = t.where(_apply_lens(__.out_v(), lens)).where(_apply_lens(__.in_v(), lens))
        return t.group_count().by(T.label)

    @staticmethod
    def resolve_vertices(g: GraphTraversalSource, vertex_ids: list, lens: QueryLens | None) -> Any:
        """Which of *vertex_ids* the graph holds, and whether each is inside *lens* (GC14).

        Only the id and a boolean come back — never a property.
        """
        in_world = (
            __.choose(_apply_lens(__.identity(), lens), __.constant(True), __.constant(False))
            if lens is not None
            else __.constant(True)
        )
        return g.V(*vertex_ids).project("id", "in_world").by(__.id_()).by(in_world)

    @staticmethod
    def get_property_keys(g: GraphTraversalSource, label: str) -> Any:
        """Get property keys for a given vertex label."""
        return g.V().has_label(label).properties().key().dedup()
