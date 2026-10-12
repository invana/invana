"""The ``mail.read`` task type; ``manifest.toml`` beside this file declares it."""

from __future__ import annotations

import asyncio
import contextlib
import email
import imaplib
from email.message import EmailMessage
from email.policy import default as default_policy

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.tools.mail.shared import Server, server

MAX_MESSAGES = 100
MAX_TEXT = 20_000


def _text(message: EmailMessage) -> str:
    body = message.get_body(preferencelist=("plain", "html"))
    if body is None:
        return ""
    content = body.get_content()
    if body.get_content_subtype() == "html":
        content = web.html_to_text(content)[1]
    return str(content)[:MAX_TEXT]


def _read(srv: Server, folder: str, limit: int, unseen_only: bool) -> list[dict]:
    """Blocking IMAP work — run off the event loop. ``BODY.PEEK`` leaves every message unread."""
    conn = (
        imaplib.IMAP4_SSL(srv.host, srv.port, timeout=30) if srv.tls else imaplib.IMAP4(srv.host, srv.port, timeout=30)
    )
    try:
        if not srv.tls:
            conn.starttls()
        conn.login(srv.user, srv.password)
        # IMAP EXAMINE (a read-only SELECT) opens a mailbox; bound by name so it never reads as a SQL query.
        examine = conn.select
        status, _ = examine(f'"{folder}"', readonly=True)
        if status != "OK":
            raise web.blocked(f"The mailbox has no folder '{folder}'.", cause="folder_missing", folder=folder)
        _, found = conn.search(None, "UNSEEN" if unseen_only else "ALL")
        ids = (found[0] or b"").split()[-limit:]
        messages: list[dict] = []
        for msg_id in reversed(ids):
            _, parts = conn.fetch(msg_id, "(BODY.PEEK[])")
            raw = next((p[1] for p in parts if isinstance(p, tuple)), None)
            if raw is None:
                continue
            msg = email.message_from_bytes(raw, policy=default_policy)
            messages.append(
                {
                    "from": str(msg.get("From", "")),
                    "subject": str(msg.get("Subject", "")),
                    "date": str(msg.get("Date", "")),
                    "text": _text(msg),  # type: ignore[arg-type]
                    "message_id": str(msg.get("Message-ID", "")),
                }
            )
        return messages
    finally:
        with contextlib.suppress(imaplib.IMAP4.error, OSError):
            conn.logout()


async def read(ctx: TaskContext, v: RunVars) -> Out:
    """The newest ``limit`` messages of ``folder``, newest first — unseen ones only by default.

    The folder is opened read-only and bodies are fetched with ``BODY.PEEK``,
    so reading never changes the mailbox. A refused login is ``blocked``; a
    server that cannot be reached is ``transient``.
    """
    args = ctx.step.args or {}
    folder = str(args.get("folder") or "INBOX")
    limit = max(1, min(int(args.get("limit") or 20), MAX_MESSAGES))
    unseen_only = bool(args.get("unseen_only", True))
    srv = server("imap", ctx.secret("imap"), schemes=("imap", "imaps"), default_ports=(143, 993))
    try:
        messages = await asyncio.to_thread(_read, srv, folder, limit, unseen_only)
    except imaplib.IMAP4.error as exc:
        raise web.blocked(
            f"The IMAP server {srv.host} refused the request: {exc}.", cause="mail_refused", host=srv.host
        ) from exc
    except OSError as exc:
        raise web.transient(
            f"Could not reach {srv.host}: {type(exc).__name__}.", cause="network_error", host=srv.host
        ) from exc
    return Out(
        detail=f"{len(messages)} {'unseen ' if unseen_only else ''}messages in {folder}",
        input={"folder": folder, "limit": limit, "unseen_only": unseen_only},
        output={"messages": messages},
    )


run = read
