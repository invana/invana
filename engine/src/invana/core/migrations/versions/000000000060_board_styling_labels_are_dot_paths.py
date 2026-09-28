"""A board's per-type label is a root-relative dot path.

``styling.nodeTypes.<type>.labelProperty`` held a bare property key (``name``),
which cannot name a node's own ``id`` or ``type``. It becomes
``labelKey``, the path the canvas resolves: ``id`` · ``type`` · ``data.name``.
A stored ``labelProperty: "name"`` is rewritten as ``labelKey: "data.name"``,
on the live board and on every saved version of it.

Downgrade writes a ``data.<key>`` path back as ``labelProperty`` and drops a
root path, which the old shape cannot hold.

Revision ID: 000000000060
Revises: 000000000059
Create Date: 2026-09-28
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "000000000060"
down_revision: str | Sequence[str] | None = "000000000059"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("boards", "board_versions")
DATA = "data."


def _to_key(style: dict) -> dict:
    prop = style.pop("labelProperty", None)
    if prop:
        style["labelKey"] = f"{DATA}{prop}"
    return style


def _to_property(style: dict) -> dict:
    key = style.pop("labelKey", None)
    if isinstance(key, str) and key.startswith(DATA):
        style["labelProperty"] = key[len(DATA) :]
    return style


def _rewrite(convert: Callable[[dict], dict], marker: str) -> None:
    bind = op.get_bind()
    for name in TABLES:
        table = sa.table(name, sa.column("id"), sa.column("styling", sa.JSON))
        rows = bind.execute(
            sa.select(table.c.id, table.c.styling).where(sa.cast(table.c.styling, sa.Text).like(f"%{marker}%"))
        ).all()
        for row_id, styling in rows:
            node_types = (styling or {}).get("nodeTypes") or {}
            styling["nodeTypes"] = {t: convert(dict(s or {})) for t, s in node_types.items()}
            bind.execute(sa.update(table).where(table.c.id == row_id).values(styling=styling))


def upgrade() -> None:
    _rewrite(_to_key, "labelProperty")


def downgrade() -> None:
    _rewrite(_to_property, "labelKey")
