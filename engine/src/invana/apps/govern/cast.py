"""The cast — innermost wins, and only then is it checked.

A plan names a **role**; the cast resolves it to a model address
([GV10](docs/for-developers/modules/govern/spec.md)). ``role: decide`` says *how
much this matters*, which stays true when the model line-up moves — ``tier``
does not, and a model id written into a plan is a plan that cannot leave its
Graph.

**The cast is not a bound.** It does not intersect: two model addresses have no
common narrowing, so intersecting them would mean nothing. The rules are what
narrow; the cast picks within them. Keeping those two ideas apart is what lets
a Todo say *use the local model for this one* without it becoming a way to
widen anything ([GV6]).

So resolution is two steps, and the second one is the point:

1. Innermost wins — the Todo's cast over the plan's over the agent's.
2. The resolved address is checked against the **effective rules**. Denied, and
   the run is refused before it opens, naming the role, the model and the rule.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.govern.rules import Decision, Effective, Role


@dataclass(frozen=True, slots=True)
class CastResolution:
    """One role, resolved and checked."""

    role: Role
    address: str | None
    allowed: bool
    #: The rule that denied it, when one did — so the refusal names its bound.
    rule_matched: str | None = None
    #: Where the address came from: ``todo`` · ``plan`` · ``agent`` · ``shipped``.
    source: str = "shipped"

    @property
    def refusal(self) -> str | None:
        if self.allowed:
            return None
        if self.address is None:
            return f"Nothing casts {self.role.value}, and no shipped default resolves it."
        return (
            f"{self.role.value} casts to {self.address}, and "
            f"{self.rule_matched or 'this world'} denies it. "
            "A cast is a resolution, not a bound — it picks within the rules, it does not widen them."
        )


class CastError(ValueError):
    """The run cannot open. Raised before anything is spent."""

    def __init__(self, detail: str, *, resolution: CastResolution) -> None:
        super().__init__(detail)
        self.detail = detail
        self.resolution = resolution


def resolve(
    effective: Effective,
    *,
    role: Role | str,
    shipped: dict[str, str] | None = None,
) -> CastResolution:
    """Resolve one role against an already-composed lens, then check it.

    ``effective`` has already had innermost-wins applied by
    :func:`~invana.apps.govern.rules.compose`, so this is the *check* half —
    which is the half that can refuse.
    """
    wanted = Role(role)
    address = effective.resolve_cast(wanted)
    source = "lens"

    if address is None:
        address = (shipped or {}).get(wanted.value)
        source = "shipped"

    if address is None:
        # Not every role is needed by every plan — a run with no `judge` step
        # never asks for one. Unresolved is only a refusal at the point of use,
        # which is why this returns rather than raising.
        return CastResolution(role=wanted, address=None, allowed=False, source=source)

    verdict = effective.decide(address)
    return CastResolution(
        role=wanted,
        address=address,
        allowed=verdict.decision is Decision.allowed,
        rule_matched=verdict.rule_matched,
        source=source,
    )


def require(
    effective: Effective,
    *,
    role: Role | str,
    shipped: dict[str, str] | None = None,
) -> str:
    """The address for a role the plan actually needs, or refuse the run.

    **Before anything is spent** — the check is the cheapest thing in the run,
    and a refusal that arrives after three steps have run has already cost the
    money the bound existed to protect.
    """
    resolution = resolve(effective, role=role, shipped=shipped)
    if not resolution.allowed or resolution.address is None:
        raise CastError(resolution.refusal or "This run cannot open.", resolution=resolution)
    return resolution.address


def resolve_all(
    effective: Effective,
    *,
    shipped: dict[str, str] | None = None,
) -> list[CastResolution]:
    """Every role, for the panel that reads a cast as a table."""
    return [resolve(effective, role=role, shipped=shipped) for role in Role]


def shipped_cast(models: list[tuple[str, dict]]) -> dict[str, str]:
    """The default cast that ships with the distribution.

    Dropping ``is_default`` means a Graph with providers configured and no cast
    could otherwise run nothing, so the trade for removing the second
    model-picking mechanism is that **this has to be right**
    ([PM4](docs/for-developers/modules/agents/features/providers-and-models.md)).

    ``models`` is ``[(address, capabilities)]`` from the catalogue. Four rules,
    each one a sentence from the design:

    - ``extract`` — the cheapest model that can read.
    - ``decide`` — the most capable configured.
    - ``judge`` — a local model where one exists, because nothing should leave.
    - ``embed`` — the only embedding model, or none.
    """
    if not models:
        return {}

    readers = [(address, caps) for address, caps in models if not caps.get("embedding")]
    embedders = [address for address, caps in models if caps.get("embedding")]

    out: dict[str, str] = {}
    if readers:
        by_cost = sorted(readers, key=lambda m: (m[1].get("cost_rank", 50), m[0]))
        by_power = sorted(readers, key=lambda m: (-m[1].get("power_rank", 50), m[0]))
        out[Role.extract.value] = by_cost[0][0]
        out[Role.decide.value] = by_power[0][0]

        local = [address for address, caps in readers if caps.get("local")]
        out[Role.judge.value] = local[0] if local else by_cost[0][0]

    if len(embedders) == 1:
        out[Role.embed.value] = embedders[0]

    return out
