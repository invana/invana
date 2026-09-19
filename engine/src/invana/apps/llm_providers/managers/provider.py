"""LLM provider rules — CRUD, the default, and the credential ping.

Credentials are Fernet-encrypted at rest under the single shared
``INVANA_ENCRYPTION_KEY``. The on-disk shape is just ``{"api_key": "..."}``,
wrapped here so callers never think about the envelope.
"""

from __future__ import annotations

import asyncio
import time
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.encryption import decrypt_credentials, encrypt_credentials
from invana.apps.llm_providers.models import LLMCredentialKind, LLMProvider, LLMProviderKind
from invana.apps.llm_providers.ping import _dispatch_ping
from invana.apps.llm_providers.querysets import LLMProviderQuerySet
from invana.apps.llm_providers.schemas import LLMProviderCreate, LLMProviderUpdate
from invana.core.errors import InvanaError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

# Providers that can run without a stored key. `claude_agent_sdk` falls through
# to the local Claude Code CLI's own login when none is set.
_KEYLESS = (LLMProviderKind.ollama, LLMProviderKind.local, LLMProviderKind.claude_agent_sdk)

_TRACKED = ["model_id", "base_url", "guardrails", "is_default", "has_api_key"]


class MalformedCredentialError(InvanaError):
    """Stored ciphertext decrypted to something that is not a key. A 500, not a
    400 — the caller did nothing wrong and cannot fix it."""


