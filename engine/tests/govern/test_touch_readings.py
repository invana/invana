"""A run's touches come back classified and counted — worlds.md.

Pinned: the verdict order (refused over touched over a cache miss over never
touched), an engaged address the world never allowed is kept, and every layer
is tallied — an empty one included — so the run lens counts nothing.
"""

from __future__ import annotations

from invana.apps.govern.managers.touch import classify_participants, layer_tallies
from invana.apps.govern.models import RunTouch


def _touch(seq: int, address: str, direction: str, **kwargs) -> RunTouch:
    return RunTouch(seq=seq, address=address, direction=direction, volume=kwargs.pop("volume", {}), **kwargs)


def test_participants_are_classified_and_layers_tallied() -> None:
    allowed = ["graph_data/model/airport", "llm/openai/gpt", "cache/query/x", "human/admin"]
    ledger = [
        _touch(1, "graph_data/model/airport", "read", volume={"rows": 12}),
        _touch(2, "graph_data/model/airport", "read", volume={"rows": 3, "tokens_in": 40, "tokens_out": 2}),
        _touch(3, "llm/openai/gpt", "refused", why="Denied by No OpenAI."),
        _touch(4, "cache/query/x", "skipped", why="nothing was reused"),
        _touch(5, "third_party/web/search", "call"),
    ]
    by = {p["address"]: p for p in classify_participants(allowed, ledger)}

    assert by["graph_data/model/airport"] == {
        "address": "graph_data/model/airport",
        "layer": "graph_data",
        "verdict": "touched",
        "why": None,
        "calls": 2,
        "rows": 15,
        "tokens": 42,
    }
    assert by["llm/openai/gpt"]["verdict"] == "refused"
    assert by["cache/query/x"]["verdict"] == "miss"
    assert by["human/admin"]["verdict"] == "never_touched"
    # Engaged without being allowed, and still drawn.
    assert by["third_party/web/search"]["verdict"] == "touched"

    tallies = {t["layer"]: t for t in layer_tallies(list(by.values()), ledger)}
    assert tallies["graph_data"] == {
        "layer": "graph_data",
        "allowed": 1,
        "touched": 1,
        "refused": 0,
        "calls": 2,
        "touches": 2,
        "rows": 15,
    }
    assert (tallies["cache"]["touches"], tallies["cache"]["calls"]) == (1, 0)
    assert tallies["llm"]["refused"] == 1


def test_a_run_that_touched_nothing_tallies_every_layer_as_empty() -> None:
    participants = classify_participants([], [])
    assert participants == []
    tallies = layer_tallies(participants, [])
    assert {t["layer"] for t in tallies} >= {"graph_data", "llm", "third_party", "cache", "human"}
    assert all(t["allowed"] == t["touches"] == t["calls"] == 0 for t in tallies)
