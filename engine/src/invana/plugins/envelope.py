"""The ``TaskEnvelope`` — one step of a run, as JSON any worker can pick up.

The orchestrator walks the plan and holds the frontier; each ready step leaves
it as an envelope, and a worker turns the envelope back into a call with
:func:`invana.plugins.worker.run_envelope`. Nothing live crosses: no DB
session, no connection manager, no emitter, no runtime. The worker rebuilds
those from the ids the envelope carries, which is what lets the same envelope
run in-process (the ``inline`` executor) or on another machine.

| Field | Holds |
|---|---|
| ``run_id`` · ``node_id`` · ``attempt`` | which step of which run, and which try of it |
| ``plugin`` | ``name@version`` of the plugin that declares the task type |
| ``task`` | ``key@version`` — the exact task type the plan pinned, or a bare key |
| ``args`` | the step's resolved args, JSON only |
| ``graph_id`` · ``lens_id`` · ``actor_id`` | the ids the worker rebuilds the run's world from |

Secrets never ride an envelope: a worker resolves them itself, for the task
type's declared ``secrets`` only.

Usage::

    env = TaskEnvelope(run_id=run.id, node_id=row.id, attempt=row.attempt,
                       plugin="invana.core.graph_read@1.4.0",
                       task="execute_graph_query@1.0.0", args={"query": "..."})
    wire = env.to_json()                     # onto the queue
    TaskEnvelope.from_json(wire) == env      # on the worker
    env.idempotency_key                      # "run:node:attempt" — writes check it
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from typing import Any

from invana.plugins.sdk.context import Out
from invana.plugins.sdk.errors import CannotAnswer, Converse, NeedsInput, TaskFailure


@dataclass(frozen=True, slots=True)
class TaskEnvelope:
    run_id: str
    node_id: str
    attempt: int
    plugin: str
    task: str
    args: dict[str, Any] = field(default_factory=dict)
    graph_id: str | None = None
    lens_id: str | None = None
    actor_id: str | None = None

    @property
    def key(self) -> str:
        """The task type's key without its version."""
        return self.task.partition("@")[0]

    @property
    def idempotency_key(self) -> str:
        """``run_id:node_id:attempt`` — the same on a redelivery, new on a retry.

        A redelivered envelope (its worker died) keeps the key, so a write task
        type that finds it already recorded skips the write. A retry the
        orchestrator decided on is a new attempt and writes again.
        """
        return f"{self.run_id}:{self.node_id}:{self.attempt}"

    def to_json(self) -> str:
        return json.dumps(asdict(self), sort_keys=True)

    @classmethod
    def from_json(cls, raw: str | bytes) -> TaskEnvelope:
        return cls(**json.loads(raw))


def out_to_json(out: Out) -> str:
    """What a worker sends back: the ``Out`` a task type returned."""
    return json.dumps(asdict(out), sort_keys=True, default=str)


def out_from_json(raw: str | bytes) -> Out:
    return Out(**json.loads(raw))


def outcome_to_json(result: Out | BaseException) -> dict[str, Any]:
    """What a worker made of an envelope, as tagged JSON — ``Out``, a failure, or a signal.

    | ``kind`` | Carries |
    |---|---|
    | ``out`` | every ``Out`` field |
    | ``failure`` | ``cls · cause · message · short · evidence · raw`` |
    | ``needs_input`` | ``question · options`` |
    | ``cannot_answer`` | ``reason · exchange`` |
    | ``converse`` | ``reply · options · exchange`` |

    Anything else a task type raised is a ``defect`` failure with cause
    ``worker_error``: the worker never lets an exception it cannot name cross.
    """
    if isinstance(result, Out):
        return json.loads(json.dumps({"kind": "out", **asdict(result)}, default=str))
    if isinstance(result, TaskFailure):
        return {
            "kind": "failure",
            "cls": result.cls,
            "cause": result.cause,
            "message": result.message,
            "short": result.short,
            "evidence": json.loads(json.dumps(result.evidence, default=str)),
            "raw": result.raw,
        }
    if isinstance(result, NeedsInput):
        return {"kind": "needs_input", "question": result.question, "options": list(result.options)}
    if isinstance(result, CannotAnswer):
        return {"kind": "cannot_answer", "reason": result.reason, "exchange": result.exchange}
    if isinstance(result, Converse):
        return {"kind": "converse", "reply": result.reply, "options": result.options, "exchange": result.exchange}
    return {
        "kind": "failure",
        "cls": "defect",
        "cause": "worker_error",
        "message": "The step failed inside the worker.",
        "short": "worker error",
        "evidence": {"type": type(result).__name__},
        "raw": str(result)[:2000],
    }


def outcome_from_json(outcome: dict[str, Any]) -> Out:
    """The inverse of :func:`outcome_to_json`: return the ``Out``, or raise what the worker raised."""
    body = {k: v for k, v in outcome.items() if k != "kind"}
    match outcome.get("kind"):
        case "out":
            return Out(**body)
        case "needs_input":
            raise NeedsInput(question=body["question"], options=list(body.get("options") or []))
        case "cannot_answer":
            raise CannotAnswer(reason=body["reason"], exchange=body.get("exchange") or {})
        case "converse":
            raise Converse(reply=body["reply"], options=body.get("options") or [], exchange=body.get("exchange") or {})
        case "failure":
            raise TaskFailure(
                cls=body["cls"],
                cause=body["cause"],
                message=body["message"],
                short=body.get("short"),
                evidence=body.get("evidence") or {},
                raw=body.get("raw"),
            )
    raise TaskFailure(
        cls="defect",
        cause="worker_error",
        message="The worker returned an outcome this engine cannot read.",
        short="unreadable outcome",
        evidence={"kind": outcome.get("kind")},
    )
