#!/usr/bin/env python3
"""Seed the Invana **Canvas** telemetry dashboards into local HyperDX.

Two **separate** dashboards for the `@invana/canvas` render engine's telemetry
(service ``invana-canvas``, emitted via `@invana/canvas-telemetry-otel`):

  1. **"Invana Canvas — FPS & Frame Metrics"** — the continuous per-frame signal
     (the F1 "speed trace"): frame-time / FPS / phase histograms + dropped-frame
     counters from `otel_metrics_histogram` / `otel_metrics_sum`, sliced by the
     `interaction` gesture (idle · pan · zoom · drag · hover · layout).
  2. **"Invana Canvas — Traces & Interactions"** — the per-gesture spans (the
     "braking markers": `canvas.interaction.*` with `canvas.fps.drop`) + the
     causal event loop (view mutations / scene / layout) from `otel_traces`.

Same mechanics as ``seed-api-performance-dashboard.py``: idempotent (deletes any
same-named dashboard first), discovers the connection + source ids at runtime,
every tile is a raw-SQL tile over the OTel ClickHouse tables.

HyperDX-local stores dashboards in ephemeral container state, so re-run after a
``down``/recreate.

Usage (HyperDX up — ``docker compose -f docker-compose-infra.yml --profile
telemetry up -d``):

    python3 docker/hyperdx/seed-canvas-telemetry-dashboards.py
    # custom host:  HYPERDX_URL=http://localhost:8080 python3 …/seed-canvas-telemetry-dashboards.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

BASE = os.environ.get("HYPERDX_URL", "http://localhost:8080").rstrip("/")

METRICS_NAME = "Invana Canvas — FPS & Frame Metrics"
TRACES_NAME = "Invana Canvas — Traces & Interactions"

SVC = "ServiceName='invana-canvas'"
# The interaction gestures each frame is attributed to (kernel `InteractionKind`).
INTERACTIONS = ["idle", "pan", "zoom", "drag", "hover", "layout"]
# The per-frame CPU phases (kernel `FramePhase`).
PHASES = ["camera", "dataFlush", "layers"]

NUM = {"output": "number", "thousandSeparated": True}
MS = {"output": "number", "mantissa": 2}
DUR = {"output": "duration", "factor": 0.000000001}  # nanoseconds → human time


# ── HTTP helpers ───────────────────────────────────────────────────────────────
def _get(path: str):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15) as r:
        return json.load(r)


def _discover() -> tuple[str, str, str]:
    """Return (connectionId, tracesSourceId, metricsSourceId)."""
    connection_id = _get("/api/connections")[0]["id"]
    sources = _get("/api/sources")
    traces = next(s for s in sources if s.get("kind") == "trace")
    metrics = next((s for s in sources if s.get("kind") == "metric"), traces)
    return connection_id, traces["id"], metrics["id"]


def _tile(connection: str, source: str, name, x, y, w, h, disp, sql, *, number_format=None, on_click=None):
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


# ── SQL builders ───────────────────────────────────────────────────────────────
def _pivot(select_expr, table, metric, time_col="TimeUnix", key="interaction", keys=None):
    """One time-series column per attribute value → a multi-series line chart."""
    keys = keys or INTERACTIONS
    cols = ",\n  ".join(f"{select_expr(k)} AS {k}" for k in keys)
    return (
        f"SELECT $__timeInterval({time_col}) AS t,\n  {cols}\n"
        f"FROM {table} WHERE {SVC} AND MetricName='{metric}' AND $__timeFilter({time_col})\n"
        f"GROUP BY t ORDER BY t"
    )


def _avg_ms(k):  # histogram avg (ms) for interaction k
    return f"round(sumIf(Sum,Attributes['interaction']='{k}')/nullIf(sumIf(Count,Attributes['interaction']='{k}'),0),2)"


def _fps(k):  # avg fps for interaction k (1000 * frames / total_ms)
    return f"round(1000*sumIf(Count,Attributes['interaction']='{k}')/nullIf(sumIf(Sum,Attributes['interaction']='{k}'),0),1)"


def _worst(k):  # worst single frame (ms) for interaction k
    return f"round(maxIf(Max,Attributes['interaction']='{k}'),2)"


def _phase_avg(p):  # avg ms for phase p
    return f"round(sumIf(Sum,Attributes['phase']='{p}')/nullIf(sumIf(Count,Attributes['phase']='{p}'),0),2)"


def _dropped(k):  # dropped frames (counter) for interaction k
    return f"sumIf(Value,Attributes['interaction']='{k}')"


# ── Dashboard 1: FPS & frame metrics ───────────────────────────────────────────
def _metrics_tiles(connection: str, source: str) -> list[dict]:
    HIST = "otel_metrics_histogram"
    SUM = "otel_metrics_sum"

    def t(*a, **k):
        return _tile(connection, source, *a, **k)

    dur_where = f"{SVC} AND MetricName='canvas.frame.duration' AND $__timeFilter(TimeUnix)"
    return [
        # ── headline numbers ──────────────────────────────────────────────────
        t("Avg FPS", 0, 0, 6, 3, "number",
          f"SELECT round(1000*sum(Count)/nullIf(sum(Sum),0),1) FROM {HIST} WHERE {dur_where}", number_format=NUM),
        # Lowest FPS = the worst ~2s export window's overall FPS (grouped by the
        # exact export TimeUnix so it's granularity-independent) — the "how bad did
        # it get" number, closer to the DevInfoLayer live dip than the single
        # worst-frame below.
        t("Lowest FPS (worst window)", 6, 0, 6, 3, "number",
          f"SELECT round(min(fps),1) FROM (SELECT TimeUnix, 1000*sum(Count)/nullIf(sum(Sum),0) AS fps "
          f"FROM {HIST} WHERE {dur_where} GROUP BY TimeUnix)", number_format=NUM),
        t("Worst frame (ms)", 12, 0, 6, 3, "number",
          f"SELECT round(max(Max),2) FROM {HIST} WHERE {dur_where}", number_format=MS),
        t("Dropped (jank) frames", 18, 0, 6, 3, "number",
          f"SELECT sum(Value) FROM {SUM} WHERE {SVC} AND MetricName='canvas.frame.dropped' AND $__timeFilter(TimeUnix)", number_format=NUM),

        # ── the F1 speed trace: frame time + FPS by gesture ───────────────────
        t("Frame time by interaction (avg ms)", 0, 3, 12, 5, "line",
          _pivot(_avg_ms, HIST, "canvas.frame.duration")),
        t("FPS by interaction", 12, 3, 12, 5, "line",
          _pivot(_fps, HIST, "canvas.frame.duration")),

        # ── the dips + where the frame goes ───────────────────────────────────
        t("Worst frame by interaction (max ms)", 0, 8, 12, 5, "line",
          _pivot(_worst, HIST, "canvas.frame.duration")),
        t("CPU phase breakdown (avg ms)", 12, 8, 12, 5, "line",
          _pivot(_phase_avg, HIST, "canvas.frame.phase", key="phase", keys=PHASES)),

        # ── dropped frames over time + per-gesture summary ────────────────────
        t("Dropped frames by interaction", 0, 13, 12, 5, "line",
          _pivot(_dropped, SUM, "canvas.frame.dropped")),
        t("By interaction — avg · worst · frames", 12, 13, 12, 5, "table",
          f"SELECT Attributes['interaction'] AS interaction, "
          f"round(sum(Sum)/nullIf(sum(Count),0),2) AS avg_ms, "
          f"round(1000*sum(Count)/nullIf(sum(Sum),0),1) AS avg_fps, "
          f"round(max(Max),2) AS worst_ms, sum(Count) AS frames "
          f"FROM {HIST} WHERE {dur_where} GROUP BY interaction ORDER BY avg_ms DESC"),
    ]


# ── Dashboard 2: traces & interactions ─────────────────────────────────────────
def _traces_tiles(connection: str, source: str) -> list[dict]:
    T = "otel_traces"
    GEST = f"{SVC} AND SpanName LIKE 'canvas.interaction.%'"
    drop = "toFloat64OrZero(SpanAttributes['canvas.fps.drop'])"
    maxms = "toFloat64OrZero(SpanAttributes['canvas.frame.max_ms'])"

    def t(*a, **k):
        return _tile(connection, source, *a, **k)

    def pivot_gesture(expr):  # one series per gesture kind (excl. idle — no span)
        kinds = [i for i in INTERACTIONS if i != "idle"]
        cols = ",\n  ".join(f"{expr(k)} AS {k}" for k in kinds)
        return (
            f"SELECT $__timeInterval(Timestamp) AS t,\n  {cols}\n"
            f"FROM {T} WHERE {GEST} AND $__timeFilter(Timestamp)\nGROUP BY t ORDER BY t"
        )

    trace_drill = {
        "type": "search",
        "target": {"mode": "id", "id": source},
        "whereLanguage": "sql",
        "filters": [{"kind": "expressionTemplate", "expression": "TraceId", "template": "{{TraceId}}"}],
    }
    return [
        # ── headline numbers ──────────────────────────────────────────────────
        t("Spans", 0, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {SVC} AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Interaction gestures", 6, 0, 6, 3, "number",
          f"SELECT count() FROM otel_traces WHERE {GEST} AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Avg FPS drop / gesture", 12, 0, 6, 3, "number",
          f"SELECT round(avg({drop}),1) FROM otel_traces WHERE {GEST} AND $__timeFilter(Timestamp)", number_format=NUM),
        t("Worst gesture frame (ms)", 18, 0, 6, 3, "number",
          f"SELECT round(max({maxms}),2) FROM otel_traces WHERE {GEST} AND $__timeFilter(Timestamp)", number_format=MS),

        # ── over time ─────────────────────────────────────────────────────────
        t("FPS drop over time by gesture", 0, 3, 12, 5, "line",
          pivot_gesture(lambda k: f"round(avgIf({drop}, SpanName='canvas.interaction.{k}'),1)")),
        t("Gesture count over time by kind", 12, 3, 12, 5, "line",
          pivot_gesture(lambda k: f"countIf(SpanName='canvas.interaction.{k}')")),

        # ── the money table: which gesture dipped FPS, and how much ───────────
        t("Top FPS-drop gestures", 0, 8, 24, 6, "table",
          f"SELECT Timestamp, SpanName AS gesture, "
          f"{drop} AS fps_drop, "
          f"toFloat64OrZero(SpanAttributes['canvas.fps.baseline']) AS fps_baseline, "
          f"toFloat64OrZero(SpanAttributes['canvas.fps.min']) AS fps_min, "
          f"{maxms} AS max_frame_ms, "
          f"toFloat64OrZero(SpanAttributes['canvas.frames']) AS frames, "
          f"round(Duration/1e6,1) AS gesture_ms, TraceId "
          f"FROM otel_traces WHERE {GEST} AND $__timeFilter(Timestamp) "
          f"ORDER BY fps_drop DESC LIMIT 50",
          on_click=trace_drill),

        # ── the causal event loop ─────────────────────────────────────────────
        t("Span volume by name (event loop)", 0, 14, 12, 6, "table",
          f"SELECT SpanName, count() AS spans FROM otel_traces "
          f"WHERE {SVC} AND $__timeFilter(Timestamp) GROUP BY SpanName ORDER BY spans DESC LIMIT 30"),
        t("Slowest spans", 12, 14, 12, 6, "table",
          f"SELECT Timestamp, SpanName, round(Duration/1e6,2) AS ms, TraceId FROM otel_traces "
          f"WHERE {SVC} AND $__timeFilter(Timestamp) ORDER BY Duration DESC LIMIT 30",
          on_click=trace_drill),
    ]


# ── create / delete ─────────────────────────────────────────────────────────────
def _delete_existing(names: set[str]):
    for d in _get("/api/dashboards"):
        if d.get("name") in names:
            req = urllib.request.Request(f"{BASE}/api/dashboards/{d['id']}", method="DELETE")
            try:
                urllib.request.urlopen(req, timeout=15).read()
                print(f"deleted existing dashboard {d['id']} ({d.get('name')})")
            except urllib.error.HTTPError as e:
                print(f"warning: could not delete {d['id']} ({e.code})")


def _create(name: str, tiles: list[dict], tags: list[str]):
    body = {"name": name, "tiles": tiles, "tags": tags}
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
    print(f"created '{resp.get('name')}' — {len(resp.get('tiles', []))} tiles · {BASE}/dashboards/{dash_id}")


def main() -> None:
    connection, traces_source, metrics_source = _discover()
    _delete_existing({METRICS_NAME, TRACES_NAME})
    _create(METRICS_NAME, _metrics_tiles(connection, metrics_source), ["invana", "canvas", "fps", "metrics"])
    _create(TRACES_NAME, _traces_tiles(connection, traces_source), ["invana", "canvas", "traces"])


if __name__ == "__main__":
    main()
