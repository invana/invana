"""initial_schema

Revision ID: 6426041eefc5
Revises:
Create Date: 2026-04-09 13:28:26.140670

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6426041eefc5"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "graph_schemas",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("validation_mode", sa.Enum("strict", "permissive", name="validation_mode_enum"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "schema_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("schema_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=True),
        sa.Column("status", sa.Enum("draft", "active", "archived", name="version_status_enum"), nullable=False),
        sa.Column("change_summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["schema_id"], ["graph_schemas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schema_id", "version", name="uq_schema_version"),
    )
    op.create_table(
        "node_type_definitions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("parent_type", sa.String(length=255), nullable=True),
        sa.Column("is_abstract", sa.Boolean(), nullable=False),
        sa.Column("validation_mode", sa.String(length=16), nullable=True),
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_node_type"),
    )
    op.create_table(
        "edge_type_definitions",
        sa.Column("id", sa.String(length=36), nullable=False),
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
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_edge_type"),
    )
    op.create_table(
        "property_key_definitions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("value_cardinality", sa.Enum("SINGLE", "LIST", "SET", name="value_cardinality_enum"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_property_key"),
    )
    op.create_table(
        "type_property_mappings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("property_key_id", sa.String(length=36), nullable=False),
        sa.Column("node_type_id", sa.String(length=36), nullable=True),
        sa.Column("edge_type_id", sa.String(length=36), nullable=True),
        sa.Column("default_value", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["property_key_id"], ["property_key_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_type_id"], ["node_type_definitions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["edge_type_id"], ["edge_type_definitions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "constraint_definitions",
        sa.Column("id", sa.String(length=36), nullable=False),
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
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_constraint"),
    )
    op.create_table(
        "index_definitions",
        sa.Column("id", sa.String(length=36), nullable=False),
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
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("version_id", "name", name="uq_version_index"),
    )
    op.create_table(
        "schema_projections",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("version_id", sa.String(length=36), nullable=False),
        sa.Column("connector_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.Enum("pending", "projected", "failed", name="projection_status_enum"), nullable=False),
        sa.Column("operations", sa.JSON(), nullable=False),
        sa.Column("errors", sa.JSON(), nullable=False),
        sa.Column("projected_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["version_id"], ["schema_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "validation_rules",
        sa.Column("id", sa.String(length=36), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("validation_rules")
    op.drop_table("schema_projections")
    op.drop_table("index_definitions")
    op.drop_table("constraint_definitions")
    op.drop_table("type_property_mappings")
    op.drop_table("property_key_definitions")
    op.drop_table("edge_type_definitions")
    op.drop_table("node_type_definitions")
    op.drop_table("schema_versions")
    op.drop_table("graph_schemas")
