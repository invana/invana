"""Tests for the canonical version-aware capability model (RFC-022)."""

from types import SimpleNamespace

from invana.graph.connectors.cypher.connector import CYPHER_PROFILE
from invana.graph.connectors.gremlin.connector import GREMLIN_PROFILE
from invana.graph.types.capabilities import (
    CapabilityProfile,
    CompatibilityStatus,
    Supports,
    Version,
)
from invana.graph.types.constants import Capability, PropertyType, QueryLanguage
from invana.graphs.compatibility import effective_read_only

# A small profile with a version-gated feature, to exercise resolution directly.
_PROFILE = CapabilityProfile(
    family=QueryLanguage.CYPHER,
    min_version=Version(4, 0),
    tested_max=Version(5, 26),
    property_types={
        PropertyType.STRING: Supports(),
        PropertyType.POINT: Supports(),
    },
    features={
        Capability.CYPHER: Supports(),
        Capability.VECTOR_SEARCH: Supports(since=Version(5, 11)),
    },
)


def test_version_parse_and_ordering():
    assert Version.parse("5.20.0") == Version(5, 20, 0)
    assert Version.parse("neo4j 5") == Version(5, 0, 0)
    assert Version.parse("nonsense") is None
    assert Version(5) < Version(5, 11) < Version(6)


def test_resolve_status_across_the_window():
    # Supported: within [min, tested_max] — feature gated by version.
    supported = _PROFILE.resolve(Version(5, 11))
    assert supported.status is CompatibilityStatus.SUPPORTED
    assert Capability.VECTOR_SEARCH in supported.capabilities
    # Below 5.11 the gated feature is absent even though SUPPORTED.
    assert Capability.VECTOR_SEARCH not in _PROFILE.resolve(Version(5, 0)).capabilities
    # Feature gating is major.minor: any 5.11.x has it; any 5.10.x doesn't.
    assert Capability.VECTOR_SEARCH in _PROFILE.resolve(Version(5, 11, 9)).capabilities
    assert Capability.VECTOR_SEARCH not in _PROFILE.resolve(Version(5, 10, 99)).capabilities

    # Patch releases of the tested-max minor stay SUPPORTED (minor-granular ceiling).
    assert _PROFILE.resolve(Version(5, 26, 26)).status is CompatibilityStatus.SUPPORTED
    # A newer minor is UNTESTED.
    assert _PROFILE.resolve(Version(5, 27)).status is CompatibilityStatus.UNTESTED

    # Untested: above tested_max — resolves at tested_max, read-only at the API layer.
    untested = _PROFILE.resolve(Version(8, 0))
    assert untested.status is CompatibilityStatus.UNTESTED
    assert PropertyType.POINT in untested.property_types

    # Unsupported: below the floor.
    assert _PROFILE.resolve(Version(3, 5)).status is CompatibilityStatus.UNSUPPORTED

    # Unknown: no version detected.
    assert _PROFILE.resolve(None).status is CompatibilityStatus.UNKNOWN


def test_family_profiles_differ_on_native_types():
    # Cypher has native temporal/spatial; Gremlin does not but has set cardinality.
    cypher = CYPHER_PROFILE.resolve(Version(5, 20)).property_types
    gremlin = GREMLIN_PROFILE.resolve(Version(3, 7)).property_types
    assert PropertyType.POINT in cypher and PropertyType.POINT not in gremlin
    assert PropertyType.SET in gremlin and PropertyType.SET not in cypher
    # Semantic overlays are available on both, regardless of backend.
    assert PropertyType.ENUM in cypher and PropertyType.ENUM in gremlin


def _conn(status: str, *, read_only: bool = False, acked: bool = False) -> SimpleNamespace:
    return SimpleNamespace(compatibility_status=status, read_only=read_only, version_acknowledged=acked)


def test_effective_read_only_safety_valve():
    # Untested + unacknowledged → read-only; acknowledging lifts it.
    assert effective_read_only(_conn("untested")) is True
    assert effective_read_only(_conn("untested", acked=True)) is False
    # Unsupported / unknown are hard read-only (no acknowledgement helps).
    assert effective_read_only(_conn("unsupported", acked=True)) is True
    assert effective_read_only(_conn("unknown")) is True
    # Supported is writable unless the user opted into read_only.
    assert effective_read_only(_conn("supported")) is False
    assert effective_read_only(_conn("supported", read_only=True)) is True
