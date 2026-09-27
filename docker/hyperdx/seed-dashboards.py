#!/usr/bin/env python3
"""Seed Invana's HyperDX dashboards — one per module, plus a cross-service trace view.

The dashboards are grouped the way the product is: **API · Runs · LLMs · Graph
queries · System · Studio**, and **Trace**, which lists recent Studio actions and
opens each one's whole trace, click to engine to graph database. Every tile is a
raw-SQL tile over the OpenTelemetry tables HyperDX keeps in ClickHouse.

Usage (HyperDX must be up — ``docker compose --profile telemetry up -d``)::

    python3 docker/hyperdx/seed-dashboards.py            # (re)create all seven
    python3 docker/hyperdx/seed-dashboards.py --check    # run every tile's SQL, write nothing

    HYPERDX_URL=http://localhost:8080  CLICKHOUSE_URL=http://localhost:8123 \\
    CLICKHOUSE_USER=invana_ro  CLICKHOUSE_PASSWORD=invana_ro  python3 …

Seeding is **idempotent**: a dashboard with the same name is deleted first, and so
is the retired "Invana — API Performance". Source and connection ids are
discovered from the running HyperDX, so nothing is hard-coded.

``--check`` expands HyperDX's SQL macros the way HyperDX does (``$__timeFilter``,
``$__fromTime``, ``$__timeInterval`` over the last day) and runs each tile against
ClickHouse, exiting non-zero when any tile fails. A tile that returns no rows is
reported but passes — a quiet hour has no LLM calls. Run it after renaming a
metric or an attribute: a dashboard that silently draws nothing is the failure it
exists to catch.

Where each number comes from
----------------------------
- **Counts** read the metrics (``otel_metrics_sum`` and the ``Count`` of
  ``otel_metrics_histogram``), which are not thinned by trace sampling. The engine
  exports cumulative series and Studio delta ones; ``_inc`` turns either into the
  increase over the dashboard's time range.
- **Latency percentiles** read span ``Duration`` in ``otel_traces``: exact, and a
  row links to the trace it came from. Histograms serve means where there is no
  span (queue wait, result size, Web Vitals).
- **Levels** — active runs, open streams, pool connections — take each series'
  last value in a bucket.
- **Discrete facts** — a failed run, a 5xx, a Studio error — read ``otel_logs``.

The attribute names are those of the engine and Studio telemetry catalogue
(``engine/src/invana/core/telemetry/metrics.py`` and
``studio/src/services/telemetry/metrics.ts``); the canvas's own dashboards are
seeded by ``seed-canvas-telemetry-dashboards.py``.
"""

from __future__ import annotations

import base64
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("HYPERDX_URL", "http://localhost:8080").rstrip("/")
CLICKHOUSE = os.environ.get("CLICKHOUSE_URL", "http://localhost:8123").rstrip("/")
CH_USER = os.environ.get("CLICKHOUSE_USER", "invana_ro")
CH_PASSWORD = os.environ.get("CLICKHOUSE_PASSWORD", "invana_ro")

PREFIX = "Invana — "
RETIRED = {"Invana — API Performance", "Invana — Messages API & Performance"}

ENG = "ServiceName='invana-engine'"
STU = "ServiceName='invana-studio'"
SERVER = f"{ENG} AND SpanKind='Server'"
STATUS = "toUInt16OrZero(SpanAttributes['http.status_code'])"

DUR = {"output": "duration", "factor": 0.000000001}  # span Duration is in nanoseconds
NUM = {"output": "number", "thousandSeparated": True}
PCT = {"output": "percent"}


# ── SQL builders ─────────────────────────────────────────────────────────────


def _inc(value: str) -> str:
    """The increase of *value* over the range, for one series of a delta or cumulative metric."""
    value = f"toFloat64({value})"  # a histogram's Count is unsigned; the difference must not be
    return (
        f"if(any(AggregationTemporality) = 1, sum({value}), "
        f"max({value}) - if(StartTimeUnix >= $__fromTime, 0, min({value})))"
    )


