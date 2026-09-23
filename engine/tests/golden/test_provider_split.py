"""The backfill migration `000000000053` carries the rows over.

An empty-database upgrade proves the chain runs and pins what it builds
(``test_schema``); it proves nothing about the **data**, and this migration is
almost entirely data. Two Graphs' worth of rows go in at `52`, `head` is
reached, and what came out the other side is read back.

*What the fixture builds by hand is what the fixture cannot check* — so this
one does not build the post-split rows. It builds the pre-split ones and lets
the migration make them.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from invana.core.settings import settings
from tests.golden.snapshots import ALEMBIC_INI, ENGINE_DIR

_NOW = datetime.now(UTC)


def _alembic(scratch_url: str, target: str, direction: str = "upgrade") -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(ALEMBIC_INI), direction, target],
        env=dict(os.environ, INVANA_DATABASE_URL=scratch_url),
        cwd=ENGINE_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"alembic {direction} {target} failed:\n{result.stderr[-4000:]}")


@pytest.fixture
def scratch():
    """A database of its own, dropped afterwards even on failure."""
    configured = make_url(settings.database_url)
    sync_url = configured.set(drivername="postgresql+psycopg2")
    name = f"invana_split_{uuid.uuid4().hex[:8]}"

    admin = create_engine(sync_url, isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    url = configured.set(database=name).render_as_string(hide_password=False)
    try:
        yield url, sync_url.set(database=name)
    finally:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        admin.dispose()


def _seed(conn) -> None:
    """One owner, two Graphs, four providers — the shapes the backfill has to tell apart."""
    conn.execute(
        text(
            "INSERT INTO users (id, username, password_hash, first_name, is_superuser, is_active, "
            "created_at, updated_at, preferences) "
            "VALUES ('u1', 'owner', 'x', 'Owner', false, true, :now, :now, '{}')"
        ),
        {"now": _NOW},
    )
    for graph_id, slug in (("g1", "has-a-default"), ("g2", "has-none")):
        conn.execute(
            text(
                "INSERT INTO graphs (id, slug, name, setup_state, created_by_id, created_at, updated_at) "
                "VALUES (:id, :slug, :slug, '{}', 'u1', :now, :now)"
            ),
            {"id": graph_id, "slug": slug, "now": _NOW},
        )

    rows = [
        # Two of one vendor on one Graph: the names have to be told apart.
        ("p1", "g1", "anthropic", "claude-opus-4-8", True),
        ("p2", "g1", "anthropic", "claude-haiku-4-5", False),
        ("p3", "g1", "ollama", "qwen3-coder:30b", False),
        # A Graph with providers and no default seeds no cast — it falls to the
        # shipped one, which is the behaviour it already has.
        ("p4", "g2", "openai", "gpt-4o", False),
    ]
    for pid, graph_id, kind, model_id, is_default in rows:
        conn.execute(
            text(
                "INSERT INTO llm_providers (id, graph_id, provider, model_id, guardrails, is_default, "
                "created_at, updated_at) "
                "VALUES (:id, :graph_id, :kind, :model_id, '{}', :is_default, :now, :now)"
            ),
            {
                "id": pid,
                "graph_id": graph_id,
                "kind": kind,
                "model_id": model_id,
                "is_default": is_default,
                "now": _NOW,
            },
        )

    # A world authored against the **interim** address of the second anthropic
    # row. Both rows of a duplicated vendor were id-suffixed while the split
    # waited, and neither of those strings is the name a person picked.
    conn.execute(
        text(
            "INSERT INTO lenses "
            '(id, graph_id, kind, key, name, rules, "cast", closed_layers, version, created_at, updated_at) '
            "VALUES ('l1', 'g1', 'world', 'cheap', 'Cheap', :rules, :cast, '[]', 1, :now, :now)"
        ),
        {
            "rules": json.dumps([{"effect": "allow", "pattern": "llm/anthropic-p2/claude-haiku-4-5"}]),
            "cast": json.dumps({"extract": "llm/anthropic-p2/claude-haiku-4-5"}),
            "now": _NOW,
        },
    )


def test_the_split_carries_the_rows_and_seeds_the_cast(scratch) -> None:
    url, sync = scratch
    _alembic(url, "000000000052")

    engine = create_engine(sync, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as conn:
            _seed(conn)
        _alembic(url, "head")

        with engine.connect() as conn:
            # ── one endpoint per row, named by kind and disambiguated ────────
            names = dict(conn.execute(text("SELECT id, name FROM llm_providers")).all())
            assert names == {"p1": "anthropic-1", "p2": "anthropic-2", "p3": "ollama", "p4": "openai"}

            offered = dict(conn.execute(text("SELECT provider_id, model_id FROM llm_models")).all())
            assert offered == {
                "p1": "claude-opus-4-8",
                "p2": "claude-haiku-4-5",
                "p3": "qwen3-coder:30b",
                "p4": "gpt-4o",
            }

            # ── the ranks the shipped cast reads, seeded from the rate ───────
            caps = dict(conn.execute(text("SELECT provider_id, capabilities FROM llm_models")).all())
            assert caps["p3"]["local"] is True and caps["p3"]["cost_rank"] == 0
            # Opus lists at $15/Mtok in and Haiku at $1 — so one decides and the
            # other extracts, which is the ordering `shipped_cast` resolves.
            assert caps["p1"]["power_rank"] > caps["p2"]["power_rank"]
            assert caps["p1"]["cost_rank"] > caps["p2"]["cost_rank"]

            # ── the default became a cast, naming the address it answered at ─
            seeded = conn.execute(
                text("SELECT graph_id, kind, scope, key, \"cast\" FROM lenses WHERE kind = 'guardrail'")
            ).all()
            assert len(seeded) == 1, "only the Graph that had a default gets one"
            graph_id, kind, scope, key, cast = seeded[0]
            assert (graph_id, kind, scope, key) == ("g1", "guardrail", "graph", "graph-defaults")
            assert cast == {
                "decide": "llm/anthropic-1/claude-opus-4-8",
                "extract": "llm/anthropic-1/claude-opus-4-8",
                "judge": "llm/anthropic-1/claude-opus-4-8",
            }, "embed stays unset — the old row was a chat model"

            # ── an authored rule still names what it named ──────────────────
            rules, cast = conn.execute(text("SELECT rules, \"cast\" FROM lenses WHERE id = 'l1'")).one()
            assert rules == [{"effect": "allow", "pattern": "llm/anthropic-2/claude-haiku-4-5"}]
            assert cast == {"extract": "llm/anthropic-2/claude-haiku-4-5"}

            # ── both ways of picking a model are gone ────────────────────────
            columns = {
                (table, column)
                for table, column in conn.execute(
                    text(
                        "SELECT table_name, column_name FROM information_schema.columns "
                        "WHERE table_name IN ('llm_providers', 'agents')"
                    )
                ).all()
            }
            assert ("llm_providers", "is_default") not in columns
            assert ("llm_providers", "model_id") not in columns
            assert ("agents", "llm_config_id") not in columns
    finally:
        engine.dispose()


def test_the_way_back_down_rebuilds_one_model_and_keeps_the_bound(scratch) -> None:
    """The down path, run rather than described.

    A downgrade nobody has executed is a comment. This one is executed, and
    what it costs is written down here: a second model is dropped and an
    endpoint that offers nothing takes the empty string. What it does **not**
    cost is a bound — the seeded guardrail survives and every address moves back
    to the interim name, because a world left naming a participant that stopped
    existing is a widening whichever direction produced it.
    """
    url, sync = scratch
    _alembic(url, "000000000052")

    engine = create_engine(sync, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as conn:
            _seed(conn)
        _alembic(url, "head")

        with engine.connect() as conn:
            # p1 grows the second model the split made possible — the row that
            # cannot be un-split. It sorts after the first, so MIN() keeps the
            # migrated one and this is the one that is lost.
            conn.execute(
                text(
                    "INSERT INTO llm_models "
                    "(id, provider_id, model_id, capabilities, pricing, status, created_at, updated_at) "
                    "VALUES ('m-second', 'p1', 'claude-sonnet-4-5', '{}', '{}', 'active', :now, :now)"
                ),
                {"now": _NOW},
            )
            # p4 is emptied: an endpoint offering nothing has no model to
            # restore into a NOT NULL column.
            conn.execute(text("DELETE FROM llm_models WHERE provider_id = 'p4'"))

        _alembic(url, "000000000052", "downgrade")

        with engine.connect() as conn:
            # ── one model per row again, and the second one is simply gone ───
            restored = dict(conn.execute(text("SELECT id, model_id FROM llm_providers")).all())
            assert restored == {
                "p1": "claude-opus-4-8",
                "p2": "claude-haiku-4-5",
                "p3": "qwen3-coder:30b",
                "p4": "",
            }, "MIN() keeps one; an endpoint that offered nothing takes the empty string"

            # ── nothing is default any more: the cast answers, and it stayed ─
            assert conn.execute(text("SELECT count(*) FROM llm_providers WHERE is_default")).scalar() == 0
            seeded = conn.execute(
                text("SELECT \"cast\" FROM lenses WHERE kind = 'guardrail' AND key = 'graph-defaults'")
            ).all()
            assert len(seeded) == 1, "a downgrade never removes a bound"
            assert seeded[0][0]["decide"] == "llm/anthropic-p1/claude-opus-4-8", (
                "the bound it was seeded with, spelled the way `52` addresses it"
            )

            # ── and every address is back where `52` can resolve it ─────────
            # The seed authored `anthropic-p2`, the upgrade moved it to
            # `anthropic-2`, and the way down returns it: a round trip, not a
            # one-way rewrite.
            rules, cast = conn.execute(text("SELECT rules, \"cast\" FROM lenses WHERE id = 'l1'")).one()
            assert rules == [{"effect": "allow", "pattern": "llm/anthropic-p2/claude-haiku-4-5"}]
            assert cast == {"extract": "llm/anthropic-p2/claude-haiku-4-5"}

            columns = {
                (table, column)
                for table, column in conn.execute(
                    text(
                        "SELECT table_name, column_name FROM information_schema.columns "
                        "WHERE table_name IN ('llm_providers', 'agents', 'llm_models')"
                    )
                ).all()
            }
            assert ("llm_providers", "name") not in columns, "the address segment goes with the table"
            assert not any(table == "llm_models" for table, _ in columns)
            assert ("agents", "llm_config_id") in columns
    finally:
        engine.dispose()
