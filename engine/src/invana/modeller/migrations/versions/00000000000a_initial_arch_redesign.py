"""Initial schema for the arch/redesign branch (RFC-012 + RFC-017).

Single migration covering:

- Modeller: graph_models + graph_versions + node/edge/property/index/constraint defs.
- Identity (Layer 1): users (with username), refresh_tokens.
- Graph domain (Layer 2): graphs container, graph_connections (1:1), graph_members,
  invitations (graph-scoped).

This is a destructive reset on the unshipped ``arch/redesign`` branch. Any local
dev DB must be dropped and re-initialized.

Revision ID: 00000000000a
Revises:
Create Date: 2026-05-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql as pg

revision: str = "00000000000a"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_GRAPH_ROLE_VALUES = ("developer", "analyst", "admin")
_GRAPH_ROLE_ENUM = "graph_role"
_GRAPH_STATUS_VALUES = ("active", "archived")
_GRAPH_STATUS_ENUM = "graph_status"


def _graph_role_enum() -> sa.Enum:
    return pg.ENUM(*_GRAPH_ROLE_VALUES, name=_GRAPH_ROLE_ENUM, create_type=False)


def _graph_status_enum() -> sa.Enum:
    return pg.ENUM(*_GRAPH_STATUS_VALUES, name=_GRAPH_STATUS_ENUM, create_type=False)


def _create_pg_enum_if_absent(name: str, values: Sequence[str]) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    exists = bind.execute(sa.text(f"SELECT 1 FROM pg_type WHERE typname = '{name}'")).scalar()
    if not exists:
        op.execute(f"CREATE TYPE {name} AS ENUM ({', '.join(repr(v) for v in values)})")


def upgrade() -> None:
    _create_pg_enum_if_absent(_GRAPH_ROLE_ENUM, _GRAPH_ROLE_VALUES)
    _create_pg_enum_if_absent(_GRAPH_STATUS_ENUM, _GRAPH_STATUS_VALUES)

    # -----------------------------------------------------------------------
    # Modeller — graph_models + graph_versions + type/property/constraint defs
    # -----------------------------------------------------------------------

    op.create_table(
        "graph_models",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "validation_mode",
            sa.Enum("strict", "permissive", name="validation_mode_enum"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "graph_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("model_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=True),
        sa.Column("status", sa.Enum("draft", "active", "archived", name="version_status_enum"), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["model_id"], ["graph_models.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("model_id", "version", name="uq_graph_version"),
    )
    op.create_table(
        "node_type_definitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("parent_type", sa.String(length=255), nullable=True),
        sa.Column("is_abstract", sa.Boolean(), nullable=False),
        sa.Column("validation_mode", sa.String(length=16), nullable=True),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_node_type"),
    )
    op.create_table(
        "edge_type_definitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("source_node_types", sa.JSON(), nullable=True),
        sa.Column("target_node_types", sa.JSON(), nullable=True),
        sa.Column(
            "multiplicity",
            sa.Enum("MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE", name="multiplicity_enum"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_edge_type"),
    )
    op.create_table(
        "property_key_definitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column(
            "value_cardinality",
            sa.Enum("SINGLE", "LIST", "SET", name="value_cardinality_enum"),
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_property_key"),
    )
    op.create_table(
        "type_property_mappings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("property_key_id", sa.String(length=36), nullable=False),
        sa.Column("node_type_id", sa.String(length=36), nullable=True),
        sa.Column("edge_type_id", sa.String(length=36), nullable=True),
        sa.Column("default_value", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["property_key_id"], ["property_key_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_type_id"], ["node_type_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["edge_type_id"], ["edge_type_definitions.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "constraint_definitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "target_kind",
            sa.Enum("node_type", "edge_type", name="constraint_target_kind_enum"),
            nullable=False,
        ),
        sa.Column("target_label", sa.String(length=255), nullable=False),
        sa.Column(
            "constraint_type",
            sa.Enum(
                "unique",
                "exists",
                "node_key",
                "relationship_unique",
                "relationship_exists",
                name="constraint_type_enum",
            ),
            nullable=False,
        ),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_constraint"),
    )
    op.create_table(
        "index_definitions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("target_kind", sa.Enum("node_type", "edge_type", name="index_target_kind_enum"), nullable=False),
        sa.Column("target_label", sa.String(length=255), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.Column(
            "index_type",
            sa.Enum("range", "composite", "fulltext", "text", "point", "lookup", name="index_type_enum"),
            nullable=False,
        ),
        sa.Column("index_options", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_index"),
    )
    op.create_table(
        "schema_projections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("connector_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.Enum("pending", "projected", "failed", name="projection_status_enum"), nullable=False),
        sa.Column("operations", sa.JSON(), nullable=False),
        sa.Column("errors", sa.JSON(), nullable=False),
        sa.Column("projected_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["version_id"], ["graph_versions.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "validation_rules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("property_key_id", sa.String(length=36), nullable=True),
        sa.Column("type_property_mapping_id", sa.String(length=36), nullable=True),
        sa.Column(
            "rule_type",
            sa.Enum("range", "pattern", "enum", "min_length", "max_length", "custom", name="rule_type_enum"),
            nullable=False,
        ),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["property_key_id"], ["property_key_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["type_property_mapping_id"], ["type_property_mappings.id"], ondelete="CASCADE"),
    )

    # -----------------------------------------------------------------------
    # Identity — users + refresh_tokens
    # -----------------------------------------------------------------------

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=True),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("username_last_changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # -----------------------------------------------------------------------
    # Graph domain — graphs (container) + graph_connections + members + invitations
    # -----------------------------------------------------------------------

    op.create_table(
        "graphs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("intent", sa.Text(), nullable=True),
        sa.Column("objectives", sa.Text(), nullable=True),
        sa.Column("success_criteria", sa.Text(), nullable=True),
        sa.Column("setup_state", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("status", _graph_status_enum(), nullable=False, server_default="active"),
        sa.Column("created_by_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("created_by_id", "slug", name="uq_graphs_owner_slug"),
    )
    op.create_index("ix_graphs_created_by_id", "graphs", ["created_by_id"])

    op.create_table(
        "graph_connections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("uri", sa.String(length=2048), nullable=False),
        sa.Column("connector_class", sa.String(length=512), nullable=False),
        sa.Column("auth_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("read_only", sa.Boolean(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("CONNECTING", "ACTIVE", "ERROR", "INACTIVE", name="graph_connection_status_enum"),
            nullable=False,
        ),
        sa.Column("last_health_check_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("model_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["model_id"], ["graph_models.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("graph_id", name="uq_graph_connections_graph_id"),
        sa.UniqueConstraint("model_id", name="uq_graph_connections_model_id"),
    )
    op.create_index("ix_graph_connections_graph_id", "graph_connections", ["graph_id"])

    op.create_table(
        "graph_members",
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("role", _graph_role_enum(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("graph_id", "user_id", name="pk_graph_members"),
    )

    op.create_table(
        "invitations",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("graph_id", sa.String(length=36), nullable=False),
        sa.Column("role", _graph_role_enum(), nullable=False),
        sa.Column("invited_by_id", sa.String(length=36), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["graph_id"], ["graphs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
    )
    op.create_index("ix_invitations_token_hash", "invitations", ["token_hash"], unique=True)
    op.create_index("ix_invitations_email", "invitations", ["email"])


def downgrade() -> None:
    # Graph domain
    op.drop_index("ix_invitations_email", table_name="invitations")
    op.drop_index("ix_invitations_token_hash", table_name="invitations")
    op.drop_table("invitations")
    op.drop_table("graph_members")
    op.drop_index("ix_graph_connections_graph_id", table_name="graph_connections")
    op.drop_table("graph_connections")
    op.drop_index("ix_graphs_created_by_id", table_name="graphs")
    op.drop_table("graphs")

    # Identity
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    # Modeller
    op.drop_table("validation_rules")
    op.drop_table("schema_projections")
    op.drop_table("index_definitions")
    op.drop_table("constraint_definitions")
    op.drop_table("type_property_mappings")
    op.drop_table("property_key_definitions")
    op.drop_table("edge_type_definitions")
    op.drop_table("node_type_definitions")
    op.drop_table("graph_versions")
    op.drop_table("graph_models")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(f"DROP TYPE IF EXISTS {_GRAPH_ROLE_ENUM}")
        op.execute(f"DROP TYPE IF EXISTS {_GRAPH_STATUS_ENUM}")
        op.execute("DROP TYPE IF EXISTS graph_connection_status_enum")
