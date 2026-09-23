"""The address grammar — `<layer>/<sublayer>/<name>`, and the patterns that match it.

**The address is the only identifier**
([GV4](docs/for-developers/modules/govern/spec.md)): the lens matches on it, the
ledger records it, the run dashboard expands it. One string instead of five
shapes of rule, which is why this module is thirty lines of matching and not a
resolver per layer.

Two wildcards, and they are not interchangeable:

``*``
    exactly one segment. ``llm/anthropic-prod/*`` is every model on that
    provider row and nothing on another.
``**``
    the rest, including nothing. ``third_party/**`` is the whole layer, and
    ``third_party/api/clearbit.com/**`` is that host's every path.

A ``*`` may also appear **inside** a segment, which is how a rule names a model
across its versions: ``graph_data/model/Deals@*`` is every published version of
``Deals``, and writing the version out would make a bound that silently stops
applying the next time somebody publishes.

``**`` is only meaningful as the final segment; anywhere else it would make one
pattern match two different shapes of thing, and a rule nobody can read the
reach of is not a bound.
"""

from __future__ import annotations

import enum
import re
from dataclasses import dataclass
from fnmatch import fnmatchcase

#: Segments are the readable characters an address is built from. Deliberately
#: permissive about ``.``, ``@`` and ``:`` — ``Routes@v4``, ``clearbit.com`` and
#: ``claude-haiku-4.5`` are all one segment each.
_SEGMENT = re.compile(r"^[A-Za-z0-9_.@:+~-]+$")
#: The same, with ``*`` allowed as a glob within the segment.
_SEGMENT_GLOB = re.compile(r"^[A-Za-z0-9_.@:+~*-]+$")


class Layer(enum.StrEnum):
    """The five governed classes of participant, plus the spine.

    ``agent`` is the **spine** — the runtime itself, which does the
    participating rather than being a participant
    ([govern § 1](docs/for-developers/modules/govern/spec.md)). It is addressed
    and recorded like the rest so the ledger has one shape, and it is never
    governed: a rule that denies it would deny the run its own dispatches.
    """

    graph_data = "graph_data"
    llm = "llm"
    third_party = "third_party"
    cache = "cache"
    human = "human"
    agent = "agent"


#: The layers a rule may govern. The spine is not one of them.
GOVERNED_LAYERS: tuple[Layer, ...] = (
    Layer.graph_data,
    Layer.llm,
    Layer.third_party,
    Layer.cache,
    Layer.human,
)

#: What a layer's second segment may be. A sublayer is not a second vocabulary —
#: it is the touch record's ``kind`` (govern § 1). ``llm`` is the open one: its
#: sublayer is the *configured provider row*, whose name a person chose
#: ([GV9](docs/for-developers/modules/govern/spec.md)), so it cannot be a fixed
#: list here.
SUBLAYERS: dict[Layer, tuple[str, ...] | None] = {
    Layer.graph_data: ("model", "stitch", "dataset"),
    Layer.llm: None,
    Layer.third_party: ("api", "app", "db", "agent"),
    Layer.cache: ("answer", "prefix", "result"),
    Layer.human: ("person", "role"),
    Layer.agent: ("agent",),
}


@dataclass(frozen=True, slots=True)
class Address:
    """One participant, split into the three parts every surface reads back."""

    layer: Layer
    sublayer: str
    #: Everything after the sublayer, ``/`` included —
    #: ``clearbit.com/v2/companies`` is one name, not three segments.
    name: str

    def __str__(self) -> str:
        return f"{self.layer.value}/{self.sublayer}/{self.name}"


class AddressError(ValueError):
    """The string is not an address. Raised where a person typed one, so the
    message names which part is wrong rather than echoing the whole string."""


def parse_address(raw: str) -> Address:
    """``graph_data/model/Routes@v4`` → an :class:`Address`.

    Rejects wildcards: this parses a *participant*, and a participant with a
    ``*`` in it is a pattern that got as far as somewhere only concrete
    addresses belong.
    """
    parts = raw.strip().split("/")
    if len(parts) < 3 or not all(parts):
        raise AddressError("An address is <layer>/<sublayer>/<name>.")
    try:
        layer = Layer(parts[0])
    except ValueError:
        raise AddressError(f"Unknown layer {parts[0]!r}.") from None

    sublayer, name = parts[1], "/".join(parts[2:])
    allowed = SUBLAYERS[layer]
    if allowed is not None and sublayer not in allowed:
        raise AddressError(f"{layer.value} has no sublayer {sublayer!r} — one of {', '.join(allowed)}.")
    for segment in (sublayer, *name.split("/")):
        if "*" in segment:
            raise AddressError("An address names one participant; a pattern belongs on a rule.")
        if not _SEGMENT.match(segment):
            raise AddressError(f"{segment!r} is not a readable address segment.")
    return Address(layer=layer, sublayer=sublayer, name=name)


def validate_pattern(raw: str) -> None:
    """Raise :class:`AddressError` unless ``raw`` is a usable rule pattern.

    A pattern names a layer first — a rule that begins ``**`` would span every
    layer at once, and the five layers are the thing a person reasons about.
    """
    parts = raw.strip().split("/")
    if not parts or not all(parts):
        raise AddressError("A rule matches <layer>/<sublayer>/<name>, with * or ** for the parts it does not name.")
    try:
        Layer(parts[0])
    except ValueError:
        raise AddressError(f"A rule names a layer first; {parts[0]!r} is not one.") from None
    if "**" in parts[:-1]:
        raise AddressError("** matches the rest, so it can only be the last part of a pattern.")
    for segment in parts[1:]:
        if segment in ("*", "**"):
            continue
        if not _SEGMENT_GLOB.match(segment):
            raise AddressError(f"{segment!r} is not a readable address segment.")


def pattern_layer(raw: str) -> Layer:
    """The layer a pattern governs. Validated first, so this cannot fail after."""
    validate_pattern(raw)
    return Layer(raw.strip().split("/")[0])


def matches(pattern: str, address: str) -> bool:
    """Does ``pattern`` reach ``address``?

    Segment-wise, with ``*`` taking one and ``**`` taking the rest. Nothing here
    is about precedence: a broader pattern and a narrower one both simply match,
    and which one *wins* is
    [GV5](docs/for-developers/modules/govern/spec.md)'s answer — deny, at any
    specificity — decided by the caller and never by how long a pattern is.
    """
    pat = pattern.strip().split("/")
    addr = address.strip().split("/")

    for i, segment in enumerate(pat):
        if segment == "**":
            return True
        if i >= len(addr):
            return False
        if not _segment_matches(segment, addr[i]):
            return False
    return len(pat) == len(addr)


def _segment_matches(pattern: str, segment: str) -> bool:
    """One pattern segment against one address segment.

    ``*`` alone takes the whole segment; a ``*`` inside one is a glob over it,
    so ``Deals@*`` reaches ``Deals@1.0.0`` and ``Deal*`` would reach both
    ``Deals`` and ``Dealers`` — which is why a rule is written against the
    catalogue's live match preview rather than from memory.
    """
    if pattern == "*":
        return True
    if "*" not in pattern:
        return pattern == segment
    return fnmatchcase(segment, pattern)


def specificity(pattern: str) -> int:
    """How precisely a pattern names something — concrete segments, counted.

    Used for **reading**, never for deciding: the drawer sorts a layer's rules
    broadest-first so the bound that covers everything is read before the
    exceptions to it. Most-specific-wins is the rule this product does not have.
    """
    return sum(1 for segment in pattern.strip().split("/") if "*" not in segment)
