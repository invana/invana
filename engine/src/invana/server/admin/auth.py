"""starlette-admin AuthProvider — gates /admin behind the ``is_superuser`` flag.

Session-based: starlette-admin uses ``request.session`` (SessionMiddleware,
added in ``server/app.py``). Logging in stashes the user id in the session;
``is_authenticated`` re-loads the user on each request and verifies it's
still a superuser.

starlette-admin mounts as a Starlette **sub-app**, so ``request.app`` inside
these handlers is the admin app, not the parent FastAPI. The parent app
(and its lifespan-managed session factory) is passed in at construction
time via ``mount_admin``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from starlette.requests import Request
from starlette.responses import Response
from starlette_admin.auth import AdminUser, AuthProvider
from starlette_admin.exceptions import LoginFailed

from invana.auth.models import User
from invana.auth.passwords import verify_password

if TYPE_CHECKING:
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import AsyncSession


class SuperuserAuthProvider(AuthProvider):
    """Email + password auth for /admin. Superuser-only."""

    def __init__(self, parent_app: FastAPI):
        super().__init__()
        # FastAPI lifespan sets ``state.db_session_factory`` before any
        # request hits us, so we just read from the parent app on demand.
        self._parent_app = parent_app

    def _session_factory(self) -> async_sessionmaker[AsyncSession]:
        return self._parent_app.state.db_session_factory

    async def login(
        self,
        username: str,
        password: str,
        remember_me: bool,
        request: Request,
        response: Response,
    ) -> Response:
        async with self._session_factory()() as session:
            row = await session.execute(select(User).where(User.email == (username or "").strip().lower()))
            user = row.scalar_one_or_none()
        if user is None or not user.is_active or not user.is_superuser:
            # Even out timing between "no user" and "wrong password".
            verify_password(password, "$2b$12$" + "x" * 53)
            raise LoginFailed("Invalid email or password.")
        if not verify_password(password, user.password_hash):
            raise LoginFailed("Invalid email or password.")
        request.session.update({"admin_user_id": user.id})
        return response

    async def logout(self, request: Request, response: Response) -> Response:
        request.session.clear()
        return response

    async def is_authenticated(self, request: Request) -> bool:
        user_id: Any = request.session.get("admin_user_id")
        if not isinstance(user_id, str):
            return False
        async with self._session_factory()() as session:
            user = await session.get(User, user_id)
        if user is None or not user.is_active or not user.is_superuser:
            request.session.clear()
            return False
        request.state.admin_user = user
        return True

    def get_admin_user(self, request: Request) -> AdminUser | None:
        user = getattr(request.state, "admin_user", None)
        if user is None:
            return None
        display = f"{user.first_name} {user.last_name or ''}".strip() or user.email
        return AdminUser(username=display)
