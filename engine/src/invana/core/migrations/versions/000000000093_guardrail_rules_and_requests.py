"""A Graph's guardrail is one property rule, and requests are an inbox.

docs/for-developers/modules/govern/features/guardrails.md ·
docs/for-developers/modules/govern/features/requests.md.

``lenses`` gains ``target`` · ``access`` · ``leaves`` · ``allowed_in``, and a
check that a Graph-scoped guardrail carries the first three. Every existing
layered Graph guardrail is re-expressed as property rules: an ``llm`` egress
without ``property_values`` becomes ``*.* · read · stays in the Graph``, and each
property exclusion becomes ``*.<property> · never read``. A ``third_party`` deny
has no property form and is dropped. Boards of the retired ``guardrail`` kind
are deleted. ``requests`` is created.

Revision ID: 000000000093
Revises: 000000000092
Create Date: 2026-10-26
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "000000000093"
down_revision: str | Sequence[str] | None = "000000000092"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STAYS = ["type_names", "property_names", "the_question", "record_ids", "aggregates"]


def _json(value):
    if isinstance(value, str):
        return json.loads(value)
    return value or []


def _rule_for(target: str, access: str, leaves: bool) -> tuple[str, str, list[dict]]:
    type_name, prop = target.split(".", 1)
    entry = prop if type_name == "*" else target
    rules: list[dict] = []
    if access == "never":
        rules.append({"match": "graph_data/model/**", "allow": True, "properties": {"exclude": [entry]}})
        name = f"{target} never read"
    else:
        name = f"{target} never leaves"
    if not leaves:
        rules += [
            {"match": "llm/**", "allow": True, "egress": {"may_send": list(_STAYS)}},
            {"match": "third_party/**", "allow": True, "egress": {"may_send": list(_STAYS)}},
        ]
    parts = ["all" if p == "*" else p for p in (type_name, prop)]
    key = "guardrail-" + "-".join("".join(c if c.isalnum() else "-" for c in p.lower()).strip("-") for p in parts)
    return name, key[:128], rules


def _re_express(bind) -> None:
    rows = bind.execute(
        sa.text(
            "SELECT id, graph_id, rules, created_by_id FROM lenses "
            "WHERE kind = 'guardrail' AND scope = 'graph' AND target IS NULL"
        )
    ).all()
    now = datetime.now(UTC)
    for lens_id, graph_id, raw_rules, created_by_id in rows:
        targets: dict[str, tuple[str, bool]] = {}
        for rule in _json(raw_rules):
            match = rule.get("match") or ""
            may_send = (rule.get("egress") or {}).get("may_send")
            if (
                match.startswith("llm/")
                and rule.get("allow")
                and may_send is not None
                and "property_values" not in may_send
                and "everything" not in may_send
            ):
                targets["*.*"] = ("read", False)
            for prop in (rule.get("properties") or {}).get("exclude") or []:
                targets.setdefault(f"*.{prop}", ("never", True))
        bind.execute(sa.text("DELETE FROM lenses WHERE id = :id"), {"id": lens_id})
        for target, (access, leaves) in targets.items():
            name, key, rules = _rule_for(target, access, leaves)
            taken = bind.execute(
                sa.text("SELECT 1 FROM lenses WHERE graph_id = :g AND key = :k"), {"g": graph_id, "k": key}
            ).first()
            if taken:
                continue
            bind.execute(
                sa.text(
                    "INSERT INTO lenses (id, graph_id, kind, key, name, scope, target, access, leaves, "
                    'allowed_in, rules, "cast", closed_layers, created_by_id, version, created_at, updated_at) '
                    "VALUES (:id, :g, 'guardrail', :k, :n, 'graph', :t, :a, :l, CAST(:ai AS JSON), "
                    "CAST(:r AS JSON), CAST(:c AS JSON), CAST(:cl AS JSON), :by, 1, :now, :now)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "g": graph_id,
                    "k": key,
                    "n": name,
                    "t": target,
                    "a": access,
                    "l": leaves,
                    "ai": "[]",
                    "r": json.dumps(rules),
                    "c": "{}",
                    "cl": "[]",
                    "by": created_by_id,
                    "now": now,
                },
            )


def upgrade() -> None:
    op.add_column("lenses", sa.Column("target", sa.String(255), nullable=True))
    op.add_column("lenses", sa.Column("access", sa.String(8), nullable=True))
    op.add_column("lenses", sa.Column("leaves", sa.Boolean(), nullable=True))
    op.add_column("lenses", sa.Column("allowed_in", sa.JSON(), nullable=False, server_default="[]"))

    bind = op.get_bind()
    _re_express(bind)
    bind.execute(sa.text("DELETE FROM boards WHERE kind = 'guardrail'"))

    op.create_check_constraint(
        "ck_lens_graph_guardrail_rule",
        "lenses",
        "kind <> 'guardrail' OR scope <> 'graph' OR (target IS NOT NULL AND access IS NOT NULL AND leaves IS NOT NULL)",
    )

    op.create_table(
        "requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("graph_id", sa.String(36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("asked_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("agent_id", sa.String(36), nullable=True),
        sa.Column("run_id", sa.String(36), nullable=True),
        sa.Column("session_id", sa.String(36), nullable=True),
        sa.Column("guardrail_id", sa.String(36), sa.ForeignKey("lenses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("blocked_by", sa.String(255), nullable=True),
        sa.Column("asks", sa.Integer(), nullable=False),
        sa.Column("last_asked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(8), nullable=False),
        sa.Column("resolution", sa.String(16), nullable=True),
        sa.Column("resolution_note", sa.String(512), nullable=True),
        sa.Column("world_id", sa.String(36), sa.ForeignKey("lenses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("model_id", sa.String(36), sa.ForeignKey("graph_models.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_by_id", sa.String(36), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_requests_graph_id", "requests", ["graph_id"])
    op.create_index("ix_requests_graph_status", "requests", ["graph_id", "status"])
    op.create_index("ix_requests_guardrail", "requests", ["guardrail_id"])


def downgrade() -> None:
    op.drop_index("ix_requests_guardrail", table_name="requests")
    op.drop_index("ix_requests_graph_status", table_name="requests")
    op.drop_index("ix_requests_graph_id", table_name="requests")
    op.drop_table("requests")
    op.drop_constraint("ck_lens_graph_guardrail_rule", "lenses", type_="check")
    op.drop_column("lenses", "allowed_in")
    op.drop_column("lenses", "leaves")
    op.drop_column("lenses", "access")
    op.drop_column("lenses", "target")
