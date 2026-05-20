"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from invana.db import create_db_engine, create_session_factory, create_sync_engine
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

    yield

    await manager.shutdown()
    await engine.dispose()
    app.state.sync_engine.dispose()


def create_app() -> FastAPI:
    """Build and return the Invana FastAPI application."""
    from invana.auth.routes import auth_router, workspaces_router
    from invana.server.admin.views import mount_admin
    from invana.server.health import health_router
    from invana.server.routes.graphs import graphs_router
    from invana.server.routes.query import query_router
    from invana.server.routes.schemas import schemas_router

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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(workspaces_router)
    app.include_router(graphs_router)
    app.include_router(schemas_router)
    app.include_router(query_router)
    mount_admin(app)
    return app
