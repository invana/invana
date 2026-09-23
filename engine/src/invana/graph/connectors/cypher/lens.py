"""Compiling a lens into openCypher
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md).

Three things in one pass over one reading of the query (CC7):

**Reject** — any reference to an excluded property, anywhere, the inside of an
aggregate included. **Project** — a whole-element return becomes a map over
``declared - excluded``. **Compose** — the selector is folded into a
``WITH * WHERE`` barrier before the query runs.

Both halves are required (CC8): rewriting alone does not stop ``avg(d.revenue)``,
and rejection alone does not stop ``RETURN d``.

**This is a reader, not a grammar** (CC10). It understands the shapes the product
generates and refuses everything else — an unlabelled binding, a dynamic property
access, a whole-property-bag function, ``RETURN *``, a procedure call. Refusing
what it cannot read is what makes a reader sufficient where a parser would
otherwise be needed, and it is the only failure direction a bound may have.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from invana.graph.connectors.base.exceptions import LensViolationError
from invana.graph.connectors.base.lens import LensCompiler
from invana.graph.connectors.cypher.query_builder import OpenCypherQueryBuilder, _build_filter_clause
from invana.graph.types.lens import ComposedQuery, QueryLens, TypeBound

# Clause keywords recognised at depth 0. Longest first so ``OPTIONAL MATCH`` and
# ``UNION ALL`` win over their own prefixes.
_CLAUSE_KEYWORDS = (
    "OPTIONAL MATCH",
    "UNION ALL",
    "ORDER BY",
    "MATCH",
    "WHERE",
    "WITH",
    "RETURN",
    "UNWIND",
    "UNION",
    "SKIP",
    "LIMIT",
    "CALL",
    "YIELD",
    "FOREACH",
    "MERGE",
    "CREATE",
    "DELETE",
    "DETACH",
    "SET",
    "REMOVE",
)
_CLAUSE_RE = re.compile(r"\b(" + "|".join(k.replace(" ", r"\s+") for k in _CLAUSE_KEYWORDS) + r")\b", re.IGNORECASE)

# A clause that cannot be read under a lens at all: a procedure call returns
# whatever it likes, and a subquery hides its own bindings behind braces.
_UNREADABLE_CLAUSES = {"CALL", "YIELD", "FOREACH"}

_IDENT = r"[A-Za-z_][A-Za-z0-9_]*"
_NODE_RE = re.compile(r"\(\s*(" + _IDENT + r")?\s*((?::\s*" + _IDENT + r"\s*)*)")
_REL_RE = re.compile(r"\[\s*(" + _IDENT + r")?\s*(?::\s*(" + _IDENT + r"(?:\s*\|\s*:?\s*" + _IDENT + r")*))?")
_PROP_RE = re.compile(r"\b(" + _IDENT + r")\s*\.\s*(" + _IDENT + r")")
_LABEL_RE = re.compile(r":\s*(" + _IDENT + r")")
_AS_RE = re.compile(r"\s+AS\s+(" + _IDENT + r")\s*$", re.IGNORECASE)
_DISTINCT_RE = re.compile(r"^\s*DISTINCT\s+", re.IGNORECASE)
_BAG_RE = re.compile(r"\b(properties|keys|elementMap)\s*\(\s*(" + _IDENT + r")\s*\)", re.IGNORECASE)
# An explicit map projection: ``d { .name, .stage }``.
_PROJECTION_RE = re.compile(r"\b" + _IDENT + r"\s*\{[^{}]*\}")

# Functions that may take a governed element whole without leaking a property
# value: they return an identity, a count or a type, never the property bag.
_SCALAR_OVER_ELEMENT = {"count", "id", "elementid", "labels", "type"}


class _LensParams:
    """Parameter names for composed predicates, namespaced away from the query's own."""

    def __init__(self) -> None:
        self._count = 0

    def next(self) -> str:
        name = f"lens_p{self._count}"
        self._count += 1
        return name


@dataclass
class _Binding:
    """One variable the query bound, and the type it was bound to."""

    var: str
    type_name: str
    bound: TypeBound
    is_node: bool


@dataclass
class _Clause:
    keyword: str
    kw_start: int
    body_start: int
    end: int


