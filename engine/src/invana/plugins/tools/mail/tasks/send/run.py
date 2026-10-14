"""The ``mail.send`` task type; ``manifest.toml`` beside this file declares it.

``side_effect = "send"``: the interpreter holds the run on an approval before
this ever runs, so reaching ``run`` means a person said yes to these args.
"""

from __future__ import annotations

import asyncio
import hashlib
import smtplib
from email.message import EmailMessage
from email.utils import formatdate, getaddresses

from invana.plugins.sdk import web
from invana.plugins.sdk.context import Out, RunVars, TaskContext
from invana.plugins.tools.mail.shared import Server, server

MAX_RECIPIENTS = 50


def message_id(idempotency_key: str, sender: str) -> str:
    """A Message-ID fixed by the envelope's idempotency key.

    A worker that crashes between sending and recording its outcome is
    redelivered the same envelope, and so sends the same Message-ID — which a
    receiving server and every mail client treat as the same message.
    """
    digest = hashlib.sha256(idempotency_key.encode()).hexdigest()[:32]
    domain = sender.rsplit("@", 1)[-1] if "@" in sender else "invana.local"
    return f"<{digest}@{domain}>"


def _send(srv: Server, message: EmailMessage) -> None:
    """Blocking SMTP work — run off the event loop."""
    if srv.tls:
        conn: smtplib.SMTP = smtplib.SMTP_SSL(srv.host, srv.port, timeout=30)
    else:
        conn = smtplib.SMTP(srv.host, srv.port, timeout=30)
    with conn:
        if not srv.tls:
            conn.starttls()
        if srv.password:
            conn.login(srv.user, srv.password)
        conn.send_message(message)


async def send(ctx: TaskContext, v: RunVars) -> Out:
    """Send ``body`` to ``to`` (one address, or several comma-separated) under ``subject``.

    The sender is the SMTP URL's ``?from=``, else its user name. Nothing is
    retried here — the manifest declares no retries, and a redelivery carries
    the same Message-ID. A refused login or recipient is ``blocked``; a server
    that cannot be reached is ``transient``.
    """
    args = ctx.step.args or {}
    raw_to = args.get("to")
    to = [addr for _name, addr in getaddresses(raw_to if isinstance(raw_to, list) else [str(raw_to or "")]) if addr]
    subject, body = str(args.get("subject") or "").strip(), str(args.get("body") or "")
    if not to or not all("@" in a for a in to) or len(to) > MAX_RECIPIENTS:
        raise web.blocked(f"Name between 1 and {MAX_RECIPIENTS} recipient addresses.", cause="bad_args")
    if not subject or not body.strip():
        raise web.blocked("A message needs a subject and a body.", cause="bad_args")

    srv = server("smtp", ctx.secret("smtp"), schemes=("smtp", "smtps"), default_ports=(587, 465))
    sender = srv.sender or srv.user
    if "@" not in sender:
        raise web.blocked(
            "The smtp secret names no sender address; add ?from=you@example.org to it.",
            cause="secret_invalid",
            secret="smtp",
        )
    message = EmailMessage()
    message["From"] = sender
    message["To"] = ", ".join(to)
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False)
    message["Message-ID"] = message_id(ctx.idempotency_key or ctx.step.id, sender)
    message.set_content(body)

    try:
        await asyncio.to_thread(_send, srv, message)
    except (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused) as exc:
        raise web.blocked(f"The SMTP server {srv.host} refused the message: {exc}.", cause="mail_refused") from exc
    except (smtplib.SMTPException, OSError) as exc:
        raise web.transient(
            f"Could not send through {srv.host}: {type(exc).__name__}.", cause="network_error", host=srv.host
        ) from exc
    return Out(
        detail=f"sent “{subject[:80]}” to {len(to)} recipient{'s' if len(to) != 1 else ''}",
        input={"to": to, "subject": subject},
        output={"message_id": message["Message-ID"], "sent_at": web.now()},
    )


run = send
