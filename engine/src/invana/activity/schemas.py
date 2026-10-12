"""Wire shapes for the change log (docs/for-developers/modules/operate/features/change-log.md).

One shape for every versioned record, so Studio draws one history and one
compare whatever the record is. ``version`` is a string because a model counts
in SemVer and everything else counts in integers.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from invana.apps.modeller.schemas import SchemaDiff
from invana.apps.task_plans.schemas import PlanVersionDiff
from invana.core.events.models import ActorKind

RecordKind = Literal["skill", "rule", "plan", "agent", "model", "dataset"]


class ChangeEffect(BaseModel):
    """What ran on a version — counted, never estimated. Tokens, never currency."""

    #: ``pinned``: runs that recorded this version · ``window``: the Graph's runs
    #: while it was the published one · ``bound``: the loads that bound it.
    basis: Literal["pinned", "window", "bound"]
    runs: int
    failed: int
    tokens_in: int
    tokens_out: int
    #: The span it was the current version: from its publish to the next one's.
    since: datetime | None
    until: datetime | None


class ChangeEntry(BaseModel):
    """One version of a record, with the change that minted it."""

    version: str
    #: The version row's id; null for an agent, which keeps no version rows.
    version_id: str | None
    at: datetime | None
    #: The minting event; null when the version predates its event.
    action: str | None
    event_id: str | None
    actor_id: str | None
    actor_kind: ActorKind | None
    actor_name: str | None
    why: str | None
    #: One line against the version before it.
    summary: str
    effect: ChangeEffect


class RecordHistory(BaseModel):
    """Every version of one record, newest first."""

    record_kind: RecordKind
    record_id: str
    name: str
    items: list[ChangeEntry]


class ChangeField(BaseModel):
    """One field, before and after. ``lines`` is a unified diff for text fields."""

    field: str
    before: Any = None
    after: Any = None
    lines: list[str] = []


class RecordsSummary(BaseModel):
    """How two versions of a dataset differ, counted by record key."""

    added: int
    removed: int
    changed: int


class ChangeCompare(BaseModel):
    """Two versions of one record, from ``a`` to ``b``.

    ``a`` is null when ``b`` is the first version — compared against nothing,
    which is not the same as an empty diff.
    """

    record_kind: RecordKind
    record_id: str
    a: str | None
    b: str
    summary: str
    fields: list[ChangeField]
    #: The records added, removed and changed, for a dataset.
    records: RecordsSummary | None = None
    #: The plan diff, for a plan or for a skill whose two versions drew plans.
    plan: PlanVersionDiff | None = None
    #: The schema diff, for a model.
    schema_diff: SchemaDiff | None = None
