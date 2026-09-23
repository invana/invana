"""A provider holds models (docs/for-developers/building-engine/govern-and-agents-data-model.md § 5.2).

**The irreversible one**, which is why it is last. Everything additive landed
first, so Govern shipped without touching Agents at all.

One ``llm_providers`` row was one *provider + model*. It becomes one
**configured endpoint** — a name somebody chose, a kind, a base URL, one
credential — and ``llm_models`` holds what it offers, because
``llm/anthropic-prod/claude-opus-5`` has a provider segment and a model segment
and one table cannot be both
([PM9](docs/for-developers/modules/agents/features/providers-and-models.md) ·
[GV9](docs/for-developers/modules/govern/spec.md)).

Three drops go with it, and together they remove **both** existing answers to
*which model answers this*:

``llm_providers.is_default``
    with its partial unique index. A default was only ever the answer to *which
    model when nobody said*, and the lens ``cast`` is that answer now
    ([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).

``agents.llm_config_id``
    an agent binds no provider
    ([PM1](docs/for-developers/modules/agents/features/providers-and-models.md)).

``llm_providers.model_id``
    moved into ``llm_models``.

**So the migration seeds a cast**
([§ 8 decision 3](docs/for-developers/building-engine/govern-and-agents-data-model.md)).
Dropping ``is_default`` without one would leave a Graph running the shipped
default, which may name a model that Graph is not credentialed for — a silent
change to what produces an answer. Each Graph's current default becomes an
explicit ``kind = guardrail``, ``scope = graph`` lens casting all three reading
roles at it, so a Graph keeps answering with the model it answers with today. A
Graph with no default gets no seeded cast and falls to the shipped one, which is
the same behaviour it has now.

``capabilities`` is seeded from the **published rate**, frozen into this file
rather than imported from ``apps/llm/pricing`` — a migration that reads live
code stops being a record of what it did. Price is the only capability signal an
old row carries, and vendors price by capability, so it is a defensible seed and
an editable one ([PM12](docs/for-developers/modules/agents/features/providers-and-models.md)).

**The down path is lossy and says so.** ``llm_providers.model_id`` is rebuilt
from the first model per provider; a provider that grew a second model cannot be
un-split, and the seeded guardrail is left behind rather than deleted — removing
a bound on the way down is the one thing a downgrade must never do.

Revision ID: 000000000053
Revises: 000000000052
Create Date: 2026-09-20
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "000000000053"
down_revision: str | Sequence[str] | None = "000000000052"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Frozen copy of the published input rates, $/Mtok, matched on the longest
#: model-id prefix. A migration that imported ``apps/llm/pricing`` would seed
#: different numbers every time the list is corrected by a release.
_INPUT_RATE: dict[str, float] = {
    "claude-opus-4": 15.0,
    "claude-sonnet-4": 3.0,
    "claude-haiku-4": 1.0,
    "claude-3-5-haiku": 0.80,
    "claude-3-5-sonnet": 3.0,
    "claude-3-opus": 15.0,
    "claude-3-haiku": 0.25,
    "gpt-4o-mini": 0.15,
    "gpt-4o": 2.50,
    "gpt-4-turbo": 10.0,
}

_LOCAL_KINDS = ("ollama", "local")
#: The Claude Agent SDK reaches the same models an API key does.
_PRICED_AS = {"claude_agent_sdk": "anthropic"}

_SEEDED_KEY = "graph-defaults"
_SEEDED_NAME = "Graph defaults"


def _capabilities(kind: str, model_id: str) -> dict:
    """What the shipped cast reads, seeded from what the old row could tell us."""
    local = kind in _LOCAL_KINDS
    rate = _rate(kind, model_id)
    if local:
        # A local model costs no API dollars and is the one `judge` prefers,
        # because nothing leaves the machine.
        cost_rank, power_rank = 0, 20
    elif rate is None:
        # Unknown is not cheap and not capable — the middle, so an unpriced
        # model never silently wins either role.
        cost_rank, power_rank = 50, 50
    else:
        # Vendors price by capability, so one number seeds both orderings: cheap
        # is a low cost_rank, expensive is a high power_rank.
        cost_rank = power_rank = min(99, round(rate))
    return {
        "context_window": None,
        "supports_tools": True,
        "embedding": False,
        "cost_rank": cost_rank,
        "power_rank": power_rank,
        "local": local,
    }


def _rate(kind: str, model_id: str) -> float | None:
    if kind in _LOCAL_KINDS:
        return 0.0
    vendor = _PRICED_AS.get(kind, kind)
    if vendor not in ("anthropic", "openai"):
        return None
    lowered = (model_id or "").lower()
    matches = [p for p in _INPUT_RATE if lowered.startswith(p)]
    return _INPUT_RATE[max(matches, key=len)] if matches else None


def _names(rows: Sequence) -> dict[str, str]:
    """A name per provider row: its kind, suffixed where a Graph has two.

    The same derivation the catalogue used while the split waited, so every rule
    written against ``llm/<kind>/<model>`` still resolves after it.
    """
    seen: dict[tuple[str, str], int] = {}
    for row in rows:
        seen[(row.graph_id, row.provider)] = seen.get((row.graph_id, row.provider), 0) + 1

    used: dict[tuple[str, str], int] = {}
    out: dict[str, str] = {}
    for row in rows:
        pair = (row.graph_id, row.provider)
        if seen[pair] == 1:
            out[row.id] = row.provider
        else:
            used[pair] = used.get(pair, 0) + 1
            out[row.id] = f"{row.provider}-{used[pair]}"
    return out


def upgrade() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)

    # ── 1 · what an endpoint offers ──────────────────────────────────────────
    op.create_table(
        "llm_models",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("llm_providers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model_id", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("pricing", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("provider_id", "model_id", name="uq_llm_model_provider_model"),
    )
    op.create_index("ix_llm_models_provider_id", "llm_models", ["provider_id"])

    # ── 2 · the address segment ──────────────────────────────────────────────
    # The partial index goes first: a batch that recreates this table would have
    # to reflect it, and a partial index is the shape reflection gets wrong.
    op.drop_index("uq_llm_providers_default_per_graph", table_name="llm_providers")

    with op.batch_alter_table("llm_providers") as batch:
        batch.add_column(sa.Column("name", sa.String(64), nullable=True))

    rows = list(
        bind.execute(
            sa.text(
                "SELECT id, graph_id, provider, model_id, is_default "
                "FROM llm_providers ORDER BY graph_id, created_at, id"
            )
        )
    )
    names = _names(rows)

    for row in rows:
        bind.execute(
            sa.text("UPDATE llm_providers SET name = :name WHERE id = :id"),
            {"name": names[row.id], "id": row.id},
        )
        bind.execute(
            sa.text(
                "INSERT INTO llm_models "
                "(id, provider_id, model_id, display_name, capabilities, pricing, status, created_at, updated_at) "
                "VALUES (:id, :provider_id, :model_id, NULL, :capabilities, '{}', 'active', :now, :now)"
            ),
            {
                "id": str(uuid.uuid4()),
                "provider_id": row.id,
                "model_id": row.model_id,
                "capabilities": json.dumps(_capabilities(row.provider, row.model_id)),
                "now": now,
            },
        )

    with op.batch_alter_table("llm_providers") as batch:
        batch.alter_column("name", existing_type=sa.String(64), nullable=False)
        batch.create_unique_constraint("uq_llm_provider_graph_name", ["graph_id", "name"])

    # ── 3 · rules keep naming what they named ────────────────────────────────
    _rename_addresses(bind, rows=rows, names=names)

    # ── 4 · the cast the default becomes ─────────────────────────────────────
    _seed_casts(bind, rows=rows, names=names, now=now)

    # ── 5 · the window A1 reads a spend over ─────────────────────────────────
    # *$1.84 of $40.00 this month* is a windowed ``SUM(cost_usd)`` per agent
    # ([§ 5.1](docs/for-developers/building-engine/govern-and-agents-data-model.md)),
    # and never a counter column — a counter can disagree with the runs it
    # counts. ``ix_task_runs_agent_id`` alone makes that a scan of every run the
    # agent has ever done, whatever window is asked for.
    op.create_index("ix_task_runs_agent_started", "task_runs", ["agent_id", "started_at"])

    # ── 6 · the two mechanisms that picked a model ───────────────────────────
    with op.batch_alter_table("llm_providers") as batch:
        batch.drop_column("is_default")
        batch.drop_column("model_id")

    # The FK was created unnamed, so it is dropped with its column rather than
    # by a guessed name: Postgres drops the dependent constraint, and SQLite's
    # batch recreate leaves it out of the new table.
    with op.batch_alter_table("agents") as batch:
        batch.drop_column("llm_config_id")


def _interim_name(row, *, duplicated: bool) -> str:
    """What the catalogue derived while the split waited.

    ``kind`` where a Graph had one of a vendor, ``kind-<first 8 of the id>``
    where it had two — and **both** rows were suffixed, not just the second.
    """
    return row.provider if not duplicated else f"{row.provider}-{row.id[:8]}"


def _rename_addresses(bind, *, rows: Sequence, names: dict[str, str]) -> None:
    """Move every authored rule and cast from the interim address to the real one.

    A Graph with two endpoints of one vendor addressed them
    ``llm/anthropic-3f9c2b17/*``, because the interim name had to disambiguate
    and only an id could. The real name is ``anthropic-2``
    ([PM10](docs/for-developers/modules/agents/features/providers-and-models.md)) —
    readable, and the thing a refusal says back. Those two strings cannot both
    be the address, so the rules that named the old one are rewritten to the new
    one here: silently leaving them pointed at a participant that no longer
    exists would widen every world holding one, which is the opposite of what a
    bound is for.

    A Graph with one endpoint per vendor is untouched — its interim name and its
    real name are the same word.
    """
    counts: dict[tuple[str, str], int] = {}
    for row in rows:
        counts[(row.graph_id, row.provider)] = counts.get((row.graph_id, row.provider), 0) + 1

    moves: dict[str, list[tuple[str, str]]] = {}
    for row in rows:
        old = _interim_name(row, duplicated=counts[(row.graph_id, row.provider)] > 1)
        new = names[row.id]
        if old != new:
            moves.setdefault(row.graph_id, []).append((f"llm/{old}/", f"llm/{new}/"))
    _move_addresses(bind, moves)


def _restore_addresses(bind) -> None:
    """The same move, backwards, so the way down does not widen a Graph either.

    Going up, ``llm/anthropic-3f9c2b17/*`` became ``llm/anthropic-2/*`` so that no
    world was left naming a participant that had stopped existing. Coming down,
    ``name`` goes with the column and ``anthropic-2`` stops existing in turn — so
    every address moves back to the interim name the pre-split catalogue derives.

    Leaving the guardrail row standing while its addresses resolve to nothing is
    not preserving the bound, it is removing it quietly: a bound that matches
    nothing bounds nothing
    ([PM18](docs/for-developers/modules/agents/features/providers-and-models.md)).
    """
    rows = list(
        bind.execute(
            sa.text("SELECT id, graph_id, provider, name FROM llm_providers ORDER BY graph_id, created_at, id")
        )
    )
    counts: dict[tuple[str, str], int] = {}
    for row in rows:
        counts[(row.graph_id, row.provider)] = counts.get((row.graph_id, row.provider), 0) + 1

    moves: dict[str, list[tuple[str, str]]] = {}
    for row in rows:
        interim = _interim_name(row, duplicated=counts[(row.graph_id, row.provider)] > 1)
        if interim != row.name:
            moves.setdefault(row.graph_id, []).append((f"llm/{row.name}/", f"llm/{interim}/"))
    _move_addresses(bind, moves)


def _move_addresses(bind, moves: dict[str, list[tuple[str, str]]]) -> None:
    """Rewrite one Graph's rules and casts at a time, touching only what moved."""
    if not moves:
        return

    for graph_id, pairs in moves.items():
        lenses = bind.execute(
            sa.text('SELECT id, rules, "cast" FROM lenses WHERE graph_id = :graph_id'),
            {"graph_id": graph_id},
        ).all()
        for lens_id, rules, cast in lenses:
            moved_rules = _replace_deep(rules, pairs)
            moved_cast = _replace_deep(cast, pairs)
            if moved_rules == rules and moved_cast == cast:
                continue
            bind.execute(
                sa.text('UPDATE lenses SET rules = :rules, "cast" = :cast WHERE id = :id'),
                {"rules": json.dumps(moved_rules), "cast": json.dumps(moved_cast), "id": lens_id},
            )


def _replace_deep(value, pairs: Sequence[tuple[str, str]]):
    """Rewrite address prefixes wherever a string sits in a rule document.

    A rule's shape is Govern's, not this migration's, so the walk is structural
    rather than a list of known keys — a rule that grows a field keeps working.
    """
    if isinstance(value, str):
        for old, new in pairs:
            if value.startswith(old):
                return new + value[len(old) :]
        return value
    if isinstance(value, list):
        return [_replace_deep(item, pairs) for item in value]
    if isinstance(value, dict):
        return {key: _replace_deep(item, pairs) for key, item in value.items()}
    return value


def _seed_casts(bind, *, rows: Sequence, names: dict[str, str], now: datetime) -> None:
    """Each Graph's default becomes an explicit graph-scoped guardrail.

    ``embed`` is left unset on purpose: the old row was a chat model, and casting
    it to embed would claim a capability nobody configured.
    """
    defaults = {row.graph_id: row for row in rows if row.is_default}
    if not defaults:
        return

    held = {
        graph_id
        for (graph_id,) in bind.execute(
            sa.text("SELECT DISTINCT graph_id FROM lenses WHERE kind = 'guardrail' AND scope = 'graph'")
        )
    }

    for graph_id, row in defaults.items():
        if graph_id in held:
            # A Graph that already governs itself has said what it wants; adding
            # a second graph-scoped guardrail would compose with it invisibly.
            continue
        address = f"llm/{names[row.id]}/{row.model_id}"
        bind.execute(
            sa.text(
                "INSERT INTO lenses "
                '(id, graph_id, kind, key, name, scope, rules, "cast", closed_layers, version, created_at, '
                "updated_at) "
                "VALUES (:id, :graph_id, 'guardrail', :key, :name, 'graph', '[]', :cast, '[]', 1, :now, :now)"
            ),
            {
                "id": str(uuid.uuid4()),
                "graph_id": graph_id,
                "key": _SEEDED_KEY,
                "name": _SEEDED_NAME,
                "cast": json.dumps({"decide": address, "extract": address, "judge": address}),
                "now": now,
            },
        )


def downgrade() -> None:
    """**Lossy.** A provider that grew a second model cannot be un-split.

    The first model per provider is written back to ``llm_providers.model_id``
    and the rest are dropped. ``is_default`` comes back empty — the cast that
    replaced it stays, because a downgrade that deleted a bound would widen
    every Graph it touched, and every address moves back to the interim name for
    the same reason: keeping the row while its addresses stop resolving is the
    same widening with the evidence left in place.
    """
    bind = op.get_bind()

    with op.batch_alter_table("agents") as batch:
        batch.add_column(sa.Column("llm_config_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "agents_llm_config_id_fkey", "llm_providers", ["llm_config_id"], ["id"], ondelete="SET NULL"
        )

    with op.batch_alter_table("llm_providers") as batch:
        batch.add_column(sa.Column("model_id", sa.String(255), nullable=True))
        batch.add_column(sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()))

    restored = sa.text("SELECT provider_id, MIN(model_id) FROM llm_models WHERE status = 'active' GROUP BY provider_id")
    for provider_id, model_id in bind.execute(restored):
        bind.execute(
            sa.text("UPDATE llm_providers SET model_id = :model_id WHERE id = :id"),
            {"model_id": model_id, "id": provider_id},
        )
    # A provider that offered nothing has no model to restore; the column was
    # NOT NULL before, so it takes the empty string rather than blocking the way
    # back down.
    bind.execute(sa.text("UPDATE llm_providers SET model_id = '' WHERE model_id IS NULL"))

    # Before `name` goes: the addresses it spells have to move with it.
    _restore_addresses(bind)

    with op.batch_alter_table("llm_providers") as batch:
        batch.alter_column("model_id", existing_type=sa.String(255), nullable=False)
        batch.drop_constraint("uq_llm_provider_graph_name", type_="unique")
        batch.drop_column("name")

    op.create_index(
        "uq_llm_providers_default_per_graph",
        "llm_providers",
        ["graph_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
        sqlite_where=sa.text("is_default = 1"),
    )

    op.drop_index("ix_task_runs_agent_started", table_name="task_runs")
    op.drop_index("ix_llm_models_provider_id", table_name="llm_models")
    op.drop_table("llm_models")
