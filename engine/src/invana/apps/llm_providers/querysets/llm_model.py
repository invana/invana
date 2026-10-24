"""Queries against ``llm_models``, and the endpoint reads that join both tables."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.apps.llm_providers.models import LLMModel, LLMModelStatus, LLMProvider
from invana.core.lists import ListParams, PageInfo
from invana.core.lists.querysets import contains, page_of_select


class LLMModelQuerySet:
    async def list_for_provider(
        self, session: AsyncSession, provider_id: str, *, active_only: bool = False
    ) -> list[LLMModel]:
        stmt = select(LLMModel).where(LLMModel.provider_id == provider_id)
        if active_only:
            stmt = stmt.where(LLMModel.status == LLMModelStatus.active.value)
        stmt = stmt.order_by(LLMModel.created_at)
        return list((await session.execute(stmt)).scalars().all())

    async def for_providers(self, session: AsyncSession, provider_ids: list[str]) -> dict[str, list[LLMModel]]:
        """``{provider_id: [models]}`` in one read, each list in the order it was offered."""
        if not provider_ids:
            return {}
        stmt = select(LLMModel).where(LLMModel.provider_id.in_(provider_ids)).order_by(LLMModel.created_at)
        out: dict[str, list[LLMModel]] = {pid: [] for pid in provider_ids}
        for model in (await session.execute(stmt)).scalars().all():
            out[model.provider_id].append(model)
        return out

    async def page_for_provider(
        self, session: AsyncSession, provider_id: str, *, params: ListParams
    ) -> tuple[Sequence[LLMModel], PageInfo]:
        """One page of what an endpoint offers, searched by model id and display name."""
        unfiltered = select(LLMModel).where(LLMModel.provider_id == provider_id)
        stmt = unfiltered
        if statuses := params.values("status"):
            stmt = stmt.where(LLMModel.status.in_(statuses))
        if params.q:
            stmt = stmt.where(contains(params.q, LLMModel.model_id, LLMModel.display_name))
        return await page_of_select(
            session,
            stmt,
            params,
            unfiltered=unfiltered,
            sorts={"created_at": LLMModel.created_at, "model_id": LLMModel.model_id, "updated_at": LLMModel.updated_at},
            id_column=LLMModel.id,
        )

    async def get(self, session: AsyncSession, model_row_id: str) -> LLMModel | None:
        stmt = select(LLMModel).where(LLMModel.id == model_row_id)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def add(self, session: AsyncSession, model: LLMModel) -> LLMModel:
        session.add(model)
        await session.flush()
        return model

    async def delete(self, session: AsyncSession, model: LLMModel) -> None:
        await session.delete(model)

    # ── endpoints: the join that is the unit of a call ───────────────────────

    async def endpoints_for_graph(
        self, session: AsyncSession, graph_id: str, *, active_only: bool = True
    ) -> list[LLMEndpoint]:
        """Every ``(provider, model)`` pair this Graph has configured.

        Ordered by the provider's creation and then the model's, so the address
        list a person reads is the order they built it in — and so the
        ``llm_provider_id`` fallback [PM15] resolves to the *first* model of a
        provider deterministically rather than to whichever row came back.
        """
        stmt = (
            select(LLMProvider, LLMModel)
            .join(LLMModel, LLMModel.provider_id == LLMProvider.id)
            .where(LLMProvider.graph_id == graph_id)
        )
        if active_only:
            stmt = stmt.where(LLMModel.status == LLMModelStatus.active.value)
        stmt = stmt.order_by(LLMProvider.created_at, LLMModel.created_at)
        return [LLMEndpoint(row=provider, model=model) for provider, model in (await session.execute(stmt)).all()]

    async def endpoint_by_model_row(self, session: AsyncSession, model_row_id: str) -> LLMEndpoint | None:
        """The endpoint a run recorded, by the ``llm_models`` id it carries."""
        stmt = (
            select(LLMProvider, LLMModel)
            .join(LLMModel, LLMModel.provider_id == LLMProvider.id)
            .where(LLMModel.id == model_row_id)
        )
        found = (await session.execute(stmt)).first()
        return LLMEndpoint(row=found[0], model=found[1]) if found else None
