"""invana worker — join a pool and run steps for the engine.

docs/for-developers/modules/agents/features/workers.md. A worker dials the
engine over HTTPS: it holds no database credential and opens no inbound port.
Make a join token in Studio (Workers > Join tokens), then on any machine::

    invana worker --engine https://invana.example.com --token invana_join_… --pool egress

| Option | Env | Meaning |
|---|---|---|
| ``--engine`` | ``INVANA_ENGINE_URL`` | the engine's URL |
| ``--token`` | ``INVANA_JOIN_TOKEN`` | the join token for the pool |
| ``--pool`` | ``INVANA_POOL`` | the pool to join |
| ``--labels`` | ``INVANA_LABELS`` | comma-separated labels, a subset of the pool's (default: all of them) |
| ``--slots`` | ``INVANA_SLOTS`` | steps at once (default: the pool's slots a worker) |
| ``--name`` | | this worker's name (default: ``w-<pool>-NN``) |

Secrets a tool plugin declares are read from this process's environment as
``INVANA_SECRET_<NAME>``. ``invana worker install-service`` prints a systemd
unit (Linux) or a launchd plist (macOS) that runs the same command.
"""

from __future__ import annotations

import asyncio
import shutil
import sys

import click

_COMMON = [
    click.option("--engine", envvar="INVANA_ENGINE_URL", default=None, help="The engine's URL."),
    click.option("--token", envvar="INVANA_JOIN_TOKEN", default=None, help="The join token for the pool."),
    click.option("--pool", envvar="INVANA_POOL", default=None, help="The pool to join."),
    click.option("--labels", envvar="INVANA_LABELS", default="", help="Comma-separated labels, within the pool's."),
    click.option(
        "--slots",
        envvar="INVANA_SLOTS",
        type=click.IntRange(min=1),
        default=None,
        help="Steps this worker runs at once.",
    ),
    click.option("--name", default=None, help="This worker's name."),
]


def _common(func):
    for option in reversed(_COMMON):
        func = option(func)
    return func


def _required(engine: str | None, token: str | None, pool: str | None) -> tuple[str, str, str]:
    missing = [flag for flag, value in (("--engine", engine), ("--token", token), ("--pool", pool)) if not value]
    if missing:
        raise click.UsageError(
            f"Missing {', '.join(missing)}. Make a join token in Studio under Workers > Join tokens."
        )
    return engine, token, pool  # type: ignore[return-value]


@click.group("worker", invoke_without_command=True)
@_common
@click.pass_context
def worker_cmd(
    ctx: click.Context,
    engine: str | None,
    token: str | None,
    pool: str | None,
    labels: str,
    slots: int | None,
    name: str | None,
) -> None:
    """Join a worker pool and run its steps until drained or stopped."""
    if ctx.invoked_subcommand is not None:
        return
    engine, token, pool = _required(engine, token, pool)
    asyncio.run(_work(engine, token, pool, [x.strip() for x in labels.split(",") if x.strip()], slots, name))


async def _work(engine: str, token: str, pool: str, labels: list[str], slots: int | None, name: str | None) -> None:
    import logging

    from invana.plugins.remote import JoinRefused, RemoteWorker

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    worker = RemoteWorker(engine=engine, token=token, pool=pool, labels=labels, slots=slots, name=name)
    click.echo(f"Joining pool '{pool}' on {engine}. Ctrl-C to stop.")
    try:
        await worker.run()
    except JoinRefused as exc:
        raise click.ClickException(str(exc)) from exc
    except KeyboardInterrupt:
        pass


@worker_cmd.command("install-service")
@_common
def install_service_cmd(
    engine: str | None, token: str | None, pool: str | None, labels: str, slots: int | None, name: str | None
) -> None:
    """Print a systemd unit (Linux) or launchd plist (macOS) that runs this worker."""
    engine, _token, pool = engine or "https://invana.example.com", token, pool or "default"
    binary = shutil.which("invana") or "invana"
    args = f"worker --engine {engine} --pool {pool}"
    if labels:
        args += f" --labels {labels}"
    if slots:
        args += f" --slots {slots}"
    if name:
        args += f" --name {name}"
    if sys.platform == "darwin":
        click.echo(_launchd(binary, args.split()))
    else:
        click.echo(_systemd(binary, args))


def _systemd(binary: str, args: str) -> str:
    return f"""# /etc/systemd/system/invana-worker.service
# Put INVANA_JOIN_TOKEN=invana_join_… (and any INVANA_SECRET_<NAME>) in /etc/invana/worker.env, mode 0600.
[Unit]
Description=Invana worker
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/invana/worker.env
ExecStart={binary} {args}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
# then: systemctl daemon-reload && systemctl enable --now invana-worker"""


def _launchd(binary: str, args: list[str]) -> str:
    items = "\n".join(f"    <string>{a}</string>" for a in [binary, *args])
    return f"""<!-- ~/Library/LaunchAgents/com.invana.worker.plist -->
<!-- Add INVANA_JOIN_TOKEN (and any INVANA_SECRET_<NAME>) under EnvironmentVariables. -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.invana.worker</string>
  <key>ProgramArguments</key>
  <array>
{items}
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>INVANA_JOIN_TOKEN</key><string>invana_join_REPLACE_ME</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
<!-- then: launchctl load ~/Library/LaunchAgents/com.invana.worker.plist -->"""
