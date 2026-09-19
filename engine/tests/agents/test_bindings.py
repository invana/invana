"""`${steps.x.y}` becomes the value it names, before a step reads its args.

The validator proved the reference is legal (test_envelope.py); this is the
other half — that the proven reference is actually *resolved*, so an entry sees
a literal. Pure: no database, no dispatch.
"""

from __future__ import annotations

from invana.runtime.interpreter.bindings import resolve

OUTPUTS = {
    "translate_a": {"query": "MATCH (n) RETURN n", "rationale": None},
    "understand": {"intent": {"kind": "compound", "refs": ["Airport"]}},
}


class TestResolves:
    def test_a_binding_becomes_the_output_it_names(self):
        assert resolve({"query": "${steps.translate_a.query}"}, OUTPUTS) == {"query": "MATCH (n) RETURN n"}

    def test_a_dotted_path_walks_into_a_declared_obj(self):
        assert resolve({"k": "${steps.understand.intent.kind}"}, OUTPUTS)["k"] == "compound"

    def test_a_declared_output_that_is_absent_resolves_to_none(self):
        # `rationale` is legitimately null on a query the model did not explain.
        # None is what an entry's `args.get(...) or <fallback>` already reads.
        assert resolve({"why": "${steps.translate_a.rationale}"}, OUTPUTS)["why"] is None
        assert resolve({"why": "${steps.translate_a.nothing}"}, OUTPUTS)["why"] is None
        assert resolve({"why": "${steps.never_ran.query}"}, OUTPUTS)["why"] is None


class TestLeavesAlone:
    def test_a_plain_string_is_untouched(self):
        args = {"ask": "how many airports?", "read_only": True, "ids": ["a", "b"]}
        assert resolve(args, OUTPUTS) == args

    def test_only_a_whole_string_binds_the_way_the_validator_checks(self):
        # The validator matches the whole value, so interpolation is not a
        # thing — resolving it here would open a path nothing proved legal.
        args = {"query": "prefix ${steps.translate_a.query}"}
        assert resolve(args, OUTPUTS) == args

    def test_no_args_is_an_empty_dict(self):
        assert resolve(None, OUTPUTS) == {}
