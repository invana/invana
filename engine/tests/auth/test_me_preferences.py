"""Theme preference persistence via patch_me (RFC-044)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from invana.auth.schemas import MePatchRequest
from invana.auth.services import patch_me, provision_user


@pytest.mark.asyncio
async def test_patch_me_persists_theme_into_preferences(session):
    user = await provision_user(
        session,
        email="theme@example.com",
        password="Sup3rSecret!pw",
        username="themer",
        first_name="Theo",
        last_name=None,
    )
    await session.commit()

    payload = MePatchRequest(theme={"theme": "forest", "mode": "dark", "accent": "emerald"})
    out = await patch_me(session, user=user, payload=payload)

    assert out.preferences["theme"] == {"theme": "forest", "mode": "dark", "accent": "emerald"}
    assert user.preferences["theme"]["theme"] == "forest"


@pytest.mark.asyncio
async def test_patch_me_theme_rejects_unknown_mode():
    # `mode` is constrained to light/dark/system — anything else is a 422 upstream.
    with pytest.raises(ValidationError):
        MePatchRequest(theme={"theme": "forest", "mode": "sepia"})