def counter(metric: str, key: str, where: str = "1") -> str:
    """``k, n`` — a counter's increase over the range, per ``key``."""
    return (
        f"SELECT k, sum(inc) AS n FROM (SELECT {key} AS k, {_inc('Value')} AS inc "
        f"FROM otel_metrics_sum WHERE MetricName='{metric}' AND ({where}) AND $__timeFilter(TimeUnix) "
        f"GROUP BY k, ServiceName, Attributes, StartTimeUnix) GROUP BY k"
    )


def histogram(metric: str, key: str, where: str = "1", scale: float = 1.0) -> str:
    """``k, n, mean`` — a histogram's count and mean (times *scale*) over the range, per ``key``."""
    return (
        f"SELECT k, sum(c) AS n, round(sum(s) / nullIf(sum(c), 0) * {scale}, 2) AS mean FROM ("
        f"SELECT {key} AS k, {_inc('Count')} AS c, {_inc('Sum')} AS s "
        f"FROM otel_metrics_histogram WHERE MetricName='{metric}' AND ({where}) AND $__timeFilter(TimeUnix) "
        f"GROUP BY k, ServiceName, Attributes, StartTimeUnix) GROUP BY k"
    )


def level(metric: str, key: str, table: str = "otel_metrics_sum") -> str:
    """``t, k, v`` — the level of an up-down counter or gauge in each bucket, per ``key``."""
    return (
        f"SELECT t, k, sum(v) AS v FROM (SELECT $__timeInterval(TimeUnix) AS t, {key} AS k, "
        f"argMax(Value, TimeUnix) AS v FROM {table} WHERE MetricName='{metric}' AND $__timeFilter(TimeUnix) "
        f"GROUP BY t, k, ServiceName, Attributes, StartTimeUnix) GROUP BY t, k ORDER BY t"
    )


def total(sql: str) -> str:
    """One number: the sum of ``n`` over a ``counter``/``histogram`` query."""
    return f"SELECT sum(n) FROM ({sql})"


# ── Tiles ────────────────────────────────────────────────────────────────────


class Board:
    """Lays tiles out left to right in rows of 24 columns."""

    def __init__(self, ids: dict[str, str]) -> None:
        self.ids = ids
        self.tiles: list[dict] = []
        self._x = 0
        self._y = 0
        self._row_h = 0

    def add(self, name, w, h, disp, sql, *, source="trace", number_format=None, drill=False) -> None:
        if self._x + w > 24:
            self._x, self._y, self._row_h = 0, self._y + self._row_h, 0
        cfg = {
            "configType": "sql",
            "displayType": disp,
            "name": name,
            "connection": self.ids["connection"],
            "source": self.ids[source],
            "sqlTemplate": sql,
        }
        if number_format:
            cfg["numberFormat"] = number_format
        if drill:
            # A row opens its trace in the search view.
            cfg["onClick"] = {
                "type": "search",
                "target": {"mode": "id", "id": self.ids["trace"]},
                "whereLanguage": "sql",
                "filters": [{"kind": "expressionTemplate", "expression": "TraceId", "template": "{{TraceId}}"}],
            }
        self.tiles.append({"id": os.urandom(12).hex(), "x": self._x, "y": self._y, "w": w, "h": h, "config": cfg})
        self._x += w
        self._row_h = max(self._row_h, h)


