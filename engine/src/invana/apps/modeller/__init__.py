"""Modeller — graph model management, versioning, and DB synchronisation.

Manages schema definitions in the app-state database (PostgreSQL/SQLite)
and stitches them to graph databases via connectors.

Public API::

    from invana.apps.modeller import (
        ModelStore,
        Versioner,
        Projector,
        Introspector,
        SchemaValidator,
        Reconciler,
        SchemaExporter,
        SchemaImporter,
        create_db_engine,
        create_session_factory,
    )
"""

from invana.apps.modeller.database import create_db_engine, create_session_factory
from invana.apps.modeller.inheritance import (
    InheritanceCycleError,
    InheritanceDepthError,
    build_hierarchy,
    build_type_map,
    get_subtypes,
    resolve_effective_mappings,
)
from invana.apps.modeller.introspector import Introspector
from invana.apps.modeller.json_io import SchemaExporter, SchemaImporter
from invana.apps.modeller.projector import Projector
from invana.apps.modeller.reconciler import Reconciler, SchemaNotConfiguredError, SchemaOutOfSyncError
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.validator import SchemaValidator, ValidationError
from invana.apps.modeller.versioner import Versioner, compute_diff

__all__ = [
    "InheritanceCycleError",
    "InheritanceDepthError",
    "Introspector",
    "ModelStore",
    "Projector",
    "Reconciler",
    "SchemaExporter",
    "SchemaImporter",
    "SchemaNotConfiguredError",
    "SchemaOutOfSyncError",
    "SchemaValidator",
    "ValidationError",
    "Versioner",
    "build_hierarchy",
    "build_type_map",
    "compute_diff",
    "create_db_engine",
    "create_session_factory",
    "get_subtypes",
    "resolve_effective_mappings",
]
