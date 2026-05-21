"""DB access layer for ``llm_providers`` rows."""

from __future__ import annotations

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from invana.llm_providers.models import LLMProvider


class LLMProviderStore:
    async def list_for_graph(self, session: AsyncSession, graph_id: str) -> list[LLMProvider]:
        stmt = select(LLMProvider).where(LLMProvider.graph_id == graph_id).order_by(LLMProvider.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, provider_id: str) -> LLMProvider | None:
        stmt = select(LLMProvider).where(LLMProvider.id == provider_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, provider: LLMProvider) -> LLMProvider:
        session.add(provider)
        await session.flush()
        return provider

    async def delete(self, session: AsyncSession, provider: LLMProvider) -> None:
        await session.delete(provider)

    async def clear_default(self, session: AsyncSession, graph_id: str) -> None:
        """Unset ``is_default`` on every row for this Graph."""
        await session.execute(
            update(LLMProvider)
            .where(LLMProvider.graph_id == graph_id)
            .where(LLMProvider.is_default.is_(True))
            .values(is_default=False),
        )