def mask_cypher(query: str) -> str:
    """The query with string literals and comments blanked, offsets preserved.

    The word ``revenue`` inside a string is text, not a reference — the same
    treatment the read-only check already gives literals. Offsets are kept so
    every rewrite can be applied back onto the original text.
    """
    out = list(query)
    i, n = 0, len(query)
    while i < n:
        ch = query[i]
        if ch in "'\"`":
            quote = ch
            j = i + 1
            while j < n:
                if query[j] == "\\" and quote != "`":
                    j += 2
                    continue
                if query[j] == quote:
                    break
                j += 1
            for k in range(i, min(j + 1, n)):
                # A backtick-quoted identifier is a name, not a literal — blank the
                # quotes only, so ``(d:`Deal`)`` still reads as a label.
                out[k] = " " if quote != "`" or query[k] == "`" else out[k]
            i = j + 1
            continue
        if query.startswith("//", i):
            j = query.find("\n", i)
            j = n if j == -1 else j
            for k in range(i, j):
                out[k] = " "
            i = j
            continue
        if query.startswith("/*", i):
            j = query.find("*/", i + 2)
            j = n if j == -1 else j + 2
            for k in range(i, j):
                out[k] = " "
            i = j
            continue
        i += 1
    return "".join(out)


def _depths(masked: str) -> list[int]:
    """Bracket nesting depth at every offset — clause keywords count only at 0."""
    depth = 0
    out: list[int] = []
    for ch in masked:
        if ch in "([{":
            out.append(depth)
            depth += 1
        elif ch in ")]}":
            depth = max(0, depth - 1)
            out.append(depth)
        else:
            out.append(depth)
    return out


def _clauses(masked: str, depth: list[int]) -> list[_Clause]:
    found: list[_Clause] = []
    for m in _CLAUSE_RE.finditer(masked):
        if depth[m.start()] != 0:
            continue
        kw = re.sub(r"\s+", " ", m.group(1)).upper()
        found.append(_Clause(keyword=kw, kw_start=m.start(), body_start=m.end(), end=len(masked)))
    for idx in range(len(found) - 1):
        found[idx].end = found[idx + 1].kw_start
    return found


def _rstrip_to(masked: str, start: int, end: int) -> int:
    """``end`` moved back over trailing whitespace, never past ``start``."""
    while end > start and masked[end - 1].isspace():
        end -= 1
    return end


def _split_items(masked: str, start: int, end: int, depth: list[int]) -> list[tuple[int, int]]:
    """Top-level comma-separated spans of a RETURN/WITH body."""
    spans: list[tuple[int, int]] = []
    cursor = start
    for i in range(start, end):
        if masked[i] == "," and depth[i] == 0:
            spans.append((cursor, i))
            cursor = i + 1
    spans.append((cursor, end))
    return [(a, b) for a, b in spans if masked[a:b].strip()]