def api(b: Board) -> None:
    reqs = histogram("http.server.request.duration", "Attributes['http.response.status_code']")
    b.add("Requests", 6, 3, "number", total(reqs), source="metric", number_format=NUM)
    b.add(
        "5xx",
        6,
        3,
        "number",
        f"SELECT sum(n) FROM ({reqs}) WHERE toUInt16OrZero(k) >= 500",
        source="metric",
        number_format=NUM,
    )
    b.add(
        "5xx rate",
        6,
        3,
        "number",
        f"SELECT sumIf(n, toUInt16OrZero(k) >= 500) / nullIf(sum(n), 0) FROM ({reqs})",
        source="metric",
        number_format=PCT,
    )
    b.add(
        "p95 request",
        6,
        3,
        "number",
        f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {SERVER} AND $__timeFilter(Timestamp)",
        number_format=DUR,
    )
    b.add(
        "Requests over time, by status class",
        12,
        4,
        "line",
        f"SELECT $__timeInterval(Timestamp) AS t, concat(toString(intDiv({STATUS}, 100)), 'xx') AS status, "
        f"count() AS requests FROM otel_traces WHERE {SERVER} AND $__timeFilter(Timestamp) "
        f"GROUP BY t, status ORDER BY t",
    )
    b.add(
        "Active requests",
        12,
        4,
        "line",
        level("http.server.active_requests", "Attributes['http.request.method']"),
        source="metric",
    )
    b.add(
        "By route — p95 and errors",
        12,
        6,
        "table",
        f"SELECT SpanAttributes['http.route'] AS route, count() AS requests, "
        f"round(quantile(0.95)(Duration) / 1e6, 0) AS p95_ms, countIf({STATUS} >= 500) AS server_errors "
        f"FROM otel_traces WHERE {SERVER} AND $__timeFilter(Timestamp) "
        f"GROUP BY route ORDER BY p95_ms DESC LIMIT 25",
    )
    b.add(
        "5xx — click a row to open its trace",
        12,
        6,
        "table",
        f"SELECT Timestamp, SpanName AS request, {STATUS} AS status, round(Duration / 1e6, 0) AS ms, "
        f"SpanAttributes['invana.principal'] AS principal, SpanAttributes['invana.origin'] AS origin, TraceId "
        f"FROM otel_traces WHERE {SERVER} AND {STATUS} >= 500 AND $__timeFilter(Timestamp) "
        f"ORDER BY Timestamp DESC LIMIT 50",
        drill=True,
    )


def runs(b: Board) -> None:
    count = counter("invana.runs.count", "Attributes['outcome']")
    b.add("Runs", 6, 3, "number", total(count), source="metric", number_format=NUM)
    b.add(
        "Failed",
        6,
        3,
        "number",
        f"SELECT sum(n) FROM ({count}) WHERE k IN ('error', 'failed')",
        source="metric",
        number_format=NUM,
    )
    b.add(
        "p95 run",
        6,
        3,
        "number",
        f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {ENG} AND SpanName='invana.run' "
        f"AND $__timeFilter(Timestamp)",
        number_format=DUR,
    )
    wait = histogram("invana.runs.queue_wait", "'all'")
    b.add(
        "Mean queue wait (s)",
        6,
        3,
        "number",
        f"SELECT round(sum(mean * n) / nullIf(sum(n), 0), 2) FROM ({wait})",
        source="metric",
    )
    b.add(
        "By outcome, kind and trigger",
        12,
        5,
        "table",
        counter(
            "invana.runs.count",
            "concat(Attributes['outcome'], ' · ', Attributes['kind'], ' · ', Attributes['triggered_by'])",
        )
        + " ORDER BY n DESC",
        source="metric",
    )
    b.add("Active runs", 12, 5, "line", level("invana.runs.active", "Attributes['kind']"), source="metric")
    b.add(
        "Runs over time, by outcome",
        12,
        4,
        "line",
        f"SELECT $__timeInterval(Timestamp) AS t, SpanAttributes['invana.outcome'] AS outcome, count() AS runs "
        f"FROM otel_traces WHERE {ENG} AND SpanName='invana.run' AND $__timeFilter(Timestamp) "
        f"GROUP BY t, outcome ORDER BY t",
    )
    b.add(
        "Slowest steps, by task",
        12,
        4,
        "table",
        f"SELECT SpanAttributes['invana.task_key'] AS task, count() AS attempts, "
        f"round(quantile(0.95)(Duration) / 1e6, 0) AS p95_ms, "
        f"countIf(SpanAttributes['invana.outcome'] IN ('failed', 'error')) AS failed "
        f"FROM otel_traces WHERE {ENG} AND SpanName='invana.run.step' AND $__timeFilter(Timestamp) "
        f"GROUP BY task ORDER BY p95_ms DESC LIMIT 20",
    )
    b.add(
        "Failed runs — click a row to open its trace",
        24,
        6,
        "table",
        f"SELECT Timestamp, LogAttributes['failure_kind'] AS failure_kind, LogAttributes['run_kind'] AS kind, "
        f"LogAttributes['run_triggered_by'] AS triggered_by, LogAttributes['run_id'] AS run_id, TraceId "
        f"FROM otel_logs WHERE {ENG} AND Body='run failed' AND $__timeFilter(Timestamp) "
        f"ORDER BY Timestamp DESC LIMIT 50",
        source="log",
        drill=True,
    )


