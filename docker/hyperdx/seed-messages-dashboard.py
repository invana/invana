#!/usr/bin/env python3
"""Seed the "Invana — Messages API & Performance" dashboard into local HyperDX.

HyperDX-local (the ``telemetry`` compose profile) stores its app state (dashboards)
in ephemeral container state — ``docker-compose-infra.yml`` mounts no data volume for
the ``hyperdx`` service — so a ``down``/recreate wipes any dashboard built in the UI.
This script rebuilds it from code against the local HyperDX API.

It is **idempotent**: any existing dashboard with the same name is deleted first,
then recreated. Connection + trace-source IDs are discovered at runtime (they are
seeded per-instance), so nothing is hard-coded.

Usage (HyperDX must be up — ``docker compose -f docker-compose-infra.yml --profile
telemetry up -d``):

    python3 docker/hyperdx/seed-messages-dashboard.py
    # custom host:  HYPERDX_URL=http://localhost:8080 python3 …/seed-messages-dashboard.py

Every tile is a raw-SQL tile over the OTel ``otel_traces`` table (ServiceName
``invana-engine``). Message API calls are the request spans whose name ends in
``/messages``; the LLM / graph-query / stage panels read the child spans
(``llm.generate``, ``graph.query.db_execute``) the engine emits (RFC-025/041).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("HYPERDX_URL", "http://localhost:8080").rstrip("/")
NAME = "Invana — Messages API & Performance"

# Spans: the message send endpoint (route template ends in /messages), the whole
# messages endpoint family, and the perf stages nested inside a request.
MSG = "ServiceName='invana-engine' AND SpanName LIKE 'POST %/sessions/%/messages'"
FAM = "ServiceName='invana-engine' AND SpanName LIKE 'POST %/sessions/%'"

DUR = {"output": "duration", "factor": 0.000000001}  # nanoseconds → human time
NUM = {"output": "number", "thousandSeparated": True}


def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15) as r:
        return json.load(r)


def _discover() -> tuple[str, str]:
    """Return (connectionId, tracesSourceId) from the running HyperDX."""
    conn = _get("/api/connections")
    connection_id = conn[0]["id"]
    traces = next(s for s in _get("/api/sources") if s.get("kind") == "trace")
    return connection_id, traces["id"]


def _tile(name, x, y, w, h, disp, sql, *, connection, source, number_format=None):
    cfg = {
        "configType": "sql",
        "displayType": disp,
        "name": name,
        "connection": connection,
        "source": source,
        "sqlTemplate": sql,
    }
    if number_format:
        cfg["numberFormat"] = number_format
    return {"id": os.urandom(12).hex(), "x": x, "y": y, "w": w, "h": h, "config": cfg}


def _build_tiles(connection: str, source: str) -> list[dict]:
    t = lambda *a, **k: _tile(*a, connection=connection, source=source, **k)  # noqa: E731
    return [
        t("Message API calls", 0, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Errors", 6, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {MSG} AND StatusCode='Error' AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Latency p95", 12, 0, 6, 3, "number",
          f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp)", number_format=DUR),
        t("Latency median", 18, 0, 6, 3, "number",
          f"SELECT quantile(0.5)(Duration) FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp)", number_format=DUR),

        t("Call volume over time", 0, 3, 12, 4, "line",
          f"SELECT $__timeInterval(Timestamp) AS t, count() AS calls FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t"),
        t("Latency over time (p50/p95/p99)", 12, 3, 12, 4, "line",
          f"SELECT $__timeInterval(Timestamp) AS t, quantile(0.5)(Duration) AS p50, quantile(0.95)(Duration) AS p95, quantile(0.99)(Duration) AS p99 FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t", number_format=DUR),

        t("By endpoint", 0, 7, 12, 5, "table",
          f"SELECT SpanName AS endpoint, count() AS calls, round(quantile(0.95)(Duration)/1e6,0) AS p95_ms, countIf(StatusCode='Error') AS errors FROM otel_traces WHERE {FAM} AND $__timeFilter(Timestamp) GROUP BY endpoint ORDER BY calls DESC LIMIT 20"),
        t("Slowest recent message calls", 12, 7, 12, 5, "table",
          f"SELECT Timestamp, round(Duration/1e6,0) AS ms, StatusCode AS status, TraceId FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp) ORDER BY Duration DESC LIMIT 20"),

        t("LLM time p95", 0, 12, 6, 3, "number",
          "SELECT quantile(0.95)(Duration) FROM otel_traces WHERE ServiceName='invana-engine' AND SpanName='llm.generate' AND $__timeFilter(Timestamp)", number_format=DUR),
        t("Graph query time p95", 6, 12, 6, 3, "number",
          "SELECT quantile(0.95)(Duration) FROM otel_traces WHERE ServiceName='invana-engine' AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp)", number_format=DUR),
        t("Top 5 slowest engine stages (by total time)", 12, 12, 12, 5, "table",
          "SELECT SpanName AS stage, count() AS calls, round(quantile(0.95)(Duration)/1e6,1) AS p95_ms, round(sum(Duration)/1e9,1) AS total_s FROM otel_traces WHERE ServiceName='invana-engine' AND $__timeFilter(Timestamp) GROUP BY stage ORDER BY total_s DESC LIMIT 5"),
    ]


def _delete_existing() -> None:
    for d in _get("/api/dashboards"):
        if d.get("name") == NAME:
            req = urllib.request.Request(f"{BASE}/api/dashboards/{d['id']}", method="DELETE")
            try:
                urllib.request.urlopen(req, timeout=15).read()
                print(f"deleted existing dashboard {d['id']}")
            except urllib.error.HTTPError as e:  # best-effort; keep going
                print(f"warning: could not delete {d['id']} ({e.code})")


def main() -> None:
    connection, source = _discover()
    _delete_existing()
    body = {"name": NAME, "tiles": _build_tiles(connection, source), "tags": ["invana", "messages"]}
    req = urllib.request.Request(
        f"{BASE}/api/dashboards",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            resp = json.load(r)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:2000])
        raise SystemExit(1) from e
    dash_id = resp.get("id") or resp.get("_id")
    print(f"created '{resp.get('name')}' — {len(resp.get('tiles', []))} tiles")
    print(f"open: {BASE}/dashboards/{dash_id}")


if __name__ == "__main__":
    main()
