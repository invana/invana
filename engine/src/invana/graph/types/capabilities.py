"""Canonical, version-aware capability model (RFC-022).

Capability is **data**, not branching code. Each connector class declares one
:class:`CapabilityProfile` carrying two axes — supported property types and feature
flags — where every entry is gated to a version window via :class:`Supports`. Resolving
a profile against a detected server version yields a :class:`ResolvedCapabilities` plus a
:class:`CompatibilityStatus`.

This generalises the old flat ``BaseConnector.capabilities() -> set[Capability]``:
``capabilities()`` is now ``profile.resolve(version).capabilities``.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from invana.graph.types.constants import (
    SEMANTIC_OVERLAY_TYPES,
    Capability,
    PropertyType,
    QueryLanguage,
)

# Prefer a dotted ``major.minor[.patch]`` token; fall back to a standalone integer.
# ``\b`` keeps the integer fallback from grabbing a digit embedded in a name
# (e.g. the ``4`` in ``neo4j``).
_VERSION_RE = re.compile(r"\b(\d+)\.(\d+)(?:\.(\d+))?\b")
_VERSION_INT_RE = re.compile(r"\b(\d+)\b")


@dataclass(frozen=True, order=True)
class Version:
    """A comparable ``major.minor.patch`` version.

    Ordering is tuple-wise so ``Version(5) < Version(5, 11) < Version(6)``.
    """

    major: int
    minor: int = 0
    patch: int = 0

    @classmethod
    def parse(cls, raw: str | None) -> Version | None:
        """Parse a loose version string (e.g. ``"5.20.0"``, ``"3.7.4"``, ``"neo4j 5"``).

        Returns ``None`` when no leading numeric version can be found — callers treat
        that as ``UNKNOWN``.
        """
        if not raw:
            return None
        match = _VERSION_RE.search(raw)
        if match is not None:
            major, minor, patch = match.groups()
            return cls(int(major), int(minor), int(patch or 0))
        int_match = _VERSION_INT_RE.search(raw)
        if int_match is not None:
            return cls(int(int_match.group(1)))
        return None

    @property
    def major_minor(self) -> tuple[int, int]:
        """``(major, minor)`` — the granularity capabilities change at.

        Graph DBs ship capability changes in **minor** releases (e.g. Neo4j vector
        search in 5.11); **patch** releases are bug-fixes only. Compatibility and
        feature gating compare at this granularity so patches never shift a verdict.
        """
        return (self.major, self.minor)

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


@dataclass(frozen=True)
class Supports:
    """Declares that a capability/type is supported within a version window.

    ``since`` is an inclusive lower bound; ``until`` is an exclusive upper bound.
    ``None`` on either side means open-ended. ``native`` distinguishes natively-stored
    types from semantic overlays (stored as string/text).
    """

    since: Version | None = None
    until: Version | None = None
    native: bool = True

    def applies(self, version: Version) -> bool:
        # Compare at major.minor — features land in minors, patches don't change them.
        key = version.major_minor
        if self.since is not None and key < self.since.major_minor:
            return False
        return not (self.until is not None and key >= self.until.major_minor)


class CompatibilityStatus(StrEnum):
    """How the detected server version relates to a profile's tested window."""

    SUPPORTED = "supported"  # min_version <= v <= tested_max
    UNTESTED = "untested"  # v > tested_max — proceed at risk, read-only until acked
    UNSUPPORTED = "unsupported"  # v < min_version — blocked
    UNKNOWN = "unknown"  # version not detected / undetectable


@dataclass(frozen=True)
class ResolvedCapabilities:
    """The capability set effective for a specific (profile, version)."""

    version: Version | None
    status: CompatibilityStatus
    property_types: frozenset[PropertyType]
    capabilities: frozenset[Capability]

    @classmethod
    def empty(cls) -> ResolvedCapabilities:
        """Used when no profile can be resolved (unknown connector class)."""
        return cls(
            version=None,
            status=CompatibilityStatus.UNKNOWN,
            property_types=frozenset(),
            capabilities=frozenset(),
        )


