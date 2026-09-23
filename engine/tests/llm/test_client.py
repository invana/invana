"""LLM runtime tests (docs/for-developers/modules/agents/features/providers-and-models.md).

Per repo rule 7 (real services, no mocks) and to keep CI keyless, the positive
path runs against a **real local Ollama** and skips cleanly when it is not
reachable. The negative path (an unwired provider) is deterministic and needs
nothing external.
"""

from __future__ import annotations

import os

import httpx
import pytest

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.providers.claude_agent_sdk import flatten_messages
from invana.apps.llm_providers.models import LLMProviderKind
from tests.llm.endpoints import endpoint

_OLLAMA_URL = os.environ.get("INVANA_TEST_OLLAMA_URL", "http://localhost:11434")
_DEV_MODEL = os.environ.get("INVANA_TEST_OLLAMA_MODEL", "qwen3-coder:30b")

_SCHEMA = {
    "type": "object",
    "properties": {
        "query": {"type": "string"},
        "language": {"type": "string", "enum": ["cypher", "gremlin"]},
        "read_only": {"type": "boolean"},
        "rationale": {"type": "string"},
    },
    "required": ["query", "language", "read_only", "rationale"],
}

_SYSTEM = (
    "Translate the question into a read-only Cypher query for a graph whose node "
    "types are Person(name) and Project(title) and whose edge type is "
    "WORKS_ON(Person->Project). Use only those types."
)


def _ollama_up() -> bool:
    try:
        httpx.get(_OLLAMA_URL.rstrip("/") + "/api/tags", timeout=3.0)
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _ollama_up(), reason="local Ollama not reachable")
async def test_complete_tool_ollama_returns_schema_valid_object() -> None:
    provider = endpoint(LLMProviderKind.ollama, _DEV_MODEL, base_url=_OLLAMA_URL)
    result = await complete_tool(
        provider=provider,
        system=_SYSTEM,
        messages=[{"role": "user", "content": "who works on which projects?"}],
        tool_schema=_SCHEMA,
        tool_name="submit_query",
        encryption_key="unused-no-key-for-ollama",
        timeout_s=180.0,
    )
    assert {"query", "language", "read_only", "rationale"} <= set(result.input)
    assert result.input["language"] in ("cypher", "gremlin")
    assert isinstance(result.input["read_only"], bool)
    assert result.usage.output_tokens > 0


async def test_complete_tool_unwired_provider_raises() -> None:
    provider = endpoint(LLMProviderKind.google, "whatever")
    with pytest.raises(LLMError):
        await complete_tool(
            provider=provider,
            system="x",
            messages=[{"role": "user", "content": "x"}],
            tool_schema=_SCHEMA,
            tool_name="submit_query",
            encryption_key="unused",
        )


# ---------------------------------------------------------------------------
# Claude Agent SDK provider (docs/for-developers/modules/agents/features/providers-and-models.md)
# ---------------------------------------------------------------------------


def test_flatten_messages_passes_single_user_turn_through_and_renders_history() -> None:
    assert flatten_messages([{"role": "user", "content": "who works where?"}]) == "who works where?"
    history = [
        {"role": "user", "content": "first"},
        {"role": "assistant", "content": "reply"},
        {"role": "user", "content": "second"},
    ]
    assert flatten_messages(history) == "User: first\n\nAssistant: reply\n\nUser: second"


@pytest.mark.skipif(
    os.environ.get("INVANA_TEST_CLAUDE_AGENT_SDK") != "1",
    reason="set INVANA_TEST_CLAUDE_AGENT_SDK=1 (needs claude-agent-sdk + a logged-in Claude Code CLI)",
)
async def test_complete_tool_claude_agent_sdk_returns_schema_valid_object() -> None:
    provider = endpoint(
        LLMProviderKind.claude_agent_sdk,
        os.environ.get("INVANA_TEST_CLAUDE_AGENT_SDK_MODEL", "claude-opus-5"),
    )
    result = await complete_tool(
        provider=provider,
        system=_SYSTEM,
        messages=[{"role": "user", "content": "who works on which projects?"}],
        tool_schema=_SCHEMA,
        tool_name="submit_query",
        encryption_key="unused-no-key-uses-cli-login",
        timeout_s=180.0,
    )
    assert {"query", "language", "read_only", "rationale"} <= set(result.input)
    assert result.input["language"] in ("cypher", "gremlin")
