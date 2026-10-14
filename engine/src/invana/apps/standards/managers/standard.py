"""Standards — create, version, apply a file, read.

The Python API for the standard record
(docs/for-developers/modules/bring-data-in/features/standards.md). A standard
belongs to no Graph and **everyone in the install reads every one** — it is a
shared vocabulary, and a private one would be a constraint. Who may *write*:
its creator, or an install Admin until roles land; a ``pack`` is an install
Admin's to create, because a pack is what Invana ships.

**A version is immutable and is the content.** ``publish_version`` normalises
the terms, hashes them in order, refuses an identical hash and points the
standard at the new version. A dataset that claimed an earlier version keeps
it; moving is that dataset's owner's act.

Usage::

    standards = StandardManager()
    std, v1 = await standards.apply(session, payload=StandardCreate(name="iso-3166", terms=[...]), actor=admin)
    std, version = await standards.get_by_ref(session, ref="admin/iso-3166@1")
"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.standards.models import Standard, StandardOrigin, StandardVersion
from invana.apps.standards.querysets import StandardQuerySet, StandardVersionQuerySet
from invana.apps.standards.schemas import (
    StandardCreate,
    StandardRead,
    StandardTerm,
    StandardVersionRead,
)
from invana.apps.standards.terms import normalise_terms, terms_hash
from invana.core.auth.models import User
from invana.core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from invana.core.events import actions
from invana.core.events.services import emit_event

_REF = re.compile(r"^(?P<publisher>[a-z0-9][a-z0-9-]{0,62})/(?P<name>[a-z0-9][a-z0-9-]{0,62})(?:@(?P<version>\d+))?$")


def parse_standard_ref(ref: str) -> tuple[str, str, int | None]:
    """``publisher/name[@v]`` → its parts; anything else is a ValidationError."""
    match = _REF.match(ref.strip())
    if match is None:
        raise ValidationError(f"{ref!r} is not a standard address — expected publisher/name or publisher/name@v.")
    version = match.group("version")
    return match.group("publisher"), match.group("name"), int(version) if version else None


class StandardManager:
    """Stateless. The session is the first argument of every method."""

    standards_qs = StandardQuerySet()
    versions_qs = StandardVersionQuerySet()

    @staticmethod
    def require_owner(standard: Standard, actor: User) -> None:
        if actor.is_superuser or standard.created_by_id == actor.id:
            return
        raise PermissionDeniedError(f"Only the owner of {standard.address} may add a version.")

    # ── reading ──────────────────────────────────────────────────────────────

    async def get(self, session: AsyncSession, *, publisher: str, name: str) -> Standard:
        standard = await self.standards_qs.get_by_address(session, publisher=publisher, name=name)
        if standard is None:
            raise NotFoundError(f"Standard {publisher}/{name} not found.")
        return standard

    async def get_by_ref(self, session: AsyncSession, *, ref: str) -> tuple[Standard, StandardVersion]:
        """The standard and the version *ref* names — its current one when it names none."""
        publisher, name, number = parse_standard_ref(ref)
        standard = await self.get(session, publisher=publisher, name=name)
        if number is not None:
            return standard, await self.get_version(session, standard=standard, version=number)
        current = await self.current(session, standard)
        if current is None:
            raise ConflictError(f"{standard.address} has no version yet.")
        return standard, current

    async def search(self, session: AsyncSession, *, origin: str | None = None, text: str | None = None):
        return await self.standards_qs.search(session, origin=origin, text=text)

    async def current(self, session: AsyncSession, standard: Standard) -> StandardVersion | None:
        if standard.current_version_id is None:
            return None
        return await self.versions_qs.get(session, standard.current_version_id)

    async def by_version_id(self, session: AsyncSession, version_id: str) -> tuple[Standard, StandardVersion] | None:
        version = await self.versions_qs.get(session, version_id)
        if version is None:
            return None
        standard = await self.standards_qs.get(session, version.standard_id)
        return (standard, version) if standard is not None else None

    async def list_versions(self, session: AsyncSession, *, standard: Standard) -> list[StandardVersion]:
        return await self.versions_qs.list_for_standard(session, standard.id)

    async def get_version(self, session: AsyncSession, *, standard: Standard, version: int) -> StandardVersion:
        row = await self.versions_qs.get_by_number(session, standard.id, version)
        if row is None:
            raise NotFoundError(f"Version {version} of {standard.address} not found.")
        return row

    async def read(self, session: AsyncSession, standard: Standard) -> StandardRead:
        current = await self.current(session, standard)
        return StandardRead(
            id=standard.id,
            address=standard.address,
            publisher=standard.publisher,
            name=standard.name,
            title=standard.title,
            description=standard.description,
            origin=standard.origin,
            current_version=current.version if current else None,
            terms=[StandardTerm(**t) for t in (current.terms if current else [])],
            content_hash=current.content_hash if current else None,
            created_by_id=standard.created_by_id,
            created_at=standard.created_at,
            updated_at=standard.updated_at,
        )

    @staticmethod
    def read_version(standard: Standard, version: StandardVersion) -> StandardVersionRead:
        return StandardVersionRead(
            id=version.id,
            standard_id=standard.id,
            address=f"{standard.address}@{version.version}",
            version=version.version,
            terms=[StandardTerm(**t) for t in version.terms or []],
            content_hash=version.content_hash,
            why=version.why,
            published_by_id=version.published_by_id,
            published_at=version.published_at,
        )

    # ── writing ──────────────────────────────────────────────────────────────

    async def create(self, session: AsyncSession, *, payload: StandardCreate, actor: User) -> Standard:
        """The standard, and its v1 when the payload carries terms."""
        if payload.origin == StandardOrigin.pack and not actor.is_superuser:
            raise PermissionDeniedError("Only an install Admin applies a standards pack.")
        publisher = payload.publisher or actor.username.lower()
        if await self.standards_qs.get_by_address(session, publisher=publisher, name=payload.name) is not None:
            raise ConflictError(f"{publisher}/{payload.name} already exists.")
        terms = normalise_terms(_dump(payload.terms)) if payload.terms else None
        standard = Standard(
            publisher=publisher,
            name=payload.name,
            title=payload.title or payload.name,
            description=payload.description,
            origin=payload.origin.value,
            created_by_id=actor.id,
        )
        await self.standards_qs.add(session, standard)
        await emit_event(
            session,
            action=actions.STANDARD_CREATE,
            target_kind=actions.TARGET_STANDARD,
            target_id=standard.id,
            actor_id=actor.id,
            details={"address": standard.address, "origin": standard.origin},
        )
        if terms is not None:
            await self._mint(session, standard=standard, terms=terms, why=payload.why, actor=actor)
        return standard

    async def publish_version(
        self, session: AsyncSession, *, standard: Standard, terms: list[StandardTerm], why: str | None, actor: User
    ) -> StandardVersion:
        """Mint the next version — refused when the terms are unchanged."""
        self.require_owner(standard, actor)
        return await self._mint(session, standard=standard, terms=normalise_terms(_dump(terms)), why=why, actor=actor)

    async def apply(
        self, session: AsyncSession, *, payload: StandardCreate, actor: User
    ) -> tuple[Standard, StandardVersion | None]:
        """A standard file: create it, or mint its next version. ``None`` when unchanged."""
        publisher = payload.publisher or actor.username.lower()
        existing = await self.standards_qs.get_by_address(session, publisher=publisher, name=payload.name)
        if existing is None:
            standard = await self.create(session, payload=payload, actor=actor)
            return standard, await self.current(session, standard)
        if not payload.terms:
            return existing, None
        current = await self.current(session, existing)
        terms = normalise_terms(_dump(payload.terms))
        if current is not None and current.content_hash == terms_hash(terms):
            return existing, None
        return existing, await self.publish_version(
            session, standard=existing, terms=payload.terms, why=payload.why, actor=actor
        )

    async def _mint(
        self, session: AsyncSession, *, standard: Standard, terms: list[dict], why: str | None, actor: User
    ) -> StandardVersion:
        digest = terms_hash(terms)
        current = await self.current(session, standard)
        if current is not None and current.content_hash == digest:
            raise ConflictError(f"unchanged — the terms match {standard.address}@{current.version}.")
        number = await self.versions_qs.highest_version(session, standard.id) + 1
        version = StandardVersion(
            standard_id=standard.id,
            version=number,
            terms=terms,
            content_hash=digest,
            why=why,
            published_by_id=actor.id,
        )
        await self.versions_qs.add(session, version)
        standard.current_version_id = version.id
        await session.flush()
        await emit_event(
            session,
            action=actions.STANDARD_VERSION,
            target_kind=actions.TARGET_STANDARD,
            target_id=standard.id,
            actor_id=actor.id,
            details={
                "address": standard.address,
                "version": number,
                "content_hash": digest,
                "terms": len(terms),
                "why": why,
            },
        )
        return version


def _dump(terms: list[StandardTerm]) -> list[dict]:
    return [t.model_dump(mode="json", exclude_none=True) for t in terms]
