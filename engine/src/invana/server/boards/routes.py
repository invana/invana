"""Paths for graph-scoped Boards, all under
``/api/v1/u/{username}/{graphSlug}/boards``.

Defines no function (migration-plan §4) — path to view, nothing else.

Two address forms, and the difference is [B9](../../../../../docs/for-developers/building-engine/boards-migration.md):
``/{board_id}`` is a board that has a row, ``/{kind}/{subject_id}`` is a declared
board addressed by what it is *of* — which is the only address a live dashboard
has, because it has no row until something is kept.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.boards.schemas import (
    BoardDetail,
    BoardListResponse,
    BoardVersionDetail,
    BoardVersionListResponse,
)
from invana.server.boards import views

boards_router = APIRouter(
    prefix="/api/v1/u/{username}/{graphSlug}/boards",
    tags=["boards"],
)

boards_router.get("", response_model=BoardListResponse)(views.list_boards)
boards_router.post("", response_model=BoardDetail, status_code=status.HTTP_201_CREATED)(views.create_board)

# ── A declared board, by subject. Registered before `/{board_id}` so the two
# static-looking segments are not swallowed by the id route.
boards_router.get("/{kind}/{subject_id}/versions", response_model=BoardVersionListResponse)(views.list_reports)
boards_router.post(
    "/{kind}/{subject_id}/versions",
    response_model=BoardVersionDetail,
    status_code=status.HTTP_201_CREATED,
)(views.save_report)
boards_router.get("/{kind}/{subject_id}/versions/{version_id}", response_model=BoardVersionDetail)(views.get_report)

boards_router.get("/{board_id}", response_model=BoardDetail)(views.get_board)
boards_router.patch("/{board_id}", response_model=BoardDetail)(views.update_board)
boards_router.delete("/{board_id}", status_code=status.HTTP_204_NO_CONTENT)(views.delete_board)

# ── Version history ──────────────────────────────────────────────────────────
boards_router.get("/{board_id}/versions", response_model=BoardVersionListResponse)(views.list_board_versions)
boards_router.post(
    "/{board_id}/versions",
    response_model=BoardVersionDetail,
    status_code=status.HTTP_201_CREATED,
)(views.create_board_version)
boards_router.get("/{board_id}/versions/{version_id}", response_model=BoardVersionDetail)(views.get_board_version)
