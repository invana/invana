"""``EventStore`` — the pre-rename name for ``EventQuerySet``.

The queries moved to ``querysets/`` (migration-plan §4.1); this alias is what
lets the remaining call sites migrate gradually.
"""

from invana.core.events.querysets import EventFilter, EventQuerySet

EventStore = EventQuerySet

__all__ = ["EventFilter", "EventQuerySet", "EventStore"]
