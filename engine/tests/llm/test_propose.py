"""NL → model proposal tests (RFC-031).

``validate_proposal`` is pure (no external deps). ``propose_model`` runs against
a real local Ollama and skips when it is not reachable (repo rule 7 — real
services, no mocks).
"""

from __future__ import annotations

import os

import httpx
import pytest

from invana.llm import LLMError
from invana.llm.propose import ModelProposal, propose_model, validate_proposal
from invana.llm.schemas import TokenUsage
from invana.llm_providers.models import LLMProvider, LLMProviderKind

_OLLAMA_URL = os.environ.get("INVANA_TEST_OLLAMA_URL", "http://localhost:11434")
_DEV_MODEL = os.environ.get("INVANA_TEST_OLLAMA_MODEL", "qwen3-coder:30b")


def _ollama_up() -> bool:
    try:
        httpx.get(_OLLAMA_URL.rstrip("/") + "/api/tags", timeout=3.0)
        return True
    except Exception:
        return False


def _proposal(node_types, edge_types) -> ModelProposal:
    return ModelProposal(node_types=node_types, edge_types=edge_types, summary="m", usage=TokenUsage())


def test_validate_accepts_self_contained_proposal() -> None:
    validate_proposal(
        _proposal(
            node_types=[
                {"name": "Person", "description": "", "property_keys": [{"name": "name", "type": "string"}]},
                {"name": "Project", "description": "", "property_keys": []},
            ],
            edge_types=[
                {
                    "name": "WORKS_ON",
                    "description": "",
                    "source_node_types": ["Person"],
                    "target_node_types": ["Project"],
                    "property_keys": [],
                }
            ],
        ),
        existing_node_type_names=set(),
    )


def test_validate_resolves_endpoint_against_existing_types() -> None:
    # The target is not in the proposal but already exists in the draft — allowed.
    validate_proposal(
        _proposal(
            node_types=[{"name": "Company", "description": "", "property_keys": []}],
            edge_types=[
                {
                    "name": "WORKS_AT",
                    "description": "",
                    "source_node_types": ["Person"],
                    "target_node_types": ["Company"],
                    "property_keys": [],
                }
            ],
        ),
        existing_node_type_names={"Person"},
    )


def test_validate_rejects_unknown_endpoint() -> None:
    with pytest.raises(LLMError):
        validate_proposal(
            _proposal(
                node_types=[{"name": "Person", "description": "", "property_keys": []}],
                edge_types=[
                    {
                        "name": "WORKS_ON",
                        "description": "",
                        "source_node_types": ["Person"],
                        "target_node_types": ["Ghost"],
                        "property_keys": [],
                    }
                ],
            ),
            existing_node_type_names=set(),
        )


def test_validate_rejects_unsupported_property_type() -> None:
    with pytest.raises(LLMError):
        validate_proposal(
            _proposal(
                node_types=[
                    {"name": "Person", "description": "", "property_keys": [{"name": "avatar", "type": "blob"}]}
                ],
                edge_types=[],
            ),
            existing_node_type_names=set(),
        )


@pytest.mark.skipif(not _ollama_up(), reason="local Ollama not reachable")
async def test_propose_model_builds_people_and_projects() -> None:
    provider = LLMProvider(provider=LLMProviderKind.ollama, model_id=_DEV_MODEL, base_url=_OLLAMA_URL)
    result = await propose_model(
        provider=provider,
        prompt="build a model of people and the projects they work on, with some generic properties",
        version=None,
        encryption_key="unused-no-key-for-ollama",
        timeout_s=180.0,
    )
    assert isinstance(result, ModelProposal)
    # Structural invariants only — exact labels vary by model run.
    assert len(result.node_types) >= 2
    assert len(result.edge_types) >= 1
    # The proposal must be referentially sound (an edge can only point at a
    # proposed/existing node type).
    validate_proposal(result, existing_node_type_names=set())
