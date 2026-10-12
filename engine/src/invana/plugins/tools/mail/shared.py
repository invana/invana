"""What both mail task types share: reading a server URL out of a secret.

The ``imap`` and ``smtp`` secrets are URLs with the credentials in them —
``imaps://user:pass@host:993`` · ``smtp://user:pass@host:587`` — percent-encoded
where a password needs it. ``imaps``/``smtps`` connect over TLS; ``imap``/``smtp``
connect plain and upgrade with STARTTLS before anything is sent. An optional
``?from=`` on the SMTP URL sets the sender when the user name is not an address.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import parse_qs, unquote, urlsplit

from invana.plugins.sdk import web


@dataclass(frozen=True, slots=True)
class Server:
    host: str
    port: int
    user: str
    password: str
    #: TLS from the first byte; otherwise STARTTLS.
    tls: bool
    #: The ``?from=`` override, if any.
    sender: str = ""


def server(secret_name: str, value: str, *, schemes: tuple[str, str], default_ports: tuple[int, int]) -> Server:
    """The server a secret names; a malformed one is ``blocked · secret_invalid``."""
    parts = urlsplit(value)
    plain, secure = schemes
    if parts.scheme not in schemes or not parts.hostname or parts.username is None:
        raise web.blocked(
            f"The secret '{secret_name}' is not a {plain}:// or {secure}:// URL with a user name.",
            cause="secret_invalid",
            secret=secret_name,
        )
    tls = parts.scheme == secure
    return Server(
        host=parts.hostname,
        port=parts.port or (default_ports[1] if tls else default_ports[0]),
        user=unquote(parts.username),
        password=unquote(parts.password or ""),
        tls=tls,
        sender=(parse_qs(parts.query).get("from") or [""])[0],
    )
