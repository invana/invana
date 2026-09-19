"""Per-provider credential ping — pure, and it takes no session.

Outside the `models · querysets · managers · schemas` vocabulary on purpose
(migration-plan §4.1): an algorithm, not a role. SDK calls run in a thread so
the caller stays async-friendly, and each SDK is lazy-imported so the engine
does not hard-depend on every one at install time.
"""

from __future__ import annotations

import asyncio

from invana.apps.llm_providers.models import LLMProvider, LLMProviderKind


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
    if provider.provider == LLMProviderKind.claude_agent_sdk:
        from invana.apps.llm.providers import claude_agent_sdk as claude_agent_sdk_provider

        # Natively async (subprocess harness); one single-turn call is the
        # cheapest probe the SDK exposes. Missing package / CLI raise and are
        # surfaced verbatim by ping_provider.
        return await claude_agent_sdk_provider.ping(
            provider.model_id, api_key, timeout_s=10.0, credential_kind=provider.credential_kind
        )
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
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    # 1-token round-trip is the cheapest probe Anthropic exposes.
    resp = client.messages.create(
        model=model_id,
        max_tokens=1,
        messages=[{"role": "user", "content": "."}],
    )
    return bool(resp.id)


def _ping_openai(api_key: str, model_id: str, base_url: str | None) -> bool:
    from openai import OpenAI

    client = OpenAI(api_key=api_key, base_url=base_url) if base_url else OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=model_id,
        max_tokens=1,
        messages=[{"role": "user", "content": "."}],
    )
    return bool(resp.id)


def _ping_http(url: str) -> bool:
    import urllib.request

    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return 200 <= resp.status < 500  # any non-server-error response means the host is reachable