def llms(b: Board) -> None:
    calls = counter("invana.llms.request.count", "Attributes['outcome']")
    b.add("Calls", 6, 3, "number", total(calls), source="metric", number_format=NUM)
    b.add("Failed", 6, 3, "number", f"SELECT sum(n) FROM ({calls}) WHERE k != 'ok'", source="metric", number_format=NUM)
    b.add("Tokens", 6, 3, "number", total(counter("invana.llms.tokens", "'all'")), source="metric", number_format=NUM)
    b.add("Cost", 6, 3, "number", total(counter("invana.llms.cost", "'all'")), source="metric")
    by_model = histogram("invana.llms.request.duration", "concat(Attributes['provider'], ' · ', Attributes['model'])")
    tokens = counter("invana.llms.tokens", "concat(Attributes['model'], ' · ', Attributes['direction'])")
    b.add(
        "By provider and model",
        12,
        5,
        "table",
        f"SELECT k AS provider_model, n AS calls, mean AS mean_s FROM ({by_model}) ORDER BY calls DESC",
        source="metric",
    )
    b.add(
        "Tokens, by model and direction",
        12,
        5,
        "table",
        f"SELECT k AS model_direction, n AS tokens FROM ({tokens}) ORDER BY tokens DESC",
        source="metric",
    )
    b.add(
        "p95 call over time",
        12,
        4,
        "line",
        f"SELECT $__timeInterval(Timestamp) AS t, quantile(0.95)(Duration) AS p95 FROM otel_traces "
        f"WHERE {ENG} AND SpanName='llm.generate' AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t",
        number_format=DUR,
    )
    b.add(
        "Slowest calls — click a row to open its trace",
        12,
        4,
        "table",
        f"SELECT Timestamp, SpanAttributes['invana.llm.model_id'] AS model, round(Duration / 1e6, 0) AS ms, "
        f"SpanAttributes['invana.llm.input_tokens'] AS input_tokens, "
        f"SpanAttributes['invana.llm.output_tokens'] AS output_tokens, StatusCode AS status, TraceId "
        f"FROM otel_traces WHERE {ENG} AND SpanName='llm.generate' AND $__timeFilter(Timestamp) "
        f"ORDER BY Duration DESC LIMIT 25",
        drill=True,
    )


def graph_queries(b: Board) -> None:
    count = counter("invana.graph_connectors.query.count", "Attributes['outcome']")
    b.add("Queries", 8, 3, "number", total(count), source="metric", number_format=NUM)
    b.add("Failed", 8, 3, "number", f"SELECT sum(n) FROM ({count}) WHERE k != 'ok'", source="metric", number_format=NUM)
    b.add(
        "p95 query",
        8,
        3,
        "number",
        f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {ENG} AND SpanName='graph.query.db_execute' "
        f"AND $__timeFilter(Timestamp)",
        number_format=DUR,
    )
    b.add(
        "By connector, language and outcome",
        12,
        5,
        "table",
        counter(
            "invana.graph_connectors.query.count",
            "concat(Attributes['connector'], ' · ', Attributes['language'], ' · ', Attributes['outcome'])",
        )
        + " ORDER BY n DESC",
        source="metric",
    )
    sizes = histogram("invana.graph_connectors.query.result_size", "Attributes['connector']")
    b.add(
        "Mean result size, by connector",
        12,
        5,
        "table",
        f"SELECT k AS connector, n AS queries, mean AS mean_rows FROM ({sizes}) ORDER BY queries DESC",
        source="metric",
    )
    b.add(
        "p95 query over time",
        24,
        4,
        "line",
        f"SELECT $__timeInterval(Timestamp) AS t, quantile(0.95)(Duration) AS p95 FROM otel_traces "
        f"WHERE {ENG} AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp) GROUP BY t ORDER BY t",
        number_format=DUR,
    )
    b.add(
        "Slowest queries — click a row to open its trace",
        24,
        6,
        "table",
        f"SELECT Timestamp, round(Duration / 1e6, 0) AS ms, StatusCode AS status, TraceId "
        f"FROM otel_traces WHERE {ENG} AND SpanName='graph.query.db_execute' AND $__timeFilter(Timestamp) "
        f"ORDER BY Duration DESC LIMIT 25",
        drill=True,
    )


