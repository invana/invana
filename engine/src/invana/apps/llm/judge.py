"""The labelled judge — a rubric score for one answer (docs/for-developers/modules/skills/features/evals.md).

A judge is a pinned model that differs from the model under test. It reads the
question, the answer as text and the set's rubric, and returns a score from 0
to 5 with one line of reasoning. The score is **labelled and kept apart**: it
warns in the publish gate and is never added to a hard count, because prose
quality is a model's opinion and a hard check is a fact.
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.schemas import TokenUsage
from invana.apps.llm_providers.endpoint import LLMEndpoint

JUDGE_TOOL = {
    "type": "object",
    "properties": {
        "score": {"type": "number", "description": "0 (fails the rubric) to 5 (meets every point of it)."},
        "why": {"type": "string", "description": "One line: the rubric point that decided the score."},
    },
    "required": ["score", "why"],
}

_SYSTEM = (
    "You grade one answer from a knowledge-graph assistant against a rubric. "
    "Read only what the answer says; do not add facts. Score 0 to 5 and give one line naming "
    "the rubric point that decided it.\n\nRubric:\n{rubric}"
)


@dataclass(frozen=True, slots=True)
class Judged:
    score: float
    why: str
    usage: TokenUsage


async def judge_answer(
    *,
    provider: LLMEndpoint,
    rubric: str,
    question: str,
    answer: str,
    encryption_key: str,
    timeout_s: float = 60.0,
) -> Judged:
    """Score one answer against the rubric; raises ``LLMError`` on a reply it cannot read."""
    result = await complete_tool(
        provider=provider,
        system=_SYSTEM.format(rubric=rubric),
        messages=[{"role": "user", "content": f"Question:\n{question}\n\nAnswer:\n{answer or '(no answer)'}"}],
        tool_schema=JUDGE_TOOL,
        tool_name="submit_score",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="judge",
    )
    raw = result.input.get("score")
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        raise LLMError("The judge did not return a score.")
    return Judged(score=max(0.0, min(5.0, float(raw))), why=str(result.input.get("why") or ""), usage=result.usage)
