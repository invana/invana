"""invana start — boot the FastAPI server via uvicorn."""

from __future__ import annotations

import click


@click.command("start")
@click.option("--host", default=None, help="Bind address (default: INVANA_HOST or 127.0.0.1).")
@click.option("--port", default=None, type=int, help="Listen port (default: INVANA_PORT or 8000).")
@click.option("--reload", is_flag=True, default=False, help="Enable uvicorn auto-reload (dev only).")
def start_cmd(host: str | None, port: int | None, reload: bool) -> None:
    """Start the Invana server."""
    try:
        import uvicorn
    except ImportError as exc:
        raise click.ClickException("uvicorn is not installed. Run: pip install invana-engine[server]") from exc

    from invana.settings import settings

    _host = host or settings.host
    _port = port or settings.port

    uvicorn.run(
        "invana.server.app:create_app",
        host=_host,
        port=_port,
        reload=reload,
        log_level=settings.log_level,
        factory=True,
    )
