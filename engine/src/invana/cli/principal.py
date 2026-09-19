"""Who ran a command, and how (docs/for-developers/modules/bring-data-in/spec.md BD10).

The CLI holds no session, so a run cannot always name a user. What it can always
name is the shell it ran from and the command it was given — and a journal that
says `ravi@laptop (cli)` is worth more than one that guesses at a user id it was
never handed.
"""

from __future__ import annotations

import getpass
import shlex
import socket
import sys


def invocation() -> str:
    """The command this process was started with, as the journal prints it back."""
    return shlex.join(["invana", *sys.argv[1:]])


def shell_label() -> str:
    """Who ran it when no user was named — the shell, said plainly."""
    try:
        return f"{getpass.getuser()}@{socket.gethostname()} (cli)"
    except Exception:  # a container with no passwd entry still gets a run
        return "cli"
