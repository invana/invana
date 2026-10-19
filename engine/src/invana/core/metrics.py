"""A number against the one before it — the one reading every endpoint shares.

A change is computed by the endpoint that serves the two values it compares,
never by a client, so the arrow, the band that reads as flat and whether a move
is good news are decided once (metrics-are-stored.md).

Two kinds, by what the number is:

* **ratio** — value over prior, minus one: run time, tokens, run counts. ``0.38``
  is 38% more. Within ±2% it reads flat. There is none over a prior of zero.
* **points** — value minus prior, for a rate between 0 and 1: success. ``0.012``
  is 1.2 percentage points. Within ±0.1 pt it reads flat.

``higher_is_better`` says which way is good news — ``False`` for run time and
tokens, ``True`` for success, ``None`` for a number that is neither (how many
runs there were), whose change always reads neutral.

Usage::

    change_of(p95_now, p95_before, higher_is_better=False)
    points_change_of(success_now, success_before, higher_is_better=True)
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

#: Under this a ratio change reads as flat.
_FLAT_RATIO = 0.02
#: Under this a points change reads as flat — 0.1 percentage point.
_FLAT_POINTS = 0.001


class Change(BaseModel):
    """A number against the one before it, read once."""

    #: ``ratio``: value / prior - 1 (0.38 is 38% more). ``points``: value - prior (0.012 is 1.2 pt).
    by: float
    unit: Literal["ratio", "points"]
    direction: Literal["up", "down", "flat"]
    #: Whether the move is good news for this number; ``neutral`` when flat or when neither way is.
    tone: Literal["better", "worse", "neutral"]


def _read(by: float, unit: Literal["ratio", "points"], flat: float, higher_is_better: bool | None) -> Change:
    if abs(by) < flat:
        return Change(by=by, unit=unit, direction="flat", tone="neutral")
    direction: Literal["up", "down"] = "up" if by > 0 else "down"
    if higher_is_better is None:
        tone: Literal["better", "worse", "neutral"] = "neutral"
    else:
        tone = "better" if (direction == "up") == higher_is_better else "worse"
    return Change(by=by, unit=unit, direction=direction, tone=tone)


def change_of(value: float | None, prior: float | None, *, higher_is_better: bool | None) -> Change | None:
    """``value`` against ``prior`` as a ratio; ``None`` when either is missing or
    the prior is zero, because a change against nothing is not a number."""
    if value is None or prior is None or prior == 0:
        return None
    return _read(value / prior - 1, "ratio", _FLAT_RATIO, higher_is_better)


def points_change_of(value: float | None, prior: float | None, *, higher_is_better: bool | None) -> Change | None:
    """A rate ``value`` against ``prior`` in percentage points (as a fraction);
    ``None`` when either is missing."""
    if value is None or prior is None:
        return None
    return _read(value - prior, "points", _FLAT_POINTS, higher_is_better)