def system(b: Board) -> None:
    b.add(
        "Loop failures, by loop",
        12,
        5,
        "table",
        counter("invana.system.loop.failures", "Attributes['loop']") + " ORDER BY n DESC",
        source="metric",
    )
    loops = histogram("invana.system.loop.duration", "Attributes['loop']", scale=1000)
    b.add(
        "Loop iterations and mean duration (ms)",
        12,
        5,
        "table",
        f"SELECT k AS loop, n AS iterations, mean AS mean_ms FROM ({loops}) ORDER BY iterations DESC",
        source="metric",
    )
    b.add(
        "Graph pool connections, by state",
        12,
        4,
        "line",
        level("invana.graphs.pool.connections", "Attributes['state']", table="otel_metrics_gauge"),
        source="metric",
    )
    b.add(
        "Open streams", 12, 4, "line", level("invana.assistant.streams.active", "Attributes['stream']"), source="metric"
    )
    b.add(
        "Events emitted, top actions",
        12,
        5,
        "table",
        counter("invana.events.emitted", "Attributes['action']") + " ORDER BY n DESC LIMIT 15",
        source="metric",
    )
    b.add(
        "System work — each root is its own trace",
        12,
        5,
        "table",
        f"SELECT SpanName AS work, count() AS runs, round(quantile(0.95)(Duration) / 1e6, 0) AS p95_ms, "
        f"countIf(StatusCode='Error') AS failed FROM otel_traces "
        f"WHERE {ENG} AND (SpanName LIKE 'system.%' OR SpanName LIKE 'cli.%') AND $__timeFilter(Timestamp) "
        f"GROUP BY work ORDER BY runs DESC",
    )
    b.add(
        "Warnings and errors, by line",
        12,
        6,
        "table",
        f"SELECT SeverityText AS level, Body AS line, count() AS n, max(Timestamp) AS last "
        f"FROM otel_logs WHERE {ENG} AND SeverityNumber >= 13 AND $__timeFilter(Timestamp) "
        f"GROUP BY level, line ORDER BY n DESC LIMIT 25",
        source="log",
    )
    b.add(
        "Startups — click a row to open its trace",
        12,
        6,
        "table",
        f"SELECT Timestamp, LogAttributes['graphs'] AS graphs, LogAttributes['stale_runs'] AS stale_runs, "
        f"LogAttributes['startup_duration_s'] AS seconds, TraceId FROM otel_logs "
        f"WHERE {ENG} AND Body='startup finished' AND $__timeFilter(Timestamp) ORDER BY Timestamp DESC LIMIT 20",
        source="log",
        drill=True,
    )


