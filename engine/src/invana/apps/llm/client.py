"""Provider-agnostic LLM client (docs/for-developers/modules/agents/features/providers-and-models.md).

``complete_tool`` turns (provider config, system prompt, messages, a JSON
schema) into a *validated structured object*, dispatching by
``LLMProvider.provider``. Anthropic uses forced tool use; Ollama uses native
JSON-schema ``format``; the Claude Agent SDK uses its ``output_format``
json_schema mode. On a schema miss it does one corrective round-trip,
then raises ``LLMError``. Other providers (openai / local / google / azure) are
not wired for generation yet and raise a clear ``LLMError``.

This is a library, not a route: it emits no events and owns no DB state — its
consumers (docs/for-developers/modules/ask/features/ask-in-natural-language.md translation,
docs/for-developers/modules/ask/spec.md modeller proposals, the L6 agent loop)
own those.
"""

from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable
from contextlib import nullcontext

from invana.apps.graphs.encryption import decrypt_credentials
from invana.apps.llm.defaults import DEFAULT_MODEL_ID
from invana.apps.llm.errors import LLMError
from invana.apps.llm.providers import anthropic as anthropic_provider
from invana.apps.llm.providers import claude_agent_sdk as claude_agent_sdk_provider
from invana.apps.llm.providers import ollama as ollama_provider
from invana.apps.llm.providers import openai as openai_provider
from invana.apps.llm.schemas import Exchange, TokenUsage, ToolResult
from invana.apps.llm_providers.models import LLMProvider, LLMProviderKind
from invana.core.telemetry.recorders import add_llm_in_flight, record_llm_request

# OpenTelemetry lives in the optional ``telemetry`` extra (docs/for-developers/modules/platform/features/telemetry.md ·
# docs/for-developers/modules/platform/features/telemetry.md); the LLM
# client must import cleanly without it. Resolve a tracer lazily and fall back to
# no-op spans — mirrors the graph connector's pattern so the NL translate step
# shows up in the same FE→BE trace as the query execution.
try:
    from opentelemetry import trace as _otel_trace

    _tracer = _otel_trace.get_tracer("invana.llm")
except ImportError:  # telemetry extra not installed
    _tracer = None


def _llm_span(name: str):
    """Start an OTel span for an LLM stage, or a no-op when telemetry is absent."""
    if _tracer is None:
        return nullcontext(None)
    return _tracer.start_as_current_span(name)


_Dispatch = Callable[..., Awaitable[tuple[dict | None, TokenUsage]]]

# Wired today: keyless local dev (ollama), production (anthropic), the
# OpenAI-compatible path (openai = first-party OpenAI; local = any
# OpenAI-compatible server reached via base_url, e.g. LM Studio / vLLM), and
# Claude through the local Claude Code CLI (claude_agent_sdk,
# docs/for-developers/modules/agents/features/providers-and-models.md).
# google / azure still raise a clear error until a consumer needs them
# (docs/for-developers/modules/agents/features/providers-and-models.md).
_DISPATCH: dict[LLMProviderKind, _Dispatch] = {
    LLMProviderKind.ollama: ollama_provider.call,
    LLMProviderKind.anthropic: anthropic_provider.call,
    LLMProviderKind.openai: openai_provider.call,
    LLMProviderKind.local: openai_provider.call,
    LLMProviderKind.claude_agent_sdk: claude_agent_sdk_provider.call,
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
    operation: str = "generate",
) -> ToolResult:
    """Force a schema-valid structured object from ``provider``.

    ``operation`` labels the calling surface (``translate`` / ``propose``) on the
    ``invana.apps.llm.*`` metrics (docs/for-developers/modules/operate/features/observability.md); it doesn't affect
    behaviour.

    Raises ``LLMError`` (user-facing message) on config, transport, or
    validation failure — nothing else escapes.
    """
    dispatch = _DISPATCH.get(provider.provider)
    if dispatch is None:
        raise LLMError(
            f"LLM provider '{provider.provider.value}' is not wired for generation yet "
            "— use 'ollama' (local, no key), 'anthropic', or 'claude_agent_sdk'."
        )

    model_id = provider.model_id or DEFAULT_MODEL_ID.get(provider.provider, "")
    if not model_id:
        raise LLMError("No model is configured for this LLM provider.")

    api_key = _decrypt(provider.api_key_encrypted, encryption_key) if provider.api_key_encrypted else None
    credential_kind = provider.credential_kind.value if provider.credential_kind else None
    required = list(tool_schema.get("required", []))

    # Accumulate wall-clock across both the initial call and any repair retry, so
    # the reported LLM time covers everything the turn actually spent talking to
    # the provider — not just the last attempt.
    provider_name = provider.provider.value
    start = time.perf_counter()
    obj, usage = await _invoke(
        dispatch,
        model_id,
        api_key,
        provider.base_url,
        system,
        messages,
        tool_schema,
        tool_name,
        timeout_s,
        credential_kind=credential_kind,
        provider_name=provider_name,
        operation=operation,
    )
    if _valid(obj, required):
        return ToolResult(
            input=obj,
            usage=usage,
            exchange=_exchange(system, messages, obj),
            duration_ms=(time.perf_counter() - start) * 1000,
        )

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
        dispatch,
        model_id,
        api_key,
        provider.base_url,
        system,
        repair,
        tool_schema,
        tool_name,
        timeout_s,
        credential_kind=credential_kind,
        provider_name=provider_name,
        operation=operation,
    )
    usage = TokenUsage(
        input_tokens=usage.input_tokens + usage2.input_tokens,
        output_tokens=usage.output_tokens + usage2.output_tokens,
    )
    if _valid(obj2, required):
        # The **repaired** prompt, because that is the one that produced this
        # answer. Recording the first would show a reader a call that failed.
        return ToolResult(
            input=obj2,
            usage=usage,
            exchange=_exchange(system, repair, obj2),
            duration_ms=(time.perf_counter() - start) * 1000,
        )

    raise LLMError("The model did not return a valid structured result.")


