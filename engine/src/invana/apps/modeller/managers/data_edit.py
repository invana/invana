"""Data edits — nodes and relationships added, changed and deleted on the Explorer board.

A batch is what a board's Changes panel saves: the edits since the last save,
in order. :class:`DataEditManager` checks it against the graph's model, and the
``graph.write.edits`` task writes it inside a ``data-edit`` run — never directly
from a route, since nothing writes outside the runtime.

**The model is the schema.** :meth:`DataEditManager.model_index` reads the
active version of the graph's model (its connection's ``model_id``) — the version Studio's
Element panel reads — and :meth:`DataEditManager.check_batch` refuses a type or
a key that version does not have, a key both set and removed, and a value its
key's data type cannot hold. A value is coerced to its key's type here, so the
database receives a number for a ``float`` key whatever the form sent. The
client's strictness is a courtesy; this is the check.

**Identity.** An added element carries the board's id (``ref``);
:meth:`DataEditManager.apply_edits` maps each to the id the database gave it,
and a later edit in the same batch may name a node by its ``ref``. Before
changing or deleting a saved element it reads the element's label, and refuses
when it is not the type the board claimed — the board was stale.

**Order and failure.** Edits apply in order through the connector's data writer,
each one on its own; the first refusal stops the batch and :class:`EditFailed`
says how many were written before it. Connectors expose no transaction, so a
batch is not all-or-nothing.

Usage::

    manager = DataEditManager()
    index = await manager.model_index(db, connection.model_id)
    checked = manager.check_batch(batch, index)
    ids, applied = await manager.apply_edits(connector, checked)
"""

from __future__ import annotations

from typing import Any, Literal

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.modeller.schemas import (
    AddEdge,
    AddNode,
    DataEdit,
    DataEditBatch,
    DeleteEdge,
    DeleteNode,
    ModelIndex,
    UpdateEdge,
    UpdateNode,
    VersionResponse,
)
from invana.apps.modeller.store import ModelStore
from invana.core.errors import ConflictError, ValidationError

# ── the model, as the check reads it ──────────────────────────────────────


def index_of(version: VersionResponse) -> ModelIndex:
    """Each node type's effective keys (its own and inherited) and each relationship type's keys."""
    return ModelIndex(
        version_id=version.id,
        nodes={
            t.name: {
                m.property_key.name: m.property_key.type for m in (t.effective_property_mappings or t.property_mappings)
            }
            for t in version.node_types
        },
        edges={
            t.name: {m.property_key.name: m.property_key.type for m in t.property_mappings} for t in version.edge_types
        },
    )


async def _model_index(db: AsyncSession, model_id: str | None) -> ModelIndex:
    """The graph's model, at its **active** version — a draft is not a schema to write against."""
    if model_id is None:
        raise ConflictError(
            {"error": "no_model", "message": "This graph has no model, so there is nothing to check an edit against."}
        )
    version = await ModelStore().get_active_version(db, model_id)
    if version is None:
        raise ConflictError({"error": "no_model", "message": "Publish a model to edit this graph's data."})
    return index_of(VersionResponse.model_validate(version))


# ── the check ─────────────────────────────────────────────────────────────

_INT = {"int", "integer", "long", "short", "byte"}
_FLOAT = {"float", "double", "decimal", "number", "numeric"}
_BOOL = {"bool", "boolean"}
_TRUE = {"true", "1", "yes"}
_FALSE = {"false", "0", "no"}


def coerce(value: Any, data_type: str) -> Any:
    """``value`` as its key's data type holds it. Text-like types (string, text, date…) keep a string."""
    kind = (data_type or "").strip().lower()
    if kind in _INT:
        if isinstance(value, bool):
            raise ValueError("a whole number")
        if isinstance(value, int):
            return value
        f = float(str(value).strip())
        if not f.is_integer():
            raise ValueError("a whole number")
        return int(f)
    if kind in _FLOAT:
        if isinstance(value, bool):
            raise ValueError("a number")
        return float(str(value).strip())
    if kind in _BOOL:
        if isinstance(value, bool):
            return value
        text = str(value).strip().lower()
        if text in _TRUE:
            return True
        if text in _FALSE:
            return False
        raise ValueError("true or false")
    return value if isinstance(value, str) else str(value)


def _refuse(code: str, index: int, message: str, **extra: Any) -> ValidationError:
    return ValidationError({"error": code, "edit": index, "message": message, **extra})


def _properties(
    index: int, type_name: str, keys: dict[str, str], values: dict[str, Any], what: str
) -> tuple[dict[str, Any], list[str]]:
    """``values`` checked against ``keys`` and coerced; a blank value becomes a key to unset."""
    out: dict[str, Any] = {}
    blank: list[str] = []
    for key, value in values.items():
        if key not in keys:
            raise _refuse(
                "not_in_model", index, f"{key} is not a key of {type_name} in the model.", key=key, type=type_name
            )
        if value is None or (isinstance(value, str) and value.strip() == ""):
            blank.append(key)
            continue
        try:
            out[key] = coerce(value, keys[key])
        except (TypeError, ValueError) as exc:
            raise _refuse(
                "bad_value", index, f"{key} on {what} takes {keys[key]}; {value!r} is not one ({exc}).", key=key
            ) from exc
    return out, blank