class CypherLensCompiler(LensCompiler):
    """Composes, projects and rejects a :class:`QueryLens` in openCypher.

    Constructed with the builder whose dialect this connection speaks, so the
    projection it writes uses the same identity function every other query on
    this connection uses — ``elementId()`` on Neo4j, ``id()`` on Memgraph
    (docs/for-developers/modules/graph-connectors/features/languages.md LG10).
    A compiler that hardcoded one of them would emit invalid Cypher on the other,
    which is a bound that fails **open** on exactly one vendor.
    """

    def __init__(self, query_builder: type[OpenCypherQueryBuilder] = OpenCypherQueryBuilder) -> None:
        self._query_builder = query_builder

    def compile(
        self,
        query: str,
        parameters: dict[str, Any] | None,
        lens: QueryLens,
    ) -> ComposedQuery:
        params = dict(parameters or {})
        if lens.is_empty:
            return ComposedQuery.unchanged(query, params)

        masked = mask_cypher(query)
        depth = _depths(masked)
        clauses = _clauses(masked, depth)
        if not clauses:
            self._unreadable("the query names no clause this compiler can read", query.strip()[:80])

        bindings: dict[str, _Binding] = {}
        edits: list[tuple[int, int, str]] = []
        projected: list[str] = []
        composed: list[str] = []
        pending: list[str] = []
        counter = _LensParams()
        # Readability complaints are held until after rejection: a query naming an
        # excluded property is refused for *that*, with the property named, rather
        # than for the shape that also happens to be unreadable (CC16).
        deferred: list[tuple[str, str]] = []

        for clause in clauses:
            if clause.keyword in _UNREADABLE_CLAUSES:
                self._unreadable(
                    f"a `{clause.keyword}` clause returns what it likes, so a lens cannot bound it",
                    clause.keyword,
                )
            if clause.keyword in {"UNION", "UNION ALL"}:
                bindings, pending = {}, []
                continue
            if clause.keyword in {"MATCH", "OPTIONAL MATCH"}:
                new = self._read_patterns(masked, clause, lens, bindings)
                for binding in new:
                    if binding.bound.narrows_records:
                        if clause.keyword == "OPTIONAL MATCH":
                            self._unreadable(
                                f"`{binding.var}` is optionally matched and narrowed by the lens — "
                                "composing the slice here would make the optional match required, "
                                "which changes the answer",
                                f"OPTIONAL MATCH … {binding.var}",
                            )
                        pending.append(binding.var)
                continue
            if clause.keyword in {"WITH", "RETURN"} and pending:
                clause_text, composed_vars = self._barrier(pending, bindings, counter, params)
                edits.append((clause.kw_start, clause.kw_start, clause_text))
                composed.extend(composed_vars)
                pending = []
            if clause.keyword == "WITH":
                self._carry_aliases(masked, clause, depth, bindings, deferred)
            elif clause.keyword == "RETURN":
                projected.extend(self._project(masked, clause, depth, bindings, edits, deferred))

        self._reject_properties(masked, bindings)
        for why, fragment in deferred:
            self._unreadable(why, fragment)

        if pending:  # pragma: no cover — a read query always reaches a RETURN
            self._unreadable("the lens narrows a type the query never returns through", ", ".join(pending))

        executed = self._apply(query, edits)
        return ComposedQuery(
            generated=query,
            executed=executed,
            parameters=params,
            projected=tuple(projected),
            composed=tuple(composed),
        )

    # -- reading ---------------------------------------------------------------

    def _read_patterns(
        self,
        masked: str,
        clause: _Clause,
        lens: QueryLens,
        bindings: dict[str, _Binding],
    ) -> list[_Binding]:
        body = masked[clause.body_start : clause.end]
        new: list[_Binding] = []
        for regex, is_node in ((_NODE_RE, True), (_REL_RE, False)):
            for m in regex.finditer(body):
                var = m.group(1)
                raw_types = m.group(2) or ""
                types = (
                    list(_LABEL_RE.findall(raw_types))
                    if is_node
                    else [t.strip().lstrip(":").strip() for t in raw_types.split("|") if t.strip()]
                )
                if var is None:
                    continue
                if not types:
                    if var in bindings or self._known_unbounded(var, masked, clause):
                        continue
                    self._unreadable(
                        f"`{var}` is bound without naming a type, and a binding the lens cannot "
                        "place is a binding it cannot govern",
                        m.group(0).strip(),
                    )
                for type_name in types:
                    if not lens.allows_type(type_name):
                        raise LensViolationError(
                            f"This world has no {type_name}.",
                            code="lens_type_denied",
                            type_name=type_name,
                        )
                governed = [t for t in types if (lens.bound_for(t) or _EMPTY).narrows_anything]
                if len(governed) > 1:
                    self._unreadable(
                        f"`{var}` names {len(governed)} narrowed types at once, so there is no one "
                        "bound to project or compose",
                        m.group(0).strip(),
                    )
                if not governed:
                    continue
                type_name = governed[0]
                bound = lens.bound_for(type_name)
                assert bound is not None
                if bound.narrows_structure and not bound.is_projectable:
                    raise LensViolationError(
                        f"{type_name} excludes {', '.join(sorted(bound.excluded))} but declares no "
                        "properties, so there is nothing to return it as.",
                        code="lens_unprojectable",
                        type_name=type_name,
                    )
                binding = _Binding(var=var, type_name=type_name, bound=bound, is_node=is_node)
                bindings[var] = binding
                new.append(binding)
        return new

    def _known_unbounded(self, var: str, masked: str, clause: _Clause) -> bool:
        """A path variable — ``MATCH p = (a:A)-->(b:B)`` — binds a path, not an element."""
        return bool(re.search(r"\b" + re.escape(var) + r"\s*=", masked[clause.body_start : clause.end]))

    # -- rejecting -------------------------------------------------------------

    def _reject_properties(self, masked: str, bindings: dict[str, _Binding]) -> None:
        for m in _BAG_RE.finditer(masked):
            if m.group(2) in bindings:
                self._unreadable(
                    f"`{m.group(1)}({m.group(2)})` returns the whole property bag, which is the hole "
                    "the projection closes",
                    m.group(0),
                )
        for var in bindings:
            for m in re.finditer(r"\b" + re.escape(var) + r"\s*\[", masked):
                self._unreadable(
                    f"`{masked[m.start() : m.end()]}…` reads a property the compiler cannot name, so "
                    "it cannot tell whether this world carries it",
                    masked[m.start() : m.end()] + "…",
                )
        for m in _PROP_RE.finditer(masked):
            binding = bindings.get(m.group(1))
            if binding and m.group(2) in binding.bound.excluded:
                raise LensViolationError(
                    f"This world does not carry {binding.type_name}.{m.group(2)}.",
                    code="lens_property_excluded",
                    type_name=binding.type_name,
                    property_name=m.group(2),
                )
        for var, binding in bindings.items():
            for m in re.finditer(r"\b" + re.escape(var) + r"\s*\{", masked):
                for key in re.findall(r"\.\s*(" + _IDENT + r")", masked[m.end() : masked.find("}", m.end()) + 1]):
                    if key in binding.bound.excluded:
                        raise LensViolationError(
                            f"This world does not carry {binding.type_name}.{key}.",
                            code="lens_property_excluded",
                            type_name=binding.type_name,
                            property_name=key,
                        )

    # -- composing -------------------------------------------------------------

    def _barrier(
        self,
        pending: list[str],
        bindings: dict[str, _Binding],
        counter: _LensParams,
        params: dict[str, Any],
    ) -> tuple[str, list[str]]:
        """``WITH * WHERE (…)`` — a clause boundary, not surgery on someone's WHERE (CC15)."""
        parts: list[str] = []
        composed: list[str] = []
        for var in pending:
            binding = bindings[var]
            assert binding.bound.predicates is not None
            clause = _build_filter_clause(binding.bound.predicates, var, counter, params)
            if clause:
                parts.append(f"({clause})")
                composed.append(f"{binding.type_name}.{var}")
        if not parts:
            return "", []
        return "WITH * WHERE " + " AND ".join(parts) + " ", composed

    # -- projecting ------------------------------------------------------------

    def _carry_aliases(
        self,
        masked: str,
        clause: _Clause,
        depth: list[int],
        bindings: dict[str, _Binding],
        deferred: list[tuple[str, str]],
    ) -> None:
        for start, end in _split_items(masked, clause.body_start, clause.end, depth):
            expr, alias = self._item(masked, start, end)
            var = expr.strip()
            if var in bindings:
                if alias and alias != var:
                    bindings[alias] = _Binding(
                        var=alias,
                        type_name=bindings[var].type_name,
                        bound=bindings[var].bound,
                        is_node=bindings[var].is_node,
                    )
                continue
            self._check_no_whole_element(expr, bindings, masked[start:end].strip(), deferred)

    def _project(
        self,
        masked: str,
        clause: _Clause,
        depth: list[int],
        bindings: dict[str, _Binding],
        edits: list[tuple[int, int, str]],
        deferred: list[tuple[str, str]],
    ) -> list[str]:
        body_start = clause.body_start
        stripped = _DISTINCT_RE.match(masked[body_start : clause.end])
        if stripped:
            body_start += stripped.end()
        if masked[body_start : clause.end].strip() == "*" and bindings:
            self._unreadable(
                "`RETURN *` returns bindings the compiler was never shown as return items",
                "RETURN *",
            )
        projected: list[str] = []
        for start, end in _split_items(masked, body_start, clause.end, depth):
            expr, alias = self._item(masked, start, end)
            var = expr.strip()
            binding = bindings.get(var)
            if binding is None:
                self._check_no_whole_element(expr, bindings, masked[start:end].strip(), deferred)
                continue
            if not binding.bound.narrows_structure:
                continue
            # The item's span runs to the **next clause's keyword**, so the last
            # return item owns the whitespace in front of `LIMIT`/`ORDER BY`/`SKIP`.
            # Replacing that span whole would weld the alias to the keyword —
            # `AS dLIMIT 5` — so the edit ends where the item's own text ends and
            # the separator is left where the author put it.
            item_end = _rstrip_to(masked, start, end)
            edits.append((start, item_end, " " + self._element_map(binding) + f" AS {alias or var}"))
            projected.append(f"{binding.type_name}.{var}")
        return projected

    def _item(self, masked: str, start: int, end: int) -> tuple[str, str | None]:
        text = masked[start:end]
        m = _AS_RE.search(text)
        if m:
            return text[: m.start()], m.group(1)
        return text, None

    def _check_no_whole_element(
        self,
        expr: str,
        bindings: dict[str, _Binding],
        fragment: str,
        deferred: list[tuple[str, str]],
    ) -> None:
        """A governed element may be counted, identified or projected — never carried whole.

        The complaint is *deferred* rather than raised: a query that also names an
        excluded property should be refused for naming it (CC16), and that check
        needs every binding, so it cannot run until the walk is done.
        """
        # An explicit map projection — ``d { .name }`` — already names what it takes,
        # and the reject pass has already checked those keys. It is not carrying `d`.
        residue = _PROJECTION_RE.sub(" ", _PROP_RE.sub(" ", expr))
        for var in bindings:
            for m in re.finditer(r"\b" + re.escape(var) + r"\b", residue):
                before = residue[: m.start()].rstrip()
                fn = re.search(r"(" + _IDENT + r")\s*\(\s*(?:DISTINCT\s+)?$", before, re.IGNORECASE)
                if fn and fn.group(1).lower() in _SCALAR_OVER_ELEMENT:
                    continue
                deferred.append(
                    (
                        f"`{fragment}` carries `{var}` whole past the lens, where the properties this "
                        "world excludes would travel with it",
                        fragment,
                    )
                )
                return

    def _element_map(self, binding: _Binding) -> str:
        """The permitted set, in the serializer's own element shape (CC13).

        Emitting the serializer's node/relationship keys is what keeps a governed
        node a node — on the canvas, in an emission and in the table — rather than
        silently retyping every governed graph answer as a table.
        """
        var = binding.var
        permitted = binding.bound.permitted
        props = f"{var} {{ {', '.join('.' + p for p in permitted)} }}" if permitted else "{}"
        if binding.is_node:
            return f"{{ element_id: {self._element_id(var)}, labels: labels({var}), properties: {props} }}"
        return (
            f"{{ element_id: {self._element_id(var)}, type: type({var}), "
            f"start_node_element_id: {self._element_id(f'startNode({var})')}, "
            f"end_node_element_id: {self._element_id(f'endNode({var})')}, "
            f"properties: {props} }}"
        )

    def _element_id(self, expr: str) -> str:
        """This connection's identity function, read from its builder (LG10)."""
        return f"{self._query_builder.ELEMENT_ID}({expr})"

    # -- applying --------------------------------------------------------------

    def _apply(self, query: str, edits: list[tuple[int, int, str]]) -> str:
        for start, end, text in sorted(edits, key=lambda e: e[0], reverse=True):
            query = query[:start] + text + query[end:]
        return re.sub(r"[ \t]{2,}", " ", query).strip()

    def _unreadable(self, why: str, fragment: str) -> None:
        raise LensViolationError(
            f"This question cannot be run under this world's lens — {why}.",
            code="lens_unreadable",
            fragment=fragment,
        )


_EMPTY = TypeBound(type_name="")


def _narrows_anything(self: TypeBound) -> bool:
    return self.narrows_structure or self.narrows_records


TypeBound.narrows_anything = property(_narrows_anything)  # type: ignore[attr-defined]
