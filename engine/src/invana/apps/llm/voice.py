"""An agent's voice — the dials, the soul, and the default when neither is set
(docs/for-developers/modules/agents/features/soul.md ·
docs/for-developers/modules/agents/features/author-an-agent.md § Voice dials).

The voice is words and nothing else. It reaches the steps whose output a person
reads — Understand's ``question`` and ``reason`` today — and is **not passed**
to Plan, Translate, Validate or Execute (SO2): no parameter there takes it, so
no soul can reach a query.

Order inside the block is fixed: the dials, then the Markdown. A sentence in the
soul can override a dial, because it is read after it (AG16).
"""

from __future__ import annotations

from dataclasses import dataclass

from invana.apps.llm.client import complete_tool
from invana.apps.llm.schemas import TokenUsage
from invana.apps.llm_providers.endpoint import LLMEndpoint
from invana.core.errors import ValidationError

#: Each dial, its values, and its default — Invana's voice. The first tuple is
#: the closed vocabulary a write is checked against.
TRAITS: dict[str, tuple[tuple[str, ...], str]] = {
    "humour": (("off", "light", "playful"), "light"),
    "formality": (("casual", "neutral", "formal"), "neutral"),
    "emoji": (("off", "on"), "off"),
    "greeting": (("off", "on"), "off"),
}

DEFAULT_TRAITS: dict[str, str] = {key: default for key, (_values, default) in TRAITS.items()}

#: What an agent with no soul sounds like (SO3): warm, plain, brief, first
#: person, and ending with something the reader can do next. Owned by the
#: product — one constant, so every empty soul reads the same.
DEFAULT_VOICE = (
    "You are a colleague who knows this graph well. Speak in the first person, warmly and plainly. "
    "Keep it brief: short sentences, no filler, no jargon the reader did not use. "
    "When you can, end with one thing the reader could do or ask next."
)

_HUMOUR = {
    "off": "Do not joke.",
    "light": "A light touch of humour is welcome where it fits; never at the reader's expense.",
    "playful": "Be playful — a little wit is part of how you speak.",
}
_FORMALITY = {
    "casual": "Write casually, as to a teammate.",
    "neutral": "Write in a neutral, professional register.",
    "formal": "Write formally.",
}
_EMOJI = {"off": "Use no emoji.", "on": "An emoji now and then is fine."}
_GREETING = {"off": "Do not open with a greeting.", "on": "Open with a short greeting."}

#: AG17, stated to the model because Understand decides *in the same call*
#: whether it cannot answer — there is no second call to switch the dial for.
_WENT_WRONG = (
    "Whatever the above says about humour: when you refuse, cannot answer, or report an error "
    "or a pause, use no humour at all."
)


def check_traits(traits: dict | None) -> dict[str, str]:
    """The dials as stored, or a refusal naming the first thing outside the
    vocabulary. A missing key is left missing — it reads as its default."""
    out: dict[str, str] = {}
    for key, value in (traits or {}).items():
        if key not in TRAITS:
            known = ", ".join(TRAITS)
            raise ValidationError(f"'{key}' is not a voice dial. The dials are: {known}.")
        values, _default = TRAITS[key]
        if value not in values:
            raise ValidationError(f"'{value}' is not a value of '{key}'. It takes one of: {', '.join(values)}.")
        out[key] = value
    return out


def render_traits(traits: dict | None, *, went_wrong: bool = False) -> str:
    """The dials as the sentences a prompt carries.

    ``went_wrong`` is AG17 for a caller that already knows the reply is a
    refusal, an error, a cannot-answer or a budget pause: humour is off,
    whatever the dial says. A caller that does not know yet gets the rule as a
    sentence instead.
    """
    dials = {**DEFAULT_TRAITS, **(traits or {})}
    humour = "off" if went_wrong else dials["humour"]
    lines = [
        _HUMOUR[humour],
        _FORMALITY[dials["formality"]],
        _EMOJI[dials["emoji"]],
        _GREETING[dials["greeting"]],
    ]
    if not went_wrong and humour != "off":
        lines.append(_WENT_WRONG)
    return " ".join(lines)


def voice_for(soul: str | None, traits: dict | None, *, went_wrong: bool = False) -> str:
    """``render_traits(soul_traits)`` then ``soul or DEFAULT_VOICE`` — the block
    ``RunVars.soul`` carries into every step that reads the soul."""
    return f"{render_traits(traits, went_wrong=went_wrong)}\n\n{(soul or '').strip() or DEFAULT_VOICE}"


# ── the preview ───────────────────────────────────────────────────────────────

_PREVIEW_TOOL = {
    "type": "object",
    "properties": {"reply": {"type": "string", "description": "The reply, as the reader would read it."}},
    "required": ["reply"],
}


def _preview_system(voice: str) -> str:
    # The preview judges a voice, not an answer. Nothing here has read the
    # graph, so the model is told to state no fact about the data — a preview
    # that invented one would be the hallucination the product promises against.
    return (
        "This is a preview of how you sound, not an answer. You have not read the graph for this ask, "
        "so state no fact, number or name from the data. In two to four sentences, reply as you would "
        "begin: acknowledge the ask, say what you would look at, and what the reader could do next.\n\n"
        f"How you speak:\n{voice}"
    )


@dataclass(slots=True)
class Spoken:
    reply: str
    usage: TokenUsage | None


async def speak(*, provider: LLMEndpoint, voice: str, ask: str, encryption_key: str, timeout_s: float = 60.0) -> Spoken:
    """One reply to ``ask`` in ``voice`` — half of the soul preview (SO C5)."""
    result = await complete_tool(
        provider=provider,
        system=_preview_system(voice),
        messages=[{"role": "user", "content": ask}],
        tool_schema=_PREVIEW_TOOL,
        tool_name="submit_reply",
        encryption_key=encryption_key,
        timeout_s=timeout_s,
        operation="soul_preview",
    )
    return Spoken(reply=str(result.input.get("reply") or "").strip(), usage=result.usage)
