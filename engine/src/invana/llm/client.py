"""Provider-agnostic LLM client (RFC-032).

``complete_tool`` turns (provider config, system prompt, messages, a JSON
schema) into a *validated structured object*, dispatching by
``LLMProvider.provider``. Anthropic uses forced tool use; Ollama uses native
JSON-schema ``format``. On a schema miss it does one corrective round-trip,
then raises ``LLMError``. Other providers (openai / local / google / azure) are
not wired for generation yet and raise a clear ``LLMError``.

This is a library, not a route: it emits no events and owns no DB state — its
consumers (RFC-030 translation, RFC-031 modeller proposals, the L6 agent loop)
own those.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from invana.graphs.encryption import decrypt_credentials
from invana.llm.defaults import DEFAULT_MODEL_ID
from invana.llm.errors import LLMError
from invana.llm.providers import anthropic as anthropic_provider
from invana.llm.providers import ollama as ollama_provider
from invana.llm.schemas import TokenUsage, ToolResult
from invana.llm_providers.models import LLMProvider, LLMProviderKind

_Dispatch = Callable[..., Awaitable[tuple[dict | None, TokenUsage]]]

# Wired today: keyless local dev (ollama) + production (anthropic). The rest
# raise a clear error until a consumer needs them (RFC-032 § Decision 3).
_DISPATCH: dict[LLMProviderKind, _Dispatch] = {
    LLMProviderKind.ollama: ollama_provider.call,
    LLMProviderKind.anthropic: anthropic_provider.call,
}


async def complete_tool(
    *,
    provider: LLMProvider,
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,
    encryption_key: str,
    timeout_s: float = 60.0,
) -> ToolResult:
    """Force a schema-valid structured object from ``provider``.

    Raises ``LLMError`` (user-facing message) on config, transport, or
    validation failure — nothing else escapes.
    """
    dispatch = _DISPATCH.get(provider.provider)
    if dispatch is None:
        raise LLMError(
            f"LLM provider '{provider.provider.value}' is not wired for generation yet "
            "— use 'ollama' (local, no key) or 'anthropic'."
        )

    model_id = provider.model_id or DEFAULT_MODEL_ID.get(provider.provider, "")
    if not model_id:
        raise LLMError("No model is configured for this LLM provider.")

    api_key = _decrypt(provider.api_key_encrypted, encryption_key) if provider.api_key_encrypted else None
    required = list(tool_schema.get("required", []))

    obj, usage = await _invoke(
        dispatch, model_id, api_key, provider.base_url, system, messages, tool_schema, tool_name, timeout_s
    )
    if _valid(obj, required):
        return ToolResult(input=obj, usage=usage)

    # One corrective round-trip, then give up (no unbounded retries).
    repair = [
        *messages,
        {
            "role": "user",
            "content": "Your previous reply did not satisfy the required schema. "
            "Reply again with only a value that matches it.",
        },
    ]
    obj2, usage2 = await _invoke(
        dispatch, model_id, api_key, provider.base_url, system, repair, tool_schema, tool_name, timeout_s
    )
    usage = TokenUsage(
        input_tokens=usage.input_tokens + usage2.input_tokens,
        output_tokens=usage.output_tokens + usage2.output_tokens,
    )
    if _valid(obj2, required):
        return ToolResult(input=obj2, usage=usage)

    raise LLMError("The model did not return a valid structured result.")


async def _invoke(
    dispatch: _Dispatch,
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
        return await dispatch(
            model_id=model_id,
            api_key=api_key,
            base_url=base_url,
            system=system,
            messages=messages,
            tool_schema=tool_schema,
            tool_name=tool_name,
            timeout_s=timeout_s,
        )
    except LLMError:
        raise
    except Exception as exc:  # normalize transport/SDK failures
        raise LLMError(f"The LLM provider call failed: {exc}") from exc


def _decrypt(token: bytes, key: str) -> str:
    payload = decrypt_credentials(token, key)
    raw = payload.get("api_key")
    if not isinstance(raw, str):
        raise LLMError("Stored LLM credentials are malformed.")
    return raw


def _valid(obj: dict | None, required: list[str]) -> bool:
    return isinstance(obj, dict) and all(key in obj for key in required)
