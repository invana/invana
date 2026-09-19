"""The counter a long load draws while it runs (load-data.md LD17).

Two rules this file exists to keep: `stdout` carries only the summary a pipe parses,
so every progress byte goes to stderr; and a redirected run writes one line per stage
rather than ten thousand carriage returns.
"""

import io
from unittest.mock import patch

from invana.cli.commands.records import _progress_renderer


def _render(events, *, tty):
    """Drive the renderer over *events* and return what it wrote to stderr."""
    err = io.StringIO()
    err.isatty = lambda: tty
    # The renderer reads isatty() once, at construction; click resolves the stream per echo.
    with patch("sys.stderr", err), patch("click.utils._default_text_stderr", lambda: err):
        render = _progress_renderer()
        for event in events:
            render(event)
    return err.getvalue()


STAGE = {"stage": "write", "message": "Wrote 244 node(s)", "done": 244, "total": 769}
TICK = {"stage": "write", "message": "", "done": 500, "total": 61394}


class TestRedirected:
    def test_a_stage_is_one_line(self):
        out = _render([STAGE], tty=False)

        assert out == "  write     Wrote 244 node(s)\n"

    def test_a_tick_is_not_a_line(self):
        # Ticks carry no message; a log file collects the stages, not the counter.
        out = _render([TICK] * 50, tty=False)

        assert out == ""


class TestOnATty:
    def test_a_tick_rewrites_one_line(self):
        out = _render([TICK], tty=True)

        assert "500/61394" in out
        assert "0%" in out  # 500 of 61394
        assert out.endswith("\r")

    def test_a_tick_without_a_total_does_not_divide_by_zero(self):
        out = _render([{"stage": "stitch", "message": "", "done": 12, "total": 0}], tty=True)

        assert "%" not in out
