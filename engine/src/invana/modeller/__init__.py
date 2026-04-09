"""Modeller — graph model management, versioning, and DB synchronisation.

Manages schema definitions in the app-state database (PostgreSQL/SQLite)
and stitches them to graph databases via connectors.

Public API::

    from invana.modeller import (
        SchemaStore,
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

from invana.modeller.database import create_db_engine, create_session_factory
from invana.modeller.inheritance import (
    InheritanceCycleError,
    InheritanceDepthError,
    build_hierarchy,
    build_type_map,
    get_subtypes,
    resolve_effective_properties,
)
from invana.modeller.introspector import Introspector
from invana.modeller.json_io import SchemaExporter, SchemaImporter
from invana.modeller.projector import Projector
from invana.modeller.reconciler import Reconciler, SchemaNotConfiguredError, SchemaOutOfSyncError
from invana.modeller.store import SchemaStore
from invana.modeller.validator import SchemaValidator, ValidationError
from invana.modeller.versioner import Versioner, compute_diff

__all__ = [
    "Introspector",
    "InheritanceCycleError",
    "InheritanceDepthError",
    "Projector",
    "Reconciler",
    "SchemaExporter",
    "SchemaImporter",
    "SchemaNotConfiguredError",
    "SchemaOutOfSyncError",
    "SchemaStore",
    "SchemaValidator",
    "ValidationError",
    "Versioner",
    "build_hierarchy",
    "build_type_map",
    "compute_diff",
    "create_db_engine",
    "create_session_factory",
    "get_subtypes",
    "resolve_effective_properties",
]
