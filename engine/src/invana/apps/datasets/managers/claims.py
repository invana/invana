"""Claims across the install — every standard every readable dataset claims, and the validation queue.

The Python API behind ``GET /api/v1/datasets/claims`` and ``GET
/api/v1/datasets/validation``
(docs/for-developers/modules/bring-data-in/features/standards.md). Both read
the datasets the reader may read — the catalogue's rule — and each dataset's
claims with the current version's conformance, so Studio asks once instead of
once per dataset.

**The counts are the engine's.** ``claims`` returns ``total`` and the claims per
standard address; ``validation`` returns ``total`` as the sum of each claim's
``violation_count`` — the whole, though a conformance row keeps only the first
50 violations as items — and each dataset's own total. A dataset whose claims
cannot be read (its pinned standard version is gone) is counted in
``unreadable``, never hidden and never fatal to the rest.

Usage::

    claims = ClaimsManager()
    await claims.claims(session, reader=user, standard="admin/iso-3166")
    queue = await claims.validation(session, reader=user)
    queue.total, [d.total for d in queue.datasets]
"""

from __future__ import annotations

from collections import Counter

from sqlalchemy.ext.asyncio import AsyncSession

from invana.apps.datasets.managers.conformance import ConformanceManager
from invana.apps.datasets.managers.dataset import DatasetManager
from invana.apps.datasets.models import Dataset
from invana.apps.datasets.schemas import (
    DatasetClaim,
    DatasetClaimListResponse,
    DatasetStandardRead,
    ValidationDataset,
    ValidationItem,
    ValidationQueue,
)
from invana.core.auth.models import User
from invana.core.errors import NotFoundError


class ClaimsManager:
    """Stateless. The session is the first argument of every method."""

    datasets = DatasetManager()
    conformance = ConformanceManager()

    async def _claims_of(
        self, session: AsyncSession, *, reader: User
    ) -> tuple[list[tuple[Dataset, list[DatasetStandardRead]]], int]:
        """Each readable dataset with its claims read, and how many could not be read."""
        out: list[tuple[Dataset, list[DatasetStandardRead]]] = []
        unreadable = 0
        for dataset in await self.datasets.catalogue(session, reader=reader):
            try:
                out.append((dataset, (await self.conformance.list_attachments(session, dataset=dataset)).items))
            except NotFoundError:
                unreadable += 1
        return out, unreadable

    async def claims(
        self, session: AsyncSession, *, reader: User, standard: str | None = None
    ) -> DatasetClaimListResponse:
        """Every claim on every dataset *reader* may read; *standard* (``publisher/name``) narrows it."""
        read, unreadable = await self._claims_of(session, reader=reader)
        items: list[DatasetClaim] = []
        for dataset, attachments in read:
            matching = [a for a in attachments if standard is None or _address(a.standard) == standard]
            if matching:
                dataset_read = await self.datasets.read(session, dataset)
                items.extend(DatasetClaim(dataset=dataset_read, attachment=a) for a in matching)
        return DatasetClaimListResponse(
            items=items,
            total=len(items),
            by_standard=dict(Counter(_address(c.attachment.standard) for c in items)),
            unreadable=unreadable,
        )

    async def validation(self, session: AsyncSession, *, reader: User) -> ValidationQueue:
        """Every violation on the current version of every dataset *reader* may read."""
        read, unreadable = await self._claims_of(session, reader=reader)
        items: list[ValidationItem] = []
        datasets: list[ValidationDataset] = []
        for dataset, attachments in read:
            total = 0
            for a in attachments:
                if a.conformance is None:
                    continue
                total += a.conformance.violation_count
                items.extend(
                    ValidationItem(
                        dataset=dataset.address,
                        standard=a.standard,
                        mode=a.mode,
                        column=a.mapping.get(v.term, v.term),
                        violation=v,
                    )
                    for v in a.conformance.violations
                )
            if total:
                datasets.append(
                    ValidationDataset(
                        address=dataset.address,
                        publisher=dataset.publisher,
                        name=dataset.name,
                        title=dataset.title,
                        total=total,
                    )
                )
        return ValidationQueue(
            items=items, total=sum(d.total for d in datasets), datasets=datasets, unreadable=unreadable
        )


def _address(ref: str) -> str:
    """``publisher/name@v`` → ``publisher/name``."""
    return ref.split("@", 1)[0]
