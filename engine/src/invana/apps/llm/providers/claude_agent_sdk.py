"""Claude Agent SDK provider — Claude through the local Claude Code CLI
(docs/for-developers/modules/agents/features/providers-and-models.md,
docs/for-developers/modules/agents/features/providers-and-models.md).

Drives Anthropic's ``claude-agent-sdk`` (a subprocess harness around the Claude
Code CLI) as a *generation-only* backend: no tools, no filesystem settings, one
structured completion. Credentials are resolved by the SDK itself — a secret
stored on the provider row is injected as ``ANTHROPIC_API_KEY`` (an API key) or
``CLAUDE_CODE_OAUTH_TOKEN`` (a ``claude setup-token`` subscription token, per
the row's ``credential_kind`` — docs/for-developers/modules/agents/features/providers-and-models.md); when the row has
neither, the CLI's
own login is used. Invana never touches that login.

Structured output uses the SDK's ``output_format`` json_schema mode, so the
``ResultMessage.structured_output`` *is* the schema-shaped result. The SDK is
lazy-imported (optional dependency, like ``anthropic``) and ``query()`` is
natively async, so no thread hop is needed.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from invana.apps.llm.errors import LLMError
from invana.apps.llm.schemas import TokenUsage

_INSTALL_HINT = "Install it with `pip install claude-agent-sdk` and make sure the Claude Code CLI is on PATH."


def flatten_messages(messages: list[dict]) -> str:
    """Render a chat history as one prompt string.

    ``query()`` takes a single prompt (its streaming form models *live* user
    turns, not a replayed assistant history), so a multi-message history is
    rendered as a ``User:`` / ``Assistant:`` transcript ending with the final
    user turn. A lone user message is passed through untouched.
    """
    if len(messages) == 1:
        return str(messages[0].get("content", ""))
    lines: list[str] = []
    for message in messages:
        role = "Assistant" if message.get("role") == "assistant" else "User"
        lines.append(f"{role}: {message.get('content', '')}")
    return "\n\n".join(lines)


def _build_options(
    *,
    model_id: str,
    api_key: str | None,
    credential_kind: str | None = None,
    system: str,
    tool_schema: dict,
    timeout_s: float,
    max_turns: int | None,
):
    from claude_agent_sdk import ClaudeAgentOptions

    env: dict[str, str] = {"API_TIMEOUT_MS": str(int(timeout_s * 1000))}
    if api_key:
        # docs/for-developers/modules/agents/features/providers-and-models.md: a row's credential is either a Claude API
        # key or a
        # `claude setup-token` subscription token — they're different auth
        # mechanisms with different env vars, not interchangeable. Anything
        # other than the explicit "oauth_token" kind keeps the original
        # ANTHROPIC_API_KEY behavior.
        env_var = "CLAUDE_CODE_OAUTH_TOKEN" if credential_kind == "oauth_token" else "ANTHROPIC_API_KEY"
        env[env_var] = api_key
    return ClaudeAgentOptions(
        model=model_id,
        system_prompt=system,
        output_format={"type": "json_schema", "schema": tool_schema},
        # Generation only: no built-in tools, no ~/.claude or project settings,
        # nothing to ask permission for.
        tools=[],
        setting_sources=[],
        permission_mode="dontAsk",
        cwd=Path.cwd(),
        env=env,
        max_turns=max_turns,
    )


async def _run(prompt: str, options) -> tuple[dict | None, TokenUsage, str | None]:
    """Iterate ``query()`` to its ``ResultMessage``; return (output, usage, error)."""
    from claude_agent_sdk import ResultMessage, query

    async for message in query(prompt=prompt, options=options):
        if not isinstance(message, ResultMessage):
            continue
        usage_obj = message.usage or {}
        # The CLI prompt-caches the system prompt, so ``input_tokens`` alone is
        # only the uncached remainder; fold the cache reads/writes back in so the
        # count reflects what the model actually consumed.
        input_tokens = sum(
            int(usage_obj.get(k) or 0)
            for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")
        )
        usage = TokenUsage(input_tokens=input_tokens, output_tokens=int(usage_obj.get("output_tokens") or 0))
        if message.is_error:
            detail = message.result or (message.errors[0] if message.errors else None) or message.subtype
            return None, usage, str(detail)
        out = message.structured_output
        return (out if isinstance(out, dict) else None), usage, None
    return None, TokenUsage(input_tokens=0, output_tokens=0), "The Claude Agent SDK returned no result."


async def call(
    *,
    model_id: str,
    api_key: str | None,
    base_url: str | None,  # unused — the CLI owns its endpoint
    system: str,
    messages: list[dict],
    tool_schema: dict,
    tool_name: str,  # unused — structured output is via `output_format`, not a named tool
    timeout_s: float,
    # docs/for-developers/modules/agents/features/providers-and-models.md — "oauth_token" or None/"api_key"
    credential_kind: str | None = None,
) -> tuple[dict | None, TokenUsage]:
    try:
        from claude_agent_sdk import CLINotFoundError
    except ImportError as exc:
        raise LLMError(f"The Claude Agent SDK is not installed. {_INSTALL_HINT}") from exc

    options = _build_options(
        model_id=model_id,
        api_key=api_key,
        credential_kind=credential_kind,
        system=system,
        tool_schema=tool_schema,
        timeout_s=timeout_s,
        max_turns=None,
    )
    try:
        obj, usage, error = await asyncio.wait_for(_run(flatten_messages(messages), options), timeout=timeout_s)
    except CLINotFoundError as exc:
        raise LLMError(f"The Claude Code CLI is not installed. {_INSTALL_HINT}") from exc
    except TimeoutError as exc:
        raise LLMError(f"The Claude Agent SDK call timed out after {timeout_s:.0f}s.") from exc
    if error is not None:
        raise LLMError(f"The Claude Agent SDK call failed: {error}")
    return obj, usage


async def ping(model_id: str, api_key: str | None, timeout_s: float, credential_kind: str | None = None) -> bool:
    """Credential probe: one single-turn call, success = a non-error result.

    Raises the SDK's own exceptions (missing package / CLI) so the ping service
    surfaces them verbatim.
    """
    options = _build_options(
        model_id=model_id,
        api_key=api_key,
        credential_kind=credential_kind,
        system="Reply with the single word ok.",
        tool_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]},
        timeout_s=timeout_s,
        max_turns=1,
    )
    _obj, _usage, error = await _run(".", options)
    if error is not None:
        raise RuntimeError(error)
    return True
