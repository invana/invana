"""Annotation rules (docs/for-developers/modules/explore/features/annotations.md).

The whole access model, in four sentences:

- Every member of the Graph reads an annotation whose reach is ``graph``.
- An annotation whose reach is ``session`` is its writer's alone, because the
  session it was written in is private; to anyone else it is absent.
- Only the person who wrote an annotation changes or deletes it. The assistant
  writes into its session's owner's name, so that owner may dismiss it.
- Writing needs the contributor role — the route's area, not a rule here.

No ``fastapi``, no ``select()``, no ``commit()`` (migration-plan §4.1).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.annotations.models import Annotation, AnnotationAnchor
from invana.apps.annotations.querysets import AnnotationQuerySet
from invana.apps.annotations.schemas import (
    AnnotationAuthor,
    AnnotationCreate,
    AnnotationDetail,
    AnnotationRecord,
    AnnotationUpdate,
)
from invana.apps.sessions.querysets import SessionQuerySet
from invana.core.errors import NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

_DEFAULT_COLOR = {"group": "blue"}


class AnnotationManager:
    annotations_qs = AnnotationQuerySet()
    _sessions_qs = SessionQuerySet()

    async def list(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        user_id: str,
        records: list[str] | None = None,
        session_id: str | None = None,
        scope: str = "graph",
        limit: int = 200,
        offset: int = 0,
    ) -> tuple[list[AnnotationDetail], int]:
        """The annotations a member may see, on the given records when named.

        ``scope``: ``session`` — written in ``session_id`` · ``graph`` — the
        graph's, plus this session's own · ``all`` — the graph's and every
        session-only one this member wrote.
        """
        if scope == "session" and not session_id:
            raise ValidationError("scope=session needs a session.")
        filters = {
            "graph_id": graph_id,
            "user_id": user_id,
            "records": records,
            "session_id": session_id,
            "scope": scope,
        }
        items = await self.annotations_qs.list_visible(session, limit=limit, offset=offset, **filters)
        total = await self.annotations_qs.count_visible(session, **filters)
        return await self.details(session, items), total

    async def get(self, session: AsyncSession, *, annotation_id: str, graph_id: str, user_id: str) -> Annotation:
        """An annotation this member may see; anything else reads as absent."""
        a = await self.annotations_qs.get(session, annotation_id)
        if a is None or a.graph_id != graph_id or (a.reach == "session" and a.created_by_id != user_id):
            raise NotFoundError("Annotation not found.")
        return a

    async def create(
        self, session: AsyncSession, *, graph_id: str, user_id: str, payload: AnnotationCreate
    ) -> Annotation:
        if payload.session_id is not None:
            owned = await self._sessions_qs.get(session, payload.session_id)
            if owned is None or owned.graph_id != graph_id or owned.created_by_id != user_id:
                raise NotFoundError("Session not found.")
        records = [r.model_dump() for r in payload.records]
        a = Annotation(
            graph_id=graph_id,
            kind=payload.kind,
            records=records,
            prop=payload.prop,
            value_then=payload.value_then,
            text=payload.text.strip(),
            label=payload.label.strip(),
            color=payload.color or _DEFAULT_COLOR.get(payload.kind, "amber"),
            author_kind="user",
            created_by_id=user_id,
            session_id=payload.session_id,
            reach="graph",
            anchors=[AnnotationAnchor(graph_id=graph_id, record_id=r["id"]) for r in _unique(records)],
        )
        await self.annotations_qs.add(session, a)
        await self._emit(session, actions.ANNOTATION_CREATE, a, user_id, {"kind": a.kind, "records": len(records)})
        return a

    async def update(
        self, session: AsyncSession, *, annotation: Annotation, user_id: str, payload: AnnotationUpdate
    ) -> Annotation:
        if annotation.created_by_id != user_id:
            raise PermissionDeniedError("Only the person who wrote an annotation changes it.")
        changes = payload.model_dump(exclude_unset=True, exclude_none=True)
        if changes.get("reach") == "graph" and annotation.reach == "graph":
            changes.pop("reach")
        elif changes.get("reach") == "graph":
            annotation.promoted_by_id = user_id
        if "text" in changes:
            changes["text"] = changes["text"].strip()
            if annotation.kind in ("note", "value") and not changes["text"]:
                raise ValidationError("An annotation says something.")
        for field, value in changes.items():
            setattr(annotation, field, value)
        await session.flush()
        await self._emit(session, actions.ANNOTATION_UPDATE, annotation, user_id, {"fields": sorted(changes)})
        return annotation

    async def delete(self, session: AsyncSession, *, annotation: Annotation, user_id: str) -> None:
        if annotation.created_by_id != user_id:
            raise PermissionDeniedError("Only the person who wrote an annotation deletes it.")
        details = {"kind": annotation.kind, "author_kind": annotation.author_kind}
        target = (annotation.id, annotation.graph_id)
        await self.annotations_qs.delete(session, annotation)
        await emit_event(
            session,
            action=actions.ANNOTATION_DELETE,
            target_kind=actions.TARGET_ANNOTATION,
            target_id=target[0],
            graph_id=target[1],
            actor_id=user_id,
            details=details,
        )

    async def details(self, session: AsyncSession, items: list[Annotation]) -> list[AnnotationDetail]:
        """Serialise with each writer's name — the assistant's own name when it wrote it."""
        names = await self.annotations_qs.names(session, {a.created_by_id for a in items if a.created_by_id})
        return [self._detail(a, names) for a in items]

    def _detail(self, a: Annotation, names: dict[str, str]) -> AnnotationDetail:
        author = AnnotationAuthor(
            id=a.created_by_id,
            name="Assistant" if a.author_kind == "assistant" else names.get(a.created_by_id or "", "A former member"),
            kind=a.author_kind,  # type: ignore[arg-type]
        )
        return AnnotationDetail(
            id=a.id,
            kind=a.kind,  # type: ignore[arg-type]
            records=[AnnotationRecord.model_validate(r) for r in a.records],
            prop=a.prop,
            value_then=a.value_then,
            text=a.text,
            label=a.label,
            color=a.color,  # type: ignore[arg-type]
            author=author,
            session_id=a.session_id,
            message_id=a.message_id,
            reach=a.reach,  # type: ignore[arg-type]
            promoted_by_id=a.promoted_by_id,
            evidence=a.evidence,
            created_at=a.created_at,
            updated_at=a.updated_at,
        )

    async def _emit(self, session: AsyncSession, action: str, a: Annotation, actor_id: str, details: dict) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_ANNOTATION,
            target_id=a.id,
            graph_id=a.graph_id,
            actor_id=actor_id,
            details=details,
        )


def _unique(records: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out = []
    for r in records:
        if r["id"] not in seen:
            seen.add(r["id"])
            out.append(r)
    return out
