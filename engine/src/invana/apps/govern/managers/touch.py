"""Recording and reading what a run engaged.

The interpreter writes one of these per engagement, beside the ledger entry it
projects. Nothing here computes a percentage or a score: the readings are
*allowed*, *touched*, *never touched* and *refused*, and what to do about the
difference is a person's call, not one made for them.
"""

from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.govern.addressing import parse_address
from invana.apps.govern.models import RunTouch, TouchDirection
from invana.apps.govern.querysets import TouchQuerySet
from invana.apps.govern.rules import Verdict
from invana.core.errors import NotFoundError


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

    async def readings(self, session: AsyncSession, *, run_id: str, allowed: list[str]) -> dict[str, list[str]]:
        """*allowed · touched · never touched · refused* — the retune's evidence.

        **Declared is half of it.** The lens says what may participate; this
        says what did. Three allowed and never touched reads *narrow?*; two
        refused reads *widen, or accept cannot answer deliberately*.
        """
        touched = await self.touches_qs.distinct_addresses(session, run_id)
        refused = [touch.address for touch in await self.touches_qs.list_for_run(session, run_id) if touch.was_refused]
        touched_set, refused_set = set(touched), dict.fromkeys(refused)
        return {
            "allowed": sorted(allowed),
            "touched": sorted(touched_set),
            "never_touched": sorted(set(allowed) - touched_set),
            "refused": list(refused_set),
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
