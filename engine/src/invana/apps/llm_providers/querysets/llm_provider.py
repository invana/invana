"""Queries against ``llm_providers``."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.llm_providers.models import LLMProvider


class LLMProviderQuerySet:
    async def list_for_graph(self, session: AsyncSession, graph_id: str) -> list[LLMProvider]:
        stmt = select(LLMProvider).where(LLMProvider.graph_id == graph_id).order_by(LLMProvider.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def get(self, session: AsyncSession, provider_id: str) -> LLMProvider | None:
        stmt = select(LLMProvider).where(LLMProvider.id == provider_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_by_name(self, session: AsyncSession, graph_id: str, name: str) -> LLMProvider | None:
        """By the address segment — what a rule and a refusal both carry (PM10)."""
        stmt = select(LLMProvider).where(LLMProvider.graph_id == graph_id, LLMProvider.name == name)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, provider: LLMProvider) -> LLMProvider:
        session.add(provider)
        await session.flush()
        return provider

    async def delete(self, session: AsyncSession, provider: LLMProvider) -> None:
        await session.delete(provider)
