"""invana worker — run tool steps off the ``tools`` queue.

docs/for-developers/modules/platform/features/tool-plugins.md. Under
``INVANA_EXECUTOR=procrastinate`` the API process defers every tool step as a
``TaskEnvelope``; this command is what runs them. It builds a runtime the way
every other CLI command does, rebuilds each step's world from the envelope's
ids, records the outcome for the API to read, heartbeats every 2 s and, once a
minute, retries the jobs of a worker that went silent::

    INVANA_EXECUTOR=procrastinate invana worker --concurrency 8

It refuses to start under ``inline`` (nothing would ever be queued), on a
database that is not Postgres, or without the ``workers`` extra. Secrets a
tool plugin declares are read from this process's environment.
"""

from __future__ import annotations

import asyncio
import importlib.util

import click


@click.command("worker")
@click.option(
    "--concurrency",
    type=click.IntRange(min=1),
    default=None,
    help="Jobs this worker runs at once (default: INVANA_WORKER_CONCURRENCY).",
)
def worker_cmd(concurrency: int | None) -> None:
    """Run tool steps from the tools queue until stopped."""
    from invana.core.settings import settings

    if settings.executor != "procrastinate":
        raise click.ClickException(
            "invana worker runs queued tool steps, and this install runs them inline. "
            "Set INVANA_EXECUTOR=procrastinate on the API and the worker."
        )
    if not settings.database_url.startswith("postgresql"):
        raise click.ClickException("invana worker needs a PostgreSQL INVANA_DATABASE_URL.")
    if importlib.util.find_spec("procrastinate") is None:
        raise click.ClickException("invana worker needs the workers extra: pip install 'invana[workers]'")
    n = concurrency or settings.worker_concurrency
    click.echo(f"Worker on queue 'tools', concurrency {n}. Ctrl-C to stop.")
    asyncio.run(_work(n))


async def _work(concurrency: int) -> None:
    from invana.cli.context import with_runtime
    from invana.plugins import queue

    try:
        async with with_runtime() as runtime:
            await queue.run_worker(runtime, concurrency=concurrency)
    finally:
        await queue.close()
