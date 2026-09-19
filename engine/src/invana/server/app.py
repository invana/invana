"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware

from invana.core.db import create_db_engine, create_session_factory, create_sync_engine
from invana.core.errors import (
    AuthenticationError,
    ConflictError,
    InvanaError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from invana.core.settings import settings
from invana.server.middleware import CatchAllExceptionMiddleware


def _domain_error_handler(status_code: int):
    """Render a `core.errors` type exactly as `HTTPException` would have."""

    async def handler(_: Request, exc: Exception) -> JSONResponse:
        detail = getattr(exc, "detail", None) or str(exc)
        return JSONResponse(status_code=status_code, content={"detail": detail})

    return handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage DB engine lifecycle: migrate on startup, dispose on shutdown."""
    engine = await create_db_engine()
    app.state.db_engine = engine
    session_factory = create_session_factory(engine)
    app.state.db_session_factory = session_factory

    if settings.telemetry_enabled:
        from invana.core.telemetry import instrument_app

        instrument_app(app, engine)

    from invana.apps.graphs.pool import GraphConnectionManager

    manager = GraphConnectionManager(
        session_factory=session_factory,
        encryption_key=settings.encryption_key,
    )
    app.state.graph_connection_manager = manager
    await manager.startup()

    # docs/for-developers/modules/operate/features/audit-and-activity.md — per-worker LISTEN events daemon for SSE live
    # tail. Started
    # here so its lifecycle tracks the app's; subscribers (SSE handlers) hold
    # references into this broadcaster's queues.
    from invana.core.events.notify import broadcaster as event_broadcaster

    app.state.event_broadcaster = event_broadcaster
    await event_broadcaster.start()

    # docs/for-developers/modules/ask/features/projections.md — the result templates
    # shipped with the distribution. Ordinary rows with `graph_id = NULL`, seeded
    # once, so a Graph's own template competes with them on the same terms.
    from invana.runtime.projections import ensure_builtins

    async with session_factory() as db:
        created = await ensure_builtins(db)
        if created:
            await db.commit()

    # docs/for-developers/modules/ask/features/streaming-and-the-workflow.md — the inline run runtime: one asyncio
    # task per session ask.
    # Startup fails whatever a previous process left mid-flight.
    from invana.runtime.interpreter import TaskRuntime

    task_runtime = TaskRuntime(session_factory=session_factory, manager=manager, encryption_key=settings.encryption_key)
    app.state.task_runtime = task_runtime
    await task_runtime.startup()

    yield

    await task_runtime.shutdown()
    await event_broadcaster.stop()
    await manager.shutdown()
    await engine.dispose()
    app.state.sync_engine.dispose()


def create_app() -> FastAPI:
    """Build and return the Invana FastAPI application."""
    from invana.server.admin.views import mount_admin
    from invana.server.agents.routes import agents_router, atlas_agent_router
    from invana.server.boards.routes import boards_router
    from invana.server.explorer.routes import explorer_router
    from invana.server.graphs.routes import graph_router, graphs_collection_router
    from invana.server.health import health_router
    from invana.server.llm_providers.routes import llm_providers_router
    from invana.server.routes.auth import auth_router
    from invana.server.routes.events import events_router, graph_events_router
    from invana.server.routes.model_links import model_links_router
    from invana.server.routes.models import models_router
    from invana.server.routes.schemas import schemas_router
    from invana.server.rules.routes import rules_router
    from invana.server.runtime.runs import runs_router
    from invana.server.runtime.templates import templates_router
    from invana.server.sessions.routes import sessions_router
    from invana.server.skills.routes import skills_router
    from invana.server.task_plans.routes import task_plans_router
    from invana.server.work.routes import projects_router, tasks_router

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )

    # Sync engine created eagerly — starlette-admin needs it at mount time.
    app.state.sync_engine = create_sync_engine()

    if settings.telemetry_enabled:
        from invana.core.telemetry import TelemetryMiddleware

        app.add_middleware(TelemetryMiddleware)

    # Session cookies for starlette-admin's auth flow. Signed with the
    # same secret as the JWT — separate cookie domain isn't needed.
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key or "invana-dev-session-fallback",
        session_cookie="invana_admin_session",
        same_site="lax",
    )

    # Catch-all sits directly beneath CORS so unhandled 500s become real
    # responses that CORS can decorate — otherwise Starlette's outermost
    # ServerErrorMiddleware emits the 500 above CORS, the headers are missing,
    # and the browser reports a misleading CORS error instead of the 500.
    app.add_middleware(CatchAllExceptionMiddleware, debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Domain errors → status codes ─────────────────────────────────────────
    # A manager may not import `fastapi` (migration-plan §4.1), so it raises a
    # `core.errors` type and the edge maps it here. The mapping is the API
    # contract: changing a row changes a status code.
    for exc_type, code in (
        (AuthenticationError, status.HTTP_401_UNAUTHORIZED),
        (NotFoundError, status.HTTP_404_NOT_FOUND),
        (ConflictError, status.HTTP_409_CONFLICT),
        (PermissionDeniedError, status.HTTP_403_FORBIDDEN),
        (ValidationError, status.HTTP_422_UNPROCESSABLE_CONTENT),
        # Anything else deliberate is an internal fault; keep the body shape.
        (InvanaError, status.HTTP_500_INTERNAL_SERVER_ERROR),
    ):
        app.add_exception_handler(exc_type, _domain_error_handler(code))

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(graphs_collection_router)
    app.include_router(graph_router)
    app.include_router(llm_providers_router)
    app.include_router(skills_router)
    app.include_router(rules_router)
    app.include_router(agents_router)
    app.include_router(atlas_agent_router)
    app.include_router(projects_router)
    app.include_router(tasks_router)
    app.include_router(task_plans_router)
    app.include_router(models_router)
    app.include_router(model_links_router)
    app.include_router(schemas_router)
    app.include_router(sessions_router)
    app.include_router(runs_router)
    app.include_router(templates_router)
    app.include_router(boards_router)
    app.include_router(explorer_router)
    app.include_router(events_router)
    app.include_router(graph_events_router)

    # docs/for-developers/modules/platform/features/telemetry.md — proxy the studio's browser OTLP/HTTP span export to
    # the collector.
    # Always mounted (TE6): the studio exports on its own gate, so a route that
    # disappears when the engine's telemetry is off answers every batch with a
    # 404 the browser console reports as an error. With telemetry off the route
    # accepts the batch and drops it. Excluded from auto-instrumentation in
    # telemetry/setup.py so the proxy never traces itself.
    from invana.server.routes.telemetry import telemetry_router

    app.include_router(telemetry_router)

    mount_admin(app)
    return app
