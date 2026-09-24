"""The catalogue is closed, declared, and one bound per entry.

`docs/for-developers/orchestration.md` § 0.6 makes three claims this file holds
to: the set is countable, every entry declares what four readers need, and no
entry spends two bounds — because the envelope ceilings *per bound*, and an
entry spanning two cannot be ceilinged.

Like `test_code_shape.py`, the spans that still exist are **named**, not
tolerated silently. Deleting an entry from ``SPANS_ALLOWED`` is how a
conversion is finished.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from invana.apps.agents.registry import SEEDED_AGENTS, TEMPLATES
from invana.runtime.catalogue import CATALOGUE, TASKS
from invana.runtime.catalogue.registry import Bound, Entry, Type

CATALOGUE_DIR = Path(__file__).resolve().parents[2] / "src" / "invana" / "runtime" / "catalogue"

#: The closed set's size. Growth belongs in reusable TaskPlans, not here — so
#: changing this number is a decision, and the decision goes in
#: `building-engine/task-model-migration.md` § 6.1 first.
ENTRY_COUNT = 28

#: Modules that declare entries, and the one bound each of them names.
BOUND_MODULES = {
    "pure.py": Bound.none,
    "graph_read.py": Bound.graph_read,
    "ingest.py": Bound.ingest,
    "graph_write.py": Bound.graph_write,
    "schema_write.py": Bound.schema_write,
    "llm.py": Bound.llm,
    "work_write.py": Bound.work_write,
}

#: An entry is a view: parse args, call **one manager in one app**, serialise
#: the declared outputs (the-runtime-package.md § 4). These modules still reach
#: further; each row names what closes it.
SPANS_ALLOWED = {
    # validate_proposal reconciles through apps/sessions into apps/modeller.
    # Closes when reconcile_proposal moves to an apps/modeller manager.
    "schema_write.py": {"llm", "modeller", "sessions"},
    # delegate opens a run against a work Task under a child agent.
    # Closes when delegate and create_task merge into one entry (§ 6.2).
    "work_write.py": {"agents", "work"},
}


def _apps_imported(path: Path) -> set[str]:
    """The `invana.apps.<name>` packages this module imports, by name."""
    names: list[str] = []
    for node in ast.walk(ast.parse(path.read_text())):
        if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names.append(node.module)
        elif isinstance(node, ast.Import):
            names.extend(a.name for a in node.names)
    out: set[str] = set()
    for name in names:
        parts = name.split(".")
        if len(parts) >= 3 and parts[:2] == ["invana", "apps"]:
            out.add(parts[2])
    return out


class TestClosed:
    def test_the_set_is_the_size_it_says_it_is(self) -> None:
        assert len(CATALOGUE) == ENTRY_COUNT
        assert set(TASKS) == set(CATALOGUE)

    def test_every_entry_declares_all_four_fields(self) -> None:
        for key, entry in CATALOGUE.items():
            assert isinstance(entry, Entry), key
            assert isinstance(entry.bound, Bound), key
            assert isinstance(entry.args, dict), key
            assert isinstance(entry.outputs, dict), key
            assert isinstance(entry.requires, tuple), key
            assert all(isinstance(t, Type) for t in entry.outputs.values()), key

    def test_every_entry_says_what_it_does_in_one_line(self) -> None:
        # The Catalogue drawer renders this and nothing else (the-catalogue.md CA2).
        for key, entry in CATALOGUE.items():
            assert entry.summary.strip(), f"{key} declares no summary"
            assert "\n" not in entry.summary, f"{key}'s summary is not one line"

    def test_every_requires_names_an_entry_in_the_set(self) -> None:
        for key, entry in CATALOGUE.items():
            for required in entry.requires:
                assert required in CATALOGUE, f"{key} requires '{required}', which is not in the catalogue"


class TestNoEntrySpansTwoBounds:
    def test_a_module_declares_exactly_one_bound(self) -> None:
        # The bound is legible from the file an entry lives in, which is what
        # makes "one act, one bound" checkable rather than asserted.
        for filename, bound in BOUND_MODULES.items():
            module = __import__(f"invana.runtime.catalogue.{filename[:-3]}", fromlist=["ENTRIES"])
            declared = {e.bound for e in module.ENTRIES.values()}
            assert declared == {bound}, f"{filename} declares {declared}, not {{{bound}}}"

    def test_every_entry_lives_in_the_module_for_its_bound(self) -> None:
        placed = {
            k
            for f in BOUND_MODULES
            for k in __import__(f"invana.runtime.catalogue.{f[:-3]}", fromlist=["ENTRIES"]).ENTRIES
        }
        assert placed == set(CATALOGUE)

    def test_an_entry_module_reaches_no_further_than_its_named_span(self) -> None:
        for filename in BOUND_MODULES:
            reached = _apps_imported(CATALOGUE_DIR / filename)
            allowed = SPANS_ALLOWED.get(filename)
            if allowed is not None:
                assert reached <= allowed, f"{filename} reaches {reached - allowed}, which SPANS_ALLOWED does not name"
            else:
                assert len(reached) <= 1, f"{filename} imports {reached}; an entry calls one manager in one app"


class TestBindings:
    """Every `${steps.x.y}` in the shipped library resolves against a declared
    output — and the validator refuses one that does not."""

    def test_every_seeded_template_and_agent_validates(self) -> None:
        from invana.apps.agents.envelope import Envelope
        from invana.runtime.planning import resolve_plan

        for template in TEMPLATES.values():
            envelope = Envelope.from_spec({"allow": [s["task"] for s in template.steps]})
            # A template that declares arguments is validated against what it
            # declares: its rows still hold `${args.N}` here, because nothing
            # has composed or selected it yet (LB20).
            resolve_plan(
                envelope=envelope,
                raw_steps=[dict(s) for s in template.steps],
                source="test",
                declares=template.args_schema,
            )

        for agent in SEEDED_AGENTS:
            steps = (agent.workflow_spec or {}).get("steps") or []
            if steps:
                envelope = Envelope.from_spec(agent.workflow_spec)
                resolve_plan(envelope=envelope, raw_steps=[dict(s) for s in steps], source="test")

    def test_a_binding_to_an_undeclared_output_is_refused(self) -> None:
        from invana.apps.agents.envelope import Envelope, PlanRejected, validate_plan

        envelope = Envelope.from_spec({"allow": ["translate_thought", "validate_query"]})
        with pytest.raises(PlanRejected) as caught:
            validate_plan(
                [
                    {"id": "t", "task": "translate_thought", "label": "T", "args": {}},
                    # `translate_thought` declares `query`, never `sql`.
                    {"id": "v", "task": "validate_query", "label": "V", "args": {"query": "${steps.t.sql}"}},
                ],
                envelope,
                catalogue=CATALOGUE,
            )
        assert "does not declare as an output" in str(caught.value)
