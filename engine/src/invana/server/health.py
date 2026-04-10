"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from invana.settings import settings

health_router = APIRouter(tags=["health"])


@health_router.get("/")
async def root() -> JSONResponse:
    """Root endpoint — basic service info."""
    return JSONResponse(
        status_code=200,
        content={
            "app_name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
        },
    )


@health_router.get("/health")
async def health(request: Request) -> JSONResponse:
    """Liveness / readiness probe."""
    db_status = "connected"
    status_code = 200

    try:
        async with request.app.state.db_engine.connect() as conn:
            await conn.exec_driver_sql("SELECT 1")
    except Exception:
        db_status = "disconnected"
        status_code = 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if status_code == 200 else "unhealthy",
            "app_name": settings.app_name,
            "version": settings.app_version,
            "database": db_status,
        },
    )
