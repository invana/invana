"""Queries against ``model_publish_reviews``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import select

from invana.apps.modeller.models import ModelPublishReview

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

#: A review in one of these is still moving; a model holds at most one.
OPEN_STATUSES = ("previewing", "pending", "migrating")


class PublishReviewQuerySet:
    async def add(self, session: AsyncSession, row: ModelPublishReview) -> ModelPublishReview:
        session.add(row)
        await session.flush()
        return row

    async def get(self, session: AsyncSession, *, review_id: str) -> ModelPublishReview | None:
        return await session.get(ModelPublishReview, review_id)

    async def for_model(self, session: AsyncSession, *, model_id: str) -> list[ModelPublishReview]:
        stmt = (
            select(ModelPublishReview)
            .where(ModelPublishReview.model_id == model_id)
            .order_by(ModelPublishReview.created_at.desc())
        )
        return list((await session.execute(stmt)).scalars())

    async def open_for_model(self, session: AsyncSession, *, model_id: str) -> ModelPublishReview | None:
        stmt = select(ModelPublishReview).where(
            ModelPublishReview.model_id == model_id, ModelPublishReview.status.in_(OPEN_STATUSES)
        )
        return (await session.execute(stmt)).scalars().first()

    async def open_locked(self, session: AsyncSession) -> list[ModelPublishReview]:
        """Every open review, locked so two engine processes never move one twice."""
        stmt = (
            select(ModelPublishReview)
            .where(ModelPublishReview.status.in_(OPEN_STATUSES))
            .order_by(ModelPublishReview.created_at)
            .with_for_update(skip_locked=True)
        )
        return list((await session.execute(stmt)).scalars())
