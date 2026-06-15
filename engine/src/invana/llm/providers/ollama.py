"""Ollama provider — the keyless local/dev path.

Calls Ollama's native chat endpoint with structured outputs: ``format`` set to
a JSON Schema constrains the reply to a schema-valid object server-side, so the
returned ``message.content`` is JSON we can load directly. No API key — only a
``base_url`` (default ``http://localhost:11434``). This is the path the test
suite exercises (real Ollama, no mocks) and the documented dev default.
"""

from __future__ import annotations

import json

import httpx

from invana.llm.schemas import TokenUsage

_DEFAULT_BASE_URL = "http://localhost:11434"


async def call(
    *,
    model_id: str,
    api_key: str | None,  # unused — Ollama needs no key
    base_url: str | None,
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,  # unused — structured output is via `format`, not a named tool
    timeout_s: float,
) -> tuple[dict | None, TokenUsage]:
    url = (base_url or _DEFAULT_BASE_URL).rstrip("/") + "/api/chat"
    payload = {
        "model": model_id,
        "stream": False,
        "format": tool_schema,
        "options": {"temperature": 0},
        "messages": [{"role": "system", "content": system}, *messages],
    }
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    usage = TokenUsage(
        input_tokens=int(data.get("prompt_eval_count") or 0),
        output_tokens=int(data.get("eval_count") or 0),
    )
    content = data.get("message", {}).get("content", "")
    try:
        obj = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return None, usage
    return (obj if isinstance(obj, dict) else None), usage
