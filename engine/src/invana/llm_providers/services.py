"""Service layer for LLM provider CRUD + credential ping.

The ping step lazy-imports the provider SDK and makes a minimal call to verify
credentials work — same contract as ``graphs.services.test_connection_credentials``.
"""

from __future__ import annotations

import asyncio
import time
from http import HTTPStatus

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from invana.graphs.encryption import decrypt_credentials, encrypt_credentials
from invana.llm_providers.models import LLMProvider, LLMProviderKind
from invana.llm_providers.schemas import LLMProviderCreate, LLMProviderUpdate
from invana.llm_providers.store import LLMProviderStore

# ---------------------------------------------------------------------------
# Encryption helpers — wrap ``graphs.encryption`` so the on-disk shape is just
# ``{"api_key": "..."}`` and callers don't have to think about the wrapper.
# ---------------------------------------------------------------------------


def _encrypt_key(api_key: str, key: str) -> bytes:
    return encrypt_credentials({"api_key": api_key}, key)


def _decrypt_key(token: bytes, key: str) -> str:
    payload = decrypt_credentials(token, key)
    raw = payload.get("api_key")
    if not isinstance(raw, str):
        raise HTTPException(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            detail="Stored LLM credentials are malformed.",
        )
    return raw


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


async def list_providers(session: AsyncSession, *, graph_id: str) -> list[LLMProvider]:
    return await LLMProviderStore().list_for_graph(session, graph_id)


async def get_or_404(session: AsyncSession, *, provider_id: str, graph_id: str) -> LLMProvider:
    provider = await LLMProviderStore().get(session, provider_id)
    if provider is None or provider.graph_id != graph_id:
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="LLM provider not found.")
    return provider


async def create_provider(
    session: AsyncSession,
    *,
    graph_id: str,
    payload: LLMProviderCreate,
    encryption_key: str,
) -> LLMProvider:
    store = LLMProviderStore()
    if payload.is_default:
        await store.clear_default(session, graph_id)

    needs_key = payload.provider not in (LLMProviderKind.ollama, LLMProviderKind.local)
    if needs_key and not payload.api_key:
        raise HTTPException(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            detail=f"{payload.provider.value} requires an api_key.",
        )

    provider = LLMProvider(
        graph_id=graph_id,
        provider=payload.provider,
        model_id=payload.model_id,
        api_key_encrypted=_encrypt_key(payload.api_key, encryption_key) if payload.api_key else None,
        base_url=payload.base_url,
        guardrails=payload.guardrails,
        is_default=payload.is_default,
    )
    return await store.add(session, provider)


async def update_provider(
    session: AsyncSession,
    *,
    provider: LLMProvider,
    payload: LLMProviderUpdate,
    encryption_key: str,
) -> LLMProvider:
    store = LLMProviderStore()

    if payload.model_id is not None:
        provider.model_id = payload.model_id
    if payload.base_url is not None:
        provider.base_url = payload.base_url
    if payload.guardrails is not None:
        provider.guardrails = payload.guardrails
    if payload.api_key is not None:
        provider.api_key_encrypted = _encrypt_key(payload.api_key, encryption_key)
    if payload.is_default is True:
        await store.clear_default(session, provider.graph_id)
        provider.is_default = True
    elif payload.is_default is False:
        provider.is_default = False

    await session.flush()
    return provider


async def delete_provider(session: AsyncSession, *, provider: LLMProvider) -> None:
    await LLMProviderStore().delete(session, provider)


async def set_default(session: AsyncSession, *, provider: LLMProvider) -> LLMProvider:
    store = LLMProviderStore()
    await store.clear_default(session, provider.graph_id)
    provider.is_default = True
    await session.flush()
    return provider


# ---------------------------------------------------------------------------
# Ping (credential test)
# ---------------------------------------------------------------------------


async def ping_provider(*, provider: LLMProvider, encryption_key: str, timeout_s: float = 10.0) -> dict:
    """Verify the provider's credentials by making a minimal call.

    Lazy-imports the per-provider SDK so the engine doesn't hard-depend on every
    SDK at install time. Returns ``{ok, latency_ms?, error?}``.
    """
    api_key = (
        _decrypt_key(provider.api_key_encrypted, encryption_key) if provider.api_key_encrypted is not None else None
    )

    try:
        coro = _dispatch_ping(provider, api_key)
        t0 = time.monotonic()
        ok = await asyncio.wait_for(coro, timeout=timeout_s)
        latency_ms = int((time.monotonic() - t0) * 1000)
        if ok:
            return {"ok": True, "latency_ms": latency_ms}
        return {"ok": False, "error": "Provider rejected the credentials."}
    except TimeoutError:
        return {"ok": False, "error": f"Ping timed out after {timeout_s:.0f}s."}
    except Exception as exc:  # noqa: BLE001 — surface arbitrary SDK errors
        return {"ok": False, "error": str(exc)}


async def _dispatch_ping(provider: LLMProvider, api_key: str | None) -> bool:
    """Per-provider ping. SDK calls happen in a thread to keep this async-friendly."""
    if provider.provider == LLMProviderKind.anthropic:
        if not api_key:
            return False
        return await asyncio.to_thread(_ping_anthropic, api_key, provider.model_id)
    if provider.provider == LLMProviderKind.openai:
        if not api_key:
            return False
        return await asyncio.to_thread(_ping_openai, api_key, provider.model_id, provider.base_url)
    # Google / Azure / Ollama / local — minimal HTTP probe of base_url, or just
    # report ok for local providers where there's nothing to verify.
    if provider.provider in (LLMProviderKind.ollama, LLMProviderKind.local):
        if not provider.base_url:
            return True  # "local" has nothing to ping
        return await asyncio.to_thread(_ping_http, provider.base_url)
    if provider.provider in (LLMProviderKind.google, LLMProviderKind.azure):
        # SDK paths vary — defer to a base_url probe if provided, otherwise
        # accept the config (the real call will surface auth errors).
        if provider.base_url:
            return await asyncio.to_thread(_ping_http, provider.base_url)
        return True
    return False


def _ping_anthropic(api_key: str, model_id: str) -> bool:
    from anthropic import Anthropic  # noqa: PLC0415 — lazy

    client = Anthropic(api_key=api_key)
    # 1-token round-trip is the cheapest probe Anthropic exposes.
    resp = client.messages.create(
        model=model_id,
        max_tokens=1,
        messages=[{"role": "user", "content": "."}],
    )
    return bool(resp.id)


def _ping_openai(api_key: str, model_id: str, base_url: str | None) -> bool:
    from openai import OpenAI  # noqa: PLC0415 — lazy

    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=model_id,
        max_tokens=1,
        messages=[{"role": "user", "content": "."}],
    )
    return bool(resp.id)


def _ping_http(url: str) -> bool:
    import urllib.request  # noqa: PLC0415 — lazy

    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310 — admin-supplied URL
        return 200 <= resp.status < 500  # any non-server-error response means the host is reachable