def studio(b: Board) -> None:
    errors = counter("ui.errors", "concat(Attributes['module'], ' · ', Attributes['source'])")
    b.add(
        "Actions", 8, 3, "number", total(histogram("ui.action.duration", "'all'")), source="metric", number_format=NUM
    )
    b.add("Errors", 8, 3, "number", total(errors), source="metric", number_format=NUM)
    b.add(
        "p95 action",
        8,
        3,
        "number",
        f"SELECT quantile(0.95)(Duration) FROM otel_traces WHERE {STU} AND SpanName LIKE 'ui.%' "
        f"AND $__timeFilter(Timestamp)",
        number_format=DUR,
    )
    actions = histogram(
        "ui.action.duration",
        "concat(Attributes['module'], '.', Attributes['action'], ' · ', Attributes['outcome'])",
    )
    requests = histogram(
        "ui.request.duration", "concat(Attributes['http.route'], ' · ', Attributes['outcome'])", scale=1000
    )
    vitals = " UNION ALL ".join(
        histogram(f"ui.web_vitals.{v}", f"concat('{v} · ', Attributes['module'])")
        for v in ("lcp", "inp", "cls", "ttfb")
    )
    b.add(
        "Actions, by name and outcome (mean s)",
        12,
        5,
        "table",
        f"SELECT k AS action, n AS actions, mean AS mean_s FROM ({actions}) ORDER BY actions DESC",
        source="metric",
    )
    b.add(
        "Requests, by route (mean ms)",
        12,
        5,
        "table",
        f"SELECT k AS route, n AS requests, mean AS mean_ms FROM ({requests}) ORDER BY requests DESC LIMIT 25",
        source="metric",
    )
    b.add(
        "Web Vitals, by module (mean)",
        12,
        5,
        "table",
        f"SELECT k AS vital_module, n AS samples, mean FROM ({vitals}) ORDER BY vital_module",
        source="metric",
    )
    b.add("Errors, by module and source", 12, 5, "table", errors + " ORDER BY n DESC", source="metric")
    b.add(
        "Recent errors — click a row to open its trace",
        24,
        6,
        "table",
        f"SELECT Timestamp, LogAttributes['module'] AS module, LogAttributes['ui.error.source'] AS source, "
        f"Body AS error, TraceId FROM otel_logs WHERE {STU} AND SeverityNumber >= 17 "
        f"AND $__timeFilter(Timestamp) ORDER BY Timestamp DESC LIMIT 50",
        source="log",
        drill=True,
    )


def trace(b: Board) -> None:
    actions = (
        f"SELECT a.Timestamp AS Timestamp, a.SpanName AS action, a.SpanAttributes['invana.outcome'] AS outcome, "
        f"round(a.Duration / 1e6, 0) AS ms, e.engine_spans AS engine_spans, e.engine_errors AS engine_errors, "
        f"a.TraceId AS TraceId FROM otel_traces AS a LEFT JOIN ("
        f"SELECT TraceId, count() AS engine_spans, countIf(StatusCode='Error') AS engine_errors "
        f"FROM otel_traces WHERE {ENG} AND $__timeFilter(Timestamp) GROUP BY TraceId) AS e ON e.TraceId = a.TraceId "
        f"WHERE a.{STU} AND a.SpanName LIKE 'ui.%' AND a.ParentSpanId = '' AND $__timeFilter(a.Timestamp)"
    )
    b.add(
        "Recent actions — click a row to open the whole trace",
        24,
        8,
        "table",
        f"{actions} ORDER BY Timestamp DESC LIMIT 50",
        drill=True,
    )
    b.add(
        "Slowest actions — click a row to open the whole trace",
        24,
        8,
        "table",
        f"{actions} ORDER BY ms DESC LIMIT 25",
        drill=True,
    )
    b.add(
        "Where an action's time goes (engine spans, by name)",
        24,
        6,
        "table",
        f"SELECT e.SpanName AS span, count() AS spans, round(quantile(0.95)(e.Duration) / 1e6, 1) AS p95_ms, "
        f"round(sum(e.Duration) / 1e9, 1) AS total_s FROM otel_traces AS e "
        f"WHERE e.{ENG} AND $__timeFilter(e.Timestamp) AND e.TraceId IN ("
        f"SELECT TraceId FROM otel_traces WHERE {STU} AND SpanName LIKE 'ui.%' AND $__timeFilter(Timestamp)) "
        f"GROUP BY span ORDER BY total_s DESC LIMIT 15",
    )


