"""NL → grounded query translation tests (docs/for-developers/modules/ask/features/ask-in-natural-language.md).

``render_model_context`` is a pure function (no external deps). ``nl_to_query``
runs against a real local Ollama and skips when it is not reachable.
"""

from __future__ import annotations

import os

import httpx
import pytest

from invana.apps.llm import LLMError
from invana.apps.llm.grounding import render_model_context
from invana.apps.llm.translate import _looks_read_only, nl_to_query
from invana.apps.llm_providers.models import LLMProviderKind
from invana.apps.modeller.models import (
    EdgeTypeDefinition,
    GraphVersion,
    NodeTypeDefinition,
    PropertyKeyDefinition,
    TypePropertyMapping,
)
from tests.llm.endpoints import endpoint

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
    provider = endpoint(LLMProviderKind.ollama, _DEV_MODEL, base_url=_OLLAMA_URL)
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
    provider = endpoint(LLMProviderKind.ollama, _DEV_MODEL, base_url=_OLLAMA_URL)
    with pytest.raises(LLMError):
        await nl_to_query(
            provider=provider,
            prompt="create a new Person named Alice and save it",
            language="cypher",
            version=_person_project_version(),
            encryption_key="unused",
            timeout_s=180.0,
        )


# ── the read-only guard ──────────────────────────────────────────────────────
#
# A pure function, so it needs no provider. The reads below are the ones that
# were refused in the field: `offset`, `dataset` and `asset` all end in the
# letters `set`, a read-only `CALL { … }` subquery is not a write, and a literal
# is text the graph never executes.


@pytest.mark.parametrize(
    "query",
    [
        "MATCH (a:airport) RETURN a.code ORDER BY a.code OFFSET 10 LIMIT 3",
        "MATCH (d:Dataset) RETURN d.dataset AS name",
        "MATCH (n) RETURN n.asset AS asset LIMIT 5",
        "CALL { MATCH (a:airport) RETURN count(a) AS n } RETURN n",
        "MATCH (a:Article) WHERE a.title CONTAINS 'merge ' RETURN a",
        "MATCH (n) RETURN n.created_at ORDER BY n.created_at DESC",
    ],
)
def test_reads_are_not_mistaken_for_writes(query: str) -> None:
    assert _looks_read_only(query, "cypher") is True


@pytest.mark.parametrize(
    "query",
    [
        "CREATE (n:Foo)",
        # No space after the clause — the old trailing-space markers missed these.
        "CREATE(n:Foo)",
        "MERGE(n:Foo)",
        "MATCH (n) SET n.x = 1",
        "MATCH (n) DETACH DELETE n",
        "MATCH (n) REMOVE n:Label",
        "DROP INDEX foo",
        "LOAD CSV FROM 'f.csv' AS row RETURN row",
        # A subquery that writes says so inside the braces.
        "CALL { MATCH (n) DELETE n } RETURN 1",
        "MATCH (n) FOREACH (x IN [1] | SET n.y = x)",
    ],
)
def test_writes_are_refused(query: str) -> None:
    assert _looks_read_only(query, "cypher") is False
