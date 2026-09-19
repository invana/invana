"""Personal access tokens against a real Postgres
(docs/for-developers/modules/identity-and-access/features/personal-access-tokens.md).

The route tests deliberately do NOT override ``get_current_user`` — the point is
the credential path itself: a secret in the ``Authorization`` header resolving to
its owner, or being refused with the reason.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from invana.core.auth.managers import AuthManager
from invana.core.auth.models import PersonalAccessToken
from invana.core.auth.schemas import PersonalAccessTokenCreateRequest
from invana.core.auth.tokens import PAT_PREFIX, hash_token
from invana.core.db import get_session
from invana.core.settings import settings
from invana.server.app import create_app

pytestmark = pytest.mark.asyncio


async def _user(session, *, username: str = "scripter"):
    user = await AuthManager().provision_user(
        session,
        email=f"{username}@example.com",
        password="Sup3rSecret!pw",
        username=username,
        first_name="Pat",
        last_name=None,
    )
    await session.commit()
    return user


@pytest_asyncio.fixture
async def client(session_factory):
    """The app on the test schema, with only the DB session overridden."""
    app = create_app()
    app.state.db_session_factory = session_factory

    async def _override_session():
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_session] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestMinting:
    async def test_secret_is_returned_once_and_stored_only_as_a_hash(self, session):
        user = await _user(session)

        created = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="nightly-load", expires_in_days=30)
        )
        await session.commit()

        assert created.secret.startswith(PAT_PREFIX)
        assert created.token.last_four == created.secret[-4:]

        row = await session.get(PersonalAccessToken, created.token.id)
        assert row.token_hash == hash_token(created.secret)
        # The secret itself is nowhere on the row.
        assert created.secret not in (row.token_hash, row.last_four, row.name)

        listing = await AuthManager().list_personal_access_tokens(session, user=user)
        assert [t.name for t in listing.tokens] == ["nightly-load"]
        assert listing.tokens[0].expired is False
        # The picker and the ceiling are rendered from configuration, not restated in Studio.
        assert listing.expiry_day_choices == settings.auth_token_expiry_day_choices
        assert listing.max_tokens == settings.auth_max_personal_access_tokens

    async def test_a_duplicate_name_is_refused(self, session):
        user = await _user(session, username="dupe")
        payload = PersonalAccessTokenCreateRequest(name="ci")
        await AuthManager().create_personal_access_token(session, user=user, payload=payload)
        await session.commit()

        with pytest.raises(Exception) as excinfo:
            await AuthManager().create_personal_access_token(session, user=user, payload=payload)
        assert "already have a token named" in str(excinfo.value)

    async def test_an_expiry_outside_the_offered_choices_is_refused(self):
        # The offer lives in settings; anything else never reaches the service.
        with pytest.raises(ValidationError):
            PersonalAccessTokenCreateRequest(name="odd", expires_in_days=7)


class TestTheCredential:
    async def test_a_token_authenticates_as_its_owner_and_stamps_last_used(self, session, client):
        user = await _user(session, username="caller")
        created = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="cron")
        )
        await session.commit()

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {created.secret}"})
        assert resp.status_code == 200
        assert resp.json()["username"] == "caller"

        row = await session.get(PersonalAccessToken, created.token.id)
        await session.refresh(row)
        assert row.last_used_at is not None

    async def test_revoked_and_expired_tokens_are_refused_by_name(self, session, client):
        user = await _user(session, username="revoker")
        revoked = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="old")
        )
        expired = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="stale")
        )
        await session.commit()

        await AuthManager().revoke_personal_access_token(session, user=user, token_id=revoked.token.id)
        row = await session.get(PersonalAccessToken, expired.token.id)
        row.expires_at = datetime.now(UTC) - timedelta(days=1)
        await session.commit()

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {revoked.secret}"})
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Token revoked."

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired.secret}"})
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Token expired."

        resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {PAT_PREFIX}nonsense"})
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Unknown access token."

        # Revoked rows leave the list; the expired one stays, marked.
        listing = await AuthManager().list_personal_access_tokens(session, user=user)
        assert [(t.name, t.expired) for t in listing.tokens] == [("stale", True)]

    async def test_a_token_cannot_manage_credentials(self, session, client):
        user = await _user(session, username="nomint")
        created = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="ci")
        )
        await session.commit()
        headers = {"Authorization": f"Bearer {created.secret}"}

        # Listing, minting and revoking a token all need a session (PT4) …
        assert (await client.get("/api/v1/auth/me/tokens", headers=headers)).status_code == 403
        assert (await client.post("/api/v1/auth/me/tokens", json={"name": "x"}, headers=headers)).status_code == 403
        # … as does changing the password.
        resp = await client.post(
            "/api/v1/auth/me/password",
            json={"current_password": "Sup3rSecret!pw", "new_password": "An0ther!Secret"},
            headers=headers,
        )
        assert resp.status_code == 403

    async def test_a_token_is_not_accepted_from_the_query_string(self, session, client):
        # The `?token=` SSE fallback is an access-token path only (PT5).
        user = await _user(session, username="nourl")
        created = await AuthManager().create_personal_access_token(
            session, user=user, payload=PersonalAccessTokenCreateRequest(name="sse")
        )
        await session.commit()

        resp = await client.get("/api/v1/auth/me", params={"token": created.secret})
        assert resp.status_code == 401
        assert "header only" in resp.json()["detail"]
