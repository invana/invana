"""Memgraph's plan, reduced to what the model page reads (the-model-page.md MP38 · MP39).

``EXPLAIN`` answers one row per operator — ``* Filter (b :airport), {b.city}``.
Variables take their label from ``(b :airport)`` anywhere in the plan, so a
``ScanAll (a)`` later filtered on ``(a :airport), {a.code}`` reads as a label
scan filtered on ``airport.code``.
"""

from __future__ import annotations

import re

from invana.graph.types.plan import ExplainedPlan

_OP = re.compile(r"^\s*\*\s*(\w+)\s*(.*)$")
_REL = re.compile(r"\[\w*:(\w+)\]")
_VAR_LABEL = re.compile(r"\((\w+) :(\w+)")
_BRACED = re.compile(r"\{([^}]*)\}")

_SCANS = ("ScanAll", "ScanAllByLabel")


def reduce_plan(rows: list[str]) -> ExplainedPlan:
    ops = [(m.group(1), m.group(2)) for m in (_OP.match(r) for r in rows) if m]
    plan = ExplainedPlan(lines=[f"{op} {details}".strip() for op, details in ops])

    labels: dict[str, str] = {}
    for _, details in ops:
        plan.edge_labels.update(_REL.findall(details))
        for var, label in _VAR_LABEL.findall(details):
            labels.setdefault(var, label)
    plan.node_labels.update(labels.values())

    scanned_vars = {m.group(1) for op, d in ops if op in _SCANS for m in [re.match(r"\s*\((\w+)", d)] if m}

    def props(details: str) -> list[tuple[str, str]]:
        out = []
        for group in _BRACED.findall(details):
            for item in group.split(","):
                var, _, prop = item.strip().partition(".")
                if prop and var in labels:
                    out.append((var, prop))
        return out

    for op, details in ops:
        found = props(details)
        named = {f"{labels[v]}.{p}" for v, p in found}
        if op.startswith("ScanAllByLabelProperty"):
            # `(n :airport {code})` — the property is read through an index.
            plan.filtered |= {
                f"{label}.{p.strip()}"
                for _, label in _VAR_LABEL.findall(details)
                for g in _BRACED.findall(details)
                for p in g.split(",")
                if p.strip()
            }
        elif op == "Filter":
            plan.filtered |= named
            plan.scanned |= {f"{labels[v]}.{p}" for v, p in found if v in scanned_vars}
        elif op == "OrderBy":
            plan.ordered |= named
        elif op == "Produce":
            plan.returned |= named
    return plan
