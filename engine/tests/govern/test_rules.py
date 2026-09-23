"""The rule grammar — what it permits, and the three laws it enforces.

No database and no I/O: this is the part of Govern that decides, and it decides
from a list of rules and an address. Testing it here rather than through a route
is what lets *deny wins at any specificity* be a two-line test instead of a
fixture.
"""

from __future__ import annotations

import pytest

from invana.apps.govern.addressing import AddressError, Layer, matches, parse_address, validate_pattern
from invana.apps.govern.cast import CastError, require, resolve, shipped_cast
from invana.apps.govern.rules import (
    Decision,
    Effective,
    Role,
    Rule,
    RuleError,
    compose,
    validate_rule,
)

# ── addressing ───────────────────────────────────────────────────────────────


def test_an_address_splits_into_three_and_keeps_its_tail_whole() -> None:
    address = parse_address("third_party/api/clearbit.com/v2/companies")
    assert address.layer is Layer.third_party
    assert address.sublayer == "api"
    # The name is one thing, not three segments — a path is part of the name.
    assert address.name == "clearbit.com/v2/companies"


def test_a_pattern_is_not_an_address() -> None:
    with pytest.raises(AddressError, match="a pattern belongs on a rule"):
        parse_address("llm/anthropic-prod/*")


def test_double_star_must_be_last() -> None:
    validate_pattern("third_party/**")
    with pytest.raises(AddressError, match="only be the last part"):
        validate_pattern("third_party/**/companies")


@pytest.mark.parametrize(
    ("pattern", "address", "expected"),
    [
        ("llm/anthropic-prod/*", "llm/anthropic-prod/claude-opus-5", True),
        # `*` is one segment, so it does not reach into another provider.
        ("llm/anthropic-prod/*", "llm/ollama-local/llama-3.3", False),
        ("third_party/**", "third_party/api/clearbit.com/v2/companies", True),
        # `*` is one segment and the address has three after the layer.
        ("third_party/*", "third_party/api/clearbit.com/v2/companies", False),
        ("graph_data/model/Routes@v4", "graph_data/model/Routes@v4", True),
        # A glob *inside* a segment — how a rule names a model across its
        # versions, which is what the shipped guardrails are written with.
        ("graph_data/model/Deals@*", "graph_data/model/Deals@1.0.0", True),
        ("graph_data/model/Deals@*", "graph_data/model/Deal@1.0.0", False),
        # It stays one segment: the glob does not reach across a slash.
        ("graph_data/model/Deals@*", "graph_data/model/Deals@1.0.0/extra", False),
    ],
)
def test_matching(pattern: str, address: str, expected: bool) -> None:
    assert matches(pattern, address) is expected


# ── the grammar's refusals ───────────────────────────────────────────────────


def test_a_third_party_carries_no_selector() -> None:
    """GV13 — one you could slice is one you have effectively modelled."""
    rule = Rule(match="third_party/api/clearbit.com/**", allow=True, select={"time": {"from": "2026-01-01"}})
    with pytest.raises(RuleError, match="carries no selector"):
        validate_rule(rule)


def test_the_spine_is_not_governed() -> None:
    with pytest.raises(RuleError, match="the spine is not governed"):
        validate_rule(Rule(match="agent/agent/*", allow=False))


def test_an_option_belongs_to_its_layer() -> None:
    validate_rule(Rule(match="cache/answer/*", allow=True, options={"max_age_s": 0}))
    with pytest.raises(RuleError, match="carries no options"):
        validate_rule(Rule(match="graph_data/model/Routes@v4", allow=True, options={"max_age_s": 0}))


def test_egress_classes_are_a_closed_set() -> None:
    with pytest.raises(RuleError, match="not something that can be sent"):
        validate_rule(Rule(match="llm/**", allow=True, egress={"may_send": ["the_whole_database"]}))


# ── the three laws ───────────────────────────────────────────────────────────


def test_deny_wins_at_any_specificity() -> None:
    """GV5 — the narrow allow written later does not punch through."""
    lens = Effective(
        rules=[
            Rule(match="third_party/**", allow=False),
            Rule(match="third_party/api/clearbit.com/**", allow=True),
        ]
    )
    verdict = lens.decide("third_party/api/clearbit.com/v2/companies")
    assert verdict.decision is Decision.denied
    # And it names the *broadest* denial, because that is the bound to argue with.
    assert verdict.rule_matched == "third_party/**"


def test_the_default_is_the_widest() -> None:
    """GV7 — a lens that says nothing about a layer permits it whole."""
    assert Effective().decide("llm/anthropic-prod/claude-opus-5").decision is Decision.allowed


def test_a_closed_layer_is_an_allow_list() -> None:
    """GV23 — picking four models out of six is what closing a layer means."""
    lens = Effective(
        rules=[Rule(match="graph_data/model/Routes@v4", allow=True)],
        closed_layers={Layer.graph_data},
    )
    assert lens.decide("graph_data/model/Routes@v4").decision is Decision.allowed

    out = lens.decide("graph_data/model/Publisher@v1")
    assert out.decision is Decision.denied
    assert "the graph_data layer is closed" in (out.why or "")
    # Closing one layer says nothing about another.
    assert lens.decide("llm/anthropic-prod/claude-opus-5").decision is Decision.allowed


