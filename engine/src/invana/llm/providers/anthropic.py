"""Anthropic provider — the production path (official ``anthropic`` SDK).

Structured output via forced tool use: one tool whose ``input_schema`` is the
caller's schema, with ``tool_choice`` pinned to it, so the model's tool-call
input *is* the validated result. The SDK is lazy-imported and the blocking call
runs in a thread (matches ``llm_providers/services.py::_ping_anthropic``).
"""

from __future__ import annotations

import asyncio

from invana.llm.errors import LLMError
from invana.llm.schemas import TokenUsage

# A forced single-tool JSON object is small; this is ample headroom without the
# long-output streaming requirement.
_MAX_TOKENS = 4096


def _sync_call(
    model_id: str,
    api_key: str,
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,
):
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    return client.messages.create(
        model=model_id,
        max_tokens=_MAX_TOKENS,
        system=system,
        messages=messages,
        tools=[
            {
                "name": tool_name,
                "description": f"Return the result as the {tool_name} structured object.",
                "input_schema": tool_schema,
            }
        ],
        tool_choice={"type": "tool", "name": tool_name},
    )


async def call(
    *,
    model_id: str,
    api_key: str | None,
    base_url: str | None,  # unused for first-party Anthropic
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,
    timeout_s: float,  # SDK manages its own timeout/retries
) -> tuple[dict | None, TokenUsage]:
    if not api_key:
        raise LLMError("The Anthropic provider requires an API key.")

    resp = await asyncio.to_thread(_sync_call, model_id, api_key, system, messages, tool_schema, tool_name)

    usage = TokenUsage(
        input_tokens=resp.usage.input_tokens,
        output_tokens=resp.usage.output_tokens,
    )
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == tool_name:
            return (block.input if isinstance(block.input, dict) else None), usage
    return None, usage
