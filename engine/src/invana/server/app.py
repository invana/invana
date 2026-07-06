"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from invana.db import create_db_engine, create_session_factory, create_sync_engine
from invana.server.middleware import CatchAllExceptionMiddleware
from invana.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage DB engine lifecycle: migrate on startup, dispose on shutdown."""
    engine = await create_db_engine()
    app.state.db_engine = engine
    session_factory = create_session_factory(engine)
    app.state.db_session_factory = session_factory

    if settings.telemetry_enabled:
        from invana.telemetry import instrument_app

        instrument_app(app, engine)

    from invana.graphs.manager import GraphConnectionManager

    manager = GraphConnectionManager(
        session_factory=session_factory,
        encryption_key=settings.encryption_key,
    )
    app.state.graph_connection_manager = manager
    await manager.startup()

    # RFC-018 — per-worker LISTEN events daemon for SSE live tail. Started
    # here so its lifecycle tracks the app's; subscribers (SSE handlers) hold
    # references into this broadcaster's queues.
    from invana.events.notify import broadcaster as event_broadcaster

    app.state.event_broadcaster = event_broadcaster
    await event_broadcaster.start()

    yield

    await event_broadcaster.stop()
    await manager.shutdown()
    await engine.dispose()
    app.state.sync_engine.dispose()


def create_app() -> FastAPI:
    """Build and return the Invana FastAPI application."""
    from invana.auth.routes import auth_router
    from invana.canvases.routes import canvases_router
    from invana.datasets.routes import datasets_router
    from invana.events.routes import events_router, graph_events_router
    from invana.explorer.routes import explorer_router
    from invana.graphs.routes import graph_router, graphs_collection_router
    from invana.llm_providers.routes import llm_providers_router
    from invana.server.admin.views import mount_admin
    from invana.server.health import health_router
    from invana.server.routes.models import models_router
    from invana.server.routes.schemas import schemas_router
    from invana.sessions.routes import sessions_router
    from invana.skills.routes import skills_router

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )

    # Sync engine created eagerly — starlette-admin needs it at mount time.
    app.state.sync_engine = create_sync_engine()

    if settings.telemetry_enabled:
        from invana.telemetry import TelemetryMiddleware

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

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(graphs_collection_router)
    app.include_router(graph_router)
    app.include_router(llm_providers_router)
    app.include_router(skills_router)
    app.include_router(datasets_router)
    app.include_router(models_router)
    app.include_router(schemas_router)
    app.include_router(sessions_router)
    app.include_router(canvases_router)
    app.include_router(explorer_router)
    app.include_router(events_router)
    app.include_router(graph_events_router)

    # RFC-025 — proxy the studio's browser OTLP/HTTP span export to the collector.
    # Only mounted when telemetry is on; excluded from auto-instrumentation in
    # telemetry/setup.py so the proxy never traces itself.
    if settings.telemetry_enabled:
        from invana.telemetry.routes import telemetry_router

        app.include_router(telemetry_router)

    mount_admin(app)
    return app
