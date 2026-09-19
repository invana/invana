"""Pydantic request/response models for the Skills API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    content: str = Field(default="")
    when_to_use: str = Field(default="")


class SkillUpdate(BaseModel):
    """A rename, a republish, or both.

    Changing any of the three text fields publishes the next version; changing
    only the name does not, because the name is the skill's identity and not
    something a step was ever offered
    ([SK2](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    content: str | None = None
    when_to_use: str | None = None


class SkillVersionPublish(BaseModel):
    """The next version's text. Anything omitted carries over from the head."""

    description: str | None = None
    content: str | None = None
    when_to_use: str | None = None


class SkillVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    skill_id: str
    version: int
    description: str
    content: str
    when_to_use: str
    published_by_id: str | None
    published_at: datetime


class SkillVersionListResponse(BaseModel):
    items: list[SkillVersionRead]
    total: int


class SkillVersionFieldDiff(BaseModel):
    """One field's before and after, as unified-diff lines.

    Lines rather than two blobs: the surface draws a diff, and computing one in
    three places — the API, the CLI and Studio — is three chances to disagree
    about what changed.
    """

    field: str
    changed: bool
    lines: list[str]


class SkillVersionDiff(BaseModel):
    """A version against the one before it — the prose half.

    The plan half arrives with M8, when a version draws one. There is no
    `stale` flag to reconcile: a version is immutable, so its plan can never
    drift from the prose it was drawn from
    ([SK5](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """

    skill_id: str
    version: int
    #: Null when this is v1 — the first version is compared against nothing,
    #: which is not the same as being compared against empty text.
    against_version: int | None
    fields: list[SkillVersionFieldDiff]


class SkillRead(BaseModel):
    """The skill and the text of its current version, flattened.

    ``description`` · ``content`` · ``when_to_use`` read through the head, so a
    caller renders a skill without knowing versions exist; ``version`` and
    ``current_version_id`` are what it needs to say *which* text it got.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    name: str
    version: int
    current_version_id: str | None
    description: str
    content: str
    when_to_use: str
    created_at: datetime
    updated_at: datetime


class SkillListResponse(BaseModel):
    items: list[SkillRead]
    total: int


# ── Rules ─────────────────────────────────────────────────────────────────────


class RuleCreate(BaseModel):
    statement: str = Field(..., min_length=1)
    #: Where it lands in the assembled context. Omitted, it goes last.
    order: int | None = None


class RuleUpdate(BaseModel):
    """A rewording, a reorder, or both.

    Changing the statement publishes the next version; ``order`` and ``active``
    are properties of the rule and are edited in place
    ([RU4](docs/for-developers/modules/skills/features/rules.md)).
    """

    statement: str | None = Field(default=None, min_length=1)
    order: int | None = None


class RuleVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    rule_id: str
    version: int
    statement: str
    published_by_id: str | None
    published_at: datetime


class RuleVersionListResponse(BaseModel):
    items: list[RuleVersionRead]
    total: int


class RuleRead(BaseModel):
    """The rule and the statement of its current version, flattened.

    ``scope`` and ``kind`` are derived from ``project_id``
    ([RU6](docs/for-developers/modules/skills/features/rules.md)) — both words
    are on the surface, neither is a column.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    graph_id: str
    project_id: str | None
    scope: str
    kind: str
    active: bool
    order: int
    version: int
    current_version_id: str | None
    statement: str
    #: Steps that cited any version of this rule — the number under the
    #: statement on the drawer row. `0` on a rule nothing has used yet.
    citations: int = 0
    created_at: datetime
    updated_at: datetime


class RuleCitation(BaseModel):
    """One step that cited this rule, and which wording it read."""

    run_id: str | None
    step_id: str
    label: str
    task_key: str
    rule_version_id: str
    version: int
    statement: str
    finished_at: datetime | None


class RuleCitationsResponse(BaseModel):
    """Where a rule was cited. The count is over every version; each row says
    which wording it read, so deactivating or rewording never rewrites it."""

    rule_id: str
    total: int
    items: list[RuleCitation]


class RuleListResponse(BaseModel):
    items: list[RuleRead]
    total: int
    #: On a Project's list: the Graph invariants it inherits, read-only (C3).
    inherited: list[RuleRead] = Field(default_factory=list)
