"""What the ledger's routes return (docs/for-developers/modules/operate/features/the-ledger.md).

Every number here is counted by the engine over stored rows; Studio formats it.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from invana.core.lists import Filter, ListSpec, Page

#: The windows a ledger read takes.
LEDGER_SINCE = {"today": "today", "24h": "last 24 hours", "7d": "last 7 days", "30d": "last 30 days"}
LEDGER_VERDICTS = {"allowed": "allowed", "refused": "refused", "approval": "approval", "held": "held"}
LEDGER_LAYERS = ("graph", "web", "llm", "secret", "agent", "run", "lens", "access", "rule")
LEDGER_REFUSED_BY = ("grant", "lens", "ceiling", "robots", "policy")

#: The Rows tab. ``actor`` is ``person:<id>`` or ``agent:<id>`` and matches every
#: row whose chain names it; ``act`` takes a ``*`` pattern; ``preset`` is one of
#: the chips over the table.
LEDGER_LIST = ListSpec(
    filters={
        "since": Filter(values=tuple(LEDGER_SINCE), labels=LEDGER_SINCE),
        "actor": Filter(),
        "act": Filter(),
        "layer": Filter(values=LEDGER_LAYERS, title="touched"),
        "run_id": Filter(title="run"),
        "verdict": Filter(values=tuple(LEDGER_VERDICTS), labels=LEDGER_VERDICTS),
        "refused_by": Filter(values=LEDGER_REFUSED_BY, title="refused by"),
        "preset": Filter(
            values=("refused", "writes", "third_party", "secrets", "granted", "people"),
            labels={
                "refused": "refused",
                "writes": "writes",
                "third_party": "third-party reads",
                "secrets": "secrets used",
                "granted": "granted access",
                "people": "people only",
            },
            title="showing",
        ),
    },
    sorts=("-seq",),
    search_title="act or touched",
)


class ChainLink(BaseModel):
    #: ``person`` · ``agent``.
    kind: str
    id: str | None = None
    name: str


class LedgerRowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    seq: int
    at: datetime
    actor_kind: str
    actor_chain: list[ChainLink] = Field(default_factory=list)
    act: str
    layer: str
    touched: str
    touched_line: str
    verdict: str
    refused_by: str | None = None
    rule: str
    run_id: str | None = None
    step_run_id: str | None = None
    run_number: int | None = None
    where: str


class LedgerPage(Page[LedgerRowRead]):
    #: Rows in the same filters the reader may not see — counted, not shown.
    hidden: int = 0


class LedgerPreset(BaseModel):
    key: str
    label: str
    count: int


class LedgerStats(BaseModel):
    """The Rows tab's tiles and chips over ``since``."""

    since: str
    acts: int
    #: The daily mean over the 7 days before, and the change against it.
    acts_7d_mean: float | None = None
    #: Against the 7-day daily mean; ``None`` while that mean is under 10 acts.
    acts_change_pct: float | None = None
    people: int
    people_acts: int
    agents: int
    agent_acts: int
    spawned: int
    refused: int
    refused_by: dict[str, int] = Field(default_factory=dict)
    waiting_approvals: int
    presets: list[LedgerPreset] = Field(default_factory=list)
    hidden: int = 0


class LedgerCustody(BaseModel):
    """One line of a row's chain of custody."""

    #: ``person`` · ``agent`` · ``function`` · ``worker`` · ``lens``.
    kind: str
    name: str
    line: str


class LedgerRowDetail(BaseModel):
    row: LedgerRowRead
    custody: list[LedgerCustody] = Field(default_factory=list)
    args: dict[str, Any] = Field(default_factory=dict)
    hash: str
    prev_hash: str
    #: The chain verified through this row at the last check.
    verified: bool
    verified_at: datetime | None = None
    around: list[LedgerRowRead] = Field(default_factory=list)


class CountRow(BaseModel):
    key: str
    a: int = 0
    b: int = 0
    c: int = 0
    line: str = ""


class LedgerActorRead(BaseModel):
    actor: str
    name: str
    since: str
    acts: int
    writes: int
    writes_refused: int
    third_party: int
    secrets: int
    secret_names: list[str] = Field(default_factory=list)
    refused: int
    refused_by: dict[str, int] = Field(default_factory=dict)
    #: type · read · written · refused.
    graph: list[CountRow] = Field(default_factory=list)
    #: domain · reads · refused.
    web: list[CountRow] = Field(default_factory=list)
    #: model · calls · tokens.
    llm: list[CountRow] = Field(default_factory=list)
    #: agent · how (spawned · delegated) · acts.
    acted_through: list[CountRow] = Field(default_factory=list)


class CanSee(BaseModel):
    worlds: list[str] = Field(default_factory=list)
    people: str = ""
    agents: str = ""
    can_write: str = ""


class LedgerRecordRead(BaseModel):
    address: str
    since: str
    acts: int
    reads: int
    writes: int
    writes_line: str = ""
    refused: int
    refused_line: str = ""
    people: int
    agents: int
    rows: list[LedgerRowRead] = Field(default_factory=list)
    can_see: CanSee = Field(default_factory=CanSee)


class RefusedDay(BaseModel):
    day: date
    refused: int


class RefusalRule(BaseModel):
    rule: str
    refused_by: str
    today: int
    what: str
    who: str
    the_rule: str


class LedgerRefusalsRead(BaseModel):
    refused_today: int
    acts_today: int
    share_pct: float | None = None
    by_grant: int
    by_lens: int
    by_world: int = 0
    by_ceiling: int
    by_robots: int = 0
    by_day: list[RefusedDay] = Field(default_factory=list)
    #: function · refused · rule.
    top_functions: list[CountRow] = Field(default_factory=list)
    by_rule: list[RefusalRule] = Field(default_factory=list)


class LedgerExportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    requested_by_name: str | None = None
    filters_line: str = ""
    format: str
    rows: int
    created_at: datetime


class LedgerIntegrity(BaseModel):
    verified_at: datetime | None = None
    ok: bool = True
    last_seq: int = 0
    broken_seq: int | None = None
    retention_days: int = 365
    rows: int = 0
