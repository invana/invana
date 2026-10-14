"""Channels — where a notification goes when it leaves the inbox.

docs/for-developers/modules/operate/features/notifications.md.
A channel is ``email`` (addresses, sent through the install's SMTP), ``slack``
(an incoming-webhook URL) or ``webhook`` (a URL and an optional signing secret).
The URL and the secret are a credential: Fernet-encrypted at write, never read
back, shown masked::

    row = await ChannelManager().create(session, graph=graph, payload=ChannelCreate(
        name="ops", kind="webhook", target="https://hooks.example.org/invana", secret="s3cret"), actor_id=user.id)
    error = await ChannelManager().send(row, {"title": "Nightly digest", "body": "…"})  # "" when it went

A webhook body is the payload as JSON, signed ``X-Invana-Signature:
sha256=<hex hmac>`` when the channel has a secret. Slack receives ``{"text": …}``.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import re
import smtplib
from email.message import EmailMessage
from urllib.parse import urlsplit

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.models import ChannelKind, NotificationChannel
from invana.activity.querysets import ChannelQuerySet, RuleQuerySet, ScheduleQuerySet
from invana.activity.schemas import ChannelCreate, ChannelRead
from invana.apps.graphs.encryption import decrypt_credentials, encrypt_credentials
from invana.apps.graphs.models import Graph
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.settings import settings

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_SEND_TIMEOUT_S = 10.0


def _mask(url: str) -> str:
    parts = urlsplit(url)
    tail = parts.path.rstrip("/").rsplit("/", 1)[-1]
    return f"{parts.scheme}://{parts.netloc}/…{tail[-4:]}" if tail else f"{parts.scheme}://{parts.netloc}"


def email_ready() -> tuple[bool, str]:
    if not settings.smtp_host or not settings.smtp_from:
        return False, "email is not configured on this install"
    return True, ""


def render(kind: str, message: dict) -> dict:
    """``message`` (title · body · link) as ``kind`` receives it."""
    title, body, link = message.get("title", ""), message.get("body", ""), message.get("link", "")
    if kind == ChannelKind.slack.value:
        return {"text": "\n".join(p for p in (f"*{title}*", body, link) if p)}
    if kind == ChannelKind.email.value:
        return {"subject": title, "text": "\n\n".join(p for p in (body, link) if p)}
    return message


class ChannelManager:
    """Stateless. The session is the first argument of every method that reads."""

    channels_qs = ChannelQuerySet()
    rules_qs = RuleQuerySet()
    schedules_qs = ScheduleQuerySet()

    def read(self, row: NotificationChannel) -> ChannelRead:
        ready, reason = email_ready() if row.kind == ChannelKind.email.value else (True, "")
        return ChannelRead(
            id=row.id,
            name=row.name,
            kind=row.kind,
            target=row.target,
            ready=ready,
            reason=reason,
            created_at=row.created_at,
        )

    async def list(self, session: AsyncSession, *, graph: Graph) -> list[NotificationChannel]:
        return await self.channels_qs.list_for_graph(session, graph_id=graph.id)

    async def resolve(self, session: AsyncSession, *, graph_id: str, refs: list[str]) -> list[str]:
        """Channel ids for ``refs`` (ids or names); 422 naming any unknown one."""
        ids, unknown = [], []
        for ref in dict.fromkeys(refs):
            row = await self.channels_qs.by_ref(session, graph_id=graph_id, ref=ref)
            (ids.append(row.id) if row else unknown.append(ref))
        if unknown:
            raise ValidationError(f"No channel named {', '.join(unknown)} on this Graph.")
        return ids

    async def create(
        self, session: AsyncSession, *, graph: Graph, payload: ChannelCreate, actor_id: str
    ) -> NotificationChannel:
        if await self.channels_qs.by_ref(session, graph_id=graph.id, ref=payload.name):
            raise ConflictError(f"A channel named {payload.name!r} already exists.")
        row = NotificationChannel(graph_id=graph.id, name=payload.name, kind=payload.kind, created_by_id=actor_id)
        if payload.kind == ChannelKind.email.value:
            addresses = [a.strip() for a in payload.target.split(",") if a.strip()]
            bad = [a for a in addresses if not _EMAIL.match(a)]
            if not addresses or bad:
                raise ValidationError(f"Not an email address: {', '.join(bad) or payload.target!r}.")
            row.target = ", ".join(addresses)
        else:
            if urlsplit(payload.target).scheme not in ("http", "https"):
                raise ValidationError("A Slack or webhook channel needs an http(s) URL.")
            if payload.secret and payload.kind != ChannelKind.webhook.value:
                raise ValidationError("Only a webhook channel takes a signing secret.")
            row.target = _mask(payload.target)
            row.secret_encrypted = encrypt_credentials(
                {"url": payload.target, "secret": payload.secret or ""}, settings.encryption_key
            )
        await self.channels_qs.add(session, row)
        await emit_event(
            session,
            action=actions.CHANNEL_CREATE,
            target_kind=actions.TARGET_CHANNEL,
            target_id=row.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"name": row.name, "kind": row.kind, "target": row.target},
        )
        return row

    async def delete(self, session: AsyncSession, *, graph: Graph, ref: str, actor_id: str) -> None:
        row = await self.channels_qs.by_ref(session, graph_id=graph.id, ref=ref)
        if row is None:
            raise NotFoundError("Channel not found.")
        users = [
            r.name for r in await self.rules_qs.list_for_graph(session, graph_id=graph.id) if row.id in r.channel_ids
        ]
        users += [
            s.name
            for s in await self.schedules_qs.naming_channel(session, graph_id=graph.id)
            if row.id in s.channel_ids
        ]
        if users:
            raise ConflictError(f"{row.name!r} is used by {', '.join(users)}; remove it there first.")
        await emit_event(
            session,
            action=actions.CHANNEL_DELETE,
            target_kind=actions.TARGET_CHANNEL,
            target_id=row.id,
            graph_id=graph.id,
            actor_id=actor_id,
            details={"name": row.name, "kind": row.kind},
        )
        await self.channels_qs.delete(session, row)

    async def send(self, channel: NotificationChannel, payload: dict) -> str:
        """Send ``payload`` (already rendered for the channel); the error, or ``""``."""
        try:
            if channel.kind == ChannelKind.email.value:
                return await self._email(channel, payload)
            secret = decrypt_credentials(channel.secret_encrypted, settings.encryption_key)
            body = json.dumps(payload, default=str).encode()
            headers = {"Content-Type": "application/json"}
            if secret.get("secret"):
                digest = hmac.new(secret["secret"].encode(), body, hashlib.sha256).hexdigest()
                headers["X-Invana-Signature"] = f"sha256={digest}"
            async with httpx.AsyncClient(timeout=_SEND_TIMEOUT_S) as client:
                response = await client.post(secret["url"], content=body, headers=headers)
            if response.status_code >= 400:
                return f"{channel.kind} answered {response.status_code}"
            return ""
        except Exception as exc:  # a send failure is recorded on the delivery, never raised
            return f"{type(exc).__name__}: {exc}"[:500]

    async def _email(self, channel: NotificationChannel, payload: dict) -> str:
        ready, reason = email_ready()
        if not ready:
            return reason
        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = channel.target
        message["Subject"] = payload.get("subject", "")
        message.set_content(payload.get("text", ""))

        def deliver() -> None:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=_SEND_TIMEOUT_S) as smtp:
                if settings.smtp_starttls:
                    smtp.starttls()
                if settings.smtp_username:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)

        await asyncio.to_thread(deliver)
        return ""
