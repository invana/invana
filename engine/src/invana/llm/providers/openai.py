"""OpenAI-compatible provider — the path for OpenAI and local OpenAI-style servers.

Covers first-party OpenAI *and* any OpenAI-compatible endpoint reached via
``base_url`` (LM Studio, vLLM, LocalAI, …). The call is a plain HTTP POST to
``/chat/completions`` via ``httpx`` — the same transport the Ollama provider
uses — so **no SDK is required**: neither the ``openai`` package nor any other
optional dependency. Structured output uses ``response_format`` with a JSON
Schema (the OpenAI-compatible analogue of Ollama's ``format``), so
``message.content`` comes back as schema-shaped JSON we load directly.
``strict`` is left off: the caller's schema isn't guaranteed to satisfy OpenAI
strict mode (``additionalProperties: false`` + every key required), and local
engines (LM Studio) enforce the schema via their own grammar regardless.

No API key is required for local servers; LM Studio ignores it, but some servers
reject a missing ``Authorization`` header, so we send a harmless placeholder.

Reasoning models (e.g. qwen3) served via LM Studio may emit the schema-shaped
object on ``message.reasoning_content`` with an empty ``message.content`` — we
fall back to it, and tolerate a leading ``<think>…</think>`` block, so the
structured result survives either layout.
"""

from __future__ import annotations

import json
import re

import httpx

from invana.llm.schemas import TokenUsage

# First-party OpenAI default; local/compatible servers supply their own base_url
# (already including the ``/v1`` suffix, e.g. ``http://localhost:1234/v1``).
_DEFAULT_BASE_URL = "https://api.openai.com/v1"

# LM Studio (and other keyless local servers) ignore the key, but some servers
# still want an Authorization header. Any non-empty string works.
_PLACEHOLDER_KEY = "not-needed"

# Reasoning models can prefix a <think>…</think> block before the JSON; strip it
# before parsing. DOTALL so it spans newlines.
_THINK_BLOCK = re.compile(r"<think>.*?</think>", re.DOTALL)


async def call(
    *,
    model_id: str,
    api_key: str | None,
    base_url: str | None,
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,
    timeout_s: float,
) -> tuple[dict | None, TokenUsage]:
    url = (base_url or _DEFAULT_BASE_URL).rstrip("/") + "/chat/completions"
    payload = {
        "model": model_id,
        "temperature": 0,
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": tool_name, "schema": tool_schema},
        },
        "messages": [{"role": "system", "content": system}, *messages],
    }
    headers = {"Authorization": f"Bearer {api_key or _PLACEHOLDER_KEY}"}
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    usage_obj = data.get("usage") or {}
    usage = TokenUsage(
        input_tokens=int(usage_obj.get("prompt_tokens") or 0),
        output_tokens=int(usage_obj.get("completion_tokens") or 0),
    )

    choices = data.get("choices") or []
    message = choices[0].get("message") if choices else None
    return _parse(message), usage


def _parse(message: dict | None) -> dict | None:
    """Pull the schema-shaped object from ``content``, or a reasoning channel."""
    if not isinstance(message, dict):
        return None
    raw = message.get("content")
    if not (isinstance(raw, str) and raw.strip()):
        # Reasoning models (qwen3 on LM Studio) put the constrained JSON here.
        raw = message.get("reasoning_content")
    if not isinstance(raw, str):
        return None

    text = _THINK_BLOCK.sub("", raw).strip()
    obj = _load_json(text)
    return obj if isinstance(obj, dict) else None


def _load_json(text: str) -> object | None:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        pass
    # Fall back to the outermost {...} span if the model wrapped it in prose.
    start, end = text.find("{"), text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return None
