"""Draw a playbook as a plan — the model reads prose, sentence by sentence.

This is not the workflow planner (:mod:`invana.apps.llm.planner`). That one
answers *what shape serves this question*; this one answers a narrower and more
checkable question: **which catalogue entry does this sentence name?** The
difference is what lets ambiguity be a declared condition rather than a feeling
([SK10 · SK24](docs/for-developers/modules/skills/features/authoring-a-skill.md)):

* exactly one candidate → a step, and the sentence is its ``source_span``;
* two or more → a **clarification**, quoting the sentence and offering the
  readings, each naming the step it would write;
* none → a ``form: human`` step, because a person can always do it (SK15);
* not an instruction at all → no step, and the sentence reads as *unmapped*.

The model never writes args it invented: it may bind one earlier step's output,
exactly as the workflow planner may, and everything else is validated against
the envelope before a row is written.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from invana.apps.llm import LLMError, complete_tool
from invana.apps.llm.schemas import Exchange, TokenUsage
from invana.apps.llm_providers.endpoint import LLMEndpoint

DRAFT_TOOL = {
    "type": "object",
    "properties": {
        "sentences": {
            "type": "array",
            "description": "Every sentence of the playbook, in the order it is written.",
            "items": {
                "type": "object",
                "properties": {
                    "span": {
                        "type": "string",
                        "description": "The sentence, copied VERBATIM from the playbook.",
                    },
                    "kind": {
                        "type": "string",
                        "enum": ["step", "not_an_instruction"],
                        "description": (
                            "'step' when the sentence tells the runtime to do something; "
                            "'not_an_instruction' for style, tone or context, e.g. 'Be concise.'"
                        ),
                    },
                    "candidates": {
                        "type": "array",
                        "description": (
                            "Every allowed task that could express this sentence. ONE when the "
                            "reading is clear. TWO OR MORE only when the sentence genuinely has "
                            "that many readings — a person will be asked to choose. EMPTY when no "
                            "allowed task can express it."
                        ),
                        "items": {
                            "type": "object",
                            "properties": {
                                "task": {"type": "string", "description": "One of the allowed task keys."},
                                "label": {"type": "string", "description": "What the step's row says."},
                                "why": {
                                    "type": "string",
                                    "description": "One short clause: what this reading would do.",
                                },
                                "binds": {
                                    "type": "string",
                                    "description": (
                                        "Optional ${steps.<earlier id>.<field>} this step consumes. Else ''."
                                    ),
                                },
                            },
                            "required": ["task", "label", "why", "binds"],
                        },
                    },
                },
                "required": ["span", "kind", "candidates"],
            },
        }
    },
    "required": ["sentences"],
}


@dataclass(frozen=True, slots=True)
class Candidate:
    task: str
    label: str
    why: str = ""
    binds: str = ""

    def as_option(self) -> dict:
        """The reading, as the clarification card offers it."""
        return {"step_key": self.task, "label": self.label, "why": self.why}


@dataclass(frozen=True, slots=True)
class DraftedSentence:
    span: str
    kind: str
    candidates: tuple[Candidate, ...] = ()

    @property
    def is_instruction(self) -> bool:
        return self.kind == "step"


@dataclass(slots=True)
class DraftedPlaybook:
    sentences: list[DraftedSentence] = field(default_factory=list)
    usage: TokenUsage | None = None
    exchange: Exchange = field(default_factory=Exchange)
    duration_ms: float = 0.0


def _vocabulary_lines(vocabulary: Sequence[Mapping[str, Any]]) -> str:
    lines = []
    for entry in sorted(vocabulary, key=lambda e: str(e.get("key"))):
        parts = [f"  {entry.get('key')}"]
        if entry.get("requires"):
            parts.append(f"after: {', '.join(entry['requires'])}")
        if entry.get("outputs"):
            parts.append("outputs: " + ", ".join(f"{k}:{v}" for k, v in sorted(entry["outputs"].items())))
        lines.append(" · ".join(parts))
    return "\n".join(lines) or "  (none)"


def _system_prompt(*, vocabulary: Sequence[Mapping[str, Any]], answered: Mapping[str, str]) -> str:
    settled = (
        "\n".join(f"  {span!r} → {task}" for span, task in sorted(answered.items())) if answered else "  (none yet)"
    )
    return (
        "You read a playbook a person wrote and map it onto a runtime's tasks. You do not "
        "execute it, and you do not rewrite it.\n\n"
        f"Allowed tasks (use nothing else), with what each needs before it and what it "
        f"produces:\n{_vocabulary_lines(vocabulary)}\n\n"
        "Rules:\n"
        "- Return EVERY sentence of the playbook, in order, with its span copied verbatim.\n"
        "- A sentence that tells the runtime to act is kind='step'. One that sets tone, context or "
        "style is kind='not_an_instruction' and has no candidates.\n"
        "- Give ONE candidate when the sentence clearly names one task. Give two or more ONLY when "
        "the sentence really carries that many readings — a person is stopped and asked, so a "
        "spurious second reading costs them an interruption.\n"
        "- Give NO candidates when no allowed task can express it; a person will do that step.\n"
        "- 'binds' may reference an EARLIER sentence's task as ${steps.<task>.<field>}, and only a "
        "field listed under that task's outputs.\n"
        "- Do not invent a task key. Do not merge two sentences into one step unless one of them "
        "only qualifies the other.\n\n"
        f"Readings the author has already settled — use these, never ask again:\n{settled}"
    )


async def draft_skill_plan(
    *,
    provider: LLMEndpoint,
    name: str,
    when_to_use: str,
    content: str,
    vocabulary: Sequence[Mapping[str, Any]],
    answered: Mapping[str, str] | None = None,
    encryption_key: str,
    timeout_s: float = 60.0,
) -> DraftedPlaybook:
    """Ask the model which task each sentence names.

    ``answered`` carries the clarifications this version has already settled, so
    a redraw never re-asks ([SK11](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    """
    result = await complete_tool(
        provider=provider,
        system=_system_prompt(vocabulary=vocabulary, answered=answered or {}),
        messages=[
            {
                "role": "user",
                "content": (f"Skill: {name}\nWhen to use it: {when_to_use or '(not stated)'}\n\nPlaybook:\n{content}"),
            }
        ],
        tool_schema=DRAFT_TOOL,
        tool_name="submit_mapping",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="plan",
    )
    raw = result.input.get("sentences") or []
    if not isinstance(raw, list) or not raw:
        raise LLMError("The model did not read that playbook as anything it could draw.")

    sentences: list[DraftedSentence] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        span = str(item.get("span") or "").strip()
        if not span:
            continue
        candidates = tuple(
            Candidate(
                task=str(c.get("task") or "").strip(),
                label=str(c.get("label") or "").strip(),
                why=str(c.get("why") or "").strip(),
                binds=str(c.get("binds") or "").strip(),
            )
            for c in (item.get("candidates") or [])
            if isinstance(c, dict) and str(c.get("task") or "").strip()
        )
        sentences.append(
            DraftedSentence(
                span=span,
                kind=str(item.get("kind") or "step").strip(),
                candidates=candidates,
            )
        )
    return DraftedPlaybook(
        sentences=sentences,
        usage=result.usage,
        exchange=result.exchange,
        duration_ms=result.duration_ms,
    )
