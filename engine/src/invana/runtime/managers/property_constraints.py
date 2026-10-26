"""Constraints on properties — set, removed and checked on a model's draft
(docs/for-developers/modules/connect-and-model/features/property-constraints.md).

A constraint bounds one property's values on one type: a **range** (``min`` ·
``max`` · a unit label) or **a standard's values** (one term of a standard's
current version, its codes copied onto the rule at save). It is the type's
property mapping's range, enum or standard rule, so it stages on a draft and
publishes with the model; enforcement is the model's own validator.

Lives in ``runtime`` because it joins ``apps/modeller`` (the draft),
``apps/standards`` (the referenced values) and the Graph's live database (what
breaks the constraint today), and ``apps/modeller`` may import neither.

Usage::

    constraints = PropertyConstraintManager()
    rule = await constraints.set(session, version=draft, body=body)
    check = await constraints.check(session, connector=connector, version=version, body=body)
    choices = await constraints.standard_choices(session)

Refusals are ``core.errors``: a type or property the version does not have is
404; a range on a non-numeric property, an inverted or empty range, an unknown
standard or term, a term without values and a version that is not a draft are
422. ``check`` never refuses for the database — a connector it cannot count on
comes back ``counted: false`` with the reason.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.modeller.constraints import constraint_label
from invana.apps.modeller.models import (
    EdgeTypeDefinition,
    GraphVersion,
    NodeTypeDefinition,
    TypePropertyMapping,
    ValidationRule,
)
from invana.apps.modeller.querysets.validation_rule import ValidationRuleQuerySet
from invana.apps.modeller.schemas import ConstraintCheck, ConstraintSample, PropertyConstraintSet, StandardChoice
from invana.apps.standards.querysets.standard import StandardQuerySet, StandardVersionQuerySet
from invana.core.errors import NotFoundError, ValidationError

#: The property types a range compares.
NUMERIC_TYPES = frozenset(
    {"int", "integer", "long", "short", "byte", "float", "double", "decimal", "number", "numeric"}
)
#: Records a check names beside its count.
SAMPLES = 5


def _type_of(version: GraphVersion, name: str) -> NodeTypeDefinition | EdgeTypeDefinition:
    for t in [*version.node_types, *version.edge_types]:
        if t.name == name:
            return t
    raise NotFoundError({"error": "type_not_found", "message": f"The model has no type called {name}."})


def _mapping_of(version: GraphVersion, type_def: Any, prop: str) -> TypePropertyMapping | None:
    """The type's own mapping of ``prop``; ``None`` when it only inherits it."""
    return next((m for m in type_def.property_mappings if m.property_key.name == prop), None)


def _inherits(version: GraphVersion, type_def: Any, prop: str) -> bool:
    if not isinstance(type_def, NodeTypeDefinition):
        return False
    by_name = {t.name: t for t in version.node_types}
    parent = type_def.parent_type
    while parent and parent in by_name:
        if any(m.property_key.name == prop for m in by_name[parent].property_mappings):
            return True
        parent = by_name[parent].parent_type
    return False


def _key_type(version: GraphVersion, prop: str) -> str:
    key = next((k for k in version.property_keys if k.name == prop), None)
    return (key.type if key else "").strip().lower()


def _invalid(code: str, message: str) -> ValidationError:
    return ValidationError({"error": code, "message": message})


