"""FastAPI application factory."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from invana.db import create_db_engine, create_session_factory, create_sync_engine
from invana.logging import configure_logging
from invana.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage DB engine lifecycle: migrate on startup, dispose on shutdown."""
    configure_logging(level=settings.log_level)
    engine = await create_db_engine()
    app.state.db_engine = engine
    app.state.db_session_factory = create_session_factory(engine)
    yield
    await engine.dispose()
    app.state.sync_engine.dispose()


def create_app() -> FastAPI:
    """Build and return the Invana FastAPI application."""
    from invana.server.admin.views import mount_admin
    from invana.server.health import health_router

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=lifespan,
    )

    # Sync engine created eagerly — starlette-admin needs it at mount time.
    app.state.sync_engine = create_sync_engine()

    app.include_router(health_router)
    mount_admin(app)
    return app
