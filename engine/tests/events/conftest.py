"""Fixtures for event tests — the auth Postgres harness (isolated schema, no mocks)."""

from __future__ import annotations

from tests.auth.conftest import db_engine, session  # noqa: F401 — re-exported fixtures
