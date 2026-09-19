"""Skill rules — create, publish, rename, delete, and the events each one emits.

This is the Python API for Skills. ``server/skills/views.py`` and the CLI both
call it and neither adds a rule of its own (migration-plan §6).

Three things this file deliberately does not do, each a rule from §4.1:

- **no ``fastapi`` import** — it raises ``NotFoundError`` / ``ConflictError``
  and the edge maps them to 404 / 409;
- **no ``select()``** — every query goes through a queryset;
- **no ``session.commit()``** — the request owns the transaction (§18.1).

**Editing is publishing.** There is no path here that rewrites the text of a
version: ``update`` with new prose mints ``version + 1`` and repoints the head,
which is what keeps a step's ``skill_version_id`` resolvable
([SK2 · SK3](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
"""

from __future__ import annotations

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
from invana.core.errors import ConflictError, NotFoundError
from invana.core.events import actions
from invana.core.events.services import current_trace_id, diff_changed_fields, emit_event

#: What lives on a version. Changing any of these publishes.
_VERSIONED = ["description", "content", "when_to_use"]
#: What lives on the skill. Changing it is an edit in place.
_TRACKED = ["name"]


class SkillManager:
    """Stateless. The session is the first argument of every method."""

    querysets = SkillQuerySet()
    versions = SkillVersionQuerySet()

    async def list_for_graph(self, session: AsyncSession, *, graph_id: str) -> list[Skill]:
        return await self.querysets.list_for_graph(session, graph_id)

    async def get(self, session: AsyncSession, *, skill_id: str, graph_id: str) -> Skill:
        """Fetch one Skill, scoped to its Graph.

        A Skill in another Graph reads as absent rather than forbidden — the
        caller must not learn that the id exists.
        """
        skill = await self.querysets.get(session, skill_id)
        if skill is None or skill.graph_id != graph_id:
            raise NotFoundError("Skill not found.")
        return skill

    # ── versions ─────────────────────────────────────────────────────────────

    async def list_versions(self, session: AsyncSession, *, skill: Skill) -> list[SkillVersion]:
        return await self.versions.list_for_skill(session, skill.id)

    async def get_version(self, session: AsyncSession, *, skill: Skill, version: int) -> SkillVersion:
        row = await self.versions.get_by_number(session, skill.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of '{skill.name}' not found.")
        return row

    async def diff_version(self, session: AsyncSession, *, skill: Skill, version: int) -> SkillVersionDiff:
        """One version against the one before it, field by field.

        Unified diff lines, computed here rather than on each surface — the
        version bar, the CLI and any other reader must agree about what changed.
        """
        current = await self.get_version(session, skill=skill, version=version)
        previous = await self.versions.get_by_number(session, skill.id, version - 1) if version > 1 else None

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

    async def publish(
        self,
        session: AsyncSession,
        *,
        skill: Skill,
        payload: SkillVersionPublish,
        actor_id: str,
    ) -> SkillVersion:
        """Mint the next version and point the skill at it.

        Fields left unset carry over from the head, so publishing a one-line
        change to ``when_to_use`` does not require resending the body.
        """
        head = skill.current_version
        text = {
            field: (getattr(payload, field) if getattr(payload, field) is not None else getattr(skill, field))
            for field in _VERSIONED
        }
        number = await self.versions.highest_version(session, skill.id) + 1
        version = SkillVersion(skill_id=skill.id, version=number, published_by_id=actor_id, **text)
        await self.versions.add(session, version)

        skill.current_version = version
        await session.flush()

        changed = (
            diff_changed_fields(
                {f: getattr(head, f) for f in _VERSIONED},
                text,
                fields=_VERSIONED,
            )
            if head is not None
            else {}
        )
        await emit_event(
            session,
            action=actions.SKILL_PUBLISH,
            target_kind=actions.TARGET_SKILL,
            target_id=skill.id,
            graph_id=skill.graph_id,
            actor_id=actor_id,
            details={"name": skill.name, "version": number, "changed": changed},
            trace_id=current_trace_id(),
        )
        return version

    # ── the skill ────────────────────────────────────────────────────────────

    async def create(
        self,
        session: AsyncSession,
        *,
        graph_id: str,
        payload: SkillCreate,
        actor_id: str,
    ) -> Skill:
        """The skill and its v1, as one act — a skill with no version is not a state."""
        skill = Skill(graph_id=graph_id, name=payload.name)
        try:
            await self.querysets.add(session, skill)
        except IntegrityError as exc:
            raise ConflictError(f"A skill named '{payload.name}' already exists in this Graph.") from exc

        version = SkillVersion(
            skill_id=skill.id,
            version=1,
            description=payload.description,
            content=payload.content,
            when_to_use=payload.when_to_use,
            published_by_id=actor_id,
        )
        await self.versions.add(session, version)
        skill.current_version = version
        await session.flush()

        await emit_event(
            session,
            action=actions.SKILL_CREATE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill.id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"name": skill.name, "version": 1},
            trace_id=current_trace_id(),
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
        """A rename edits the row; new prose publishes the next version.

        Both in one request is one rename event and one publish event, because
        they are two different facts about two different records.
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
                trace_id=current_trace_id(),
            )

        # Prose that is sent but unchanged is not a publish: republishing
        # identical text would start a new usage count for no reason (US3).
        wanted = {f: getattr(payload, f) for f in _VERSIONED}
        if any(v is not None and v != getattr(skill, f) for f, v in wanted.items()):
            await self.publish(
                session,
                skill=skill,
                payload=SkillVersionPublish(**wanted),
                actor_id=actor_id,
            )
        return skill

    async def delete(self, session: AsyncSession, *, skill: Skill, actor_id: str) -> None:
        # Read the fields before the row goes: the event outlives the subject
        # it describes (10.2 — "the subject's name is captured at write").
        name, graph_id, skill_id = skill.name, skill.graph_id, skill.id
        # The head FK is SET NULL and the versions CASCADE, so the pointer has
        # to go first or the delete order decides whether this works.
        skill.current_version = None
        await session.flush()
        await self.querysets.delete(session, skill)
        await emit_event(
            session,
            action=actions.SKILL_DELETE,
            target_kind=actions.TARGET_SKILL,
            target_id=skill_id,
            graph_id=graph_id,
            actor_id=actor_id,
            details={"name": name},
            trace_id=current_trace_id(),
        )
