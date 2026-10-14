"""The Graph a command acts on, who acts, and a runtime to work its runs.

A CLI command holds no request, so it opens its own session and owns the
transaction: ``on_graph`` resolves ``--graph <username>/<slug>`` and ``--user``
through the managers, hands the command a session, and commits when the command
returns cleanly. A refusal a manager raises (``core.errors``) becomes a
``ClickException`` carrying its message, so the exit code is 1 and stdout stays
clean.

Commands whose work is a run — an eval run, a plan's draw — get an in-process
``TaskRuntime`` from ``with_runtime`` and await the run, because there is no
server here to hand it to::

    async with on_graph("demo/airways", None) as (session, graph, actor):
        run = await evals.open_run(session, graph_id=graph.id, ...)
    async with with_runtime() as runtime:
        await runtime.eval_inline(run.id)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

import click

# A run's trace points at `session_messages`; the server imports every model at
# startup, a CLI process only what it names, so the mapper needs this one here.
import invana.apps.sessions.managers  # noqa: F401
from invana.apps.graphs.managers import GraphManager
from invana.core.auth.managers import AuthManager
from invana.core.db import create_db_engine, create_session_factory
from invana.core.errors import InvanaError

_graphs = GraphManager()
_auth = AuthManager()


def refusal(exc: InvanaError) -> click.ClickException:
    """A manager's refusal, as the one line a person reads."""
    detail = exc.detail
    if isinstance(detail, dict):
        detail = detail.get("message") or detail.get("error") or str(detail)
    return click.ClickException(str(detail))


@asynccontextmanager
async def on_graph(graph_ref: str, user_ref: str | None):
    """Yield ``(session, graph, actor)``; commit on a clean exit, roll back on any other.

    ``actor`` is the ``--user`` named, or the Graph's owner — the username in
    the ref — when none is.
    """
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                graph = await _graphs.get_by_ref(session, ref=graph_ref)
                who = user_ref or graph_ref.partition("/")[0]
                actor = await _auth.find_user_by_email_or_username(session, identifier=who)
                if actor is None:
                    raise click.UsageError(f"No user {who!r}.")
                yield session, graph, actor
                await session.commit()
            except InvanaError as exc:
                await session.rollback()
                raise refusal(exc) from exc
            except BaseException:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


@asynccontextmanager
async def as_user(user_ref: str):
    """Yield ``(session, actor)`` for a command above Graphs — a dataset's.

    The same transaction and refusal rules as ``on_graph``; there is no Graph
    owner to default to, so ``--user`` is always named.
    """
    engine = await create_db_engine()
    factory = create_session_factory(engine)
    try:
        async with factory() as session:
            try:
                actor = await _auth.find_user_by_email_or_username(session, identifier=user_ref)
                if actor is None:
                    raise click.UsageError(f"No user {user_ref!r}.")
                yield session, actor
                await session.commit()
            except InvanaError as exc:
                await session.rollback()
                raise refusal(exc) from exc
            except BaseException:
                await session.rollback()
                raise
    finally:
        await engine.dispose()


@asynccontextmanager
async def with_runtime():
    """An in-process ``TaskRuntime`` over its own engine and graph connections.

    The stored MCP servers are loaded into the registry first, as the API does
    at start-up. A ``send`` step held here waits on the same approvals inbox the
    API uses.
    """
    from invana.activity.managers import ApprovalSendGate
    from invana.apps.graphs.pool import GraphConnectionManager
    from invana.core.settings import settings
    from invana.runtime.interpreter import TaskRuntime
    from invana.runtime.managers import McpManager

    TaskRuntime.send_gate = ApprovalSendGate()

    engine = await create_db_engine()
    factory = create_session_factory(engine)
    async with factory() as db:
        await McpManager().load(db)
    manager = GraphConnectionManager(session_factory=factory, encryption_key=settings.encryption_key)
    await manager.startup()
    try:
        yield TaskRuntime(session_factory=factory, manager=manager, encryption_key=settings.encryption_key)
    finally:
        await manager.shutdown()
        await engine.dispose()


def graph_options(fn: Any) -> Any:
    """``--graph`` and ``--user``, the two options every command here takes."""
    fn = click.option("--user", "user_ref", default=None, help="Who is doing it. Defaults to the Graph's owner.")(fn)
    return click.option("--graph", "graph_ref", required=True, help="<username>/<slug>.")(fn)
