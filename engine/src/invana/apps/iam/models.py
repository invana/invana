"""IAM records: policies, their versions and attachments, and groups.

docs/for-developers/modules/identity-and-access/features/policies.md ·
features/people-and-groups.md.

Tables
------
- ``policies``            — statements and limits a principal holds; one Graph's.
- ``policy_versions``     — every saved version of a policy, for History.
- ``policy_attachments``  — who holds a policy: a person, a group, an agent or a token.
- ``groups``              — people and agents of one Graph that hold policies together.
- ``group_members``       — a group's people and agents.

A person's managed policies (their Graph roles) stay on ``graph_members.roles``;
every other holding is a ``policy_attachments`` row. Holders are named by kind and
id, so an attachment points at a user, a group, an agent or a token without a
foreign key per kind.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from invana.core.models import Base


def _new_id() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(UTC)


class PolicyKind(enum.StrEnum):
    managed = "managed"
    custom = "custom"
    inline = "inline"
    boundary = "boundary"


class PolicyStatus(enum.StrEnum):
    draft = "draft"
    saved = "saved"


class HolderKind(enum.StrEnum):
    person = "person"
    group = "group"
    agent = "agent"
    token = "token"


class MemberKind(enum.StrEnum):
    person = "person"
    agent = "agent"


class Policy(Base):
    """Statements and limits, held by principals of one Graph."""

    __tablename__ = "policies"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_policies_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Lower-case words joined by dashes; the address a CLI file and a URL use.
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False, default=PolicyKind.custom.value, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=PolicyStatus.saved.value)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    #: ``[{effect, actions, resources, conditions?}]`` — see ``core/policy.py``.
    statements: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    #: Ceilings: ``tokens_month`` · ``tokens_run`` · ``live_agents`` · ``descendants`` · ``depth`` ·
    #: ``worker_seconds_hour`` · ``pools`` · ``may_ask_more``.
    limits: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    #: The saved version; a draft that was never saved is version 0.
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    owner_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    #: ``person`` or ``assistant`` — who wrote the draft.
    drafted_by: Mapped[str] = mapped_column(String(16), nullable=False, default="person")
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class PolicyVersion(Base):
    """One saved version of a policy."""

    __tablename__ = "policy_versions"
    __table_args__ = (UniqueConstraint("policy_id", "version", name="uq_policy_versions_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    policy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    statements: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    limits: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    saved_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    why: Mapped[str | None] = mapped_column(String(500), nullable=True)


class PolicyAttachment(Base):
    """A principal holding a policy — directly, or for a run or until a time."""

    __tablename__ = "policy_attachments"
    __table_args__ = (UniqueConstraint("policy_id", "holder_kind", "holder_id", name="uq_policy_attachments_holder"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    policy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("policies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    holder_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    holder_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    attached_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    attached_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    #: When the holding stops; null is always.
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: The run it was attached for; it ends with that run.
    run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    #: ``direct`` or ``ask`` — attached by a person, or by approving an ask.
    via: Mapped[str] = mapped_column(String(16), nullable=False, default="direct")
    approval_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class Group(Base):
    """People and agents of one Graph that hold policies together."""

    __tablename__ = "groups"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_groups_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class GroupMember(Base):
    """A person or an agent in a group."""

    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "member_kind", "member_id", name="uq_group_members_member"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_kind: Mapped[str] = mapped_column(String(16), nullable=False)
    member_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    added_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