def _check_batch(batch: DataEditBatch, index: ModelIndex) -> list[DataEdit]:
    """The batch with every type and key checked against the model and every value coerced.

    Raises :class:`ValidationError` (422) naming the first edit that does not fit.
    """
    checked: list[DataEdit] = []
    refs: set[str] = set()
    for i, edit in enumerate(batch.edits):
        if isinstance(edit, AddNode):
            keys = index.nodes.get(edit.type)
            if keys is None:
                raise _refuse("not_in_model", i, f"{edit.type} is not a node type in the model.", type=edit.type)
            props, _ = _properties(i, edit.type, keys, edit.properties, "a new node")
            refs.add(edit.ref)
            checked.append(edit.model_copy(update={"properties": props}))
        elif isinstance(edit, AddEdge):
            keys = index.edges.get(edit.type)
            if keys is None:
                raise _refuse(
                    "not_in_model", i, f"{edit.type} is not a relationship type in the model.", type=edit.type
                )
            props, _ = _properties(i, edit.type, keys, edit.properties, "a new relationship")
            refs.add(edit.ref)
            checked.append(edit.model_copy(update={"properties": props}))
        elif isinstance(edit, UpdateNode | UpdateEdge):
            space = index.nodes if isinstance(edit, UpdateNode) else index.edges
            keys = space.get(edit.type)
            if keys is None:
                kind = "node" if isinstance(edit, UpdateNode) else "relationship"
                raise _refuse("not_in_model", i, f"{edit.type} is not a {kind} type in the model.", type=edit.type)
            both = set(edit.set) & set(edit.unset)
            if both:
                key = sorted(both)[0]
                raise _refuse("duplicate_key", i, f"{key} is both set and removed in one edit.", key=key)
            props, blank = _properties(i, edit.type, keys, edit.set, edit.id)
            checked.append(edit.model_copy(update={"set": props, "unset": sorted({*edit.unset, *blank})}))
        else:
            checked.append(edit)
    return checked


# ── the write ─────────────────────────────────────────────────────────────


class EditFailed(Exception):
    """An edit the database refused, or one whose element is not what the board said; ``applied`` were written first."""

    def __init__(self, message: str, *, code: str, applied: int, ids: dict[str, str]) -> None:
        super().__init__(message)
        self.code = code
        self.applied = applied
        self.ids = ids


async def _label_of(connector: Any, kind: Literal["node", "edge"], element_id: str) -> str | None:
    try:
        element = await (
            connector.data_reader.read_vertex_by_id(element_id)
            if kind == "node"
            else connector.data_reader.read_edge_by_id(element_id)
        )
    except Exception:
        return None
    return getattr(element, "label", None)


async def _apply_edits(connector: Any, edits: list[DataEdit]) -> tuple[dict[str, str], int]:
    """Write ``edits`` in order through ``connector``'s data writer; return the new ids and how many were written."""
    ids: dict[str, str] = {}
    applied = 0
    writer = connector.data_writer

    def resolve(element_id: str) -> str:
        return ids.get(element_id, element_id)

    async def expect(kind: Literal["node", "edge"], element_id: str, type_name: str) -> None:
        label = await _label_of(connector, kind, element_id)
        if label is None:
            raise EditFailed(f"{element_id} is no longer in the graph.", code="not_found", applied=applied, ids=ids)
        if label != type_name:
            raise EditFailed(
                f"{element_id} is a {label} in the graph, not a {type_name} — reload the board and edit again.",
                code="stale_type",
                applied=applied,
                ids=ids,
            )

    for edit in edits:
        try:
            if isinstance(edit, AddNode):
                ids[edit.ref] = str((await writer.create_vertex(edit.type, edit.properties)).id)
            elif isinstance(edit, AddEdge):
                created = await writer.create_edge(
                    edit.type, resolve(edit.source), resolve(edit.target), edit.properties or None
                )
                ids[edit.ref] = str(created.id)
            elif isinstance(edit, UpdateNode):
                await expect("node", edit.id, edit.from_type or edit.type)
                if edit.from_type and edit.from_type != edit.type:
                    await writer.relabel_vertex(edit.id, edit.from_type, edit.type)
                if edit.set:
                    await writer.update_vertex(edit.id, edit.set)
                await writer.unset_vertex_properties(edit.id, edit.unset)
            elif isinstance(edit, UpdateEdge):
                await expect("edge", edit.id, edit.type)
                if edit.set:
                    await writer.update_edge(edit.id, edit.set)
                await writer.unset_edge_properties(edit.id, edit.unset)
            elif isinstance(edit, DeleteNode):
                await expect("node", edit.id, edit.type)
                await writer.delete_vertex(edit.id)
            elif isinstance(edit, DeleteEdge):
                await expect("edge", edit.id, edit.type)
                await writer.delete_edge(edit.id)
        except EditFailed:
            raise
        except NotImplementedError as exc:
            raise EditFailed(str(exc), code="writes_unsupported", applied=applied, ids=ids) from exc
        except Exception as exc:
            raise EditFailed(
                f"The database refused edit {applied + 1}: {exc}", code="write_failed", applied=applied, ids=ids
            ) from exc
        applied += 1
    return ids, applied


class DataEditManager:
    """The rules a board's save follows: read the model, check the batch, write it."""

    async def model_index(self, db: AsyncSession, model_id: str | None) -> ModelIndex:
        """The graph's model (its connection's ``model_id``) at its **active** version; 409 ``no_model`` without one."""
        return await _model_index(db, model_id)

    def check_batch(self, batch: DataEditBatch, index: ModelIndex) -> list[DataEdit]:
        """``batch`` checked against ``index`` and coerced; 422 naming the first edit that does not fit."""
        return _check_batch(batch, index)

    async def apply_edits(self, connector: Any, edits: list[DataEdit]) -> tuple[dict[str, str], int]:
        """Write checked ``edits`` in order; the new ids by ``ref`` and how many were written."""
        return await _apply_edits(connector, edits)
