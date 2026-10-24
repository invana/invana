"""Skill rules — create, publish, rename, delete, and the events each one emits.

This is the Python API for Skills. ``server/skills/views.py`` and the CLI both
call it and neither adds a rule of its own (migration-plan §6).

Three things this file deliberately does not do, each a rule from §4.1:

- **no ``fastapi`` import** — it raises ``NotFoundError`` / ``ConflictError``
  and the edge maps them to 404 / 409;
- **no ``select()``** — every query goes through a queryset;
- **no ``session.commit()``** — the request owns the transaction (§18.1).

**A published version is never rewritten.** New prose lands on the draft, and
publishing the draft mints ``version + 1`` and repoints the head, which is what
keeps a step's ``skill_version_id`` resolvable. ``update`` renames and nothing
else.

**A draft is the one exception, and it is a row.** A version with no
``published_at`` is what a person is still writing
([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)); it
carries the plan being drawn and the clarifications the planner asked, so a
question that suspends survives a reload. Publishing stamps it and moves the
head — text, answers and plan as one act.

**Every version needs a plan** ([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
and this package cannot make one: ``apps/flows`` imports ``apps/agents``,
which imports this package, so importing it here would close a cycle the
import-linter refuses. Callers pass ``plan_id`` in, and the composition lives
one band up in ``runtime/managers/skill_draft.py``.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from difflib import unified_diff

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.skills.models import Skill, SkillVersion
from invana.apps.skills.querysets import SkillQuerySet, SkillVersionQuerySet
from invana.apps.skills.schemas import (
    SkillCreate,
    SkillUpdate,
    SkillVersionDiff,
    SkillVersionFieldDiff,
    SkillVersionPublish,
)
from invana.core.errors import ConflictError, NotFoundError, ValidationError
from invana.core.events import actions
from invana.core.events.models import ActorKind
from invana.core.events.services import diff_changed_fields, emit_event
from invana.core.lists import ListParams, PageInfo

#: What lives on a version. Changing any of these publishes.
_VERSIONED = ["description", "content", "when_to_use"]
#: What a publish diffs: the text, and the model the version pins.
_PUBLISHED = [*_VERSIONED, "model_pin"]
#: What lives on the skill. Changing it is an edit in place.
_TRACKED = ["name"]


class SkillManager:
    """Stateless. The session is the first argument of every method."""

    skills_qs = SkillQuerySet()
    versions_qs = SkillVersionQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Skill]:
        return await self.skills_qs.list_for_graph(session, graph_id)

    async def page_for_graph(
        self, session: AsyncSession, *, graph_id: str, params: ListParams
    ) -> tuple[Sequence[Skill], PageInfo]:
        """One page of the Skills list, searched, filtered and sorted by ``params``."""
        return await self.skills_qs.page_for_graph(session, graph_id, params=params)

    async def get(self, session: AsyncSession, *, skill_id: str, graph_id: str) -> Skill:
        """Fetch one Skill, scoped to its Graph.

        A Skill in another Graph reads as absent rather than forbidden — the
        caller must not learn that the id exists.
        """
        skill = await self.skills_qs.get(session, skill_id)
        if skill is None or skill.graph_id != graph_id:
            raise NotFoundError("Skill not found.")
        return skill

    # ── versions ─────────────────────────────────────────────────────────────

    async def list_versions(self, session: AsyncSession, *, skill: Skill) -> list[SkillVersion]:
        return await self.versions_qs.list_for_skill(session, skill.id)

    async def get_version(self, session: AsyncSession, *, skill: Skill, version: int) -> SkillVersion:
        row = await self.versions_qs.get_by_number(session, skill.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of '{skill.name}' not found.")
        return row

    async def diff_version(self, session: AsyncSession, *, skill: Skill, version: int) -> SkillVersionDiff:
        """One version against the one before it, field by field.

        Unified diff lines, computed here rather than on each surface — the
        version bar, the CLI and any other reader must agree about what changed.
        """
        current = await self.get_version(session, skill=skill, version=version)
        previous = await self.versions_qs.get_by_number(session, skill.id, version - 1) if version > 1 else None

        fields = []
        for field in _VERSIONED:
            after = getattr(current, field)
            before = getattr(previous, field) if previous is not None else ""
            lines = list(
                unified_diff(
                    before.splitlines(),
                    after.splitlines(),
                    fromfile=f"v{version - 1}" if previous is not None else "(nothing)",
                    tofile=f"v{version}",
                    lineterm="",
                )
            )
            fields.append(SkillVersionFieldDiff(field=field, changed=before != after, lines=lines))

        return SkillVersionDiff(
            skill_id=skill.id,
            version=version,
            against_version=previous.version if previous is not None else None,
            fields=fields,
        )

    async def get_draft(self, session: AsyncSession, *, skill: Skill) -> SkillVersion | None:
        """The unpublished row, if the author has one open."""
        return await self.versions_qs.get_draft(session, skill.id)

    async def start_draft(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        plan_id: str,
        payload: SkillVersionPublish | None = None,
        drawn: bool = False,
    ) -> SkillVersion:
        """Open the next version as a draft, seeded from the head's text.

        The number is taken now rather than at publish: the plan, the
        clarifications and the answers all hang off this row's id, and moving
        the number later would mean writing them twice
        ([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

        ``drawn`` says the plan handed in is already the plan of this text —
        a copy of a published version's — so the draft is stamped as drawn
        and publishing it unchanged needs no draw.
        """
        text = {
            field: (
                getattr(payload, field)
                if payload is not None and getattr(payload, field) is not None
                else getattr(skill, field)
            )
            for field in _VERSIONED
        }
        number = await self.versions_qs.highest_version(session, skill.id) + 1
        # The pin carries over from the head like the text does.
        head = skill.current_version
        pin = (
            payload.model_pin
            if payload is not None and "model_pin" in payload.model_fields_set
            else (head.model_pin if head is not None else None)
        )
        draft = SkillVersion(skill_id=skill.id, version=number, plan_id=plan_id, model_pin=pin or None, **text)
        if drawn:
            draft.drawn_digest = draft.digest()
        return await self.versions_qs.add(session, draft)

    async def update_draft(
        self, session: AsyncSession, *, draft: SkillVersion, payload: SkillVersionPublish
    ) -> SkillVersion:
        """Edit the draft's prose. **Refuses a published row** — that is the
        whole claim of a version (SK2), so it is checked here rather than
        trusted to every caller."""
        if not draft.is_draft:
            raise ValidationError("A published version cannot be edited. Publishing mints the next one.")
        for field in _VERSIONED:
            value = getattr(payload, field)
            if value is not None:
                setattr(draft, field, value)
        if "model_pin" in payload.model_fields_set:
            draft.model_pin = payload.model_pin or None
        await session.flush()
        return draft

    async def publish_draft(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        draft: SkillVersion,
        actor_id: str,
        why: str | None = None,
        restored_from: int | None = None,
        evaluated: dict | None = None,
    ) -> SkillVersion:
        """Stamp the draft and move the head — text, answers and plan, one act.

        ``restored_from`` is set by a rollback: the version whose text and plan
        this one copies. It is kept on the row and on the publish event, so the
        change log can say *restored v3* rather than only *changed content*.
        ``evaluated`` is the eval gate's verdict — the eval run it read and any
        warnings published past — kept on the event beside the why.
        """
        if not draft.is_draft:
            raise ValidationError(f"v{draft.version} is already published.")
        head = skill.current_version
        before = {f: getattr(head, f) for f in _PUBLISHED} if head is not None else {}

        draft.published_at = datetime.now(UTC)
        draft.published_by_id = actor_id
        draft.restored_from_version = restored_from
        skill.current_version = draft
        await session.flush()

        changed = (
            diff_changed_fields(before, {f: getattr(draft, f) for f in _PUBLISHED}, fields=_PUBLISHED)
            if head is not None
            else {}
        )
        details = {"name": skill.name, "version": draft.version, "changed": changed, "why": why}
        if restored_from is not None:
            details["restored_from"] = restored_from
        if evaluated is not None:
            details["eval"] = evaluated
        await emit_event(
            session,
            action=actions.SKILL_PUBLISH,
            target_kind=actions.TARGET_SKILL,
            target_id=skill.id,
            graph_id=skill.graph_id,
            actor_id=actor_id,
            details=details,
        )
        return draft

    # ── the skill ────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: SkillCreate,
        actor_id: str | None,
        plan_id: str,
        origin: str = "authored",
        publish: bool = False,
        actor_kind: ActorKind = ActorKind.user,
    ) -> Skill:
        """The skill and its **draft** v1, as one act.

        A new skill is not offered to anything until someone publishes it
        ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)):
        the draft is where the prose is written, where the plan is drawn and
        where a clarification waits for an answer. ``publish=True`` is the
        seeder's path — the product's own playbook arrives finished.
        """
        skill = Skill(graph_id=graph_id, name=payload.name, origin=origin)
        try:
            await self.skills_qs.add(session, skill)
        except IntegrityError as exc:
            raise ConflictError(f"A skill named '{payload.name}' already exists in this Graph.") from exc

        version = SkillVersion(
            skill_id=skill.id,
            version=1,
            description=payload.description,
            content=payload.content,
            when_to_use=payload.when_to_use,
            plan_id=plan_id,
            published_by_id=actor_id if publish else None,
            published_at=datetime.now(UTC) if publish else None,
        )
        await self.versions_qs.add(session, version)
        if publish:
            skill.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.SKILL_CREATE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill.id,
            graph_id=graph_id,
            actor_id=actor_id,
            actor_kind=actor_kind,
            details={"name": skill.name, "version": 1, "origin": origin},
        )
        return skill

    async def update(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        payload: SkillUpdate,
        actor_id: str,
    ) -> Skill:
        """Rename the skill. Prose is never written here.

        The name lives on the skill and changes in place; the words live on a
        version, and only a drawn draft publishes one
        (`runtime.managers.SkillDraftManager`).
        """
        before = {f: getattr(skill, f) for f in _TRACKED}
        for field in _TRACKED:
            value = getattr(payload, field)
            if value is not None:
                setattr(skill, field, value)
        try:
            await session.flush()
        except IntegrityError as exc:
            raise ConflictError(f"A skill named '{skill.name}' already exists in this Graph.") from exc

        changed = diff_changed_fields(before, {f: getattr(skill, f) for f in _TRACKED}, fields=_TRACKED)
        if changed:
            await emit_event(
                session,
                action=actions.SKILL_UPDATE,
                target_kind=actions.TARGET_SKILL,
                target_id=skill.id,
                graph_id=skill.graph_id,
                actor_id=actor_id,
                details={"changed": changed, "name": skill.name},
            )
        return skill

    async def delete(self, session: AsyncSession, *, skill: Skill, actor_id: str) -> None:
        # The product's own playbook is not a row a person can lose (SK25). It
        # is editable — publishing v2 over it is ordinary — but there is no
        # state in which a Graph has no *Answer in natural language*.
        if skill.origin == "builtin":
            raise ValidationError(
                f"'{skill.name}' ships with Invana. Publish a new version over it, or unbind it — it is not deleted."
            )
        # Read the fields before the row goes: the event outlives the subject
        # it describes (10.2 — "the subject's name is captured at write").
        name, graph_id, skill_id = skill.name, skill.graph_id, skill.id
        # The head FK is SET NULL and the versions CASCADE, so the pointer has
        # to go first or the delete order decides whether this works.
        skill.current_version = None
        await session.flush()
        await self.skills_qs.delete(session, skill)
        await emit_event(
            session,
            action=actions.SKILL_DELETE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"name": name},
        )
