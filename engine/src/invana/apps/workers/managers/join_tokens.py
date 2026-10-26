"""Join tokens — mint, list, revoke, and the live checks of a join.

docs/for-developers/modules/agents/features/workers.md C6 · C8. A join token is
a ``personal_access_tokens`` row with the ``invana_join_`` prefix, held by the
install's ``workers`` service account (created on the first mint, a member of no
Graph) and narrowed to one pool through ``worker_pool_id`` · ``join_cap`` ·
``joins``. The secret is returned once; the row keeps its sha256 and last four
characters. Only an install admin mints or revokes; any signed-in user lists.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.workers.credentials import JOIN_PREFIX, hash_token, new_join_token
from invana.apps.workers.managers.numbers import require_install_admin
from invana.apps.workers.models import Worker
from invana.apps.workers.querysets.pools import PoolQuerySet
from invana.apps.workers.querysets.tokens import HOLDER, JoinTokenQuerySet
from invana.apps.workers.querysets.workers import WorkerQuerySet
from invana.apps.workers.schemas import (
    JOIN_TOKEN_LIST,
    JoinCheck,
    JoinStatus,
    JoinTokenCreated,
    JoinTokenIn,
    JoinTokenPage,
    JoinTokenRow,
)
from invana.core.auth.models import PersonalAccessToken, User
from invana.core.errors import NotFoundError
from invana.core.lists import ListParams, Page, applied_filters

#: No bcrypt hash looks like this, so no password ever matches it.
UNUSABLE_PASSWORD = "!"


class JoinTokenManager:
    """Stateless. The session is the first argument of every method."""

    qs = JoinTokenQuerySet()
    pools = PoolQuerySet()
    workers = WorkerQuerySet()

    async def _holder(self, session: AsyncSession) -> User:
        """The install's ``workers`` service account — made on the first mint."""
        holder = await self.qs.holder(session)
        if holder is None:
            holder = await self.qs.add_user(
                session,
                User(
                    username=HOLDER,
                    email=None,
                    password_hash=UNUSABLE_PASSWORD,
                    first_name=HOLDER,
                    is_service_account=True,
                ),
            )
        return holder

    @staticmethod
    def _row(token: PersonalAccessToken, pool_name: str, made_by: str | None) -> JoinTokenRow:
        return JoinTokenRow(
            id=token.id,
            display=f"{JOIN_PREFIX}…{token.last_four}",
            pool_id=token.worker_pool_id or "",
            pool=pool_name,
            made_by=made_by,
            expires_at=token.expires_at,
            joins=token.joins,
            cap=token.join_cap,
            last_used_at=token.last_used_at,
            created_at=token.created_at,
            revoked=token.revoked_at is not None,
        )

    async def mint(self, session: AsyncSession, *, payload: JoinTokenIn, actor, engine_url: str) -> JoinTokenCreated:
        """Mint a join token for one pool; the response carries the secret, once."""
        require_install_admin(actor)
        pool = await self.pools.get_by_ref(session, payload.pool_id)
        if pool is None:
            raise NotFoundError("No such pool.")
        holder = await self._holder(session)
        base = (payload.name or f"join-{pool.name}").strip()[:56]
        taken = await self.qs.names_like(session, holder.id, base)
        name, n = base, 2
        while name in taken:
            name, n = f"{base}-{n}", n + 1
        secret = new_join_token()
        expires_at = (
            datetime.now(UTC) + timedelta(days=payload.expires_in_days) if payload.expires_in_days is not None else None
        )
        token = await self.qs.add(
            session,
            PersonalAccessToken(
                user_id=holder.id,
                name=name,
                token_hash=hash_token(secret),
                last_four=secret[-4:],
                expires_at=expires_at,
                created_by_id=actor.id,
                worker_pool_id=pool.id,
                join_cap=payload.cap,
            ),
        )
        row = self._row(token, pool.name, getattr(actor, "username", None))
        return JoinTokenCreated(**row.model_dump(), token=secret, engine_url=engine_url)

    async def page(self, session: AsyncSession, *, params: ListParams) -> JoinTokenPage:
        found, info = await self.qs.page(session, params=params)
        pools = await self.pools.by_ids(session, [t.worker_pool_id for t in found if t.worker_pool_id])
        makers = await self.qs.users_by_ids(session, [t.created_by_id for t in found if t.created_by_id])
        items = [
            self._row(
                t,
                pools[t.worker_pool_id].name if t.worker_pool_id in pools else "",
                makers[t.created_by_id].username if t.created_by_id in makers else None,
            )
            for t in found
        ]
        page = Page[JoinTokenRow].of(items, info, applied_filters(params, JOIN_TOKEN_LIST))
        return JoinTokenPage(**page.model_dump())

    async def revoke(self, session: AsyncSession, *, token_id: str, actor) -> None:
        require_install_admin(actor)
        token = await self.qs.get(session, token_id)
        if token is None:
            raise NotFoundError("No such join token.")
        if token.revoked_at is None:
            token.revoked_at = datetime.now(UTC)
        await session.flush()

    async def status(self, session: AsyncSession, *, token_id: str) -> JoinStatus:
        """The Joined step's checks: token used · engine reached · plugins · labels · first heartbeat."""
        token = await self.qs.get(session, token_id)
        if token is None:
            raise NotFoundError("No such join token.")
        now = datetime.now(UTC)
        pool = await self.pools.get(session, token.worker_pool_id or "")
        worker = await self.workers.latest_via(session, token_id)
        checks = [self._token_check(token, now), *self._worker_checks(worker, pool), self._heartbeat_check(worker, now)]
        return JoinStatus(
            token_id=token.id,
            checks=checks,
            worker_id=worker.id if worker else None,
            worker=worker.name if worker else None,
            joins=token.joins,
            waiting_s=max(0, int((now - token.created_at).total_seconds())),
        )

    @staticmethod
    def _token_check(token: PersonalAccessToken, now: datetime) -> JoinCheck:
        if token.revoked_at is not None:
            return JoinCheck(key="token", state="failed", detail="revoked", fix="Mint a new join token.")
        if token.expires_at is not None and token.expires_at <= now:
            return JoinCheck(key="token", state="failed", detail="expired", fix="Mint a new join token.")
        if token.joins > 0:
            cap = f"{token.joins} of {token.join_cap}" if token.join_cap is not None else f"{token.joins} joined"
            return JoinCheck(key="token", state="ok", detail=cap)
        return JoinCheck(key="token", state="waiting")

    @staticmethod
    def _worker_checks(worker: Worker | None, pool) -> list[JoinCheck]:
        if worker is None:
            return [
                JoinCheck(key="engine", state="waiting"),
                JoinCheck(key="plugins", state="waiting"),
                JoinCheck(key="labels", state="waiting"),
            ]
        wanted = list(pool.plugins or []) if pool else []
        carried = [p for p in wanted if p in (worker.plugins or [])]
        return [
            JoinCheck(key="engine", state="ok", detail=f"from {worker.from_ip}" if worker.from_ip else None),
            JoinCheck(key="plugins", state="ok", detail=f"{len(carried)} of {len(wanted)}" if wanted else None),
            JoinCheck(key="labels", state="ok", detail=", ".join(worker.labels or []) or None),
        ]

    @staticmethod
    def _heartbeat_check(worker: Worker | None, now: datetime) -> JoinCheck:
        if worker is None or worker.last_heartbeat_at is None:
            return JoinCheck(key="heartbeat", state="waiting")
        age = max(0, int((now - worker.last_heartbeat_at).total_seconds()))
        return JoinCheck(key="heartbeat", state="ok", detail=f"{age} s")
