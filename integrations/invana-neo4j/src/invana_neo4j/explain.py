"""Neo4j's plan, reduced to what the model page reads (the-model-page.md MP38 · MP39).

``EXPLAIN`` returns an operator tree; each operator's ``Details`` names its
variables (``b:airport``), its relationships (``[anon_0:route]``) and the
properties it touches (``b.city``). Variables are resolved to labels over the
whole plan first, so ``Filter b.city`` reads as ``airport.city``.
"""

from __future__ import annotations

import re
from typing import Any

from invana.graph.types.plan import ExplainedPlan

_REL = re.compile(r"\[\w*:`?(\w+)`?")
_VAR_LABEL = re.compile(r"\b(\w+):`?(\w+)`?")
_SEEK = re.compile(r"\b(\w+):`?(\w+)`?\(([^)]*)\)")
_PROP = re.compile(r"\b(\w+)\.`?(\w+)`?")

_SCANS = ("NodeByLabelScan", "AllNodesScan")
_FILTERS = ("Filter",)
_ORDERS = ("Sort", "Top", "PartialSort", "PartialTop")
_RETURNS = ("ProduceResults", "Projection", "CacheProperties")


def _walk(node: dict[str, Any], out: list[tuple[str, str]]) -> None:
    op = str(node.get("operatorType", "")).split("@")[0]
    args = node.get("args") or node.get("arguments") or {}
    out.append((op, str(args.get("Details", ""))))
    for child in node.get("children", []):
        _walk(child, out)


def reduce_plan(root: dict[str, Any]) -> ExplainedPlan:
    ops: list[tuple[str, str]] = []
    _walk(root, ops)
    plan = ExplainedPlan(lines=[f"{op} {details}".strip() for op, details in ops])

    labels: dict[str, str] = {}
    for _, details in ops:
        plan.edge_labels.update(_REL.findall(details))
        for var, label in _VAR_LABEL.findall(_REL.sub("", details)):
            labels.setdefault(var, label)
    plan.node_labels.update(labels.values())

    scanned_vars = {m.group(1) for op, d in ops if op in _SCANS for m in [re.match(r"\s*(\w+)", d)] if m}

    def resolved(details: str) -> set[str]:
        return {f"{labels[v]}.{p}" for v, p in _PROP.findall(details) if v in labels}

    for op, details in ops:
        if "Seek" in op or op.endswith("IndexScan"):
            for _, label, props in _SEEK.findall(details):
                plan.filtered.update(f"{label}.{p.strip()}" for p in props.split(",") if p.strip())
        elif op in _FILTERS:
            props = resolved(details)
            plan.filtered |= props
            plan.scanned |= {f"{labels[v]}.{p}" for v, p in _PROP.findall(details) if v in labels and v in scanned_vars}
        elif op in _ORDERS:
            plan.ordered |= resolved(details)
        elif op in _RETURNS:
            plan.returned |= resolved(details)
    return plan
