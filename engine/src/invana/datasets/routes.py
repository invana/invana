"""Dataset read endpoints — graph-scoped under /u/{username}/{graphSlug}/datasets.

View-only (RFC-020): list datasets, their import jobs, and each job's status,
counts, validation report, and logs. Imports are triggered by the CLI
(`invana datasets import`); upload-from-UI is deferred.
"""

from __future__ import annotations

from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from invana.datasets.models import Dataset, ImportJob
from invana.datasets.schemas import (
    DatasetResponse,
    DatasetSummary,
    ImportJobResponse,
    ImportJobSummary,
)
from invana.db import get_session
from invana.graphs.deps import require_graph_member, resolve_graph_by_username_slug
from invana.graphs.models import Graph, GraphMember

datasets_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/datasets", tags=["datasets"])


def _latest_status(dataset: Dataset) -> str | None:
    # Dataset.jobs is ordered by created_at ascending → last is most recent.
    return dataset.jobs[-1].status if dataset.jobs else None


def _summary(dataset: Dataset) -> DatasetSummary:
    summary = DatasetSummary.model_validate(dataset)
    summary.latest_status = _latest_status(dataset)
    return summary


async def _get_dataset_or_404(session: AsyncSession, graph_id: str, dataset_id: str) -> Dataset:
    stmt = select(Dataset).where(Dataset.id == dataset_id).options(selectinload(Dataset.jobs))
    dataset = (await session.execute(stmt)).scalar_one_or_none()
    if dataset is None or dataset.graph_id != graph_id:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "dataset_not_found", "dataset_id": dataset_id})
    return dataset


@datasets_router.get("", response_model=list[DatasetSummary])
async def list_datasets(
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[DatasetSummary]:
    stmt = (
        select(Dataset)
        .where(Dataset.graph_id == graph.id)
        .options(selectinload(Dataset.jobs))
        .order_by(Dataset.created_at)
    )
    datasets = (await session.execute(stmt)).scalars().all()
    return [_summary(d) for d in datasets]


@datasets_router.get("/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> DatasetResponse:
    dataset = await _get_dataset_or_404(session, graph.id, dataset_id)
    resp = DatasetResponse.model_validate(dataset)
    resp.latest_status = _latest_status(dataset)
    return resp


@datasets_router.get("/{dataset_id}/jobs", response_model=list[ImportJobSummary])
async def list_jobs(
    dataset_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> list[ImportJobSummary]:
    await _get_dataset_or_404(session, graph.id, dataset_id)
    stmt = select(ImportJob).where(ImportJob.dataset_id == dataset_id).order_by(ImportJob.created_at.desc())
    jobs = (await session.execute(stmt)).scalars().all()
    return [ImportJobSummary.model_validate(j) for j in jobs]


@datasets_router.get("/{dataset_id}/jobs/{job_id}", response_model=ImportJobResponse)
async def get_job(
    dataset_id: str = Path(...),
    job_id: str = Path(...),
    _: GraphMember = Depends(require_graph_member),
    graph: Graph = Depends(resolve_graph_by_username_slug),
    session: AsyncSession = Depends(get_session),
) -> ImportJobResponse:
    await _get_dataset_or_404(session, graph.id, dataset_id)
    job = (
        await session.execute(select(ImportJob).where(ImportJob.id == job_id, ImportJob.dataset_id == dataset_id))
    ).scalar_one_or_none()
    if job is None:
        raise HTTPException(HTTPStatus.NOT_FOUND, detail={"error": "job_not_found", "job_id": job_id})
    return ImportJobResponse.model_validate(job)
