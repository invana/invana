"""OpenCypher query builder — generates parameterized Cypher query strings.

All methods return (query_string, parameters_dict) tuples.
Parameters use $p0, $p1, ... naming to avoid collisions.
"""

from __future__ import annotations

from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup, LogicalOp
from invana.graph.types.lens import QueryLens, TypeBound
from invana.graph.types.sort import SortDirection, SortSpec


class _ParamCounter:
    """Tracks parameter indices for a single query build."""

    def __init__(self) -> None:
        self._count = 0

    def next(self) -> str:
        name = f"p{self._count}"
        self._count += 1
        return name


def _build_filter_clause(
    group: FilterGroup,
    var: str,
    counter: _ParamCounter,
    params: dict,
) -> str:
    """Recursively build a WHERE clause from a FilterGroup tree."""
    parts: list[str] = []

    for condition in group.conditions:
        if isinstance(condition, FilterGroup):
            sub = _build_filter_clause(condition, var, counter, params)
            if sub:
                parts.append(f"({sub})")
        elif isinstance(condition, FilterExpression):
            clause = _build_filter_expression(condition, var, counter, params)
            if clause:
                parts.append(clause)

    joiner = " AND " if group.operator == LogicalOp.AND else " OR "
    return joiner.join(parts)


_FILTER_OP_MAP: dict[FilterOp, str] = {
    FilterOp.EQ: "=",
    FilterOp.NEQ: "<>",
    FilterOp.GT: ">",
    FilterOp.GTE: ">=",
    FilterOp.LT: "<",
    FilterOp.LTE: "<=",
}


def _build_filter_expression(
    expr: FilterExpression,
    var: str,
    counter: _ParamCounter,
    params: dict,
) -> str:
    prop = f"{var}.{expr.property}"

    if expr.op in _FILTER_OP_MAP:
        p = counter.next()
        params[p] = expr.value
        return f"{prop} {_FILTER_OP_MAP[expr.op]} ${p}"

    if expr.op == FilterOp.IN:
        p = counter.next()
        params[p] = expr.value
        return f"{prop} IN ${p}"

    if expr.op == FilterOp.NOT_IN:
        p = counter.next()
        params[p] = expr.value
        return f"NOT {prop} IN ${p}"

    if expr.op == FilterOp.CONTAINS:
        p = counter.next()
        params[p] = expr.value
        return f"{prop} CONTAINS ${p}"

    if expr.op == FilterOp.STARTS_WITH:
        p = counter.next()
        params[p] = expr.value
        return f"{prop} STARTS WITH ${p}"

    if expr.op == FilterOp.ENDS_WITH:
        p = counter.next()
        params[p] = expr.value
        return f"{prop} ENDS WITH ${p}"

    if expr.op == FilterOp.IS_NULL:
        return f"{prop} IS NULL"

    if expr.op == FilterOp.IS_NOT_NULL:
        return f"{prop} IS NOT NULL"

    return ""


def _order_clause(sort: list[SortSpec] | None, var: str) -> str:
    """Build an ` ORDER BY var.`prop` ASC|DESC, ...` clause from a list of SortSpec."""
    if not sort:
        return ""
    parts = [f"{var}.`{s.property}` {'DESC' if s.direction == SortDirection.DESC else 'ASC'}" for s in sort]
    return " ORDER BY " + ", ".join(parts)


def _name(identifier: str) -> str:
    """A label, type or property key as a quoted identifier — a backtick in it is doubled."""
    return "`" + identifier.replace("`", "``") + "`"