class LLMProviderManager:
    querysets = LLMProviderQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[LLMProvider]:
        return await self.querysets.list_for_graph(session, graph_id)

    async def get(self, session: AsyncSession, *, provider_id: str, graph_id: str) -> LLMProvider:
        provider = await self.querysets.get(session, provider_id)
        if provider is None or provider.graph_id != graph_id:
            raise NotFoundError("LLM provider not found.")
        return provider

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: LLMProviderCreate,
        encryption_key: str,
        actor_id: str,
    ) -> LLMProvider:
        if payload.is_default:
            await self.querysets.clear_default(session, graph_id)

        if payload.provider not in _KEYLESS and not payload.api_key:
            raise ValidationError(f"{payload.provider.value} requires an api_key.")
        self._validate_credential_kind(payload.provider, payload.credential_kind, has_key=bool(payload.api_key))

        provider = LLMProvider(
            graph_id=graph_id,
            provider=payload.provider,
            model_id=payload.model_id,
            api_key_encrypted=self._encrypt(payload.api_key, encryption_key) if payload.api_key else None,
            credential_kind=payload.credential_kind,
            base_url=payload.base_url,
            guardrails=payload.guardrails,
            is_default=payload.is_default,
        )
        await self.querysets.add(session, provider)
        await emit_event(
            session,
            action=actions.LLM_CREATE,
            target_kind=actions.TARGET_LLM,
            target_id=provider.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={
                "provider": provider.provider.value,
                "model_id": provider.model_id,
                "is_default": provider.is_default,
                "has_base_url": provider.base_url is not None,
                "has_api_key": provider.api_key_encrypted is not None,
            },
            trace_id=current_trace_id(),
        )
        return provider

    async def update(
        self,
        session: AsyncSession,
        *,
        provider: LLMProvider,
        payload: LLMProviderUpdate,
        encryption_key: str,
        actor_id: str,
    ) -> LLMProvider:
        before = self._snapshot(provider)
        self._validate_credential_kind(
            provider.provider,
            payload.credential_kind if payload.credential_kind is not None else provider.credential_kind,
            has_key=(payload.api_key is not None) or (provider.api_key_encrypted is not None),
        )

        if payload.model_id is not None:
            provider.model_id = payload.model_id
        if payload.base_url is not None:
            provider.base_url = payload.base_url
        if payload.guardrails is not None:
            provider.guardrails = payload.guardrails
        if payload.api_key is not None:
            provider.api_key_encrypted = self._encrypt(payload.api_key, encryption_key)
        if payload.credential_kind is not None:
            provider.credential_kind = payload.credential_kind
        if payload.is_default is True:
            await self.querysets.clear_default(session, provider.graph_id)
            provider.is_default = True
        elif payload.is_default is False:
            provider.is_default = False

        await session.flush()
        changed = diff_changed_fields(before, self._snapshot(provider), fields=_TRACKED)
        if changed:
            await emit_event(
                session,
                action=actions.LLM_UPDATE,
                target_kind=actions.TARGET_LLM,
                target_id=provider.id,
                graph_id=provider.graph_id,
                actor_id=actor_id,
                details={
                    "changed": changed,
                    "provider": provider.provider.value,
                    "model_id": provider.model_id,
                },
                trace_id=current_trace_id(),
            )
        return provider

    async def delete(self, session: AsyncSession, *, provider: LLMProvider, actor_id: str) -> None:
        snapshot = {"provider": provider.provider.value, "model_id": provider.model_id}
        graph_id, provider_id = provider.graph_id, provider.id
        await self.querysets.delete(session, provider)
        await emit_event(
            session,
            action=actions.LLM_DELETE,
            target_kind=actions.TARGET_LLM,
            target_id=provider_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details=snapshot,
            trace_id=current_trace_id(),
        )

    async def set_default(self, session: AsyncSession, *, provider: LLMProvider, actor_id: str) -> LLMProvider:
        await self.querysets.clear_default(session, provider.graph_id)
        provider.is_default = True
        await session.flush()
        await emit_event(
            session,
            action=actions.LLM_SET_DEFAULT,
            target_kind=actions.TARGET_LLM,
            target_id=provider.id,
            graph_id=provider.graph_id,
            actor_id=actor_id,
            details={"provider": provider.provider.value, "model_id": provider.model_id},
            trace_id=current_trace_id(),
        )
        return provider

    async def ping(
        self,
        session: AsyncSession,
        *,
        provider: LLMProvider,
        encryption_key: str,
        actor_id: str | None = None,
        timeout_s: float = 10.0,
    ) -> dict:
        """Verify the credentials with a minimal call. Returns ``{ok, latency_ms?, error?}``.

        Emits ``llm.ping`` either way, so an operator can see who tested which
        provider when, and what came back.
        """
        api_key = (
            self._decrypt(provider.api_key_encrypted, encryption_key)
            if provider.api_key_encrypted is not None
            else None
        )

        result: dict[str, object]
        try:
            t0 = time.monotonic()
            ok = await asyncio.wait_for(_dispatch_ping(provider, api_key), timeout=timeout_s)
            latency_ms = int((time.monotonic() - t0) * 1000)
            result = (
                {"ok": True, "latency_ms": latency_ms}
                if ok
                else {"ok": False, "error": "Provider rejected the credentials."}
            )
        except TimeoutError:
            result = {"ok": False, "error": f"Ping timed out after {timeout_s:.0f}s."}
        except Exception as exc:
            result = {"ok": False, "error": str(exc)}

        # The result is kept on the row, not only in the event: setup's Answering
        # gate reads it, and a failed ping is what the step's ``broken`` state
        # says back (docs/for-developers/modules/platform/features/setup.md).
        provider.last_ping_at = datetime.now(UTC)
        provider.last_ping_ok = bool(result["ok"])
        provider.last_ping_error = None if result["ok"] else str(result.get("error") or "")
        await session.flush()

        await emit_event(
            session,
            action=actions.LLM_PING,
            target_kind=actions.TARGET_LLM,
            target_id=provider.id,
            graph_id=provider.graph_id,
            actor_id=actor_id,
            details={
                "provider": provider.provider.value,
                "model_id": provider.model_id,
                **result,
            },
            trace_id=current_trace_id(),
        )
        return result

    # ── Credential envelope ──────────────────────────────────────────────────

    def _encrypt(self, api_key: str, key: str) -> bytes:
        return encrypt_credentials({"api_key": api_key}, key)

    def _decrypt(self, token: bytes, key: str) -> str:
        raw = decrypt_credentials(token, key).get("api_key")
        if not isinstance(raw, str):
            raise MalformedCredentialError("Stored LLM credentials are malformed.")
        return raw

    def _snapshot(self, provider: LLMProvider) -> dict:
        return {
            "model_id": provider.model_id,
            "base_url": provider.base_url,
            "guardrails": provider.guardrails,
            "is_default": provider.is_default,
            "has_api_key": provider.api_key_encrypted is not None,
        }

    def _validate_credential_kind(
        self,
        provider_kind: LLMProviderKind,
        credential_kind: LLMCredentialKind | None,
        *,
        has_key: bool,
    ) -> None:
        """``credential_kind`` only means something on ``claude_agent_sdk`` rows.

        ``has_key`` is the *effective* post-write state — a fresh key in this
        payload, or the row's already-stored one. An ``oauth_token`` row cannot
        end up with nothing behind it, since there is no "fall through to CLI
        login" fallback for that mode the way there is for a blank ``api_key``.
        """
        if credential_kind is not None and provider_kind != LLMProviderKind.claude_agent_sdk:
            raise ValidationError("credential_kind is only valid for claude_agent_sdk.")
        if credential_kind == LLMCredentialKind.oauth_token and not has_key:
            raise ValidationError(
                "credential_kind=oauth_token requires api_key (paste the output of `claude setup-token`)."
            )
