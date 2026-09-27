"""Archive, restore and delete a model (the-model-page.md MP7).

A model that was ever published is archived, never deleted: imports, answers and
stitches resolve against its published versions (CM5), so removing them would
break what already cited them. Archiving is refused while an active stitch binds
the model, because a stitch into an archived model is a link the union no longer
draws.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from invana.apps.modeller.querysets.graph_model import GraphModelQuerySet
from invana.core.errors import ConflictError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import GraphModel


class ModelLifecycleManager:
    def __init__(self) -> None:
        self._models = GraphModelQuerySet()

    async def archive(self, session: AsyncSession, model: GraphModel) -> None:
        bound = await self._models.active_stitches_binding(session, model.graph_id or "", model.id)
        if bound:
            stitches = [
                {
                    "id": link.id,
                    "kind": link.kind,
                    "source": f"{source}.{link.source_type}",
                    "target": f"{target}.{link.target_type}",
                }
                for link, source, target in bound
            ]
            raise ConflictError(
                {
                    "error": "archive_has_active_stitches",
                    "message": f'"{model.name}" is bound by {len(stitches)} active '
                    f"stitch{'es' if len(stitches) != 1 else ''} — remove them before archiving it.",
                    "stitches": stitches,
                }
            )
        model.status = "archived"
        await session.flush()

    async def restore(self, session: AsyncSession, model: GraphModel) -> None:
        model.status = "active" if await self._models.was_published(session, model.id) else "draft"
        await session.flush()

    async def ensure_deletable(self, session: AsyncSession, model: GraphModel) -> None:
        if await self._models.was_published(session, model.id):
            raise ConflictError(
                {
                    "error": "delete_has_published_version",
                    "message": f'"{model.name}" has a published version — archive it instead; '
                    "what cited it still resolves.",
                }
            )
