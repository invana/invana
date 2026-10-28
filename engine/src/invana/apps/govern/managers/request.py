"""The rules about a request — filing where an ask fails, and resolving it.

A request is filed **by the engine**, at the place an ask fails: a guardrail
refusal in a graph read, a run that ended *cannot answer · outside this graph*,
or an explicit *Ask for a change*. Studio never derives one from a run.

The same open ask is one request: matched on Graph, kind, asker (a person or an
agent) and the ask's text, a repeat adds to ``asks`` and moves
``last_asked_at`` rather than filing a second row, so the inbox is one line per
gap.

Resolving needs the modeller role and has three outcomes:

==============  ==============================================================
``decline``     done, declined
``allow``       a guardrail request only — the world goes into the guardrail's
                ``allowed_in``, so runs asked there no longer carry it
``model``       done, modelled — optionally naming the model it was modelled in
==============  ==============================================================

What resolving did is written into ``resolution_note`` at resolve, so a done row
reads it back rather than reconstructing it.

Usage::

    requests = RequestManager()
    row = await requests.file(session, graph_id=g, kind=RequestKind.guardrail, title=ask,
                              source=RequestSource.explorer, asked_by_id=user_id, guardrail=lens)
    await requests.resolve(session, request=row, payload=RequestResolve(action="decline"),
                           actor_id=modeller_id, may_resolve=True)
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.models import (
    Lens,
    LensKind,
    Request,
    RequestKind,
    RequestResolution,
    RequestSource,
    RequestStatus,
)
from invana.apps.govern.querysets import LensQuerySet, RequestQuerySet
from invana.apps.govern.schemas import RequestCreate, RequestPage, RequestRead, RequestResolve
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event
from invana.core.lists import AppliedFilter, ListParams, PageInfo

log = logging.getLogger(__name__)

#: What opened a run, read as who asked: a person at a surface, or an agent on
#: its own (a schedule, an assignment, a delegation, an MCP call).
_AGENT_TRIGGERS = frozenset({"schedule", "task", "delegation", "mcp"})


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class Asker:
    """Who a failed ask is filed against, and where it came from."""

    source: RequestSource
    asked_by_id: str | None = None
    agent_id: str | None = None


def asker_of(*, triggered_by: str | None, author_id: str | None, agent_id: str | None, in_session: bool) -> Asker:
    """Who asked, from the run that failed.

    A person asked when they opened the run themselves — from a session that is
    Explorer, otherwise the API. A run a schedule, an assignment, a delegation
    or an MCP call opened was asked by its agent, so repeats of it merge on the
    agent rather than on whoever the schedule runs on behalf of.
    """
    if triggered_by in _AGENT_TRIGGERS and agent_id:
        source = RequestSource.schedule if triggered_by == "schedule" else RequestSource.agent
        return Asker(source=source, agent_id=agent_id)
    return Asker(source=RequestSource.explorer if in_session else RequestSource.api, asked_by_id=author_id)


class RequestManager:
    requests_qs = RequestQuerySet()
    lenses_qs = LensQuerySet()

    # ── filing ───────────────────────────────────────────────────────────────

    async def file(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        kind: RequestKind,
        title: str,
        source: RequestSource,
        detail: str | None = None,
        asked_by_id: str | None = None,
        agent_id: str | None = None,
        run_id: str | None = None,
        session_id: str | None = None,
        guardrail: Lens | None = None,
    ) -> Request:
        """File the ask, or add to the open request it repeats.

        A repeat keeps the first filing's text and moves ``last_asked_at``; the
        run and the detail follow the latest ask, so the row opens the most
        recent failure.
        """
        cleaned = (title or "").strip()[:512] or "An ask the Graph could not serve"
        existing = await self.requests_qs.open_match(
            session,
            graph_id=graph_id,
            kind=kind.value,
            title=cleaned,
            asked_by_id=asked_by_id,
            agent_id=agent_id,
        )
        if existing is not None:
            existing.asks += 1
            existing.last_asked_at = _now()
            existing.run_id = run_id or existing.run_id
            existing.session_id = session_id or existing.session_id
            existing.detail = detail or existing.detail
            if guardrail is not None:
                existing.guardrail_id = guardrail.id
                existing.blocked_by = guardrail.display_name
            await session.flush()
            return existing

        row = Request(
            graph_id=graph_id,
            kind=kind.value,
            title=cleaned,
            detail=detail,
            source=source.value,
            asked_by_id=asked_by_id,
            agent_id=agent_id,
            run_id=run_id,
            session_id=session_id,
            guardrail_id=guardrail.id if guardrail is not None else None,
            blocked_by=guardrail.display_name if guardrail is not None else None,
            last_asked_at=_now(),
        )
        await self.requests_qs.add(session, row)
        await emit_event(
            session,
            action=actions.REQUEST_CREATE,
            target_kind=actions.TARGET_REQUEST,
            target_id=row.id,
            graph_id=graph_id,
            actor_id=asked_by_id,
            actor_kind=ActorKind.user if asked_by_id else ActorKind.system,
            run_id=run_id,
            details={"kind": row.kind, "title": row.title, "blocked_by": row.blocked_by, "source": row.source},
        )
        return row

    async def file_quietly(self, session: AsyncSession, **kwargs) -> Request | None:
        """:meth:`file`, inside a savepoint, never raising.

        Filing is bookkeeping beside a run that has already reached its
        outcome; a failure to file is logged and the run ends as it would have.
        """
        try:
            async with session.begin_nested():
                return await self.file(session, **kwargs)
        except Exception as exc:
            log.warning("could not file a request", exc_info=exc, extra={"graph_id": kwargs.get("graph_id")})
            return None

    async def ask(self, session: AsyncSession, *, graph_id: str, payload: RequestCreate, actor_id: str) -> Request:
        """An explicit *Ask for a change*, by the caller."""
        return await self.file(
            session,
            graph_id=graph_id,
            kind=RequestKind.change,
            title=payload.title,
            detail=payload.detail,
            source=RequestSource(payload.source),
            asked_by_id=actor_id,
        )

    # ── reading ──────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, graph_id: str, request_id: str) -> Request:
        row = await self.requests_qs.get(session, request_id)
        if row is None or row.graph_id != graph_id:
            raise NotFoundError("Request not found.")
        return row

    async def page(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        params: ListParams,
        applied: list[AppliedFilter],
        agent_names: Callable[[list[Request]], Awaitable[dict[str, str]]],
        may_resolve: bool,
    ) -> RequestPage:
        """One page of the inbox, with the Graph's open count whatever the filter.

        ``agent_names`` resolves the page's agents to their names — the caller
        owns that read, because agents sit above Govern.
        """
        rows, info = await self.requests_qs.page(session, graph_id=graph_id, params=params)
        return self._page(
            await self.reads(session, rows, agent_names=await agent_names(rows)),
            info,
            applied,
            open_count=await self.requests_qs.open_count(session, graph_id=graph_id),
            may_resolve=may_resolve,
        )

    @staticmethod
    def _page(
        items: list[RequestRead], info: PageInfo, applied: list[AppliedFilter], *, open_count: int, may_resolve: bool
    ) -> RequestPage:
        return RequestPage(
            items=items,
            total=info.total,
            unfiltered_total=info.unfiltered_total,
            next_cursor=info.next_cursor,
            applied=applied,
            open=open_count,
            may_resolve=may_resolve,
        )

    async def open_count(self, session: AsyncSession, *, graph_id: str) -> int:
        return await self.requests_qs.open_count(session, graph_id=graph_id)

    async def reads(
        self, session: AsyncSession, rows: list[Request], *, agent_names: dict[str, str]
    ) -> list[RequestRead]:
        """Each row with the names it reads as, resolved in one query per kind of name."""
        users = await self.requests_qs.user_names(
            session,
            {r.asked_by_id for r in rows if r.asked_by_id} | {r.resolved_by_id for r in rows if r.resolved_by_id},
        )
        worlds = await self.requests_qs.lens_names(session, {r.world_id for r in rows if r.world_id})
        models = await self.requests_qs.model_names(session, {r.model_id for r in rows if r.model_id})
        return [
            RequestRead(
                id=r.id,
                kind=r.kind,
                title=r.title,
                detail=r.detail,
                source=r.source,
                asked_by_id=r.asked_by_id,
                asked_by=users.get(r.asked_by_id) if r.asked_by_id else None,
                agent_id=r.agent_id,
                agent=agent_names.get(r.agent_id) if r.agent_id else None,
                run_id=r.run_id,
                session_id=r.session_id,
                guardrail_id=r.guardrail_id,
                blocked_by=r.blocked_by,
                asks=r.asks,
                last_asked_at=r.last_asked_at,
                status=r.status,
                resolution=r.resolution,
                resolution_note=r.resolution_note,
                world={"id": r.world_id, "name": worlds.get(r.world_id)} if r.world_id in worlds else None,
                model={"id": r.model_id, "name": models.get(r.model_id)} if r.model_id in models else None,
                resolved_by=users.get(r.resolved_by_id) if r.resolved_by_id else None,
                resolved_at=r.resolved_at,
                created_at=r.created_at,
            )
            for r in rows
        ]

    async def read(self, session: AsyncSession, row: Request, *, agent_names: dict[str, str]) -> RequestRead:
        return (await self.reads(session, [row], agent_names=agent_names))[0]

    # ── resolving ────────────────────────────────────────────────────────────

    async def resolve(
        self,
        session: AsyncSession,
        *,
        request: Request,
        payload: RequestResolve,
        actor_id: str,
        may_resolve: bool,
    ) -> Request:
        """Decline, allow in a world, or model it — once, by a modeller."""
        if not may_resolve:
            raise PermissionDeniedError("Resolving a request needs the modeller role on this Graph.")
        if not request.is_open:
            raise ConflictError("This request is already resolved.")

        if payload.action == "decline":
            request.resolution = RequestResolution.declined.value
            request.resolution_note = (payload.note or "").strip() or "declined"
        elif payload.action == "allow":
            await self._allow(session, request=request, world_id=payload.world_id, actor_id=actor_id)
        else:
            await self._model(session, request=request, model_id=payload.model_id, note=payload.note)

        request.status = RequestStatus.done.value
        request.resolved_by_id = actor_id
        request.resolved_at = _now()
        await session.flush()
        await emit_event(
            session,
            action=actions.REQUEST_RESOLVE,
            target_kind=actions.TARGET_REQUEST,
            target_id=request.id,
            graph_id=request.graph_id,
            actor_id=actor_id,
            details={
                "resolution": request.resolution,
                "note": request.resolution_note,
                "world_id": request.world_id,
                "model_id": request.model_id,
            },
        )
        return request

    async def _allow(self, session: AsyncSession, *, request: Request, world_id: str | None, actor_id: str) -> None:
        """The world goes into the guardrail's ``allowed_in`` — the guardrail is edited, not the world."""
        if request.kind != RequestKind.guardrail.value:
            raise ValidationError("Only a guardrail's refusal is allowed in a world — model this one or decline it.")
        guardrail = await self.lenses_qs.get(session, request.guardrail_id) if request.guardrail_id else None
        if guardrail is None or guardrail.graph_id != request.graph_id:
            raise ValidationError("Its guardrail is gone — decline it instead.")
        if not world_id:
            raise ValidationError("Pick the world to allow it in.")
        world = await self.lenses_qs.get(session, world_id)
        if (
            world is None
            or world.graph_id != request.graph_id
            or world.kind != LensKind.world.value
            or not world.is_named
        ):
            raise ValidationError(f"The world {world_id!r} is not in this Graph — it may have been deleted.")

        before = list(guardrail.allowed_in or [])
        if world.id not in before:
            guardrail.allowed_in = [*before, world.id]
            guardrail.version += 1
            await emit_event(
                session,
                action=actions.LENS_UPDATE,
                target_kind=actions.TARGET_LENS,
                target_id=guardrail.id,
                graph_id=guardrail.graph_id,
                actor_id=actor_id,
                details={
                    "before": {"allowed_in": before},
                    "after": {"allowed_in": list(guardrail.allowed_in)},
                    "request_id": request.id,
                },
            )
        request.resolution = RequestResolution.allowed.value
        request.world_id = world.id
        request.resolution_note = f"allowed in {world.display_name}"

    async def _model(self, session: AsyncSession, *, request: Request, model_id: str | None, note: str | None) -> None:
        if request.kind == RequestKind.guardrail.value:
            raise ValidationError("A guardrail's refusal is allowed in a world or declined — the data is modelled.")
        request.resolution = RequestResolution.modelled.value
        if model_id:
            model = await self.requests_qs.model_in_graph(session, graph_id=request.graph_id, model_id=model_id)
            if model is None:
                raise ValidationError(f"The model {model_id!r} is not in this Graph.")
            request.model_id = model.id
            request.resolution_note = f"modelled in {model.name}"
        else:
            request.resolution_note = (note or "").strip() or "modelled"
