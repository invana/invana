"""HTTP handlers for Workers — parse, call one manager, serialise.

docs/for-developers/modules/agents/features/workers.md. People call the first
block signed in; members read and install admins write (the managers decide).
A worker calls the second block with its join token (``join``) or its own
credential (the rest) — those handlers authenticate it themselves, through the
gateway, and never go through ``get_current_user``.
"""

from __future__ import annotations

from fastapi import Depends, Path, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.managers.events import WorkerEventManager
from invana.apps.workers.managers.join_tokens import JoinTokenManager
from invana.apps.workers.managers.overview import OverviewManager
from invana.apps.workers.managers.pools import PoolManager
from invana.apps.workers.managers.workers import WorkerManager
from invana.apps.workers.schemas import (
    EVENT_LIST,
    JOIN_TOKEN_LIST,
    POOL_LIST,
    WORKER_LIST,
    Capacity,
    HeartbeatIn,
    HeartbeatOut,
    JoinIn,
    JoinOut,
    JoinStatus,
    JoinTokenCreated,
    JoinTokenIn,
    JoinTokenPage,
    LeaseIn,
    LeaseOut,
    OutcomeIn,
    PoolIn,
    PoolPage,
    PoolPatch,
    PoolRow,
    PoolsOverview,
    WorkerDetail,
    WorkerEventPage,
    WorkerPage,
)
from invana.core.auth.deps import get_current_user, require_session_auth
from invana.core.auth.models import User
from invana.core.db import get_session
from invana.core.errors import AuthenticationError
from invana.core.lists import ListParams, list_params
from invana.core.settings import settings
from invana.plugins.gateway import Gateway
from invana.plugins.registry import engine_version

pools = PoolManager()
workers = WorkerManager()
overviews = OverviewManager()
events = WorkerEventManager()
join_tokens = JoinTokenManager()

_bearer = HTTPBearer(auto_error=False)


def _secret(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Send the token as Authorization: Bearer <token>.")
    return credentials.credentials


def _gateway(request: Request) -> Gateway:
    return Gateway(request.app.state.db_session_factory)


# ── people ────────────────────────────────────────────────────────────────────


async def overview(
    user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> PoolsOverview:
    return await overviews.overview(session)


async def list_pools(
    params: ListParams = Depends(list_params(POOL_LIST)),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PoolPage:
    return await pools.page(session, params=params)


async def create_pool(
    payload: PoolIn, user: User = Depends(require_session_auth), session: AsyncSession = Depends(get_session)
) -> PoolRow:
    return await pools.create(session, payload=payload, actor=user)


async def get_pool(
    pool_id: str = Path(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> PoolRow:
    return await pools.get(session, ref=pool_id)


async def update_pool(
    payload: PoolPatch,
    pool_id: str = Path(...),
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> PoolRow:
    return await pools.update(session, ref=pool_id, payload=payload, actor=user)


async def drain_pool(
    pool_id: str = Path(...), user: User = Depends(require_session_auth), session: AsyncSession = Depends(get_session)
) -> None:
    await workers.drain_pool(session, ref=pool_id, actor=user)


async def capacity(user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)) -> Capacity:
    return await overviews.capacity(session)


async def list_events(
    params: ListParams = Depends(list_params(EVENT_LIST)),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkerEventPage:
    return await events.page(session, params=params)


async def list_workers(
    params: ListParams = Depends(list_params(WORKER_LIST)),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WorkerPage:
    return await workers.page(session, params=params)


async def get_worker(
    worker_id: str = Path(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> WorkerDetail:
    return await workers.detail(session, ref=worker_id)


async def drain_worker(
    worker_id: str = Path(...),
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> None:
    await workers.drain(session, ref=worker_id, actor=user)


async def list_join_tokens(
    params: ListParams = Depends(list_params(JOIN_TOKEN_LIST)),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JoinTokenPage:
    return await join_tokens.page(session, params=params)


async def create_join_token(
    payload: JoinTokenIn, user: User = Depends(require_session_auth), session: AsyncSession = Depends(get_session)
) -> JoinTokenCreated:
    """Mint a join token; the response carries the secret, once."""
    return await join_tokens.mint(
        session,
        payload=payload,
        actor=user,
        engine_url=settings.engine_base_url,
        worker_image=f"invana/worker:{engine_version()}",
    )


async def revoke_join_token(
    token_id: str = Path(...),
    user: User = Depends(require_session_auth),
    session: AsyncSession = Depends(get_session),
) -> None:
    await join_tokens.revoke(session, token_id=token_id, actor=user)


async def join_status(
    token_id: str = Path(...), user: User = Depends(get_current_user), session: AsyncSession = Depends(get_session)
) -> JoinStatus:
    return await join_tokens.status(session, token_id=token_id)


# ── a worker dialling out ─────────────────────────────────────────────────────


async def join(
    payload: JoinIn, request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> JoinOut:
    """A join token becomes a worker credential."""
    return await _gateway(request).join(
        token=_secret(credentials), payload=payload, from_ip=request.client.host if request.client else None
    )


async def heartbeat(
    payload: HeartbeatIn, request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> HeartbeatOut:
    return await _gateway(request).heartbeat(credential=_secret(credentials), payload=payload)


async def lease(
    payload: LeaseIn, request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> LeaseOut | Response:
    """Long-polls; ``204`` when nothing was ready."""
    leased = await _gateway(request).lease(credential=_secret(credentials), payload=payload)
    return leased if leased.leases else Response(status_code=status.HTTP_204_NO_CONTENT)


async def outcome(
    payload: OutcomeIn, request: Request, credentials: HTTPAuthorizationCredentials | None = Depends(_bearer)
) -> None:
    await _gateway(request).outcome(credential=_secret(credentials), payload=payload)
