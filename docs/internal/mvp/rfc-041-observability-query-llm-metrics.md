# RFC-041: Observability — query, message & LLM performance metrics

**Status**: Proposed
**Author**: Invana Team
**Date**: 2026-07-01
**Related**:
- **RFC-007** (Telemetry — traces/metrics/logs) — the engine's OpenTelemetry stack: metric instruments in
  `telemetry/metrics.py`, the `@track` / `@capture_metrics` decorators, OTLP gRPC export. This RFC adds a
  new metric domain (`llm`), unifies the graph-query metric family, and lights up instruments that were
  defined but never emitted. No change to the export pipeline.
- **RFC-025** (Studio Telemetry) — established the FE→BE→FE distributed trace and the two backend query
  child spans (`graph.query.db_execute`, `graph.query.serialize`) in `BaseConnector.execute()`. This RFC
  extends that trace to the **Gremlin** path (currently dark) and adds a **session-message** parent span.
- **RFC-030 / RFC-032** (LLM translation / runtime) — `llm/client.py:complete_tool` is where LLM latency
  and token usage already exist as span attributes; this RFC promotes them to metrics.
- **MVP** — telemetry is the cross-cutting `Telemetry — RFC-007 + RFC-025` line. This RFC extends that line
  to `+ RFC-041`; no new MVP slice.

---

## Problem / intent

We can answer *"where did this one query's time go"* for a single trace (RFC-025), but we **cannot answer
aggregate performance questions** across all queries, messages, and LLM calls:

- **"What's the p95 latency of our LLM calls, by provider and model?"** — LLM timing lives **only** as span
  attributes on `llm.generate` (`llm/client.py:136–157`). There are **no `invana.llm.*` metrics** — every
  other domain (`api`, `gremlin`, `postgres`, `ontology`, `method`) has metrics; the LLM domain does not.
  So there is no histogram to compute p50/p95/p99 from, and no tokens/sec throughput.
- **"How slow are Gremlin queries?"** — `GremlinConnector.execute_traversal()`
  (`gremlin/connector.py:204`) **bypasses `BaseConnector.execute()` entirely**: no span, no duration
  measured, no metric. Every Gremlin traversal is invisible in both traces and metrics. Only Cypher is
  instrumented.
- **"What query metrics do we already have?"** — `invana.query.gremlin.*` are **defined in `metrics.py`
  (lines 87–114) but never emitted** — the `@capture_metrics` decorator is applied to no query path. And
  there is no Cypher metric family at all. The instruments are dead.
- **"How long does a whole message take end-to-end, by mode?"** — `sessions/services.send_message`
  orchestrates translate → LLM → query but has no domain span or metric. The generic FastAPI request span
  (`POST …/messages`) exists, but carries no `mode` / `surface` / `status`, so you cannot slice NL vs QL,
  Explorer vs Modeller, ok vs error.

**Intent:** make every LLM call, every graph query (both languages), and every session message emit a
**metric** — not just a span — so performance and analytics are answerable in aggregate, with the LLM
timing deep enough to read provider/model latency and token throughput. Reuse existing captured data
(durations and token counts already exist); light up defined-but-dead instruments; close the Gremlin span
gap so distributed traces are complete for both query languages.

**Scope this pass** (per the three decisions taken on 2026-07-01):
- LLM: metrics **from data already captured** — duration + input/output tokens. **No streaming / no
  time-to-first-token** (deferred; requires reworking the unary provider layer — see Non-Goals).
- Queries: **full coverage** — fix the Gremlin span gap, emit query metrics for **both** Cypher and
  Gremlin, unify the metric family.
- Messages: add a **message-level span + metric** around `send_message`.

---

## What you can see at the end

Three new answers, all from OTLP metrics in HyperDX/Grafana (no trace-diving required):

| Question | Metric + labels |
|---|---|
| p95 LLM latency by provider/model | `histogram(invana.llm.request.duration)` grouped by `provider`, `model_id` |
| LLM token throughput | `rate(invana.llm.tokens.output)` by `provider`, `model_id` |
| LLM error rate | `invana.llm.request.errors` / `invana.llm.request.count` by `provider`, `status` |
| p95 graph-query latency, Cypher vs Gremlin | `histogram(invana.query.graph.duration)` grouped by `language`, `backend` |
| Gremlin query volume / errors | `invana.query.graph.count` / `.errors` where `language="gremlin"` |
| End-to-end message latency, NL vs QL | `histogram(invana.session.message.duration)` grouped by `mode`, `surface`, `status` |

And one completed trace: a **Gremlin** query in the Explorer now shows the same
`graph.query.db_execute` bar the Cypher path already had, and every session message is one span
(`session.message`) with the translate (`llm.generate`) and query (`graph.query.*`) child spans nested
under it.