def test_allow_intersects_and_deny_accumulates_across_contributors() -> None:
    """GV6 — agent ∩ plan ∩ todo. Each narrows; none widens."""
    agent = Effective(rules=[Rule(match="llm/**", allow=True)])
    plan = Effective(rules=[Rule(match="llm/ollama-local/**", allow=False)])
    effective = compose([agent, plan])

    assert effective.decide("llm/anthropic-prod/claude-opus-5").decision is Decision.allowed
    assert effective.decide("llm/ollama-local/llama-3.3").decision is Decision.denied


def test_selectors_intersect_and_exclusions_accumulate() -> None:
    effective = compose(
        [
            Effective(
                rules=[
                    Rule(
                        match="graph_data/model/Routes@v4",
                        allow=True,
                        select={"time": {"axis": "observed_at", "from": "2026-01-01", "to": "2026-12-31"}},
                        properties={"exclude": ["revenue"]},
                    )
                ]
            ),
            Effective(
                rules=[
                    Rule(
                        match="graph_data/model/Routes@v4",
                        allow=True,
                        select={"time": {"from": "2026-03-01", "to": "2026-06-30"}},
                        properties={"exclude": ["contract_value"]},
                    )
                ]
            ),
        ]
    )
    verdict = effective.decide("graph_data/model/Routes@v4")

    # The overlap, never the union: the later `from` and the earlier `to`.
    assert verdict.select["time"]["from"] == "2026-03-01"
    assert verdict.select["time"]["to"] == "2026-06-30"
    # Exclusions are the mirror of deny — a property either side removed is gone.
    assert verdict.properties_excluded == ["contract_value", "revenue"]


def test_egress_intersects_and_an_unmatched_crossing_sends_nothing() -> None:
    """GV12 — the default is []."""
    lens = Effective(
        rules=[
            Rule(match="llm/anthropic-prod/*", allow=True, egress={"may_send": ["type_names", "the_question"]}),
            Rule(match="llm/**", allow=True, egress={"may_send": ["type_names"]}),
        ]
    )
    assert lens.decide("llm/anthropic-prod/claude-opus-5").may_send == ["type_names"]
    # Allowed, but no rule said anything about what may accompany the call.
    assert Effective().decide("llm/anthropic-prod/claude-opus-5").may_send == []


# ── the cast ─────────────────────────────────────────────────────────────────


def test_innermost_wins_and_the_cast_does_not_intersect() -> None:
    effective = compose(
        [
            Effective(cast={"decide": "llm/anthropic-prod/claude-opus-5"}),
            Effective(cast={"decide": "llm/anthropic-prod/claude-sonnet-5"}),
            Effective(cast={"decide": "llm/ollama-local/llama-3.3"}),
        ]
    )
    assert effective.resolve_cast(Role.decide) == "llm/ollama-local/llama-3.3"


def test_a_denied_cast_refuses_the_run_before_anything_is_spent() -> None:
    """R4 — a cast is a resolution, not a bound. It picks within the rules."""
    effective = Effective(
        rules=[Rule(match="llm/ollama-local/**", allow=False)],
        cast={"decide": "llm/ollama-local/llama-3.3"},
    )
    resolution = resolve(effective, role=Role.decide)
    assert not resolution.allowed
    assert "denies it" in (resolution.refusal or "")

    with pytest.raises(CastError) as exc:
        require(effective, role=Role.decide)
    assert exc.value.resolution.rule_matched == "llm/ollama-local/**"


def test_the_shipped_cast_reads_cheap_decides_capable_and_judges_locally() -> None:
    """PM4 — dropping `is_default` means this has to be right."""
    cast = shipped_cast(
        [
            ("llm/anthropic-prod/claude-haiku-4.5", {"cost_rank": 1, "power_rank": 10}),
            ("llm/anthropic-prod/claude-opus-5", {"cost_rank": 90, "power_rank": 99}),
            ("llm/ollama-local/llama-3.3", {"cost_rank": 5, "power_rank": 30, "local": True}),
            ("llm/ollama-local/nomic-embed", {"embedding": True}),
        ]
    )
    assert cast[Role.extract.value] == "llm/anthropic-prod/claude-haiku-4.5"
    assert cast[Role.decide.value] == "llm/anthropic-prod/claude-opus-5"
    assert cast[Role.judge.value] == "llm/ollama-local/llama-3.3"
    assert cast[Role.embed.value] == "llm/ollama-local/nomic-embed"


def test_two_embedding_models_means_none_is_the_one() -> None:
    cast = shipped_cast(
        [
            ("llm/a/embed-1", {"embedding": True}),
            ("llm/b/embed-2", {"embedding": True}),
        ]
    )
    assert Role.embed.value not in cast
