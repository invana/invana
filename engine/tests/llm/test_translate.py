"""NL → grounded query translation tests (RFC-030).

``render_model_context`` is a pure function (no external deps). ``nl_to_query``
runs against a real local Ollama and skips when it is not reachable.
"""

from __future__ import annotations

import os

import httpx
import pytest

from invana.llm import LLMError
from invana.llm.grounding import render_model_context
from invana.llm.translate import nl_to_query
from invana.llm_providers.models import LLMProvider, LLMProviderKind
from invana.modeller.models import (
    EdgeTypeDefinition,
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
)

_OLLAMA_URL = os.environ.get("INVANA_TEST_OLLAMA_URL", "http://localhost:11434")
_DEV_MODEL = os.environ.get("INVANA_TEST_OLLAMA_MODEL", "qwen3-coder:30b")


def _ollama_up() -> bool:
    try:
        httpx.get(_OLLAMA_URL.rstrip("/") + "/api/tags", timeout=3.0)
        return True
    except Exception:
        return False


def _person_project_version() -> GraphVersion:
    """An in-memory, fully-populated version (no DB) for grounding/translation."""
    name = PropertyKeyDefinition(name="name", type="string")
    title = PropertyKeyDefinition(name="title", type="string")
    person = NodeTypeDefinition(name="Person")
    person.property_mappings = [TypePropertyMapping(property_key=name)]
    project = NodeTypeDefinition(name="Project")
    project.property_mappings = [TypePropertyMapping(property_key=title)]
    works_on = EdgeTypeDefinition(name="WORKS_ON", source_node_types=["Person"], target_node_types=["Project"])
    works_on.property_mappings = []
    version = GraphVersion()
    version.node_types = [person, project]
    version.edge_types = [works_on]
    version.property_keys = [name, title]
    return version


def test_render_model_context_lists_types_and_props() -> None:
    text = render_model_context(_person_project_version())
    assert "(:Person {name:string})" in text
    assert "(:Project {title:string})" in text
    assert "[:WORKS_ON] (Person)->(Project)" in text


def test_render_model_context_handles_missing_version() -> None:
    assert "No graph model" in render_model_context(None)


@pytest.mark.skipif(not _ollama_up(), reason="local Ollama not reachable")
async def test_nl_to_query_grounds_and_returns_read_only_cypher() -> None:
    provider = LLMProvider(provider=LLMProviderKind.ollama, model_id=_DEV_MODEL, base_url=_OLLAMA_URL)
    generated = await nl_to_query(
        provider=provider,
        prompt="who works on which projects?",
        language="cypher",
        version=_person_project_version(),
        encryption_key="unused-no-key-for-ollama",
        timeout_s=180.0,
    )
    assert generated.language == "cypher"
    assert generated.read_only is True
    # grounded: it can only reference the types we gave it
    assert "Person" in generated.query and "Project" in generated.query
    low = generated.query.lower()
    assert not any(w in low for w in ("create ", "merge ", "delete ", "set "))


@pytest.mark.skipif(not _ollama_up(), reason="local Ollama not reachable")
async def test_nl_to_query_rejects_a_write_request() -> None:
    provider = LLMProvider(provider=LLMProviderKind.ollama, model_id=_DEV_MODEL, base_url=_OLLAMA_URL)
    with pytest.raises(LLMError):
        await nl_to_query(
            provider=provider,
            prompt="create a new Person named Alice and save it",
            language="cypher",
            version=_person_project_version(),
            encryption_key="unused",
            timeout_s=180.0,
        )
