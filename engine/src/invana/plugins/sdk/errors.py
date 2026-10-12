"""What a task type may raise instead of returning ``Out``.

``TaskFailure`` carries a failure **class**
(docs/for-developers/modules/ask/features/when-it-cannot-answer.md) so the
interpreter can choose between retry, diagnose and stop. ``NeedsInput`` suspends
the run on a question, and ``CannotAnswer`` and ``Converse`` end it successfully
without an answer.
"""

from __future__ import annotations


class TaskFailure(Exception):
    """A task failed. ``cls`` is the failure class from
    docs/for-developers/modules/ask/features/when-it-cannot-answer.md that decides the response.

    ``cause`` is the machine code for the diagnosis, ``message`` the user-facing
    sentence, ``evidence`` the structured facts it was derived from.
    """

    def __init__(
        self,
        *,
        cls: str,
        cause: str,
        message: str,
        short: str | None = None,
        evidence: dict | None = None,
        raw: str | None = None,
    ) -> None:
        super().__init__(message)
        self.cls = cls
        self.cause = cause
        self.message = message
        self.short = short or message
        self.evidence = evidence or {}
        self.raw = raw


class NeedsInput(Exception):
    """The model asked a question instead of answering
    (docs/for-developers/modules/ask/features/clarifying-questions.md)."""

    def __init__(self, *, question: str, options: list[str]) -> None:
        super().__init__(question)
        self.question = question
        self.options = options


class CannotAnswer(Exception):
    """The ask is outside this graph — a legitimate outcome, not a failure.

    The run **succeeds**: promise #4 is that Invana says so, visibly
    styled as *not* an answer, rather than inventing one or erroring. Raised by
    *Understand*, so the judgement lands before any query is written.
    """

    def __init__(self, *, reason: str, exchange: dict | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        #: The prompt and completion that reached the judgement — the evidence
        #: for it, kept on the step like an answer's is (NL10 · SR42).
        self.exchange = exchange or {}


class Converse(Exception):
    """The ask was small talk — replied to, not answered (NL12).

    The run **succeeds** with outcome ``conversed``: it ran no query and claims
    nothing about the data, so it is neither *answered* nor *cannot answer*
    (CA8). Raised by *Understand*, so no plan is made.
    """

    def __init__(self, *, reply: str, options: list[str] | None = None, exchange: dict | None = None) -> None:
        super().__init__(reply)
        self.reply = reply
        #: Questions to ask next, each one this run could answer (NL14). Empty
        #: is a plain reply.
        self.options = options or []
        #: The prompt and completion behind the reply, kept on the step (NL10).
        self.exchange = exchange or {}
