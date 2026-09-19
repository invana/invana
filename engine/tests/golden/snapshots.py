"""The three golden snapshots (docs/for-developers/building-engine/refactor-plan.md §1).

Each function returns the snapshot as text, byte-for-byte reproducible from a
clean checkout, so a test can diff it against the committed file:

- ``openapi_document`` — the frontend contract. If this diff is empty, Studio
  cannot tell a refactor happened.
- ``models_ddl`` — every table, column and index as ``Base.metadata`` declares
  it, compiled for Postgres. Needs no database.
- ``migrated_ddl`` — the schema ``alembic upgrade head`` produces on an empty
  Postgres database, reflected back. Proves the chain runs, and pins what it
  builds.

Regenerate with ``uv run python -m tests.golden.update`` — only when a change
to the contract is intended, never to make a red guard green.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from pathlib import Path

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine import make_url
from sqlalchemy.schema import CreateIndex, CreateTable

from invana.core.models import Base
from invana.core.settings import settings
from invana.server.app import create_app

GOLDEN_DIR = Path(__file__).resolve().parent
ENGINE_DIR = GOLDEN_DIR.parents[1]
ALEMBIC_INI = ENGINE_DIR / "alembic.ini"

OPENAPI_FILE = GOLDEN_DIR / "openapi.json"
MODELS_DDL_FILE = GOLDEN_DIR / "schema.models.sql"
MIGRATED_DDL_FILE = GOLDEN_DIR / "schema.migrated.sql"


def openapi_document() -> str:
    """``app.openapi()`` as sorted, indented JSON."""
    return json.dumps(create_app().openapi(), sort_keys=True, indent=2) + "\n"


def _ddl(metadata: MetaData) -> str:
    dialect = postgresql.dialect()
    statements: list[str] = []
    for table in sorted(metadata.tables.values(), key=lambda t: t.name):
        statements.append(str(CreateTable(table).compile(dialect=dialect)).strip() + ";")
        statements.extend(
            str(CreateIndex(index).compile(dialect=dialect)).strip() + ";"
            for index in sorted(table.indexes, key=lambda i: i.name or "")
        )
    return "\n\n".join(statements) + "\n"


def models_ddl() -> str:
    """DDL for every table ``Base.metadata`` knows once the app is wired."""
    # Routers import their models lazily inside create_app(); building the app
    # is what populates the metadata completely.
    create_app()
    return _ddl(Base.metadata)


def migrated_ddl() -> str:
    """Run ``alembic upgrade head`` on a fresh scratch database and reflect it.

    The scratch database lives next to the configured one, is named
    ``invana_golden_<hex>``, and is dropped afterwards even on failure.
    """
    configured = make_url(settings.database_url)
    sync_url = configured.set(drivername="postgresql+psycopg2")
    scratch = f"invana_golden_{uuid.uuid4().hex[:8]}"

    admin = create_engine(sync_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{scratch}"'))
    try:
        # A subprocess, so the migration sees exactly what `invana migrate`
        # sees: env.py reads the URL from settings, which reads the environment.
        scratch_url = configured.set(database=scratch).render_as_string(hide_password=False)
        env = dict(os.environ, INVANA_DATABASE_URL=scratch_url)
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), "upgrade", "head"],
            env=env,
            cwd=ENGINE_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"alembic upgrade head failed on an empty database:\n{result.stderr[-4000:]}")

        reflected = create_engine(sync_url.set(database=scratch))
        try:
            metadata = MetaData()
            metadata.reflect(bind=reflected)
        finally:
            reflected.dispose()
        return _ddl(metadata)
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{scratch}" WITH (FORCE)'))
        admin.dispose()
