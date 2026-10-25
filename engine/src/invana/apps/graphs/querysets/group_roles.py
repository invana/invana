"""Graph roles members hold through a group, and the group rows a leaving member takes with them.

A person's roles are their own (``graph_members.roles``) and the managed policies
their groups hold. Groups and policies are IAM's tables, and IAM sits above this
package, so they are declared here — on a private MetaData, so they are real
tables a schema translation reaches — rather than imported.
"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

_iam = sa.MetaData()
_groups = sa.Table("groups", _iam, sa.Column("id"), sa.Column("graph_id"))
_group_members = sa.Table(
    "group_members", _iam, sa.Column("id"), sa.Column("group_id"), sa.Column("member_kind"), sa.Column("member_id")
)
_attachments = sa.Table(
    "policy_attachments",
    _iam,
    sa.Column("policy_id"),
    sa.Column("graph_id"),
    sa.Column("holder_kind"),
    sa.Column("holder_id"),
    sa.Column("ends_at", sa.DateTime(timezone=True)),
    sa.Column("run_id"),
)
_policies = sa.Table("policies", _iam, sa.Column("id"), sa.Column("name"), sa.Column("kind"), sa.Column("status"))


class GroupRoleQuerySet:
    async def group_roles(self, session: AsyncSession, *, graph_id: str, now: datetime) -> dict[str, set[str]]:
        """Per person, the managed policies their groups hold in this Graph now."""
        stmt = (
            select(_group_members.c.member_id, _policies.c.name)
            .select_from(_group_members)
            .join(_groups, _groups.c.id == _group_members.c.group_id)
            .join(
                _attachments,
                and_(_attachments.c.holder_kind == "group", _attachments.c.holder_id == _groups.c.id),
            )
            .join(_policies, _policies.c.id == _attachments.c.policy_id)
            .where(
                _groups.c.graph_id == graph_id,
                _group_members.c.member_kind == "person",
                _policies.c.kind == "managed",
                _policies.c.status == "saved",
                _attachments.c.run_id.is_(None),
                or_(_attachments.c.ends_at.is_(None), _attachments.c.ends_at > now),
            )
        )
        out: dict[str, set[str]] = {}
        for user_id, name in (await session.execute(stmt)).all():
            out.setdefault(user_id, set()).add(name)
        return out

    async def forget_person(self, session: AsyncSession, *, graph_id: str, user_id: str) -> None:
        """A person's group memberships and policy attachments in this Graph."""
        in_graph = select(_groups.c.id).where(_groups.c.graph_id == graph_id)
        await session.execute(
            delete(_group_members).where(
                _group_members.c.member_kind == "person",
                _group_members.c.member_id == user_id,
                _group_members.c.group_id.in_(in_graph),
            )
        )
        await session.execute(
            delete(_attachments).where(
                _attachments.c.graph_id == graph_id,
                _attachments.c.holder_kind == "person",
                _attachments.c.holder_id == user_id,
            )
        )