Updated waterfall for a session NL message (new bars marked **NEW**):

```
POST …/sessions/{id}/messages                BE  FastAPI request span (existing)
│
└─ session.message                           BE  NEW — one domain span per message
   │                                             attrs: mode, surface, status, provider, model_id
   │
   ├─ llm.generate                           BE  existing span; NOW also emits invana.llm.* metrics
   │        invana.llm.model_id / input_tokens / output_tokens
   │
   └─ graph.query.db_execute                 BE  Cypher: existing · Gremlin: NEW (was dark)
      graph.query.serialize                  BE  Cypher: existing (Gremlin serialize deferred — see below)
            invana.graph.node_count / edge_count
```

---

## Design decisions

### D1 — New `invana.llm.*` metric family

Add to `telemetry/metrics.py` a new domain, mirroring the existing families:

| Instrument | Type | Unit | Purpose |
|---|---|---|---|
| `invana.llm.request.duration` | histogram | ms | provider-call latency → p50/p95/p99 |
| `invana.llm.request.count` | counter | — | total LLM calls (rate → calls/sec) |
| `invana.llm.request.errors` | counter | — | failed LLM calls |
| `invana.llm.requests_in_flight` | up-down counter | — | concurrent LLM calls |
| `invana.llm.tokens.input` | counter | tokens | input tokens (rate → tokens/sec) |
| `invana.llm.tokens.output` | counter | tokens | output tokens |

**Labels:** `provider` (anthropic / openai / ollama / local), `model_id`, `operation`
(translate / propose), `status` (success / failed), `error_type` (on failure only).

Cardinality is bounded: `provider` ~4, `model_id` a handful, `operation` ~2, `status` 2. `model_id` is the
only semi-open dimension and is bounded in practice by the providers a graph configures.

### D2 — Emit LLM metrics inline in the client, not via `@capture_metrics`

`complete_tool` / `_invoke` are **module-level functions**, not methods — the `@capture_metrics` wrapper
assumes a bound `self` (`capture_metrics.py:141`), so it can't decorate them. And LLM needs **token
counters**, which the decorator's fixed 4-instrument shape (duration/count/errors/in_flight) doesn't cover.

**Decision:** emit LLM metrics **inline in `_invoke`** (`llm/client.py`), exactly mirroring how the
`llm.generate` span is already set there. `_invoke` is the true per-provider-call boundary, so the duration
histogram measures the real round-trip (the corrective retry becomes a second sample — the same semantics
as the existing span, which is also per-`_invoke`). This keeps the metric and the span aligned.

Thread two new values into `_invoke` so it can label correctly:
- `provider_name: str` — `provider.provider.value`, already available in `complete_tool`.
- `operation: str` — add an optional `operation` kwarg to `complete_tool`; `translate.py` passes
  `"translate"`, `propose.py` passes `"propose"`. Defaults to `"generate"` if a caller omits it.

A small `_record_llm_metrics(...)` helper guards on telemetry being installed (same lazy pattern as
`_tracer`), so the client still imports cleanly without the `telemetry` extra.

Note: the per-turn `duration_ms` on `ToolResult` (summed across the retry, persisted to
`SessionMessage.llm_time_ms`) is unchanged — that stays the user-facing number. The metric is the
per-call histogram for aggregate analytics.

### D3 — Unify the graph-query metric family; light it up for both languages

The existing `invana.query.gremlin.*` instruments are language-specific **and** dead. Rather than add a
parallel dead `invana.query.cypher.*` family, introduce **one unified family** labeled by language:

| Instrument | Type | Unit |
|---|---|---|
| `invana.query.graph.duration` | histogram | ms |
| `invana.query.graph.count` | counter | — |
| `invana.query.graph.errors` | counter | — |
| `invana.query.graph.result_size` | histogram | rows |
| `invana.query.graph.in_flight` | up-down counter | — |

**Labels:** `language` (cypher / gremlin), `backend` (neo4j / memgraph / janusgraph / …), `status`
(success / failed), `error_type` + `error_category` (on failure).

Emitted inline from the two connector round-trip points (mirroring the existing manual-span approach in
`BaseConnector.execute`), via a shared `record_graph_query(...)` helper in the telemetry package:
- **Cypher / raw** — in `BaseConnector.execute()`, around the `graph.query.db_execute` span. `backend`
  and `result_size` (node+edge count) are already computed there.
- **Gremlin** — in `GremlinConnector.execute_traversal()` (see D4).

