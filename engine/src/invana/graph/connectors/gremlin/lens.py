"""A lens, in Gremlin — declared unsupported rather than quietly absent
(docs/for-developers/modules/graph-connectors/features/the-connector-contract.md CC12).

A raw Gremlin query is a **script**. There is no reliable way to read which
variable is bound to which type out of one, so there is nothing to compose a
predicate onto and nothing to project — and a compiler that cannot read a query
must refuse it, not pass it through (CC10).

This is CN6 doing its job: *unsupported is declared, not discovered*. The
alternative is a lens that reports as applied and enforces nothing, which is the
one outcome a bound may not have. The Gremlin querysets build their own
traversals from structured filters and already carry their bound; what has no
governed path is the arbitrary query.
"""

from __future__ import annotations

from invana.graph.connectors.base.lens import UnsupportedLensCompiler


class GremlinLensCompiler(UnsupportedLensCompiler):
    """Refuses any query submitted under a lens, naming the language."""

    language = "Gremlin"
