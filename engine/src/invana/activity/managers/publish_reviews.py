"""Publish reviews — a breaking model publish, from request to the run that publishes it.

docs/for-developers/modules/connect-and-model/features/publish-review.md. The
modeller classifies and publishes (``PublishManager``); this manager owns the
part that spans bands: it opens the migration runs, asks the Graph's other
owners for an approval, and is the clock's step that moves a review along::

    reviews = PublishReviewManager()
    outcome, run_id = await reviews.publish(session, graph=graph, model=model, user=user, payload=payload)
    # additive → published now, no run; breaking → a review and its preview run
    await session.commit()
    runtime.submit(run_id)                 # the preview starts from committed rows

    run_ids = await reviews.advance_due(session, now=now)   # one clock step

It lives in ``activity`` because it opens runs and raises approvals, and the
modeller sits below both.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from invana.activity.managers.approvals import ApprovalManager
from invana.activity.managers.notifications import InboxManager, Members
from invana.activity.models import Approval, ApprovalStatus, NotificationKind
from invana.apps.datasets.managers import DatasetManager
from invana.apps.datasets.querysets import DatasetBindingQuerySet
from invana.apps.graphs.models import Graph
from invana.apps.graphs.roles import GraphRole
from invana.apps.modeller import links as link_service
from invana.apps.modeller.managers import PublishManager
from invana.apps.modeller.managers.publishing import classify
from invana.apps.modeller.models import GraphModel, ModelPublishReview
from invana.apps.modeller.querysets import PublishReviewQuerySet
from invana.apps.modeller.schemas import (
    ModelPublishClassification,
    ModelPublishOutcome,
    ModelPublishRequest,
    ModelPublishReviewRead,
)
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.runtime import services as run_services
from invana.runtime.models import RunStatus, TaskRun

#: A run in one of these has finished; whether it left its result is the review's to read.
_SETTLED = frozenset({RunStatus.succeeded, RunStatus.failed, RunStatus.cancelled, RunStatus.stopped})


class PublishReviewManager:
    """Stateless. The session is the first argument of every method."""

    reviews = PublishReviewQuerySet()
    publishing = PublishManager()
    approvals = ApprovalManager()
    inbox = InboxManager()
    bindings = DatasetBindingQuerySet()

    # ── the request ─────────────────────────────────────────────────────────

    async def publish(
        self, session: AsyncSession, *, graph: Graph, model: GraphModel, user: User, payload: ModelPublishRequest
    ) -> tuple[ModelPublishOutcome, str | None]:
        """Publish an additive draft now, or open a review for a breaking one.

        Returns the outcome and, for a review, the preview run to submit once
        the caller has committed.
        """
        draft, base = await self.publishing.draft_and_base(session, model=model)
        found = classify(base, draft)
        if found.classification == "additive":
            bound = await DatasetManager().bound_to_model(session, graph_id=graph.id, model_id=model.id)
            version = await self.publishing.publish(
                session, model=model, actor_id=user.id, why=payload.why, version=payload.version, bound=bound
            )
            return ModelPublishOutcome(outcome="published", version=version.version, version_id=version.id), None

        if payload.version:
            raise ValidationError("A reviewed publish takes the version its classification implies; drop `version`.")
        open_review = await self.reviews.open_for_model(session, model_id=model.id)
        if open_review is not None:
            raise ConflictError(
                {
                    "error": "review_open",
                    "review_id": open_review.id,
                    "message": f"This model already has a publish review ({open_review.status}).",
                }
            )
        approver_ids = await self._approvers(session, graph=graph, user=user, named=payload.approvers)
        row = await self.reviews.add(
            session,
            ModelPublishReview(
                graph_id=graph.id,
                model_id=model.id,
                version_id=draft.id,
                base_version_id=base.id if base else None,
                draft_hash=self.publishing.content_hash(model, draft),
                classification=found.classification,
                changes=[c.model_dump() for c in found.changes],
                why=payload.why,
                approver_ids=approver_ids,
                deadline_s=payload.deadline_s,
                requested_by_id=user.id,
                status="previewing",
            ),
        )
        run = await self._open_run(session, graph=graph, model=model, review=row, apply=False, actor_id=user.id)
        row.preview_run_id = run.id
        await self._emit(session, row, actor_id=user.id)
        return ModelPublishOutcome(outcome="review", review=ModelPublishReviewRead.model_validate(row)), run.id

    async def dry_run(
        self, session: AsyncSession, *, graph: Graph, model: GraphModel, actor_id: str | None
    ) -> tuple[ModelPublishClassification, str | None]:
        """Classify the draft and, when it is breaking, open a preview run with no review behind it."""
        draft, base = await self.publishing.draft_and_base(session, model=model)
        found = classify(base, draft)
        if found.classification == "additive":
            return found, None
        run = await run_services.open_model_migration_run(
            session,
            graph=graph,
            model_name=model.name,
            args={"model_id": model.id, "version_id": draft.id, "base_version_id": base.id if base else None},
            actor_id=actor_id,
        )
        return found, run.id

    async def list(self, session: AsyncSession, *, model: GraphModel) -> list[ModelPublishReview]:
        return await self.reviews.for_model(session, model_id=model.id)

    async def get(self, session: AsyncSession, *, model: GraphModel, review_id: str) -> ModelPublishReview:
        row = await self.reviews.get(session, review_id=review_id)
        if row is None or row.model_id != model.id:
            raise NotFoundError({"error": "review_not_found", "review_id": review_id})
        return row

    async def _approvers(self, session: AsyncSession, *, graph: Graph, user: User, named: list[str]) -> list[str]:
        """The owners who may approve: those named, or every owner but the requester."""
        members = await Members.of(session, graph_id=graph.id)
        owners = members.holding(GraphRole.owner.value) - {user.id}
        if named:
            ids = members.ids(named)
            refused = [i for i in ids if i not in owners]
            if refused:
                names = ", ".join(members.usernames(refused)) or ", ".join(named)
                raise ValidationError(f"Approvers must be owners other than you: {names}.")
            return ids
        if not owners:
            holders = ", ".join(members.usernames(sorted(members.holding(GraphRole.owner.value)))) or "none"
            raise ValidationError(f"A breaking publish needs an owner other than you to approve it. Owners: {holders}.")
        return sorted(owners)

    # ── the clock step ──────────────────────────────────────────────────────

    async def advance_due(self, session: AsyncSession, *, now: datetime) -> list[str]:
        """Move every open review one step; the migration runs it opened, to submit after commit."""
        opened: list[str] = []
        for row in await self.reviews.open_locked(session):
            if row.status == "previewing":
                await self._settle_preview(session, row, now=now)
            elif row.status == "pending":
                run_id = await self._settle_approval(session, row)
                if run_id:
                    opened.append(run_id)
            elif row.status == "migrating":
                run = await session.get(TaskRun, row.run_id) if row.run_id else None
                if run is None or run.status in _SETTLED:
                    reason = self._run_reason(run, row, "The migration run ended without publishing.")
                    await self._end(session, row, status="failed", reason=reason)
        return opened

    async def _settle_preview(self, session: AsyncSession, row: ModelPublishReview, *, now: datetime) -> None:
        run = await session.get(TaskRun, row.preview_run_id) if row.preview_run_id else None
        if run is not None and run.status not in _SETTLED:
            return
        if run is None or run.status != RunStatus.succeeded or row.preview is None:
            reason = self._run_reason(run, row, "The preview run ended without a preview.")
            await self._end(session, row, status="failed", reason=reason)
            return
        model = await self.publishing.store.get_graph_model(session, row.model_id)
        base = await self.publishing.store.get_version(session, row.base_version_id) if row.base_version_id else None
        name = model.name if model else row.model_id
        approval = await self.approvals.request(
            session,
            graph_id=row.graph_id,
            subject_kind="model_publish",
            subject_id=row.id,
            title=f"Breaking publish of {name}",
            payload={
                "review_id": row.id,
                "model_id": row.model_id,
                "model": name,
                "from_version": base.version if base else None,
                "why": row.why,
                "changes": [c for c in row.changes if c.get("breaking")],
                "preview": row.preview,
                "readers": await self._readers(session, row),
            },
            approver_ids=row.approver_ids,
            deadline_s=row.deadline_s,
            requested_by_id=row.requested_by_id,
            run_id=row.preview_run_id,
            now=now,
        )
        row.approval_id, row.status = approval.id, "pending"
        await session.flush()

    async def _settle_approval(self, session: AsyncSession, row: ModelPublishReview) -> str | None:
        approval = await session.get(Approval, row.approval_id) if row.approval_id else None
        if approval is None:
            await self._end(session, row, status="failed", reason="Its approval is gone.")
            return None
        if approval.status == ApprovalStatus.pending.value:
            return None
        if approval.status == ApprovalStatus.declined.value:
            note = f": {approval.note}" if approval.note else "."
            await self._end(session, row, status="declined", reason=f"Declined, not published{note}")
            return None
        if approval.status == ApprovalStatus.expired.value:
            await self._end(session, row, status="expired", reason="Nobody decided before the deadline; not published.")
            return None
        graph = await session.get(Graph, row.graph_id)
        model = await self.publishing.store.get_graph_model(session, row.model_id)
        if graph is None or model is None:
            await self._end(session, row, status="failed", reason="The model is gone.")
            return None
        run = await self._open_run(
            session, graph=graph, model=model, review=row, apply=True, actor_id=row.requested_by_id
        )
        row.run_id, row.status = run.id, "migrating"
        await session.flush()
        return run.id

    async def _open_run(
        self,
        session: AsyncSession,
        *,
        graph: Graph,
        model: GraphModel,
        review: ModelPublishReview,
        apply: bool,
        actor_id: str | None,
    ) -> TaskRun:
        return await run_services.open_model_migration_run(
            session,
            graph=graph,
            model_name=model.name,
            args={
                "model_id": review.model_id,
                "version_id": review.version_id,
                "base_version_id": review.base_version_id,
                "review_id": review.id,
                "apply": apply,
            },
            actor_id=actor_id,
        )

    async def _readers(self, session: AsyncSession, row: ModelPublishReview) -> dict:
        """The datasets bound to a type the change touches, and the stitches on one."""
        touched = {c["type"] for c in row.changes if c.get("breaking") and c.get("type")}
        if not touched:
            return {"datasets": [], "stitches": []}
        datasets = [
            {"dataset_id": b.dataset_id, "type": b.type_name}
            for b in await self.bindings.for_graph(session, row.graph_id)
            if b.model_id == row.model_id and b.type_name in touched
        ]
        versions = {v.id for v in await self.publishing.store.list_versions(session, row.model_id)}
        stitches = []
        for link in await link_service.list_links(session, row.graph_id, current=True):
            ends = [(link.source_version_id, link.source_type), (link.target_version_id, link.target_type)]
            hit = [t for vid, t in ends if vid in versions and t in touched]
            if hit:
                stitches.append({"link_id": link.id, "kind": link.kind, "type": hit[0], "status": link.status})
        return {"datasets": datasets, "stitches": stitches}

    @staticmethod
    def _run_reason(run: TaskRun | None, row: ModelPublishReview, default: str) -> str:
        if row.reason:
            return row.reason
        if run is not None and run.error:
            return str(run.error.get("message") or default)
        return default

    async def _end(self, session: AsyncSession, row: ModelPublishReview, *, status: str, reason: str) -> None:
        await self.publishing.close_review(session, row, status=status, reason=reason)
        if row.requested_by_id:
            await self.inbox.tell(
                session,
                user_ids=[row.requested_by_id],
                graph_id=row.graph_id,
                kind=NotificationKind.event.value,
                title=f"Publish review {status}"[:255],
                body=reason,
                approval_id=row.approval_id,
                run_id=row.run_id or row.preview_run_id,
                target_kind=actions.TARGET_MODEL,
                target_id=row.model_id,
            )

    async def _emit(self, session: AsyncSession, row: ModelPublishReview, *, actor_id: str) -> None:
        await emit_event(
            session,
            action=actions.MODEL_REVIEW,
            target_kind=actions.TARGET_MODEL,
            target_id=row.model_id,
            graph_id=row.graph_id,
            actor_id=actor_id,
            details={
                "review_id": row.id,
                "status": row.status,
                "breaking": sum(1 for c in row.changes if c.get("breaking")),
                "why": row.why,
            },
        )
