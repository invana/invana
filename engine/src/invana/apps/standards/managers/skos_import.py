"""SKOS import — a concept scheme becomes a standard
(docs/for-developers/modules/bring-data-in/features/skos-import.md).

Reading and mapping are ``apps.semantic``'s and run off the event loop — a large
vocabulary is seconds of parsing. Writing is the standard's own ``apply`` path:
a new address creates the standard with v1, a known one mints its next version
under the same owner rules, and terms identical to the current version write
nothing. A dry run is the same call with nothing written.

Usage::

    result = await SkosImportManager().import_skos(session, payload=SkosImportRequest(content=ttl), actor=user)
    result.address, result.terms, result.report.skipped
"""

from __future__ import annotations

import asyncio

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.semantic.reader import read_rdf
from invana.apps.semantic.skos import SkosMapping, map_skos
from invana.apps.standards.managers.standard import StandardManager
from invana.apps.standards.schemas import SkosImportRequest, SkosImportResult, StandardCreate, StandardTerm
from invana.apps.standards.terms import normalise_terms, terms_hash
from invana.core.auth.models import User


def _read(payload: SkosImportRequest) -> SkosMapping:
    graph, fmt = read_rdf(payload.content, payload.format)
    return map_skos(graph, fmt, scheme=payload.scheme, lang=payload.lang)


class SkosImportManager:
    """Stateless. The session is the first argument of every method."""

    standards = StandardManager()

    async def import_skos(self, session: AsyncSession, *, payload: SkosImportRequest, actor: User) -> SkosImportResult:
        mapped = await asyncio.to_thread(_read, payload)
        terms = normalise_terms(mapped.terms)
        publisher = payload.publisher or actor.username.lower()
        name = payload.name or mapped.slug
        result = SkosImportResult(
            address=f"{publisher}/{name}",
            scheme_iri=mapped.scheme_iri,
            title=mapped.title,
            terms=[StandardTerm(**t) for t in terms],
            report=mapped.report,
        )
        existing = await self.standards.standards_qs.get_by_address(session, publisher=publisher, name=name)
        current = await self.standards.current(session, existing) if existing is not None else None
        result.unchanged = current is not None and current.content_hash == terms_hash(terms)
        if payload.dry_run:
            return result
        if existing is not None and not result.unchanged:
            self.standards.require_owner(existing, actor)
        standard, version = await self.standards.apply(
            session,
            payload=StandardCreate(
                publisher=publisher,
                name=name,
                title=mapped.title[:255],
                description=mapped.description,
                terms=result.terms,
                why=payload.why or f"Imported from SKOS {mapped.scheme_iri or 'vocabulary'}"[:500],
            ),
            actor=actor,
        )
        result.standard = await self.standards.read(session, standard)
        if version is not None and not result.unchanged:
            result.version = self.standards.read_version(standard, version)
        return result
