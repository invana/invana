"""A refusal is a sentence that names the next command (share-a-model.md SM5).

`ImportRefused` carries a code and its facts because a route returns them as a
document Studio renders. A terminal has no renderer, and printing the pair put
`model_name_taken: {'name': 'AirRoutes', …, 'same_package': True}` in front of a
reader whose actual problem was that they wanted `upgrade`.
"""

from __future__ import annotations

from invana.apps.modeller.portability import ImportRefused
from invana.cli.commands.models import _refusal

_ARGS = {"graph_ref": "demo/airways", "file": "demos/airways/air-routes/graph-model.json", "starter": None}


def test_the_same_package_twice_names_upgrade() -> None:
    """The verb they meant, spelled out with their own arguments in it."""
    said = _refusal(
        ImportRefused("model_name_taken", {"name": "AirRoutes", "package_id": "p", "same_package": True}),
        **_ARGS,
    )
    assert "already in this Graph" in said
    assert "Nothing was imported." in said
    assert "invana models upgrade --graph demo/airways --name AirRoutes" in said


def test_a_different_package_under_the_same_name_names_the_rename() -> None:
    said = _refusal(
        ImportRefused("model_name_taken", {"name": "AirRoutes", "package_id": "other", "same_package": False}),
        **_ARGS,
    )
    # Which package is named matters: it is the model already here, not the file.
    assert "a different package (other)" in said
    assert "--as <name>" in said
    assert "upgrade" not in said


def test_a_starter_refusal_suggests_the_starter_flag_back() -> None:
    """The suggestion echoes how the command was actually invoked."""
    said = _refusal(
        ImportRefused("model_name_taken", {"name": "Memory", "package_id": "p", "same_package": True}),
        graph_ref="demo/airways",
        file=None,
        starter="memory",
    )
    assert "--starter memory" in said and "--file" not in said


def test_an_unhandled_code_stays_visible_rather_than_being_guessed_at() -> None:
    """A code with no sentence is the CLI being incomplete — not a reason to flatten it."""
    said = _refusal(ImportRefused("something_new", {"fact": 1}), **_ARGS)
    assert said == "something_new: {'fact': 1}"
