"""The loop that ticks the clock — one per engine process.

docs/for-developers/modules/operate/features/notifications.md. Every
``INVANA_CLOCK_INTERVAL_S`` seconds (or sooner, when ``wake`` is called after a
*run now*) it opens a session, runs ``Clock.tick``, commits, and only then
submits the runs the tick opened — a run starts from committed rows. A failed
tick is logged and rolled back; the next one starts clean::

    loop = ClockLoop(session_factory, submit=runtime.submit, interval_s=30)
    loop.start()
    loop.wake()       # after a commit that queued a firing
    await loop.stop()
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Callable
from datetime import UTC, datetime

from invana.activity.managers.clock import Clock
from invana.core.telemetry.spans import root_span

log = logging.getLogger(__name__)


class ClockLoop:
    def __init__(self, session_factory, *, submit: Callable[[str], None], interval_s: int) -> None:
        self._factory = session_factory
        self._submit = submit
        self._interval = interval_s
        self._wake = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._clock = Clock()

    def start(self) -> None:
        if self._interval > 0 and self._task is None:
            # A debugging label, literal so it survives a package move.
            self._task = asyncio.create_task(self._run(), name="invana.clock")

    def wake(self) -> None:
        self._wake.set()

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def tick_once(self) -> None:
        with root_span("system.clock", origin="clock"):
            async with self._factory() as session:
                try:
                    done = await self._clock.tick(session, now=datetime.now(UTC))
                    await session.commit()
                except Exception:
                    await session.rollback()
                    log.exception("clock tick failed")
                    return
        for run_id in done.run_ids:
            self._submit(run_id)
        if any((done.run_ids, done.delivered, done.reminded, done.expired, done.sent, done.failed, done.alerts)):
            log.info(
                "clock tick",
                extra={
                    "runs_opened": len(done.run_ids),
                    "delivered": done.delivered,
                    "events_matched": done.events,
                    "reminded": done.reminded,
                    "expired": done.expired,
                    "sent": done.sent,
                    "failed": done.failed,
                    "alerts_fired": done.alerts,
                    "ledgers_verified": done.verified,
                },
            )

    async def _run(self) -> None:
        while True:
            await self.tick_once()
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._wake.wait(), timeout=self._interval)
            self._wake.clear()
