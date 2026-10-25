"""Policies — list, read, draft, save as versions, delete, and the six managed ones.

docs/for-developers/modules/identity-and-access/features/policies.md. The rules
every front-end shares:

- a custom or boundary policy is created as a **draft** (version 0), held by
  nobody and deciding nothing; *Save* makes it version 1 and writes a
  ``policy_versions`` row;
- editing a saved policy saves a new version at once — there is no draft of a
  saved policy;
- statements are checked against the grammar (``core/policy.py``) and a bad one
  is refused naming the problem; a name is unique per Graph;
- a managed policy is written by the engine from ``apps/iam/managed.py`` and is
  never edited or deleted; an inline policy belongs to its token;
- deleting a policy deletes its attachments; every change is an event.

Used by the routes and by ``invana iam``::

    policies = PolicyManager()
    draft = await policies.create(session, graph_id=g, payload=PolicyCreate(name="fare-read", ...), actor_id=me)
    saved = await policies.save(session, graph_id=g, name="fare-read", why="first cut", actor_id=me)
    await policies.ensure_managed(session, graph_id=g)

Who may call a write is the route's guard (the ``iam`` area); the manager does
not re-check the actor's role. ``get`` reads it, to say whether the caller may
edit.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.graphs.roles import GraphRole, holds
from invana.apps.iam.managed import MANAGED, MANAGED_BY_NAME, MANAGED_NAMES
from invana.apps.iam.managers.attachments import AttachmentManager, GraphHolders
from invana.apps.iam.managers.holdings import HoldingsManager
from invana.apps.iam.models import Policy, PolicyKind, PolicyStatus, PolicyVersion
from invana.apps.iam.querysets.people import PeopleQuerySet
from invana.apps.iam.querysets.policies import PolicyQuerySet
from invana.apps.iam.schemas import (
    LayerRead,
    Limits,
    PolicyCreate,
    PolicyRead,
    PolicyRow,
    PolicyUpdate,
    PolicyVersionRead,
    StatementIn,
    StatementRead,
)
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event
from invana.core.lists import ListParams, PageInfo
from invana.core.policy import LAYERS, StatementError, parse_statements, summary

EDITABLE_KINDS = frozenset({PolicyKind.custom.value, PolicyKind.boundary.value})

#: The Policies list's order by name: managed, custom, inline, then boundary.
_KIND_ORDER = {kind: i for i, kind in enumerate(("managed", "custom", "inline", "boundary"))}


def checked_statements(raw: list[StatementIn] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Statements in their stored shape, or ``ValidationError`` naming what is outside the grammar."""
    items = [s.model_dump() if isinstance(s, StatementIn) else s for s in raw]
    try:
        return [s.as_dict() for s in parse_statements(items)]
    except StatementError as exc:
        raise ValidationError(str(exc)) from exc


def stored_limits(limits: Limits | None) -> dict[str, Any]:
    """Only the ceilings that are set."""
    return limits.model_dump(exclude_defaults=True) if limits is not None else {}


def what_it_allows(policy: Policy) -> str:
    managed = MANAGED_BY_NAME.get(policy.name) if policy.kind == PolicyKind.managed.value else None
    if managed is not None:
        return managed.summary
    try:
        return summary(parse_statements(policy.statements)) or "nothing"
    except StatementError:
        return "—"


