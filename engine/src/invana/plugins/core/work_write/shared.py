"""What the ``work_write`` task types share."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def _depth(db: AsyncSession, agent) -> int:
    from invana.runtime.delegation import depth_of

    return await depth_of(db, agent)
