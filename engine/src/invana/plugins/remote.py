"""The worker side of the dial-out loop — what ``invana worker`` runs.

docs/for-developers/modules/agents/features/workers.md. A remote worker holds no
database credential and no graph connection. It dials the engine over HTTPS:

| Step | Call | Does |
|---|---|---|
| join | ``POST /api/v1/workers/join`` with the join token | returns this worker's own ``invana_wkr_`` credential |
| heartbeat | ``POST /api/v1/workers/heartbeat``, every 2 s | busy slots, CPU, log; answers a credential or ``drain`` |
| lease | ``POST /api/v1/workers/lease`` | long-polls for envelopes while a slot is free |
| outcome | ``POST /api/v1/workers/outcome`` | returns what the step produced, with the files it read or wrote |

A step's context is its args, its step id, its idempotency key, the secrets its
plugin declares (read from this process's ``INVANA_SECRET_<NAME>``) and the
artifacts it records — nothing else (:class:`DetachedContexts`). Drain is
honoured by finishing what is held, then stopping.

Usage::

    worker = RemoteWorker(engine="https://invana.example.com", token="invana_join_…", pool="egress", slots=4)
    await worker.run()
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import platform
import socket
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any

import httpx

from invana.plugins import load_plugins
from invana.plugins.envelope import TaskEnvelope, outcome_to_json
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.worker import run_envelope

log = logging.getLogger(__name__)

HEARTBEAT_S = 2.0
RETRY_S = 2.0


class _NoEmitter:
    """A remote step emits to no run stream; there is none on this side."""

    run_id = ""

    async def emit(self, kind: str, payload: dict | None = None, *, idem_key: str | None = None) -> None:
        return None


class DetachedContexts:
    """Opens a context with no database: the step is an id and its args."""

    @asynccontextmanager
    async def open(self, envelope: TaskEnvelope) -> AsyncIterator[tuple[TaskContext, RunVars]]:
        step = SimpleNamespace(id=envelope.node_id, args=dict(envelope.args), detail="")
        ctx = TaskContext(db=None, manager=None, emitter=_NoEmitter(), step=step)  # type: ignore[arg-type]
        self.last = ctx
        yield ctx, SimpleNamespace()  # type: ignore[misc]


def _cpu_percent() -> float | None:
    try:
        return min(100.0, os.getloadavg()[0] / (os.cpu_count() or 1) * 100)
    except (OSError, AttributeError):
        return None


class RemoteWorker:
    """Joins a pool, then leases and runs envelopes until drained or stopped."""

    def __init__(
        self,
        *,
        engine: str,
        token: str,
        pool: str,
        labels: list[str] | None = None,
        slots: int | None = None,
        name: str | None = None,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self._http = http
        self._engine = engine.rstrip("/")
        self._token = token
        self._pool = pool
        self._labels = labels or []
        self._slots = slots
        self._name = name
        self._credential = ""
        self._busy = 0
        self._log: list[str] = []
        self._draining = False
        self._stop = asyncio.Event()
        self._held: set[asyncio.Task] = set()
        self.name = ""
        self.slots = 0

    # ── plumbing ──────────────────────────────────────────────────────────────

    def say(self, line: str) -> None:
        log.info(line)
        self._log.append(line)

    async def _post(self, http: httpx.AsyncClient, path: str, body: dict, *, bearer: str, timeout: float = 30.0):
        return await http.post(
            f"{self._engine}/api/v1/workers/{path}",
            json=body,
            headers={"Authorization": f"Bearer {bearer}"},
            timeout=timeout,
        )

    async def join(self, http: httpx.AsyncClient) -> None:
        plugins = sorted(load_plugins().plugins)
        response = await self._post(
            http,
            "join",
            {
                "pool": self._pool,
                "name": self._name,
                "node": socket.gethostname(),
                "version": platform.python_version(),
                "labels": self._labels,
                "plugins": plugins,
                "slots": self._slots,
            },
            bearer=self._token,
        )
        if response.status_code >= 400:
            detail = response.json().get("detail", response.text) if response.content else response.reason_phrase
            raise JoinRefused(f"The engine refused the join ({response.status_code}): {detail}")
        body = response.json()
        self._credential, self.name, self.slots = body["credential"], body["name"], body["slots"]
        self.say(f"joined pool {body['pool']} as {self.name} with {self.slots} slots")

    # ── the loops ─────────────────────────────────────────────────────────────

    async def _heartbeats(self, http: httpx.AsyncClient) -> None:
        while not self._stop.is_set():
            lines, self._log = self._log, []
            try:
                response = await self._post(
                    http,
                    "heartbeat",
                    {"slots_busy": self._busy, "cpu": _cpu_percent(), "log": lines},
                    bearer=self._credential,
                    timeout=10.0,
                )
            except httpx.HTTPError as exc:
                self._log = lines + self._log
                log.warning("heartbeat failed: %s", exc)
            else:
                if response.status_code == 401:
                    log.error("the engine no longer knows this worker; stopping")
                    self._stop.set()
                    return
                if response.status_code < 400:
                    body = response.json()
                    if body.get("credential"):
                        self._credential = body["credential"]
                    if body.get("drain"):
                        if not self._draining:
                            self.say("drain requested; finishing held steps")
                        self._draining = True
                        if body.get("state") == "stopped":
                            self._stop.set()
                            return
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._stop.wait(), HEARTBEAT_S)

    async def _leases(self, http: httpx.AsyncClient) -> None:
        while not self._stop.is_set() and not self._draining:
            free = self.slots - self._busy
            if free <= 0:
                await asyncio.sleep(0.1)
                continue
            try:
                response = await self._post(http, "lease", {"free": free}, bearer=self._credential, timeout=40.0)
            except httpx.HTTPError as exc:
                log.warning("lease failed: %s", exc)
                await asyncio.sleep(RETRY_S)
                continue
            if response.status_code == 401:
                self._stop.set()
                return
            if response.status_code != 200:
                await asyncio.sleep(RETRY_S if response.status_code >= 400 else 0)
                continue
            for lease in response.json()["leases"]:
                self._busy += 1
                task = asyncio.create_task(self._run_one(http, lease))
                self._held.add(task)
                task.add_done_callback(self._held.discard)

    async def _run_one(self, http: httpx.AsyncClient, lease: dict[str, Any]) -> None:
        envelope = TaskEnvelope.from_json(lease["envelope"])
        contexts = DetachedContexts()
        started = time.monotonic()
        self.say(f"running {envelope.key} for run {envelope.run_id}")
        result: Out | BaseException
        try:
            result = await run_envelope(envelope, contexts=contexts)
        except asyncio.CancelledError:
            # Shutting down mid-step: post nothing, so the engine redelivers it.
            self._busy -= 1
            raise
        except Exception as exc:
            result = exc
        duration_ms = round((time.monotonic() - started) * 1000)
        ctx = getattr(contexts, "last", None)
        body = {
            "job_id": lease["job_id"],
            "idempotency_key": envelope.idempotency_key,
            "outcome": outcome_to_json(result),
            "artifacts": list(ctx.artifacts) if ctx is not None else [],
            "duration_ms": duration_ms,
        }
        try:
            for attempt in range(5):
                try:
                    response = await self._post(http, "outcome", body, bearer=self._credential)
                except httpx.HTTPError:
                    response = None
                if response is not None and response.status_code < 500:
                    break
                await asyncio.sleep(min(RETRY_S * (attempt + 1), 10))
            self.say(f"finished {envelope.key} in {duration_ms} ms")
        finally:
            self._busy -= 1

    # ── run ───────────────────────────────────────────────────────────────────

    async def run(self) -> None:
        """Join, then work until drained, refused or cancelled."""
        async with contextlib.nullcontext(self._http) if self._http else httpx.AsyncClient() as http:
            await self.join(http)
            beats = asyncio.create_task(self._heartbeats(http), name="invana.worker.heartbeat")
            leases = asyncio.create_task(self._leases(http), name="invana.worker.lease")
            try:
                done, _ = await asyncio.wait({beats, leases}, return_when=asyncio.FIRST_COMPLETED)
                if self._held:
                    await asyncio.gather(*self._held, return_exceptions=True)
                if self._draining and beats not in done:
                    # One more heartbeat tells the engine nothing is held, so it records `stopped`.
                    with contextlib.suppress(TimeoutError):
                        await asyncio.wait_for(asyncio.shield(beats), 15)
                self._stop.set()
                for task in done:
                    task.result()
            finally:
                for task in (beats, leases, *self._held):
                    task.cancel()
                await asyncio.gather(beats, leases, *self._held, return_exceptions=True)


class JoinRefused(Exception):
    """The engine would not admit this worker; the message says what to fix."""
