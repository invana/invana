"""The policy grammar and the one evaluator every access check uses.

docs/for-developers/modules/identity-and-access/features/policies.md. A policy
is a list of **statements**; each one allows some actions on some resources,
under optional conditions. There is no ``deny``: what no statement allows is
refused. The same function answers the dispatch check, Test access, the effective
access matrix, a narrowed token's request and a policy's impact, so all five
always agree::

    statements = parse_statements(policy.statements)
    hit = allows(statements, action="graph.read.query", resource="graph/Fare/*", bound="graph_read")
    if hit is None:
        ...  # refused by this policy

A resource names its layer as its first segment — ``graph/Fare/LHR-JFK``,
``llm/anthropic/claude-haiku-5-5``, ``third_party/web/example.com``,
``agent/Fare Scout``, ``dataset/acme/airports``. A glob's ``*`` matches any run
of characters, dots and slashes included. The action ``llm.call`` matches every
function whose bound is ``llm``.

A resource may carry one field after `` · `` (``graph/Fare/LHR-JFK · price``),
which is what a ``fields`` condition reads.

Pure: no database, no request.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from fnmatch import fnmatchcase
from typing import Any

#: The layers, in the order the Statements table draws them, with their line.
LAYERS: tuple[tuple[str, str, str], ...] = (
    ("graph", "graph data", "records in the Graph"),
    ("llm", "llm", "models it may think with"),
    ("third_party", "third party", "the web and MCP servers"),
    ("cache", "cache", "what runs keep between steps"),
    ("human", "human", "the people it may ask"),
    ("agent", "agents", "who it may spawn and delegate to"),
    ("project", "projects", "a project's records"),
    ("dataset", "datasets", "datasets above the Graph"),
)
LAYER_NAMES: frozenset[str] = frozenset(name for name, _, _ in LAYERS)
CONDITIONS: frozenset[str] = frozenset({"fields", "depth", "until"})
#: The action that stands for every function of the ``llm`` bound.
LLM_CALL = "llm.call"
FIELD_SEPARATOR = " · "


class StatementError(ValueError):
    """A statement outside the grammar; the message names what is wrong."""


@dataclass(frozen=True, slots=True)
class Statement:
    """One ``allow`` statement."""

    actions: tuple[str, ...]
    resources: tuple[str, ...]
    conditions: dict[str, Any] = field(default_factory=dict)

    @property
    def layer(self) -> str:
        """The layer of its first resource — the group the Statements table puts it in."""
        return layer_of(self.resources[0]) if self.resources else "graph"

    def as_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {"effect": "allow", "actions": list(self.actions), "resources": list(self.resources)}
        if self.conditions:
            out["conditions"] = dict(self.conditions)
        return out


def layer_of(resource: str) -> str:
    """The layer a resource address names; ``*`` and an unknown head read as ``graph``."""
    head = resource.split("/", 1)[0].strip()
    return head if head in LAYER_NAMES else "graph"


def split_field(resource: str) -> tuple[str, str | None]:
    """``graph/Fare/x · price`` → (``graph/Fare/x``, ``price``)."""
    if FIELD_SEPARATOR in resource:
        address, name = resource.split(FIELD_SEPARATOR, 1)
        return address.strip(), name.strip() or None
    return resource.strip(), None


def parse_statement(raw: Any, *, index: int = 0) -> Statement:
    """One statement from its stored shape, or :class:`StatementError` naming the problem."""
    where = f"statement {index + 1}"
    if not isinstance(raw, dict):
        raise StatementError(f"{where} is not an object.")
    effect = raw.get("effect", "allow")
    if effect != "allow":
        raise StatementError(f"{where}: the only effect is allow — what no statement allows is refused.")
    actions = _strings(raw.get("actions"), f"{where} actions")
    resources = _strings(raw.get("resources"), f"{where} resources")
    for resource in resources:
        head = resource.split("/", 1)[0]
        if resource != "*" and head not in LAYER_NAMES:
            known = " · ".join(name for name, _, _ in LAYERS)
            raise StatementError(f"{where}: {resource!r} names no layer. The layers are {known}.")
    conditions = raw.get("conditions") or {}
    if not isinstance(conditions, dict):
        raise StatementError(f"{where} conditions is not an object.")
    unknown = sorted(set(conditions) - CONDITIONS)
    if unknown:
        names = ", ".join(unknown)
        raise StatementError(f"{where}: {names} is not a condition. Conditions are fields · depth · until.")
    _check_conditions(conditions, where)
    return Statement(actions=tuple(actions), resources=tuple(resources), conditions=dict(conditions))


def parse_statements(raw: Iterable[Any] | None) -> list[Statement]:
    return [parse_statement(item, index=i) for i, item in enumerate(raw or [])]


def _strings(value: Any, what: str) -> list[str]:
    if not isinstance(value, list) or not value:
        raise StatementError(f"{what} must be a non-empty list.")
    out = [str(v).strip() for v in value]
    if any(not v for v in out):
        raise StatementError(f"{what} has an empty entry.")
    return out


def _check_conditions(conditions: dict[str, Any], where: str) -> None:
    fields = conditions.get("fields")
    if fields is not None:
        if not isinstance(fields, dict) or set(fields) - {"only", "except"} or not fields:
            raise StatementError(f"{where}: fields takes only or except, a list of property names.")
        for names in fields.values():
            if not isinstance(names, list) or not all(isinstance(n, str) and n for n in names):
                raise StatementError(f"{where}: fields lists property names.")
    depth = conditions.get("depth")
    if depth is not None and (not isinstance(depth, dict) or not isinstance(depth.get("max"), int)):
        raise StatementError(f"{where}: depth takes max, a whole number of spawn levels.")
    until = conditions.get("until")
    if until is not None:
        try:
            datetime.fromisoformat(str(until))
        except ValueError as exc:
            raise StatementError(f"{where}: until is an ISO instant.") from exc


def action_matches(pattern: str, action: str, *, bound: str | None = None) -> bool:
    if pattern == LLM_CALL and bound == "llm":
        return True
    return fnmatchcase(action, pattern)


def resource_matches(pattern: str, resource: str) -> bool:
    """Whether ``pattern`` covers ``resource``.

    A bare layer (``graph``) stands for a resource not known before the step
    runs: a statement covers it when any of its resources is in that layer.
    """
    if pattern == "*":
        return True
    if "/" not in resource:
        return layer_of(pattern) == resource
    return fnmatchcase(resource, pattern) or fnmatchcase(resource, pattern.rstrip("*").rstrip("/"))


def _conditions_hold(conditions: dict[str, Any], *, field_name: str | None, depth: int | None, now: datetime) -> bool:
    fields = conditions.get("fields")
    if fields is not None and field_name is not None:
        if "only" in fields and field_name not in fields["only"]:
            return False
        if "except" in fields and field_name in fields["except"]:
            return False
    depth_rule = conditions.get("depth")
    if depth_rule is not None and (depth is None or depth > int(depth_rule["max"])):
        return False
    until = conditions.get("until")
    if until is not None:
        end = datetime.fromisoformat(str(until))
        if end.tzinfo is None:
            end = end.replace(tzinfo=UTC)
        if now >= end:
            return False
    return True


def allows(
    statements: Sequence[Statement],
    *,
    action: str,
    resource: str,
    bound: str | None = None,
    depth: int | None = None,
    now: datetime | None = None,
) -> Statement | None:
    """The first statement that allows ``action`` on ``resource``, else ``None``.

    ``resource`` may carry a field (`` · price``), which a ``fields`` condition
    reads. ``depth`` is the caller's spawn depth (0 for a lead agent), which a
    ``depth`` condition reads; a depth condition with no depth given does not
    allow.
    """
    address, field_name = split_field(resource)
    moment = now or datetime.now(UTC)
    for statement in statements:
        if not any(action_matches(p, action, bound=bound) for p in statement.actions):
            continue
        if not any(resource_matches(p, address) for p in statement.resources):
            continue
        if _conditions_hold(statement.conditions, field_name=field_name, depth=depth, now=moment):
            return statement
    return None


def narrower_than(inner: Sequence[Statement], outer: Sequence[Statement]) -> list[str]:
    """The action-and-resource pairs of ``inner`` that ``outer`` does not allow.

    What *never wider than the holder* checks when a token is narrowed: every
    concrete pair a narrowing statement names must be allowed by the holder.
    A glob in the narrowing is checked as written, so ``graph.read.*`` needs a
    statement whose own pattern covers ``graph.read.*``.
    """
    missing: list[str] = []
    for statement in inner:
        for action in statement.actions:
            for resource in statement.resources:
                if allows(outer, action=action, resource=resource, depth=0) is None:
                    missing.append(f"{action} on {resource}")
    return missing


def summary(statements: Sequence[Statement], *, limit: int = 3) -> str:
    """A short line of what statements allow — ``graph.read.* · web.read_url``."""
    seen: list[str] = []
    for statement in statements:
        for action in statement.actions:
            if action not in seen:
                seen.append(action)
    head = " · ".join(seen[:limit])
    return f"{head} · {len(seen) - limit} more" if len(seen) > limit else head
