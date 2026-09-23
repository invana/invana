"""What saving a guardrail would cost every world in the Graph.

Computed **before** the write and named in the response
([GR2](docs/for-developers/modules/govern/features/guardrails.md)): a guardrail
that silently invalidates six worlds is a guardrail whose effect nobody saw at
the moment they took responsibility for it. *Saving this would change 2 of 4
worlds*, with what each one loses.

Nothing here rewrites a world. Worlds are **narrowed by composition**, not
edited — the guardrail intersects at run time, so the impact is a reading of
what will happen rather than a migration of rows.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from invana.apps.govern.catalogue import Catalogue
from invana.apps.govern.rules import Decision, Effective, compose


@dataclass(frozen=True, slots=True)
class WorldImpact:
    """One world, and what the proposed guardrail does to it."""

    lens_id: str
    name: str
    #: Participants it can reach today and would not afterwards.
    loses: tuple[str, ...] = ()
    #: Roles whose cast the proposal denies — the world stops being runnable
    #: until somebody retunes it, which is a louder thing than losing a model.
    cast_denied: tuple[str, ...] = ()

    @property
    def changes(self) -> bool:
        return bool(self.loses or self.cast_denied)

    @property
    def summary(self) -> str:
        """The sentence the confirm dialog puts beside the world's name."""
        if not self.changes:
            return "loses nothing — already inside every rule"
        parts = []
        if self.loses:
            shown = ", ".join(self.loses[:3])
            more = f" and {len(self.loses) - 3} more" if len(self.loses) > 3 else ""
            parts.append(f"loses {shown}{more}")
        if self.cast_denied:
            parts.append(f"its {', '.join(self.cast_denied)} cast is denied")
        return "; ".join(parts)


@dataclass(slots=True)
class Impact:
    worlds: list[WorldImpact] = field(default_factory=list)

    @property
    def changed(self) -> list[WorldImpact]:
        return [world for world in self.worlds if world.changes]

    @property
    def headline(self) -> str:
        if not self.worlds:
            return "No worlds to revalidate."
        changed = len(self.changed)
        if not changed:
            return f"No change to any of {len(self.worlds)} worlds."
        return f"Saving this would change {changed} of {len(self.worlds)} worlds."


def assess(
    *,
    proposed: Effective,
    current: Effective,
    worlds: list[tuple[str, str, Effective]],
    catalogue: Catalogue,
) -> Impact:
    """Diff *what each world can reach now* against *what it could reach after*.

    Both sides are computed over the **catalogue**, not over the rules: what a
    person loses is a list of participants they can name today, and comparing
    rule texts would report an edit rather than an effect.
    """
    out = Impact()
    addresses = [p.address for p in catalogue.participants]

    for lens_id, name, world in worlds:
        before = compose([current, world])
        after = compose([proposed, world])

        loses = tuple(
            address
            for address in addresses
            if before.decide(address).decision is Decision.allowed and after.decide(address).decision is Decision.denied
        )

        cast_denied = tuple(
            role
            for role, address in after.cast.items()
            if address is not None
            and before.decide(address).decision is Decision.allowed
            and after.decide(address).decision is Decision.denied
        )

        out.worlds.append(WorldImpact(lens_id=lens_id, name=name, loses=loses, cast_denied=cast_denied))

    return out
