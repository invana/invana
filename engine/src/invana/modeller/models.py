"""SQLAlchemy async models for graph schema storage.

Tables
------
- ``graph_schemas``              — top-level schema container
- ``schema_versions``            — immutable snapshots (draft → active → archived)
- ``property_key_definitions``   — global property keys (name + type), one per version
- ``node_type_definitions``      — node types with inheritance and display metadata
- ``edge_type_definitions``      — edge types with multiplicity and endpoint restrictions
- ``type_property_mappings``     — links property keys to node/edge types
- ``validation_rules``           — per-property-key or per-mapping validation rules
- ``constraint_definitions``     — explicit constraints (unique, exists, node_key) on labels
- ``index_definitions``          — schema-managed indexes
- ``schema_projections``         — records of DDL pushed to graph databases
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class Base(DeclarativeBase):
    """Shared declarative base for all schema models."""


# ---------------------------------------------------------------------------
# Graph Schema
# ---------------------------------------------------------------------------


class GraphSchema(Base):
    __tablename__ = "graph_schemas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    validation_mode: Mapped[str] = mapped_column(
        Enum("strict", "permissive", name="validation_mode_enum"),
        default="strict",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    versions: Mapped[list[SchemaVersion]] = relationship(
        back_populates="schema", cascade="all, delete-orphan", order_by="SchemaVersion.created_at"
    )


# ---------------------------------------------------------------------------
# Schema Version
# ---------------------------------------------------------------------------


class SchemaVersion(Base):
    __tablename__ = "schema_versions"
    __table_args__ = (UniqueConstraint("schema_id", "version", name="uq_schema_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    schema_id: Mapped[str] = mapped_column(ForeignKey("graph_schemas.id", ondelete="CASCADE"), nullable=False)
    version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("draft", "active", "archived", name="version_status_enum"),
        default="draft",
    )
    change_summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    schema: Mapped[GraphSchema] = relationship(back_populates="versions")
    property_keys: Mapped[list[PropertyKeyDefinition]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )
    node_types: Mapped[list[NodeTypeDefinition]] = relationship(back_populates="version", cascade="all, delete-orphan")
    edge_types: Mapped[list[EdgeTypeDefinition]] = relationship(back_populates="version", cascade="all, delete-orphan")
    constraints: Mapped[list[ConstraintDefinition]] = relationship(
        back_populates="version", cascade="all, delete-orphan"
    )
    indexes: Mapped[list[IndexDefinition]] = relationship(back_populates="version", cascade="all, delete-orphan")
    projections: Mapped[list[SchemaProjection]] = relationship(back_populates="version", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Property Key Definition (global per version)
# ---------------------------------------------------------------------------


class PropertyKeyDefinition(Base):
    """A global property key — defined once per version, used by many types."""

    __tablename__ = "property_key_definitions"
    __table_args__ = (UniqueConstraint("version_id", "name", name="uq_version_property_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(64), nullable=False, default="string")
    value_cardinality: Mapped[str] = mapped_column(
        Enum("SINGLE", "LIST", "SET", name="value_cardinality_enum"),
        default="SINGLE",
    )
    description: Mapped[str] = mapped_column(Text, default="")

    version: Mapped[SchemaVersion] = relationship(back_populates="property_keys")
    mappings: Mapped[list[TypePropertyMapping]] = relationship(
        back_populates="property_key", cascade="all, delete-orphan"
    )
    validation_rules: Mapped[list[ValidationRule]] = relationship(
        back_populates="property_key",
        cascade="all, delete-orphan",
        foreign_keys="ValidationRule.property_key_id",
    )


# ---------------------------------------------------------------------------
# Node Type Definition
# ---------------------------------------------------------------------------


class NodeTypeDefinition(Base):
    __tablename__ = "node_type_definitions"
    __table_args__ = (UniqueConstraint("version_id", "name", name="uq_version_node_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    parent_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_abstract: Mapped[bool] = mapped_column(Boolean, default=False)
    validation_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)

    version: Mapped[SchemaVersion] = relationship(back_populates="node_types")
    property_mappings: Mapped[list[TypePropertyMapping]] = relationship(
        back_populates="node_type",
        cascade="all, delete-orphan",
        foreign_keys="TypePropertyMapping.node_type_id",
    )


# ---------------------------------------------------------------------------
# Edge Type Definition
# ---------------------------------------------------------------------------


class EdgeTypeDefinition(Base):
    __tablename__ = "edge_type_definitions"
    __table_args__ = (UniqueConstraint("version_id", "name", name="uq_version_edge_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    source_node_types: Mapped[list | None] = mapped_column(JSON, default=list)
    target_node_types: Mapped[list | None] = mapped_column(JSON, default=list)
    multiplicity: Mapped[str] = mapped_column(
        Enum("MULTI", "SIMPLE", "ONE2MANY", "MANY2ONE", "ONE2ONE", name="multiplicity_enum"),
        default="MULTI",
    )

    version: Mapped[SchemaVersion] = relationship(back_populates="edge_types")
    property_mappings: Mapped[list[TypePropertyMapping]] = relationship(
        back_populates="edge_type",
        cascade="all, delete-orphan",
        foreign_keys="TypePropertyMapping.edge_type_id",
    )


# ---------------------------------------------------------------------------
# Type Property Mapping (links property keys to types)
# ---------------------------------------------------------------------------


class TypePropertyMapping(Base):
    """How a specific node/edge type uses a global property key."""

    __tablename__ = "type_property_mappings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    property_key_id: Mapped[str] = mapped_column(
        ForeignKey("property_key_definitions.id", ondelete="CASCADE"), nullable=False
    )
    node_type_id: Mapped[str | None] = mapped_column(
        ForeignKey("node_type_definitions.id", ondelete="CASCADE"), nullable=True
    )
    edge_type_id: Mapped[str | None] = mapped_column(
        ForeignKey("edge_type_definitions.id", ondelete="CASCADE"), nullable=True
    )
    default_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    property_key: Mapped[PropertyKeyDefinition] = relationship(back_populates="mappings")
    node_type: Mapped[NodeTypeDefinition | None] = relationship(
        back_populates="property_mappings", foreign_keys=[node_type_id]
    )
    edge_type: Mapped[EdgeTypeDefinition | None] = relationship(
        back_populates="property_mappings", foreign_keys=[edge_type_id]
    )
    validation_rules: Mapped[list[ValidationRule]] = relationship(
        back_populates="type_property_mapping",
        cascade="all, delete-orphan",
        foreign_keys="ValidationRule.type_property_mapping_id",
    )


# ---------------------------------------------------------------------------
# Validation Rule
# ---------------------------------------------------------------------------


class ValidationRule(Base):
    __tablename__ = "validation_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    property_key_id: Mapped[str | None] = mapped_column(
        ForeignKey("property_key_definitions.id", ondelete="CASCADE"), nullable=True
    )
    type_property_mapping_id: Mapped[str | None] = mapped_column(
        ForeignKey("type_property_mappings.id", ondelete="CASCADE"), nullable=True
    )
    rule_type: Mapped[str] = mapped_column(
        Enum("range", "pattern", "enum", "min_length", "max_length", "custom", name="rule_type_enum"),
        nullable=False,
    )
    params: Mapped[dict] = mapped_column(JSON, default=dict)

    property_key: Mapped[PropertyKeyDefinition | None] = relationship(
        back_populates="validation_rules", foreign_keys=[property_key_id]
    )
    type_property_mapping: Mapped[TypePropertyMapping | None] = relationship(
        back_populates="validation_rules", foreign_keys=[type_property_mapping_id]
    )


# ---------------------------------------------------------------------------
# Constraint Definition
# ---------------------------------------------------------------------------


class ConstraintDefinition(Base):
    """Explicit constraint on a label's properties (unique, exists, node_key, etc.)."""

    __tablename__ = "constraint_definitions"
    __table_args__ = (UniqueConstraint("version_id", "name", name="uq_version_constraint"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_kind: Mapped[str] = mapped_column(
        Enum("node_type", "edge_type", name="constraint_target_kind_enum"), nullable=False
    )
    target_label: Mapped[str] = mapped_column(String(255), nullable=False)
    constraint_type: Mapped[str] = mapped_column(
        Enum(
            "unique",
            "exists",
            "node_key",
            "relationship_unique",
            "relationship_exists",
            name="constraint_type_enum",
        ),
        nullable=False,
    )
    properties: Mapped[list] = mapped_column(JSON, nullable=False)

    version: Mapped[SchemaVersion] = relationship(back_populates="constraints")


# ---------------------------------------------------------------------------
# Index Definition
# ---------------------------------------------------------------------------


class IndexDefinition(Base):
    __tablename__ = "index_definitions"
    __table_args__ = (UniqueConstraint("version_id", "name", name="uq_version_index"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_kind: Mapped[str] = mapped_column(
        Enum("node_type", "edge_type", name="index_target_kind_enum"), nullable=False
    )
    target_label: Mapped[str] = mapped_column(String(255), nullable=False)
    properties: Mapped[list] = mapped_column(JSON, nullable=False)
    index_type: Mapped[str] = mapped_column(
        Enum("range", "composite", "fulltext", "text", "point", "lookup", name="index_type_enum"),
        default="range",
    )
    index_options: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    version: Mapped[SchemaVersion] = relationship(back_populates="indexes")


# ---------------------------------------------------------------------------
# Schema Projection
# ---------------------------------------------------------------------------


class SchemaProjection(Base):
    __tablename__ = "schema_projections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    version_id: Mapped[str] = mapped_column(ForeignKey("schema_versions.id", ondelete="CASCADE"), nullable=False)
    connector_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("pending", "projected", "failed", name="projection_status_enum"),
        default="pending",
    )
    operations: Mapped[list] = mapped_column(JSON, default=list)
    errors: Mapped[list] = mapped_column(JSON, default=list)
    projected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    version: Mapped[SchemaVersion] = relationship(back_populates="projections")