class PropertyConstraintManager:
    """The rules a constraint on a property follows — what it may say, where it is written, what breaks it."""

    _rules = ValidationRuleQuerySet()
    _standards = StandardQuerySet()
    _standard_versions = StandardVersionQuerySet()

    async def fields(self, session: AsyncSession, *, version: GraphVersion, body: PropertyConstraintSet) -> dict:
        """The rule ``body`` stands for, checked against the version and the standards; 404 · 422 as above."""
        type_def = _type_of(version, body.type)
        if _mapping_of(version, type_def, body.property) is None and not _inherits(version, type_def, body.property):
            raise NotFoundError(
                {"error": "property_not_found", "message": f"{body.type} has no property {body.property}."}
            )
        if body.kind == "range":
            if _key_type(version, body.property) not in NUMERIC_TYPES:
                raise _invalid("range_needs_number", f"A range needs a number; {body.property} is not one.")
            if body.min is None and body.max is None:
                raise _invalid("range_empty", "A range needs a lower or an upper bound.")
            if body.min is not None and body.max is not None and body.min > body.max:
                raise _invalid("range_inverted", "The lower bound is above the upper bound.")
            return {
                "rule_type": "range",
                "params": {k: v for k, v in (("min", body.min), ("max", body.max)) if v is not None},
                "unit": (body.unit or "").strip() or None,
                "on_break": body.on_break,
            }
        publisher, _, name = (body.standard or "").partition("/")
        standard = (
            await self._standards.get_by_address(session, publisher=publisher, name=name)
            if publisher and name
            else None
        )
        pinned = (
            await self._standard_versions.get(session, standard.current_version_id)
            if standard and standard.current_version_id
            else None
        )
        if pinned is None:
            raise _invalid("standard_not_found", f"There is no published standard {body.standard or ''}.".strip())
        term = next((t for t in pinned.terms or [] if t.get("name") == body.term), None)
        if term is None:
            raise _invalid("term_not_found", f"{standard.address} has no term {body.term or ''}.".strip())
        values = [v["code"] for v in term.get("values") or [] if v.get("code")]
        if not values:
            raise _invalid("term_has_no_values", f"{body.term} in {standard.address} lists no values.")
        return {
            "rule_type": "standard",
            "params": {"values": values},
            "standard_version_id": pinned.id,
            "standard_ref": f"{standard.address}@{pinned.version}",
            "term": body.term,
            "on_break": body.on_break,
        }

    async def set(self, session: AsyncSession, *, version: GraphVersion, body: PropertyConstraintSet) -> ValidationRule:
        """Write ``body`` as the property's constraint on the draft, replacing the one it had."""
        if version.status != "draft":
            raise _invalid("not_a_draft", "Open a draft to change a constraint.")
        fields = await self.fields(session, version=version, body=body)
        type_def = _type_of(version, body.type)
        mapping = _mapping_of(version, type_def, body.property)
        if mapping is None:
            node = isinstance(type_def, NodeTypeDefinition)
            mapping = await self._rules.own_mapping(
                session,
                version_id=version.id,
                node_type_id=type_def.id if node else None,
                edge_type_id=None if node else type_def.id,
                property_key=body.property,
            )
        return await self._rules.replace_value_rule(session, version_id=version.id, mapping=mapping, fields=fields)

    async def remove(self, session: AsyncSession, *, version: GraphVersion, rule_id: str) -> None:
        """Take a constraint off the draft; a rule the version does not hold is 404."""
        if version.status != "draft":
            raise _invalid("not_a_draft", "Open a draft to change a constraint.")
        mappings = [m for t in [*version.node_types, *version.edge_types] for m in t.property_mappings]
        rules = [r for m in mappings for r in m.validation_rules] + [
            r for k in version.property_keys for r in k.validation_rules
        ]
        rule = next((r for r in rules if r.id == rule_id), None)
        if rule is None:
            raise NotFoundError({"error": "constraint_not_found", "message": "This draft has no such constraint."})
        await self._rules.delete_rule(session, version_id=version.id, rule=rule)

    async def check(
        self, session: AsyncSession, *, connector: Any, version: GraphVersion, body: PropertyConstraintSet
    ) -> ConstraintCheck:
        """What in the graph breaks ``body`` now: a count and up to five records. Writes nothing."""
        fields = await self.fields(session, version=version, body=body)
        label = constraint_label(fields)
        family = getattr(getattr(type(connector), "_capability_profile", None), "family", None)
        if connector is None:
            return ConstraintCheck(label=label, counted=False, reason="The Graph's database is not connected.")
        if getattr(family, "value", None) != "cypher":
            return ConstraintCheck(label=label, counted=False, reason="This database cannot count them here.")
        if "`" in body.type or "`" in body.property:
            raise _invalid("bad_name", "A type or property name may not hold a backtick.")
        node = any(t.name == body.type for t in version.node_types)
        match = f"MATCH (n:`{body.type}`)" if node else f"MATCH ()-[n:`{body.type}`]->()"
        prop = f"n.`{body.property}`"
        params: dict[str, Any] = {}
        if fields["rule_type"] == "range":
            parts = []
            for bound, op in (("min", "<"), ("max", ">")):
                if bound in fields["params"]:
                    parts.append(f"{prop} {op} ${bound}")
                    params[bound] = fields["params"][bound]
            where = f"{prop} IS NOT NULL AND ({' OR '.join(parts)})"
        else:
            where = f"{prop} IS NOT NULL AND NOT {prop} IN $values"
            params["values"] = fields["params"]["values"]
        try:
            counted = _rows(await connector.execute(f"{match} WHERE {where} RETURN count(n) AS breaking", params))
            sampled = _rows(
                await connector.execute(
                    f"{match} WHERE {where} RETURN n.id AS record, {prop} AS value LIMIT {SAMPLES}", params
                )
            )
        except Exception as exc:
            return ConstraintCheck(label=label, counted=False, reason=f"The database could not count them: {exc}")
        breaking = int(_get(counted[0], "breaking") or 0) if counted else 0
        samples = [ConstraintSample(record=str(_get(r, "record")), value=_get(r, "value")) for r in sampled]
        return ConstraintCheck(label=label, counted=True, breaking=breaking, samples=samples)

    async def standard_choices(self, session: AsyncSession) -> list[StandardChoice]:
        """Every standard's current-version terms that list values — what a constraint may reference."""
        out: list[StandardChoice] = []
        for standard in await self._standards.search(session):
            if not standard.current_version_id:
                continue
            pinned = await self._standard_versions.get(session, standard.current_version_id)
            for term in (pinned.terms if pinned else None) or []:
                values = term.get("values") or []
                if values:
                    out.append(
                        StandardChoice(
                            standard=standard.address,
                            title=standard.title or standard.name,
                            version=pinned.version,
                            term=term.get("name", ""),
                            values=len(values),
                        )
                    )
        return out


def _rows(result: Any) -> list[Any]:
    return list(getattr(result, "records", None) or getattr(result, "rows", None) or [])


def _get(row: Any, key: str) -> Any:
    return row.get(key) if isinstance(row, dict) else getattr(row, key, None)
