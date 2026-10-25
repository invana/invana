"""What a narrowed token's request is, in the policy grammar — and whether its policy allows it.

docs/for-developers/modules/identity-and-access/features/tokens.md. A token
narrowed by an inline policy reaches only the routes this table names, each read
as one action on one resource; every other route is refused, and so is a mapped
route whose action the inline policy does not allow. The holder's own rights
still apply on top — this check only ever takes away.

The table is keyed by the route **template** the request matched
(``/api/v1/datasets/{publisher}/{name}/versions/drafts``), never the concrete
URL, so a value in the path cannot steer it::

    refusal = check(statements, "POST", route.path, request.path_params, token="ci", policy="token-ci")
    if refusal is not None:
        ...  # 403 token_narrowed, with the message

=========================================================  ========================  ============================
Route                                                      Action                    Resource
=========================================================  ========================  ============================
``GET /api/v1/auth/me``                                    always allowed            —
``GET · HEAD`` under ``/api/v1/u/{username}/{graphSlug}``  ``graph.read.api``        ``graph/*``
``GET · HEAD`` under ``/api/v1/datasets``                  ``data.read``             ``dataset/<p>/<n>`` · ``dataset/*``
``POST …/{publisher}/{name}/versions/drafts``              ``data.version.draft``    ``dataset/<p>/<n>``
``POST …/{publisher}/{name}/versions/{version}/publish``   ``data.version.publish``  ``dataset/<p>/<n>``
=========================================================  ========================  ============================

Pure: no database, no request.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final

from invana.core.policy import Statement, allows, summary

GRAPH_PREFIX: Final = "/api/v1/u/{username}/{graphSlug}"
DATASETS_PREFIX: Final = "/api/v1/datasets"
READ_METHODS: Final = frozenset({"GET", "HEAD"})


@dataclass(frozen=True, slots=True)
class RouteAction:
    """One row of the table: a method and route template, and the action it is."""

    methods: frozenset[str]
    path: str
    action: str
    #: ``prefix`` matches every route under ``path``; ``exact`` only ``path`` itself.
    match: str = "exact"


#: Allowed whatever the inline policy says — the token may always ask who it is.
ALWAYS: Final = ("*", "*")

ROUTE_ACTIONS: tuple[RouteAction, ...] = (
    RouteAction(frozenset({"GET"}), "/api/v1/auth/me", "always"),
    RouteAction(frozenset({"POST"}), f"{DATASETS_PREFIX}/{{publisher}}/{{name}}/versions/drafts", "data.version.draft"),
    RouteAction(
        frozenset({"POST"}),
        f"{DATASETS_PREFIX}/{{publisher}}/{{name}}/versions/{{version}}/publish",
        "data.version.publish",
    ),
    RouteAction(READ_METHODS, DATASETS_PREFIX, "data.read", match="prefix"),
    RouteAction(READ_METHODS, GRAPH_PREFIX, "graph.read.api", match="prefix"),
)


def _route_matches(row: RouteAction, method: str, route_path: str) -> bool:
    if method not in row.methods:
        return False
    if row.match == "exact":
        return route_path == row.path
    return route_path == row.path or route_path.startswith(row.path + "/")


def _resource(action: str, params: Mapping[str, Any]) -> str:
    if action.startswith("data."):
        publisher, name = params.get("publisher"), params.get("name")
        return f"dataset/{publisher}/{name}" if publisher and name else "dataset/*"
    return "graph/*"


def action_for(method: str, route_path: str, path_params: Mapping[str, Any]) -> tuple[str, str] | None:
    """The ``(action, resource)`` a request is, :data:`ALWAYS` for ``/auth/me``, or ``None``.

    ``None`` means the route is not one a narrowed token can reach.
    """
    verb = method.upper()
    for row in ROUTE_ACTIONS:
        if _route_matches(row, verb, route_path):
            if row.action == "always":
                return ALWAYS
            return row.action, _resource(row.action, path_params)
    return None


def check(
    statements: Sequence[Statement],
    method: str,
    route_path: str,
    path_params: Mapping[str, Any],
    *,
    token: str = "this token",
    policy: str = "its inline policy",
) -> str | None:
    """The refusal message for a narrowed token's request, or ``None`` when it is allowed."""
    mapped = action_for(method, route_path, path_params)
    if mapped is ALWAYS:
        return None
    head = f"Token {token!r} is narrowed by {policy!r}; it allows {summary(statements) or 'nothing'}"
    if mapped is None:
        return f"{head}. {method.upper()} {route_path} is not a route a narrowed token can reach."
    action, resource = mapped
    if allows(statements, action=action, resource=resource) is None:
        return f"{head}, not {action} on {resource}."
    return None