**Tradeoff / churn:** the old `invana.query.gremlin.*` instruments and the `"gremlin"` domain in
`@capture_metrics` are currently unused, so repurposing is low-risk. I will **keep** them defined (a
comment marks them legacy/superseded-for-the-connector-path) so the `@capture_metrics(domain="gremlin")`
contract isn't broken for any future decorator use, but the connector path emits the new unified family.
*(Alternative considered: delete the gremlin family and repoint the decorator domain to the unified
instruments. Rejected this pass — more churn, and the decorator's label shape differs.)*

### D4 — Instrument `GremlinConnector.execute_traversal`

Wrap the blocking driver round-trip in a `graph.query.db_execute` span (same name the Cypher path uses, so
both languages read identically in a trace) with `_record_span_exception` on failure, and emit the unified
D3 query metrics with `language="gremlin"`. `result_size = len(results)`.

**Serialize span for Gremlin is deferred.** Cypher gets `graph.query.serialize` because deserialization is
centralized in `BaseConnector.execute`. Gremlin deserialization is spread across the queryset methods
(`gremlin/querysets/*`), so a clean serialize span there is a larger change. Out of scope this pass; noted
as a known asymmetry (the `db_execute` bar — the part that dominates — is covered for both).

### D5 — Session message span + metric

Wrap the body of `sessions/services.send_message` in a `session.message` span and emit a message metric
family:

| Instrument | Type | Unit |
|---|---|---|
| `invana.session.message.duration` | histogram | ms |
| `invana.session.message.count` | counter | — |
| `invana.session.message.errors` | counter | — |
| `invana.session.message.in_flight` | up-down counter | — |

**Labels:** `mode` (nl / ql), `surface` (explorer / modeller), `status` (ok / error / clarify).

This is the parent that ties `llm.generate` + `graph.query.*` into one end-to-end unit and makes
"how long does an NL message take, and what fraction is LLM vs query" answerable as a metric, not just per
trace. The generic FastAPI span stays; this adds the domain dimensions it lacks.

The span/metric wrap the whole function including the modeller branch (`_send_modeller_message`), so
Modeller generative sessions are covered too.

---

## Non-goals (this pass)

- **Streaming / time-to-first-token / inter-token latency.** All three providers are unary
  (`stream: False`); TTFT needs a provider-layer rework. Deferred — separate RFC when streaming lands.
- **LLM cost/pricing metrics.** Tokens are recorded; converting to cost (per-model pricing table) is
  deferred.
- **`gen_ai.*` OpenTelemetry semantic conventions.** We keep the `invana.llm.*` namespace for consistency
  with the existing families; adopting the semantic conventions is a separate migration.
- **Gremlin `graph.query.serialize` span** (D4) — deferred until Gremlin serialization is centralized.
- **Studio-side metrics** (Web Vitals, route-load timing) — still deferred per RFC-025 Non-Goals.

---

## Files touched

| File | Change |
|---|---|
| `engine/src/invana/telemetry/metrics.py` | + `invana.llm.*`, `invana.query.graph.*`, `invana.session.message.*` instruments; comment legacy gremlin family |
| `engine/src/invana/telemetry/__init__.py` | export `record_graph_query` / `record_llm_metrics` helpers (or a small `recorders.py`) |
| `engine/src/invana/llm/client.py` | emit LLM metrics in `_invoke`; thread `provider_name` + `operation` |
| `engine/src/invana/llm/translate.py` | pass `operation="translate"` to `complete_tool` |
| `engine/src/invana/llm/propose.py` | pass `operation="propose"` to `complete_tool` |
| `engine/src/invana/graph/connectors/base/connector.py` | emit unified query metrics around `db_execute` |
| `engine/src/invana/graph/connectors/gremlin/connector.py` | add span + duration + metrics to `execute_traversal` |
| `engine/src/invana/sessions/services.py` | `session.message` span + metric around `send_message` |
| `.changeset/*` | changeset (user-facing: observability) |

## Testing

Per CLAUDE.md (few, focused, real infra — no mocking): a small set of positive/negative checks that the
instruments emit with the right labels, exercised through an in-memory OTLP metric reader (metrics only;
no graph-DB fixture flush). Specifically: one LLM success + one LLM failure record the duration histogram
and error counter with `provider`/`status` labels; a Cypher and a Gremlin query each emit
`invana.query.graph.duration` with the right `language`; one NL and one QL message emit
`invana.session.message.duration` with the right `mode`. No new graph-DB tests are run unprompted
(memory: *don't run graph DB tests unless asked*).

## Open questions for review

1. **Metric namespace** — `invana.query.graph.*` (unified, language-labeled) vs keeping per-language
   families. RFC picks unified (D3). OK?
2. **LLM `operation` label** — worth threading `operation` through `complete_tool`, or label only by
   `provider`/`model_id`/`status` and skip it? (Threading is a 1-line change per caller.)
3. **Message span name** — `session.message` vs `sessions.send_message`. RFC picks `session.message`.
