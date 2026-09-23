"""SQLAlchemy async models for Skills — ``skills``, ``skill_versions``,
``skill_bindings``, ``rules`` and ``rule_versions``
(docs/for-developers/modules/skills/spec.md § 3).

One ``skills`` row = one capability the Graph's agents can invoke. Hard delete,
cascade-from-Graph. Names are unique per Graph.

**The skill is the identity; the version is the text.** ``skills`` owns
``graph_id · name · current_version_id`` and nothing a person writes; every word
of the playbook lives on an immutable ``skill_versions`` row. Editing publishes
the next version rather than overwriting the last, because a step records the
version it was offered and a trace has to resolve it forever
([SK2 · SK3](docs/for-developers/modules/skills/features/authoring-a-skill.md)).

``skill_bindings`` is where an agent is offered a skill
([BN6](docs/for-developers/modules/skills/features/bindings.md)). It lives here rather than
in ``apps/agents`` because Skills is an independent module that agents bind
**to**: the row is named for what it binds, and nothing in this package imports
an agent to write one.

The first two tables point at each other — ``skills.current_version_id`` at the
published head, ``skill_versions.skill_id`` back at the subject. That is a
deliberate cycle: *which version is live* is a property of the skill, not a flag
on a row that is supposed to be immutable. It is broken with ``use_alter`` on the
schema and ``post_update`` on the relationship, so one INSERT never waits on the
other.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from invana.core.models import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return str(uuid.uuid4())


class Skill(Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("graph_id", "name", name="uq_skill_graph_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    #: ``builtin`` — seeded into every Graph and re-seeded idempotently by name
    #: — or ``authored``. A builtin skill is the product's own playbook and is
    #: still editable: publishing v2 over it is an ordinary act
    #: ([SK25](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    origin: Mapped[str] = mapped_column(String(16), default="authored", nullable=False)

    #: The published head. Nullable in the schema only because the skill row is
    #: inserted before the version it will point at — a skill with no current
    #: version is null while a skill has only a **draft**
    #: ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    current_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("skill_versions.id", ondelete="SET NULL", use_alter=True, name="fk_skills_current_version"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    #: Eager by default: every reader of a skill wants its text, and prompt
    #: assembly reads the whole bound set at once.
    current_version: Mapped[SkillVersion | None] = relationship(
        "SkillVersion",
        foreign_keys=[current_version_id],
        lazy="selectin",
        post_update=True,
    )

    # ── derived ──────────────────────────────────────────────────────────────
    # The text reads through the head, so a caller never has to know that
    # versions exist to render a skill.

    @property
    def version(self) -> int:
        return self.current_version.version if self.current_version is not None else 0

    @property
    def is_draft(self) -> bool:
        """Never published. Nothing is offered it, and the drawer says so
        ([SK21](docs/for-developers/modules/skills/features/authoring-a-skill.md))."""
        return self.current_version_id is None

    @property
    def description(self) -> str:
        return self.current_version.description if self.current_version is not None else ""

    @property
    def content(self) -> str:
        return self.current_version.content if self.current_version is not None else ""

    @property
    def when_to_use(self) -> str:
        return self.current_version.when_to_use if self.current_version is not None else ""


class SkillVersion(Base):
    """One published version of a skill. **Immutable** once written.

    There is no ``updated_at`` and nothing here is ever reassigned: publishing a
    change mints ``version + 1`` and repoints the skill. That is what lets
    ``task_runs.skills_offered`` name a version and still resolve years later
    ([US3](docs/for-developers/modules/skills/features/usage.md)).

    ``plan_id`` — one version, exactly one ``TaskPlan``
    ([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    It landed with M8 (building-engine/skills-draw-as-plans.md), added over a
    backfill and altered to ``NOT NULL`` in the same migration rather than left
    nullable for a release.

    **A draft is a version with no ``published_at``**
    ([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)),
    and it is the single exception to the immutability above: it is the row a
    person is still writing, and publishing is what closes it.
    """

    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uq_skill_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    skill_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("skills.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    #: 1-based and gapless within a skill.
    version: Mapped[int] = mapped_column(Integer, nullable=False)

    # The skill's "what".
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Markdown body — the skill's "how": the operational definition the agent
    # follows.
    content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Markdown — the skill's "when": signals the agent uses to decide whether
    # to apply it.
    when_to_use: Mapped[str] = mapped_column(Text, default="", nullable=False)

    #: Who published it. SET NULL, not CASCADE — a departed author does not
    #: delete the version their team is still being offered.
    #: **One version, exactly one plan**
    #: ([SK13](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    #: `RESTRICT`, because deleting a plan out from under a published version
    #: would break every trace that named it. A draft is written *with* its
    #: plan — one `form: human` node — so no surface branches on *does this
    #: have a flow* ([SK22](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    #:
    #: The column is a plain FK by table name: `apps/skills` imports nothing
    #: from `apps/task_plans`, because `apps/task_plans` imports `apps/agents`
    #: and `apps/agents` imports this package. The composition lives one band
    #: up, in `runtime/managers/skill_draft.py`.
    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("task_plans.id", ondelete="RESTRICT"), nullable=False, unique=True
    )

    published_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    #: **Null is the draft** — the one mutable version row there will ever be
    #: ([SK20](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    #: Publishing stamps it, moves `skills.current_version_id`, and the row is
    #: immutable from then on.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    @property
    def is_draft(self) -> bool:
        return self.published_at is None


class SkillVersionClarification(Base):
    """A question the planner asked about one sentence, and the answer.

    Recorded on the version so a redraw **never re-asks**, and so the answer
    that shaped the plan is part of what published
    ([SK11 · SK24](docs/for-developers/modules/skills/features/authoring-a-skill.md)).
    An unanswered row is the open question the surface draws against its
    sentence; there is at most one of those at a time, because the planner
    stops at the first ambiguity rather than collecting a queue.
    """

    __tablename__ = "skill_version_clarifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    skill_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skill_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: The sentence, verbatim — what the card quotes and what `Task.source_span`
    #: carries on the node the answer writes.
    span: Mapped[str] = mapped_column(Text, nullable=False)
    question: Mapped[str] = mapped_column(Text, default="", nullable=False)
    #: `[{step_key, label, why}]` — the readings, each naming the step it would
    #: write. Never a free-text box (*Not building*).
    options: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class SkillBinding(Base):
    """One agent may be offered one skill.

    A binding points at the **skill**, never at a version
    ([BN2](docs/for-developers/modules/skills/features/bindings.md)) — the agent
    is offered whatever is current when the run assembles its prompt, which is
    what makes publishing a better version worth doing.

    A row rather than a JSON array on the agent, because binding is a write with
    its own refusal: a check that must name *which* skill it rejected, and why,
    has nothing to hold on to when the request replaces a whole list
    ([BN5 · BN6](docs/for-developers/modules/skills/features/bindings.md)).
    ``bound_by_id`` and ``bound_at`` are the other half of that — who changed the
    bindings, and when.
    """

    __tablename__ = "skill_bindings"
    __table_args__ = (UniqueConstraint("skill_id", "agent_id", name="uq_skill_binding"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    skill_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: SET NULL — a departed author does not unbind the skills they set up.
    bound_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    bound_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)


class Rule(Base):
    """One statement that is always true in its scope.

    A **skill** is a playbook that may be offered; a **rule** is a statement that
    is always true. Both are authored once and reach a step as discrete items
    with ids — and neither is enforced. A rule that must be enforced is an
    envelope bound or a criterion, not a rule
    ([RU5](docs/for-developers/modules/skills/features/rules.md)).

    **One axis** ([RU6](docs/for-developers/modules/skills/features/rules.md)):
    a rule always belongs to a Graph, and a ``project_id`` is what makes it a
    working rule rather than an invariant. ``scope`` and ``kind`` are read off
    that one column, so ``scope='graph', kind='working'`` is not representable.
    """

    __tablename__ = "rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    graph_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: Set on a working rule; null on an invariant. CASCADE — a project's rules
    #: go with the project, and the Graph's invariants are untouched.
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True
    )
    #: ``false`` stops it being offered. **Not a version** and not a delete
    #: ([RU4](docs/for-developers/modules/skills/features/rules.md)) — the
    #: versions and every past citation stay resolvable.
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: Sequence in the assembled context, never importance
    #: ([C7](docs/for-developers/modules/skills/features/rules.md)). Nothing
    #: ranks a rule: it is offered or it is not.
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    current_version_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("rule_versions.id", ondelete="SET NULL", use_alter=True, name="fk_rules_current_version"),
        nullable=True,
    )

    created_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    current_version: Mapped[RuleVersion | None] = relationship(
        "RuleVersion",
        foreign_keys=[current_version_id],
        lazy="selectin",
        post_update=True,
    )

    # ── derived ──────────────────────────────────────────────────────────────

    @property
    def scope(self) -> str:
        return "project" if self.project_id else "graph"

    @property
    def kind(self) -> str:
        return "working" if self.project_id else "invariant"

    @property
    def version(self) -> int:
        return self.current_version.version if self.current_version is not None else 0

    @property
    def statement(self) -> str:
        return self.current_version.statement if self.current_version is not None else ""


class RuleVersion(Base):
    """One published wording of a rule. **Immutable** once written.

    Deactivating is not a version
    ([RU4](docs/for-developers/modules/skills/features/rules.md)): ``active``
    lives on the rule, so turning a rule off leaves every version — and every
    step that cited one — exactly where it was.
    """

    __tablename__ = "rule_versions"
    __table_args__ = (UniqueConstraint("rule_id", "version", name="uq_rule_version_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_id)
    rule_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    #: One statement. If it needs a paragraph it is two rules
    #: ([RU1](docs/for-developers/modules/skills/features/rules.md)) — which is
    #: a nudge on the surface, not a length the column refuses.
    statement: Mapped[str] = mapped_column(Text, default="", nullable=False)

    published_by_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
