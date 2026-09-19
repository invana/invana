"""Grounded failure explanations (docs/for-developers/modules/ask/features/when-it-cannot-answer.md).

``cause`` and ``evidence`` come from the actual failure; ``suggestions`` are
drawn from what the failure allows — never invented. The LLM is not consulted.
"""

from __future__ import annotations

from invana.runtime.catalogue import TaskFailure

_SUMMARY = {
    "timeout": "The graph did not answer in time.",
    "query_invalid": "The generated query was rejected by the graph.",
    "db_error": "The graph returned an error.",
    "db_unreachable": "The graph connection is not available right now.",
    "query_not_read_only": "That query would write to the graph — only read-only queries run here.",
    "llm_failed": "The model could not produce an answer.",
    "proposal_invalid": "The proposed model did not fit the draft.",
    "internal": "Something went wrong inside the engine while answering.",
}


def diagnose(failure: TaskFailure, *, mode: str, attempts: int) -> dict:
    cause = failure.cause
    retryable = failure.cls == "transient"
    suggestions: list[dict] = []
    if retryable:
        suggestions.append({"label": "Try again", "action": {"retry": True}})
    if cause in {"timeout", "db_error"}:
        suggestions.append({"label": "Narrow the question", "action": {"focus_composer": True}})
    if cause == "query_invalid":
        suggestions.append(
            {"label": "Rephrase the question" if mode == "nl" else "Fix the query", "action": {"focus_composer": True}}
        )
    if cause == "db_unreachable":
        suggestions.append({"label": "Check the connection", "route": "settings/connection"})
    if cause == "llm_failed":
        suggestions.append({"label": "Check the LLM provider", "route": "settings/llms"})
    return {
        "cause": cause,
        "summary": failure.message or _SUMMARY.get(cause, _SUMMARY["internal"]),
        "evidence": {**failure.evidence, "attempts": attempts, **({"raw": failure.raw} if failure.raw else {})},
        "suggestions": suggestions,
        "retryable": retryable,
    }


def internal_failure(exc: BaseException) -> TaskFailure:
    return TaskFailure(cls="defect", cause="internal", message=_SUMMARY["internal"], raw=repr(exc))
