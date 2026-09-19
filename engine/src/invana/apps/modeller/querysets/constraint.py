"""Queries against ``constraint_definitions``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import (
    ConstraintDefinition,
)

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession
from invana.apps.modeller.querysets.base import VersionScopedQuerySet


class ConstraintQuerySet(VersionScopedQuerySet):
    async def create_constraint(
        self,
        session: AsyncSession,
        *,
        version_id: str,
        name: str,
        target_kind: str,
        target_label: str,
        constraint_type: str,
        properties: list[str],
    ) -> ConstraintDefinition:
        await self._ensure_draft(session, version_id)
        constraint = ConstraintDefinition(
            version_id=version_id,
            name=name,
            target_kind=target_kind,
            target_label=target_label,
            constraint_type=constraint_type,
            properties=properties,
        )
        session.add(constraint)
        await session.flush()
        return constraint

    async def get_constraint(self, session: AsyncSession, constraint_id: str) -> ConstraintDefinition | None:
        stmt = select(ConstraintDefinition).where(ConstraintDefinition.id == constraint_id)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_constraints(self, session: AsyncSession, version_id: str) -> list[ConstraintDefinition]:
        stmt = select(ConstraintDefinition).where(ConstraintDefinition.version_id == version_id)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    async def delete_constraint(self, session: AsyncSession, constraint_id: str) -> bool:
        constraint = await self.get_constraint(session, constraint_id)
        if constraint is None:
            return False
        await self._ensure_draft(session, constraint.version_id)
        await session.delete(constraint)
        await session.flush()
        return True

    # ------------------------------------------------------------------
    # Index CRUD
    # ------------------------------------------------------------------
