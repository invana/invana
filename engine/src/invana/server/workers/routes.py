"""Paths for Workers, under ``/api/v1/workers`` — install-wide.

docs/for-developers/modules/agents/features/workers.md.

==========================================  =====================================================
GET ``/overview``                           the Pools tab's tiles and chart
GET ``/pools`` · POST ``/pools``            pools with their stored numbers (``Page``) · add one
GET · PATCH ``/pools/{pool_id}``            one pool · its labels, slots, replicas
GET ``/capacity`` · GET ``/events``         ready steps and suggested workers · worker events
GET ``/workers`` · GET ``/workers/{id}``    every worker (``Page``) · one worker
POST ``/workers/{id}/drain``                stop it taking leases
POST ``/pools/{pool_id}/drain``             drain every worker of a pool
GET · POST ``/join-tokens``                 join tokens · mint one (the secret, once)
DELETE ``/join-tokens/{token_id}``          revoke one
GET ``/join-tokens/{token_id}/status``      the *Joined* step's live checks
POST ``/join``                              join token → worker credential
POST ``/heartbeat`` · ``/lease`` · ``/outcome``  the worker's dial-out loop
==========================================  =====================================================

People call the first block signed in (members read, install admins write);
a worker calls the last block with its join token (``/join``) or its own
credential (the rest). Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.apps.workers.schemas import (
    Capacity,
    HeartbeatOut,
    JoinOut,
    JoinStatus,
    JoinTokenCreated,
    JoinTokenPage,
    LeaseOut,
    PoolPage,
    PoolRow,
    PoolsOverview,
    WorkerDetail,
    WorkerEventPage,
    WorkerPage,
)
from invana.server.workers import views

workers_router = APIRouter(prefix="/api/v1/workers", tags=["workers"])

workers_router.get("/overview", response_model=PoolsOverview)(views.overview)
workers_router.get("/pools", response_model=PoolPage)(views.list_pools)
workers_router.post("/pools", response_model=PoolRow, status_code=status.HTTP_201_CREATED)(views.create_pool)
workers_router.get("/pools/{pool_id}", response_model=PoolRow)(views.get_pool)
workers_router.patch("/pools/{pool_id}", response_model=PoolRow)(views.update_pool)
workers_router.post("/pools/{pool_id}/drain", status_code=status.HTTP_204_NO_CONTENT)(views.drain_pool)
workers_router.get("/capacity", response_model=Capacity)(views.capacity)
workers_router.get("/events", response_model=WorkerEventPage)(views.list_events)
workers_router.get("/workers", response_model=WorkerPage)(views.list_workers)
workers_router.get("/workers/{worker_id}", response_model=WorkerDetail)(views.get_worker)
workers_router.post("/workers/{worker_id}/drain", status_code=status.HTTP_204_NO_CONTENT)(views.drain_worker)
workers_router.get("/join-tokens", response_model=JoinTokenPage)(views.list_join_tokens)
workers_router.post("/join-tokens", response_model=JoinTokenCreated, status_code=status.HTTP_201_CREATED)(
    views.create_join_token
)
workers_router.delete("/join-tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)(views.revoke_join_token)
workers_router.get("/join-tokens/{token_id}/status", response_model=JoinStatus)(views.join_status)
workers_router.post("/join", response_model=JoinOut, status_code=status.HTTP_201_CREATED)(views.join)
workers_router.post("/heartbeat", response_model=HeartbeatOut)(views.heartbeat)
workers_router.post("/lease", response_model=LeaseOut, responses={204: {"description": "nothing ready"}})(views.lease)
workers_router.post("/outcome", status_code=status.HTTP_204_NO_CONTENT)(views.outcome)
