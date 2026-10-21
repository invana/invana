"""Graph roles and the one table that says which role each write needs.

docs/for-developers/modules/identity-and-access/features/roles.md. A member of a
Graph reads everything in it; a **Graph role** is the right to change one
**area** of it. Five roles, held as a set:

    viewer       ask — sessions, Explorer, boards, a run's answer · cancel · rerun
    contributor  work — projects and tasks
    builder      build — agents, skills, evals, task plans, templates
    modeller     model — models, links, rules, guardrails, dataset bindings
    owner        settings — the Graph, its connection, providers, members

``owner`` implies the other four, and every member holds ``viewer``.

The area is read off the route a request matched — never named by the route
itself — so one table here governs every graph-scoped write:

    area = area_for("POST", "/api/v1/u/{username}/{graphSlug}/models/{model_id}/commit")
    # -> Area(name="model", role=GraphRole.modeller)
    holds(member.roles, area.role)

A read (``GET`` · ``HEAD`` · ``OPTIONS``) has no area and is open to every
member. A write whose path the table does not name returns ``None``; the guard
treats that as ``owner``, and a golden test lists every graph-scoped write route
so a new one cannot land unnamed.

Pure: no database, no request.
"""

from __future__ import annotations

import enum
from collections.abc import Iterable
from dataclasses import dataclass

GRAPH_PREFIX = "/api/v1/u/{username}/{graphSlug}"
READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class GraphRole(enum.StrEnum):
    viewer = "viewer"
    contributor = "contributor"
    builder = "builder"
    modeller = "modeller"
    owner = "owner"


# Canonical order — how a set of roles is stored and listed.
ROLE_ORDER: tuple[GraphRole, ...] = tuple(GraphRole)


@dataclass(frozen=True)
class Area:
    """A part of a Graph one role may change."""

    name: str
    role: GraphRole
    label: str


ASK = Area("ask", GraphRole.viewer, "Asking and exploring")
WORK = Area("work", GraphRole.contributor, "Projects and tasks")
BUILD = Area("build", GraphRole.builder, "Agents, skills and evals")
MODEL = Area("model", GraphRole.modeller, "Models, rules and guardrails")
SETTINGS = Area("settings", GraphRole.owner, "Members and settings")

AREAS: tuple[Area, ...] = (ASK, WORK, BUILD, MODEL, SETTINGS)

# Path prefixes after the Graph, first match wins — so a narrower prefix sits
# above the broader one it carves out of. ``*`` matches one path segment.
_POLICY: tuple[tuple[tuple[str, ...], Area], ...] = (
    (("runs", "*", "emissions", "*", "template"), BUILD),
    (("projects", "*", "rules"), MODEL),
    (("connection", "ping"), ASK),
    (("connection", "introspect"), MODEL),
    (("runs",), ASK),
    (("sessions",), ASK),
    (("explorer",), ASK),
    (("boards",), ASK),
    (("notifications", "read"), ASK),
    (("approvals",), ASK),
    (("projects",), WORK),
    (("data-edits",), WORK),
    (("annotations",), WORK),
    (("tasks",), WORK),
    (("schedules",), WORK),
    (("agents",), BUILD),
    (("skills",), BUILD),
    (("evals",), BUILD),
    (("task-plans",), BUILD),
    (("projection-templates",), BUILD),
    (("catalogue",), BUILD),
    (("models",), MODEL),
    (("model-links",), MODEL),
    (("rules",), MODEL),
    (("govern",), MODEL),
    (("dataset-bindings",), MODEL),
    (("schema",), MODEL),
    (("global-model",), MODEL),
    (("connection",), SETTINGS),
    (("setup",), SETTINGS),
    (("default-agent",), SETTINGS),
    (("llm",), SETTINGS),
    (("members",), SETTINGS),
    (("notifications",), SETTINGS),
    ((), SETTINGS),  # the Graph itself: PATCH · DELETE
)


def _matches(pattern: tuple[str, ...], segments: list[str]) -> bool:
    if not pattern:
        return not segments
    if len(segments) < len(pattern):
        return False
    return all(p in ("*", s) for p, s in zip(pattern, segments, strict=False))


def area_for(method: str, path: str) -> Area | None:
    """The area a write to ``path`` (a route template) changes; ``None`` for a read
    or a path the table does not name."""
    if method.upper() in READ_METHODS or not path.startswith(GRAPH_PREFIX):
        return None
    segments = [s for s in path[len(GRAPH_PREFIX) :].split("/") if s]
    for pattern, area in _POLICY:
        if _matches(pattern, segments):
            return area
    return None


def holds(roles: Iterable[str], role: GraphRole | str) -> bool:
    """Whether a member holding ``roles`` may act as ``role``."""
    wanted = GraphRole(role)
    held = set(roles)
    return wanted is GraphRole.viewer or GraphRole.owner.value in held or wanted.value in held


def normalise(roles: Iterable[str]) -> list[str]:
    """A role set as stored: known names only, canonical order, never empty.

    ``viewer`` is the floor every member holds, so it is stored alone or not at
    all. Raises ``ValueError`` naming an unknown role.
    """
    names = set()
    for raw in roles:
        name = str(raw).strip().lower()
        try:
            names.add(GraphRole(name))
        except ValueError:
            known = " · ".join(r.value for r in ROLE_ORDER)
            raise ValueError(f"{raw!r} is not a Graph role. The roles are {known}.") from None
    names.discard(GraphRole.viewer)
    if not names:
        return [GraphRole.viewer.value]
    return [r.value for r in ROLE_ORDER if r in names]