class OpenCypherQueryBuilder:
    """Builds parameterized openCypher queries, returning ``(query, params)``.

    Every method is a ``classmethod`` so a vendor can subclass and change one
    name rather than one query at a time.
    """

    #: The function that yields an element's identity. ``elementId()`` is Neo4j 5's,
    #: and is what "standard openCypher" means in this core — but it is not
    #: universal: Memgraph has ``id()`` and no ``elementId`` at all. A vendor whose
    #: id function differs subclasses this builder and sets this one name
    #: (docs/for-developers/modules/graph-connectors/features/languages.md LG10).
    ELEMENT_ID = "elementId"

    @classmethod
    def match_nodes(
        cls,
        label: str,
        filters: FilterGroup | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> tuple[str, dict]:
        params: dict = {}
        counter = _ParamCounter()
        query = f"MATCH (n:`{label}`)"

        if filters and filters.conditions:
            where = _build_filter_clause(filters, "n", counter, params)
            if where:
                query += f" WHERE {where}"

        query += " RETURN n"

        if offset is not None:
            p = counter.next()
            params[p] = offset
            query += f" SKIP ${p}"

        if limit is not None:
            p = counter.next()
            params[p] = limit
            query += f" LIMIT ${p}"

        return query, params

    @classmethod
    def match_edges(
        cls,
        label: str,
        source_label: str | None = None,
        target_label: str | None = None,
        filters: FilterGroup | None = None,
        limit: int | None = None,
    ) -> tuple[str, dict]:
        params: dict = {}
        counter = _ParamCounter()

        src = f"(a:`{source_label}`)" if source_label else "(a)"
        tgt = f"(b:`{target_label}`)" if target_label else "(b)"
        query = f"MATCH {src}-[r:`{label}`]->{tgt}"

        if filters and filters.conditions:
            where = _build_filter_clause(filters, "r", counter, params)
            if where:
                query += f" WHERE {where}"

        query += " RETURN r, a, b"

        if limit is not None:
            p = counter.next()
            params[p] = limit
            query += f" LIMIT ${p}"

        return query, params

    @classmethod
    def _neighbor_match(
        cls,
        vertex_id: str,
        direction: str,
        edge_label: str | None,
        neighbor_label: str | None,
        filters: FilterGroup | None,
        counter: _ParamCounter,
        params: dict,
        lens: QueryLens | None = None,
    ) -> str:
        """Shared `MATCH ... WHERE ...` prefix for neighborhood reads + counts.

        Filters apply to the neighbour `m`; the anchor is `elementId(n) = $vid`.
        A lens adds its type and records grains to the same `WHERE` (CC22).
        """
        edge_part = f"[r:{_name(edge_label)}]" if edge_label else "[r]"
        neighbor = f"(m:{_name(neighbor_label)})" if neighbor_label else "(m)"

        if direction == "out":
            pattern = f"(n)-{edge_part}->{neighbor}"
        elif direction == "in":
            pattern = f"(n)<-{edge_part}-{neighbor}"
        else:
            pattern = f"(n)-{edge_part}-{neighbor}"

        query = f"MATCH {pattern} WHERE {cls.ELEMENT_ID}(n) = $vid"
        if filters and filters.conditions:
            where = _build_filter_clause(filters, "m", counter, params)
            if where:
                query += f" AND ({where})"
        if lens is not None:
            for clause in cls._lens_where(lens, counter, params):
                query += f" AND {clause}"
        return query

    @classmethod
    def _lens_where(
        cls,
        lens: QueryLens,
        counter: _ParamCounter,
        params: dict,
        *,
        nodes: tuple[str, ...] = ("n", "m"),
        rels: tuple[str, ...] = ("r",),
    ) -> list[str]:
        """The type and records grains, as conditions on the named node and relationship variables.

        **Type**: every label of each node and each relationship's type must be
        allowed — a node carrying one denied label is a node of that type.
        **Records**: each type's slice is required of whatever carries that
        type, as `(NOT m:T OR <slice>)`, so elements of other types pass
        untouched and a narrowed type is matched only inside its slice.
        """
        clauses: list[str] = []
        if lens.allowed_types is not None:
            p = counter.next()
            params[p] = sorted(lens.allowed_types)
            clauses.extend(f"type({var}) IN ${p}" for var in rels)
            clauses.extend(f"ALL(l IN labels({var}) WHERE l IN ${p})" for var in nodes)
        for name, bound in sorted(lens.bounds.items()):
            if not (bound.narrows_records and bound.predicates):
                continue
            for var in nodes:
                slice_ = _build_filter_clause(bound.predicates, var, counter, params)
                clauses.append(f"(NOT {var}:{_name(name)} OR ({slice_}))")
            if rels:
                p = counter.next()
                params[p] = name
            for var in rels:
                slice_ = _build_filter_clause(bound.predicates, var, counter, params)
                clauses.append(f"(type({var}) <> ${p} OR ({slice_}))")
        return clauses

    @classmethod
    def count_node_types(cls, lens: QueryLens) -> tuple[str, dict]:
        """Nodes per label, inside *lens* — denied types never matched, slices composed (SP11)."""
        params: dict = {}
        clauses = cls._lens_where(lens, _ParamCounter(), params, nodes=("n",), rels=())
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        return f"MATCH (n){where} UNWIND labels(n) AS label RETURN label AS label, count(*) AS count", params

    @classmethod
    def count_edge_types(cls, lens: QueryLens) -> tuple[str, dict]:
        """Relationships per type, inside *lens* — both endpoints in the world too.

        An edge whose end the world excludes is one an expansion could never
        reach, so it is not counted as part of what this world holds.
        """
        params: dict = {}
        clauses = cls._lens_where(lens, _ParamCounter(), params, nodes=("a", "b"), rels=("r",))
        where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
        return f"MATCH (a)-[r]->(b){where} RETURN type(r) AS label, count(*) AS count", params

    @classmethod
    def resolve_nodes(cls, vertex_ids: list, lens: QueryLens | None) -> tuple[str, dict]:
        """Which of *vertex_ids* the graph holds, and whether each is inside *lens* (GC14).

        One query for the whole canvas. Only the id and a boolean come back —
        never a property — so what the world excludes is not read, only placed.
        """
        params: dict = {"ids": vertex_ids}
        clauses = cls._lens_where(lens, _ParamCounter(), params, nodes=("n",), rels=()) if lens else []
        in_world = " AND ".join(clauses) if clauses else "true"
        return (
            f"MATCH (n) WHERE {cls.ELEMENT_ID}(n) IN $ids RETURN {cls.ELEMENT_ID}(n) AS id, ({in_world}) AS in_world",
            params,
        )

    @classmethod
    def _lens_return(cls, lens: QueryLens | None, counter: _ParamCounter, params: dict) -> str | None:
        """The property grain: `n`, `r` and `m` projected to what each type permits.

        ``None`` when no type excludes anything, so the elements travel whole. The
        projection is the serializer's own element shape — the same one the lens
        compiler writes (CC13) — so a governed neighbour is still a node.
        """
        if lens is None:
            return None
        narrowed = sorted((n, b) for n, b in lens.bounds.items() if b.narrows_structure)
        if not narrowed:
            return None
        eid = cls.ELEMENT_ID

        def props(var: str, bound: TypeBound) -> str:
            permitted = bound.permitted
            return f"{var} {{ {', '.join('.' + _name(k) for k in permitted)} }}" if permitted else "{}"

        def node(var: str) -> str:
            cases = " ".join(f"WHEN {var}:{_name(n)} THEN {props(var, b)}" for n, b in narrowed)
            return (
                f"{{ element_id: {eid}({var}), labels: labels({var}), "
                f"properties: CASE {cases} ELSE properties({var}) END }} AS {var}"
            )

        whens = []
        for n, b in narrowed:
            p = counter.next()
            params[p] = n
            whens.append(f"WHEN ${p} THEN {props('r', b)}")
        rel = (
            f"{{ element_id: {eid}(r), type: type(r), "
            f"start_node_element_id: {eid}(startNode(r)), end_node_element_id: {eid}(endNode(r)), "
            f"properties: CASE type(r) {' '.join(whens)} ELSE properties(r) END }} AS r"
        )
        return f"{node('n')}, {rel}, {node('m')}"

    @classmethod
    def match_neighbors(
        cls,
        vertex_id: str,
        direction: str = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        sort: list[SortSpec] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        lens: QueryLens | None = None,
    ) -> tuple[str, dict]:
        params: dict = {"vid": vertex_id}
        counter = _ParamCounter()

        query = cls._neighbor_match(vertex_id, direction, edge_label, neighbor_label, filters, counter, params, lens)
        projected = cls._lens_return(lens, counter, params)
        # A projected `m` is a map, so ordering and paging happen on the
        # elements, before the projection, where `m.prop` still means the node.
        query += " WITH n, r, m" if projected else " RETURN n, r, m"
        query += _order_clause(sort, "m")

        if offset is not None:
            p = counter.next()
            params[p] = offset
            query += f" SKIP ${p}"

        if limit is not None:
            p = counter.next()
            params[p] = limit
            query += f" LIMIT ${p}"

        if projected:
            query += f" RETURN {projected}"
        return query, params

    @classmethod
    def count_neighbors(
        cls,
        vertex_id: str,
        direction: str = "both",
        edge_label: str | None = None,
        neighbor_label: str | None = None,
        filters: FilterGroup | None = None,
        lens: QueryLens | None = None,
    ) -> tuple[str, dict]:
        params: dict = {"vid": vertex_id}
        counter = _ParamCounter()

        query = cls._neighbor_match(vertex_id, direction, edge_label, neighbor_label, filters, counter, params, lens)
        query += " RETURN count(m) AS cnt"
        return query, params

    @classmethod
    def match_node_by_id(cls, vertex_id: str) -> tuple[str, dict]:
        return f"MATCH (n) WHERE {cls.ELEMENT_ID}(n) = $vid RETURN n", {"vid": vertex_id}

    @classmethod
    def match_edge_by_id(cls, edge_id: str) -> tuple[str, dict]:
        return (
            f"MATCH (a)-[r]->(b) WHERE {cls.ELEMENT_ID}(r) = $eid RETURN r, a, b",
            {"eid": edge_id},
        )

    @classmethod
    def create_node(cls, label: str, properties: dict) -> tuple[str, dict]:
        params = {"props": properties}
        return f"CREATE (n:`{label}` $props) RETURN n", params

    @classmethod
    def create_edge(
        cls,
        label: str,
        source_id: str,
        target_id: str,
        properties: dict | None = None,
    ) -> tuple[str, dict]:
        params: dict = {"sid": source_id, "tid": target_id}
        props_part = " $props" if properties else ""
        if properties:
            params["props"] = properties
        return (
            f"MATCH (a), (b) WHERE {cls.ELEMENT_ID}(a) = $sid AND {cls.ELEMENT_ID}(b) = $tid"
            f" CREATE (a)-[r:`{label}`{props_part}]->(b) RETURN r, a, b",
            params,
        )

    @classmethod
    def update_node(cls, vertex_id: str, properties: dict) -> tuple[str, dict]:
        return (
            f"MATCH (n) WHERE {cls.ELEMENT_ID}(n) = $vid SET n += $props RETURN n",
            {"vid": vertex_id, "props": properties},
        )

    @classmethod
    def update_edge(cls, edge_id: str, properties: dict) -> tuple[str, dict]:
        return (
            f"MATCH ()-[r]->() WHERE {cls.ELEMENT_ID}(r) = $eid SET r += $props RETURN r",
            {"eid": edge_id, "props": properties},
        )

    @classmethod
    def delete_node(cls, vertex_id: str) -> tuple[str, dict]:
        return f"MATCH (n) WHERE {cls.ELEMENT_ID}(n) = $vid DETACH DELETE n", {"vid": vertex_id}

    @classmethod
    def delete_edge(cls, edge_id: str) -> tuple[str, dict]:
        return f"MATCH ()-[r]->() WHERE {cls.ELEMENT_ID}(r) = $eid DELETE r", {"eid": edge_id}

    @classmethod
    def count_nodes(cls, label: str | None = None) -> tuple[str, dict]:
        if label:
            return f"MATCH (n:`{label}`) RETURN count(n) AS cnt", {}
        return "MATCH (n) RETURN count(n) AS cnt", {}

    @classmethod
    def count_edges(cls, label: str | None = None) -> tuple[str, dict]:
        if label:
            return f"MATCH ()-[r:`{label}`]->() RETURN count(r) AS cnt", {}
        return "MATCH ()-[r]->() RETURN count(r) AS cnt", {}

    @classmethod
    def shortest_path(cls, source_id: str, target_id: str, max_depth: int = 10) -> tuple[str, dict]:
        return (
            f"MATCH (a), (b) WHERE {cls.ELEMENT_ID}(a) = $sid AND {cls.ELEMENT_ID}(b) = $tid"
            f" MATCH p = shortestPath((a)-[*..{max_depth}]-(b)) RETURN p",
            {"sid": source_id, "tid": target_id},
        )

    # -- Bulk operations --
    @classmethod
    def bulk_create_nodes(cls, label: str, records: list[dict]) -> tuple[str, dict]:
        return (
            f"UNWIND $records AS props CREATE (n:`{label}`) SET n = props RETURN n",
            {"records": records},
        )

    @classmethod
    def bulk_create_edges(cls, label: str, records: list[dict]) -> tuple[str, dict]:
        return (
            "UNWIND $records AS rec"
            f" MATCH (a), (b) WHERE {cls.ELEMENT_ID}(a) = rec.source_id AND {cls.ELEMENT_ID}(b) = rec.target_id"
            f" CREATE (a)-[r:`{label}`]->(b)"
            " SET r = rec.properties"
            " RETURN r, a, b",
            {"records": records},
        )

    @classmethod
    def bulk_delete_nodes(cls, vertex_ids: list[str]) -> tuple[str, dict]:
        return (
            f"UNWIND $ids AS vid MATCH (n) WHERE {cls.ELEMENT_ID}(n) = vid DETACH DELETE n",
            {"ids": vertex_ids},
        )

    @classmethod
    def bulk_delete_edges(cls, edge_ids: list[str]) -> tuple[str, dict]:
        return (
            f"UNWIND $ids AS eid MATCH ()-[r]->() WHERE {cls.ELEMENT_ID}(r) = eid DELETE r",
            {"ids": edge_ids},
        )

    # -- Schema --
    @classmethod
    def get_node_labels(cls) -> tuple[str, dict]:
        return "CALL db.labels() YIELD label RETURN label", {}

    @classmethod
    def get_edge_labels(cls) -> tuple[str, dict]:
        return "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType", {}

    @classmethod
    def get_node_label_counts(cls) -> tuple[str, dict]:
        """Count nodes per label.

        ``UNWIND labels(n)`` counts a multi-labelled node once under each of its
        labels, which is what a type list means: a node that is both an
        ``Observation`` and a ``Thesis`` belongs to both rows.
        """
        return (
            "MATCH (n) UNWIND labels(n) AS label RETURN label AS label, count(*) AS count ORDER BY count DESC",
            {},
        )

    @classmethod
    def get_edge_label_counts(cls) -> tuple[str, dict]:
        """Count relationships per type."""
        return (
            "MATCH ()-[r]->() RETURN type(r) AS label, count(*) AS count ORDER BY count DESC",
            {},
        )

    @classmethod
    def get_property_keys(cls, label: str) -> tuple[str, dict]:
        return (
            f"MATCH (n:`{label}`) WITH n LIMIT 100 UNWIND keys(n) AS key RETURN DISTINCT key",
            {},
        )
