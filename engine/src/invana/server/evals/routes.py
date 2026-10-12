"""Paths for eval sets, cases, runs, promotion, drift and the eval budget, under
``/api/v1/u/{username}/{graphSlug}/evals``.

One shape for both subjects — ``skill`` and ``agent`` — so Studio and the CLI
read one set of routes (docs/for-developers/modules/skills/features/evals.md).

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.runtime.schemas import (
    EvalBudgetRead,
    EvalCaseRead,
    EvalDriftResponse,
    EvalRunDetail,
    EvalRunOpened,
    EvalRunRead,
    EvalSetRead,
)
from invana.server.evals import views

evals_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/evals", tags=["evals"])

evals_router.get("/budget", response_model=EvalBudgetRead)(views.get_budget)
evals_router.put("/budget", response_model=EvalBudgetRead)(views.put_budget)
evals_router.post("/promote", response_model=EvalCaseRead, status_code=status.HTTP_201_CREATED)(views.promote)
evals_router.post("/drift", response_model=EvalDriftResponse, status_code=status.HTTP_202_ACCEPTED)(views.drift)
evals_router.get("/{subject_kind}/{subject_id}", response_model=EvalSetRead)(views.get_set)
evals_router.put("/{subject_kind}/{subject_id}", response_model=EvalSetRead)(views.put_set)
evals_router.post(
    "/{subject_kind}/{subject_id}/cases", response_model=EvalCaseRead, status_code=status.HTTP_201_CREATED
)(views.add_case)
evals_router.post(
    "/{subject_kind}/{subject_id}/propose", response_model=list[EvalCaseRead], status_code=status.HTTP_201_CREATED
)(views.propose)
evals_router.patch("/{subject_kind}/{subject_id}/cases/{case_id}", response_model=EvalCaseRead)(views.update_case)
evals_router.delete("/{subject_kind}/{subject_id}/cases/{case_id}", status_code=status.HTTP_204_NO_CONTENT)(
    views.delete_case
)
evals_router.post(
    "/{subject_kind}/{subject_id}/runs", response_model=EvalRunOpened, status_code=status.HTTP_202_ACCEPTED
)(views.open_run)
evals_router.get("/{subject_kind}/{subject_id}/runs", response_model=list[EvalRunRead])(views.list_runs)
evals_router.get("/{subject_kind}/{subject_id}/runs/{run_id}", response_model=EvalRunDetail)(views.get_run)
