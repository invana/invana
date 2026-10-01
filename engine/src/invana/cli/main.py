"""
Root Click group for the `invana` CLI.

Every command run is one trace. ``TracedGroup`` — the root group's class — opens
a root span named for the command path before the command runs and closes it
when the command returns or fails:

    invana version          → cli.version
    invana users create …   → cli.users.create

The span records ``invana.origin=cli`` (where the work came from),
``invana.principal=user`` (a person typed it; the CLI holds no session, so there
is no ``enduser.id``), ``invana.cli.command`` (the dotted path) and
``invana.outcome`` — ``ok`` when the command returns or exits with code 0,
``error`` when it raises or exits non-zero, with the exception recorded. The
engine and HTTP calls a command makes are its children, so one ``invana loader``
run reads as one tree.

Two runs are not traced: ``invana start`` (it runs the server, which traces its
own startup and requests) and any ``--help`` (nothing happens worth a trace).

With telemetry enabled the group also instruments SQLAlchemy for the process —
there is no FastAPI lifespan here to hand an engine to — and flushes and shuts
down the providers once the span has ended, within five seconds, so a command
that runs for a second still ships its spans and a collector that is down cannot
hold its exit up. Tracing never breaks a command: a failure anywhere in it is
logged at debug and the command runs untraced.
"""

from __future__ import annotations

import logging
from contextlib import ExitStack
from typing import Any

import click

from invana.cli.commands.govern import govern_cmd
from invana.cli.commands.init import init_cmd
from invana.cli.commands.loader import loader_cmd
from invana.cli.commands.migrate import migrate_cmd
from invana.cli.commands.models import models_cmd
from invana.cli.commands.records import records_cmd
from invana.cli.commands.start import start_cmd
from invana.cli.commands.stitches import stitches_cmd
from invana.cli.commands.users import users_cmd
from invana.core.logging import set_level
from invana.core.settings import settings
from invana.core.telemetry.spans import mark_error, root_span

logger = logging.getLogger("invana.telemetry")

# Commands that are never traced: `start` runs the server, which traces itself.
_UNTRACED = frozenset({"start"})


class TracedGroup(click.Group):
    """A ``click.Group`` whose every invocation is one root span ``cli.<path>``.

    Used as the root group's ``cls``; subgroups stay plain ``click.Group``s,
    because the root sees the whole command line before anything below it runs.
    """

    def invoke(self, ctx: click.Context) -> Any:
        """Run the command inside its root span, then flush and shut telemetry down."""
        tokens = [*_protected_args(ctx), *ctx.args]
        path = self._traced_path(ctx, tokens)
        if path is None:
            return super().invoke(ctx)

        result: Any = None
        exit_exc: BaseException | None = None
        try:
            with ExitStack() as stack:
                s = _enter_span(stack, path)
                try:
                    result = super().invoke(ctx)
                except (click.exceptions.Exit, SystemExit) as exc:
                    # A deliberate exit: outcome follows its code. Re-raised outside
                    # the span so a clean exit is never recorded as an exception.
                    code = exc.exit_code if isinstance(exc, click.exceptions.Exit) else exc.code
                    failed = code not in (0, None)
                    _set(s, "invana.outcome", "error" if failed else "ok")
                    if failed:
                        mark_error(s)
                    exit_exc = exc
                except BaseException:
                    _set(s, "invana.outcome", "error")
                    raise
                else:
                    _set(s, "invana.outcome", "ok")
        finally:
            _flush()
        if exit_exc is not None:
            raise exit_exc
        return result

    def _traced_path(self, ctx: click.Context, tokens: list[str]) -> str | None:
        """The dotted command path to trace, or ``None`` when this run is not traced."""
        try:
            if any(t in ctx.help_option_names for t in tokens):
                return None
            names = _command_names(self, ctx, tokens)
            if not names or names[0] in _UNTRACED:
                return None
            if settings.telemetry_enabled:
                from invana.core.telemetry import instrument_process

                instrument_process()
            return ".".join(names)
        except Exception as exc:  # tracing never breaks a command
            logger.debug("CLI tracing skipped — %s", exc)
            return None


def _protected_args(ctx: click.Context) -> list[str]:
    """The subcommand token(s) click has set aside, without its deprecation warning."""
    found = getattr(ctx, "_protected_args", None)
    return list(found) if found is not None else list(ctx.protected_args)


def _command_names(root: click.Group, ctx: click.Context, tokens: list[str]) -> list[str]:
    """Walk ``tokens`` through nested groups to the command that will run.

    Stops at the first option or at a leaf command. When a token does not
    resolve, falls back to the first name alone — click is about to report the
    usage error, and the span still says which command was tried.
    """
    names: list[str] = []
    cmd: click.Command = root
    for token in tokens:
        if not isinstance(cmd, click.Group) or token.startswith("-"):
            break
        try:
            name, sub, _ = cmd.resolve_command(ctx, [token])
        except click.UsageError:
            sub = None
        if sub is None:
            return names or [token]
        names.append(name or sub.name)
        cmd = sub
    return names


def _enter_span(stack: ExitStack, path: str) -> Any:
    """Open the command's root span on ``stack``; ``None`` if it cannot be opened."""
    try:
        return stack.enter_context(
            root_span(
                f"cli.{path}",
                origin="cli",
                principal="user",
                attributes={"invana.cli.command": path},
            )
        )
    except Exception as exc:  # tracing never breaks a command
        logger.debug("CLI span not opened — %s", exc)
        return None


def _set(target: Any, key: str, value: str) -> None:
    """Set one attribute on ``target`` if it is a recording span."""
    if target is not None and target.is_recording():
        target.set_attribute(key, value)


def _flush() -> None:
    """Ship the command's signals and shut the providers down, within five seconds; never raises."""
    if not settings.telemetry_enabled:
        return
    try:
        from invana.core.telemetry import shutdown_telemetry

        shutdown_telemetry()
    except Exception as exc:  # telemetry never breaks the caller
        logger.debug("Telemetry shutdown skipped — %s", exc)


@click.group(cls=TracedGroup)
def app() -> None:
    """Invana — Graph Intelligence Platform."""
    # Importing invana configured logging (and telemetry's OTLP handler on top);
    # the CLI only lowers the chatter to INFO, in place.
    set_level("INFO")


@app.command("version")
def version_cmd() -> None:
    """Print the Invana version."""
    from invana.core.settings import settings

    click.echo(f"Invana {settings.app_version}")


app.add_command(start_cmd)
app.add_command(migrate_cmd)
app.add_command(loader_cmd)
app.add_command(init_cmd)
app.add_command(users_cmd)
app.add_command(models_cmd)
app.add_command(records_cmd)
app.add_command(stitches_cmd)
app.add_command(govern_cmd)
