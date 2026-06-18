"""OpenAI-compatible provider — the path for OpenAI and local OpenAI-style servers.

Covers first-party OpenAI *and* any OpenAI-compatible endpoint reached via
``base_url`` (LM Studio, vLLM, LocalAI, …). Structured output uses
``response_format`` with a JSON Schema — the OpenAI-compatible analogue of
Ollama's ``format`` — so ``message.content`` comes back as schema-shaped JSON we
load directly. ``strict`` is left off: the caller's schema isn't guaranteed to
satisfy OpenAI strict mode (``additionalProperties: false`` + every key
required), and local engines (LM Studio) enforce the schema via their own
grammar regardless.

The ``openai`` SDK is an **optional** dependency, lazy-imported here so the
engine installs and every other provider runs without it — only selecting this
provider for generation requires ``pip install openai``.

No API key is required for local servers; LM Studio ignores it, but the SDK
demands a non-empty string, so we fall back to a harmless placeholder.

Reasoning models (e.g. qwen3) served via LM Studio may emit the schema-shaped
object on ``message.reasoning_content`` with an empty ``message.content`` — we
fall back to it, and tolerate a leading ``<think>…</think>`` block, so the
structured result survives either layout.
"""

from __future__ import annotations

import json
import re

from invana.llm.errors import LLMError
from invana.llm.schemas import TokenUsage

# LM Studio (and other keyless local servers) ignore the key, but AsyncOpenAI
# refuses to construct without one. Any non-empty string works.
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
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise LLMError(
            "The 'openai' package is required for the openai/local provider but is not installed. "
            "Install it in the engine environment: `uv pip install openai` (or `pip install openai`)."
        ) from exc

    client = AsyncOpenAI(api_key=api_key or _PLACEHOLDER_KEY, base_url=base_url or None, timeout=timeout_s)
    resp = await client.chat.completions.create(
        model=model_id,
        temperature=0,
        response_format={
            "type": "json_schema",
            "json_schema": {"name": tool_name, "schema": tool_schema},
        },
        messages=[{"role": "system", "content": system}, *messages],
    )

    usage_obj = resp.usage
    usage = TokenUsage(
        input_tokens=int(getattr(usage_obj, "prompt_tokens", 0) or 0),
        output_tokens=int(getattr(usage_obj, "completion_tokens", 0) or 0),
    )

    message = resp.choices[0].message if resp.choices else None
    return _parse(message), usage


def _parse(message) -> dict | None:
    """Pull the schema-shaped object from ``content``, or a reasoning channel."""
    if message is None:
        return None
    raw = message.content
    if not (raw and raw.strip()):
        # Reasoning models (qwen3 on LM Studio) put the constrained JSON here.
        raw = getattr(message, "reasoning_content", None)
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
