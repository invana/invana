"""The structured readers under a lens, on every live backend of this language (CC22)."""

from tests.graph.connectors.neighbour_lens import (  # noqa: F401 — the fixture
    NeighbourLensContract,
    ResolveLensContract,
    TypeCountLensContract,
    seeded,
)


class TestNeighbourLens(NeighbourLensContract):
    pass


class TestTypeCountLens(TypeCountLensContract):
    pass


class TestResolveLens(ResolveLensContract):
    pass
