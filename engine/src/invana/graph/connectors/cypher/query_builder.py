"""OpenCypher query builder — generates parameterized Cypher query strings.

All methods return (query_string, parameters_dict) tuples.
Parameters use $p0, $p1, ... naming to avoid collisions.
"""

from __future__ import annotations

from invana.graph.types.filter_types import FilterOp
from invana.graph.types.filters import FilterExpression, FilterGroup, LogicalOp


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


class OpenCypherQueryBuilder:
    """Builds parameterized openCypher queries. All methods are static and return (query, params)."""

    @staticmethod
    def match_nodes(
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

    @staticmethod
    def match_edges(
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

    @staticmethod
    def match_neighbors(
        vertex_id: str,
        direction: str = "both",
        edge_label: str | None = None,
        limit: int | None = None,
    ) -> tuple[str, dict]:
        params: dict = {"vid": vertex_id}
        counter = _ParamCounter()

        edge_part = f"[r:`{edge_label}`]" if edge_label else "[r]"

        if direction == "out":
            pattern = f"(n)-{edge_part}->(m)"
        elif direction == "in":
            pattern = f"(n)<-{edge_part}-(m)"
        else:
            pattern = f"(n)-{edge_part}-(m)"

        query = f"MATCH {pattern} WHERE elementId(n) = $vid RETURN n, r, m"

        if limit is not None:
            p = counter.next()
            params[p] = limit
            query += f" LIMIT ${p}"

        return query, params

    @staticmethod
    def match_node_by_id(vertex_id: str) -> tuple[str, dict]:
        return "MATCH (n) WHERE elementId(n) = $vid RETURN n", {"vid": vertex_id}

    @staticmethod
    def match_edge_by_id(edge_id: str) -> tuple[str, dict]:
        return (
            "MATCH (a)-[r]->(b) WHERE elementId(r) = $eid RETURN r, a, b",
            {"eid": edge_id},
        )

    @staticmethod
    def create_node(label: str, properties: dict) -> tuple[str, dict]:
        params = {"props": properties}
        return f"CREATE (n:`{label}` $props) RETURN n", params

    @staticmethod
    def create_edge(
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
            f"MATCH (a), (b) WHERE elementId(a) = $sid AND elementId(b) = $tid"
            f" CREATE (a)-[r:`{label}`{props_part}]->(b) RETURN r, a, b",
            params,
        )

    @staticmethod
    def update_node(vertex_id: str, properties: dict) -> tuple[str, dict]:
        return (
            "MATCH (n) WHERE elementId(n) = $vid SET n += $props RETURN n",
            {"vid": vertex_id, "props": properties},
        )

    @staticmethod
    def update_edge(edge_id: str, properties: dict) -> tuple[str, dict]:
        return (
            "MATCH ()-[r]->() WHERE elementId(r) = $eid SET r += $props RETURN r",
            {"eid": edge_id, "props": properties},
        )

    @staticmethod
    def delete_node(vertex_id: str) -> tuple[str, dict]:
        return "MATCH (n) WHERE elementId(n) = $vid DETACH DELETE n", {"vid": vertex_id}

    @staticmethod
    def delete_edge(edge_id: str) -> tuple[str, dict]:
        return "MATCH ()-[r]->() WHERE elementId(r) = $eid DELETE r", {"eid": edge_id}

    @staticmethod
    def count_nodes(label: str | None = None) -> tuple[str, dict]:
        if label:
            return f"MATCH (n:`{label}`) RETURN count(n) AS cnt", {}
        return "MATCH (n) RETURN count(n) AS cnt", {}

    @staticmethod
    def count_edges(label: str | None = None) -> tuple[str, dict]:
        if label:
            return f"MATCH ()-[r:`{label}`]->() RETURN count(r) AS cnt", {}
        return "MATCH ()-[r]->() RETURN count(r) AS cnt", {}

    @staticmethod
    def shortest_path(source_id: str, target_id: str, max_depth: int = 10) -> tuple[str, dict]:
        return (
            "MATCH (a), (b) WHERE elementId(a) = $sid AND elementId(b) = $tid"
            f" MATCH p = shortestPath((a)-[*..{max_depth}]-(b)) RETURN p",
            {"sid": source_id, "tid": target_id},
        )

    # -- Bulk operations --
    @staticmethod
    def bulk_create_nodes(label: str, records: list[dict]) -> tuple[str, dict]:
        return (
            f"UNWIND $records AS props CREATE (n:`{label}`) SET n = props RETURN n",
            {"records": records},
        )

    @staticmethod
    def bulk_create_edges(label: str, records: list[dict]) -> tuple[str, dict]:
        return (
            "UNWIND $records AS rec"
            " MATCH (a), (b) WHERE elementId(a) = rec.source_id AND elementId(b) = rec.target_id"
            f" CREATE (a)-[r:`{label}`]->(b)"
            " SET r = rec.properties"
            " RETURN r, a, b",
            {"records": records},
        )

    @staticmethod
    def bulk_delete_nodes(vertex_ids: list[str]) -> tuple[str, dict]:
        return (
            "UNWIND $ids AS vid MATCH (n) WHERE elementId(n) = vid DETACH DELETE n",
            {"ids": vertex_ids},
        )

    @staticmethod
    def bulk_delete_edges(edge_ids: list[str]) -> tuple[str, dict]:
        return (
            "UNWIND $ids AS eid MATCH ()-[r]->() WHERE elementId(r) = eid DELETE r",
            {"ids": edge_ids},
        )

    # -- Schema --
    @staticmethod
    def get_node_labels() -> tuple[str, dict]:
        return "CALL db.labels() YIELD label RETURN label", {}

    @staticmethod
    def get_edge_labels() -> tuple[str, dict]:
        return "CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType", {}

    @staticmethod
    def get_property_keys(label: str) -> tuple[str, dict]:
        return (
            f"MATCH (n:`{label}`) WITH n LIMIT 100 UNWIND keys(n) AS key RETURN DISTINCT key",
            {},
        )
