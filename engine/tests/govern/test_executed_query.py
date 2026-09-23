"""The citation names the query that produced the number.

A digest proves a difference without showing one. Under a world that slices,
the step dashboard's **Input** band prints the query the plan asked for beside
a row count the *rewritten* query produced — so a reader who copies it out gets
a different answer. [GV34](docs/for-developers/modules/govern/spec.md) records
the text that ran, and records it nowhere else.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.graph.types import ComposedQuery, query_digest
from invana.runtime.catalogue.graph_read import query_record

_GENERATED = "MATCH (d:Deal) RETURN count(d)"
_EXECUTED = "MATCH (d:Deal) WHERE d.geo IN ['IE','DE'] RETURN count(d)"


@dataclass
class _Result:
    """Only the field `query_record` reads."""

    composed: ComposedQuery | None


def _digests(composed: ComposedQuery | None, fallback: str) -> dict[str, str]:
    return composed.digests if composed else {"generated": query_digest(fallback), "executed": query_digest(fallback)}


def test_a_rewritten_query_records_the_text_that_ran() -> None:
    composed = ComposedQuery(generated=_GENERATED, executed=_EXECUTED)
    record = query_record(
        _Result(composed=composed),
        digests=_digests(composed, _GENERATED),
        timeout_s=30,
        parameters=False,
    )

    assert record["executed_query"] == _EXECUTED
    # Both halves, because the step is the only place a dashboard can read
    # them: an ask run's `args` carry `read_only` and nothing else.
    assert record["generated_query"] == _GENERATED
    # And the digests still disagree, so the proof and the evidence are both
    # there — the text does not replace the digest that flagged it.
    assert record["query"]["generated"] != record["query"]["executed"]


def test_an_unrewritten_query_records_no_second_copy() -> None:
    """The ungoverned read, and the governed one that narrowed nothing.

    `args` already holds the query, and it is the one that ran.
    """
    for composed in (None, ComposedQuery.unchanged(_GENERATED)):
        record = query_record(
            _Result(composed=composed),
            digests=_digests(composed, _GENERATED),
            timeout_s=30,
            parameters=False,
        )
        assert "executed_query" not in record
        assert "generated_query" not in record
        assert record["query"]["generated"] == record["query"]["executed"]
