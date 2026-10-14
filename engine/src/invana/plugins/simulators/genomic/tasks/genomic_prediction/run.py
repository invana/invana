"""The ``sim.genomic_prediction`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.sdk.errors import TaskFailure
from invana.plugins.sdk.simulation import Input, read_inputs

MAX_CROSSES = 100
MAX_PROGENY = 10_000
#: Crosses times progeny — what one run may draw.
MAX_DRAWS = 200_000
#: How a breeder writes a cross: female, the multiplication sign, male.
CROSS = "\N{MULTIPLICATION SIGN}"
MODEL = "mid-parent additive; each trait drawn independently with Gaussian segregation"


@dataclass(frozen=True, slots=True)
class Target:
    trait: str
    op: str
    value: float
    sd: float | None

    def met(self, x: float) -> bool:
        return x >= self.value if self.op == ">=" else x <= self.value


def _refuse(message: str, *, cause: str = "bad_spec") -> TaskFailure:
    return TaskFailure(cls="blocked", cause=cause, message=message, short=message[:60])


def _number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    try:
        return float(str(value))
    except ValueError:
        return None


def _targets(raw: list) -> list[Target]:
    out: list[Target] = []
    for item in raw:
        if not isinstance(item, dict) or not item.get("trait") or item.get("op") not in (">=", "<="):
            raise _refuse(f"A target is {{trait, op: >= or <=, value}} — not {item!r}.")
        value = _number(item.get("value"))
        sd = None if item.get("sd") is None else _number(item["sd"])
        if value is None or (item.get("sd") is not None and (sd is None or sd < 0)):
            raise _refuse(f"Target {item['trait']} needs a numeric value and a non-negative sd.")
        out.append(Target(trait=str(item["trait"]), op=item["op"], value=value, sd=sd))
    if not out:
        raise _refuse("Name at least one target.")
    return out


def _trait_values(parents: list[str], traits: list[str], inputs: list[Input]) -> dict[str, dict[str, float]]:
    """Each parent's value for each trait, from the one input that holds it.

    A parent in no input, a trait no input gives for a parent, a value that is
    not a number, and two inputs that disagree are each refused by name — a
    prediction is never made from a value the inputs do not state.
    """
    values: dict[str, dict[str, float]] = {}
    for parent in parents:
        holding = [i for i in inputs if parent in i.records]
        if not holding:
            raise _refuse(f"{parent} is in none of the inputs.", cause="missing_parent")
        values[parent] = {}
        for trait in traits:
            seen = {
                i.ref: _number(i.records[parent][trait])
                for i in holding
                if i.records[parent].get(trait) not in (None, "")
            }
            if not seen:
                raise _refuse(f"No input gives {parent}'s {trait}.", cause="missing_trait")
            if any(v is None for v in seen.values()):
                raise _refuse(f"{parent}'s {trait} is not a number.", cause="bad_value")
            if len(set(seen.values())) > 1:
                where = " · ".join(f"{ref} = {v:g}" for ref, v in seen.items())
                raise _refuse(f"The inputs disagree on {parent}'s {trait}: {where}.", cause="inputs_disagree")
            values[parent][trait] = next(iter(seen.values()))
    return values


def _stats(xs: list[float]) -> tuple[float, float]:
    mean = sum(xs) / len(xs)
    return mean, math.sqrt(sum((x - mean) ** 2 for x in xs) / len(xs))


def _cross(
    female: str, male: str, values: dict[str, dict[str, float]], targets: list[Target], progeny: int, seed: int
) -> dict:
    """Draw ``progeny`` offspring of one cross and score them against every target.

    Each cross has its own generator, seeded from the run's seed and the cross's
    name, so a cross's figures do not depend on which other crosses ran.
    """
    rng = random.Random(f"{seed}:{female}{CROSS}{male}")
    draws: dict[str, list[float]] = {}
    for t in targets:
        a, b = values[female][t.trait], values[male][t.trait]
        spread = t.sd if t.sd is not None else abs(a - b) / 2
        draws[t.trait] = [rng.gauss((a + b) / 2, spread) for _ in range(progeny)]
    meets_all = sum(1 for i in range(progeny) if all(t.met(draws[t.trait][i]) for t in targets))
    traits = {}
    for t in targets:
        mean, sd = _stats(draws[t.trait])
        traits[t.trait] = {
            "mean": round(mean, 4),
            "sd": round(sd, 4),
            "meets": round(sum(1 for x in draws[t.trait] if t.met(x)) / progeny, 4),
        }
    return {
        "cross": f"{female} {CROSS} {male}",
        "female": female,
        "male": male,
        "meets_all": round(meets_all / progeny, 4),
        "traits": traits,
    }


async def genomic_prediction(ctx: TaskContext, v: RunVars) -> Out:
    """Rank every female-by-male cross by the share of its progeny that meets every target.

    **The model is deliberately simple and says so.** A progeny's trait is the
    parents' mid-parent value plus a Gaussian segregation draw — spread ``sd``
    when the target gives one, else half the parents' difference — with every
    trait drawn independently: additive, no dominance, no linkage. A better
    model is a new version of this plugin; a simulation keeps the version it ran.

    Parents' values come only from the pinned inputs (``read_inputs``): the
    record keyed by the parent, the column named by the trait.
    """
    args = ctx.step.args or {}
    spec = args.get("spec") or {}
    seed = int(args.get("seed") or 0)
    females = [str(p) for p in spec.get("females") or []]
    males = [str(p) for p in spec.get("males") or []]
    progeny = int(spec.get("progeny") or 2000)
    if not females or not males:
        raise _refuse("Name at least one female and one male parent.")
    targets = _targets(list(spec.get("targets") or []))
    crosses = [(f, m) for f in females for m in males if f != m]
    if not crosses:
        raise _refuse("Every cross pairs a parent with itself.")
    if len(crosses) > MAX_CROSSES:
        raise _refuse(f"{len(crosses)} crosses — at most {MAX_CROSSES} per simulation.")
    if not 1 <= progeny <= MAX_PROGENY or len(crosses) * progeny > MAX_DRAWS:
        raise _refuse(
            f"{len(crosses)} crosses {CROSS} {progeny:,} progeny — at most {MAX_PROGENY:,} per cross "
            f"and {MAX_DRAWS:,} in all."
        )

    inputs = await read_inputs(ctx)
    values = _trait_values(sorted({*females, *males}), [t.trait for t in targets], inputs)
    await ctx.progress(f"simulating {len(crosses)} crosses {CROSS} {progeny:,} progeny")
    rows = [_cross(f, m, values, targets, progeny, seed) for f, m in crosses]
    ranked = sorted(rows, key=lambda r: (-r["meets_all"], r["cross"]))
    summary = {
        "crosses": len(crosses),
        "progeny": progeny,
        "seed": seed,
        "targets": [{"trait": t.trait, "op": t.op, "value": t.value} for t in targets],
        "inputs": [i.ref for i in inputs],
        "model": MODEL,
    }
    best = ranked[0]
    return Out(
        detail=f"{len(crosses)} crosses · best {best['cross']} · {best['meets_all']:.0%} meet every target",
        input={"spec": spec, "seed": seed, "inputs": [i.ref for i in inputs]},
        output={"ranked": ranked, "summary": summary},
    )


run = genomic_prediction
