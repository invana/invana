"""Theme preference persistence via patch_me (docs/for-developers/modules/platform/features/theming.md)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from invana.core.auth.managers import AuthManager
from invana.core.auth.schemas import MePatchRequest


@pytest.mark.asyncio
async def test_patch_me_persists_theme_into_preferences(session):
    user = await AuthManager().provision_user(
        session,
        email="theme@example.com",
        password="Sup3rSecret!pw",
        username="themer",
        first_name="Theo",
        last_name=None,
    )
    await session.commit()

    payload = MePatchRequest(theme={"theme": "forest", "mode": "dark", "accent": "emerald"})
    out = await AuthManager().patch_me(session, user=user, payload=payload)

    assert out.preferences["theme"] == {"theme": "forest", "mode": "dark", "accent": "emerald"}
    assert user.preferences["theme"]["theme"] == "forest"


@pytest.mark.asyncio
async def test_patch_me_theme_rejects_unknown_mode():
    # `mode` is constrained to light/dark/system — anything else is a 422 upstream.
    with pytest.raises(ValidationError):
        MePatchRequest(theme={"theme": "forest", "mode": "sepia"})
