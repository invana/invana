"""starlette-admin views for the Workers tables.

Pools, workers and their events are written by the product (the gateway and the
Workers page); these exist so somebody debugging an install can see the rows.
``credential_hash`` and ``previous_credential_hash`` are excluded — a hash is
still a credential lookup key.
"""

from __future__ import annotations

from starlette_admin.contrib.sqla import ModelView


class WorkerPoolView(ModelView):
    label = "Worker pools"
    icon = "fa fa-layer-group"
    fields = [
        "id",
        "name",
        "runs_on",
        "labels",
        "slots_per_worker",
        "plugins",
        "secrets",
        "egress",
        "set_by",
        "replicas",
        "created_by_id",
        "created_at",
    ]
    search_fields = ["name"]


class WorkerView(ModelView):
    label = "Workers"
    icon = "fa fa-server"
    # A worker row is the gateway's; a hand edit would desync it from its queue worker.
    can_create = False
    fields = [
        "id",
        "pool_id",
        "name",
        "node",
        "version",
        "labels",
        "plugins",
        "slots",
        "state",
        "slots_busy",
        "cpu",
        "queue_worker_id",
        "joined_via",
        "joined_at",
        "last_heartbeat_at",
        "from_ip",
        "redelivered",
    ]
    search_fields = ["name", "node", "state"]


class WorkerEventView(ModelView):
    label = "Worker events"
    icon = "fa fa-clock-rotate-left"
    can_create = False
    can_edit = False
    fields = ["id", "pool_id", "worker_id", "change", "detail", "why", "actor_id", "at"]
    search_fields = ["change", "why"]


class WorkerStatView(ModelView):
    label = "Worker stats"
    icon = "fa fa-chart-line"
    can_create = False
    can_edit = False
    fields = [
        "pool_id",
        "at",
        "workers",
        "starting",
        "lost",
        "slots",
        "slots_busy",
        "ready",
        "oldest_s",
        "envelopes",
        "suggested",
    ]
