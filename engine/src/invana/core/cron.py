"""Five-field cron, read in a time zone — no dependency.

docs/for-developers/modules/operate/features/schedules.md. ``minute hour
day-of-month month day-of-week``; each field is ``*``, a number, a range
``a-b``, a list ``a,b`` and any of them with a step ``/n``. Day-of-week is
``0-7`` with both ``0`` and ``7`` meaning Sunday. When both day fields are
restricted a day matches either, as in every cron::

    cron = Cron.parse("0 8 * * 1-5")
    cron.next_after(datetime(2026, 10, 12, 9, 0))           # 2026-10-13 08:00, naive wall time
    next_fire("0 8 * * *", "Europe/Berlin", after=now_utc)  # the next 08:00 in Berlin, as UTC
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

_BOUNDS = ((0, 59), (0, 23), (1, 31), (1, 12), (0, 7))
_NAMES = ("minute", "hour", "day of month", "month", "day of week")
# Four years of minutes is more than any valid expression needs to recur.
_HORIZON = timedelta(days=4 * 366)


def _field(text: str, index: int) -> frozenset[int]:
    low, high = _BOUNDS[index]
    values: set[int] = set()
    for part in text.split(","):
        base, _, step_text = part.partition("/")
        step = int(step_text) if step_text else 1
        if step < 1:
            raise ValueError(f"{_NAMES[index]}: a step must be at least 1")
        if base == "*":
            start, end = low, high
        elif "-" in base:
            a, b = base.split("-", 1)
            start, end = int(a), int(b)
        else:
            start = int(base)
            end = high if step_text else start
        if not (low <= start <= high and low <= end <= high and start <= end):
            raise ValueError(f"{_NAMES[index]}: {part!r} is outside {low}-{high}")
        values.update(range(start, end + 1, step))
    return frozenset(values)


@dataclass(frozen=True)
class Cron:
    minutes: frozenset[int]
    hours: frozenset[int]
    days: frozenset[int]
    months: frozenset[int]
    weekdays: frozenset[int]  # 0 = Sunday
    any_day: bool
    any_weekday: bool

    @classmethod
    def parse(cls, expr: str) -> Cron:
        """Parse ``expr``; raises ``ValueError`` naming the field that is wrong."""
        fields = expr.split()
        if len(fields) != 5:
            raise ValueError(f"{expr!r} is not a 5-field cron")
        try:
            parsed = [_field(f, i) for i, f in enumerate(fields)]
        except ValueError as exc:
            if "outside" in str(exc) or "step" in str(exc):
                raise
            raise ValueError(f"{expr!r} is not a 5-field cron") from exc
        weekdays = frozenset(d % 7 for d in parsed[4])
        return cls(parsed[0], parsed[1], parsed[2], parsed[3], weekdays, fields[2] == "*", fields[4] == "*")

    def _day_matches(self, moment: datetime) -> bool:
        in_days = moment.day in self.days
        in_weekdays = (moment.weekday() + 1) % 7 in self.weekdays
        if self.any_day or self.any_weekday:
            return in_days and in_weekdays
        return in_days or in_weekdays

    def next_after(self, moment: datetime) -> datetime:
        """The first matching minute strictly after ``moment`` (naive wall time)."""
        t = moment.replace(second=0, microsecond=0) + timedelta(minutes=1)
        limit = t + _HORIZON
        while t < limit:
            if t.month not in self.months:
                t = (t.replace(day=1, hour=0, minute=0) + timedelta(days=32)).replace(day=1)
            elif not self._day_matches(t):
                t = t.replace(hour=0, minute=0) + timedelta(days=1)
            elif t.hour not in self.hours:
                t = t.replace(minute=0) + timedelta(hours=1)
            elif t.minute not in self.minutes:
                t += timedelta(minutes=1)
            else:
                return t
        raise ValueError("the cron never fires")


def zone(name: str) -> ZoneInfo:
    """The IANA zone ``name``; raises ``ValueError`` for an unknown one."""
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError(f"{name!r} is not a time zone") from exc


def next_fire(expr: str, tz: str, *, after: datetime) -> datetime:
    """The next occurrence of ``expr`` in ``tz`` strictly after ``after``, as UTC."""
    where = zone(tz)
    local = after.astimezone(where).replace(tzinfo=None)
    return Cron.parse(expr).next_after(local).replace(tzinfo=where).astimezone(UTC)
