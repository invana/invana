"""The six managed policies — the Graph roles, written as statements.

docs/for-developers/modules/identity-and-access/features/policies.md (PO2 · PO3).
Every Graph holds one row of each, written by ``PolicyManager.ensure_managed``
from this table and rewritten from it on every start, so the code is their source.

A managed policy's statements say what a run its holder starts may do; its
``area`` is the part of the Graph a holder may change
(``apps/graphs/roles.py``). Holding ``builder`` is holding the role.

Pure: no database.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Managed:
    name: str
    description: str
    #: What the Policies list's *What it allows* column reads.
    summary: str
    area: str | None
    statements: tuple[dict, ...]


def _allow(actions: list[str], resources: list[str]) -> dict:
    return {"effect": "allow", "actions": actions, "resources": resources}


MANAGED: tuple[Managed, ...] = (
    Managed(
        name="viewer",
        description="Every member: read the Graph, ask, and let a run read and think.",
        summary="read and ask",
        area="ask",
        statements=(
            _allow(["graph.read.*", "graph.stitch.preview"], ["graph/*"]),
            _allow(["llm.call"], ["llm/*"]),
            _allow(["web.*", "science.*", "mail.read"], ["third_party/*"]),
        ),
    ),
    Managed(
        name="contributor",
        description="Projects and tasks, and the work a run hands on.",
        summary="projects, tasks and data edits",
        area="work",
        statements=(
            _allow(["work.*"], ["agent/*", "project/*"]),
            _allow(["graph.write.edits"], ["graph/*"]),
        ),
    ),
    Managed(
        name="builder",
        description="Agents, skills, evals, flows and templates.",
        summary="agents, skills, evals",
        area="build",
        statements=(_allow(["work.spawn_agent", "work.delegate"], ["agent/*"]),),
    ),
    Managed(
        name="modeller",
        description="Models, stitches, rules and guardrails, and the writes that load and stitch the graph.",
        summary="models, rules and graph writes",
        area="model",
        statements=(_allow(["graph.write.*", "graph.stitch.*", "model.*", "data.*"], ["graph/*"]),),
    ),
    Managed(
        name="owner",
        description="Members and settings; everything a run may do.",
        summary="members and settings",
        area="settings",
        statements=(_allow(["*"], ["*"]),),
    ),
    Managed(
        name="iam-admin",
        description="People, groups, policies and tokens.",
        summary="people, policies and tokens",
        area="iam",
        statements=(),
    ),
)

MANAGED_BY_NAME: dict[str, Managed] = {m.name: m for m in MANAGED}
MANAGED_NAMES: tuple[str, ...] = tuple(m.name for m in MANAGED)