DASHBOARDS = {
    "API": (api, ["api"]),
    "Runs": (runs, ["runs"]),
    "LLMs": (llms, ["llms"]),
    "Graph queries": (graph_queries, ["graph-queries"]),
    "System": (system, ["system"]),
    "Studio": (studio, ["studio"]),
    "Trace": (trace, ["trace"]),
}


# ── HyperDX ──────────────────────────────────────────────────────────────────


def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15) as r:
        return json.load(r)


def _discover() -> dict[str, str]:
    """The connection and the trace, log and metric source ids of the running HyperDX."""
    sources = {s.get("kind"): s["id"] for s in _get("/api/sources")}
    return {
        "connection": _get("/api/connections")[0]["id"],
        "trace": sources["trace"],
        "log": sources["log"],
        "metric": sources["metric"],
    }


def _build(ids: dict[str, str]) -> dict[str, tuple[list[dict], list[str]]]:
    built = {}
    for name, (draw, tags) in DASHBOARDS.items():
        board = Board(ids)
        draw(board)
        built[PREFIX + name] = (board.tiles, ["invana", *tags])
    return built


def seed() -> None:
    ids = _discover()
    built = _build(ids)
    for d in _get("/api/dashboards"):
        if d.get("name") in built or d.get("name") in RETIRED:
            req = urllib.request.Request(f"{BASE}/api/dashboards/{d['id']}", method="DELETE")
            urllib.request.urlopen(req, timeout=15).read()
    for name, (tiles, tags) in built.items():
        req = urllib.request.Request(
            f"{BASE}/api/dashboards",
            data=json.dumps({"name": name, "tiles": tiles, "tags": tags}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                resp = json.load(r)
        except urllib.error.HTTPError as e:
            print(f"{name}: HTTP {e.code} {e.read().decode()[:1000]}")
            raise SystemExit(1) from e
        print(f"{name:26} {len(tiles):2} tiles  {BASE}/dashboards/{resp.get('id') or resp.get('_id')}")


# ── --check ──────────────────────────────────────────────────────────────────


def _expand(sql: str, start_ms: int, end_ms: int, interval_s: int = 60) -> str:
    """HyperDX's macro expansion, for one fixed range."""

    def at(ms: int) -> str:
        return f"toDateTime(fromUnixTimestamp64Milli({ms}))"

    sql = re.sub(r"\$__timeFilter\(([^()]+)\)", lambda m: f"{m[1]} >= {at(start_ms)} AND {m[1]} <= {at(end_ms)}", sql)
    sql = re.sub(
        r"\$__timeInterval\(([^()]+)\)",
        lambda m: f"toStartOfInterval(toDateTime({m[1]}), INTERVAL {interval_s} second)",
        sql,
    )
    return sql.replace("$__fromTime", at(start_ms)).replace("$__toTime", at(end_ms))


def _clickhouse(sql: str) -> int:
    auth = base64.b64encode(f"{CH_USER}:{CH_PASSWORD}".encode()).decode()
    url = f"{CLICKHOUSE}/?" + urllib.parse.urlencode({"default_format": "JSONCompact"})
    req = urllib.request.Request(url, data=sql.encode(), headers={"Authorization": f"Basic {auth}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return len(json.load(r).get("data", []))


def check() -> None:
    ids = {"connection": "", "trace": "", "log": "", "metric": ""}
    end_ms = int(time.time() * 1000)
    start_ms = end_ms - 24 * 3600 * 1000
    failed = 0
    for name, (tiles, _tags) in _build(ids).items():
        for tile in tiles:
            title = f"{name} > {tile['config']['name']}"
            try:
                rows = _clickhouse(_expand(tile["config"]["sqlTemplate"], start_ms, end_ms))
                print(f"ok     {rows:4} rows  {title}")
            except urllib.error.HTTPError as e:
                failed += 1
                print(f"FAILED           {title}\n  {e.read().decode().strip()[:400]}")
    print(f"\n{failed} of {sum(len(t) for t, _ in _build(ids).values())} tiles failed")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    check() if "--check" in sys.argv[1:] else seed()
