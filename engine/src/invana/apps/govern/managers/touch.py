"""Recording and reading what a run engaged.

The interpreter writes one of these per engagement, beside the ledger entry it
projects. Nothing here computes a percentage or a score: the readings are
*allowed*, *touched*, *never touched* and *refused*, and what to do about the
difference is a person's call, not one made for them.
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import Layer, parse_address
from invana.apps.govern.models import RunTouch, TouchDirection
from invana.apps.govern.querysets import TouchQuerySet
from invana.apps.govern.rules import Verdict
from invana.core.errors import NotFoundError


def _layer_of(address: str) -> str:
    return address.split("/", 1)[0]


def classify_participants(allowed: list[str], ledger: list[RunTouch]) -> list[dict[str, Any]]:
    """One reading per address the frozen world allowed or the run engaged.

    An address the run engaged that the allow-list does not name is kept: a
    refusal recorded against a participant nobody declared is the one row a
    reader needs. The verdict is ``refused`` over ``touched`` over ``miss``
    (only skipped lookups — the cache's own word) over ``never_touched``.
    ``calls`` counts the engaged touches; ``rows`` and ``tokens`` sum theirs.
    """
    by_address: dict[str, list[RunTouch]] = {}
    for touch in sorted(ledger, key=lambda t: t.seq):
        by_address.setdefault(touch.address, []).append(touch)
    readings = []
    for address in sorted(set(allowed) | set(by_address)):
        rows = by_address.get(address, [])
        refused = next((t for t in rows if t.was_refused), None)
        engaged = [t for t in rows if t.direction != TouchDirection.skipped.value]
        if refused is not None:
            verdict, why = (
                "refused",
                refused.why or (f"denied by {refused.rule_matched}" if refused.rule_matched else None),
            )
        elif engaged:
            verdict, why = "touched", None
        elif rows:
            verdict, why = "miss", rows[0].why
        else:
            verdict, why = "never_touched", None
        readings.append(
            {
                "address": address,
                "layer": _layer_of(address),
                "verdict": verdict,
                "why": why,
                "calls": len(engaged),
                "rows": sum((t.volume or {}).get("rows") or 0 for t in engaged),
                "tokens": sum(
                    ((t.volume or {}).get("tokens_in") or 0) + ((t.volume or {}).get("tokens_out") or 0)
                    for t in engaged
                ),
            }
        )
    return readings


def layer_tallies(participants: list[dict[str, Any]], ledger: list[RunTouch]) -> list[dict[str, Any]]:
    """One tally per layer, in the order the strip reads them, empty layers kept.

    ``allowed`` is the participants drawn on the layer, ``touched`` and
    ``refused`` those with that verdict, ``touches`` every ledger row on it,
    ``calls`` the engaged ones, and ``rows`` the records they returned.
    """
    tallies = []
    for layer in Layer:
        mine = [p for p in participants if p["layer"] == layer.value]
        tallies.append(
            {
                "layer": layer.value,
                "allowed": len(mine),
                "touched": sum(1 for p in mine if p["verdict"] == "touched"),
                "refused": sum(1 for p in mine if p["verdict"] == "refused"),
                "calls": sum(p["calls"] for p in mine),
                "touches": sum(1 for t in ledger if _layer_of(t.address) == layer.value),
                "rows": sum(p["rows"] for p in mine),
            }
        )
    return tallies


class TouchManager:
    touches_qs = TouchQuerySet()

    async def record(
        self,
        session: AsyncSession,
        *,
        run_id: str,
        graph_id: str,
        seq: int,
        address: str,
        direction: TouchDirection | str,
        step_key: str | None = None,
        verdict: Verdict | None = None,
        volume: dict | None = None,
        applied: dict | None = None,
        sent: dict | None = None,
        query: dict | None = None,
        cost_usd: float | None = None,
        duration_ms: int | None = None,
    ) -> RunTouch:
        """One engagement, projected from one ledger entry.

        ``seq`` is the ``task_stream`` sequence this row derives from — carried
        rather than generated, which is what keeps the table rebuildable from
        the ledger and the ledger authoritative when the two disagree
        ([GV20](docs/for-developers/modules/govern/spec.md)).
        """
        parsed = parse_address(address)
        touch = RunTouch(
            run_id=run_id,
            graph_id=graph_id,
            seq=seq,
            step_key=step_key,
            address=address,
            layer=parsed.layer.value,
            sublayer=parsed.sublayer,
            participant=parsed.name,
            direction=TouchDirection(direction).value,
            rule_matched=verdict.rule_matched if verdict else None,
            why=verdict.why if verdict else None,
            volume=volume or {},
            applied=applied or {},
            sent=sent or {},
            query=query or {},
            cost_usd=cost_usd,
            duration_ms=duration_ms,
        )
        return await self.touches_qs.add(session, touch)

    async def for_run(self, session: AsyncSession, *, run_id: str) -> list[RunTouch]:
        return await self.touches_qs.list_for_run(session, run_id)

    async def at(self, session: AsyncSession, *, run_id: str, seq: int) -> RunTouch:
        touch = await self.touches_qs.get_at(session, run_id, seq)
        if touch is None:
            raise NotFoundError("No touch was recorded at that point in this run.")
        return touch

    async def counts(self, session: AsyncSession, *, run_id: str) -> dict[str, int]:
        return await self.touches_qs.counts_for_run(session, run_id)

    async def readings(self, session: AsyncSession, *, run_id: str, allowed: list[str]) -> dict[str, Any]:
        """*allowed · touched · never touched · refused* — the retune's evidence.

        **Declared is half of it.** The lens says what may participate; this
        says what did. Three allowed and never touched reads *narrow?*; two
        refused reads *widen, or accept cannot answer deliberately*.

        Beside the four address lists it returns what the run lens and the
        layers gantt draw, counted here so a reader formats and never tallies:
        ``participants`` (see :func:`classify_participants`), ``layers`` (see
        :func:`layer_tallies`) and ``tallies`` — the four lists' lengths.
        """
        touched = await self.touches_qs.distinct_addresses(session, run_id)
        ledger = await self.touches_qs.list_for_run(session, run_id)
        refused = [touch.address for touch in ledger if touch.was_refused]
        touched_set, refused_set = set(touched), dict.fromkeys(refused)
        never = sorted(set(allowed) - touched_set)
        participants = classify_participants(allowed, ledger)
        return {
            "allowed": sorted(allowed),
            "touched": sorted(touched_set),
            "never_touched": never,
            "refused": list(refused_set),
            "participants": participants,
            "layers": layer_tallies(participants, ledger),
            "tallies": {
                "allowed": len(allowed),
                "touched": len(touched_set),
                "never_touched": len(never),
                "refused": len(refused_set),
            },
        }

    async def compare(self, session: AsyncSession, *, run_a: str, run_b: str) -> dict:
        """What B touched that A did not, **and what each did to what they shared**.

        Two runs that each happened for real, placed side by side. Nothing is
        simulated and no answer is synthesised from another
        ([WO4](docs/for-developers/modules/govern/features/worlds.md)) — every
        value here was recorded by a run that ran.

        The address diff is the headline, because *what did each reach* is the
        question a reader opens compare with. But addresses alone read
        *touched 2 · shared 2 · differed 0* for two runs where one sliced a type
        and the other rewrote its projection, so a shared address also carries
        **how** it differed ([WO18](docs/for-developers/modules/govern/features/worlds.md)).
        Only the fields that actually differ are listed: a participant both runs
        read identically is shared and says nothing more.
        """
        by_run = await self.touches_qs.addresses_for_runs(session, [run_a, run_b])
        a, b = by_run.get(run_a, set()), by_run.get(run_b, set())
        shared = sorted(a & b)

        applied = await self.touches_qs.applied_for_runs(session, [run_a, run_b])
        applied_a, applied_b = applied.get(run_a, {}), applied.get(run_b, {})
        differed = {}
        for address in shared:
            fields = _differing_fields(applied_a.get(address) or {}, applied_b.get(address) or {})
            if fields:
                differed[address] = {
                    "differs": fields,
                    "a": {f: (applied_a.get(address) or {}).get(f) for f in fields},
                    "b": {f: (applied_b.get(address) or {}).get(f) for f in fields},
                }
        return {
            "only_in_a": sorted(a - b),
            "only_in_b": sorted(b - a),
            "shared": shared,
            "differed": differed,
            "counts": {
                "touched_a": len(a),
                "touched_b": len(b),
                "shared": len(shared),
                "only_one": len(a ^ b),
                "read_differently": len(differed),
            },
        }


#: The fields of ``run_touches.applied`` a compare reads. Closed rather than
#: derived from the documents, so a key one run happens to carry and the other
#: does not cannot quietly become a difference nobody decided to report
#: ([WO18](docs/for-developers/modules/govern/features/worlds.md)).
_APPLIED_FIELDS: tuple[str, ...] = ("models", "select", "properties_excluded", "projected", "composed")


def _differing_fields(a: dict, b: dict) -> list[str]:
    """Which of :data:`_APPLIED_FIELDS` the two runs did not do the same way.

    Absent and empty are the same thing here — a run that narrowed nothing and
    one that recorded an empty narrowing did the same thing to this participant,
    and reporting that as a difference would make every ungoverned read differ
    from every other.
    """
    return [field for field in _APPLIED_FIELDS if _norm(a.get(field)) != _norm(b.get(field))]


def _norm(value) -> str:
    """One recorded value as canonical text.

    Always a string, so two of them are always comparable — and order-insensitive
    for lists, since neither ``models`` nor ``projected`` is a sequence anybody
    chose the order of. Absent, ``[]`` and ``{}`` all normalise to the same
    thing, which is what makes *narrowed nothing* one answer rather than three.
    """
    if value is None or value in ([], {}):
        return ""
    if isinstance(value, list):
        return json.dumps(sorted(_norm(v) for v in value))
    if isinstance(value, dict):
        return json.dumps({k: _norm(value[k]) for k in sorted(value)})
    return json.dumps(value, sort_keys=True)