@dataclass(frozen=True)
class CapabilityProfile:
    """The canonical, declarative capability model — one per connector class.

    ``min_version`` / ``tested_max`` bound the window Invana has validated. Resolve
    against a detected version to get the effective capabilities + a compatibility
    verdict. Vendors extend a family baseline with :meth:`merge` rather than rewriting.
    """

    family: QueryLanguage
    min_version: Version
    tested_max: Version
    property_types: Mapping[PropertyType, Supports] = field(default_factory=dict)
    features: Mapping[Capability, Supports] = field(default_factory=dict)

    def compatibility(self, version: Version | None) -> CompatibilityStatus:
        # Bounds are compared at major.minor (patch ignored): ``min_version`` and
        # ``tested_max`` each cover their whole minor line, so e.g. 5.26.26 stays
        # SUPPORTED under a 5.26 ceiling — patches never change capabilities.
        if version is None:
            return CompatibilityStatus.UNKNOWN
        key = version.major_minor
        if key < self.min_version.major_minor:
            return CompatibilityStatus.UNSUPPORTED
        if key > self.tested_max.major_minor:
            return CompatibilityStatus.UNTESTED
        return CompatibilityStatus.SUPPORTED

    def resolve(self, version: Version | None) -> ResolvedCapabilities:
        """Resolve effective capabilities for ``version``.

        - ``UNKNOWN`` / ``UNSUPPORTED`` resolve at the conservative ``min_version`` floor.
        - ``UNTESTED`` resolves at ``tested_max`` (best-effort forward assumption — we
          expose what the latest validated version supports).
        - ``SUPPORTED`` resolves at the detected version.
        """
        status = self.compatibility(version)
        basis = {
            CompatibilityStatus.UNKNOWN: self.min_version,
            CompatibilityStatus.UNSUPPORTED: self.min_version,
            CompatibilityStatus.UNTESTED: self.tested_max,
            CompatibilityStatus.SUPPORTED: version,
        }[status]
        # `basis` is always a concrete Version here (version is non-None for SUPPORTED).
        types = frozenset(t for t, s in self.property_types.items() if s.applies(basis))
        caps = frozenset(c for c, s in self.features.items() if s.applies(basis))
        return ResolvedCapabilities(
            version=version,
            status=status,
            property_types=types,
            capabilities=caps,
        )

    def merge(
        self,
        *,
        min_version: Version | None = None,
        tested_max: Version | None = None,
        property_types: Mapping[PropertyType, Supports] | None = None,
        features: Mapping[Capability, Supports] | None = None,
    ) -> CapabilityProfile:
        """Return a copy with overrides layered on top — vendors extend a family profile."""
        return CapabilityProfile(
            family=self.family,
            min_version=min_version or self.min_version,
            tested_max=tested_max or self.tested_max,
            property_types={**self.property_types, **(property_types or {})},
            features={**self.features, **(features or {})},
        )

    @property
    def tested_range(self) -> str:
        """Human-readable tested window, e.g. ``"4.0 - 5.26"`` (for the API/UI).

        The upper bound is minor-granular (patches of ``tested_max``'s minor are
        supported), so it's rendered as ``major.minor`` — not ``major.x``.
        """
        return f"{self.min_version.major}.{self.min_version.minor} - {self.tested_max.major}.{self.tested_max.minor}"


def always(native: bool = True) -> Supports:
    """Shorthand for an unconditionally-supported entry."""
    return Supports(native=native)


def overlay() -> Supports:
    """Shorthand for a semantic-overlay type (always available, non-native)."""
    return Supports(native=False)


__all__ = [
    "SEMANTIC_OVERLAY_TYPES",
    "CapabilityProfile",
    "CompatibilityStatus",
    "ResolvedCapabilities",
    "Supports",
    "Version",
    "always",
    "overlay",
]
