"""Fixtures for schedules, notifications and approvals — the work suite's isolated
Postgres schema, with the activity band's tables in it (real DB, no mocks)."""

from __future__ import annotations

from invana.activity.models import Approval  # noqa: F401  (registers the activity tables)
from invana.apps.datasets.models import Dataset  # noqa: F401
from invana.apps.standards.models import Standard  # noqa: F401
from invana.runtime.models import Emission  # noqa: F401
from tests.work.conftest import agent, db_engine, graph, session, session_factory, user  # noqa: F401