#: What one side of an exchange may carry on a trace row. Generous enough for a
#: grounded system prompt, short of the size where a row stops being readable.
_EXCHANGE_CHARS = 12_000


def _cut(text: str) -> str:
    """Truncate, and **say so in the text** — a silent cut reads as a short prompt."""
    if len(text) <= _EXCHANGE_CHARS:
        return text
    dropped = len(text) - _EXCHANGE_CHARS
    return f"{text[:_EXCHANGE_CHARS]}\n… truncated · {dropped:,} more characters"


def _exchange(system: str, messages: list[dict], obj: dict | None) -> Exchange:
    """The call as a reader reads it: the system prompt, then the turns, then the answer.

    Assembled here, from what was actually sent, rather than reconstructed by a
    caller later — a reconstruction is a guess about what the model saw.
    """
    parts = [f"<system>\n{system}"] if system else []
    parts += [f"<{m.get('role', 'user')}>\n{m.get('content', '')}" for m in messages]
    return Exchange(
        prompt=_cut("\n\n".join(parts)),
        completion=_cut(json.dumps(obj, indent=2, ensure_ascii=False) if obj is not None else ""),
    )


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
    *,
    credential_kind: str | None,
    provider_name: str,
    operation: str,
) -> tuple[dict | None, TokenUsage]:
    # One provider round-trip = one span + one metric sample. The corrective
    # retry is a second call here, so it lands as a second sample — keeping the
    # ``invana.apps.llm.request.duration`` histogram aligned with the ``llm.generate``
    # span (docs/for-developers/modules/operate/features/observability.md).
    add_llm_in_flight(1, provider=provider_name, model_id=model_id, operation=operation)
    start = time.perf_counter()
    with _llm_span("llm.generate") as span:
        if span is not None:
            span.set_attribute("invana.llm.model_id", model_id)
        try:
            obj, usage = await dispatch(
                model_id=model_id,
                api_key=api_key,
                base_url=base_url,
                system=system,
                messages=messages,
                tool_schema=tool_schema,
                tool_name=tool_name,
                timeout_s=timeout_s,
                credential_kind=credential_kind,
            )
        except LLMError:
            record_llm_request(
                provider=provider_name,
                model_id=model_id,
                operation=operation,
                duration_ms=(time.perf_counter() - start) * 1000,
                status="failed",
                error_type="LLMError",
            )
            raise
        except Exception as exc:  # normalize transport/SDK failures
            record_llm_request(
                provider=provider_name,
                model_id=model_id,
                operation=operation,
                duration_ms=(time.perf_counter() - start) * 1000,
                status="failed",
                error_type=type(exc).__name__,
            )
            raise LLMError(f"The LLM provider call failed: {exc}") from exc
        finally:
            add_llm_in_flight(-1, provider=provider_name, model_id=model_id, operation=operation)
        if span is not None:
            span.set_attribute("invana.llm.input_tokens", usage.input_tokens)
            span.set_attribute("invana.llm.output_tokens", usage.output_tokens)
        record_llm_request(
            provider=provider_name,
            model_id=model_id,
            operation=operation,
            duration_ms=(time.perf_counter() - start) * 1000,
            status="success",
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )
        return obj, usage


def _decrypt(token: bytes, key: str) -> str:
    payload = decrypt_credentials(token, key)
    raw = payload.get("api_key")
    if not isinstance(raw, str):
        raise LLMError("Stored LLM credentials are malformed.")
    return raw


def _valid(obj: dict | None, required: list[str]) -> bool:
    return isinstance(obj, dict) and all(key in obj for key in required)
