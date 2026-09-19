"""Tests for the operator user-management service layer (invana users *)."""

from __future__ import annotations

import pytest

from invana.core.auth.managers import AuthManager
from invana.core.auth.passwords import verify_password
from invana.core.errors import ConflictError


@pytest.mark.asyncio
async def test_provision_user_creates_regular_account(session):
    user = await AuthManager().provision_user(
        session,
        email="Alice@Example.com",
        password="Sup3rSecret!pw",
        username="alice",
        first_name="Alice",
        last_name=None,
    )
    assert user.email == "alice@example.com"  # normalized
    assert user.username == "alice"
    assert user.is_superuser is False
    assert user.is_active is True
    assert verify_password("Sup3rSecret!pw", user.password_hash)


@pytest.mark.asyncio
async def test_provision_user_superuser_flag(session):
    user = await AuthManager().provision_user(
        session,
        email="root@example.com",
        password="Sup3rSecret!pw",
        username="root-admin",
        first_name="Root",
        last_name=None,
        is_superuser=True,
    )
    assert user.is_superuser is True


@pytest.mark.asyncio
async def test_provision_user_duplicate_username_conflicts(session):
    await AuthManager().provision_user(
        session,
        email="bob@example.com",
        password="Sup3rSecret!pw",
        username="bob",
        first_name="Bob",
        last_name=None,
    )
    with pytest.raises(ConflictError):
        await AuthManager().provision_user(
            session,
            email="other@example.com",
            password="Sup3rSecret!pw",
            username="bob",
            first_name="Bobby",
            last_name=None,
        )


@pytest.mark.asyncio
async def test_admin_set_password_replaces_hash(session):
    user = await AuthManager().provision_user(
        session,
        email="carol@example.com",
        password="Original!pw9",
        username="carol",
        first_name="Carol",
        last_name=None,
    )
    old_hash = user.password_hash

    await AuthManager().admin_set_password(session, user=user, new_password="BrandN3w!pw99")

    assert user.password_hash != old_hash
    assert verify_password("BrandN3w!pw99", user.password_hash)
    assert not verify_password("Original!pw9", user.password_hash)


@pytest.mark.asyncio
async def test_find_user_by_email_or_username(session):
    await AuthManager().provision_user(
        session,
        email="dave@example.com",
        password="Sup3rSecret!pw",
        username="dave",
        first_name="Dave",
        last_name=None,
    )
    by_email = await AuthManager().find_user_by_email_or_username(session, identifier="DAVE@example.com")
    by_username = await AuthManager().find_user_by_email_or_username(session, identifier="dave")
    missing = await AuthManager().find_user_by_email_or_username(session, identifier="nobody")

    assert by_email is not None and by_username is not None
    assert by_email.id == by_username.id
    assert missing is None
