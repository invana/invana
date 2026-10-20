"""A board's saved edits, checked against the model (4.7 Edit the graph's data).

The check is pure — a batch and a model index in, the checked batch or a
refusal out — so these need no database. The write is covered against a live
database in ``tests/graph/connectors/opencypher/test_data_writer.py``.
"""

from __future__ import annotations

import pytest

from invana.apps.modeller.managers.data_edit import DataEditManager
from invana.apps.modeller.schemas import DataEditBatch, ModelIndex
from invana.core.errors import ValidationError

INDEX = ModelIndex(
    version_id="v1",
    nodes={"airport": {"code": "string", "runways": "int"}, "country": {"name": "string"}},
    edges={"route": {"weekly": "int", "distance_km": "float"}},
)


def check(*edits: dict):
    return DataEditManager().check_batch(DataEditBatch.model_validate({"edits": list(edits)}), INDEX)


def test_values_are_coerced_to_their_keys_types_and_a_blank_value_is_unset() -> None:
    added, edited = check(
        {"op": "add_node", "ref": "n1", "type": "airport", "properties": {"code": "DOH", "runways": "2"}},
        {"op": "update_edge", "id": "e9", "type": "route", "set": {"weekly": "91", "distance_km": ""}},
    )
    assert added.properties == {"code": "DOH", "runways": 2}
    assert edited.set == {"weekly": 91}
    assert edited.unset == ["distance_km"]


@pytest.mark.parametrize(
    ("edit", "code"),
    [
        ({"op": "add_node", "ref": "n1", "type": "city", "properties": {}}, "not_in_model"),
        ({"op": "add_node", "ref": "n1", "type": "airport", "properties": {"gates": "184"}}, "not_in_model"),
        ({"op": "update_node", "id": "n2", "type": "airport", "set": {"runways": "two"}}, "bad_value"),
        (
            {"op": "update_node", "id": "n2", "type": "airport", "set": {"code": "X"}, "unset": ["code"]},
            "duplicate_key",
        ),
    ],
)
def test_what_the_model_does_not_have_is_refused_naming_the_edit(edit: dict, code: str) -> None:
    with pytest.raises(ValidationError) as caught:
        check({"op": "delete_edge", "id": "e1", "type": "route"}, edit)
    assert caught.value.detail["error"] == code
    assert caught.value.detail["edit"] == 1
