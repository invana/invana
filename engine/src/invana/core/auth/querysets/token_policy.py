"""The inline policy a narrowed personal access token carries.

``core`` may not import ``apps.iam``, so the ``policies`` table is read by name
from the shared metadata — registered by the time any request runs — reading
only the columns the credential check needs: its name and its statements. A
lightweight table clause stands in when the metadata lacks it.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from invana.core.models import Base

_FALLBACK = sa.table(
    "policies",
    sa.column("id", sa.String),
    sa.column("name", sa.String),
    sa.column("statements", sa.JSON),
)


def _policies() -> sa.TableClause:
    # The registered Table honours a schema translation; a bare table clause does not.
    return Base.metadata.tables.get("policies", _FALLBACK)


class TokenPolicyQuerySet:
    async def get(self, session: AsyncSession, policy_id: str) -> tuple[str, list[Any]] | None:
        """``(name, statements)`` of one policy, or ``None`` when it is gone."""
        table = _policies()
        stmt = sa.select(table.c.name, table.c.statements).where(table.c.id == policy_id)
        row = (await session.execute(stmt)).first()
        return (row[0], list(row[1] or [])) if row is not None else None
