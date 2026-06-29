"""Reconcile-into-draft tests (RFC-031) — real Postgres, no LLM, no mocks.

Exercises the load-bearing by-name diff + ordering of ``reconcile_proposal``
against a real draft version, and the referential-integrity pre-check
(``validate_proposal``) that guards a mutation. The LLM round-trip is covered
separately (Ollama-gated) in ``tests/llm/test_propose.py``.
"""

from __future__ import annotations

import pytest

from invana.llm import LLMError
from invana.llm.propose import ModelProposal, validate_proposal
from invana.llm.schemas import TokenUsage
from invana.modeller.store import ModelStore
from invana.sessions.reconcile import reconcile_proposal


def _proposal(node_types, edge_types, summary="m") -> ModelProposal:
    return ModelProposal(
        node_types=node_types,
        edge_types=edge_types,
        summary=summary,
        usage=TokenUsage(),
    )


async def _fresh_draft(session, graph):
    store = ModelStore()
    model = await store.create_graph_model(session, name="People", graph_id=graph.id, origin="studio")
    draft = await store.create_version(session, model_id=model.id)
    return store, model, await store.get_version(session, draft.id)


async def _reload(session, store, version_id):
    """Re-read a version with fresh collections.

    Production re-reads the draft in a *new* session per request; in a single
    test session the identity map holds the pre-mutation (empty) collections, so
    expire first to force a fresh load — mirroring what a new request sees.
    """
    session.expire_all()
    return await store.get_version(session, version_id)


async def test_reconcile_creates_types_and_keys(session, graph) -> None:
    store, _model, draft = await _fresh_draft(session, graph)
    proposal = _proposal(
        node_types=[
            {"name": "Person", "description": "", "property_keys": [{"name": "name", "type": "string"}]},
            {"name": "Project", "description": "", "property_keys": [{"name": "title", "type": "string"}]},
        ],
        edge_types=[
            {
                "name": "WORKS_ON",
                "description": "",
                "source_node_types": ["Person"],
                "target_node_types": ["Project"],
                "property_keys": [{"name": "role", "type": "string"}],
            }
        ],
    )
    validate_proposal(proposal, existing_node_type_names=set())
    counts = await reconcile_proposal(session, store=store, version=draft, proposal=proposal)

    assert counts == {"node_types": 2, "edge_types": 1, "property_keys": 3}
    reloaded = await _reload(session, store, draft.id)
    assert {nt.name for nt in reloaded.node_types} == {"Person", "Project"}
    assert {et.name for et in reloaded.edge_types} == {"WORKS_ON"}
    assert {pk.name for pk in reloaded.property_keys} == {"name", "title", "role"}


async def test_reconcile_refines_without_deleting(session, graph) -> None:
    """A follow-up adds a type + edge to the same draft; prior types stay intact."""
    store, _model, draft = await _fresh_draft(session, graph)
    await reconcile_proposal(
        session,
        store=store,
        version=draft,
        proposal=_proposal(
            node_types=[
                {"name": "Person", "description": "", "property_keys": [{"name": "name", "type": "string"}]},
                {"name": "Project", "description": "", "property_keys": []},
            ],
            edge_types=[],
        ),
    )

    refreshed = await _reload(session, store, draft.id)
    counts = await reconcile_proposal(
        session,
        store=store,
        version=refreshed,
        proposal=_proposal(
            node_types=[
                {"name": "Company", "description": "", "property_keys": [{"name": "industry", "type": "string"}]}
            ],
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
    )

    assert counts["node_types"] == 1 and counts["edge_types"] == 1
    final = await _reload(session, store, draft.id)
    assert {nt.name for nt in final.node_types} == {"Person", "Project", "Company"}
    assert {et.name for et in final.edge_types} == {"WORKS_AT"}


async def test_validate_rejects_unknown_endpoint_before_mutation(session, graph) -> None:
    """An edge referencing an undefined node type fails validation; nothing is written."""
    store, _model, draft = await _fresh_draft(session, graph)
    bad = _proposal(
        node_types=[{"name": "Person", "description": "", "property_keys": []}],
        edge_types=[
            {
                "name": "WORKS_ON",
                "description": "",
                "source_node_types": ["Person"],
                "target_node_types": ["Project"],  # never defined
                "property_keys": [],
            }
        ],
    )
    with pytest.raises(LLMError):
        validate_proposal(bad, existing_node_type_names=set())

    # Guard ran before reconcile, so the draft is untouched.
    untouched = await _reload(session, store, draft.id)
    assert untouched.node_types == []
    assert untouched.edge_types == []
