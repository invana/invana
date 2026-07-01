#!/usr/bin/env python3
"""Seed the "Invana — API Performance" dashboard into local HyperDX.

HyperDX-local (the ``telemetry`` compose profile) stores its app state (dashboards)
in ephemeral container state — ``docker-compose-infra.yml`` mounts no data volume for
the ``hyperdx`` service — so a ``down``/recreate wipes any dashboard built in the UI.
This script rebuilds it from code against the local HyperDX API.

It is **idempotent**: any existing dashboard with the same name is deleted first,
then recreated. Connection + trace-source IDs are discovered at runtime (they are
seeded per-instance), so nothing is hard-coded.

Usage (HyperDX must be up — ``docker compose -f docker-compose-infra.yml --profile
telemetry up -d``):

    python3 docker/hyperdx/seed-api-performance-dashboard.py
    # custom host:  HYPERDX_URL=http://localhost:8080 python3 …/seed-api-performance-dashboard.py

The dashboard covers **message and query APIs** together:
  - Overview + quick perf stats (calls, p95) for messages, graph queries, LLM, expand.
  - Call volume + latency over time.
  - Per-endpoint breakdown for the query/message API family.
  - Two bottleneck views (top-5 engine stages by total time, top-5 slowest routes by p95).
  - Slowest graph queries + a recent-calls table that drills into the trace on row click.

Every tile is a raw-SQL tile over the OTel ``otel_traces`` table (service
``invana-engine``). "Query APIs" are the endpoints that execute graph queries —
the session message send/run endpoints and the ``explorer/expand/*`` endpoints —
plus the ``graph.query.db_execute`` / ``llm.generate`` child spans the engine emits
(RFC-025/041).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("HYPERDX_URL", "http://localhost:8080").rstrip("/")
NAME = "Invana — API Performance"

# Span filters (otel_traces, ServiceName='invana-engine').
ENG = "ServiceName='invana-engine'"
MSG = f"{ENG} AND SpanName LIKE 'POST %/sessions/%/messages'"  # message send (route template ends /messages)
# The query/message API family: message send + rerun + explorer graph expands.
QAPI = f"{ENG} AND (SpanName LIKE '%/messages' OR SpanName LIKE '%/run' OR SpanName LIKE '%/explorer/expand/%')"

DUR = {"output": "duration", "factor": 0.000000001}  # nanoseconds → human time
NUM = {"output": "number", "thousandSeparated": True}


def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15) as r:
        return json.load(r)


def _discover() -> tuple[str, str]:
    """Return (connectionId, tracesSourceId) from the running HyperDX."""
    connection_id = _get("/api/connections")[0]["id"]
    traces = next(s for s in _get("/api/sources") if s.get("kind") == "trace")
    return connection_id, traces["id"]


def _make(connection: str, source: str):
    def tile(name, x, y, w, h, disp, sql, *, number_format=None, on_click=None):
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
        if on_click:
            cfg["onClick"] = on_click
        return {"id": os.urandom(12).hex(), "x": x, "y": y, "w": w, "h": h, "config": cfg}

    # Row-click handler: open the trace for the clicked row in the /search view.
    trace_drill = {
        "type": "search",
        "target": {"mode": "id", "id": source},
        "whereLanguage": "sql",
        "filters": [{"kind": "expressionTemplate", "expression": "TraceId", "template": "{{TraceId}}"}],
    }
    return tile, trace_drill


def _build_tiles(connection: str, source: str) -> list[dict]:
    t, drill = _make(connection, source)
    return [
        # ── Overview: volume ──────────────────────────────────────────────────
        t("Messages · calls", 0, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Graph queries executed", 6, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {ENG} AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Explorer expand · calls", 12, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {ENG} AND SpanName LIKE '%/explorer/expand/%' AND $__timeFilter(Timestamp)", number_format=NUM),
        t("LLM calls", 18, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {ENG} AND SpanName='llm.generate' AND $__timeFilter(Timestamp)", number_format=NUM),

        # ── Quick perf stats: p95 latency ─────────────────────────────────────
        t("Message p95", 0, 3, 6, 3, "number",
          f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {MSG} AND $__timeFilter(Timestamp)", number_format=DUR),
        t("Graph query p95", 6, 3, 6, 3, "number",
          f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {ENG} AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp)", number_format=DUR),
        t("LLM p95", 12, 3, 6, 3, "number",
          f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {ENG} AND SpanName='llm.generate' AND $__timeFilter(Timestamp)", number_format=DUR),
        t("Expand p95", 18, 3, 6, 3, "number",
          f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {ENG} AND SpanName LIKE '%/explorer/expand/%' AND $__timeFilter(Timestamp)", number_format=DUR),

        # ── Over time ─────────────────────────────────────────────────────────
        t("Call volume over time (messages vs expands)", 0, 6, 12, 4, "line",
          f"SELECT $__timeInterval(Timestamp) AS t, countIf(SpanName LIKE '%/messages') AS messages, "
          f"countIf(SpanName LIKE '%/explorer/expand/%') AS expands FROM otel_traces WHERE {ENG} AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t"),
        t("Latency over time p95 (message vs graph query)", 12, 6, 12, 4, "line",
          f"SELECT $__timeInterval(Timestamp) AS t, quantileIf(0.95)(Duration, SpanName LIKE '%/messages') AS message_p95, "
          f"quantileIf(0.95)(Duration, SpanName='graph.query.db_execute') AS query_p95 FROM otel_traces WHERE {ENG} AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t",
          number_format=DUR),

        # ── Query/message API breakdown ───────────────────────────────────────
        t("Query & message APIs — by endpoint", 0, 10, 12, 5, "table",
          f"SELECT SpanName AS endpoint, count() AS calls, round(quantile(0.95)(Duration)/1e6,0) AS p95_ms, "
          f"countIf(StatusCode='Error') AS errors FROM otel_traces WHERE {QAPI} AND $__timeFilter(Timestamp) GROUP BY endpoint ORDER BY calls DESC LIMIT 20"),
        t("Slowest graph queries (db_execute)", 12, 10, 12, 5, "table",
          f"SELECT Timestamp, round(Duration/1e6,0) AS ms, StatusCode AS status, TraceId FROM otel_traces WHERE {ENG} AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp) ORDER BY Duration DESC LIMIT 20",
          on_click=drill),

        # ── Bottlenecks (top 5) ───────────────────────────────────────────────
        t("Top 5 bottleneck stages (by total time)", 0, 15, 12, 5, "table",
          f"SELECT SpanName AS stage, count() AS calls, round(quantile(0.95)(Duration)/1e6,1) AS p95_ms, "
          f"round(sum(Duration)/1e9,1) AS total_s FROM otel_traces WHERE {ENG} AND $__timeFilter(Timestamp) GROUP BY stage ORDER BY total_s DESC LIMIT 5"),
        t("Top 5 slowest API routes (by p95)", 12, 15, 12, 5, "table",
          f"SELECT SpanName AS route, round(quantile(0.95)(Duration)/1e6,0) AS p95_ms, count() AS calls "
          f"FROM otel_traces WHERE {ENG} AND SpanName LIKE '%{{%' AND $__timeFilter(Timestamp) GROUP BY route ORDER BY p95_ms DESC LIMIT 5"),

        # ── Traces (drill-down) ───────────────────────────────────────────────
        t("Recent query/message calls — click a row to open its trace", 0, 20, 24, 6, "table",
          f"SELECT Timestamp, SpanName AS endpoint, round(Duration/1e6,0) AS ms, StatusCode AS status, TraceId "
          f"FROM otel_traces WHERE {QAPI} AND $__timeFilter(Timestamp) ORDER BY Timestamp DESC LIMIT 50",
          on_click=drill),
    ]


def _delete_existing() -> None:
    # Remove the current name and the pre-rename name so an upgrade leaves one copy.
    stale = {NAME, "Invana — Messages API & Performance"}
    for d in _get("/api/dashboards"):
        if d.get("name") in stale:
            req = urllib.request.Request(f"{BASE}/api/dashboards/{d['id']}", method="DELETE")
            try:
                urllib.request.urlopen(req, timeout=15).read()
                print(f"deleted existing dashboard {d['id']} ({d.get('name')})")
            except urllib.error.HTTPError as e:  # best-effort; keep going
                print(f"warning: could not delete {d['id']} ({e.code})")


def _create(tiles: list[dict]):
    body = {"name": NAME, "tiles": tiles, "tags": ["invana", "api", "performance"]}
    req = urllib.request.Request(
        f"{BASE}/api/dashboards",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def main() -> None:
    connection, source = _discover()
    _delete_existing()
    tiles = _build_tiles(connection, source)
    try:
        resp = _create(tiles)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode()[:2000])
        raise SystemExit(1) from e
    dash_id = resp.get("id") or resp.get("_id")
    print(f"created '{resp.get('name')}' — {len(resp.get('tiles', []))} tiles")
    print(f"open: {BASE}/dashboards/{dash_id}")


if __name__ == "__main__":
    main()