class PolicyManager:
    """Stateless. The session is the first argument of every method."""

    qs = PolicyQuerySet()
    people_qs = PeopleQuerySet()
    attachments = AttachmentManager()

    # ── reads ────────────────────────────────────────────────────────────────

    async def page(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[list[PolicyRow], PageInfo, dict[str, int]]:
        """One page of the Policies list, each row with who holds it, and counts per kind."""
        rows, info = await self.qs.page(session, graph_id=graph_id, params=params)
        ctx = await self.attachments.graph_holders(session, graph_id=graph_id)
        names = await self.people_qs.usernames(session, ids=[r.updated_by_id or r.created_by_id for r in rows])
        kinds = await self.qs.kind_counts(session, graph_id=graph_id)
        kinds["all"] = sum(kinds.values())
        if params.sort_key == "name" and not params.descending and info.next_cursor is None and params.after() is None:
            rows = sorted(rows, key=lambda p: (_KIND_ORDER.get(p.kind, len(_KIND_ORDER)), p.name))
        return [self._row(p, ctx, names) for p in rows], info, kinds

    def _row(self, policy: Policy, ctx: GraphHolders, names: dict[str, str]) -> PolicyRow:
        changer = policy.updated_by_id or policy.created_by_id
        managed = policy.kind == PolicyKind.managed.value
        return PolicyRow(
            id=policy.id,
            name=policy.name,
            kind=policy.kind,
            status=policy.status,
            summary=what_it_allows(policy),
            statement_count=len(policy.statements or []),
            held_by=ctx.held_by(policy),
            changed_by=None if managed else (names.get(changer) if changer else None),
            changed_at=None if managed else policy.updated_at,
        )

    async def get_row(self, session: AsyncSession, *, graph_id: str, name: str) -> Policy:
        policy = await self.qs.get_by_name(session, graph_id=graph_id, name=name)
        if policy is None:
            raise NotFoundError(f"No policy {name!r} in this Graph.")
        return policy

    async def get(self, session: AsyncSession, *, graph_id: str, name: str, actor_id: str | None) -> PolicyRead:
        return await self.read(
            session,
            graph_id=graph_id,
            policy=await self.get_row(session, graph_id=graph_id, name=name),
            actor_id=actor_id,
        )

    async def read(self, session: AsyncSession, *, graph_id: str, policy: Policy, actor_id: str | None) -> PolicyRead:
        """The policy page: statements by layer, limits, who holds it, and whether the caller may edit."""
        ctx = await self.attachments.graph_holders(session, graph_id=graph_id)
        names = await self.people_qs.usernames(
            session, ids=[policy.updated_by_id, policy.created_by_id, policy.owner_id]
        )
        statements = [StatementRead(**s.as_dict(), layer=s.layer) for s in _parsed_or_empty(policy.statements)]
        present = {s.layer for s in statements}
        managed = MANAGED_BY_NAME.get(policy.name) if policy.kind == PolicyKind.managed.value else None
        editable = False
        if actor_id is not None and policy.kind in EDITABLE_KINDS:
            roles = await HoldingsManager().roles_for(session, graph_id=graph_id, user_id=actor_id)
            editable = holds(roles, GraphRole.iam_admin)
        row = self._row(policy, ctx, names)
        return PolicyRead(
            **row.model_dump(),
            description=policy.description,
            version=policy.version,
            owner=names.get(policy.owner_id) if policy.owner_id else None,
            drafted_by=policy.drafted_by,
            statements=statements,
            layers=[LayerRead(layer=n, label=label, line=line) for n, label, line in LAYERS if n in present],
            limits=Limits(**(policy.limits or {})),
            area=managed.area if managed is not None else None,
            editable=editable,
        )

    async def versions(self, session: AsyncSession, *, graph_id: str, name: str) -> list[PolicyVersionRead]:
        policy = await self.get_row(session, graph_id=graph_id, name=name)
        rows = await self.qs.versions(session, policy_id=policy.id)
        names = await self.people_qs.usernames(session, ids=[r.saved_by_id for r in rows])
        return [
            PolicyVersionRead(
                version=r.version,
                saved_by=names.get(r.saved_by_id) if r.saved_by_id else None,
                saved_at=r.saved_at,
                why=r.why,
                statement_count=len(r.statements or []),
                limit_count=len(r.limits or {}),
            )
            for r in rows
        ]

    # ── writes ───────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: PolicyCreate,
        actor_id: str | None,
        drafted_by: str = "person",
    ) -> Policy:
        """A new custom or boundary policy, as a draft."""
        statements = checked_statements(payload.statements)
        if payload.name in MANAGED_NAMES:
            raise ConflictError(f"{payload.name} is a managed policy — built in.")
        if await self.qs.get_by_name(session, graph_id=graph_id, name=payload.name) is not None:
            raise ConflictError(f"A policy named {payload.name} already exists in this Graph.")
        policy = Policy(
            graph_id=graph_id,
            name=payload.name,
            kind=payload.kind,
            status=PolicyStatus.draft.value,
            description=payload.description,
            statements=statements,
            limits=stored_limits(payload.limits),
            version=0,
            owner_id=actor_id,
            drafted_by=drafted_by,
            created_by_id=actor_id,
            updated_by_id=actor_id,
        )
        await self.qs.add(session, policy)
        await self._emit(session, actions.POLICY_CREATE, policy, actor_id, {"drafted_by": drafted_by})
        return policy

    async def update(
        self, session: AsyncSession, *, graph_id: str, name: str, payload: PolicyUpdate, actor_id: str | None
    ) -> Policy:
        """Change a draft in place, or save a saved policy's change as its next version."""
        policy = await self.get_row(session, graph_id=graph_id, name=name)
        self._check_editable(policy)
        if payload.statements is not None:
            policy.statements = checked_statements(payload.statements)
        if payload.limits is not None:
            policy.limits = stored_limits(payload.limits)
        if payload.description is not None:
            policy.description = payload.description
        policy.updated_by_id = actor_id
        if policy.status == PolicyStatus.saved.value:
            await self._new_version(session, policy, why=payload.why, actor_id=actor_id)
        else:
            await session.flush()
            await self._emit(session, actions.POLICY_UPDATE, policy, actor_id, {})
        return policy

    async def save(
        self, session: AsyncSession, *, graph_id: str, name: str, why: str | None, actor_id: str | None
    ) -> Policy:
        """A draft becomes saved, as its first version."""
        policy = await self.get_row(session, graph_id=graph_id, name=name)
        self._check_editable(policy)
        if policy.status == PolicyStatus.saved.value:
            raise ConflictError(f"{policy.name} is already saved; an edit saves its next version.")
        policy.status = PolicyStatus.saved.value
        policy.updated_by_id = actor_id
        await self._new_version(session, policy, why=why, actor_id=actor_id)
        return policy

    async def delete(self, session: AsyncSession, *, graph_id: str, name: str, actor_id: str | None) -> None:
        """Delete a custom or boundary policy; its holders lose it."""
        policy = await self.get_row(session, graph_id=graph_id, name=name)
        self._check_editable(policy)
        await self._emit(session, actions.POLICY_DELETE, policy, actor_id, {"kind": policy.kind})
        await self.qs.delete(session, policy)

    async def ensure_managed(self, session: AsyncSession, *, graph_id: str) -> list[Policy]:
        """Write the six managed policies, or rewrite them from the code where they drifted."""
        existing = await self.qs.managed(session, graph_id=graph_id)
        out: list[Policy] = []
        for m in MANAGED:
            statements = [dict(s) for s in m.statements]
            row = existing.get(m.name)
            if row is None:
                row = Policy(
                    graph_id=graph_id,
                    name=m.name,
                    kind=PolicyKind.managed.value,
                    status=PolicyStatus.saved.value,
                    description=m.description,
                    statements=statements,
                    limits={},
                    version=1,
                )
                await self.qs.add(session, row)
            elif row.statements != statements or row.description != m.description:
                row.statements = statements
                row.description = m.description
            out.append(row)
        await session.flush()
        return out

    async def ensure_managed_everywhere(self, session: AsyncSession) -> int:
        """:meth:`ensure_managed` for every Graph — run at startup, so a change to the code reaches each one."""
        ids = await self.qs.graph_ids(session)
        for graph_id in ids:
            await self.ensure_managed(session, graph_id=graph_id)
        return len(ids)

    async def apply_file(
        self, session: AsyncSession, *, graph_id: str, doc: dict[str, Any], why: str | None, actor_id: str | None
    ) -> Policy:
        """Create or change a policy from a YAML file's contents and save it.

        A new name is created and saved as version 1; an existing custom or
        boundary policy saves its next version. A managed or inline name is refused.
        """
        if not isinstance(doc, dict):
            raise ValidationError("A policy file is a mapping: name · kind · description · statements · limits.")
        unknown = sorted(set(doc) - {"name", "kind", "description", "statements", "limits"})
        if unknown:
            raise ValidationError(f"{', '.join(unknown)} is not a policy file key.")
        try:
            payload = PolicyCreate.model_validate(doc)
        except PydanticValidationError as exc:
            first = exc.errors()[0]
            where = ".".join(str(p) for p in first["loc"])
            raise ValidationError(f"{where}: {first['msg']}") from exc
        existing = await self.qs.get_by_name(session, graph_id=graph_id, name=payload.name)
        if existing is None:
            await self.create(session, graph_id=graph_id, payload=payload, actor_id=actor_id)
            return await self.save(session, graph_id=graph_id, name=payload.name, why=why, actor_id=actor_id)
        self._check_editable(existing)
        if existing.kind != payload.kind:
            raise ConflictError(f"{existing.name} is a {existing.kind} policy; the file says {payload.kind}.")
        change = PolicyUpdate(
            description=payload.description,
            statements=payload.statements,
            limits=payload.limits,
            why=why,
        )
        policy = await self.update(session, graph_id=graph_id, name=payload.name, payload=change, actor_id=actor_id)
        if policy.status != PolicyStatus.saved.value:
            policy = await self.save(session, graph_id=graph_id, name=payload.name, why=why, actor_id=actor_id)
        return policy

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _check_editable(policy: Policy) -> None:
        if policy.kind == PolicyKind.managed.value:
            raise ConflictError(f"{policy.name} is a managed policy — built in, and never changed by hand.")
        if policy.kind == PolicyKind.inline.value:
            raise ConflictError(f"{policy.name} is an inline policy; it changes only by minting a new token.")

    async def _new_version(self, session: AsyncSession, policy: Policy, *, why: str | None, actor_id: str | None):
        policy.version = (policy.version or 0) + 1
        await self.qs.add(
            session,
            PolicyVersion(
                policy_id=policy.id,
                version=policy.version,
                statements=list(policy.statements or []),
                limits=dict(policy.limits or {}),
                description=policy.description,
                saved_by_id=actor_id,
                why=why,
            ),
        )
        await self._emit(session, actions.POLICY_SAVE, policy, actor_id, {"version": policy.version, "why": why})

    async def _emit(
        self, session: AsyncSession, action: str, policy: Policy, actor_id: str | None, details: dict[str, Any]
    ) -> None:
        await emit_event(
            session,
            action=action,
            target_kind=actions.TARGET_POLICY,
            target_id=policy.id,
            graph_id=policy.graph_id,
            actor_id=actor_id,
            details={"name": policy.name, **details},
        )


def _parsed_or_empty(raw: list | None):
    try:
        return parse_statements(raw)
    except StatementError:
        return []
