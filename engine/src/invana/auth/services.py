"""Business logic for /auth/* — registration, login, refresh, me, password, delete.

Functions return raw DTOs or raise ``HTTPException``. They flush but do not
commit — the route handler commits once at the end of the request.

Graph-scoped business logic (membership) lives in
:mod:`invana.graphs.services`.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.auth import jwt as jwt_codec
from invana.auth.models import User
from invana.auth.passwords import WeakPasswordError, hash_password, verify_password
from invana.auth.schemas import (
    USERNAME_MAX,
    USERNAME_MIN,
    AuthResponse,
    ChangePasswordRequest,
    DeleteMeRequest,
    GraphMembershipOut,
    LoginRequest,
    MePatchRequest,
    RegisterRequest,
    UsernameAvailabilityResponse,
    UserOut,
)
from invana.auth.tokens import (
    find_active_refresh_token,
    issue_refresh_token,
    revoke_all_refresh_tokens_for_user,
    revoke_refresh_token,
)
from invana.events import actions as event_actions
from invana.events.models import ActorType
from invana.events.services import current_trace_id, emit_event
from invana.graphs.models import Graph, GraphMember
from invana.settings import settings

_GENERIC_AUTH_FAILURE = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid email or password.",
)

# Server-side validation guard. Mirrors USERNAME_PATTERN in schemas.py but is
# defensive against payloads that bypass pydantic (e.g. the CLI).
_USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$")
_USERNAME_DOUBLE_HYPHEN = re.compile(r"--")

# Reserved at the username layer. The /u/ URL prefix isolates usernames from
# Studio's top-level routes, so only the single segment ``u`` itself needs to
# be reserved.
_RESERVED_USERNAMES: frozenset[str] = frozenset({"u"})


# ---------------------------------------------------------------------------
# Username validation + availability
# ---------------------------------------------------------------------------


def _validate_username_format(raw: str) -> str:
    """Normalize and validate a username string. Raise 422 on failure."""
    normalized = raw.strip().lower()
    if not (USERNAME_MIN <= len(normalized) <= USERNAME_MAX):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"username must be {USERNAME_MIN}-{USERNAME_MAX} characters.",
        )
    if not _USERNAME_RE.match(normalized):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username may contain lowercase letters, digits, and hyphens, "
            "and must start and end with a letter or digit.",
        )
    if _USERNAME_DOUBLE_HYPHEN.search(normalized):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="username may not contain consecutive hyphens.",
        )
    return normalized


async def _username_taken(session: AsyncSession, *, username: str, exclude_user_id: str | None = None) -> bool:
    stmt = select(func.count(User.id)).where(User.username == username)
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    return (await session.execute(stmt)).scalar_one() > 0


async def check_username_availability(session: AsyncSession, *, raw: str) -> UsernameAvailabilityResponse:
    """Advisory check used by Studio's live-availability indicator.

    Final uniqueness is enforced at register / PATCH time — clients must not
    treat ``available=true`` as a reservation.
    """
    normalized = raw.strip().lower()
    bad_length = not (USERNAME_MIN <= len(normalized) <= USERNAME_MAX)
    bad_chars = not _USERNAME_RE.match(normalized)
    double_hyphen = bool(_USERNAME_DOUBLE_HYPHEN.search(normalized))
    if bad_length or bad_chars or double_hyphen:
        return UsernameAvailabilityResponse(available=False, reason="invalid_format")
    if normalized in _RESERVED_USERNAMES:
        return UsernameAvailabilityResponse(available=False, reason="reserved")
    if await _username_taken(session, username=normalized):
        return UsernameAvailabilityResponse(available=False, reason="taken")
    return UsernameAvailabilityResponse(available=True)


# ---------------------------------------------------------------------------
# Auth-response building (loads memberships)
# ---------------------------------------------------------------------------


async def _list_memberships(session: AsyncSession, *, user_id: str) -> list[GraphMembershipOut]:
    stmt = select(GraphMember).where(GraphMember.user_id == user_id).options(selectinload(GraphMember.graph))
    rows = (await session.execute(stmt)).scalars().all()

    # Owner username is derived from Graph.created_by_id → users.username. Batch the lookup.
    owner_ids = {m.graph.created_by_id for m in rows}
    owners: dict[str, str] = {}
    if owner_ids:
        owner_rows = (await session.execute(select(User.id, User.username).where(User.id.in_(owner_ids)))).all()
        owners = dict(owner_rows)

    return [
        GraphMembershipOut(
            graph_id=m.graph_id,
            graph_name=m.graph.name,
            graph_slug=m.graph.slug,
            owner_username=owners.get(m.graph.created_by_id, ""),
        )
        for m in rows
    ]


async def _user_out(session: AsyncSession, *, user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_superuser=user.is_superuser,
        username_last_changed_at=user.username_last_changed_at,
        graphs=await _list_memberships(session, user_id=user.id),
        preferences=user.preferences or {},
    )


async def _build_auth_response(session: AsyncSession, *, user: User) -> AuthResponse:
    access = jwt_codec.encode_access_token(user_id=user.id, is_superuser=user.is_superuser)
    refresh = await issue_refresh_token(session, user_id=user.id)
    return AuthResponse(
        user=await _user_out(session, user=user),
        access_token=access,
        refresh_token=refresh,
    )


# ---------------------------------------------------------------------------
# Registration — superuser-provisioned (RFC-023)
# ---------------------------------------------------------------------------


async def register(session: AsyncSession, *, payload: RegisterRequest, actor_id: str) -> UserOut:
    """Provision a new (non-superuser) account.

    Self-service signup was removed in RFC-023 — the route is gated behind
    ``require_superuser``, so ``actor_id`` is the platform admin creating the
    account, not the new user. Returns the created user; no session/token is
    issued for the new account.
    """
    username = _validate_username_format(payload.username)
    if username in _RESERVED_USERNAMES:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is reserved.")
    if await _username_taken(session, username=username):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is taken.")
    if await _find_user_by_email(session, payload.email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with this email already exists.")
    try:
        password_hash = hash_password(payload.password)
    except WeakPasswordError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e

    user = User(
        email=payload.email.lower(),
        username=username,
        password_hash=password_hash,
        first_name=payload.first_name.strip(),
        last_name=(payload.last_name.strip() if payload.last_name else None) or None,
        is_superuser=False,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    await emit_event(
        session,
        action=event_actions.AUTH_REGISTER,
        target_kind=event_actions.TARGET_USER,
        target_id=user.id,
        actor_id=actor_id,
        details={"email": user.email, "username": user.username, "via": "superuser.provision"},
        trace_id=current_trace_id(),
    )
    return await _user_out(session, user=user)


# ---------------------------------------------------------------------------
# Login / refresh / logout
# ---------------------------------------------------------------------------


async def login(session: AsyncSession, *, payload: LoginRequest) -> AuthResponse:
    # Resolve by username OR email (RFC-034); email-less accounts sign in by username.
    user = await find_user_by_email_or_username(session, identifier=payload.identifier)
    if user is None or not user.is_active:
        # Constant-time guard against account enumeration — verify against a
        # dummy hash so timing doesn't reveal the lookup result.
        verify_password(payload.password, "$2b$12$" + "x" * 53)
        await emit_event(
            session,
            action=event_actions.AUTH_LOGIN_FAILED,
            actor_type=ActorType.anonymous,
            details={"identifier": payload.identifier, "reason": "unknown_or_inactive"},
            trace_id=current_trace_id(),
        )
        await session.commit()  # failed-login event isn't tied to a returning state change
        raise _GENERIC_AUTH_FAILURE
    if not verify_password(payload.password, user.password_hash):
        await emit_event(
            session,
            action=event_actions.AUTH_LOGIN_FAILED,
            target_kind=event_actions.TARGET_USER,
            target_id=user.id,
            actor_type=ActorType.anonymous,
            details={"identifier": payload.identifier, "reason": "bad_password"},
            trace_id=current_trace_id(),
        )
        await session.commit()
        raise _GENERIC_AUTH_FAILURE
    response = await _build_auth_response(session, user=user)
    await emit_event(
        session,
        action=event_actions.AUTH_LOGIN,
        target_kind=event_actions.TARGET_USER,
        target_id=user.id,
        actor_id=user.id,
        details={"username": user.username},
        trace_id=current_trace_id(),
    )
    return response


async def refresh(session: AsyncSession, *, raw_refresh: str) -> AuthResponse:
    row = await find_active_refresh_token(session, raw_token=raw_refresh)
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    await revoke_refresh_token(session, raw_token=raw_refresh)
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")
    response = await _build_auth_response(session, user=user)
    await emit_event(
        session,
        action=event_actions.AUTH_REFRESH,
        target_kind=event_actions.TARGET_SESSION,
        actor_id=user.id,
        details={},
        trace_id=current_trace_id(),
    )
    return response


async def logout(session: AsyncSession, *, raw_refresh: str) -> None:
    row = await find_active_refresh_token(session, raw_token=raw_refresh)
    actor_id = row.user_id if row is not None else None
    await revoke_refresh_token(session, raw_token=raw_refresh)
    await emit_event(
        session,
        action=event_actions.AUTH_LOGOUT,
        target_kind=event_actions.TARGET_SESSION,
        actor_id=actor_id,
        actor_type=ActorType.user if actor_id else ActorType.anonymous,
        details={},
        trace_id=current_trace_id(),
    )


# ---------------------------------------------------------------------------
# /auth/me — get, patch, change password, delete
# ---------------------------------------------------------------------------


async def me_payload(session: AsyncSession, *, user: User) -> UserOut:
    return await _user_out(session, user=user)


async def patch_me(session: AsyncSession, *, user: User, payload: MePatchRequest) -> UserOut:
    raw = payload.model_dump(exclude_unset=True)
    if "first_name" in raw:
        first = (raw["first_name"] or "").strip()
        if not first:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="first_name cannot be empty.",
            )
        user.first_name = first
    if "last_name" in raw:
        last = raw["last_name"]
        user.last_name = last.strip() if (last and last.strip()) else None
    username_changed_from: str | None = None
    if "username" in raw and raw["username"] is not None:
        new_username = _validate_username_format(raw["username"])
        if new_username != user.username:
            # Enforce cooldown.
            cooldown_days = settings.auth_username_change_cooldown_days
            if cooldown_days > 0 and user.username_last_changed_at is not None:
                next_allowed = user.username_last_changed_at + timedelta(days=cooldown_days)
                if datetime.now(UTC) < next_allowed:
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        detail=(f"Username can be changed again on {next_allowed.date().isoformat()}."),
                    )
            if new_username in _RESERVED_USERNAMES:
                raise HTTPException(status.HTTP_409_CONFLICT, detail="username is reserved.")
            if await _username_taken(session, username=new_username, exclude_user_id=user.id):
                raise HTTPException(status.HTTP_409_CONFLICT, detail="username is taken.")
            username_changed_from = user.username
            user.username = new_username
            user.username_last_changed_at = datetime.now(UTC)
    if payload.theme is not None:
        # Reassign a fresh dict — SQLAlchemy doesn't track in-place JSON mutation.
        user.preferences = {**(user.preferences or {}), "theme": payload.theme.model_dump()}
    await session.flush()
    if username_changed_from is not None:
        await emit_event(
            session,
            action=event_actions.AUTH_USERNAME_CHANGE,
            target_kind=event_actions.TARGET_USER,
            target_id=user.id,
            actor_id=user.id,
            details={
                "changed": {
                    "username": {"before": username_changed_from, "after": user.username},
                },
            },
            trace_id=current_trace_id(),
        )
    return await _user_out(session, user=user)


async def change_password(session: AsyncSession, *, user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")
    try:
        user.password_hash = hash_password(payload.new_password)
    except WeakPasswordError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    await revoke_all_refresh_tokens_for_user(session, user_id=user.id)
    await emit_event(
        session,
        action=event_actions.AUTH_PASSWORD_CHANGE,
        target_kind=event_actions.TARGET_USER,
        target_id=user.id,
        actor_id=user.id,
        details={},
        trace_id=current_trace_id(),
    )


async def delete_me(session: AsyncSession, *, user: User, payload: DeleteMeRequest) -> None:
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Password is incorrect.")
    if user.is_superuser and await _is_sole_active_superuser(session, user_id=user.id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You are the only superuser. Promote another user before deleting this account.",
        )
    # Guard B (RFC-023): refuse if the user owns any Graph. With roles/sharing
    # removed, graphs are owner-only — delete them first. The Graph.created_by_id
    # FK is RESTRICT, so the DB would error anyway; fail early with a clear message.
    if await _owns_any_graph(session, user_id=user.id):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="You own one or more Graphs. Delete them before deleting this account.",
        )
    await session.delete(user)


async def _is_sole_active_superuser(session: AsyncSession, *, user_id: str) -> bool:
    stmt = select(func.count(User.id)).where(
        User.is_superuser.is_(True),
        User.is_active.is_(True),
        User.id != user_id,
    )
    return (await session.execute(stmt)).scalar_one() == 0


async def _owns_any_graph(session: AsyncSession, *, user_id: str) -> bool:
    """True if the user owns any Graph (graphs are owner-only post-RFC-023)."""
    stmt = select(func.count()).select_from(Graph).where(Graph.created_by_id == user_id)
    return (await session.execute(stmt)).scalar_one() > 0


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------


async def _find_user_by_email(session: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(func.lower(User.email) == email.lower())
    return (await session.execute(stmt)).scalar_one_or_none()


async def find_user_by_email_or_username(session: AsyncSession, *, identifier: str) -> User | None:
    """Resolve a user by either email or username. Used by operator CLI commands."""
    value = identifier.strip().lower()
    stmt = select(User).where((func.lower(User.email) == value) | (User.username == value))
    return (await session.execute(stmt)).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Bootstrap (called by `invana init`)
# ---------------------------------------------------------------------------


async def bootstrap_root(
    session: AsyncSession,
    *,
    email: str | None,
    password: str,
    username: str,
    first_name: str,
    last_name: str | None,
) -> User:
    """Create the root superuser. Does NOT create a personal Graph (RFC-017).

    Idempotent guard at the call site: refuse if any superuser already exists.
    """
    normalized_username = _validate_username_format(username)
    if normalized_username in _RESERVED_USERNAMES:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is reserved.")
    if await _username_taken(session, username=normalized_username):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is taken.")

    password_hash = hash_password(password)
    user = User(
        email=email.lower() if email else None,
        username=normalized_username,
        password_hash=password_hash,
        first_name=first_name.strip(),
        last_name=(last_name.strip() if last_name else None) or None,
        is_superuser=True,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def any_superuser_exists(session: AsyncSession) -> bool:
    stmt = select(func.count(User.id)).where(User.is_superuser.is_(True))
    return (await session.execute(stmt)).scalar_one() > 0


# ---------------------------------------------------------------------------
# Operator (CLI) operations — trusted shell context, no HTTP actor
# ---------------------------------------------------------------------------


async def provision_user(
    session: AsyncSession,
    *,
    email: str | None,
    password: str,
    username: str,
    first_name: str,
    last_name: str | None,
    is_superuser: bool = False,
) -> User:
    """Create a user from a trusted admin context (``invana users create``).

    Unlike :func:`register` there is no HTTP actor — the audit event is
    attributed to the system actor. Validates username/email uniqueness; lets
    :class:`WeakPasswordError` propagate so the CLI can surface it verbatim.
    """
    normalized_username = _validate_username_format(username)
    if normalized_username in _RESERVED_USERNAMES:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is reserved.")
    if await _username_taken(session, username=normalized_username):
        raise HTTPException(status.HTTP_409_CONFLICT, detail="username is taken.")
    if email and await _find_user_by_email(session, email) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="A user with this email already exists.")

    password_hash = hash_password(password)
    user = User(
        email=email.lower() if email else None,
        username=normalized_username,
        password_hash=password_hash,
        first_name=first_name.strip(),
        last_name=(last_name.strip() if last_name else None) or None,
        is_superuser=is_superuser,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    await emit_event(
        session,
        action=event_actions.AUTH_REGISTER,
        target_kind=event_actions.TARGET_USER,
        target_id=user.id,
        actor_type=ActorType.system,
        details={"email": user.email, "username": user.username, "via": "cli"},
        trace_id=current_trace_id(),
    )
    return user


async def admin_set_password(session: AsyncSession, *, user: User, new_password: str) -> None:
    """Force-set a user's password from a trusted admin context (``invana users update-password``).

    Unlike :func:`change_password` no current password is required — this is an
    operator reset. Revokes all refresh tokens so existing sessions die.
    """
    user.password_hash = hash_password(new_password)
    await revoke_all_refresh_tokens_for_user(session, user_id=user.id)
    await emit_event(
        session,
        action=event_actions.AUTH_PASSWORD_CHANGE,
        target_kind=event_actions.TARGET_USER,
        target_id=user.id,
        actor_type=ActorType.system,
        details={"via": "cli"},
        trace_id=current_trace_id(),
    )
