"""A query's plan, read without running it (the-model-page.md MP12 · MP38 · MP39).

Vendor-neutral: each connector that can ``EXPLAIN`` reduces its own plan to
this, and nothing above the connector reads a vendor's operator names. Every
property is ``label.property``, resolved from the plan's own variables.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ExplainedPlan:
    #: Node labels and relationship types the plan reads.
    node_labels: set[str] = field(default_factory=set)
    edge_labels: set[str] = field(default_factory=set)
    filtered: set[str] = field(default_factory=set)
    returned: set[str] = field(default_factory=set)
    ordered: set[str] = field(default_factory=set)
    #: Filtered after a label scan — the read an index on it would turn into a seek.
    scanned: set[str] = field(default_factory=set)
    #: The operators, top first, as the vendor names them — the shape card's summary.
    lines: list[str] = field(default_factory=list)
