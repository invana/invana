"""Backend version-compatibility resolution for graph connections (RFC-022).

Two concerns live here, both pure (no I/O):

- **Capability resolution** — load a connector class's declared ``CapabilityProfile``
  and resolve it against a connection's persisted ``server_version``. Shared by the
  connection API (capability payload) and the modeller (property-type enforcement).
- **Effective read-only** — the user-set ``read_only`` flag combined with the
  version-imposed safety valve (unsupported / unknown / untested-and-unacknowledged).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from invana.graph.connectors.base.connector import BaseConnector
from invana.graph.types.capabilities import (
    CapabilityProfile,
    CompatibilityStatus,
    ResolvedCapabilities,
    Version,
)
from invana.utils import import_class_from_dotted_path

if TYPE_CHECKING:
    from invana.graphs.models import GraphConnection

# Statuses that force read-only outright (no acknowledgement can lift them).
_HARD_READONLY = {CompatibilityStatus.UNSUPPORTED.value, CompatibilityStatus.UNKNOWN.value}


def load_profile(connector_class: str) -> CapabilityProfile | None:
    """Load a connector class's declared CapabilityProfile without instantiating it."""
    try:
        connector_cls = import_class_from_dotted_path(connector_class)
    except (ImportError, AttributeError):
        return None
    if not isinstance(connector_cls, type) or not issubclass(connector_cls, BaseConnector):
        return None
    return getattr(connector_cls, "_capability_profile", None)


def resolve_capabilities(
    connection: GraphConnection,
) -> tuple[ResolvedCapabilities, CapabilityProfile | None]:
    """Resolve a connection's capabilities from its connector profile + stored version.

    Pure and offline — no live driver required. Returns an empty resolution when the
    connector class can't be loaded.
    """
    profile = load_profile(connection.connector_class)
    if profile is None:
        return ResolvedCapabilities.empty(), None
    return profile.resolve(Version.parse(connection.server_version)), profile


def supported_property_type_values(connection: GraphConnection) -> set[str]:
    """The canonical property-type value strings this connection's backend supports."""
    resolved, _ = resolve_capabilities(connection)
    return {pt.value for pt in resolved.property_types}


def compatibility_status_for(connector_class: str, server_version: str | None) -> str:
    """Compatibility status for a (connector, version) without a live connection.

    Used when persisting a manually-declared version (RFC-022). Returns ``"unknown"``
    when the connector profile can't be loaded or the version doesn't parse.
    """
    profile = load_profile(connector_class)
    if profile is None:
        return CompatibilityStatus.UNKNOWN.value
    return profile.compatibility(Version.parse(server_version)).value


def effective_read_only(connection: GraphConnection, *, status: str | None = None) -> bool:
    """Whether graph-DB writes are blocked for this connection.

    ``effective = user read_only OR unsupported/unknown OR (untested AND not acked)``.

    ``status`` defaults to the persisted ``compatibility_status`` column; pass a
    freshly-resolved status when the profile may have changed since the last connect.
    """
    if connection.read_only:
        return True
    status = status if status is not None else connection.compatibility_status
    if status in _HARD_READONLY:
        return True
    return status == CompatibilityStatus.UNTESTED.value and not connection.version_acknowledged
