"""Validator — validates data against the active schema before writes.

Designed for the engine's data-writing pipeline. Called **before** the
connector's ``data_writer`` to enforce schema rules that the database
cannot natively enforce.

Performance target: < 1ms per validation using an in-memory cache of the
active schema version with pre-resolved inheritance.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from invana.graph.types.constants import PropertyType
from invana.modeller.inheritance import (
    build_type_map,
    get_subtypes,
    resolve_effective_mappings,
)
from invana.modeller.models import (
    ConstraintDefinition,
    EdgeTypeDefinition,
    GraphVersion,
    NodeTypeDefinition,
    TypePropertyMapping,
    ValidationRule,
)

# ---------------------------------------------------------------------------
# Validation error
# ---------------------------------------------------------------------------


@dataclass
class ValidationError:
    """A single validation failure."""

    code: str
    message: str
    field: str | None = None


# ---------------------------------------------------------------------------
# Cached schema
# ---------------------------------------------------------------------------


@dataclass
class _CachedSchema:
    """Pre-computed schema lookup structures for fast validation."""

    version_id: str
    validation_mode: str  # schema-level default

    node_types: dict[str, NodeTypeDefinition]
    edge_types: dict[str, EdgeTypeDefinition]

    # Pre-resolved effective property mappings (own + inherited)
    effective_mappings: dict[str, list[TypePropertyMapping]] = field(default_factory=dict)
    # Constraints grouped by target_label
    constraints_by_label: dict[str, list[ConstraintDefinition]] = field(default_factory=dict)
    # Subtype sets per parent type
    subtypes: dict[str, set[str]] = field(default_factory=dict)


def _build_cache(version: GraphVersion, validation_mode: str = "strict") -> _CachedSchema:
    """Build the in-memory lookup cache from a loaded GraphVersion."""
    nt_map = build_type_map(version.node_types)
    et_map = {et.name: et for et in version.edge_types}

    effective: dict[str, list[TypePropertyMapping]] = {}
    subtypes_map: dict[str, set[str]] = {}

    for nt in version.node_types:
        effective[nt.name] = resolve_effective_mappings(nt, nt_map)
        subtypes_map[nt.name] = get_subtypes(nt.name, nt_map)

    # Group constraints by target_label for fast lookup
    constraints_by_label: dict[str, list[ConstraintDefinition]] = {}
    for c in version.constraints:
        constraints_by_label.setdefault(c.target_label, []).append(c)

    return _CachedSchema(
        version_id=version.id,
        validation_mode=validation_mode,
        node_types=nt_map,
        edge_types=et_map,
        effective_mappings=effective,
        constraints_by_label=constraints_by_label,
        subtypes=subtypes_map,
    )


# ---------------------------------------------------------------------------
# Type checking helpers
# ---------------------------------------------------------------------------

# Keyed by canonical ``PropertyType`` values so the validator and the vocabulary
# advertised by connectors (RFC-022) never drift. Temporal/spatial + semantic-overlay
# values are accepted as ISO strings / json; container cardinality is handled below.
_TYPE_VALIDATORS: dict[str, type | tuple[type, ...]] = {
    PropertyType.STRING.value: str,
    PropertyType.INTEGER.value: (int,),
    PropertyType.FLOAT.value: (int, float),
    PropertyType.BOOLEAN.value: (bool,),
    PropertyType.ENUM.value: (str,),
    PropertyType.UUID.value: (str,),
    PropertyType.JSON.value: (str, dict, list),
    PropertyType.DATE.value: (str,),
    PropertyType.TIME.value: (str,),
    PropertyType.DATETIME.value: (str,),  # Accept ISO strings
    PropertyType.DURATION.value: (str,),
    PropertyType.POINT.value: (dict, str),
    PropertyType.MAP.value: (dict,),
}

_CONTAINER_TYPES = {PropertyType.LIST.value, PropertyType.SET.value}


def _check_type(value: Any, expected_type: str) -> bool:
    """Check if *value* matches the expected property type string."""
    if expected_type.startswith("list["):
        return isinstance(value, list)
    if expected_type in _CONTAINER_TYPES:
        return isinstance(value, (list, set))
    validator = _TYPE_VALIDATORS.get(expected_type)
    if validator is None:
        return True  # Unknown types pass validation
    return isinstance(value, validator)


# ---------------------------------------------------------------------------
# Rule validators
# ---------------------------------------------------------------------------


def _validate_rules(
    value: Any,
    rules: list[ValidationRule],
    prop_name: str,
) -> list[ValidationError]:
    """Apply validation rules to a single property value."""
    errors: list[ValidationError] = []

    for rule in rules:
        params = rule.params or {}

        if rule.rule_type == "range":
            min_val = params.get("min")
            max_val = params.get("max")
            if min_val is not None and value < min_val:
                errors.append(
                    ValidationError(
                        code="range_violation",
                        message=f"Value {value} is below minimum {min_val}",
                        field=prop_name,
                    )
                )
            if max_val is not None and value > max_val:
                errors.append(
                    ValidationError(
                        code="range_violation",
                        message=f"Value {value} exceeds maximum {max_val}",
                        field=prop_name,
                    )
                )

        elif rule.rule_type == "pattern":
            pattern = params.get("pattern", "")
            if isinstance(value, str) and not re.search(pattern, value):
                errors.append(
                    ValidationError(
                        code="pattern_violation",
                        message=f"Value '{value}' does not match pattern '{pattern}'",
                        field=prop_name,
                    )
                )

        elif rule.rule_type == "enum":
            allowed = params.get("values", [])
            if value not in allowed:
                errors.append(
                    ValidationError(
                        code="enum_violation",
                        message=f"Value '{value}' not in allowed values: {allowed}",
                        field=prop_name,
                    )
                )

        elif rule.rule_type == "min_length":
            min_len = params.get("value", 0)
            if hasattr(value, "__len__") and len(value) < min_len:
                errors.append(
                    ValidationError(
                        code="min_length_violation",
                        message=f"Length {len(value)} is below minimum {min_len}",
                        field=prop_name,
                    )
                )

        elif rule.rule_type == "max_length":
            max_len = params.get("value", float("inf"))
            if hasattr(value, "__len__") and len(value) > max_len:
                errors.append(
                    ValidationError(
                        code="max_length_violation",
                        message=f"Length {len(value)} exceeds maximum {max_len}",
                        field=prop_name,
                    )
                )

    return errors


# ---------------------------------------------------------------------------
# Schema Validator
# ---------------------------------------------------------------------------


class SchemaValidator:
    """Validates data operations against the active schema version.

    Usage::

        validator = SchemaValidator()
        validator.load(active_version, schema_validation_mode)
        errors = validator.validate_vertex_create("Person", {"name": "Alice", "age": 30})
        if errors:
            raise ValidationError(errors)
    """

    def __init__(self) -> None:
        self._cache: _CachedSchema | None = None

    def load(self, version: GraphVersion, validation_mode: str = "strict") -> None:
        """Load and cache a schema version for validation."""
        self._cache = _build_cache(version, validation_mode)

    @property
    def loaded(self) -> bool:
        return self._cache is not None

    def _get_validation_mode(self, node_type: NodeTypeDefinition | None) -> str:
        """Resolve the effective validation mode for a type."""
        if node_type is not None and node_type.validation_mode is not None:
            return node_type.validation_mode
        return self._cache.validation_mode if self._cache else "strict"

    # ------------------------------------------------------------------
    # Vertex validation
    # ------------------------------------------------------------------

    def validate_vertex_create(
        self,
        label: str,
        properties: dict[str, Any],
    ) -> list[ValidationError]:
        """Validate data for creating a new vertex."""
        if self._cache is None:
            return []  # No schema loaded — skip validation

        errors: list[ValidationError] = []

        # Check label exists
        nt = self._cache.node_types.get(label)
        if nt is None:
            errors.append(
                ValidationError(
                    code="unknown_label",
                    message=f"Node label '{label}' is not defined in the active schema.",
                )
            )
            return errors

        # Abstract type check
        if nt.is_abstract:
            errors.append(
                ValidationError(
                    code="abstract_type",
                    message=f"Cannot create instances of abstract type '{label}'.",
                )
            )
            return errors

        mode = self._get_validation_mode(nt)
        effective = self._cache.effective_mappings.get(label, [])
        label_constraints = self._cache.constraints_by_label.get(label, [])

        errors.extend(self._validate_properties(properties, effective, label_constraints, mode))
        return errors

    def validate_vertex_update(
        self,
        label: str,
        properties: dict[str, Any],
    ) -> list[ValidationError]:
        """Validate data for updating an existing vertex."""
        if self._cache is None:
            return []

        errors: list[ValidationError] = []

        nt = self._cache.node_types.get(label)
        if nt is None:
            errors.append(
                ValidationError(
                    code="unknown_label",
                    message=f"Node label '{label}' is not defined in the active schema.",
                )
            )
            return errors

        mode = self._get_validation_mode(nt)
        effective = self._cache.effective_mappings.get(label, [])

        # On update, don't check required — only validate provided properties
        errors.extend(
            self._validate_properties(
                properties,
                effective,
                [],  # no constraint checks on update
                mode,
                check_required=False,
            )
        )
        return errors

    # ------------------------------------------------------------------
    # Edge validation
    # ------------------------------------------------------------------

    def validate_edge_create(
        self,
        label: str,
        source_label: str,
        target_label: str,
        properties: dict[str, Any],
    ) -> list[ValidationError]:
        """Validate data for creating a new edge."""
        if self._cache is None:
            return []

        errors: list[ValidationError] = []

        et = self._cache.edge_types.get(label)
        if et is None:
            errors.append(
                ValidationError(
                    code="unknown_label",
                    message=f"Edge label '{label}' is not defined in the active schema.",
                )
            )
            return errors

        # Source type check (with Liskov substitution via subtypes)
        if et.source_node_types:
            allowed_sources = set(et.source_node_types)
            for src in et.source_node_types:
                allowed_sources |= self._cache.subtypes.get(src, set())
            if source_label not in allowed_sources:
                errors.append(
                    ValidationError(
                        code="invalid_source_type",
                        message=f"Source label '{source_label}' not allowed for edge '{label}'. "
                        f"Allowed: {sorted(allowed_sources)}",
                    )
                )

        # Target type check
        if et.target_node_types:
            allowed_targets = set(et.target_node_types)
            for tgt in et.target_node_types:
                allowed_targets |= self._cache.subtypes.get(tgt, set())
            if target_label not in allowed_targets:
                errors.append(
                    ValidationError(
                        code="invalid_target_type",
                        message=f"Target label '{target_label}' not allowed for edge '{label}'. "
                        f"Allowed: {sorted(allowed_targets)}",
                    )
                )

        # Property validation
        source_nt = self._cache.node_types.get(source_label)
        mode = self._get_validation_mode(source_nt)
        label_constraints = self._cache.constraints_by_label.get(label, [])

        mappings = list(et.property_mappings) if et.property_mappings else []
        errors.extend(self._validate_properties(properties, mappings, label_constraints, mode))

        return errors

    # ------------------------------------------------------------------
    # Property validation (shared)
    # ------------------------------------------------------------------

    def _validate_properties(
        self,
        properties: dict[str, Any],
        mappings: list[TypePropertyMapping],
        constraints: list[ConstraintDefinition],
        mode: str,
        *,
        check_required: bool = True,
    ) -> list[ValidationError]:
        """Validate a property dict against property mappings and constraints."""
        errors: list[ValidationError] = []
        # Build lookup: property key name → mapping
        mapping_by_name: dict[str, TypePropertyMapping] = {m.property_key.name: m for m in mappings}

        # Check required properties from "exists" constraints
        if check_required:
            for c in constraints:
                if c.constraint_type == "exists":
                    for pname in c.properties:
                        if pname not in properties:
                            errors.append(
                                ValidationError(
                                    code="missing_required",
                                    message=f"Required property '{pname}' is missing (constraint '{c.name}').",
                                    field=pname,
                                )
                            )

        for key, value in properties.items():
            mapping = mapping_by_name.get(key)
            if mapping is None:
                if mode == "strict":
                    errors.append(
                        ValidationError(
                            code="unknown_property",
                            message=f"Property '{key}' is not defined in the schema.",
                            field=key,
                        )
                    )
                continue

            if value is None:
                continue  # None values skip type/rule checks

            pk = mapping.property_key

            # Type check
            if not _check_type(value, pk.type):
                errors.append(
                    ValidationError(
                        code="type_mismatch",
                        message=f"Property '{key}' expected type '{pk.type}', got {type(value).__name__}.",
                        field=key,
                    )
                )

            # Value cardinality check
            if pk.value_cardinality == "SINGLE" and isinstance(value, list):
                errors.append(
                    ValidationError(
                        code="cardinality_violation",
                        message=f"Property '{key}' has SINGLE cardinality but received a list.",
                        field=key,
                    )
                )
            elif pk.value_cardinality == "SET" and isinstance(value, list) and len(value) != len(set(value)):
                errors.append(
                    ValidationError(
                        code="cardinality_violation",
                        message=f"Property '{key}' has SET cardinality but contains duplicates.",
                        field=key,
                    )
                )

            # Validation rules: global (property key) + type-specific (mapping)
            all_rules: list[ValidationRule] = []
            if pk.validation_rules:
                all_rules.extend(pk.validation_rules)
            if mapping.validation_rules:
                all_rules.extend(mapping.validation_rules)
            if all_rules:
                errors.extend(_validate_rules(value, all_rules, key))

        return errors
