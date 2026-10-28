"""Publishing a draft — classified additive or breaking, and published when allowed.

docs/for-developers/modules/connect-and-model/features/publish-review.md. A draft
is compared with the model's published version change by change; any one
breaking change makes the draft breaking. An additive draft publishes now. A
breaking one publishes only from the migration run a publish review opens after
another owner approves it, so every direct path refuses it::

    publishing = PublishManager()
    found = await publishing.classify_draft(session, model=model)
    if found.classification == "additive":
        version = await publishing.publish(session, model=model, actor_id=user.id, why="…")

``classify`` is pure — two loaded versions in, the classification out — so the
draft review route, the CLI's ``--dry-run`` and the migration run agree on one rule.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import TYPE_CHECKING

from invana.apps.modeller.json_io import SchemaExporter
from invana.apps.modeller.managers.migration import MigrationScan
from invana.apps.modeller.portability import compute_content_hash
from invana.apps.modeller.querysets.publish_review import PublishReviewQuerySet
from invana.apps.modeller.schemas import ModelPublishChange, ModelPublishClassification
from invana.apps.modeller.staging import collect
from invana.apps.modeller.store import ModelStore
from invana.apps.modeller.versioner import Versioner, compute_diff
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import emit_event

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from invana.apps.modeller.models import GraphModel, GraphVersion, ModelPublishReview
    from invana.graph.connectors.base.querysets.data_reader import BaseDataReaderQuerySet


@dataclass(frozen=True, slots=True)
class BoundDataset:
    """One dataset version bound to a type of the model — what a publish may touch."""

    dataset_id: str
    #: ``publisher/name``.
    name: str
    version: int
    type_name: str


def affected_datasets(
    bound: Sequence[BoundDataset], changes: Sequence[ModelPublishChange], scan: dict | None
) -> list[dict]:
    """The bound datasets on a type ``changes`` touch, each with the rows ``scan`` found failing there.

    A publish with no scan (an additive one) fails no row, so every touched
    dataset reads ``rows_failing: 0``.
    """
    touched = {c.type for c in changes if c.type}
    failing = {t["type"]: int(t.get("would_fail") or 0) for t in (scan or {}).get("types", [])}
    return [
        {
            "dataset_id": b.dataset_id,
            "name": b.name,
            "version": b.version,
            "type": b.type_name,
            "rows_failing": failing.get(b.type_name, 0),
        }
        for b in bound
        if b.type_name in touched
    ]


_NARROWED = "narrowed property"
_CHANGED_TYPE = "changed type"


def _add(out: list[ModelPublishChange], kind: str, target_kind: str, *, breaking: bool, reason: str, **at) -> None:
    out.append(ModelPublishChange(kind=kind, target_kind=target_kind, breaking=breaking, reason=reason, **at))


def _constraints(version: GraphVersion) -> dict[str, tuple[str, str, str, tuple[str, ...]]]:
    return {
        c.name: (c.target_kind, c.target_label, c.constraint_type, tuple(sorted(c.properties or [])))
        for c in version.constraints
    }


def _rules(version: GraphVersion) -> dict[tuple[str | None, str], set[str]]:
    """Validation rules per (type, property) — ``None`` for a rule on the property key itself."""
    out: dict[tuple[str | None, str], set[str]] = {}

    def sig(rule) -> str:
        return f"{rule.rule_type}:{json.dumps(rule.params or {}, sort_keys=True, default=str)}"

    for pk in version.property_keys:
        if pk.validation_rules:
            out[(None, pk.name)] = {sig(r) for r in pk.validation_rules}
    for t in [*version.node_types, *version.edge_types]:
        for m in t.property_mappings:
            if m.validation_rules:
                out[(t.name, m.property_key.name)] = {sig(r) for r in m.validation_rules}
    return out


def _cardinality_narrows(old: str, new: str) -> bool:
    # A list holds duplicates a set refuses, and either holds many a single refuses.
    return (new == "SINGLE" and old != "SINGLE") or (old == "LIST" and new == "SET")


def classify(base: GraphVersion | None, draft: GraphVersion) -> ModelPublishClassification:
    """Every change in ``draft`` against ``base``, each marked breaking or additive.

    The table in publish-review.md *What is breaking* is this function. A model
    with nothing published is additive: there is nothing in the graph it can break.
    """
    changes: list[ModelPublishChange] = []
    if base is None:
        for nt in draft.node_types:
            _add(changes, "type_added", "node_type", type=nt.name, breaking=False, reason="additive")
        for et in draft.edge_types:
            _add(changes, "type_added", "edge_type", type=et.name, breaking=False, reason="additive")
        return ModelPublishClassification(
            classification="additive", draft_version_id=draft.id, changes=changes, **_tally(changes)
        )

    diff = compute_diff(base, draft)
    for name in diff.removed_node_types:
        _add(changes, "type_removed", "node_type", type=name, breaking=True, reason="removed type")
    for name in diff.removed_edge_types:
        _add(changes, "type_removed", "edge_type", type=name, breaking=True, reason="removed type")
    for name in diff.added_node_types:
        _add(changes, "type_added", "node_type", type=name, breaking=False, reason="additive")
    for name in diff.added_edge_types:
        _add(changes, "type_added", "edge_type", type=name, breaking=False, reason="additive")

    for target_kind, modified in (("node_type", diff.modified_node_types), ("edge_type", diff.modified_edge_types)):
        for t in modified:
            for prop in t.removed_property_mappings:
                _add(changes, "property_removed", target_kind, type=t.name, property=prop, breaking=True,
                     reason="removed property")  # fmt: skip
            for prop in t.added_property_mappings:
                _add(changes, "property_added", target_kind, type=t.name, property=prop, breaking=False,
                     reason="additive")  # fmt: skip
            for field, (old, new) in t.metadata_changes.items():
                if field == "description":
                    _add(changes, "description_changed", target_kind, type=t.name, breaking=False, reason="additive")
                elif field in ("source_node_types", "target_node_types"):
                    removed = sorted(set(old or []) - set(new or []))
                    if removed:
                        _add(changes, "endpoints_narrowed", target_kind, type=t.name, property=", ".join(removed),
                             breaking=True, reason="narrowed endpoints")  # fmt: skip
                    if set(new or []) - set(old or []):
                        _add(changes, "endpoints_widened", target_kind, type=t.name, breaking=False,
                             reason="additive")  # fmt: skip
                elif field == "multiplicity":
                    _add(changes, "multiplicity_changed", target_kind, type=t.name, breaking=True,
                         reason=f"changed multiplicity: {old} → {new}")  # fmt: skip
                else:
                    _add(changes, f"{field}_changed", target_kind, type=t.name, breaking=True, reason=_CHANGED_TYPE)

    for name in diff.removed_property_keys:
        _add(changes, "property_removed", "property_key", property=name, breaking=True, reason="removed property")
    for name in diff.added_property_keys:
        _add(changes, "property_added", "property_key", property=name, breaking=False, reason="additive")
    for pk in diff.modified_property_keys:
        for field, (old, new) in pk.changes.items():
            if field == "type":
                _add(changes, "property_type_changed", "property_key", property=pk.name, breaking=True,
                     reason=f"{_CHANGED_TYPE}: {old} → {new}")  # fmt: skip
            elif field == "value_cardinality":
                narrows = _cardinality_narrows(old, new)
                _add(changes, "cardinality_narrowed" if narrows else "cardinality_widened", "property_key",
                     property=pk.name, breaking=narrows, reason=_NARROWED if narrows else "additive")  # fmt: skip
            else:
                _add(changes, f"{field}_changed", "property_key", property=pk.name, breaking=False, reason="additive")

    old_c, new_c = _constraints(base), _constraints(draft)
    for name in sorted(set(old_c) | set(new_c)):
        before, after = old_c.get(name), new_c.get(name)
        if before == after:
            continue
        sig = after or before
        assert sig is not None
        keyed = "node_key" in {(before or ("",) * 3)[2], (after or ("",) * 3)[2]}
        at = {"type": sig[1], "property": ", ".join(sig[3]) or None}
        if keyed:
            _add(changes, "key_changed", "constraint", breaking=True, reason="changed key", **at)
        elif after is None:
            _add(changes, "constraint_removed", "constraint", breaking=False, reason="additive", **at)
        else:
            kind = "constraint_added" if before is None else "constraint_changed"
            _add(changes, kind, "constraint", breaking=True, reason=_NARROWED, **at)

    for name in diff.added_indexes:
        _add(changes, "index_added", "index", property=name, breaking=False, reason="additive")
    for name in diff.removed_indexes:
        _add(changes, "index_removed", "index", property=name, breaking=False, reason="additive")

    old_r, new_r = _rules(base), _rules(draft)
    for (type_name, prop), rules in sorted(new_r.items(), key=lambda kv: (kv[0][0] or "", kv[0][1])):
        if rules - old_r.get((type_name, prop), set()):
            target_kind = "property_key" if type_name is None else _kind_of(draft, type_name)
            _add(changes, "rule_added", target_kind, type=type_name, property=prop, breaking=True, reason=_NARROWED)

    breaking = any(c.breaking for c in changes)
    return ModelPublishClassification(
        classification="breaking" if breaking else "additive",
        base_version=base.version,
        base_version_id=base.id,
        draft_version_id=draft.id,
        changes=changes,
        **_tally(changes),
    )


def _tally(changes: list[ModelPublishChange]) -> dict[str, int]:
    """The changes counted by what they did — a kind ends in ``_added`` or ``_removed``, else it changed."""
    added = sum(1 for c in changes if c.kind.endswith("_added"))
    removed = sum(1 for c in changes if c.kind.endswith("_removed"))
    return {"added": added, "removed": removed, "changed": len(changes) - added - removed}


def _kind_of(version: GraphVersion, type_name: str) -> str:
    return "edge_type" if any(et.name == type_name for et in version.edge_types) else "node_type"


def refusal(found: ModelPublishClassification) -> ConflictError:
    """The 409 every direct publish path answers a breaking draft with."""
    breaking = [c.model_dump() for c in found.changes if c.breaking]
    return ConflictError(
        {
            "error": "breaking_publish_needs_review",
            "message": f"{len(breaking)} breaking change(s) — request a publish review; another owner approves it.",
            "changes": breaking,
        }
    )


class PublishManager:
    """Stateless. The session is the first argument of every method."""

    store = ModelStore()
    reviews = PublishReviewQuerySet()
    scanner = MigrationScan()

    async def draft_and_base(
        self, session: AsyncSession, *, model: GraphModel
    ) -> tuple[GraphVersion, GraphVersion | None]:
        """The model's draft and its published version, both fully loaded."""
        versions = await self.store.list_versions(session, model.id)
        draft = next((v for v in versions if v.status == "draft"), None)
        if draft is None:
            raise NotFoundError({"error": "no_draft", "model_id": model.id, "message": "This model has no draft."})
        return await self.store.get_version(session, draft.id), await self.store.get_active_version(session, model.id)

    async def classify_draft(self, session: AsyncSession, *, model: GraphModel) -> ModelPublishClassification:
        draft, base = await self.draft_and_base(session, model=model)
        return classify(base, draft)

    @staticmethod
    def content_hash(model: GraphModel, version: GraphVersion) -> str:
        """The hash an export of ``version`` would carry — what pins a draft under review."""
        export = SchemaExporter.export(
            version,
            schema_name=model.name,
            schema_description=model.description,
            validation_mode=model.validation_mode,
        )
        return compute_content_hash(export)

    async def refuse_breaking(self, session: AsyncSession, *, version_id: str) -> None:
        """Refuse publishing ``version_id`` directly when it breaks the published version."""
        draft = await self.store.get_version(session, version_id)
        if draft is None or draft.status != "draft":
            return  # the versioner names that refusal
        base = await self.store.get_active_version(session, draft.model_id)
        found = classify(base, draft)
        if found.classification == "breaking":
            raise refusal(found)

    async def publish(
        self,
        session: AsyncSession,
        *,
        model: GraphModel,
        actor_id: str | None,
        why: str = "",
        version: str | None = None,
        review_id: str | None = None,
        bound: Sequence[BoundDataset] = (),
        scan: dict | None = None,
    ) -> GraphVersion:
        """Publish the draft as the next version — refused when breaking, unless a review carries it.

        ``review_id`` is the migration run's: the review was approved, so the
        breaking check has already been answered by a person. ``bound`` is the
        model's dataset bindings and ``scan`` the migration run's; the version
        keeps which bound datasets the publish touched and how many of their
        rows now fail, and History reads that back as the effect after.
        """
        draft, base = await self.draft_and_base(session, model=model)
        staged = collect(base, draft)
        if not staged.can_commit:
            raise ConflictError({"error": "nothing_staged", "message": staged.reason})
        found = classify(base, draft)
        if review_id is None and found.classification == "breaking":
            raise refusal(found)
        affected = affected_datasets(bound, found.changes, scan)
        try:
            published = await Versioner(self.store).activate(
                session, version_id=draft.id, override_version=version, change_summary=why
            )
        except ValueError as exc:
            raise ConflictError({"error": "invalid_operation", "message": str(exc)}) from exc
        published = await self.store.get_version(session, published.id)
        published.content_hash = self.content_hash(model, published)
        published.affected_datasets = affected
        details: dict = {
            "version": published.version,
            "committed": staged.count,
            "content_hash": published.content_hash,
            "changes": [c.id for c in staged.changes],
            "datasets": [a["dataset_id"] for a in affected],
        }
        if why:
            details["why"] = why
        if review_id:
            details["review_id"] = review_id
        await emit_event(
            session,
            action=actions.MODEL_COMMIT,
            target_kind=actions.TARGET_MODEL,
            target_id=model.id,
            graph_id=model.graph_id,
            actor_id=actor_id,
            details=details,
        )
        await session.flush()
        return published

    async def migrate(
        self,
        session: AsyncSession,
        *,
        reader: BaseDataReaderQuerySet,
        model_id: str,
        version_id: str,
        base_version_id: str | None,
        review_id: str | None,
        apply: bool,
        actor_id: str | None,
        bound: Sequence[BoundDataset] = (),
    ) -> dict:
        """The migration run's one act: scan, and — applying an approved review — publish.

        Previewing records the scan on the review (or only returns it, for a dry
        run with no review). Applying first checks that neither the draft nor the
        published version moved since the review was requested; either moved,
        the review is ``stale`` and nothing is published. Records are
        never written: the ones that fail are listed in the result.
        """
        review = await self.reviews.get(session, review_id=review_id) if review_id else None
        model = await self.store.get_graph_model(session, model_id)
        draft = await self.store.get_version(session, version_id)
        if model is None or draft is None or draft.model_id != model_id:
            raise NotFoundError({"error": "version_not_found", "version_id": version_id})
        base = await self.store.get_version(session, base_version_id) if base_version_id else None
        out: dict = {"classification": "additive", "preview": {}, "published_version": None, "failed": 0}

        if apply:
            if review is None:
                raise ConflictError({"error": "review_required", "message": "Only an approved review applies."})
            active = await self.store.get_active_version(session, model_id)
            moved = draft.status != "draft" or self.content_hash(model, draft) != review.draft_hash
            if moved or (active.id if active else None) != base_version_id:
                what = "the draft changed" if moved else "another version was published"
                await self.close_review(session, review, status="stale", reason=f"Not published: {what} after review.")
                return {**out, "classification": review.classification}

        found = classify(base, draft)
        scan = await self.scanner.scan(
            reader,
            base=base,
            draft=draft,
            changes=found.changes,
            validation_mode=model.validation_mode,
            list_failures=apply,
        )
        out.update(classification=found.classification, preview=scan, failed=scan["would_fail"])
        if review is not None and not apply:
            review.preview = scan
        if apply and review is not None:
            published = await self.publish(
                session,
                model=model,
                actor_id=review.requested_by_id,
                why=review.why,
                review_id=review.id,
                bound=bound,
                scan=scan,
            )
            review.result = scan
            review.published_version = published.version
            review.status = "published"
            out["published_version"] = published.version
        await session.flush()
        return out

    async def note_refusal(self, session: AsyncSession, *, review_id: str | None, reason: str) -> None:
        """Keep the guardrails' refusal on the review, so its end names what refused it."""
        review = await self.reviews.get(session, review_id=review_id) if review_id else None
        if review is not None:
            review.reason = reason
            await session.flush()

    async def close_review(
        self, session: AsyncSession, review: ModelPublishReview, *, status: str, reason: str
    ) -> None:
        """End a review without a publish, and say so in the events."""
        review.status, review.reason = status, reason
        await emit_event(
            session,
            action=actions.MODEL_REVIEW,
            target_kind=actions.TARGET_MODEL,
            target_id=review.model_id,
            graph_id=review.graph_id,
            actor_kind=ActorKind.system,
            details={"review_id": review.id, "status": status, "reason": reason},
        )
        await session.flush()
